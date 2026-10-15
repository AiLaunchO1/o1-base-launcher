import { config } from '../config.ts';
import { object } from '../security/validation.ts';

export class O1Error extends Error {
  status: number; code: string; retryAfter: string|null;
  constructor(status: number, code: string, message: string, retryAfter:string|null=null) { super(message); this.status=status; this.code=code; this.retryAfter=retryAfter; }
}
export class O1Client {
  private apiKey: string; private baseUrl: string;
  constructor(apiKey = config.apiKey, baseUrl = config.apiBase) {
    const url=new URL(baseUrl);
    if(url.protocol!=='https:'||url.username||url.password)throw new Error('o1 API base URL must use HTTPS without embedded credentials');
    this.apiKey=apiKey; this.baseUrl=baseUrl.replace(/\/$/,'');
  }
  async request<T>(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    if (!this.apiKey) throw new Error('O1_API_KEY is required');
    const headers: Record<string, string> = { 'x-api-key': this.apiKey, 'accept': 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const response = await fetch(this.baseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new O1Error(response.status, String(payload.code || 'http_error'), String(payload.detail || payload.title || `o1 HTTP ${response.status}`),response.headers.get('retry-after'));
    return object(payload) as T;
  }
  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body: unknown, key?: string) { return this.request<T>('POST', path, body, key); }
}

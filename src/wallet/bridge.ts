import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config.ts';
import { address, sameAddress, txHash } from '../security/validation.ts';
import { IntentStore } from '../security/permissions.ts';
import { bridgePage } from './bridge-page.ts';
import { rpc, receipt } from './rpc.ts';
import { personalMessageHash } from '../security/keccak.ts';

async function jsonBody(req: IncomingMessage): Promise<any> {
  let text = '';
  for await (const chunk of req) { text += chunk; if (text.length > 16384) throw new Error('Request too large'); }
  return JSON.parse(text || '{}');
}
function send(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(value));
}
export class WalletBridge {
  private token = randomBytes(32).toString('hex');
  private account: string | null = null;
  private expires = 0;
  private challenge: {message:string;expires:number}|null = null;
  private server = createServer((req,res) => { this.handle(req,res).catch(e => send(res,400,{error:String(e.message||e)})); });
  private port = 0;
  intents: IntentStore;
  constructor(intents: IntentStore) { this.intents=intents; }
  async start() {
    await new Promise<void>(resolve => this.server.listen(config.bridgePort, '127.0.0.1', resolve));
    const addr = this.server.address(); if (!addr || typeof addr === 'string') throw new Error('Bridge did not bind');
    this.port = addr.port;
    return this.url();
  }
  close() { this.server.close(); }
  url() { return `http://127.0.0.1:${this.port}/#${this.token}`; }
  connected() { if (Date.now() > this.expires) this.account = null; return this.account; }
  private auth(req: IncomingMessage): boolean {
    const host = req.headers.host;
    const origin = req.headers.origin;
    if (host !== `127.0.0.1:${this.port}` || (origin && origin !== `http://127.0.0.1:${this.port}`)) return false;
    const candidate = req.headers['x-bridge-token'];
    if (typeof candidate !== 'string' || candidate.length !== this.token.length) return false;
    return timingSafeEqual(Buffer.from(candidate), Buffer.from(this.token));
  }
  private async handle(req: IncomingMessage, res: ServerResponse) {
    if (req.url === '/' && req.method === 'GET') {
      res.writeHead(200, { 'content-type':'text/html; charset=utf-8', 'content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'", 'cache-control':'no-store', 'referrer-policy':'no-referrer', 'x-frame-options':'DENY' });
      res.end(bridgePage); return;
    }
    if (!this.auth(req)) { send(res,403,{error:'Unauthorized bridge request'}); return; }
    if (req.url === '/state' && req.method === 'GET') { send(res,200,{account:this.connected(),intents:this.intents.list().map(i=>({id:i.id,kind:i.kind,tx:i.tx,review:i.review,expires:i.expires,state:i.state}))}); return; }
    if (req.url === '/challenge' && req.method === 'GET') {
      const message=`o1 Base Launcher local wallet session\nNonce: ${randomBytes(24).toString('hex')}\nChain: 8453\nExpires: ${new Date(Date.now()+5*60_000).toISOString()}`;
      this.challenge={message,expires:Date.now()+5*60_000};send(res,200,{message});return;
    }
    if (req.url === '/connect' && req.method === 'POST') {
      const body = await jsonBody(req); const account=address(body.account);
      if(!this.challenge||Date.now()>this.challenge.expires)throw new Error('Wallet challenge expired');
      const signature=String(body.signature||'');
      if(!/^0x[a-fA-F0-9]{130}$/.test(signature))throw new Error('Invalid wallet signature');
      const hash=personalMessageHash(this.challenge.message);
      const r=signature.slice(2,66),s=signature.slice(66,130);let v=parseInt(signature.slice(130,132),16);if(v<27)v+=27;
      if(v!==27&&v!==28)throw new Error('Invalid signature recovery ID');
      const calldata=hash+'0'.repeat(62)+v.toString(16).padStart(2,'0')+r+s;
      const recovered=await rpc('eth_call',[{to:'0x0000000000000000000000000000000000000001',data:calldata},'latest']);
      if(!recovered||recovered.length!==66||!sameAddress('0x'+recovered.slice(-40),account))throw new Error('Wallet signature did not verify on Base');
      this.challenge=null;this.account = account; this.expires = Date.now()+15*60*1000;
      send(res,200,{account:this.account,expires:this.expires}); return;
    }
    if (req.url?.startsWith('/intent/') && req.method === 'GET') {
      const id = decodeURIComponent(req.url.slice('/intent/'.length)); const intent = this.intents.get(id);
      if (!this.connected() || !sameAddress(this.account!, intent.tx.from!)) throw new Error('Wallet session does not match intent');
      if (intent.state !== 'requested') throw new Error('Intent is not awaiting approval');
      send(res,200,{account:this.account,intent}); return;
    }
    if (req.url === '/submitted' && req.method === 'POST') {
      const body = await jsonBody(req); const intent = this.intents.get(String(body.id));
      if (!this.connected() || !sameAddress(this.account!,intent.tx.from!)) throw new Error('Wallet session does not match intent');
      const hash = txHash(body.hash);
      this.intents.submitted(intent.id,hash); send(res,200,{hash}); return;
    }
    send(res,404,{error:'Not found'});
  }
  async status(id: string) {
    const intent = this.intents.get(id);
    if (!intent.hash) return { state:intent.state, expires:intent.expires };
    const tx=await rpc('eth_getTransactionByHash',[intent.hash]);
    if(!tx)return {state:'pending',hash:intent.hash};
    if(!sameAddress(address(tx.from),intent.tx.from!)||!sameAddress(address(tx.to),intent.tx.to)||BigInt(tx.value).toString()!==intent.tx.value||String(tx.input).toLowerCase()!==intent.tx.data.toLowerCase()) { intent.state='failed'; return {state:'mismatched_transaction',hash:intent.hash}; }
    const chainReceipt = await receipt(intent.hash);
    if (!chainReceipt) return { state:'pending', hash:intent.hash };
    const ok = chainReceipt.status === '0x1'; intent.state = ok ? 'confirmed' : 'failed';
    return { state:intent.state,hash:intent.hash,block:chainReceipt.blockNumber,explorer:`https://basescan.org/tx/${intent.hash}` };
  }
}

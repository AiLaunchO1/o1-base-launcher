import { config } from '../config.ts';
import { address, txHash, hexData } from '../security/validation.ts';

let rpcId = 0;
export async function rpc(method: string, params: unknown[] = []): Promise<any> {
  const response = await fetch(config.rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Base RPC HTTP ${response.status}`);
  const data = await response.json() as any;
  if (data.error) throw new Error(`Base RPC ${data.error.code}: ${data.error.message}`);
  return data.result;
}
export async function receipt(hash: string): Promise<any> { return rpc('eth_getTransactionReceipt', [txHash(hash)]); }
export async function balance(account: string): Promise<string> { return BigInt(await rpc('eth_getBalance', [address(account), 'latest'])).toString(); }
export async function erc20Balance(token: string, account: string): Promise<string> {
  const data = '0x70a08231' + address(account).slice(2).toLowerCase().padStart(64, '0');
  return BigInt(await rpc('eth_call', [{ to: address(token), data: hexData(data) }, 'latest'])).toString();
}
export async function erc20Decimals(token: string): Promise<number> {
  const raw = await rpc('eth_call', [{ to: address(token), data: '0x313ce567' }, 'latest']);
  const n = Number(BigInt(raw));
  if (!Number.isInteger(n) || n < 0 || n > 36) throw new Error('Invalid token decimals');
  return n;
}

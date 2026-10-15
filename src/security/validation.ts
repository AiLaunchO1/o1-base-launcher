export function address(value: unknown): string {
  if (typeof value !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error('Invalid EVM address');
  return value;
}
export function positiveRaw(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value) || BigInt(value) <= 0n) throw new Error('Amount must be a positive base-unit integer string');
  return value;
}
export function nonnegativeRaw(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) throw new Error('Invalid base-unit integer string');
  return value;
}
export function txHash(value: unknown): string {
  if (typeof value !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(value)) throw new Error('Invalid transaction hash');
  return value;
}
export function hexData(value: unknown): string {
  if (typeof value !== 'string' || !/^0x(?:[a-fA-F0-9]{2})*$/.test(value)) throw new Error('Invalid transaction data');
  return value;
}
export function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object');
  return value as Record<string, any>;
}
export function sameAddress(a: string, b: string): boolean { return a.toLowerCase() === b.toLowerCase(); }
export function bps(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 4999) throw new Error('Slippage must be 1–4999 bps');
  return value as number;
}
export function expiry(value: unknown): number {
  const n = typeof value === 'number' ? value : Date.parse(String(value));
  if (!Number.isFinite(n)) throw new Error('Missing or invalid plan expiry');
  return n < 1e12 ? n * 1000 : n;
}
export function parseUnits(value: unknown, decimals: number): string {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new Error('Invalid decimal amount');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) throw new Error('Too many decimal places');
  const raw = BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction.padEnd(decimals, '0') || '0'));
  return positiveRaw(raw.toString());
}

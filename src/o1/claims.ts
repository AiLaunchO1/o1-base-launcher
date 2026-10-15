import { O1Client } from './client.ts';
import { address } from '../security/validation.ts';
export async function feePositions(api:O1Client,wallet:string) { return api.get<any>('/wallets/'+address(wallet)+'/fee-claims?chain_id=8453&state=claimable'); }
export async function prepareFeeClaim(api:O1Client,body:unknown) { return api.post<any>('/claims/fees/prepare',body); }

import { O1Client } from './client.ts';
export async function quoteSwap(api:O1Client,body:unknown) { return api.post<any>('/swaps/quote',body); }
export async function prepareSwap(api:O1Client,quoteId:string,wallet:string) { return api.post<any>('/swaps/prepare',{quote_id:quoteId,wallet}); }

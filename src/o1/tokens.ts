import { O1Client } from './client.ts';
import { address } from '../security/validation.ts';
export async function searchTokens(api:O1Client,query:string) { return api.get<any>('/tokens/search?chain_id=8453&q='+encodeURIComponent(query)+'&limit=25'); }
export async function tokenDetails(api:O1Client,token:string) { return api.get<any>('/tokens/8453/'+address(token)); }
export async function creatorLaunches(api:O1Client,wallet:string) { return api.get<any>('/creators/'+address(wallet)+'/tokens?chain_id=8453&sort=newest'); }
export async function liveConfig(api:O1Client,product='non-tax') { const suffix=product==='non-tax'?'':'&launch_product='+encodeURIComponent(product); return api.get<any>('/config?chain_id=8453&market=all&include=chains,suites,quotes&active_only=true'+suffix); }

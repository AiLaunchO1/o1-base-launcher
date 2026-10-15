import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { O1Client, O1Error } from './client.ts';
const keys=new Map<string,{key:string;until:number}>();
export async function prepareStandardLaunch(api:O1Client,body:unknown) {
  const fingerprint=createHash('sha256').update(JSON.stringify(body)).digest('hex');
  let entry=keys.get(fingerprint);
  if(!entry||entry.until<Date.now()){entry={key:randomUUID(),until:Date.now()+10*60_000};keys.set(fingerprint,entry)}
  try { return await api.post<any>('/launches/prepare',body,entry.key); }
  catch(e) { if(e instanceof O1Error&&e.code==='stale_plan')keys.delete(fingerprint); throw e; }
}

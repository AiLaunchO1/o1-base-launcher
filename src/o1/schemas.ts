import { object, expiry } from '../security/validation.ts';
import type { O1Quote, O1Plan } from './types.ts';
export function planEnvelope(raw:unknown):O1Plan {
  const outer=object(raw),plan=object(outer.data||outer);
  if(!Array.isArray(plan.steps)||!plan.steps.length)throw new Error('Invalid o1 plan steps');
  expiry(plan.expires_at);
  return plan as O1Plan;
}
export function quoteEnvelope(raw:unknown):O1Quote {
  const outer=object(raw),quote=object(outer.data||outer);
  if(typeof quote.quote_id!=='string'||!quote.quote_id)throw new Error('Invalid o1 quote ID');
  expiry(quote.expires_at);
  return quote as O1Quote;
}

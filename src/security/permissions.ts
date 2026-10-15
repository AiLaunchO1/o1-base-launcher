import { randomUUID } from 'node:crypto';
import { address, expiry, hexData, nonnegativeRaw, object, sameAddress } from './validation.ts';
import type { O1Plan, O1Transaction } from '../o1/types.ts';

export interface StoredIntent { id: string; kind: string; tx: O1Transaction; review: unknown; expires: number; state: 'prepared' | 'requested' | 'submitted' | 'confirmed' | 'failed'; hash?: string; }
export class IntentStore {
  private intents = new Map<string, StoredIntent>();
  add(kind: string, tx: O1Transaction, review: unknown, expires: number, wallet: string): StoredIntent {
    const clean: O1Transaction = { to: address(tx.to), data: hexData(tx.data), value: nonnegativeRaw(tx.value), from: address(wallet), chain_id: 8453 };
    if (tx.from && !sameAddress(address(tx.from), wallet)) throw new Error('Plan sender differs from connected wallet');
    if (tx.chain_id !== undefined && tx.chain_id !== 8453) throw new Error('Wrong plan chain');
    if (expires <= Date.now() + 5000) throw new Error('Plan expired or too close to expiry');
    const intent: StoredIntent = { id: randomUUID(), kind, tx: clean, review, expires, state: 'prepared' };
    this.intents.set(intent.id, intent);
    return intent;
  }
  fromO1(kind: string, raw: unknown, wallet: string, allowedTargets: string[] = []): StoredIntent[] {
    const plan = object(raw) as unknown as O1Plan;
    if (!Array.isArray(plan.steps) || !plan.steps.length) throw new Error('o1 returned no transaction steps');
    if (plan.chain_id !== undefined && plan.chain_id !== 8453) throw new Error('o1 plan is for another chain');
    for (const field of [plan.wallet, plan.creator, plan.caller]) if (field && !sameAddress(address(field), wallet)) throw new Error('o1 plan wallet mismatch');
    if (plan.issues?.some(i => i.severity === 'blocking')) throw new Error('o1 plan has blocking issues');
    const expires = expiry(plan.expires_at);
    const intents: StoredIntent[] = [];
    for (const step of plan.steps) {
      const tx = step.transaction || step.tx;
      if (!tx) continue;
      if(allowedTargets.length && !allowedTargets.some(target=>sameAddress(target,address(tx.to))))throw new Error('o1 transaction target is absent from verified live configuration');
      if (!step.simulation || !['success','passed'].includes(String(step.simulation.status))) throw new Error('o1 step is not successfully simulated');
      intents.push(this.add(kind + ':' + (step.id || intents.length), tx, plan.review || {}, expires, wallet));
    }
    if (!intents.length) throw new Error('o1 response has no executable steps');
    return intents;
  }
  get(id: string): StoredIntent {
    const intent = this.intents.get(id);
    if (!intent) throw new Error('Unknown intent');
    if (intent.expires <= Date.now() && (intent.state === 'prepared' || intent.state === 'requested')) throw new Error('Intent expired');
    return intent;
  }
  request(id: string): StoredIntent {
    const intent = this.get(id);
    if (intent.state !== 'prepared') throw new Error('Intent already requested or submitted');
    intent.state = 'requested';
    return intent;
  }
  submitted(id: string, hash: string) {
    const intent = this.get(id);
    if (intent.state !== 'requested') throw new Error('Intent was not requested');
    intent.hash = hash;
    intent.state = 'submitted';
  }
  fail(id: string) { const intent = this.get(id); intent.state = 'failed'; }
  list() { return [...this.intents.values()]; }
}

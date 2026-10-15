import test from 'node:test';
import assert from 'node:assert/strict';
import { keccak256, personalMessageHash } from '../src/security/keccak.ts';
import { IntentStore } from '../src/security/permissions.ts';
import { parseUnits } from '../src/security/validation.ts';

const A='0x1111111111111111111111111111111111111111';
const B='0x2222222222222222222222222222222222222222';
test('Ethereum Keccak vector and personal message hash are stable',()=>{
  assert.equal(Buffer.from(keccak256(new Uint8Array())).toString('hex'),'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  assert.equal(personalMessageHash('hello'),'0x50b2c43fd39106bafbba0da34fc430e1f91e3c96ea2acee2bc34119f92b37750');
});
test('exact units and invalid recipient amounts',()=>{
  assert.equal(parseUnits('1.23',6),'1230000');
  assert.throws(()=>parseUnits('1.1234567',6));
  assert.throws(()=>parseUnits('-1',18));
});
test('intents bind sender, reject wrong chain and expire',()=>{
  const store=new IntentStore();
  assert.throws(()=>store.add('x',{to:B,data:'0x',value:'1',from:B}, {},Date.now()+60000,A));
  assert.throws(()=>store.add('x',{to:B,data:'0x',value:'1',chain_id:1}, {},Date.now()+60000,A));
  assert.throws(()=>store.add('x',{to:B,data:'0x',value:'1'}, {},Date.now()+1000,A));
});
test('duplicate wallet execution is rejected',()=>{
  const store=new IntentStore();
  const intent=store.add('transfer',{to:B,data:'0x',value:'10'}, {},Date.now()+60000,A);
  store.request(intent.id);
  assert.throws(()=>store.request(intent.id));
  store.submitted(intent.id,'0x'+'a'.repeat(64));
  assert.throws(()=>store.submitted(intent.id,'0x'+'a'.repeat(64)));
});
test('o1 plan needs successful simulation and matching wallet',()=>{
  const store=new IntentStore(),base={expires_at:new Date(Date.now()+60000).toISOString(),steps:[{id:'a',transaction:{to:B,data:'0x',value:'0',from:A},simulation:{status:'success'}}]};
  assert.equal(store.fromO1('swap',base,A).length,1);
  assert.throws(()=>store.fromO1('swap',{...base,wallet:B},A));
  assert.throws(()=>store.fromO1('swap',{...base,steps:[{...base.steps[0],simulation:{status:'failed'}}]},A));
});

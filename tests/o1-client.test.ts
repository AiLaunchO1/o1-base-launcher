import test from 'node:test';
import assert from 'node:assert/strict';
import { O1Client, O1Error } from '../src/o1/client.ts';
import { ToolService } from '../src/mcp/tools.ts';
import { IntentStore } from '../src/security/permissions.ts';

const A='0x1111111111111111111111111111111111111111';
const B='0x'+'2'.repeat(40);
test('o1 API preserves structured rate-limit error without exposing key',async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async (_input,init)=>{
    assert.equal((init as any).headers['x-api-key'],'secret-test-key');
    return new Response(JSON.stringify({code:'rate_limited',detail:'Try later'}),{status:429,headers:{'content-type':'application/problem+json','retry-after':'30'}});
  };
  try {
    await assert.rejects(()=>new O1Client('secret-test-key').get('/config'),(e:any)=>e instanceof O1Error&&e.status===429&&e.code==='rate_limited'&&e.retryAfter==='30'&&!e.message.includes('secret-test-key'));
  } finally {globalThis.fetch=previous}
});
test('expired quote cannot enter the swap pipeline',async()=>{
  const fakeApi:any={get:async(path:string)=>path.startsWith('/tokens/')?{data:{token:{address:B}}}:{data:{quotes:[]}},post:async()=>({data:{quote_id:'q',expires_at:new Date(Date.now()-1000).toISOString()}})};
  const fakeBridge:any={connected:()=>A};
  const tools=new ToolService(fakeApi,new IntentStore(),fakeBridge);
  await assert.rejects(()=>tools.call('get_swap_quote',{token_address:B,side:'buy',amount_in_raw:'1',slippage_bps:50}),/expired/);
});
test('wallet change blocks request for another account intent',async()=>{
  const store=new IntentStore();
  const intent=store.add('transfer',{to:B,data:'0x',value:'1'}, {},Date.now()+60000,A);
  const fakeBridge:any={connected:()=>B};
  const tools=new ToolService({} as any,store,fakeBridge);
  await assert.rejects(()=>tools.call('request_wallet_approval',{intent_id:intent.id,confirmation:'CONFIRM'}),/wallet changed/);
  assert.equal(store.get(intent.id).state,'prepared');
});

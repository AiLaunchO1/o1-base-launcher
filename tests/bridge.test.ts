import test from 'node:test';
import assert from 'node:assert/strict';
import { WalletBridge } from '../src/wallet/bridge.ts';
import { IntentStore } from '../src/security/permissions.ts';

test('bridge creates loopback URL and rejects unauthenticated callers',async()=>{
  const bridge=new WalletBridge(new IntentStore());
  const url=await bridge.start();
  try {
    const base=url.split('#')[0],port=new URL(base).port,token=url.split('#')[1];
    assert.match(base,/^http:\/\/127\.0\.0\.1:\d+\/$/);
    assert.equal((bridge as any).auth({headers:{host:'127.0.0.1:'+port}}),false);
    assert.equal((bridge as any).auth({headers:{host:'evil.test:'+port,'x-bridge-token':token}}),false);
    assert.equal((bridge as any).auth({headers:{host:'127.0.0.1:'+port,'x-bridge-token':token}}),true);
  } finally {bridge.close()}
});

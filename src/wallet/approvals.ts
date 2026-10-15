import { IntentStore } from '../security/permissions.ts';
import { WalletBridge } from './bridge.ts';
import { sameAddress } from '../security/validation.ts';
export function requestApproval(store:IntentStore,bridge:WalletBridge,id:string) {
  const intent=store.get(id),wallet=bridge.connected();
  if(!wallet||!sameAddress(wallet,intent.tx.from!))throw new Error('Connected wallet changed');
  return store.request(id);
}

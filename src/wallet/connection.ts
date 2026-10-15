import { WalletBridge } from './bridge.ts';
export function connectedWallet(bridge:WalletBridge):string {
  const account=bridge.connected(); if(!account)throw new Error('Connect a Base wallet first'); return account;
}

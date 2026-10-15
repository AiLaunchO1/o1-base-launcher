export interface Eip1193Provider { request(args:{method:string;params?:unknown[]}):Promise<unknown>; }
export interface WalletSession { account:string; chainId:8453; expiresAt:number; }

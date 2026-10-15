export const CHAIN_ID = 8453;
export const ZERO = '0x0000000000000000000000000000000000000000';
export const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const config = {
  apiBase: process.env.O1_API_BASE || 'https://api.launch.o1.exchange/v1',
  apiKey: process.env.O1_API_KEY || '',
  rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  bridgePort: Number(process.env.BRIDGE_PORT || 0),
};

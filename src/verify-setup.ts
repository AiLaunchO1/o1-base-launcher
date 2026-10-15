import { config } from './config.ts';
import { rpc } from './wallet/rpc.ts';
const result:any={node:process.version,api_key_configured:Boolean(config.apiKey),rpc_url:config.rpcUrl,chain_id:null};
try { result.chain_id=Number(BigInt(await rpc('eth_chainId'))); result.rpc_ok=result.chain_id===8453; }
catch(e:any) { result.rpc_ok=false; result.rpc_error=String(e.message||e); }
process.stdout.write(JSON.stringify(result,null,2)+'\n');
if(!result.rpc_ok)process.exitCode=1;

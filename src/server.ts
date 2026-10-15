import { createInterface } from 'node:readline';
import { O1Client } from './o1/client.ts';
import { IntentStore } from './security/permissions.ts';
import { WalletBridge } from './wallet/bridge.ts';
import { ToolService, toolDefinitions } from './mcp/tools.ts';

export async function runServer() {
  const store=new IntentStore(),bridge=new WalletBridge(store);
  await bridge.start();
  const tools=new ToolService(new O1Client(),store,bridge);
  const input=createInterface({input:process.stdin,crlfDelay:Infinity});
  const reply=(id:unknown,result:unknown,error?:unknown)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,...(error?{error}:{result})})+'\n');
  input.on('line',async line=>{
    let message:any;
    try { message=JSON.parse(line); } catch { reply(null,null,{code:-32700,message:'Parse error'}); return; }
    if(message.id===undefined)return;
    try {
      switch(message.method) {
        case 'initialize': reply(message.id,{protocolVersion:'2025-03-26',capabilities:{tools:{listChanged:false}},serverInfo:{name:'o1-base-launcher',version:'0.1.0'}}); break;
        case 'ping': reply(message.id,{}); break;
        case 'tools/list': reply(message.id,{tools:toolDefinitions}); break;
        case 'tools/call': {
          const name=message.params?.name,args=message.params?.arguments||{};
          const data=await tools.call(name,args);
          reply(message.id,{content:[{type:'text',text:JSON.stringify(data)}]});break;
        }
        default:reply(message.id,null,{code:-32601,message:'Method not found'});
      }
    } catch(e:any) { const detail={error:String(e.message||e),code:e.code||undefined,status:e.status||undefined,retry_after:e.retryAfter||undefined};reply(message.id,{isError:true,content:[{type:'text',text:JSON.stringify(detail)}]}); }
  });
  input.on('close',()=>bridge.close());
}

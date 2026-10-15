import { rpc } from './rpc.ts';
import { address } from '../security/validation.ts';
export async function estimatedGasWei(from:string,to:string,value:string,data='0x'):Promise<bigint> {
  const gas=BigInt(await rpc('eth_estimateGas',[{from:address(from),to:address(to),value:'0x'+BigInt(value).toString(16),data}]));
  const price=BigInt(await rpc('eth_gasPrice'));
  return gas*price;
}

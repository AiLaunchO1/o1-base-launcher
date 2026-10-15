import { O1Client } from '../o1/client.ts';
import { prepareStandardLaunch } from '../o1/launches.ts';
import { quoteSwap, prepareSwap as prepareO1Swap } from '../o1/swaps.ts';
import { searchTokens, tokenDetails, creatorLaunches, liveConfig } from '../o1/tokens.ts';
import { feePositions, prepareFeeClaim } from '../o1/claims.ts';
import { quoteEnvelope } from '../o1/schemas.ts';
import { IntentStore } from '../security/permissions.ts';
import { WalletBridge } from '../wallet/bridge.ts';
import { ZERO } from '../config.ts';
import { address, bps, expiry, parseUnits, positiveRaw, sameAddress, txHash } from '../security/validation.ts';
import { balance, erc20Balance, erc20Decimals, rpc } from '../wallet/rpc.ts';
import { connectedWallet } from '../wallet/connection.ts';
import { requestApproval } from '../wallet/approvals.ts';
import { estimatedGasWei } from '../wallet/transactions.ts';
import { input, str } from './schemas.ts';
import type { O1Quote } from '../o1/types.ts';

export const toolDefinitions = [
  {name:'connect_base_wallet',description:'Open the local wallet connection and approval page; connection is pending until the user connects a wallet.',inputSchema:input({})},
  {name:'get_connected_wallet',description:'Return the current short-lived Base wallet session, if any.',inputSchema:input({})},
  {name:'get_wallet_balance',description:'Read ETH or ERC-20 balance for the connected wallet.',inputSchema:input({token_address:str})},
  {name:'get_o1_config',description:'Read live o1 Base launch configuration.',inputSchema:input({launch_product:{type:'string',enum:['non-tax','tax','wsto']}})},
  {name:'search_o1_tokens',description:'Search o1 Base tokens by name, symbol, or address.',inputSchema:input({query:str},['query'])},
  {name:'get_o1_token_details',description:'Read a verified o1 token by Base address.',inputSchema:input({token_address:str},['token_address'])},
  {name:'get_my_launches',description:'List launches created by the connected wallet.',inputSchema:input({})},
  {name:'get_wallet_activity',description:'Read indexed o1 activity for the connected wallet.',inputSchema:input({})},
  {name:'prepare_token_launch',description:'Prepare a Standard Base o1 token launch. Requires a base64 image and a quote address from live config.',inputSchema:input({name:str,symbol:str,description:str,image_base64:str,image_type:{type:'string',enum:['image/png','image/jpeg','image/webp','image/gif']},quote_address:str,website:str,x:str,telegram:str},['name','symbol','description','image_base64','image_type','quote_address'])},
  {name:'get_swap_quote',description:'Get an exact-input o1 Base buy or sell quote.',inputSchema:input({token_address:str,side:{type:'string',enum:['buy','sell']},amount_in_raw:str,slippage_bps:{type:'integer'}},['token_address','side','amount_in_raw','slippage_bps'])},
  {name:'prepare_buy_token',description:'Prepare a buy from a live quote ID.',inputSchema:input({quote_id:str},['quote_id'])},
  {name:'prepare_sell_token',description:'Prepare a sell from a live quote ID.',inputSchema:input({quote_id:str},['quote_id'])},
  {name:'prepare_eth_transfer',description:'Prepare a direct ETH transfer in wei.',inputSchema:input({recipient:str,amount_wei:str},['recipient','amount_wei'])},
  {name:'prepare_erc20_transfer',description:'Prepare a direct ERC-20 transfer in human units; decimals are read on-chain.',inputSchema:input({token_address:str,recipient:str,amount:str},['token_address','recipient','amount'])},
  {name:'prepare_creator_fee_claim',description:'Prepare a claim to the recorded recipient using a live o1 fee position.',inputSchema:input({fee_escrow:str,currency:str,recipient:str},['fee_escrow','currency','recipient'])},
  {name:'request_wallet_approval',description:'Place a previously prepared intent in the local page for explicit user and wallet approval.',inputSchema:input({intent_id:str,confirmation:{type:'string',enum:['CONFIRM']}},['intent_id','confirmation'])},
  {name:'get_transaction_status',description:'Check on-chain receipt and optional o1 indexing for an intent or transaction hash.',inputSchema:input({intent_id:str,transaction_hash:str})},
];

export class ToolService {
  private quotes = new Map<string,{side:string;wallet:string;expires:number;token:string;raw:any}>();
  api: O1Client; store: IntentStore; bridge: WalletBridge;
  constructor(api: O1Client, store: IntentStore, bridge: WalletBridge) { this.api=api;this.store=store;this.bridge=bridge; }
  private wallet(): string { return connectedWallet(this.bridge); }
  private async config(product='non-tax') { return liveConfig(this.api,product); }
  private addresses(value:unknown):string[] {
    const found=new Set<string>();
    const visit=(v:any)=>{if(typeof v==='string'&&/^0x[a-fA-F0-9]{40}$/.test(v))found.add(v);else if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')Object.values(v).forEach(visit)};
    visit(value);return [...found];
  }
  async call(name:string,args:Record<string,any>={}):Promise<any> {
    switch(name) {
      case 'connect_base_wallet': return {state:this.bridge.connected()?'connected':'pending',url:this.bridge.url(),instruction:'Open this local URL in a browser with an EIP-1193 wallet, then connect on Base Mainnet.'};
      case 'get_connected_wallet': return {state:this.bridge.connected()?'connected':'disconnected',address:this.bridge.connected(),chain_id:8453};
      case 'get_wallet_balance': {
        const wallet=this.wallet(); if(!args.token_address) return {wallet,asset:'ETH',decimals:18,balance_raw:await balance(wallet)};
        const token=address(args.token_address); return {wallet,token_address:token,decimals:await erc20Decimals(token),balance_raw:await erc20Balance(token,wallet)};
      }
      case 'get_o1_config': {
        const product=args.launch_product||'non-tax';
        if(!['non-tax','tax','wsto'].includes(product))throw new Error('Unsupported launch product');
        return this.config(product);
      }
      case 'search_o1_tokens': {
        const q=String(args.query||'').trim(); if(!q||q.length>100)throw new Error('Invalid search query');
        return searchTokens(this.api,q);
      }
      case 'get_o1_token_details': return tokenDetails(this.api,args.token_address);
      case 'get_my_launches': return creatorLaunches(this.api,this.wallet());
      case 'get_wallet_activity': return this.api.get('/wallets/'+this.wallet()+'/activity?chain_id=8453');
      case 'prepare_token_launch': return this.launch(args);
      case 'get_swap_quote': return this.quote(args);
      case 'prepare_buy_token': return this.prepareSwap(args.quote_id,'buy');
      case 'prepare_sell_token': return this.prepareSwap(args.quote_id,'sell');
      case 'prepare_eth_transfer': return this.ethTransfer(args);
      case 'prepare_erc20_transfer': return this.erc20Transfer(args);
      case 'prepare_creator_fee_claim': return this.claim(args);
      case 'request_wallet_approval': {
        if(args.confirmation!=='CONFIRM')throw new Error('Explicit confirmation required');
        const intent=requestApproval(this.store,this.bridge,String(args.intent_id));
        return {state:'awaiting_wallet_approval',intent_id:intent.id,url:this.bridge.url(),review:intent.review,transaction:intent.tx,expires_at:new Date(intent.expires).toISOString()};
      }
      case 'get_transaction_status': {
        if(args.intent_id)return this.bridge.status(String(args.intent_id));
        const hash=txHash(args.transaction_hash);
        const receipt=await rpc('eth_getTransactionReceipt',[hash]);
        const indexed=await this.api.get('/transactions/8453/'+hash).catch(()=>null);
        return {hash,receipt_status:receipt?receipt.status==='0x1'?'confirmed':'reverted':'pending',indexed,explorer:'https://basescan.org/tx/'+hash};
      }
      default:throw new Error('Unknown tool');
    }
  }
  private async launch(a:Record<string,any>) {
    const wallet=this.wallet(); const quote=address(a.quote_address);
    const cfg:any=await this.config(); const quotes=cfg.data?.quotes;
    if(!Array.isArray(quotes)||!quotes.some((q:any)=>q.address&&sameAddress(address(q.address),quote)&&q.route==='standard'&&q.creation_available!==false&&q.selectable!==false))throw new Error('Quote address is not currently creation-available for Standard launches in live o1 config');
    const name=String(a.name||'').trim(),symbol=String(a.symbol||'').trim(),description=String(a.description||'').trim();
    if(!name||name.length>100||!symbol||symbol.length>20||!description||Buffer.byteLength(description)>2000)throw new Error('Invalid token identity');
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(a.image_type)||!/^[-A-Za-z0-9+/]*={0,2}$/.test(a.image_base64||''))throw new Error('Invalid image');
    const image=Buffer.from(a.image_base64,'base64'); if(!image.length||image.length>2_000_000)throw new Error('Image must be 1–2 MB');
    const token:any={name,symbol,description,image_base64:a.image_base64,image_type:a.image_type,editable_metadata:false,extra_metadata:[]};
    for(const field of ['website','x','telegram'])if(a[field]){const url=new URL(a[field]);if(!['https:','http:'].includes(url.protocol))throw new Error('Invalid URL');token[field]=url.toString();}
    const body={chain_id:8453,creator:wallet,market:'standard',quote_address:quote,token};
    const raw:any=await prepareStandardLaunch(this.api,body);
    return {prepared:true,intents:this.store.fromO1('launch',raw.data||raw,wallet,this.addresses(cfg.data||cfg)),review:(raw.data||raw).review,issues:(raw.data||raw).issues};
  }
  private async quote(a:Record<string,any>) {
    const wallet=this.wallet(),token=address(a.token_address),side=a.side;
    if(side!=='buy'&&side!=='sell')throw new Error('Invalid swap side');
    const details=await tokenDetails(this.api,token);
    const body={chain_id:8453,wallet,token_address:token,side,amount_in_raw:positiveRaw(a.amount_in_raw),slippage_bps:bps(a.slippage_bps)};
    const raw:any=await quoteSwap(this.api,body);
    const quote=quoteEnvelope(raw);
    const expires=expiry(quote.expires_at); if(expires<=Date.now())throw new Error('o1 quote already expired');
    this.quotes.set(quote.quote_id,{side,wallet,expires,token,raw:quote});
    let approvalIntents:any[]=[];
    const cfg=await this.config();
    const targets=[...this.addresses(cfg.data||cfg),...this.addresses((details as any).data||details),token];
    if(Array.isArray(quote.steps)&&quote.steps.some(s=>s.transaction||s.tx)) approvalIntents=this.store.fromO1('swap-prerequisite',quote,wallet,targets);
    return {quote,approval_intents:approvalIntents};
  }
  private async prepareSwap(id:string,side:string) {
    const q=this.quotes.get(String(id)); if(!q||q.side!==side||!sameAddress(q.wallet,this.wallet())||q.expires<=Date.now())throw new Error('Quote missing, expired, or for another wallet or side');
    if(q.raw.issues?.some((i:any)=>i.severity==='blocking'||i.severity==='action_required'))throw new Error('Resolve quote prerequisites and obtain a fresh quote');
    const raw:any=await prepareO1Swap(this.api,id,q.wallet);
    const cfg=await this.config();const details=await tokenDetails(this.api,q.token);
    const targets=[...this.addresses(cfg.data||cfg),...this.addresses(details.data||details),q.token];
    this.quotes.delete(id);
    return {prepared:true,intents:this.store.fromO1(side+'-swap',raw.data||raw,q.wallet,targets),review:(raw.data||raw).review};
  }
  private async ethTransfer(a:Record<string,any>) {
    const wallet=this.wallet(),recipient=address(a.recipient),amount=positiveRaw(a.amount_wei);
    if(sameAddress(recipient,ZERO))throw new Error('Zero recipient');
    const available=BigInt(await balance(wallet));
    const gas=await estimatedGasWei(wallet,recipient,amount);
    if(available<BigInt(amount)+gas)throw new Error('Insufficient ETH for transfer and estimated gas');
    const intent=this.store.add('eth-transfer',{to:recipient,data:'0x',value:amount},{recipient,amount_wei:amount,estimated_gas_wei:gas.toString()},Date.now()+5*60_000,wallet);
    return {intent};
  }
  private async erc20Transfer(a:Record<string,any>) {
    const wallet=this.wallet(),token=address(a.token_address),recipient=address(a.recipient);
    if(sameAddress(recipient,ZERO)||sameAddress(token,ZERO))throw new Error('Zero address');
    const decimals=await erc20Decimals(token),amount=parseUnits(a.amount,decimals);
    if(BigInt(await erc20Balance(token,wallet))<BigInt(amount))throw new Error('Insufficient token balance');
    const data='0xa9059cbb'+recipient.slice(2).toLowerCase().padStart(64,'0')+BigInt(amount).toString(16).padStart(64,'0');
    const gas=await estimatedGasWei(wallet,token,'0',data);
    if(BigInt(await balance(wallet))<gas)throw new Error('Insufficient ETH for estimated gas');
    const intent=this.store.add('erc20-transfer',{to:token,data,value:'0'},{token,recipient,amount:a.amount,amount_raw:amount,decimals,estimated_gas_wei:gas.toString()},Date.now()+5*60_000,wallet);
    return {intent};
  }
  private async claim(a:Record<string,any>) {
    const wallet=this.wallet(),recipient=address(a.recipient),escrow=address(a.fee_escrow),currency=address(a.currency);
    if(!sameAddress(recipient,wallet))throw new Error('Only direct claims to the connected wallet are supported');
    const positions:any=await feePositions(this.api,wallet);
    const rows=positions.data?.items||positions.data?.positions||positions.data?.claims;
    if(!Array.isArray(rows)||!rows.some((p:any)=>sameAddress(address(p.fee_escrow_address),escrow)&&sameAddress(address(p.currency.address),currency)))throw new Error('Claim position not present in live o1 wallet positions');
    const body={chain_id:8453,caller:wallet,claims:[{recipient:wallet,fee_escrow:escrow,currency,mode:'to_recipient'}]};
    const raw:any=await prepareFeeClaim(this.api,body);
    return {prepared:true,intents:this.store.fromO1('fee-claim',raw.data||raw,wallet,[escrow]),review:(raw.data||raw).review};
  }
}

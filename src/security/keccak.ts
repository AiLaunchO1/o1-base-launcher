const MASK=(1n<<64n)-1n;
const RC=[1n,0x8082n,0x800000000000808an,0x8000000080008000n,0x808bn,0x80000001n,0x8000000080008081n,0x8000000000008009n,0x8an,0x88n,0x80008009n,0x8000000an,0x8000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,0x8000000000008002n,0x8000000000000080n,0x800an,0x800000008000000an,0x8000000080008081n,0x8000000000008080n,0x80000001n,0x8000000080008008n];
const ROT=[0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
const rol=(v:bigint,n:number)=>n===0?v:((v<<BigInt(n))|(v>>BigInt(64-n)))&MASK;
function permute(s:bigint[]) {
  for(const rc of RC) {
    const c=Array.from({length:5},(_,x)=>s[x]^s[x+5]^s[x+10]^s[x+15]^s[x+20]);
    const d=Array.from({length:5},(_,x)=>c[(x+4)%5]^rol(c[(x+1)%5],1));
    for(let x=0;x<5;x++)for(let y=0;y<5;y++)s[x+5*y]^=d[x];
    const b=Array<bigint>(25).fill(0n);
    for(let x=0;x<5;x++)for(let y=0;y<5;y++)b[y+5*((2*x+3*y)%5)]=rol(s[x+5*y],ROT[x+5*y]);
    for(let x=0;x<5;x++)for(let y=0;y<5;y++)s[x+5*y]=b[x+5*y]^((~b[(x+1)%5+5*y])&b[(x+2)%5+5*y]);
    s[0]^=rc;
  }
}
export function keccak256(input:Uint8Array):Uint8Array {
  const padded=Array.from(input); padded.push(1);
  while(padded.length%136!==135)padded.push(0);
  padded.push(0x80);
  const s=Array<bigint>(25).fill(0n);
  for(let offset=0;offset<padded.length;offset+=136) {
    for(let i=0;i<136;i++)s[Math.floor(i/8)]^=BigInt(padded[offset+i])<<BigInt(8*(i%8));
    permute(s);
  }
  const out=new Uint8Array(32);
  for(let i=0;i<32;i++)out[i]=Number((s[Math.floor(i/8)]>>BigInt(8*(i%8)))&255n);
  return out;
}
export function personalMessageHash(message:string):string {
  const data=Buffer.from(message,'utf8');
  const prefix=Buffer.from(`\x19Ethereum Signed Message:\n${data.length}`,'utf8');
  return '0x'+Buffer.from(keccak256(Buffer.concat([prefix,data]))).toString('hex');
}

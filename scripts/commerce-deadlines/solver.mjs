import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
export function openAllocator(){
 const child=spawn(resolve('.local/marketing-venv/bin/python'),['-u',resolve('scripts/commerce-deadlines/allocator.py')],{stdio:['pipe','pipe','pipe']}),pending=new Map();let sequence=0,stderr='';child.stderr.on('data',b=>{stderr=(stderr+b).slice(-4000);});
 createInterface({input:child.stdout}).on('line',line=>{let response;try{response=JSON.parse(line);}catch{for(const p of pending.values())p.reject(Error('INVALID_ALLOCATOR_RESPONSE'));pending.clear();return;}const p=pending.get(response.id);if(!p)return;pending.delete(response.id);clearTimeout(p.timer);response.error?p.reject(Error(response.error)):p.resolve(response);});
 child.on('exit',code=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('ALLOCATOR_EXIT_'+code+':'+stderr));}pending.clear();});
 return {async solve(view,quotes){
  if(!quotes.length)return {selected:[],status:0,gap:0,runtimeSeconds:0};const id=++sequence,packet={id,stock:Object.fromEntries(view.products.map(p=>[p.id,p.available])),quotes:quotes.map(q=>({requestId:q.requestId,quantities:q.quantities,value:q.expectedPlatformCents+.001*q.preferred}))};
  const response=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('ALLOCATOR_TIMEOUT'));child.kill();},10000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify(packet)+'\n');});
  if(!Array.isArray(response.selected)||new Set(response.selected).size!==response.selected.length||response.selected.some(i=>!Number.isInteger(i)||i<0||i>=quotes.length))throw Error('INVALID_ALLOCATOR_SELECTION');
  const stock={...packet.stock},requests=new Set();for(const i of response.selected){const q=quotes[i];if(requests.has(q.requestId))throw Error('ALLOCATOR_DUPLICATE_REQUEST');requests.add(q.requestId);for(const[id,n]of Object.entries(q.quantities)){stock[id]-=n;if(stock[id]<0)throw Error('ALLOCATOR_OVERSOLD_STOCK');}}
  return response;
 },close(){child.stdin.end();}};
}

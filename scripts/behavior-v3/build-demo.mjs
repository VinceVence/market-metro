import {resolve} from 'node:path';
import {createMarketStore} from '../market-store.mjs';
import {lock,read,save} from './benchmark.mjs';
import {materialize} from './materialize.mjs';
import {ROOT,saveJSON} from '../research-lab/data.mjs';
const {p,catalog}=await lock(),approval=await read('agent.json'),store=createMarketStore(resolve(ROOT,'.local/market-metro.sqlite'));
try{const d=await materialize({store,protocol:p,catalog,approval});await save('demo-summary.json',{runId:d.runId,settings:d.settings,summaries:d.summaries,featured:d.featured,warehouse:d.warehouse,checkpoints:d.checkpoints,newModelCalls:0,newPayments:0});await saveJSON(resolve(ROOT,'demo/data/behavior-v3-demo-index.json'),{runId:d.runId});console.log(JSON.stringify({runId:d.runId,orders:d.warehouse.find(x=>x.name==='orders').count,transactions:d.warehouse.find(x=>x.name==='transactions').count,frames:d.frames.length,summaries:d.summaries.map(s=>({label:s.label,ongoing:s.ongoingDeltaUSD,durable:s.durableDeltaUSD,merchant:s.merchantDeltaUSD}))}));}finally{store.close();}

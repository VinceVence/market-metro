import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createMarketStore} from '../market-store.mjs';
import {ROOT} from '../research-lab/data.mjs';
import {enrichDemo} from './presentation.mjs';
const index=JSON.parse(await readFile(resolve(ROOT,'demo/data/behavior-v3-demo-index.json'))),path=resolve(ROOT,'.local/behavior-v3',index.runId+'.json'),d=JSON.parse(await readFile(path)),store=createMarketStore(resolve(ROOT,'.local/market-metro.sqlite'));
try{enrichDemo(store,d);await writeFile(path,JSON.stringify(d));console.log(JSON.stringify({runId:d.runId,frames:d.frames.length,lifecycle:d.lifecycleAudit}));}finally{store.close();}

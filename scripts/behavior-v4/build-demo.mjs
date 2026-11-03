import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {createMarketStore} from '../market-store.mjs';
import {environment,read,save,ROOT} from './config.mjs';
import {materialize} from './materialize.mjs';
const {protocol,catalog}=await environment(),approval=await read('approval.json'),store=createMarketStore(resolve(ROOT,'.local/market-metro.sqlite'));
try{const d=await materialize({store,protocol,catalog,approval});const summary={runId:d.runId,settings:d.settings,summaries:d.summaries,checkpoints:d.checkpoints,warehouse:d.warehouse,scope:'ONE_AUTHORED_SEED_NOT_A_GENERALIZATION_BENCHMARK'};
 const ids=store.db.prepare('SELECT COUNT(*) n,SUM(channel3_product_id IS NOT NULL) externalIds,SUM(source<>?) nonAuthored FROM products WHERE run_id=?').get('AUTHORED_SIMULATION',d.runId);if(ids.externalIds||ids.nonAuthored)throw Error('CATALOG_PROVENANCE_FAILED');
 await save('demo-summary.json',summary);await writeFile(resolve(ROOT,'demo/data/owned-demo-index.json'),JSON.stringify({runId:d.runId}));console.log(JSON.stringify({runId:d.runId,policy:approval.review.policyId,products:ids,orders:store.table('orders',d.runId).count,models:store.table('recommendation_models',d.runId).count,frames:d.frames.length}));
}finally{store.close();}

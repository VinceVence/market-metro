// Runs only inside the frozen snapshot, with installed local numerical tools.
import {readFile} from 'node:fs/promises';
import {revisionResources,runRevision} from './autonomy/net-revision-study.mjs';
import {openAllocator} from '../commerce-deadlines/solver.mjs';
const root='docs/commerce-growth/roc-net-goal-1/net-revision-confirmation-1',read=async p=>JSON.parse(await readFile(p,'utf8')),protocol=await read(root+'/protocol.json'),rows=(await read(root+'/rows.json')).rows,id=process.argv[2],c=protocol.cases.find(c=>c.id===id);
if(!c)throw Error('UNKNOWN_BASELINE_CASE');
globalThis.fetch=async()=>{throw Error('BASELINE_REPLAY_NETWORK_DISABLED');};
const r=await revisionResources(),allocator=openAllocator();
try{const actual=await runRevision(c,r,allocator),expected=rows.find(r=>r.case===id&&r.arm==='revised'),fields=['initialHash','opportunityHash','consentHash','incomeCents','platformUSD','retailerUSD','wholesalerUSD','manufacturerUSD','terminalCashUSD','terminalInventoryUSD','retainedPurchases','retainedVolumeUSD','outreachCostUSD','unpaidLiabilities'];
 for(const field of fields)if(actual[field]!==expected[field])throw Error('BASELINE_REPLAY_MISMATCH: '+field);
 console.log(JSON.stringify({case:id,status:'EXACT_REPLAY',fieldsMatched:fields.length,platformUSD:actual.platformUSD,retailerUSD:actual.retailerUSD,retainedPurchases:actual.retainedPurchases,providerCalls:0,nativePayments:0}));
}finally{allocator.close();}

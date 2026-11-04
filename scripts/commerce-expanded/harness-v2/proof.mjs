// Reconcile a recorded team's money against its identical-seed fixed control.
// No model calls or native payments. The shopper example is explicitly post-hoc.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {runCoordinatedCase} from '../runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {paymentContribution} from '../../commerce-growth/autonomy/finalize-economic-workflow.mjs';
import {verifyEconomy} from './trials.mjs';

const root=resolve(process.argv[2]),caseId=process.argv[3]||'case-1',read=async p=>JSON.parse(await readFile(p,'utf8'));
await verifyEconomy();
const state=await read(root+'/results.json'),reference=state.rows.find(r=>r.caseId===caseId&&r.arm==='fixed'),team=state.rows.find(r=>r.caseId===caseId&&r.arm==='team');
if(!reference||!team||team.failed)throw Error('COMPLETED_TEAM_REQUIRED');
const fixed=(await read('docs/commerce-growth/team-1/development/results.json')).selectedFixed,prior=await read('docs/commerce-growth/team-1/training/model.json'),allocator=openAllocator();
try{
 const replay=await runCoordinatedCase({seed:reference.seed,regime:reference.regime},fixed,{allocator,prior,trace:true});
 for(const k of ['initialHash','opportunityHash','consentHash','incomeCents','platformUSD','retailerUSD','retainedPurchases'])if(replay[k]!==reference[k])throw Error('FIXED_REPLAY_MISMATCH:'+k);
 const trace=JSON.parse(gunzipSync(await readFile(root+'/'+basename(root)+'-'+caseId+'-team/trace.json.gz'))),bridge={fixed:paymentContribution(replay.trace.ledger),team:paymentContribution(trace.ledger)};
 for(const [a,r]of [['fixed',replay],['team',team]])if(Math.abs(Object.values(bridge[a]).reduce((s,n)=>s+n,0)-(r.platformBeforeModelUSD??r.platformUSD))>.011)throw Error('LEDGER_MISMATCH:'+a);
 const retained=o=>o.day>=30&&!['SETTLED','PENDING_FUNDS'].includes(o.refundStatus),fixedIds=new Set(replay.trace.orders.filter(retained).map(o=>o.requestId)),added=trace.orders.filter(o=>retained(o)&&!fixedIds.has(o.requestId)),chosen=added.find(o=>trace.contacts.some(c=>c.requestId===o.requestId)&&o.merchants.some(m=>m.grossCents>0&&m.grossCents<=10000))||added[0],contact=chosen&&trace.contacts.find(c=>c.requestId===chosen.requestId);
 const proof={status:'VERIFIED',scope:'Identical-seed fixed replay; first eligible additional order selected post-hoc for explanation. All market outcomes, including displaced sales, remain in the aggregate comparison.',caseId,seed:reference.seed,regime:reference.regime,bridge,delta:Object.fromEntries(Object.keys(bridge.fixed).map(k=>[k,bridge.team[k]-bridge.fixed[k]])),modelCostUSD:team.modelCostUSD,netDeltaUSD:team.platformUSD-reference.platformUSD,merchantDeltaUSD:team.retailerUSD-reference.retailerUSD,purchaseDelta:team.retainedPurchases-reference.retainedPurchases,shopper:chosen?{contact,order:chosen,request:trace.requests.find(r=>r.id===chosen.requestId),delivery:trace.deliveries.find(d=>d.orderId===chosen.id),ranking:trace.decisions.find(d=>d.day===contact?.day)?.ranking.find(r=>r.customerId===chosen.customerId)}:null};
 await writeFile(root+'/first-market-proof.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({net:proof.netDeltaUSD,merchants:proof.merchantDeltaUSD,purchases:proof.purchaseDelta,shopper:chosen?.customerId,order:chosen?.id}));
}finally{allocator.close();}

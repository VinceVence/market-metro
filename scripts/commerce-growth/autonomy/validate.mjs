// One registered fresh-decision comparison. Reuses the frozen economy,
// settlement tools and original strong fixed policy. No native payment calls.
import {readFile,writeFile,mkdir,copyFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {openAutonomousCommerce,scoreLearnedContacts} from './controller.mjs';
import {openTeamVertex} from '../../agent-mesh/model-client.mjs';
import {runCoordinatedCase} from '../team/runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {CONTRACT,digest} from '../environment.mjs';

const root='docs/commerce-growth/autonomy-1',dir=root+'/validation-1',prefix='market-AUTONOMY-VALIDATION-1-',
 load=async p=>JSON.parse(await readFile(p,'utf8')),save=(p,x)=>writeFile(dir+'/'+p,JSON.stringify(x,null,2)+'\n'),
 sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
async function spend(){const all=(await load('.local/gcp/model-spend.json')).entries,rows=all.filter(e=>e.runId.startsWith(prefix));return {calls:rows.length,costUSD:rows.reduce((s,e)=>s+e.chargedMicros,0)/1e6,unsettled:all.filter(e=>e.status!=='settled').length,lifetimeUSD:all.reduce((s,e)=>s+e.chargedMicros,0)/1e6};}
async function verify(p){for(const [path,h]of Object.entries({...p.economyHashes,...p.programHashes}))if(await sha(path)!==h)throw Error('REGISTERED_SOURCE_CHANGED: '+path);}
if(process.argv.includes('--freeze')){
 await mkdir(dir);
 const core=await load('docs/commerce-growth/development-1/protocol.json'),fixed=(await load('docs/commerce-growth/team-1/development/results.json')).selectedFixed,
  cases=Object.keys(CONTRACT.regimes).map((regime,i)=>({id:'C'+i,regime,seed:987500+i})),programHashes={};
 for(const path of ['scripts/commerce-growth/autonomy/controller.mjs','scripts/commerce-growth/autonomy/features.mjs','scripts/commerce-growth/autonomy/inquiry-expert.mjs','scripts/commerce-growth/autonomy/train.py','scripts/commerce-growth/autonomy/validate.mjs','scripts/commerce-growth/team/control.mjs','scripts/commerce-growth/team/runner.mjs','scripts/commerce-growth/experiments/program.mjs','scripts/agent-mesh/model-client.mjs','benchmark/vertex.mjs',root+'/training/dataset.json',root+'/training/model-report.json',root+'/value-training-1/models.json',root+'/policy-library.json','docs/commerce-growth/team-1/training/model.json'])programHashes[path]=await sha(path);
 const protocol={createdAt:new Date().toISOString(),cases,fixed,arms:['strong_fixed','static_learned_routing','autonomous_team'],economyHashes:core.sourceHashes,programHashes,
  staticRecipe:{family:'forest',inquiryExpert:'ambiguous',valuation:'pooled',campaign:{audience:'recent_interest',contactKinds:'both',contactsPerDay:'10',minimumNetCents:'0',stopped:false}},
  agentOptions:{recipeSelection:true,background:false},spend:{additionalCapUSD:.25,maxCalls:cases.length*6,lifetimeCapUSD:8,opening:await spend(),nativePaymentCalls:0},
  objective:'Autonomous observed-data analysis, model training and campaign publication, with measured improvement over unchanged strong fixed rules. 2x is a stretch target. Report aggregate AND individual merchant changes; do not suppress a failed guard.',
  timing:'Offline policy-quality comparison: virtual time holds at both agent review boundaries. Provider and local training latency are measured. Live background execution is a separate check.',
  limits:['Seven new seeds, one per existing authored regime; not a population or production-profit claim.','Static ML routing isolates numerical-tool benefit; no claim that three roles beat a matched single planner.','Historical development evidence is available to the team; no future evaluation outcomes are exposed.','All registered results, including losses and failed calls, are retained. No model calls are retried.']};
 await verify(protocol);await save('protocol.json',protocol);await mkdir(dir+'/source');
 for(const path of Object.keys(programHashes).filter(p=>p.startsWith('scripts/')||p.startsWith('benchmark/')))await copyFile(path,dir+'/source/'+path.replaceAll('/','--'));
 console.log(JSON.stringify({registered:cases,maximumNewUSD:.25,arms:protocol.arms}));
}else if(process.argv.includes('--run')){
 const protocol=await load(dir+'/protocol.json');await verify(protocol);
 // Refuse a second launch, including after an uncertain or partial run.
 await writeFile(dir+'/started.json',JSON.stringify({at:new Date().toISOString()}),{flag:'wx'});
 const fixed=protocol.fixed,prior=await load('docs/commerce-growth/team-1/training/model.json'),developmentEvidence=await load(root+'/policy-library.json'),
  artifact={...await load(root+'/value-training-1/models.json'),valueModel:null},model={id:'STATIC-'+digest(artifact).slice(0,16),family:'forest',artifact,cutoff:30,inquiryExpert:'ambiguous',inquiryPrior:prior},rows=[],allocator=openAllocator();let team=null;
 if(protocol.cases.some(c=>artifact.trainingEpisodes.includes(c.seed)))throw Error('TEST_SEED_IN_TRAINING');
 const providerFactory=async(id,options)=>{const p=await openTeamVertex(id,options),json=p.client.json.bind(p.client);p.client.json=async(...args)=>{const s=await spend();if(s.unsettled||s.calls>=protocol.spend.maxCalls||Math.round(s.costUSD*1e6)+30000>250000)throw Error('VALIDATION_SHARED_SPEND_CAP');return json(...args);};return p;};
 try{
  for(const c of protocol.cases)for(const arm of protocol.arms){
   let controller=null;team=null;
   if(arm==='static_learned_routing')controller={plan:async view=>scoreLearnedContacts(view,{prior,model,campaign:protocol.staticRecipe.campaign,supply:fixed.config})};
   if(arm==='autonomous_team'){team=await openAutonomousCommerce({id:'VALIDATION-1-'+c.id,dir:dir+'/'+c.id+'-team',prior,incumbent:fixed.config,providerFactory,developmentEvidence,...protocol.agentOptions});controller=team;}
   const result=await runCoordinatedCase({regime:c.regime,seed:c.seed},{...fixed,id:arm},{allocator,prior,controller,trace:true});
   await team?.close();if(team)result.agent=team.summary();
   const {trace,...row}=result,parts={};for(const e of trace.ledger.filter(e=>e.day>=30)){if(e.to==='platform')parts[e.kind]=(parts[e.kind]||0)+e.cents;if(e.from==='platform')parts[e.kind]=(parts[e.kind]||0)-e.cents;}
   row.modelCostUSD=row.agent?.modelCostUSD||0;row.netAfterModelUSD=row.platformUSD-row.modelCostUSD;
   row.paymentComponentsCents=parts;row.retailPaymentNetUSD=((parts.PAYMENT_FEE||0)+(parts.PAYMENT_FEE_RETURN||0)+(parts.PAYMENT_PROCESSING||0))/100;
   row.supplierPaymentNetUSD=((parts.SUPPLIER_PAYMENT_FEE||0)+(parts.SUPPLIER_PROCESSING||0))/100;
   if(Math.abs(Object.values(parts).reduce((s,v)=>s+v,0)/100-row.platformUSD)>.011)throw Error('PAYMENT_LEDGER_NOT_RECONCILED');
   rows.push(row);await save(c.id+'-'+arm+'-trajectory.json',trace);await save('rows.json',{rows});
   console.log(JSON.stringify({case:c.id,regime:c.regime,arm,netUSD:row.netAfterModelUSD,retailers:row.retailerUSD,retained:row.retainedPurchases,calls:row.agent?.modelCalls||0,failed:row.agent?.failed||false}));
  }
  await verify(protocol);const costs=await spend();if(costs.unsettled||costs.costUSD>.25)throw Error('COST_UNRECONCILED');
  const metrics=['netAfterModelUSD','platformUSD','retailerUSD','wholesalerUSD','manufacturerUSD','allPartnerUSD','terminalCashUSD','terminalInventoryUSD','retainedPurchases','retainedVolumeUSD','recommendationPurchases','attributedPurchases','contactCount','outreachCostUSD','retailPaymentNetUSD','supplierPaymentNetUSD','unpaidLiabilities'],
   means=Object.fromEntries(protocol.arms.map(arm=>{const rs=rows.filter(r=>r.policy===arm);return [arm,Object.fromEntries(metrics.map(k=>[k,rs.reduce((s,r)=>s+r[k],0)/rs.length]))];})),cases=[];
  for(const c of protocol.cases){const r=rows.filter(r=>r.seed===c.seed),f=r.find(r=>r.policy==='strong_fixed'),t=r.find(r=>r.policy==='autonomous_team'),m=r.find(r=>r.policy==='static_learned_routing');
   for(const key of ['initialHash','opportunityHash','consentHash','incomeCents'])if(new Set(r.map(r=>r[key])).size!==1)throw Error('UNPAIRED_'+key);
   cases.push({...c,fixedUSD:f.netAfterModelUSD,teamUSD:t.netAfterModelUSD,staticMLUSD:m.netAfterModelUSD,deltaUSD:t.netAfterModelUSD-f.netAfterModelUSD,retailerDeltaUSD:t.retailerUSD-f.retailerUSD,costUSD:t.modelCostUSD,agentFailed:t.agent.failed});
  }
  const f=means.strong_fixed,t=means.autonomous_team,agents=rows.filter(r=>r.policy==='autonomous_team'),
   merchantDeltas=Object.fromEntries(Object.keys(agents[0].merchantContributions).map(id=>[id,agents.reduce((s,r)=>s+r.merchantContributions[id],0)/agents.length-rows.filter(r=>r.policy==='strong_fixed').reduce((s,r)=>s+r.merchantContributions[id],0)/agents.length])),
   gates={positivePlatform:t.netAfterModelUSD>f.netAfterModelUSD,aggregateRetailer:t.retailerUSD>=f.retailerUSD,eachRetailer:Object.values(merchantDeltas).every(v=>v>=0),suppliers:t.wholesalerUSD>=f.wholesalerUSD&&t.manufacturerUSD>=f.manufacturerUSD,cash:t.terminalCashUSD>=f.terminalCashUSD,inventory:t.terminalInventoryUSD<=f.terminalInventoryUSD*1.1,noLiabilities:rows.every(r=>r.unpaidLiabilities===0),autonomy:agents.every(r=>!r.agent.failed&&r.agent.trainingJobs>0&&r.agent.publications>0)};
  const report={status:'COMPLETED',means,cases,merchantDeltas,gates,ratio:t.netAfterModelUSD/f.netAfterModelUSD,platformDeltaUSD:t.netAfterModelUSD-f.netAfterModelUSD,versusStaticMLUSD:t.netAfterModelUSD-means.static_learned_routing.netAfterModelUSD,wins:cases.filter(c=>c.deltaUSD>0).length,spend:costs,
   modelCalls:agents.reduce((s,r)=>s+r.agent.modelCalls,0),trainingJobs:agents.reduce((s,r)=>s+r.agent.trainingJobs,0),publications:agents.reduce((s,r)=>s+r.agent.publications,0),providerLatencyMs:agents.reduce((s,r)=>s+r.agent.providerLatencyMs,0),
   checks:{frozenSources:true,pairedWorlds:true,paymentLedgers:true,allInvariants:rows.every(r=>r.reliability.invariantsPassed)},nativePaymentCalls:0,limits:protocol.limits,timing:protocol.timing,goalAchieved:Object.values(gates).every(Boolean),stretch2x:t.netAfterModelUSD>=2*f.netAfterModelUSD};
  await save('results.json',report);console.log(JSON.stringify({status:report.status,ratio:report.ratio,wins:report.wins,gates,spend:costs}));
 }catch(error){await save('failure.json',{error:error.message,completedRows:rows.length});throw error;}finally{await team?.close();allocator.close();}
}else throw Error('Use --freeze, then --run');

import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {ROOT,frozenInputs,sha,readJSON,saveJSON,observedWorld,runPolicy} from '../research-lab/data.mjs';
import {semanticSpec} from './contract.mjs';
import {bindSourceSelection,sourceUnits} from './source-router.mjs';
import {CONFIRMATION} from './confirmation-cases.mjs';
const base=resolve(ROOT,'docs/policy-lab/benchmarks/v4-1'),r=await readJSON(resolve(base,'result.json')),p=await readJSON(resolve(base,'protocol.json')),v4=await readJSON(resolve(ROOT,'docs/policy-lab/benchmarks/v4/protocol.json'));
const {catalog}=await frozenInputs(),issues=[];const check=(ok,message)=>{if(!ok)issues.push(message);};
for(const [path,expected]of Object.entries({...v4.code,...p.code}))check(sha(await readFile(resolve(ROOT,path)))===expected,'Changed frozen input: '+path);
check(p.casesHash===sha(CONFIRMATION),'Confirmation cases changed');check(r.protocolHash===p.hash,'Result/protocol mismatch');
const ledger=await readJSON(resolve(ROOT,'.local/gcp/model-spend.json')),reservations=new Set();let nativeCost=0,models=0,pilots=0;
for(const c of r.cases){
  const task=CONFIRMATION.find(t=>t.id===c.taskId);check(!!task,'Unknown case '+c.taskId);
  const request=await readJSON(resolve(base,'missions',c.id,'requests/shared-reader.json'));
  check(request.status==='COMPLETED','Unfinished reader '+c.id);check(request.provider?.modelVersion?.startsWith('gemini-3.1-flash-lite'),'Model provenance '+c.id);
  const row=ledger.entries.find(e=>e.id===request.provider?.reservationId);check(row?.status==='settled'&&row.chargedMicros===request.provider?.modelCostMicros,'Spend mismatch '+c.id);check(!reservations.has(row?.id),'Duplicate provider allocation');reservations.add(row?.id);nativeCost+=(row?.chargedMicros||0)/1e6;
  check(request.packet.brief===task.brief,'Changed brief '+c.id);check(sha(request.packet.sourceUnits)===sha(sourceUnits(task.brief)),'Changed source units '+c.id);
  const forbidden=new Set(['expected','expectedSpec','control','scenario','seed','oracle','privateEconomics']);
  function inspect(x){if(!x||typeof x!=='object')return;for(const [k,v]of Object.entries(x)){check(!forbidden.has(k),'Evaluator data in model packet '+c.id+' '+k);inspect(v);}}inspect(request.packet);
  const parsed=bindSourceSelection(request.response.args,task.brief,request.packet.sourceUnits);check(sha(parsed)===sha(c.methods.find(m=>m.method==='reader').spec),'Source binding mismatch '+c.id);
  const context=observedWorld({id:'WORLD-'+c.seed,seed:c.seed,scenario:c.scenario,catalog,budgetCents:10000,cutoff:45}),snapshot=sha({actions:context.actions,orders:[...context.orders],cutoff:45});
  for(const m of c.methods){
    check(m.state.snapshotHash===snapshot,'Different observed evidence '+c.id+' '+m.method);
    for(const node of m.state.nodes){check(node.inputHash===sha(node.input),'Changed checkpoint input '+c.id+' '+node.name);check(node.status==='COMPLETED','Incomplete node '+c.id+' '+node.name);}
    const fitted=m.state.nodes.find(n=>n.name==='models_compared')?.output||{};models+=Object.keys(fitted).length;pilots+=m.state.effects.pilots;
    for(const model of Object.values(fitted)){const cutoff=45,window=model.summary.windowDays;const hash=sha(context.actions.filter(a=>a.day<cutoff&&a.matures_day<=cutoff&&a.day>=cutoff-window).map(a=>[a.day,a.selected_action,a.context_json,a.reward_cents]));check(model.summary.datasetHash===hash,'Training rows mismatch '+c.id);}
    const commit=m.state.nodes.find(n=>n.name==='decision_committed')?.output;
    const none={id:'observe',strategy:'observe',audience:'all',merchantIndices:[],maxOfferPct:0,duration:0,penalty:0,epsilon:0,windowDays:42};
    const args={id:'FINAL-'+c.seed,seed:c.seed,scenario:c.scenario,catalog,budgetCents:m.spec.status==='ready'?m.spec.budgetCents:10000,cutoff:45};
    const control=runPolicy({...args,plan:none,artifact:null}),score=runPolicy({...args,plan:m.policy.plan,artifact:commit?.model?fitted[commit.model].artifact:null,includeTrace:true});
    for(const key of ['platformProxyCents','merchantContributionCents','purchases','offers','recommendations','matureOutcomes'])check(score[key]===m.score[key],'Final outcome mismatch '+c.id+' '+key);
    const cost=m.method==='reader'?c.costUSD:0;check(Math.abs(m.deltaPlatformUSD-((score.platformProxyCents-control.platformProxyCents)/100-cost))<1e-10,'Financial score mismatch '+c.id);
    const exact=sha(semanticSpec(m.spec))===sha(c.expectedSpec);check(exact===m.grade.exactInterpretation,'Grade mismatch '+c.id+' '+m.method);
    check(m.state.completed&&Object.values(m.score.checks).every(n=>n===0),'Workflow/accounting failed '+c.id);
  }
}
check(Math.abs(nativeCost-r.costs.actualModelUSD)<1e-10,'Suite inference cost mismatch');check(r.cases.length===24,'Missing cases');
const result={verifiedAt:new Date().toISOString(),passed:issues.length===0,issues,cases:r.cases.length,methods:r.cases.length*2,actualModelRequests:reservations.size,actualModelUSD:nativeCost,localModelFits:models,developmentPilots:pilots,identicalObservedSnapshots:true,frozenPriorSimulatorsAndPolicies:true,sourceIdsGrounded:true,finalOutcomesRecomputed:true,limitations:['Verification establishes execution/accounting consistency, not general population accuracy or production ROI.','Source IDs prevent copying errors; choosing the correct source and objective still requires semantic evaluation.']};
await saveJSON(resolve(base,'verification.json'),result);console.log(JSON.stringify(result,null,2));if(issues.length)process.exitCode=1;

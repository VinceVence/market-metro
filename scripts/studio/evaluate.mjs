// Read-only evaluation of the three predeclared browser trials; never calls a model.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {coverEvidence} from '../../demo/studio/coverage.mjs';
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const revision=process.argv.includes('--revision'),prefix=revision?'office-evaluation-revision':'office-evaluation';
const plan=JSON.parse(await readFile(new URL('../../docs/ag-studio/'+prefix+'-plan.json',import.meta.url)));
const db=new DatabaseSync(fileURLToPath(new URL('../../.local/market-metro.sqlite',import.meta.url)),{readOnly:true});
try{
 const rows=db.prepare('SELECT * FROM studio_agent_steps WHERE run_id=? AND created_at>=? AND created_at<? ORDER BY created_at').all(plan.runId,plan.registeredAt,plan.closedAt||'9999').map(r=>({...r,input:JSON.parse(r.input_json),output:JSON.parse(r.output_json||'null'),provider:JSON.parse(r.provider_json||'[]')}));
 const unchanged=Object.entries(plan.dataHashes).every(([t,h])=>hash(db.prepare('SELECT * FROM '+t+' WHERE run_id=? ORDER BY rowid').all(plan.runId))===h);
 const frozen=hash(await readFile(new URL('../behavior-v4/engine.mjs',import.meta.url),'utf8'))===plan.simulatorHash;
 const cases=plan.cases.map(c=>{
  const attempts=rows.filter(r=>r.role==='analyst'&&r.input.question===c.question&&r.input.snapshot.cutoff===c.cutoff),a=attempts[0],designs=rows.filter(r=>r.role==='designer'&&r.parent_id===a?.step_id),d=designs[0];
  const versions=d?db.prepare('SELECT * FROM studio_report_versions WHERE source_step=? ORDER BY created_at').all(d.step_id):[],version=versions.at(-1),state=version&&JSON.parse(version.state_json),page=state?.pages.find(p=>p.id===state.selectedPageId),actual=Object.keys(page?.widgets||{}),coverage=a?.output&&d?.output?coverEvidence(a.output,d.output.widgets):null;
  const facts=a?.output?.evidence||[],grounded=facts.length>=2&&facts.every(e=>a.input.packet.evidence.some(f=>f.id===e.metricId&&f.value===e.value));
  const cost=(a?.cost_micros||0)+(d?.cost_micros||0);
  const gates={freshPair:attempts.length===1&&designs.length===1&&a?.status==='COMPLETED'&&d?.status==='COMPLETED'&&[a,d].every(s=>s.provider.length===1&&s.provider[0].configuredModel==='gemini-3.1-flash-lite'),questionFocus:c.acceptableFocus.includes(a?.output?.focus),exactFacts:grounded,sameEvidence:!!d&&d.snapshot_id===a.snapshot_id&&d.input.packet.analysisId===a.step_id&&d.output?.analysisId===a.step_id&&JSON.stringify(d.input.packet.approvedAnalysis)===JSON.stringify(a.output),usefulViews:c.requiredWidgets.every(w=>actual.includes(w)),savedApplication:!!version&&(revision?coverage.widgets:d.output.widgets).length===actual.length&&(revision?coverage.widgets:d.output.widgets).every(w=>actual.includes(w))&&version.snapshot_id===a.snapshot_id,explicitLimits:!!a?.output?.nextStep&&!!a?.output?.limitation,readOnly:unchanged&&frozen,boundedCost:cost<=250000};
  return {id:c.id,cutoff:c.cutoff,question:c.question,pass:Object.values(gates).every(Boolean),gates,analystId:a?.step_id,designerId:d?.step_id,focus:a?.output?.focus,evidence:facts,hypothesis:a?.output?.hypothesis,analystRationale:a?.output?.rationale,designerRationale:d?.output?.rationale,nextStep:a?.output?.nextStep,limitation:a?.output?.limitation,modelChosenWidgets:d?.output?.widgets,modelCoveredQuestion:c.requiredWidgets.every(w=>d?.output?.widgets?.includes(w)),guardAdded:revision?coverage?.added:[],widgets:actual,costUSD:cost/1e6,elapsedSeconds:a&&version?(Date.parse(versions[0].created_at)-Date.parse(a.created_at))/1000:null,reappliedFromCheckpoint:versions.length>1};
 });
 const report={evaluatedAt:new Date().toISOString(),runId:plan.runId,scope:plan.kind,cases,passed:cases.filter(c=>c.pass).length,total:cases.length,allNewAttempts:rows.length,allAttemptCostUSD:rows.reduce((n,r)=>n+r.cost_micros,0)/1e6,frozenSimulator:frozen,unchangedEconomicTables:unchanged,limitations:plan.limitations};
 await writeFile(new URL('../../docs/ag-studio/'+prefix+'.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 if(report.passed!==report.total||rows.length>plan.maxProviderCalls)process.exitCode=1;
}finally{db.close();}

// Explicit numerical feasibility probe on already-opened data, not an agent
// result or a fresh evaluation. Never reads the current goal confirmation.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {digest} from '../environment.mjs';
import {trainWorkbench} from './team-workbench-tools.mjs';
import {predictionMetrics} from './prediction-metrics.mjs';
import {feedbackFeatures,observedFeedbackHistory} from './feedback-features.mjs';
import {RESPONSE_FIELDS,predictResponse} from './features.mjs';
const dir='docs/commerce-growth/roc-net-goal-1/feedback-probe-1',root='docs/commerce-growth/team-workbench-1',load=async p=>JSON.parse(await readFile(p,'utf8'));await mkdir(dir);
const rows=(await load('docs/commerce-growth/autonomy-1/funding-training/dataset.json')).rows,reference=await load(root+'/reference-prediction-data.json'),protocol=await load(root+'/protocol.json'),frozen=await load(root+'/frozen-designs.json'),models={};
await writeFile(dir+'/protocol.json',JSON.stringify({source:'NUMERICAL_DEVELOPMENT_PROBE_NO_LLM',featureView:'market_feedback',families:['forest','boosted'],trainingMarkets:[...new Set(rows.map(r=>r.episode))],evaluationMarkets:protocol.confirmation,status:'PREDECLARED',freshConfirmation:false,modelCalls:0},null,2)+'\n');
for(const family of ['forest','boosted']){models[family]=await trainWorkbench(dir+'/'+family,rows,{featureView:'market_feedback',windowDays:100},family);console.log(JSON.stringify({family,validation:models[family].report.metrics}));}
const predictions={incumbent:[],forest:[],boosted:[]};
for(const settings of protocol.confirmation){
 const a=frozen.arms.numerical,key=digest({settings,model:a.modelHash,campaign:a.campaign}),trace=await load(root+'/confirmation-'+settings.seed+'-'+key.slice(0,12)+'-trace.json'),byDay=new Map(trace.decisions.map(d=>[d.day,d]));
 for(const r of reference.rows.filter(r=>r.market===settings.seed)){
  const rank=byDay.get(r.day).ranking.find(p=>p.customerId===r.customerId&&p.kind===r.kind&&p.catalogId===r.catalogId),view={day:r.day,outreach:{history:trace.contacts},pastOrders:trace.orders},history=observedFeedbackHistory(view),values={...Object.fromEntries(RESPONSE_FIELDS.map((k,i)=>[k,r.x[i]])),...feedbackFeatures(history,r.day,r.customerId,r.kind)};
  predictions.incumbent.push({market:r.market,y:r.retained,p:rank.probability});
  for(const [family,m]of Object.entries(models)){const artifact=m.artifact,x=artifact.featureNames.map(k=>values[k]);predictions[family].push({market:r.market,y:r.retained,p:predictResponse(artifact.models[artifact.selected],x,artifact.featureNames)});}
 }
}
const metrics=Object.fromEntries(Object.entries(predictions).map(([k,v])=>[k,predictionMetrics(v)])),result={source:'NUMERICAL_DEVELOPMENT_PROBE_NO_LLM',freshConfirmation:false,modelCalls:0,metrics,scope:'Prior workbench markets were already opened. These diagnostics may guide a new registered experiment, not establish goal achievement.'};
await writeFile(dir+'/results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(Object.fromEntries(Object.entries(metrics).map(([k,{auc,macroMarketAUC,averagePrecision,brier,logLoss}])=>[k,{auc,macroMarketAUC,averagePrecision,brier,logLoss}])),null,2));

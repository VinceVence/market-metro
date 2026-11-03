// Diagnostics on already-opened workbench cases. Never label these fresh tests.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {digest} from '../environment.mjs';
import {predictionMetrics} from './prediction-metrics.mjs';
import {predictContribution} from './features.mjs';
import {fitFundingCalibration,adjustForFunding} from './funding-calibration.mjs';
const root='docs/commerce-growth/team-workbench-1',dir='docs/commerce-growth/roc-net-goal-1',load=async p=>JSON.parse(await readFile(p,'utf8'));await mkdir(dir,{recursive:true});
const data=await load(root+'/reference-prediction-data.json'),protocol=await load(root+'/protocol.json'),funding=await load('docs/commerce-growth/autonomy-1/funding-training/funding-prior.json'),frozen=await load(root+'/frozen-designs.json'),models={
 incumbent:await load('docs/commerce-growth/autonomy-1/shared-value-training-1/models.json'),
 hurdle_context:await load(root+'/team/fit-1/models.json'),hurdle_original:await load(root+'/ablation-no-demand/models.json')},predictions=Object.fromEntries(Object.keys(models).flatMap(k=>[[k+'_raw',[]],[k+'_deployed',[]]]));
for(const settings of protocol.confirmation){
 const arm=frozen.arms.numerical,key=digest({settings,model:arm.modelHash,campaign:arm.campaign}),trace=await load(root+'/confirmation-'+settings.seed+'-'+key.slice(0,12)+'-trace.json'),contacts=new Map(trace.contacts.map(c=>[[c.day,c.customerId,c.kind,c.catalogId].join('|'),c])),decisions=new Map(trace.decisions.map(d=>[d.day,d]));
 for(const r of data.rows.filter(r=>r.market===settings.seed)){
  const c=contacts.get([r.day,r.customerId,r.kind,r.catalogId].join('|')),rank=decisions.get(r.day)?.ranking.find(p=>p.customerId===r.customerId&&p.kind===r.kind&&p.catalogId===r.catalogId);if(!c||!rank)throw Error('UNBOUND_OBSERVATION');
  const cal=fitFundingCalibration({day:r.day,outreach:{history:trace.contacts}},funding);
  for(const [name,artifact]of Object.entries(models)){
   const x=r.x.slice(0,artifact.featureNames.length),raw=predictContribution(artifact,artifact.selected,x,r.kind,artifact.featureNames),adjusted=r.kind==='recommend'?adjustForFunding(raw,cal,r.kind+'|'+c.observedBucket.split('|')[2],artifact.valueMeans[r.kind].failedNetCents):raw;
   predictions[name+'_raw'].push({market:r.market,kind:r.kind,y:r.retained,p:raw.probability});
   predictions[name+'_deployed'].push({market:r.market,kind:r.kind,y:r.retained,p:name==='incumbent'?rank.probability:adjusted.probability});
  }
 }
}
const metrics=Object.fromEntries(Object.entries(predictions).map(([k,rows])=>[k,predictionMetrics(rows)]));
await writeFile(dir+'/prior-roc-audit.json',JSON.stringify({scope:'Already-opened prior study. Diagnostic development evidence only; not new confirmation. Deployed versions share prior-day funding adjustment; incumbent also retains its inquiry posterior.',metrics},null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(metrics).map(([k,{n,auc,macroMarketAUC,averagePrecision,brier,logLoss}])=>[k,{n,auc,macroMarketAUC,averagePrecision,brier,logLoss}])),null,2));

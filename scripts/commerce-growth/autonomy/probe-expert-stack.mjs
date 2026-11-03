// Development-only: independent base experts trained on the original7markets;
// calibrators trained on a completed14-market pilot; older7opened markets used
// only as development diagnostics. Future confirmation remains unopened.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {digest} from '../environment.mjs';
import {predictResponse,RESPONSE_FIELDS} from './features.mjs';
import {feedbackFeatures,observedFeedbackHistory} from './feedback-features.mjs';
const dir='docs/commerce-growth/roc-net-goal-1/expert-stack-probe-1',load=async p=>JSON.parse(await readFile(p,'utf8'));await mkdir(dir);
const expert=await load('docs/commerce-growth/roc-net-goal-1/feedback-probe-1/forest/models.json'),train=await load('docs/commerce-growth/roc-net-goal-1/pilot-1/reference-prediction-data.json'),old='docs/commerce-growth/team-workbench-1',validation=await load(old+'/reference-prediction-data.json'),protocol=await load(old+'/protocol.json'),frozen=await load(old+'/frozen-designs.json'),logit=p=>Math.log(Math.max(1e-6,Math.min(1-1e-6,p))/(1-Math.max(1e-6,Math.min(1-1e-6,p)))),make=(r,inc,features)=>{const feedback=predictResponse(expert.models[expert.selected],expert.featureNames.map(k=>features[k]),expert.featureNames);return {market:r.market,kind:r.kind,y:r.retained,x:[logit(inc),logit(feedback),Number(r.kind==='recommend')],incumbent:inc,feedback};},training=train.rows.map(r=>make(r,r.incumbentProbability,r.features)),testing=[];
for(const settings of protocol.confirmation){const a=frozen.arms.numerical,key=digest({settings,model:a.modelHash,campaign:a.campaign}),trace=await load(old+'/confirmation-'+settings.seed+'-'+key.slice(0,12)+'-trace.json'),byDay=new Map(trace.decisions.map(d=>[d.day,d]));
 for(const r of validation.rows.filter(r=>r.market===settings.seed)){const rank=byDay.get(r.day).ranking.find(p=>p.customerId===r.customerId&&p.kind===r.kind&&p.catalogId===r.catalogId),history=observedFeedbackHistory({day:r.day,pastOrders:trace.orders,outreach:{history:trace.contacts}}),features={...Object.fromEntries(RESPONSE_FIELDS.map((k,i)=>[k,r.x[i]])),...feedbackFeatures(history,r.day,r.customerId,r.kind)};testing.push(make(r,rank.probability,features));}
}
if(training.some(r=>testing.some(t=>t.market===r.market)))throw Error('CALIBRATION_VALIDATION_OVERLAP');
await writeFile(dir+'/data.json',JSON.stringify({training,testing}));await writeFile(dir+'/protocol.json',JSON.stringify({source:'NUMERICAL_DEVELOPMENT_NOT_LLM',trainingMarkets:[...new Set(training.map(r=>r.market))],developmentMarkets:[...new Set(testing.map(r=>r.market))],freshConfirmation:false,C:[.1,1,10],modes:['pooled','by_kind'],baseExpertHash:digest(expert)},null,2)+'\n');console.log(JSON.stringify({training:training.length,development:testing.length}));

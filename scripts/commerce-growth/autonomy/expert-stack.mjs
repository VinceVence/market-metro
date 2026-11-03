import {RESPONSE_FIELDS} from './features.mjs';
import {MARKET_FEEDBACK_FIELDS} from './feedback-features.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {resolve} from 'node:path';
import {predictResponse} from './features.mjs';import {digest} from '../environment.mjs';
export const EXPERT_STACK_FIELDS=Object.freeze([...RESPONSE_FIELDS,...MARKET_FEEDBACK_FIELDS,'incumbent_probability']);
export function buildExpertArtifact(incumbent,feedback,stack){
 if(JSON.stringify(incumbent.featureNames)!==JSON.stringify(RESPONSE_FIELDS)||JSON.stringify(feedback.featureNames)!==JSON.stringify([...RESPONSE_FIELDS,...MARKET_FEEDBACK_FIELDS])||!['pooled','by_kind'].includes(stack.mode))throw Error('INVALID_EXPERT_STACK');
 return {version:'payment-feedback-experts-1',featureNames:EXPERT_STACK_FIELDS,trainingRows:incumbent.trainingRows+(stack.trainingRows||0),trainingEpisodes:[...new Set([...incumbent.trainingEpisodes,...feedback.trainingEpisodes])],calibrationEpisodes:stack.trainingMarkets,
  selected:'expert_stack',models:{expert_stack:{family:'expert_stack',featureNames:EXPERT_STACK_FIELDS,feedbackExpert:feedback.models[feedback.selected],feedbackFeatureNames:feedback.featureNames,stack}},
  incumbentArtifact:incumbent,valueModel:null,valueMeans:incumbent.valueMeans,sharedValueMeans:incumbent.sharedValueMeans,sharedValueModel:{...incumbent.sharedValueModel,featureNames:EXPERT_STACK_FIELDS},
  scope:'Base experts trained on original markets; a low-dimensional combiner fitted on separate completed-market predictions. Financial value head and environment unchanged.'};
}
export async function trainExpertWorkbench(dir,contract,family,resources){
 if(!resources||!['expert_pool','expert_by_kind'].includes(family)||contract.featureView!=='expert_scores'||![28,56,100].includes(contract.windowDays))throw Error('INVALID_EXPERT_TRAINING_JOB');
 const load=async p=>JSON.parse(await readFile(p,'utf8')),[reference,incumbent,feedback]=await Promise.all([load(resources.referencePath),load(resources.incumbentPath),load(resources.feedbackPath)]),selected=reference.rows.filter(r=>r.day>=Math.max(30,100-contract.windowDays));
 if(selected.some(r=>incumbent.trainingEpisodes.includes(r.market)||feedback.trainingEpisodes.includes(r.market))||selected.length<500)throw Error('INVALID_CALIBRATION_COHORT');
 const logit=p=>{const q=Math.max(1e-6,Math.min(1-1e-6,p));return Math.log(q/(1-q));},training=selected.map(r=>{const p=predictResponse(feedback.models[feedback.selected],feedback.featureNames.map(k=>r.features[k]),feedback.featureNames);return {market:r.market,kind:r.kind,y:r.retained,x:[logit(r.incumbentProbability),logit(p),Number(r.kind==='recommend')],incumbent:r.incumbentProbability,feedback:p};});
 await mkdir(dir);await writeFile(dir+'/data.json',JSON.stringify({training}));const spec={mode:family==='expert_pool'?'pooled':'by_kind',family,...contract};await writeFile(dir+'/spec.json',JSON.stringify(spec));
 await promisify(execFile)(resolve('.local/marketing-venv/bin/python'),[resolve('scripts/commerce-growth/autonomy/train-expert-stack.py'),resolve(dir)],{timeout:60000,maxBuffer:100000});
 const [stack,report,parity]=await Promise.all([load(dir+'/selected.json'),load(dir+'/report.json'),load(dir+'/parity.json')]),artifact={...buildExpertArtifact(incumbent,feedback,stack),spec,datasetHash:digest(training)};
 for(const p of parity){const r=selected[p.index],values={...r.features,incumbent_probability:r.incumbentProbability},actual=predictResponse(artifact.models.expert_stack,EXPERT_STACK_FIELDS.map(k=>values[k]),EXPERT_STACK_FIELDS);if(Math.abs(actual-p.expected)>1e-9)throw Error('EXPERT_STACK_PARITY_FAILED');}
 await writeFile(dir+'/models.json',JSON.stringify(artifact));return {id:'MODEL-'+digest(artifact).slice(0,16),modelHash:digest(artifact),datasetHash:artifact.datasetHash,artifact,report};
}

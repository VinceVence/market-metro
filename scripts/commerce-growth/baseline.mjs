// A local, replayable comparison baseline. No provider or payment calls.
import {readFile,writeFile,mkdir,cp,mkdtemp,symlink,rm,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {dirname,resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';

export const BASELINE_ID='paypal-net-v1';
export const BASELINE_DIR='docs/commerce-growth/baselines/'+BASELINE_ID;
const ROOT=resolve(import.meta.dirname,'../..'),REPORT='docs/commerce-growth/roc-net-goal-1',CONFIRM=REPORT+'/net-revision-confirmation-1';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const exec=promisify(execFile);
export async function verifyHashes(root,hashes,label){
 for(const [path,expected]of Object.entries(hashes)){
  if(path.startsWith('/')||path.split('/').includes('..'))throw Error('INVALID_BASELINE_PATH');
  if(hash(await readFile(resolve(root,path)))!==expected)throw Error(label+': '+path);
 }
}
export async function verifyBaseline({root=ROOT,dir=resolve(root,BASELINE_DIR)}={}){
 const bytes=await readFile(join(dir,'manifest.json')),seal=(await readFile(join(dir,'manifest.sha256'),'utf8')).trim();
 if(hash(bytes)!==seal)throw Error('BASELINE_MANIFEST_CHANGED');
 const m=JSON.parse(bytes);if(m.id!==BASELINE_ID||m.status!=='LOCKED')throw Error('INVALID_BASELINE');
 await verifyHashes(root,m.economyHashes,'FROZEN_ECONOMY_CHANGED');
 await verifyHashes(join(dir,'snapshot'),m.snapshotHashes,'BASELINE_ARTIFACT_CHANGED');
 await verifyHashes(root,m.evidenceHashes,'PUBLISHED_EVIDENCE_CHANGED');
 return m;
}
async function sourceClosure(entry,found=new Set()){
 if(found.has(entry))return found;found.add(entry);
 const body=await readFile(resolve(ROOT,entry),'utf8');
 for(const match of body.matchAll(/(?:\bfrom\s*|\bimport\s*)['"]([^'"]+)['"]/g)){
  const spec=match[1];if(!spec.startsWith('.'))continue;
  const p=relative(ROOT,resolve(ROOT,dirname(entry),spec));if(p.startsWith('..'))throw Error('OUTSIDE_BASELINE_SOURCE');
  await sourceClosure(p,found);
 }return found;
}
async function pythonRuntime(){
 const r=await exec(resolve(ROOT,'.local/marketing-venv/bin/python'),['-c','import sys,json,numpy,scipy;print(json.dumps({"python":sys.version.split()[0],"numpy":numpy.__version__,"scipy":scipy.__version__}))']);return JSON.parse(r.stdout);
}
async function lock(){
 const dir=resolve(ROOT,BASELINE_DIR),core=await readJson(resolve(ROOT,'docs/commerce-growth/development-1/protocol.json')),p=await readJson(resolve(ROOT,CONFIRM+'/protocol.json')),r=await readJson(resolve(ROOT,CONFIRM+'/results.json')),decision=await readJson(resolve(ROOT,REPORT+'/net-revision-decision.json'));
 if(r.status!=='COMPLETED'||decision.status!=='COMPLETED'||p.decisionHash!==decision.decisionHash||!r.eligibleForConfirmation)throw Error('BASELINE_NOT_MEASURED');
 await verifyHashes(ROOT,core.sourceHashes,'FROZEN_ECONOMY_CHANGED');await verifyHashes(ROOT,p.programHashes,'CONFIRMED_PROGRAM_CHANGED');
 const sources=await sourceClosure('scripts/commerce-growth/autonomy/net-revision-study.mjs');
 await sourceClosure('scripts/commerce-growth/baseline-replay.mjs',sources);
 const data=[...Object.keys(core.sourceHashes),...Object.keys(p.programHashes),
  'scripts/commerce-deadlines/allocator.py','scripts/marketing/requirements.txt',
  'docs/commerce-growth/team-1/development/results.json','docs/commerce-growth/roc-net-goal-1/pilot-2/team/fit-0/models.json',
  'docs/commerce-growth/experiments-1/balanced-revision-1/revision-frozen.json',
  CONFIRM+'/protocol.json',CONFIRM+'/results.json',CONFIRM+'/rows.json',CONFIRM+'/customer-example.json',REPORT+'/NET-RESULT.md'];
 await mkdir(dirname(dir),{recursive:true});await mkdir(dir);await mkdir(join(dir,'snapshot'));
 const snapshotHashes={};for(const path of [...new Set([...sources,...data])].sort()){
  const bytes=await readFile(resolve(ROOT,path)),target=resolve(dir,'snapshot',path);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});snapshotHashes[path]=hash(bytes);
 }
 // Preserve the published detailed traces in place, with hashes. Avoid a
 // redundant220 MB copy; source/model/result snapshots are self-contained.
 const evidenceHashes={};for(const name of await readdir(resolve(ROOT,CONFIRM)))if(name.endsWith('-trace.json')){const path=CONFIRM+'/'+name;evidenceHashes[path]=hash(await readFile(resolve(ROOT,path)));}
 const n=p.cases.length,cost=r.costUSD/n,manifest={schemaVersion:1,id:BASELINE_ID,status:'LOCKED',lockedAt:new Date().toISOString(),authorization:'User: lock this in as baseline; make the economy frozen.',
  selectedArm:'revised',decision:decision.output,decisionHash:decision.decisionHash,designCostUSD:decision.costUSD,
  scorecard:{markets:n,meanPlatformBeforeAIUSD:r.summary.revised.platformUSD,meanNetAfterAIUSD:r.summary.revised.platformUSD-cost,meanNetVsFixedUSD:r.differences.revised.fixed.meanNetUSD-cost,meanRetailerUSD:r.summary.revised.retailerUSD,meanRetainedPurchases:r.summary.revised.retainedPurchases,meanClosingPartnerCashUSD:r.summary.revised.terminalCashUSD,meanClosingInventoryUSD:r.summary.revised.terminalInventoryUSD,netIntervals:r.netIntervals},
  regressionCases:p.cases,benchmarkContract:{primary:'Paired settled modeled PayPal net after model cost.',comparison:'Rerun this frozen policy on the same newly registered seeds as each candidate; its recorded751.65USD is not a universal target.',preserve:['Aggregate retailer contribution','Closing partner cash','Original110% fixed-inventory safeguard','Zero unpaid liabilities','Consent, funding and contact constraints'],evidenceBoundary:'These14 seeds are now regression/development data. Preserve old losses. Confirm improvements on new seeds chosen before outcomes. Compare equally equipped single planner and team; ablate actual outputs.',costs:'Report runtime and design costs separately; amortize each design over the same number of evaluation markets.',claims:'Measured benefit from an LLM-selected campaign in an authored simulation. No established multi-agent superiority or production PayPal profit.'},
  runtime:{node:process.version,...await pythonRuntime()},economyHashes:core.sourceHashes,snapshotHashes,evidenceHashes,
  source:'Exact confirmed full Gemini policy, not the retrospectively better ablation.',credentialsIncluded:false};
 const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');await writeFile(join(dir,'manifest.json'),bytes,{flag:'wx'});await writeFile(join(dir,'manifest.sha256'),hash(bytes)+'\n',{flag:'wx'});
 await verifyBaseline();console.log(JSON.stringify({id:manifest.id,status:manifest.status,files:Object.keys(snapshotHashes).length,economyFiles:Object.keys(core.sourceHashes).length,traceFiles:Object.keys(evidenceHashes).length,netUSD:manifest.scorecard.meanNetAfterAIUSD}));
}
async function replay(caseId){
 const m=await verifyBaseline();if(!m.regressionCases.some(c=>c.id===caseId))throw Error('UNKNOWN_REGRESSION_CASE');
 const runtime=await pythonRuntime();if(Object.entries(runtime).some(([k,v])=>m.runtime[k]!==v)||process.version!==m.runtime.node)throw Error('BASELINE_RUNTIME_CHANGED');
 const temp=await mkdtemp(join(tmpdir(),'market-metro-baseline-'));
 try{await cp(resolve(ROOT,BASELINE_DIR,'snapshot'),temp,{recursive:true});await mkdir(join(temp,'.local'));await symlink(resolve(ROOT,'.local/marketing-venv'),join(temp,'.local/marketing-venv'),'dir');
  const result=await exec(process.execPath,['scripts/commerce-growth/baseline-replay.mjs',caseId],{cwd:temp,timeout:120000,maxBuffer:20000});process.stdout.write(result.stdout);
 }finally{await rm(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.includes('--lock'))await lock();
 else if(process.argv.includes('--replay'))await replay(process.argv[process.argv.indexOf('--replay')+1]||'C0');
 else{const m=await verifyBaseline();console.log(JSON.stringify({id:m.id,status:'VERIFIED',economyFiles:Object.keys(m.economyHashes).length,snapshotFiles:Object.keys(m.snapshotHashes).length,publishedTraces:Object.keys(m.evidenceHashes).length}));}
}

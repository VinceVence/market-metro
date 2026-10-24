import {readFile,writeFile,mkdir,appendFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {PROTOCOL,SOURCE_FILES,sourceHashes,prepareCases,evaluateCases,renderReport,writeJson,readJson} from './marketing/decision-benchmark.mjs';
import {ACTION_CONTRACT,digest,validateDecision} from './marketing/decision-actions.mjs';

globalThis.fetch=()=>{throw new Error('NETWORK_FORBIDDEN_IN_DECISION_BENCHMARK');};
const args=process.argv.slice(2),command=args[0];
const flag=(name,fallback)=>args.includes('--'+name)?args[args.indexOf('--'+name)+1]:fallback;
const tag=flag('run','trial-v1');
if(!/^[a-z0-9][a-z0-9-]{0,45}$/.test(tag))throw new Error('INVALID_RUN_NAME');
const pub=resolve('docs/marketing-decisions',tag),priv=resolve('.local/marketing-decisions',tag);
const paths={manifest:pub+'/manifest.json',packets:pub+'/packets.json',states:priv+'/states.json',rules:priv+'/rules.json',submission:pub+'/submission.json',receipt:pub+'/submission-receipt.json'};
async function verify(){
  const manifest=await readJson(paths.manifest);
  if(JSON.stringify(await sourceHashes())!==JSON.stringify(manifest.sourceHashes))throw new Error('FROZEN_SOURCE_CHANGED: create a new run; do not reuse prior decisions.');
  for(const [key,hash]of Object.entries(manifest.frozenFiles))if(digest(await readFile(paths[key],'utf8'))!==hash)throw new Error('FROZEN_FILE_CHANGED: '+key);
  return manifest;
}
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
if(command==='prepare'){
  if(await exists(pub)||await exists(priv))throw new Error('RUN_ALREADY_EXISTS: use a fresh run name.');
  const count=Number(flag('cases',PROTOCOL.caseCount)),customers=Number(flag('customers',PROTOCOL.customers));
  if(!Number.isInteger(count)||count<1||count>12||!Number.isInteger(customers)||customers<100||customers>1200)throw new Error('INVALID_BOUNDED_SUITE');
  await mkdir(priv,{recursive:true});
  const frozenSources=await sourceHashes(),started=performance.now();
  const data=await prepareCases({count,customers,onProgress:x=>console.log(JSON.stringify(x))});
  if(JSON.stringify(await sourceHashes())!==JSON.stringify(frozenSources))throw new Error('SOURCE_CHANGED_DURING_PREPARATION');
  await writeJson(paths.packets,{schema:'MARKETING_EVIDENCE_PACKETS_V1',packets:data.packets});
  await writeJson(paths.states,data.states);await writeJson(paths.rules,data.rules);
  const frozenFiles=Object.fromEntries(await Promise.all(['packets','states','rules'].map(async k=>[k,digest(await readFile(paths[k],'utf8'))])));
  await writeJson(paths.manifest,{schema:'MARKETING_DECISION_FREEZE_V1',createdAt:new Date().toISOString(),protocol:{...PROTOCOL,caseCount:count,customers},actionContract:ACTION_CONTRACT,sourceHashes:frozenSources,frozenFiles,preparationRuntimeMs:Math.round(performance.now()-started),evaluatorStateLocation:'.local/marketing-decisions/'+tag+'/states.json',limitations:'The assistant authored the engine and rules. Sealing prevents post-outcome edits but does not make this blinded.'});
  console.log(JSON.stringify({status:'FROZEN_AWAITING_REVIEW',run:tag,caseCount:count,packets:paths.packets,packetSetHash:frozenFiles.packets,externalCalls:0}));
}else if(command==='packets'){
  const manifest=await verify();
  if(!await exists(priv+'/review-started.json'))await writeJson(priv+'/review-started.json',{at:new Date().toISOString()});
  console.log(JSON.stringify({packetSetHash:manifest.frozenFiles.packets,...await readJson(paths.packets)},null,2));
}else if(command==='submit'){
  const manifest=await verify(),file=flag('file',null);
  if(!file)throw new Error('Provide --file with the chat reviewer decisions.');
  if(await exists(paths.submission))throw new Error('SUBMISSION_ALREADY_SEALED');
  try{
    const input=await readJson(resolve(file)),{packets}=await readJson(paths.packets);
    if(input.actor!=='assistant_in_current_chat'||input.packetSetHash!==manifest.frozenFiles.packets||!Array.isArray(input.decisions)||input.decisions.length!==packets.length||new Set(input.decisions.map(d=>d.caseId)).size!==packets.length)throw new Error('INVALID_OR_INCOMPLETE_SUBMISSION');
    for(const d of input.decisions){const p=packets.find(p=>p.caseId===d.caseId);if(!p)throw new Error('UNKNOWN_CASE');validateDecision(p,d);}
    const reviewStarted=await exists(priv+'/review-started.json')?await readJson(priv+'/review-started.json'):null;
    await writeJson(paths.submission,input);
    await writeJson(paths.receipt,{sealedAt:new Date().toISOString(),submissionSha256:digest(await readFile(paths.submission,'utf8')),manifestSha256:digest(await readFile(paths.manifest,'utf8')),reviewStartedAt:reviewStarted?.at||null,evaluationHasRun:false,independentBlinding:false,paidApiCalls:0});
    await appendFile(priv+'/submission-attempts.jsonl',JSON.stringify({at:new Date().toISOString(),accepted:true})+'\n');
    console.log(JSON.stringify({status:'DECISIONS_SEALED',cases:packets.length,submission:paths.submission}));
  }catch(error){await appendFile(priv+'/submission-attempts.jsonl',JSON.stringify({at:new Date().toISOString(),accepted:false,reason:error.message})+'\n');throw error;}
}else if(command==='score'){
  const manifest=await verify(),receipt=await readJson(paths.receipt);
  if(receipt.submissionSha256!==digest(await readFile(paths.submission,'utf8'))||receipt.manifestSha256!==digest(await readFile(paths.manifest,'utf8')))throw new Error('SEALED_SUBMISSION_OR_MANIFEST_CHANGED');
  if(await exists(pub+'/results.json'))throw new Error('RESULTS_ALREADY_EXIST: read the saved result; do not reselect decisions.');
  const started=performance.now();
  const report=await evaluateCases({packets:(await readJson(paths.packets)).packets,states:await readJson(paths.states),rules:await readJson(paths.rules),submission:await readJson(paths.submission),onProgress:x=>console.log(JSON.stringify(x))});
  await verify();
  const attempts=(await readFile(priv+'/submission-attempts.jsonl','utf8')).trim().split('\n').map(JSON.parse);
  Object.assign(report,{run:tag,frozenPacketSetHash:manifest.frozenFiles.packets,submissionSha256:receipt.submissionSha256,submissionSealedAt:receipt.sealedAt,rejectedSubmissionAttempts:attempts.filter(a=>!a.accepted).length,evaluationRuntimeMs:Math.round(performance.now()-started),preparationRuntimeMs:manifest.preparationRuntimeMs,sourceFiles:SOURCE_FILES});
  await writeJson(pub+'/results.json',report);
  await writeFile(pub+'/report.md',renderReport(report),{flag:'wx'});
  console.log(JSON.stringify({status:report.status,report:pub+'/report.md',totals:report.totals,externalCalls:0},null,2));
}else{
  console.log('Usage: npm run benchmark:marketing -- prepare|packets|submit|score --run trial-v1 [--file decisions.json]');
  console.log('prepare freezes shared evidence and rules; packets displays only observed inputs; submit seals chat decisions; score reveals future replays.');
  if(command)process.exitCode=1;
}

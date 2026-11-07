import {LIGHT_THEME} from './theme.mjs';
import {compileDashboard,studioWidgets,styleReport} from './widgets.mjs';
import {marketHarness,applyCheckedDesign} from './agents.mjs';
import {coverEvidence} from './coverage.mjs';
import {worker} from '../garden/office-scene.mjs';
const $=id=>document.getElementById(id);let api,snapshot,runId,harness;
const getJSON=async url=>{const r=await fetch(url),j=await r.json();if(!r.ok||j.error)throw Error(j.error?.message||'Could not read the warehouse.');return j;};
const post=async(path,value)=>{const r=await fetch('/api/market/studio/'+path,{method:'POST',headers:{'content-type':'application/json','x-supply-yard':'sandbox'},body:JSON.stringify(value)}),j=await r.json();if(!r.ok||j.error)throw Error(j.error?.message||'Could not save this report.');return j;};
const roles=[['analyst','Market analyst','GEMINI','#c99b48','Finds the question to investigate'],['designer','View designer','GEMINI','#749781','Chooses the evidence views'],['guard','Checkpoint desk','LOCAL TOOL','#7495a4','Checks references, then saves']];
$('team-desks').innerHTML=roles.map(([id,name,type,color,task],i)=>`<article class="desk" id="desk-${id}" data-state="idle">${worker(color,i)}<div><span class="role-label">${type}</span><b>${name}</b><small>${task}</small></div></article>`).join('');
function progress(stage,status){
 if(stage==='analyst'&&status==='working')for(const [id,,,,task]of roles){$('desk-'+id).dataset.state='idle';$('desk-'+id).querySelector('small').textContent=task;}
 const node=$('desk-'+stage);if(node){node.dataset.state=status;node.querySelector('small').textContent={working:stage==='guard'?'Checking the same evidence…':'Reviewing this snapshot…',done:stage==='guard'?'Checked & saved':'Handoff complete',failed:'Stopped · inspect checkpoint'}[status]||status;}
 $('handoff-note').textContent=status==='failed'?'The handoff stopped. Inspect the saved checkpoint; no automatic retry.':status==='working'?{analyst:'The analyst is selecting facts from this day’s warehouse.',designer:'The designer received the checked analyst brief.',guard:'The local guard checks the snapshot, views and saved state.'}[stage]:'Read the evidence → design the views → check and save.';
}
function paragraph(text,cls){const p=document.createElement('p');p.textContent=text;if(cls)p.className=cls;return p;}
async function showCheckpoints(){
 const [steps,report]=await Promise.all([getJSON('/api/market/studio/steps?run='+encodeURIComponent(runId)),getJSON(`/api/market/studio/report?run=${encodeURIComponent(runId)}&day=${snapshot.cutoff}`)]);
 const visible=steps.filter(s=>s.snapshot_id===snapshot.id),designer=visible.find(s=>s.step_id===report.sourceStep),analyst=designer&&visible.find(s=>s.step_id===designer.parent_id),pair=analyst&&designer?[analyst,designer]:visible.slice(-2);
 $('audit-summary').textContent=visible.length?`${visible.length} saved agent calls · $${(visible.reduce((n,s)=>n+s.cost_micros,0)/1e6).toFixed(6)} · inspect the handoff`:'No agent review at this day yet';
 $('audit-decisions').replaceChildren();
 for(const step of pair){const article=document.createElement('article'),heading=document.createElement('b');heading.textContent=(step.role==='analyst'?'Market analyst':'View designer')+' · '+step.status+' · Gemini interpretation';article.append(heading,paragraph(step.output?.rationale||step.output?.error||'Waiting for provider response.'));
  if(step.output?.evidence){const proof=document.createElement('div');proof.className='evidence';for(const ref of step.output.evidence){const fact=step.input.packet.evidence?.find(f=>f.id===ref.metricId);if(!fact)continue;const chip=document.createElement('span');chip.textContent=fact.label+' = '+(fact.unit==='USD'?'$'+fact.value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):fact.unit==='fraction'?(fact.value*100).toFixed(1)+'%':fact.value);proof.append(chip);}article.append(proof,paragraph('Next: '+step.output.nextStep),paragraph('Limit: '+step.output.limitation,'decision-boundary'));}
  if(step.output?.widgets)article.append(paragraph('Model-proposed views: '+step.output.widgets.map(x=>x.replaceAll('_',' ')).join(' · '),'decision-boundary'));
  $('audit-decisions').append(article);
 }
 $('restore').hidden=!designer;
 if(analyst&&designer){for(const id of ['analyst','designer','guard'])progress(id,'done');const n=analyst.output.evidence?.length||0,coverage=coverEvidence(analyst.output,designer.output.widgets),page=report.state?.pages.find(p=>p.id===report.state.selectedPageId),missing=coverage.widgets.filter(w=>!page?.widgets?.[w]),added=coverage.added.filter(w=>page?.widgets?.[w]);$('handoff-note').textContent=missing.length?'Evidence coverage needs repair: '+missing.join(', ')+'. Choose Restore team view.':n?`${n} exact facts checked → ${Object.keys(page?.widgets||{}).length} views saved.${added.length?' Local guard added: '+added.join(', ')+'.':''}`:'Saved earlier handoff · exact metric references were added in the latest workflow.';}
 else{for(const [id,,,,task]of roles){$('desk-'+id).dataset.state='idle';$('desk-'+id).querySelector('small').textContent=task;}$('handoff-note').textContent='Read the evidence → design the views → check and save.';}
}
const theme=agStudio.studioTheme.withParams(LIGHT_THEME);
if(new URL(location.href).searchParams.has('embed'))document.body.classList.add('embedded');
async function load(){
 $('status').textContent='Reading checked warehouse snapshot…';for(const id of ['load','assistant','save','undo','edit','restore'])$(id).disabled=true;
 try{snapshot=await getJSON(`/api/market/studio/snapshot?run=${encodeURIComponent(runId)}&day=${$('day').value}`);const saved=await getJSON(`/api/market/studio/report?run=${encodeURIComponent(runId)}&day=${snapshot.cutoff}`);
  api?.destroy();harness?.dispose?.();
  const restored=!!saved.state?.pages?.some(p=>Object.keys(p.widgets||{}).length);
  const initialState=styleReport(restored?saved.state:compileDashboard(['net_sales','payment_evidence','daily_sales','merchant_sales','campaign_costs','order_ledger']),{compact:innerWidth<780});
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Studio initialization timed out. Reload this day.')),15000);
   api=agStudio.createStudioWithAi($('studio'),{data:{sources:snapshot.sources},initialState,mode:$('edit').checked?'edit':'view',theme,widgets:studioWidgets,
    onStudioReady(){clearTimeout(timeout);resolve();},onErrorRaised(e){if(e.fatal){clearTimeout(timeout);reject(Error(e.errorDetails.join(' ')));}},
    ai:({api})=>{harness=marketHarness(api,()=>snapshot,title=>{$('report-title').textContent=title;$('status').textContent='Team review complete · dashboard saved.';showCheckpoints().catch(e=>{$('status').textContent=e.message;});},progress);return harness;},aiToolDisplay:{inspect_market:{label:()=>({text:'Read and check warehouse evidence'})},design_dashboard:{label:()=>({text:'Design views from the analyst brief'})},apply_dashboard:{label:()=>({text:'Validate and save the noticeboard'})}}});
  });
  $('day-badge').textContent='Day '+snapshot.cutoff;$('status').textContent=`${snapshot.summary.orders.toLocaleString()} observed orders · ${snapshot.summary.modelFits} local model fits · USD · includes warmup`;
  const locationState=new URL(location.href);locationState.searchParams.set('run',runId);locationState.searchParams.set('day',snapshot.cutoff);history.replaceState(null,'',locationState);
  $('town').href='/behavior-lab.html?run='+runId;$('snapshot-id').textContent=snapshot.id;$('audit-link').href='/api/market/studio/steps?run='+runId;
  $('report-title').textContent=saved.title||'What’s happening in the market?';await showCheckpoints();
  if(!restored)await post('save',{runId,cutoff:snapshot.cutoff,snapshotId:snapshot.id,state:api.getState()});
 }catch(e){$('status').textContent=e.message;}finally{for(const id of ['load','assistant','save','undo','edit','restore'])$(id).disabled=false;}
}
$('load').onclick=()=>{if(harness?.threads.some(t=>harness.getSession?.(t.id)?.status==='running')){$('status').textContent='Finish or cancel the active review before changing its snapshot.';return;}load();};
$('edit').onchange=()=>api?.setProperty('mode',$('edit').checked?'edit':'view');
$('save').onclick=async()=>{try{await post('save',{runId,cutoff:snapshot.cutoff,snapshotId:snapshot.id,state:api.getState()});$('status').textContent='Layout saved for this exact snapshot.';}catch(e){$('status').textContent=e.message;}};
$('restore').onclick=async()=>{const button=$('restore');button.disabled=true;try{const steps=await getJSON('/api/market/studio/steps?run='+encodeURIComponent(runId)),proposal=steps.filter(s=>s.role==='designer'&&s.status==='COMPLETED'&&s.snapshot_id===snapshot.id).at(-1);progress('guard','working');const result=await applyCheckedDesign(api,snapshot,proposal,steps);$('report-title').textContent=result.title;$('status').textContent='Checked team view restored · no model call.';await showCheckpoints();}catch(e){progress('guard','failed');$('status').textContent=e.message;}finally{button.disabled=false;}};
$('undo').onclick=()=>api?.undo();$('assistant').onclick=()=>{if(!api)return;$('edit').checked=true;api.setProperty('mode','edit');const s=api.getState();api.setState({...s,panels:{...s.panels,ai:{collapsed:false}}});};
try{const params=new URL(location.href).searchParams,index=await getJSON('/data/owned-demo-index.json');runId=params.get('run')||index.runId;$('day').value=params.get('day')||'60';await load();}catch(e){$('status').textContent=e.message;}

const $=id=>document.getElementById(id),money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n/1e6);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={fixed_workflow:'Fixed conditional workflow',gather_all:'Gather all sources',cost_aware_script:'Cost-aware script',abstain_control:'Always-escalate control'};
let report=null,selectedCase=null,selectedController='fixed_workflow';
async function api(path,input){
  const response=await fetch('/api/benchmarks/'+path,input?{method:'POST',headers:{'Content-Type':'application/json','X-Supply-Yard':'sandbox'},body:JSON.stringify(input)}:{});
  const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'Benchmark request failed.');return body;
}
function accept(next){
  report=next;selectedCase=report?.trials.find(t=>t.family==='mixed_pallet_partial_order')?.caseId??report?.trials[0]?.caseId??null;selectedController=report?.config.controllers[0]??'fixed_workflow';
  if(report){
    $('split').value=report.config.split;
    const calls=String(report.config.limits.maxCalls);
    if(![...$('calls').options].some(o=>o.value===calls))$('calls').add(new Option(calls+' calls (saved run)',calls));
    $('calls').value=calls;$('budget').value=(report.config.limits.maxCostMicros/1e6).toFixed(2);
    $('abstain').checked=report.config.controllers.includes('abstain_control');
  }
  render();
}
$('run-form').addEventListener('submit',async event=>{
  event.preventDefault();$('run').disabled=true;$('error').textContent='';$('status').textContent='Running isolated scripted trials…';
  const controllers=['fixed_workflow','gather_all','cost_aware_script'];if($('abstain').checked)controllers.push('abstain_control');
  try{const result=await api('run',{split:$('split').value,controllers,limits:{maxCalls:Number($('calls').value),maxCostMicros:Math.round(Number($('budget').value)*1e6)}});accept(result.report);}
  catch(error){$('error').textContent=error.message;$('status').textContent='Run failed. Prior results remain visible.';}
  finally{$('run').disabled=false;}
});
$('case-select').addEventListener('change',()=>{selectedCase=$('case-select').value;renderTrace();});
$('controller-select').addEventListener('change',()=>{selectedController=$('controller-select').value;renderTrace();});
$('export').addEventListener('click',()=>{
  if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download='supply-yard-benchmark-'+report.runKey.slice(0,12)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function render(){
  if(!report){$('status').textContent='No local benchmark run yet. Start the scripted baseline suite.';return;}
  $('status').textContent='Completed '+report.trials.length+' scripted trials. No LLM or payment was called.';
  $('counts').textContent=new Set(report.trials.map(t=>t.caseId)).size+' / '+report.trials.length;
  $('matches').textContent=report.inputAudit.filter(a=>a.matched).length+'/'+report.inputAudit.length+' matched';
  $('version').textContent=report.suite.version;$('export').disabled=false;
  $('results').innerHTML=report.byController.map(r=>'<tr><th>'+escape(names[r.id]||r.id)+'</th><td>'+r.correctReady+'/'+r.trials+'</td><td class="'+(r.unsupportedReady?'negative':'')+'">'+r.unsupportedReady+'</td><td>'+r.correctEscalations+'</td><td>'+r.unnecessaryEscalations+'</td><td>'+r.missedMaterialFindings+'</td><td>'+r.toolCalls+'</td><td>'+money(r.assumedToolCostMicros)+'</td></tr>').join('');
  $('families').innerHTML=report.byFamily.map(r=>'<tr><th>'+escape(names[r.id]||r.id)+'<small>'+escape(r.family.replaceAll('_',' '))+'</small></th><td>'+r.trials+'</td><td>'+r.correctReady+'</td><td>'+r.unsupportedReady+'</td><td>'+r.unnecessaryEscalations+'</td><td>'+r.budgetLimited+'</td><td>'+money(r.assumedToolCostMicros)+'</td></tr>').join('');
  const cases=[...new Map(report.trials.map(t=>[t.caseId,t])).values()];
  $('case-select').innerHTML=cases.map(t=>'<option value="'+escape(t.caseId)+'">'+escape(t.caseId.slice(0,13)+' · '+t.family.replaceAll('_',' '))+'</option>').join('');
  $('case-select').value=selectedCase;
  $('controller-select').innerHTML=report.config.controllers.map(id=>'<option value="'+escape(id)+'">'+escape(names[id]||id)+'</option>').join('');$('controller-select').value=selectedController;
  $('audit').innerHTML='<p><b>'+escape(report.freezeCheck||'Manifest check not recorded')+'</b> · '+escape(report.config.split)+' split · seed '+report.config.seed+'</p><p>Per-case budget: '+report.config.limits.maxCalls+' calls; '+money(report.config.limits.maxCostMicros)+' assumed query cost.</p><p>Fixture SHA-256: <code>'+escape(report.suite.digest)+'</code></p><p>Implementation SHA-256: <code>'+escape(report.implementationHash)+'</code></p><p>'+escape(report.suite.normalization)+'</p><ul>'+report.suite.tools.map(t=>'<li>'+escape(t.name)+': '+money(t.costMicros)+' assumed per call; '+t.latencyMs+' ms simulated latency.</li>').join('')+'</ul>';
  $('benefit').textContent='PayPal benefit: '+report.benefit.status.replaceAll('_',' ')+'. '+report.benefit.reason;
  renderTrace();
}
function documentBlock(d,expanded=false){return '<details class="evidence-document"'+(expanded?' open':'')+'><summary>'+escape(d.title)+' · '+escape(d.actor)+'</summary><p class="document-meta">'+escape(d.id)+' · '+escape(d.asOf)+'</p><blockquote>'+escape(d.text)+'</blockquote><details><summary>Authored normalized claims</summary><pre>'+escape(JSON.stringify(d.normalized,null,2))+'</pre></details></details>';}
function renderTrace(){
  if(!report)return;
  const t=report.trials.find(t=>t.caseId===selectedCase&&t.controller.id===selectedController);if(!t)return;
  $('packet').innerHTML='<p>'+escape(t.case.objective)+'</p><p><b>'+escape(t.case.order.id)+'</b> · '+t.case.order.units+' paid kits · '+escape(t.split)+'</p><p>Questions: '+escape(t.case.questions.join(', '))+'</p>'+t.observedEvidence.filter(d=>t.initialEvidenceIds.includes(d.id)).map(d=>documentBlock(d,true)).join('');
  $('trace').innerHTML=t.history.map(h=>h.type==='tool'?'<li><b>'+escape(h.tool)+'</b><p>'+escape(h.reason)+'</p><small>'+money(h.costMicros)+' assumed · '+escape(h.response.status)+'</small>'+((h.response.documents||[]).map(d=>documentBlock(d)).join('')||'<p>'+escape(h.response.message)+'</p>')+'</li>':'<li><b>'+escape(h.type==='finish'?'Stop: '+h.stopReason:h.type)+'</b><p>'+escape(h.result?.status||h.error||'')+'</p></li>').join('');
  const g=t.grade;
  $('grade').innerHTML='<p class="grade-verdict">'+(g.correctReady?'Ready packet supported':g.correctEscalation?'Escalation appropriate':g.budgetLimited?'Budget-limited case':'Review required')+'</p><dl>'+[['Unsupported ready',g.unsupportedReady?'Yes':'No'],['Unnecessary escalation',g.unnecessaryEscalation?'Yes':'No'],['Missed findings',g.missedFindings.length],['Unsupported facts',g.unsupportedAnswers.length+g.unsupportedFindings.length],['Tool calls',t.metrics.toolCalls],['Assumed query cost',money(t.cost.assumedToolCostMicros)],['Human cost','Unmeasured']].map(([k,v])=>'<div><dt>'+escape(k)+'</dt><dd>'+escape(v)+'</dd></div>').join('')+'</dl><details open><summary>Submitted review packet</summary><pre>'+escape(JSON.stringify(t.result,null,2))+'</pre></details><p class="accounting-note">'+escape(g.disclosure)+'</p>';
}
api('latest').then(data=>accept(data.report)).catch(error=>{$('error').textContent=error.message;$('status').textContent='Start the local server with npm run dev to use the lab.';});

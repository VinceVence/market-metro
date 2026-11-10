import {api,esc} from '../garden/ui.mjs';
import {LIGHT_THEME} from './theme.mjs';
import {studioWidgets} from './widgets.mjs';
import {investigationHarness,cohortQuery,COHORT_COLUMNS} from './investigation-harness.mjs';

const $=id=>document.getElementById(id),money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
let catalog,example,studio,harness,runContext,record=null,tools=[],busy=false,replay=false;
const selected=()=>[...document.querySelectorAll('[data-merchant]:checked')].map(x=>x.value);
function source(id,rows,columns){return {id,name:id.replaceAll('_',' '),data:rows,fields:columns.map(key=>({id:key,name:key.replace(/USD$/,' (USD)').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase()),format:['id','merchant','category','policy'].includes(key)?'textFormat':key==='refundShare'?'percentageFormat':key.endsWith('USD')?'decimalFormat':'integerFormat'}))};}
function dataSources(result){return [source('merchants',catalog.merchants,COHORT_COLUMNS),source('verified',result?.cohort.rows||catalog.merchants,COHORT_COLUMNS),source('grain',[{checkouts:result?.cohort.checkouts||0,merchantOrders:result?.cohort.merchantOrders||0}],['checkouts','merchantOrders']),source('reference',catalog.reference,['policy','paypalUSD','merchantUSD','purchases']),source('summary',[{verifiedCaptures:catalog.receipt?1:0}],['verifiedCaptures'])];}
const field=(id,aggregation)=>({id,...(aggregation?{aggregation}:{})});
const title=text=>({title:{text,enabled:true}});
function widget(id){switch(id){
 case 'cohort_sales':return {type:'bar-chart-grouped',format:title('Retained sales · selected merchants'),dataMapping:{categoryKey:[field('verified.merchant')],valueKey:[field('verified.retainedUSD','sum')]}};
 case 'cohort_refunds':return {type:'bar-chart-grouped',format:title('Observed refunds · selected merchants'),dataMapping:{categoryKey:[field('verified.merchant')],valueKey:[field('verified.refundUSD','sum')]}};
 case 'cohort_ledger':return {type:'grid',format:title('Merchant cohort · verified source rows'),dataMapping:{cols:['merchant','category','merchantOrders','grossUSD','refundUSD','retainedUSD'].map(k=>field('verified.'+k))}};
 case 'checkout_grain':return {type:'value',format:title('Unique shopper checkouts · certified cohort'),dataMapping:{value:[field('grain.checkouts','sum')]}};
 case 'reference_impact':return {type:'bar-chart-grouped',format:title('Reference campaign · whole-market PayPal net'),dataMapping:{categoryKey:[field('reference.policy')],valueKey:[field('reference.paypalUSD','sum')]}};
 case 'payment_evidence':return {type:'payment-evidence',format:title('PayPal receipt · whole-market integration proof'),dataMapping:{value:[field('summary.verifiedCaptures','sum')]}};
 default:throw Error('Unapproved view');
}}
function layout(ids){const widgets={},widgetLayout={},mobile=innerWidth<700;let y=0,column=0,rowHeight=0;
 ids.forEach(id=>{widgets[id]=widget(id);const full=id==='cohort_ledger'||mobile,height=id==='cohort_ledger'?22:18;
  if(full&&column){y+=rowHeight;column=0;rowHeight=0;}
  widgetLayout[id]={xTrack:full?0:column*12,yTrack:y,xSpan:full?24:12,ySpan:height};
  if(full)y+=height;else if(column){y+=Math.max(rowHeight,height);column=0;rowHeight=0;}else{column=1;rowHeight=height;}
 });
 return {version:'3.0.0',selectedPageId:'investigation',pages:[{id:'investigation',widgets,widgetLayout,layout:{columns:24,rowHeight:17,minWidth:300,pagePadding:14,widgetPadding:20,widgetBorderEnabled:true,widgetBorderColor:'#dce6ef',widgetBorderRadius:10,widgetBackgroundColor:'#fff',backgroundColor:'#f6f8fb'}}],panels:{ai:{collapsed:true},filters:{collapsed:true}}};
}
function message(heading,body,status='working'){ $('run-message').innerHTML=`<span class="message-orbit">${status==='verified'?'✓':status==='held'?'!':'✦'}</span><div><b>${esc(heading)}</b><p>${esc(body)}</p></div>`;$('run-status').textContent=status==='verified'?'Verified':status==='held'?'Held':status==='working'?'Working':'Ready';$('run-status').className='run-status '+status;}
function step(name){const stages=['plan','query','verify','publish'],i=stages.indexOf(name);document.querySelectorAll('[data-stage]').forEach(el=>{const n=stages.indexOf(el.dataset.stage);el.classList.toggle('active',n===i);el.classList.toggle('done',n<i);});}
function drawTools(){ $('tool-count').textContent=tools.filter(t=>t.status!=='running').length+' completed';$('tool-log').innerHTML=tools.map((t,i)=>`<button data-tool="${i}"><span>${esc(t.name)}</span><span>${esc(t.status)} ↗</span></button>`).join('');document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{const t=tools[Number(b.dataset.tool)];$('trace-title').textContent=t.name;$('trace-body').textContent=JSON.stringify(t,null,2);$('trace-detail').showModal();});}
function progress(type,event){
 if(type==='tool'){if(event.status==='running')tools.push(event);else{const i=tools.findLastIndex(t=>t.name===event.name&&t.status==='running');if(i>=0)tools[i]=event;else tools.push(event);}drawTools();return;}
 if(type==='planned'){replay=Boolean(event.replay);step('query');$('cohort-summary').textContent=event.cohort.rows.length+' merchants chosen by the planner';message('The planner chose a cohort.',event.choice.rationale);}
 if(type==='queried'){step('verify');message('Studio returned '+event.length+' merchant rows.','The ontology now checks those values against the original warehouse and reconciles split checkouts.');}
 if(type==='verified'){step('publish');$('gate').hidden=false;$('gate').className='gate';$('gate').textContent=`✓ ${event.cohort.checkouts.toLocaleString()} checkouts · ${event.cohort.merchantOrders.toLocaleString()} merchant orders · source reconciled · no payment actions`;
  $('verified-insights').hidden=false;$('verified-insights').innerHTML=event.insights.map(f=>`<article class="insight"><small>Verified · ${esc(f.kind)}</small><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></article>`).join('');message('Evidence passed. Building the views.',event.proposal.rationale);}
 if(type==='published'){document.querySelectorAll('[data-stage]').forEach(el=>{el.classList.remove('active');el.classList.add('done');});message('Your verified dashboard is ready.',`${event.cohort.rows.length} merchants investigated. ${event.proposal.widgets.length} views published. ${replay?'Saved Gemini decisions replayed; Studio queries and checks ran again.':'Two fresh Gemini decisions. Estimated inference '+'$'+event.costUSD.toFixed(6)+'.'}`,'verified');$('run-message').querySelector('div').insertAdjacentHTML('beforeend','<a class="view-published" href="#agent-canvas">See the published dashboard ↓</a>');}
 if(type==='hold'||type==='error'){message('Held — no dashboard published.',event.reason||event.message,'held');$('gate').hidden=false;$('gate').className='gate held';$('gate').textContent=event.reason||event.message;}
}
const canInvestigate=()=>!busy&&($('mapping').value==='ambiguous'||catalog?.budget.enabled&&catalog.budget.remainingCalls>=2);
$('mapping').onchange=()=>{$('investigate').disabled=!canInvestigate();};
function finish(){busy=false;$('investigate').disabled=!canInvestigate();$('replay').disabled=!example;void refreshBudget();}
async function refreshBudget(){try{const d=await api('/api/market/studio-investigation/catalog');catalog.budget=d.budget;$('connection').textContent=d.budget.enabled&&d.budget.remainingCalls>=2?'● Live Gemini connected':'● Recorded investigation available';$('budget-note').textContent=`Shared feature allowance: $0.25 total · ${d.budget.remainingUSD==null?'No fresh calls':('$'+d.budget.remainingUSD.toFixed(4)+' remaining')}. Payments stay disabled.`;if(!busy)$('investigate').disabled=!canInvestigate();}catch{}}
function selectionChanged(){ $('cohort-summary').textContent=selected().length+' merchants selected';}
async function run(useReplay=false){if(busy)return;replay=useReplay;if(replay&&!example)return;if(replay){$('mapping').value='confirmed';$('question').value=example.plan.question;}if(!replay&&!selected().length){message('Select at least one merchant.','Choose the cohort to investigate.','held');return;}
 runContext={question:replay?example.plan.question:$('question').value,merchantIds:selected(),mapping:$('mapping').value,replay,example};busy=true;record=null;tools=[];drawTools();$('investigate').disabled=true;$('replay').disabled=true;$('download-trace').disabled=true;$('verified-insights').hidden=true;$('gate').hidden=true;step('plan');message(replay?'Replaying the verified investigation.':'The planner is reading the market.','Its query selection will appear here. Native Studio tools own execution.');
 if(innerWidth<900)document.querySelector('.investigation-panel').scrollIntoView({behavior:'smooth',block:'start'});
 const session=await harness.createThread({agentId:'commerce_planner',title:replay?'Recorded cohort investigation':'Merchant cohort investigation'});session.sendMessage(replay?example.plan.question:$('question').value);
}
$('investigate').onclick=()=>void run().catch(e=>{progress('error',{message:e.message});finish();});$('replay').onclick=()=>void run(true).catch(e=>{progress('error',{message:e.message});finish();});
$('close-trace').onclick=()=>$('trace-detail').close();$('arrange').onchange=()=>studio?.setProperty('mode',$('arrange').checked?'edit':'view');
$('native-chat').onclick=()=>{const s=studio.getState();studio.setState({...s,panels:{...s.panels,ai:{collapsed:false}}});};
$('download-trace').onclick=()=>{if(!record)return;const blob=new Blob([JSON.stringify({...record,nativeTools:tools},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=record.result.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('verify-query').onclick=async()=>{try{const tool=studio.getAiTools().executeQuery(),result=await tool.execute({name:tool.name,toolCallId:crypto.randomUUID(),args:cohortQuery(selected())},agStudio.createAiToolContext());$('trace-title').textContent='Native AG Studio execute_query';$('trace-body').textContent=JSON.stringify(result,null,2);$('trace-detail').showModal();}catch(e){progress('error',{message:e.message});}};
document.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-merchant]').forEach(x=>x.checked=b.dataset.select==='all');selectionChanged();});
const prompts={refunds:'Which merchants deserve a closer look because refunds are eroding sales? Show the evidence and keep PayPal payment proof separate.',sales:'Which merchants lead retained sales? Build a focused review and explain which totals are observed versus matched campaign results.',lineage:'Investigate split checkouts. Show why merchant order counts differ from purchases and how the PayPal receipt fits without adding a sale.'};
document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>$('question').value=prompts[b.dataset.prompt]);
try{
 [catalog,{example}]=await Promise.all([api('/api/market/studio-investigation/catalog'),api('/api/market/studio-investigation/example')]);
 $('merchant-list').innerHTML=catalog.merchants.map(m=>`<label><input type="checkbox" data-merchant value="${esc(m.id)}" checked><span>${esc(m.merchant)}</span><small>${esc(m.category)}</small></label>`).join('');document.querySelectorAll('[data-merchant]').forEach(x=>x.onchange=selectionChanged);
 const options={data:{sources:dataSources()},initialState:layout(['cohort_sales','cohort_refunds','cohort_ledger']),mode:'view',widgets:defaults=>studioWidgets(defaults,{receipt:catalog.receipt}),theme:agStudio.studioTheme.withParams({...LIGHT_THEME,studioWidgetTitleFontSize:14,studioAiPanelWidth:330}),
  ai:({api:engine})=>{if(harness)return harness;harness=investigationHarness(engine,{settings:()=>runContext||({question:$('question').value,merchantIds:selected(),mapping:$('mapping').value,replay:false,example}),progress,
   publish:async result=>{const previous=engine.getState();try{engine.setProperty('data',{sources:dataSources(result)});engine.setState(layout(result.proposal.widgets));const actual=engine.getState().pages.find(p=>p.id==='investigation');if(result.proposal.widgets.some(id=>!actual?.widgets?.[id]))throw Error('Studio did not accept every verified view.');$('dashboard-title').textContent=result.proposal.title;$('dashboard-scope').textContent=result.cohort.scope;}catch(e){engine.setState(previous);throw e;}},
   save:value=>{record=value;$('download-trace').disabled=false;},finished:finish});return harness;},
  onErrorRaised(e){if(e.fatal)progress('error',{message:e.errorDetails.join(' ')});}};
 studio=agStudio.createStudioWithAi($('agent-canvas'),options);
 // The custom workspace starts runs before the optional native chat panel mounts.
 if(!harness)options.ai({api:studio});
 await refreshBudget();$('replay').disabled=!example;selectionChanged();
}catch(e){message('The workspace could not open.',e.message,'held');$('connection').textContent='Connection unavailable';}

import {esc,money,api,num} from '../garden/ui.mjs';
import {modelTrialTable} from './model-check.mjs';

const entities=[
  ['shoppers','Shoppers','commerce',90,85],['contacts','Outreach','commerce',290,85],
  ['checkouts','Checkouts','commerce',490,85],['orders','Merchant orders','commerce',690,85],
  ['payments','Payment ledger','commerce',890,85],['products','Products','commerce',290,250],
  ['definitions','Data contract','governance',490,250],['merchants','Merchants','commerce',690,250],
  ['receipts','PayPal Sandbox','governance',890,250],['campaigns','Campaign','learning',90,420],
  ['training','Training cases','learning',290,420],['models','Predictive model','learning',490,420],
  ['verifier','Verifier','governance',690,420]
];
const relations=[
  ['shoppers','contacts','receives'],['contacts','checkouts','may lead to'],['checkouts','orders','splits into'],
  ['orders','payments','records payment'],['products','contacts','recommended item'],['merchants','orders','fulfills'],
  ['orders','receipts','can be mirrored'],['definitions','checkouts','defines purchase grain'],
  ['definitions','training','defines eligible rows'],['contacts','training','mature outcomes'],
  ['training','models','eligible input'],['models','campaigns','ranks shoppers'],['campaigns','contacts','selects audience'],
  ['verifier','campaigns','checks publication'],['models','verifier','tested candidate']
];
const nodeNames=Object.fromEntries(entities.map(([id,label])=>[id,label]));
const phases=[['gate','Data contract'],['analysis','Analyze'],['training','Train'],['campaign','Plan'],['verification','Verify'],['launch','Launch']];
const toolTitles={choose_investigation:'Choose an investigation',define_dataset:'Choose the training data',
  choose_training_experiments:'Choose model experiments',train_ontology_model:'Select ontology features',
  compare_ontology_features:'Compare feature groups',select_trained_artifact:'Choose a trained model',
  propose_campaign_trial:'Propose a campaign',propose_campaign_revision:'Revise the campaign',finish_review:'Finish the review'};
const dollars=n=>(n>0?'+':'')+money(n*100);
function connection(from,to,a,b){
  const below=b==='campaigns';
  const dx=to.x-from.x,dy=to.y-from.y;
  const inset=Math.min(78/Math.max(1,Math.abs(dx)),32/Math.max(1,Math.abs(dy)));
  const start={x:from.x+dx*inset,y:from.y+dy*inset},end={x:to.x-dx*inset,y:to.y-dy*inset};
  if(below){const bend=a==='verifier'?510:480;return {path:`M${from.x},${from.y+32} C${from.x},${bend} ${to.x},${bend} ${to.x},${to.y+32}`,labelX:(from.x+to.x)/2,labelY:bend-15};}
  if(a==='contacts'&&b==='training')return {path:`M${start.x},${start.y} C170,190 170,315 ${end.x},${end.y}`,labelX:165,labelY:245};
  const midY=(start.y+end.y)/2;
  return {path:`M${start.x},${start.y} C${start.x},${midY} ${end.x},${midY} ${end.x},${end.y}`,labelX:(from.x+to.x)/2,labelY:midY-9};
}
const pairs=rows=>'<dl>'+rows.filter(([,v])=>v!==undefined&&v!==null).map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>').join('')+'</dl>';
const group=s=>{
  if(s.actor==='MERCHANT_FEED_GATE')return 'gate';
  if(['TRUSTED_PUBLISHER','SAVED_POLICY'].includes(s.actor))return 'launch';
  if(['LOCAL_CAMPAIGN_TRIAL','LOCAL_MODEL_COMPARISON','LOCAL_TRIAL_SETUP','TRUSTED_FALLBACK','REJECTED_REVISION'].includes(s.actor))return 'verification';
  if(s.actor==='LOCAL_ANALYSIS'||s.toolName==='choose_investigation')return 'analysis';
  if(['LOCAL_MODEL','LOCAL_TRAINING_TOOL','LOCAL_TRAINING_MAP','REUSED_EXPERIMENT'].includes(s.actor)||['define_dataset','choose_training_experiments','train_ontology_model','compare_ontology_features','select_trained_artifact'].includes(s.toolName))return 'training';
  return 'campaign';
};
const title=s=>toolTitles[s.toolName]??s.output?.title??s.actor.toLowerCase().replaceAll('_',' ');
const provenance=s=>s.actor==='GEMINI'?'LLM decision':s.actor==='SAVED_POLICY'?'Saved policy':'Local tool';

export function createRunInspector({ontology,workflow,detail,onNavigate}){
  let session=null,active=null,selected='definitions',selectedStep=null,selectedPhase='all',reference=null,useReference=false;
  let graphKey='',flowKey='',scale=1;
  const runCaption=()=>session?'Seed '+session.settings.seed+' · Day '+(session.clockPaused?session.reviewDay:session.day)+' · '+session.runId:'Choose a simulation to inspect';
  function empty(root){root.innerHTML='<div class="inspector-empty"><h2>Run a market to explore its evidence</h2><p>Choose a seed and scenario. This view will follow that run.</p><button class="primary" data-inspector-start>Run simulation</button></div>';}
  function facts(id){
    const o=session.ontology,c=o.counts,example=o.example,last=o.models.at(-1),ref=o.reference;
    const rows={
      shoppers:[['Simulated shoppers',c.shoppers],['Example customer',example?.shopper]],
      contacts:[['Product recommendations',c.recommendations],['Needs inquiries',c.inquiries],['Contact table','autonomy_contacts']],
      products:[['Catalog items',c.products],['Example basket',example?.products.join(', ')]],
      merchants:[['Merchants',c.merchants],['Example sellers',example?.orders.map(m=>m.merchant).join(', ')]],
      checkouts:[['Raw parent rows',c.checkouts],['Verified checkouts',o.mapping.metrics?.purchases??'Waiting for verification'],['Verified split checkouts',o.mapping.metrics?.splitBaskets],['Verified captured total',o.mapping.metrics?money(o.mapping.metrics.grossCents):null],['Example source key',example?.checkout]],
      orders:[['Merchant order portions',c.merchantOrders],...(example?.orders.map(m=>[m.merchant,money(m.grossCents)])??[])],
      payments:[['Modeled captures',c.merchantOrders],['Observed refunds',c.refunds],['Source','Simulated transaction ledger']],
      receipts:[['Completed native receipts',c.sandboxReceipts],['Receipt source','PayPal Sandbox'],...(o.receipts.flatMap(r=>[['Status',r.status],['Capture',r.captureId],['Warehouse order',r.orderId],['Gross',money(r.grossCents)],['Fee',r.feeCents==null?'Pending':money(r.feeCents)],['Merchant proceeds',r.netCents==null?'Pending':money(r.netCents)]]))],
      definitions:[['Current export',o.mapping.selection],['Verification',o.mapping.decision],['Checked in',o.mapping.checkpoint?'Recorded review':'Snapshot inspection'],['Checkout key',o.mapping.definition?.checkoutKey],['Merchant-order link',o.mapping.definition?.orderToCheckout]],
      training:[['Mature product contacts in this run',c.matureRecommendations],['Mature general inquiries',c.matureInquiries],['Minimum label delay',o.training.maturityDays+' days'],['Prediction target',o.training.target]],
      models:[['Fits in this run',c.trainedModels],['Latest fitted model',last?.id],['Training rows',last?.rows],['Training rows from this run',last?.ownRows],['Reference model',ref?.modelId],['Reference seed',ref?.seed]],
      campaigns:[['Applied campaigns',c.campaigns],['Current campaign',session.latestCampaign?.name]],
      verifier:[['Current review',o.mapping.held?'Waiting for a mapping':'Available'],['Authority','Deterministic checks'],['Fresh responses',session.modelCalls],['Model cost',money(session.costMicros/1e4)]]
    };
    const descriptions={shoppers:'Synthetic customers generate the purchases and observed interests used by the planner.',contacts:'Consented product recommendations and general inquiries are distinct training cases.',
      products:'A product recommendation names a catalog item. A general inquiry has no product attached.',merchants:'A merchant fulfills its own portion of a checkout.',
      checkouts:'Count the parent checkout once, including when several merchants fulfill it. These counts cover captured history through the selected day.',
      orders:'Each portion belongs to one merchant and one parent checkout. The portions must sum to the checkout gross.',
      payments:'The simulator records gross, fees and merchant proceeds. Refunds and settlement affect the final comparison.',
      receipts:'A native Sandbox capture can corroborate one existing merchant order. The selected run owns every receipt shown here.',
      definitions:o.mapping.reason??'Business definitions bind the physical checkout key, money units and merchant portions.',
      training:'These current-run outcomes are eligible labels. Each model record shows the training rows it actually used. General inquiries have a separate response and value model.',
      models:ref?'This run applies a model from the reference campaign. Its shopper scores respond to the new market.':'The planner requests local fits and selects a model after seeing validation results.',
      campaigns:'The active policy decides which consenting shoppers receive recommendations or needs inquiries.',
      verifier:o.execution==='saved'?'The merchant-feed gate checks this run. Financial approval belongs to the recorded reference campaign.':'Financial trials check PayPal contribution, merchant outcomes, purchases and settlement before publication.'};
    return {rows:rows[id],description:descriptions[id]};
  }
  function graphCounts(id){const c=session.ontology.counts;return ({shoppers:c.shoppers,contacts:c.contacts,products:c.products,merchants:c.merchants,
    checkouts:session.ontology.mapping.metrics?.purchases??(c.checkouts?'Unverified':0),orders:c.merchantOrders,payments:c.merchantOrders,receipts:c.sandboxReceipts,
    definitions:session.ontology.mapping.decision,training:c.matureRecommendations,models:session.ontology.reference?'Reference':c.trainedModels,
    campaigns:c.campaigns,verifier:session.ontology.mapping.held?'Held':'Checks'})[id];}
  function draw(recenter=true){
    if(!session?.ontology){empty(ontology);return;}
    const oldViewport=ontology.querySelector('.graph-viewport');
    const scroll=oldViewport?{left:oldViewport.scrollLeft,top:oldViewport.scrollTop}:null;
    const o=session.ontology,positions=Object.fromEntries(entities.map(([id,,kind,x,y])=>[id,{kind,x,y}]));
    ontology.innerHTML=`<header class="inspector-heading"><div><h2>Ontology graph</h2><p>${esc(runCaption())}</p></div><span class="run-tag">${o.execution==='saved'?'New market · saved policy':'Selected run'}</span></header>
      <div class="ontology-layout"><section class="ontology-map"><div class="graph-toolbar"><span>Click a node to inspect its evidence</span><div><button data-zoom="out" aria-label="Zoom out">−</button><button data-zoom="in" aria-label="Zoom in">+</button><button data-zoom="reset">Reset view</button></div></div>
      <div class="graph-viewport" tabindex="0" aria-label="Ontology graph. Drag the background to pan."><svg viewBox="0 0 1000 510" role="group" aria-label="Commerce and planning relationships"><defs><marker id="relation-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs>
      ${relations.map(([a,b,label])=>{const c=connection(positions[a],positions[b],a,b);
        return `<g data-relation="${a} ${b}" class="relation"><path d="${c.path}" marker-end="url(#relation-arrow)"/><text x="${c.labelX}" y="${c.labelY}">${esc(label)}</text></g>`;}).join('')}
      ${entities.map(([id,label,kind,x,y])=>`<g class="ontology-node ${kind} ${id==='definitions'&&o.mapping.decision==='HOLD'?'held':''}" data-node="${id}" role="button" tabindex="0" aria-label="${esc(label)}" transform="translate(${x},${y})"><rect x="-78" y="-32" width="156" height="64" rx="12"/><circle cx="-60" cy="-12" r="4"/><text class="node-name" y="-5">${esc(label)}</text><text class="node-count" y="17">${esc(graphCounts(id))}</text></g>`).join('')}
      </svg></div><footer class="graph-legend"><span class="commerce">Commerce</span><span class="learning">Learning</span><span class="governance">Definitions & checks</span><small>Drag to pan · + / − to zoom</small></footer></section><aside class="node-inspector" aria-live="polite"></aside></div>`;
    const viewport=ontology.querySelector('.graph-viewport'),svg=viewport.querySelector('svg');
    function zoom(){svg.style.width=Math.max(viewport.clientWidth,760)*scale+'px';}
    ontology.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{scale=b.dataset.zoom==='reset'?1:Math.max(.75,Math.min(2.5,scale+(b.dataset.zoom==='in'?.25:-.25)));zoom();});
    let drag;
    viewport.onpointerdown=e=>{if(e.target.closest('[data-node]'))return;drag={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);};
    viewport.onpointermove=e=>{if(drag){viewport.scrollLeft=drag.left+drag.x-e.clientX;viewport.scrollTop=drag.top+drag.y-e.clientY;}};
    viewport.onpointerup=viewport.onpointercancel=()=>{drag=null;};
    ontology.querySelectorAll('[data-node]').forEach(n=>{n.onclick=()=>select(n.dataset.node);n.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();select(n.dataset.node);}};});
    zoom();select(selected,recenter);if(scroll&&!recenter){viewport.scrollLeft=scroll.left;viewport.scrollTop=scroll.top;}
  }
  function select(id,recenter=true){
    selected=id;const nearby=new Set([id,...relations.filter(([a,b])=>a===id||b===id).flatMap(([a,b])=>[a,b])]);
    ontology.querySelectorAll('[data-node]').forEach(n=>{n.classList.toggle('selected',n.dataset.node===id);n.classList.toggle('dimmed',!nearby.has(n.dataset.node));});
    ontology.querySelectorAll('[data-relation]').forEach(e=>e.classList.toggle('connected',e.dataset.relation.split(' ').includes(id)));
    const o=session.ontology,f=facts(id),fields=o.models.at(-1)?.fields??o.reference?.fields??[];
    ontology.querySelector('.node-inspector').innerHTML=`<small>Observed through day ${o.day}</small><h3>${nodeNames[id]}</h3><p>${esc(f.description)}</p>${pairs(f.rows)}
      ${id==='models'?`<div class="feature-tags">${fields.map(name=>'<span>'+esc(name)+'</span>').join('')}</div><button data-open-workflow>Inspect planning and verification →</button>`:''}
      ${id==='training'?o.training.paths.map(p=>'<details><summary>'+esc(p.id)+' features</summary><p>'+esc(p.fields.join(', '))+'</p></details>').join(''):''}
      ${id==='definitions'&&session.feedHold?'<button class="primary" data-fix-mapping>Apply the merchant’s confirmed key</button>':''}
      ${id==='receipts'&&!o.receipts.length?'<a href="/judge.html#receipt">View the archived integration example ↗</a>':''}
      <h4>Associations</h4>${relations.filter(([a,b])=>a===id||b===id).map(([a,b,label])=>'<button class="association" data-related="'+(a===id?b:a)+'">'+esc(nodeNames[a]+' → '+label+' → '+nodeNames[b])+'</button>').join('')}`;
    ontology.querySelectorAll('[data-related]').forEach(b=>b.onclick=()=>select(b.dataset.related));
    ontology.querySelector('[data-open-workflow]')?.addEventListener('click',()=>onNavigate('workflow'));
    ontology.querySelector('[data-fix-mapping]')?.addEventListener('click',()=>document.getElementById('correct-feed').click());
    if(recenter){const viewport=ontology.querySelector('.graph-viewport'),svg=viewport.querySelector('svg'),node=entities.find(n=>n[0]===id);
      viewport.scrollLeft=node[3]*svg.clientWidth/1000-viewport.clientWidth/2;
      viewport.scrollTop=node[4]*svg.clientHeight/510-viewport.clientHeight/2;
    }
  }
  function visibleSteps(){
    if(!useReference)return session.steps;
    return reference.checkpoints.map((c,i)=>({...c,id:'reference-'+i,day:c.day+1,finishedDay:(c.completedDay??c.day)+1,
      status:c.status==='VALIDATED'?'COMPLETED':c.status==='STARTED'?'RUNNING':c.status,costMicros:(c.provider??[]).reduce((s,p)=>s+(p.modelCostMicros??0),0)}));
  }
  function showStep(step){
    selectedStep=step.id;
    const output=step.output??{},input=step.input??{},overview=input.overview??{},measurement=output.measurement;
    workflow.querySelectorAll('[data-step]').forEach(b=>b.classList.toggle('selected',b.dataset.step===selectedStep));
    workflow.querySelector('.workflow-inspector').innerHTML=`<small>${esc(provenance(step))} · ${useReference?'Reference ':''}Day ${step.day} · ${esc(step.status)}</small><h3>${esc(title(step))}</h3>
      <p>${esc(output.rationale??output.body??output.finding??step.error??'Waiting for the tool to finish.')}</p>
      ${pairs([['Observed through day',overview.day??input.observed?.asOfDay??input.throughDay],['Training window',output.windowDays?output.windowDays+' days':null],['Training rows',output.trainingRows??input.rows],['Recent contacts',overview.observedResponse?.contacts],['Model',output.modelId],['Decision',output.decision],['This step’s model cost',money((step.costMicros??0)/1e4)]])}
      ${output.features?'<h4>Requested features</h4><div class="feature-tags">'+output.features.map(f=>'<span>'+esc(f)+'</span>').join('')+'</div>':''}
      ${measurement?'<h4>Development trial versus fixed rules</h4>'+pairs([['PayPal net',dollars(measurement.platformDeltaUSD)],['Merchant contribution',dollars(measurement.retailerDeltaUSD)],['Retained purchases',measurement.purchaseDelta]]):''}
      ${step.actor==='LOCAL_MODEL_COMPARISON'?modelTrialTable(output):''}
      ${output.failedChecks?.length?'<h4>Failed checks</h4><p>'+esc(output.failedChecks.join(', '))+'</p>':''}
      <details><summary>Evidence supplied to this step</summary><pre>${esc(JSON.stringify(input,null,2))}</pre></details><details><summary>Recorded output and checks</summary><pre>${esc(JSON.stringify(output,null,2))}</pre></details>`;
  }
  function drawWorkflow(){
    if(!session){empty(workflow);return;}
    const steps=visibleSteps(),shown=steps.filter(s=>selectedPhase==='all'||group(s)===selectedPhase);
    workflow.innerHTML=`<header class="inspector-heading"><div><h2>Agent workflow</h2><p>${esc(runCaption())}</p></div><span class="run-tag">${useReference?'Reference review · seed '+reference.seed:session.settings.execution==='saved'?'Saved policy applied':'Selected run checkpoints'}</span></header>
      ${session.settings.execution==='saved'?`<div class="workflow-reference"><p>${useReference?'These recorded LLM decisions produced the policy used by your simulation.':'This run applies an existing policy. Its own data-contract checks appear below.'}</p><button id="reference-toggle">${useReference?'Return to this run':'View source planning and verification'}</button></div>`:''}
      <nav class="phase-tabs" aria-label="Workflow phases"><button data-phase="all" aria-pressed="${selectedPhase==='all'}">All steps</button>${phases.map(([id,label])=>'<button data-phase="'+id+'" aria-pressed="'+(selectedPhase===id)+'">'+label+' <small>'+steps.filter(s=>group(s)===id).length+'</small></button>').join('')}</nav>
      <div class="workflow-layout"><div class="workflow-list">${shown.map(s=>'<button class="workflow-item" data-step="'+esc(s.id)+'"><span class="workflow-kind">'+esc(provenance(s))+' · Day '+s.day+'</span><b>'+esc(title(s))+'</b><small class="state-'+s.status.toLowerCase()+'">'+esc(s.status)+'</small></button>').join('')||'<div class="inspector-empty"><h3>Collecting market evidence</h3><p>The first review begins on day 31. Current purchases continue to populate the warehouse.</p></div>'}</div><article class="workflow-inspector" aria-live="polite"></article></div>`;
    workflow.querySelectorAll('[data-phase]').forEach(b=>b.onclick=()=>{selectedPhase=b.dataset.phase;drawWorkflow();});
    workflow.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>showStep(steps.find(s=>s.id===b.dataset.step)));
    workflow.querySelector('#reference-toggle')?.addEventListener('click',async e=>{
      e.target.disabled=true;const sourceId=session.id;
      try{if(!reference)reference=await api('/api/market/ontology/reference');if(session.id!==sourceId)return;useReference=!useReference;selectedPhase='all';selectedStep=null;drawWorkflow();}
      catch(error){detail('Reference review unavailable','<p>'+esc(error.message)+'</p>');e.target.disabled=false;}
    });
    const chosen=shown.find(s=>s.id===selectedStep)??shown.at(-1);if(chosen)showStep(chosen);
  }
  for(const root of [ontology,workflow])root.addEventListener('click',e=>{if(e.target.closest('[data-inspector-start]'))document.getElementById('run').click();});
  return {
    update(next){const changed=session?.id!==next.id;session=next;if(changed){useReference=false;selectedStep=null;selectedPhase='all';graphKey='';flowKey='';}
      const g=next.id+':'+next.day+':'+next.ontology?.mapping.decision+':'+next.steps.length;
      const f=next.id+':'+JSON.stringify(next.steps.map(s=>[s.id,s.status]));
      if(active==='ontology'&&g!==graphKey){graphKey=g;draw(false);}
      if(active==='workflow'&&f!==flowKey){flowKey=f;drawWorkflow();}
    },
    show(view){active=view;if(view==='ontology')draw();if(view==='workflow')drawWorkflow();}
  };
}

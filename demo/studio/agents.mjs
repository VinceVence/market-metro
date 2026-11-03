import {compileDashboard,styleReport} from './widgets.mjs';
import {coverEvidence} from './coverage.mjs';
const request=async(path,body,signal)=>{const r=await fetch('/api/market/studio/'+path,{method:'POST',headers:{'content-type':'application/json','x-supply-yard':'sandbox'},body:JSON.stringify(body),signal}),j=await r.json();if(!r.ok||j.error)throw Error(j.error?.message||'Studio request failed');return j;};
export async function applyCheckedDesign(api,snapshot,proposal,steps,signal){
 const analysis=steps.find(s=>s.step_id===proposal?.parent_id);
 if(proposal?.role!=='designer'||proposal.status!=='COMPLETED'||proposal.snapshot_id!==snapshot.id||analysis?.status!=='COMPLETED'||analysis.snapshot_id!==snapshot.id)throw Error('Proposal does not match the current snapshot.');
 const coverage=coverEvidence(analysis.output,proposal.output.widgets),before=api.getState(),next=styleReport(compileDashboard(coverage.widgets,{previous:before,pageId:before.selectedPageId||'overview'}),{compact:innerWidth<780});
 next.panels.ai={collapsed:false};api.setState(next);
 try{const actual=api.getState(),page=actual.pages.find(p=>p.id===actual.selectedPageId);if(coverage.widgets.some(id=>!page?.widgets?.[id]))throw Error('Studio did not accept the complete widget plan.');
  const saved=await request('save',{runId:snapshot.runId,cutoff:snapshot.cutoff,snapshotId:snapshot.id,state:actual,sourceStep:proposal.step_id},signal);return {saved,...coverage,title:proposal.output.title};
 }catch(e){api.setState(before);throw e;}
}
export function marketHarness(api,getSnapshot,onApplied,onProgress=()=>{}){
 const applied=new Map();
 const textEvents=(id,text)=>[{type:'TEXT_MESSAGE_START',messageId:id,role:'assistant'},{type:'TEXT_MESSAGE_CONTENT',messageId:id,delta:text},{type:'TEXT_MESSAGE_END',messageId:id}];
 async function* execute(tool,args,input,ctx){const stage={inspect_market:'analyst',design_dashboard:'designer',apply_dashboard:'guard'}[tool.name];if(stage)onProgress(stage,'working');const callId=crypto.randomUUID();yield {type:'TOOL_CALL_START',toolCallId:callId,toolCallName:tool.name};yield {type:'TOOL_CALL_ARGS',toolCallId:callId,delta:JSON.stringify(args)};yield {type:'TOOL_CALL_END',toolCallId:callId};
  let result;try{result=await tool.execute({toolCallId:callId,name:tool.name,args},agStudio.createAiToolContext({signal:ctx.signal,run:{threadId:input.threadId,runId:input.runId}}));}catch(e){result={success:false,issues:[{message:e.message}]};}
  yield {type:'TOOL_CALL_RESULT',messageId:crypto.randomUUID(),toolCallId:callId,content:JSON.stringify(result),role:'tool'};if(stage)onProgress(stage,result.success?'done':'failed');if(!result.success)throw Error(result.issues?.map(i=>i.message).join(' ')||'Tool failed');return result;
 }
 const inspect=api.defineAiTool({name:'inspect_market',description:'Read a checked warehouse snapshot and let Gemini choose an analytical focus.',params:s=>s.object({question:s.string()}),execute:async(args,ctx)=>{const snapshot=getSnapshot(),r=await request('analyze',{requestId:ctx.run.runId,runId:snapshot.runId,cutoff:snapshot.cutoff,question:args.question},ctx.signal);return ctx.success('Analysis checkpoint saved.',{id:r.step_id,output:r.output,snapshotId:r.snapshot_id,costUSD:r.cost_micros/1e6});}});
 const design=api.defineAiTool({name:'design_dashboard',description:'Have the independent Gemini designer choose widgets from a completed analysis.',params:s=>s.object({analysisId:s.string()}),execute:async(args,ctx)=>{const r=await request('design',{requestId:ctx.run.runId,analysisId:args.analysisId},ctx.signal);return ctx.success('Dashboard proposal checkpoint saved.',{id:r.step_id,analysisId:args.analysisId,output:r.output,snapshotId:r.snapshot_id,costUSD:r.cost_micros/1e6});}});
 const apply=api.defineAiTool({name:'apply_dashboard',description:'Compile a validated dashboard proposal, apply it through AG Studio, and save a checkpoint. Never edits transaction data.',params:s=>s.object({proposalId:s.string()}),execute:async(args,ctx)=>{
  const snapshot=getSnapshot(),response=await fetch('/api/market/studio/steps?run='+encodeURIComponent(snapshot.runId),{signal:ctx.signal}),steps=await response.json(),proposal=steps.find(s=>s.step_id===args.proposalId);
  const result=await applyCheckedDesign(api,snapshot,proposal,steps,ctx.signal);applied.set(proposal.parent_id,result);onApplied?.(proposal.output.title);return ctx.success('Dashboard applied and persisted. Local coverage guard added: '+(result.added.join(', ')||'none'),{widgets:result.widgets,guardAdded:result.added,hash:result.saved.hash,snapshotId:snapshot.id});
 }});
 return agStudio.createAiHarness(api,({tools})=>({primary:'market_analyst',agents:[
  {id:'market_analyst',name:'Market analyst',description:'Investigates the observed market, then delegates the dashboard to a designer.',tools:()=>[inspect,tools.delegateTo(['dashboard_designer'])],run:async function*(input,ctx){yield {type:'RUN_STARTED',threadId:input.threadId,runId:input.runId};try{
   const question=[...input.messages].reverse().find(m=>m.role==='user')?.content||'Review campaign performance';
   const result=yield* execute(inspect,{question},input,ctx),a=result.data;for(const e of textEvents(crypto.randomUUID(),'Focus: '+a.output.focus+'. '+a.output.hypothesis+'\n\n'+a.output.rationale+'\n\nNext step: '+a.output.nextStep+'\n\nLimit: '+a.output.limitation))yield e;
   const delegate=ctx.tools().find(t=>t.name==='delegate_to');if(!delegate)throw Error('Designer delegation is unavailable.');
   yield* execute(delegate,{type:{id:'dashboard_designer',analysisId:a.id},instructions:'Create evidence-backed views for this saved market analysis. Use the checked snapshot and preserve data provenance.'},input,ctx);
   const done=applied.get(a.id);if(!done)throw Error('The designer did not save an applied dashboard.');for(const e of textEvents(crypto.randomUUID(),'Saved '+done.widgets.length+' widgets: '+done.title+'. The figures describe simulated commerce; they do not establish real-world uplift.'))yield e;
   yield {type:'RUN_FINISHED',threadId:input.threadId,runId:input.runId};
  }catch(e){yield {type:'RUN_ERROR',message:e.message};}}},
  {id:'dashboard_designer',name:'Dashboard designer',description:'Chooses and applies AG Studio widgets from a checked analyst brief.',schema:s=>s.object({analysisId:s.string()}),tools:()=>[design,apply],run:async function*(input,ctx){yield {type:'RUN_STARTED',threadId:input.threadId,runId:input.runId};try{
   if(!ctx.params?.analysisId)throw Error('Start with the Market analyst so the designer has a checked brief.');
   const result=yield* execute(design,{analysisId:ctx.params.analysisId},input,ctx);for(const e of textEvents(crypto.randomUUID(),result.data.output.rationale))yield e;
   const rendered=yield* execute(apply,{proposalId:result.data.id},input,ctx);
   if(ctx.completeTask)yield* execute(ctx.completeTask,{summary:'Applied and saved '+rendered.data.widgets.length+' validated widgets to the current AG Studio report.',artifacts:[{id:rendered.data.hash,type:'ag-studio-report',description:result.data.output.title}]},input,ctx);
   yield {type:'RUN_FINISHED',threadId:input.threadId,runId:input.runId};
  }catch(e){yield {type:'RUN_ERROR',message:e.message};}}}
 ],promptStarters:[{id:'campaign-review',label:'Review campaign performance',prompt:'Inspect this market’s sales, refunds and campaign costs, then build the most useful review dashboard.'},{id:'payment-review',label:'Show payment evidence',prompt:'Build a dashboard that separates simulated payment totals from verified PayPal Sandbox receipts and includes the order ledger.'}]}));
}

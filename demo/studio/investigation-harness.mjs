import {api as request} from '../garden/ui.mjs';

export const COHORT_COLUMNS=['id','merchant','category','grossUSD','refundUSD','merchantOrders','retainedUSD','refundShare'];
export function cohortQuery(ids){return {query:{kind:'apiQuery',variant:'projection',projection:COHORT_COLUMNS.map(id=>({field:{id:'merchants.'+id},as:id})),filter:{field:{id:'merchants.id'},operator:'isIn',value:ids}}};}

export function investigationHarness(studio,{settings,progress,publish,save,finished}){
 const investigations=new Map();
 const native=studio.getAiTools(),query=native.executeQuery();
 const tool=(name,description,params,execute)=>studio.defineAiTool({name,description,params,execute});
 const planTool=tool('plan_merchant_investigation','Ask the commerce planner which merchant cohort and evidence to investigate.',s=>s.object({question:s.string()}),async(args,ctx)=>{
  const input=settings(),replay=input.replay&&args.question===input.example?.plan.question;
  const plan={...(replay?input.example.plan:await request('/api/market/studio-investigation/plan',{requestId:ctx.run.runId,question:args.question,merchantIds:input.merchantIds,mapping:input.mapping})),replay};
  if(plan.status==='HELD'){progress('hold',plan);return ctx.error(plan.reason);}
  investigations.set(plan.id,{plan});
  progress('planned',plan);return ctx.success('Cohort chosen with a saved planning checkpoint.',plan);
 });
 const verify=tool('verify_cohort_insights','Reconcile the native Studio query with the ontology, then ask the insight designer which verified views answer the question.',s=>s.object({investigationId:s.string()}),async(args,ctx)=>{
  const record=investigations.get(args.investigationId),plan=record?.plan;if(!plan)throw Error('Investigation handoff does not match.');
  const result=await request('/api/market/studio-investigation/verify',{id:plan.id,rows:record.rows});record.result=result;
  if(result.status!=='VERIFIED')return ctx.error('The publication gate did not pass.');
  progress('verified',{...result,replay:plan.replay});return ctx.success('Cohort, facts, data grain and widget mappings verified.',result);
 });
 const apply=tool('publish_verified_views','Update the AG Studio dashboard with the approved views. This cannot change transactions, campaigns or payments.',s=>s.object({investigationId:s.string()}),async(args,ctx)=>{
  const record=investigations.get(args.investigationId),result=record?.result,plan=record?.plan;
  if(!result||result.status!=='VERIFIED'||args.investigationId!==result.id||result.sourceHash!==plan.sourceHash)throw Error('No matching verified publication.');
  await publish(result);save({plan:{...plan,studioRows:undefined},result});progress('published',result);
  return ctx.success('Verified dashboard applied through AG Studio.',{id:result.id,widgets:result.proposal.widgets,sourceHash:result.sourceHash});
 });
 async function* call(tool,args,input,ctx){
  const toolCallId=crypto.randomUUID();progress('tool',{name:tool.name,status:'running',args});
  yield {type:'TOOL_CALL_START',toolCallId,toolCallName:tool.name};yield {type:'TOOL_CALL_ARGS',toolCallId,delta:JSON.stringify(args)};yield {type:'TOOL_CALL_END',toolCallId};
  const out=await tool.execute({toolCallId,name:tool.name,args},agStudio.createAiToolContext({signal:ctx.signal,run:{threadId:input.threadId,runId:input.runId}}));
  yield {type:'TOOL_CALL_RESULT',messageId:crypto.randomUUID(),toolCallId,content:JSON.stringify(out),role:'tool'};
  progress('tool',{name:tool.name,status:out.success?'complete':'held',args,result:out});
  if(!out.success)throw Error(out.issues?.map(i=>i.message).join(' ')||'Tool did not pass.');return out;
 }
 function* say(text){const id=crypto.randomUUID();yield {type:'TEXT_MESSAGE_START',messageId:id,role:'assistant'};yield {type:'TEXT_MESSAGE_CONTENT',messageId:id,delta:text};yield {type:'TEXT_MESSAGE_END',messageId:id};}
 return agStudio.createAiHarness(studio,({tools})=>({primary:'commerce_planner',agents:[
  {id:'commerce_planner',name:'Commerce planner',description:'Chooses a merchant cohort, queries the native Studio data engine and delegates the verified publication.',tools:()=>[planTool,query,tools.delegateTo(['insight_editor'])],run:async function*(input,ctx){
   yield {type:'RUN_STARTED',threadId:input.threadId,runId:input.runId};
   try{
    const typed=[...input.messages].reverse().find(m=>m.role==='user')?.content,question=typeof typed==='string'?typed:settings().question;
    const planned=yield* call(planTool,{question},input,ctx),plan=planned.data;yield* say(plan.choice.rationale);
    const queried=yield* call(query,cohortQuery(plan.choice.merchantIds),input,ctx);investigations.get(plan.id).rows=queried.data.result;progress('queried',queried.data.result);
    const delegate=ctx.tools().find(t=>t.name==='delegate_to');if(!delegate)throw Error('Studio delegation is unavailable.');
    yield* call(delegate,{type:{id:'insight_editor',investigationId:plan.id},instructions:'Verify this cohort before publishing an evidence-backed dashboard. Keep whole-market benchmark and native receipt scopes separate.'},input,ctx);
    yield* say('The verified dashboard is ready. Open the evidence trail to inspect every tool call.');yield {type:'RUN_FINISHED',threadId:input.threadId,runId:input.runId};finished();
   }catch(e){progress('error',{message:e.message});yield {type:'RUN_ERROR',message:e.message};finished(e);}
  }},
  {id:'insight_editor',name:'Insight editor',description:'Checks the ontology, chooses grounded insight views and publishes through the deterministic gate.',schema:s=>s.object({investigationId:s.string()}),tools:()=>[verify,apply],run:async function*(input,ctx){
   yield {type:'RUN_STARTED',threadId:input.threadId,runId:input.runId};
   try{const checked=yield* call(verify,{investigationId:ctx.params.investigationId},input,ctx),result=checked.data;yield* say(result.proposal.rationale);yield* call(apply,{investigationId:result.id},input,ctx);
    if(ctx.completeTask)yield* call(ctx.completeTask,{summary:'Verified cohort insights published. The frozen economy and payment records were not modified.',artifacts:[{id:result.id,type:'verified-dashboard',description:result.proposal.title}]},input,ctx);
    yield {type:'RUN_FINISHED',threadId:input.threadId,runId:input.runId};
   }catch(e){yield {type:'RUN_ERROR',message:e.message};}
  }}],promptStarters:[{id:'merchant-review',label:'Investigate this cohort',prompt:'Investigate the selected merchants and publish verified insights.'}]}));
}

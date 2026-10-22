import {analyzeEvidence,recommendation} from './analysis.mjs';

export const CONTROLLERS=Object.freeze([
  {id:'fixed_workflow',name:'Fixed conditional workflow',kind:'scripted',description:'Shared interpretation, fixed source priority, relevant branches and early stopping.'},
  {id:'gather_all',name:'Gather all available sources',kind:'scripted',description:'Calls every allowed source within budget, then applies the same interpretation.'},
  {id:'cost_aware_script',name:'Cost-aware scripted control',kind:'scripted',description:'Chooses the cheapest untried relevant source. A heuristic, not an LLM agent.'},
  {id:'abstain_control',name:'Always-escalate control',kind:'diagnostic',description:'Checks that escalating everything cannot earn useful completion.'}
]);

export function createController(id){
  if(id==='llm_investigator')throw new Error('LLM_NOT_IMPLEMENTED: this benchmark currently has no model adapter.');
  const meta=CONTROLLERS.find(c=>c.id===id);if(!meta)throw new Error('Unknown controller.');
  return {meta:{...meta,version:'1'},async chooseNext(observation){
    const analysis=analyzeEvidence(observation);
    if(id==='abstain_control')return {type:'finish',result:{status:'escalate',answers:{},findings:[],unresolvedQuestions:observation.case.questions,summary:'Diagnostic blanket escalation.'}};
    const tried=new Set(observation.history.filter(h=>h.type==='tool').map(h=>h.tool));
    let candidates=observation.tools.filter(t=>!tried.has(t.name));
    if(id!=='gather_all'){
      if(!analysis.missing.length)return {type:'finish',result:recommendation(analysis)};
      candidates=candidates.filter(t=>analysis.candidates.includes(t.name));
    }
    candidates=candidates.filter(t=>t.costMicros<=observation.budget.remainingCostMicros);
    if(id==='cost_aware_script')candidates.sort((a,b)=>a.costMicros-b.costMicros||a.name.localeCompare(b.name));
    if(!candidates.length||observation.budget.remainingCalls===0)return {type:'finish',result:recommendation(analysis)};
    const next=candidates[0];
    return {type:'tool',tool:next.name,args:{orderId:observation.case.order.id},reason:id==='cost_aware_script'?'Lowest posted cost among relevant untried sources.':'Next permitted source under the fixed workflow priority.'};
  }};
}

// Reuse the frozen three-role workflow without changing its historical benchmark.
// The adapter adds explicit after-inference economics, handoffs and final guards.
import {createHash} from 'node:crypto';
import {createPolicyLab} from '../policy-lab/service.mjs';
import {openCampaignVertex} from '../marketing/autonomous-planner.mjs';
import {WorkflowError} from '../marketing/workflow.mjs';

const ROLES=['Growth investigator','Experiment scientist','Outcome reviewer'];
export function meshEconomics(snapshot){
  if(!Number.isSafeInteger(snapshot.modelCostMicros)||snapshot.modelCostMicros<0)throw Error('INVALID_MODEL_COST');
  const rows=snapshot.branches.map(b=>{
    const inferenceMicros=b.branch==='mesh'?snapshot.modelCostMicros:0,net=b.platformProxyCents*10000-inferenceMicros;
    if(!Number.isSafeInteger(net))throw Error('INVALID_ECONOMIC_TOTAL');
    return {...b,inferenceUSD:inferenceMicros/1e6,platformAfterInferenceMicros:net,platformAfterInferenceUSD:net/1e6};
  });
  const control=rows.find(b=>b.branch==='organic');for(const row of rows)row.deltaAfterInferenceUSD=(row.platformAfterInferenceMicros-control.platformAfterInferenceMicros)/1e6;
  const complete=snapshot.clock==='COMPLETE'&&rows.every(b=>b.matureObservations===b.decisions);
  const mesh=rows.find(b=>b.branch==='mesh'),others=rows.filter(b=>b.branch!=='mesh');
  const winners=complete?rows.filter(b=>b.platformAfterInferenceMicros===Math.max(...rows.map(r=>r.platformAfterInferenceMicros))).map(b=>b.branch):[];
  return {complete,rows,winners,winner:winners.length===1?winners[0]:complete?'tie':null,
    agentExceedsBothControls:complete&&others.every(b=>mesh.platformAfterInferenceMicros>b.platformAfterInferenceMicros),
    scope:'ONE_SEED_LIVE_SIMULATION',disclosure:'Same initial seed, catalog and shocks; each policy observes its own resulting history. Actual model latency affects publication. This live comparison is not the frozen identical-evidence benchmark and cannot establish repeatable agent superiority.'};
}
export function meshHandoffs(checkpoints){
  const groups=new Map();for(const c of checkpoints){if(!c.review_no||c.checkpoint_id.includes('-FINAL-'))continue;const list=groups.get(c.review_no)||[];list.push(c);groups.set(c.review_no,list);}
  return [...groups].map(([review,rows])=>{
    const last=role=>rows.filter(c=>c.role===role&&c.status==='COMPLETED').at(-1),analyst=last(ROLES[0]),scientist=last(ROLES[1]),critic=last(ROLES[2]),execution=last('Policy executor');
    return {review,asOfDay:analyst?.input?.packet?.asOfDay??rows[0]?.day,analyst:analyst?.output||null,proposal:scientist?.output||null,reviewer:critic?.output||null,execution:execution?.output||null,
      proposalCheckpoint:scientist?.checkpoint_id||null,reviewCheckpoint:critic?.checkpoint_id||null,
      errors:rows.filter(c=>c.status==='FAILED').map(c=>({role:c.role,error:c.output?.error}))};
  });
}
export function createAgentMesh({store,market,clientFactory=openCampaignVertex,autoTimers=true}){
  store.db.exec(`CREATE TABLE IF NOT EXISTS agent_mesh_review_audits(case_id TEXT PRIMARY KEY,run_id TEXT REFERENCES simulation_runs(run_id),input_hash TEXT,response_json TEXT,verdict_json TEXT,created_at TEXT);`);
  const clocks=new Map(),finals=new Map();
  const factory=async id=>{
    const resource=await clientFactory(id),client=resource.client;
    return {...resource,client:{...client,events:client.events,async json(system,packet,options){
      const response=await client.json(system,packet,options);
      if(options.functions?.[0]?.name==='close_experiment'){
        const event=client.events.at(-1),cost=packet.modelCostMicros+(event?.modelCostMicros??event?.reservedMicros??30000);
        const economics=meshEconomics({clock:'COMPLETE',branches:packet.branches,modelCostMicros:cost});
        const accepted=response?.args?.decision!=='retain_agent_policy'||economics.agentExceedsBothControls;
        store.db.prepare('INSERT OR IGNORE INTO agent_mesh_review_audits VALUES(?,?,?,?,?,?)').run(options.caseId,id,createHash('sha256').update(JSON.stringify({system,packet,functions:options.functions})).digest('hex'),JSON.stringify(response),JSON.stringify({accepted,afterInference:economics,countsCurrentCallCost:true}),new Date().toISOString());
        if(!accepted)throw new WorkflowError(409,'INVALID_FINAL_REVIEW','The agent policy does not exceed both controls after inference costs. Its original recommendation is preserved in the mesh audit.');
      }
      return response;
    }}};
  };
  // One shared clock keeps shopping live. Final inference waits for pending team
  // work so two provider sessions cannot contend for the single-writer ledger.
  const lab=createPolicyLab({store,market,clientFactory:factory,autoTimers:false});
  function snapshot(id){
    const s=lab.snapshot(id),catalog=store.db.prepare('SELECT source,COUNT(*) products,COUNT(DISTINCT channel3_product_id) channel3Listings FROM products WHERE run_id=? GROUP BY source').all(id);
    const audits=store.db.prepare('SELECT case_id,input_hash,response_json,verdict_json,created_at FROM agent_mesh_review_audits WHERE run_id=? ORDER BY created_at').all(id).map(({response_json,verdict_json,...r})=>({...r,response:JSON.parse(response_json),verdict:JSON.parse(verdict_json)}));
    return {...s,mesh:{version:'agent-mesh-integration-v1',roles:ROLES.map(role=>({role,calls:s.checkpoints.filter(c=>c.role===role&&c.actor==='GEMINI_3_1_FLASH_LITE').length})),
      orchestration:'Code-owned checkpoint graph; model-owned investigation, campaign proposal and review decisions.',numericWorker:'Local ridge reward regression; sequential RL experiments are not used by this demo.',
      catalog,receipts:{current:s.receipts.length,hasPriorReference:Boolean(s.referenceReceipt),countsReferenceAsCurrentSale:false},handoffs:meshHandoffs(s.checkpoints),economics:meshEconomics(s),audits,closing:finals.has(id)}};
  }
  function stop(id){clearTimeout(clocks.get(id));clocks.delete(id);}
  function finish(id,allowFailedTeam=false){
    if(finals.has(id))return finals.get(id);
    const work=(async()=>{await lab.wait(id);const s=lab.snapshot(id);if(s.clock==='COMPLETE'&&(!s.lastError||allowFailedTeam))try{await lab.conclude(id);}catch{}return snapshot(id);})().finally(()=>finals.delete(id));finals.set(id,work);return work;
  }
  function schedule(id){
    if(!autoTimers||clocks.has(id)||lab.snapshot(id).clock!=='RUNNING')return;
    clocks.set(id,setTimeout(()=>{clocks.delete(id);try{const s=lab.tick(id);if(s.clock==='COMPLETE')void finish(id);else schedule(id);}catch{lab.control(id,{action:'pause'});}},lab.snapshot(id).settings.dayMs));
  }
  return {...lab,snapshot,
    start(input){const s=lab.start(input);return snapshot(s.runId);},
    control(id,input){
      if(input?.action==='conclude'){
        if(Object.keys(input).some(k=>k!=='action'))throw new WorkflowError(400,'INVALID_POLICY_CONTROL','Use only the declared action.');
        const s=lab.snapshot(id);if(s.day<s.totalDays)throw new WorkflowError(409,'OUTCOMES_NOT_MATURE','Wait for the complete outcome tail.');
        void finish(id,true);return snapshot(id);
      }
      lab.control(id,input);if(input.action==='pause')stop(id);if(input.action==='resume')schedule(id);return snapshot(id);
    },
    tick(id,options){lab.tick(id,options);return snapshot(id);},
    async wait(id){await lab.wait(id);await finals.get(id);return snapshot(id);},
    async close(){for(const id of clocks.keys()){stop(id);if(lab.snapshot(id).clock==='RUNNING')lab.control(id,{action:'pause'});}await lab.close();await Promise.allSettled([...finals.values()]);},
    recover(){lab.recover();}
  };
}

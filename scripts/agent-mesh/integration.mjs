// Reuse the frozen three-role workflow without changing its historical benchmark.
// The adapter adds explicit after-inference economics, handoffs and final guards.
import {createHash} from 'node:crypto';
import {createPolicyLab,validatePolicyDecision} from '../policy-lab/service.mjs';
import {openCampaignVertex} from '../marketing/autonomous-planner.mjs';
import {WorkflowError} from '../marketing/workflow.mjs';
import {GROUNDING_VERSION,GROUNDING_HASH,groundedRequest} from './grounding.mjs';
import {campaignPreflight,publicationCheck,saveHarnessCheckpoint,authorizePilot,enforcePilot,HARNESS_LIMITS,durableReleaseGate} from './harness.mjs';
import {openTeamVertex,TEAM_MODEL_ROUTES} from './model-client.mjs';

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
export function createAgentMesh({store,market,clientFactory,autoTimers=true}){
  store.db.exec(`CREATE TABLE IF NOT EXISTS agent_mesh_review_audits(case_id TEXT PRIMARY KEY,run_id TEXT REFERENCES simulation_runs(run_id),input_hash TEXT,response_json TEXT,verdict_json TEXT,created_at TEXT);`);
  store.db.exec(`CREATE TABLE IF NOT EXISTS agent_mesh_runs(run_id TEXT PRIMARY KEY REFERENCES simulation_runs(run_id),version TEXT,grounding_hash TEXT,created_at TEXT);`);
  if(!store.db.prepare('PRAGMA table_info(agent_mesh_runs)').all().some(c=>c.name==='model_route'))store.db.exec("ALTER TABLE agent_mesh_runs ADD COLUMN model_route TEXT NOT NULL DEFAULT 'lite'");
  const clocks=new Map(),finals=new Map();
  const factory=async id=>{
    const route=store.db.prepare('SELECT model_route FROM agent_mesh_runs WHERE run_id=?').get(id)?.model_route||'lite';
    const resource=await(clientFactory?clientFactory(id):route==='hybrid'?openTeamVertex(id,{route,proEndpoint:'custom_tools'}):openCampaignVertex(id)),client=resource.client;
    return {...resource,client:{...client,events:client.events,async json(system,packet,options){
      const registration=store.db.prepare('SELECT version,grounding_hash FROM agent_mesh_runs WHERE run_id=?').get(id);
      if(registration?.version===GROUNDING_VERSION&&registration.grounding_hash!==GROUNDING_HASH)throw new WorkflowError(409,'MESH_READER_VERSION_CHANGED','This run belongs to a different verified reader. Preserve its checkpoints and create a new versioned run.');
      const request=registration?.version===GROUNDING_VERSION?groundedRequest({store,id,system,packet,options}):{system,packet,options,factId:null};
      if(options.functions?.[0]?.name==='close_experiment'){
        request.packet={...request.packet,scaleUpGate:durableReleaseGate(null,null)};
        request.system+=' A single live market is not independent long-horizon confirmation. Its gain may be pulled forward. The trusted scale-up gate is blocked. You may recommend further bounded experiments, but cannot retain_agent_policy as a profitable rollout.';
      }
      const response=await client.json(request.system,request.packet,request.options);
      if(request.factId&&!response?.args?.evidenceIds?.includes(request.factId))throw new WorkflowError(409,'INVALID_POLICY_DECISION','Cite the supplied verified-facts checkpoint: '+request.factId);
      if(request.factId&&['propose_policy','review_policy'].includes(response?.name)){
        const role=response.name==='propose_policy'?ROLES[1]:ROLES[2];
        validatePolicyDecision(role,response.args,packet);
        const facts=JSON.parse(store.db.prepare('SELECT output_json FROM policy_lab_checkpoints WHERE checkpoint_id=?').get(request.factId).output_json);
        const d=response.args,plan=response.name==='propose_policy'?d:d.decision==='reject'?{...packet.proposal,strategy:'observe',merchantIndices:[],maxOfferPct:0,epsilon:0}:d.decision==='narrow'?{...packet.proposal,merchantIndices:d.merchantIndices,maxOfferPct:d.maxOfferPct,epsilon:d.epsilon}:packet.proposal;
        const gate=response.name==='propose_policy'?campaignPreflight(plan,facts):publicationCheck(plan,facts,{currentDay:store.state(id).tick,announcements:[...facts.announcements,...(facts.publicationEvidence?.newAnnouncements||[])]});
        saveHarnessCheckpoint(store,id,options.caseId+'-PREFLIGHT',{response,factId:request.factId},{...gate,rawAgentResponse:response});
        if(gate.issues.length){
          // The frozen workflow provides one correction call. Preserve the real
          // failed proposal and return numerical feedback, never a scripted plan.
          packet.harnessFeedback={previousProposal:plan,gate,remainingRevisions:options.caseId.endsWith('-CORRECTION')?0:1};
          throw new WorkflowError(409,'CAMPAIGN_PREFLIGHT_FAILED',gate.issues.map(i=>i.message).join(' '));
        }
        if(response.name==='review_policy')authorizePilot(store,id,options.caseId,plan,gate);
      }
      if(options.functions?.[0]?.name==='close_experiment'){
        const event=client.events.at(-1),cost=packet.modelCostMicros+(event?.modelCostMicros??event?.reservedMicros??30000);
        const economics=meshEconomics({clock:'COMPLETE',branches:packet.branches,modelCostMicros:cost});
        const scaleUpGate=durableReleaseGate(null,null),accepted=response?.args?.decision!=='retain_agent_policy'||economics.agentExceedsBothControls&&scaleUpGate.status==='PASS';
        store.db.prepare('INSERT OR IGNORE INTO agent_mesh_review_audits VALUES(?,?,?,?,?,?)').run(options.caseId,id,createHash('sha256').update(JSON.stringify({system:request.system,packet:request.packet,functions:request.options.functions})).digest('hex'),JSON.stringify(response),JSON.stringify({accepted,afterInference:economics,countsCurrentCallCost:true,scaleUpGate}),new Date().toISOString());
        if(!accepted)throw new WorkflowError(409,'INVALID_FINAL_REVIEW','Retention requires positive independent long-horizon evidence after inference costs. One live market cannot establish durable profit. The original recommendation is preserved in the mesh audit.');
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
    const registration=store.db.prepare('SELECT version,model_route FROM agent_mesh_runs WHERE run_id=?').get(id);
    return {...s,mesh:{version:registration?.version||'agent-mesh-integration-v1',modelRoute:registration?.model_route||'lite',modelRouting:TEAM_MODEL_ROUTES[registration?.model_route||'lite'],roles:ROLES.map(role=>({role,model:registration?.model_route==='hybrid'&&role!==ROLES[0]?'gemini-3.1-pro-preview-customtools':'gemini-3.1-flash-lite',calls:s.checkpoints.filter(c=>c.role===role&&c.actor==='GEMINI_3_1_FLASH_LITE').length})),
      orchestration:'Code-owned checkpoint graph; model-owned investigation, campaign proposal and review decisions.',numericWorker:'Local ridge reward regression; sequential RL experiments are not used by this demo.',
      catalog,receipts:{current:s.receipts.length,hasPriorReference:Boolean(s.referenceReceipt),countsReferenceAsCurrentSale:false},handoffs:meshHandoffs(s.checkpoints),economics:meshEconomics(s),audits,closing:finals.has(id),
      harness:registration?.version===GROUNDING_VERSION?{limits:HARNESS_LIMITS,scaleUpGate:durableReleaseGate(null,null),checkpoints:s.checkpoints.filter(c=>c.role==='Campaign harness'),scope:'Evidence screen and capped experiments; single-market results cannot establish durable profitable campaigns.'}:null}};
  }
  function stop(id){clearTimeout(clocks.get(id));clocks.delete(id);}
  function finish(id,allowFailedTeam=false){
    if(finals.has(id))return finals.get(id);
    const work=(async()=>{await lab.wait(id);const s=lab.snapshot(id);if(s.clock==='COMPLETE'&&(!s.lastError||allowFailedTeam))try{await lab.conclude(id);}catch{}return snapshot(id);})().finally(()=>finals.delete(id));finals.set(id,work);return work;
  }
  function schedule(id){
    if(!autoTimers||clocks.has(id)||lab.snapshot(id).clock!=='RUNNING')return;
    clocks.set(id,setTimeout(()=>{clocks.delete(id);try{enforcePilot(store,id);const s=lab.tick(id);if(s.clock==='COMPLETE')void finish(id);else schedule(id);}catch{lab.control(id,{action:'pause'});}},lab.snapshot(id).settings.dayMs));
  }
  return {...lab,snapshot,
    start(input){
      const route=input?.teamModel??'lite';if(!Object.hasOwn(TEAM_MODEL_ROUTES,route))throw new WorkflowError(400,'INVALID_TEAM_MODEL_ROUTE','Choose Flash-Lite or the bounded hybrid Pro team.');
      const {teamModel,...settings}=input||{};
      const id=typeof input?.requestId==='string'?'GARDEN-LAB-'+createHash('sha256').update(JSON.stringify(input.requestId)).digest('hex').slice(0,16):null,prior=id?store.state(id):null;
      const registration=id?store.db.prepare('SELECT model_route FROM agent_mesh_runs WHERE run_id=?').get(id):null;
      if(registration&&registration.model_route!==route)throw new WorkflowError(409,'TEAM_MODEL_ROUTE_CONFLICT','This run owns its saved model route. Create a new run to compare models.');
      const s=lab.start(settings),registered=store.db.prepare('SELECT version FROM agent_mesh_runs WHERE run_id=?').get(s.runId);
      if(!registered&&(!prior||prior.tick===0&&prior.policyLab.modelCalls===0))store.db.prepare('INSERT INTO agent_mesh_runs (run_id,version,grounding_hash,created_at,model_route) VALUES(?,?,?,?,?)').run(s.runId,GROUNDING_VERSION,GROUNDING_HASH,new Date().toISOString(),route);return snapshot(s.runId);
    },
    control(id,input){
      if(input?.action==='conclude'){
        if(Object.keys(input).some(k=>k!=='action'))throw new WorkflowError(400,'INVALID_POLICY_CONTROL','Use only the declared action.');
        const s=lab.snapshot(id);if(s.day<s.totalDays)throw new WorkflowError(409,'OUTCOMES_NOT_MATURE','Wait for the complete outcome tail.');
        void finish(id,true);return snapshot(id);
      }
      lab.control(id,input);if(input.action==='pause')stop(id);if(input.action==='resume')schedule(id);return snapshot(id);
    },
    tick(id,options){enforcePilot(store,id);lab.tick(id,options);return snapshot(id);},
    async wait(id){await lab.wait(id);await finals.get(id);return snapshot(id);},
    async close(){for(const id of clocks.keys()){stop(id);if(lab.snapshot(id).clock==='RUNNING')lab.control(id,{action:'pause'});}await lab.close();await Promise.allSettled([...finals.values()]);},
    recover(){lab.recover();}
  };
}

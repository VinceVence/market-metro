import {readFile,writeFile} from 'node:fs/promises';
const read=p=>readFile(p,'utf8').then(JSON.parse),dir='docs/commerce-growth/development-1';
const result=await read(dir+'/results.json'),rows=(await read(dir+'/rows.json')).rows,example=await read(dir+'/example.json'),
 bound=(await read('docs/commerce-growth/headroom-bound-1/reachable/results.json')).rows[0],
 verified=await read('docs/commerce-growth/headroom-bound-1/reachable/verification.json'),
 witness=await read('docs/commerce-growth/headroom-bound-1/reachable/witness-verification.json'),
 oracle=await read('docs/commerce-growth/oracle-audit-1/results.json');
if(result.status!=='COMPLETED'||!verified.certificates.every(v=>v.certificateVerified)||!witness.actualInsideRelaxation)throw Error('GROWTH_AUDIT_INCOMPLETE');
const labels={no_outreach:'No outreach',fixed_coverage:'Coverage rules',fixed_intent:'Recent-interest rules',fixed_rfm:'Recency / frequency rules',fixed_stock:'Stock-aware recommendations',learned_discovery:'Local response learner'},
 fixed=result.summary.find(s=>s.policy.id===result.reference),none=result.summary.find(s=>s.policy.id==='no_outreach'),learned=result.summary.find(s=>s.policy.mode==='bayesian');
const report={...result,createdAt:new Date().toISOString(),markets:7,completedRuns:rows.length,labels,fixed,none,learned,example,
 fixedVsNone:fixed.mean.platformUSD/none.mean.platformUSD-1,
 bound:{ratio:bound.ratio,meanUSD:bound.conservativeCeilingUSD/7,certificateVerified:true,witnessVerified:true,scope:'Optimistic evaluator ceiling; includes private future reachability and ignores stock, transport and information limits. Not an agent score.'},
 oracle:{ratio:oracle.ratioToFixed,meanUSD:oracle.meanPlatformUSD,source:oracle.source,deploymentAllowed:false},
 cases:rows.filter(r=>r.policy===result.reference).map(f=>{const n=rows.find(r=>r.seed===f.seed&&r.policy==='no_outreach'),l=rows.find(r=>r.seed===f.seed&&r.policy===learned.policy.id);return {regime:f.regime,seed:f.seed,noOutreach:n.platformUSD,fixed:f.platformUSD,learned:l.platformUSD,fixedRecommendationPurchases:f.recommendationPurchases,learnerRecommendationPurchases:l.recommendationPurchases,sameNeeds:n.opportunityHash===f.opportunityHash&&f.opportunityHash===l.opportunityHash,sameFunding:n.incomeCents===f.incomeCents&&f.incomeCents===l.incomeCents};}),
 figure:'/data/commerce-growth.png',source:'AUTHORED_SIMULATION_NOT_PAYPAL_CUSTOMER_DATA',
 limitations:['Authored response and interest assumptions; no production calibration.','Attributed recommendation purchases are not individually proven causal lift; aggregate differences use paired synthetic worlds.','The current learner predicts funded responses, not long-term incremental profit. Sparse priors and cold-customer targeting performed poorly.','All actors receive the same evidence and tools; hidden need and response truth is restricted to evaluator-only bound/diagnostic code.','No new LLM or native PayPal call occurred. Existing Sandbox receipts remain separate.','The full2x goal is unproven. No held-out markets have been opened.']};
await writeFile('demo/data/commerce-growth.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({fixedVsNone:report.fixedVsNone,learnerVsFixed:report.ratio,bound:report.bound.ratio,newModelCalls:0}));

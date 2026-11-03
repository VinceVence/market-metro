import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {DIR} from './benchmark.mjs';
import {mean} from './evaluate.mjs';
const r=JSON.parse(await readFile(resolve(DIR,'results.json'),'utf8')),p=JSON.parse(await readFile(resolve(DIR,'protocol.json'),'utf8'));
// No campaign has no served ranking; the shared evaluation helper's hypothetical list is not an action.
r.arms.none.skuRecall3=null;r.arms.none.skuNdcg3=null;
const labels={none:'No campaign',fixed:'Fixed weekly campaign',numerical:'Numerical search',single:'One generalist',multi:'Specialist team'},signed=x=>(x<0?'−':'+')+'$'+Math.abs(x).toFixed(2);
const designMetrics=Object.fromEntries(['numerical','single','multi'].map(arm=>{const ds=Object.values(r.designs).filter(d=>d.arm===arm),events=ds.flatMap(d=>d.checkpoints.map(c=>c.provider));return [arm,{costUSD:ds.reduce((s,d)=>s+d.costUSD,0),calls:events.length,latencySeconds:events.reduce((s,e)=>s+e.latencyMs/1000,0),inputTokens:events.reduce((s,e)=>s+e.inputTokens,0),outputTokens:events.reduce((s,e)=>s+e.outputTokens+e.thinkingTokens,0),acceptedCandidates:ds.reduce((s,d)=>s+d.candidates.filter(c=>c.valid).length,0),attemptedCandidates:ds.reduce((s,d)=>s+d.candidates.length,0),meanDistinctCandidates:mean(ds.map(d=>d.distinctCandidates)),meanDesignWallSeconds:mean(ds.map(d=>(Date.parse(d.finishedAt)-Date.parse(d.startedAt))/1000)),selectedCoordinatorProposals:ds.filter(d=>d.candidates[4]&&JSON.stringify(d.selection.config)===JSON.stringify(d.candidates[4].config)).length,selectedFallbacks:ds.filter(d=>typeof d.selection.config==='string').length}];}));
const intervals=Object.fromEntries(Object.entries(r.differences).map(([k,v])=>{const m=mean(v.blockDeltas),sd=Math.sqrt(v.blockDeltas.reduce((s,x)=>s+(x-m)**2,0)/2),half=4.302653*sd/Math.sqrt(3);return [k,{mean:m,lower:m-half,upper:m+half,unit:'USD per100-shopper market',method:'Exploratory two-sided t interval over3 design-block means; not12 independent policy designs.'}];}));
const report={...r,labels,designMetrics,intervals,method:p,disclosure:'Synthetic markets, authored products and modeled payment economics. Three fresh construction sessions per LLM arm; policies are reused across four unseen markets per session. No new PayPal captures. Token-metered list-price estimates, not a billing invoice.',research:'research/notes/final_report_commerce-agent-performance-e46beb.md',figure:'/data/commerce-design-v2.png'};
await mkdir('demo/data',{recursive:true});await writeFile('demo/data/commerce-design-v2.json',JSON.stringify(report));
const lines=[
 '# Campaign construction: multi-agent performance',
 '',
 `The research-backed system is implemented. The predeclared advancement gate **${r.advanceGatePassed?'passed':'did not pass'}**. This is a ${r.testMarkets}-market synthetic pilot covering six scenarios and three separately constructed policies per architecture.`,
 '',
 '## What actually changed',
 '',
 'Two independently prompted specialists construct typed ranking, audience, timing and coupon configurations. A trusted local simulator measures four proposals. A coordinator reads those results and constructs one refinement. A deterministic validation checkpoint selects a candidate meeting the validation merchant guard or the existing fixed fallback. EASE and count features are fitted locally; no per-shopper LLM calls and no generated SQL.',
 '',
 'The single-agent control receives the same Pro model, three calls, five candidate evaluations and allowed features. Its later calls see its previous trials. Numerical search evaluates five diverse configurations in the same action space. The fixed weekly policy is preserved. No simulator parameter changed.',
 '',
 '## Held-out results',
 '',
 '| Approach | Platform net / market | Merchant contribution / market | Orders / market | Exact recommendation purchases / market | SKU Recall@3 | Construction cost |',
 '|---|---:|---:|---:|---:|---:|---:|',
 ...Object.entries(r.arms).map(([id,a])=>`| ${labels[id]} | $${a.platformNetUSD.toFixed(2)} | $${a.merchantUSD.toFixed(2)} | ${a.purchases.toFixed(1)} | ${a.recommendationPurchases.toFixed(1)} | ${a.skuRecall3==null?'N/A':(a.skuRecall3*100).toFixed(1)+'%'} | $${(designMetrics[id]?.costUSD||0).toFixed(6)} |`),
 '',
 ...Object.entries(r.differences).map(([id,d])=>`- Team versus ${labels[id]}: ${signed(d.meanPlatformUSD)} modeled platform net and ${signed(d.meanMerchantUSD)} merchant contribution per market; ${d.wins}/${r.testMarkets} positive platform comparisons.`),
 '',
 `Total new provider usage: **$${r.modelCostUSD.toFixed(6)} across ${r.providerCalls} calls**. Every role used Gemini3.1 Pro with MEDIUM reasoning. Invalid candidate configurations: ${r.invalidCandidates}.`,
 '',
 '## Cost and uncertainty',
 '',
 'Construction is paid once per policy design. The primary net result allocates that observed cost across the four test markets where the policy was actually executed. The JSON also reports a conservative full construction charge on every individual market. It does not amortize over hypothetical future traffic. Local CPU times are recorded; local hardware electricity and developer labor are not monetized.',
 '',
 ...Object.entries(intervals).map(([id,x])=>`- Team versus ${labels[id]}, exploratory 95% interval using three design-block means: [${signed(x.lower)}, ${signed(x.upper)}].`),
 '',
 'Twelve market seeds do not equal twelve independently designed policies. Intervals are wide with only three design blocks. Observed gains are not proof of production transfer or universal multi-agent superiority.',
 '',
 '## Role contribution and latency',
 '',
 `Average design wall time: numerical search ${designMetrics.numerical.meanDesignWallSeconds.toFixed(1)}s, one agent ${designMetrics.single.meanDesignWallSeconds.toFixed(1)}s, specialist team ${designMetrics.multi.meanDesignWallSeconds.toFixed(1)}s. The team used ${designMetrics.multi.inputTokens} input tokens and ${designMetrics.multi.outputTokens} output/thinking tokens. All 18 provider calls completed; all 30 LLM proposals passed typed validation. This is execution reliability, not a guarantee of decision quality.`,
 '',
 'The coordinator refinement was selected in 0/3 design sessions. The two learned team policies came from the recommendation specialist; the third session kept the fixed fallback. The economist and coordinator participated, but this pilot does not establish their incremental economic value. The single-agent versus team mean difference also has an interval spanning zero. Do not present this as proof that three agents are necessary.',
 '',
 '## Measurement boundaries',
 '',
 '- Recommendation purchase requires the exact offered merchant/product and `behavior_recommendation` order channel. Merely buying after a contact does not qualify.',
 '- Coupon purchases use the recorded coupon channel and redemption data. Coupons issued are not sales.',
 '- Offline ranking uses a day 30 snapshot and future no-campaign purchases in days 31–37. Canonical SKU deduplication is identical across policy, count-affinity and popularity rankers. Ranking and causal intervention profit are separate metrics.',
 '- Economic outcomes include retained fees, modeled processing costs, subsidy, outreach, delayed returns and AI usage. Merchant contribution includes COGS and delivery. Fees and costs are authored assumptions, not PayPal financial disclosures.',
 '- The initial 30 days and exogenous random draws are shared within each paired market. Private tastes, wallets, need and future returns are excluded from agent input. Models refit every 14 days using completed observations only.',
 '- Development tools reveal simulation outcomes only for development seeds. Validation chooses a policy without exposing validation scores to the LLM. All selections are frozen before opening test seeds.',
 '- Saved candidate checkpoints are research-time decisions. Replaying them is not a fresh LLM run, and executing thousands of shopper actions is not thousands of LLM decisions.',
 '',
 '## Research basis',
 '',
 'The implementation combines targeted measured refinement from [MLE-STAR](https://research.google/blog/mle-star-a-state-of-the-art-machine-learning-engineering-agents/), independent recommendation perspectives from [Multi-Agent Collaborative Filtering](https://arxiv.org/abs/2511.18413), and cheap [EASE](https://arxiv.org/abs/1905.03375) fitting. Cost-matched comparisons follow [AI Agents That Matter](https://arxiv.org/abs/2407.01502). These papers motivate the architecture; they do not establish its commerce profitability.',
 '',
 'Full Hyperresearch report: [research report](../../research/notes/final_report_commerce-agent-performance-e46beb.md).',
 '',
 '## Reproduce',
 '',
 '`node --test tests/commerce-design-v2.test.mjs` runs local accounting, leakage and schema checks. Protocol and source hashes are in `trial-1/protocol.json`. `benchmark.mjs design` skips completed checkpoints, refuses failed/uncertain retries, and enforces both per-design and experiment limits. `benchmark.mjs test` refuses to overwrite test outcomes. Historical pilots remain unchanged.',
 '',
 '![Held-out results](../../demo/data/commerce-design-v2.png)',
 ''
];
await writeFile(resolve(DIR,'report.json'),JSON.stringify({designMetrics,intervals},null,2));await writeFile('docs/commerce-design-v2/README.md',lines.join('\n'));
console.log(JSON.stringify({costUSD:r.modelCostUSD,gate:r.advanceGatePassed,designMetrics,intervals},null,2));

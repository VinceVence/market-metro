import {esc, num} from './ui.mjs';
import {renderFreshBenchmark} from './fresh-benchmark-view.mjs';
import {renderResearchLab} from './research-lab-view.mjs';
import {renderTrustedWorkflow} from './trusted-workflow-view.mjs';

const dollars = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',signDisplay:'exceptZero'}).format(value);
const interval = m => `${dollars(m.low)} to ${dollars(m.high)}`;
const status = value => value.replaceAll('_',' ').toLowerCase();
const figure = f => `<figure class="plb-figure"><a href="${esc(f.files.png)}" target="_blank" rel="noopener"><img src="${esc(f.files.svg)}" alt="${esc(f.caption)}" loading="lazy"></a><figcaption>${esc(f.caption)} <span><a href="${esc(f.files.pdf)}" target="_blank" rel="noopener">PDF ↗</a><a href="${esc(f.files.svg)}" download>SVG ↓</a></span></figcaption></figure>`;

export function mountBenchmarkView(container){
  let loaded=false,loading=null;
  async function load(preferFresh=true){
    if(loaded)return;if(loading)return loading;
    container.innerHTML='<p role="status">Loading measured benchmark results…</p>';
    loading=(async()=>{
      try{
        if(preferFresh===true){
          const trusted=await fetch('/benchmarks/v4-1/index.json');
          if(trusted.ok){renderTrustedWorkflow(container,await trusted.json(),()=>{loaded=false;void load('v3');});loaded=true;return;}
        }
        if(preferFresh===true||preferFresh==='v3'){
          const research=await fetch('/benchmarks/v3/index.json');
          if(research.ok){renderResearchLab(container,await research.json(),()=>{loaded=false;void load('v2');});const button=document.createElement('button');button.textContent='Trusted workflow ↗';button.className='plb-version-switch';button.onclick=()=>{loaded=false;void load(true);};container.prepend(button);loaded=true;return;}
        }
        if(preferFresh){
          const fresh=await fetch('/benchmarks/v2/index.json');
          if(fresh.ok){renderFreshBenchmark(container,await fresh.json(),()=>{loaded=false;void load(false);});const researchButton=document.createElement('button');researchButton.textContent='Research workspace v3 ↗';researchButton.className='plb-version-switch';researchButton.onclick=()=>{loaded=false;void load(true);};container.prepend(researchButton);loaded=true;return;}
        }
        const response=await fetch('/benchmarks/v1/index.json');if(!response.ok)throw Error('Benchmark artifacts are not available. Run npm run benchmark:policy and npm run plot:policy first.');
        const r=await response.json(),agent=r.summaries.find(s=>s.policy==='recorded_v1'),m=agent.metrics.deltaPlatformUSD;
        const chart=name=>figure(r.figures.find(f=>f.name===name));
        container.innerHTML=`<div class="plb-title"><div><p class="plb-eyebrow">BENCHMARK V1 · MEASURED LOCAL RESULTS</p><h3>Are the policies improving?</h3><p>${num(r.pairedCases)} paired cases · ${r.seedCount} seeds · ${r.scenarioCount} scenarios · ${num(r.worlds)} worlds</p></div><a class="plb-download" href="/benchmarks/v1/cases.csv" download>Download results ↓</a></div>
        <div class="plb-reading"><strong>${dollars(m.mean)}</strong><div><b>Additional modeled PayPal contribution</b><p>95% interval: ${interval(m)} · versus no campaign · per 100 shoppers over 70 campaign days</p></div><span class="plb-badge">${m.low>0?'Positive transfer effect':'Benefit not demonstrated'}</span></div>
        <p class="plb-scope"><b>Saved-plan transfer test.</b> Reuses the three recorded agent plans and refits their local models on new market data. No fresh Gemini decisions were generated. New paid API cost: <b>$0</b>.</p>
        <nav class="plb-nav" aria-label="Benchmark sections"><button data-bench-view="impact" aria-selected="true">Economic impact</button><button data-bench-view="quality" aria-selected="false">Agent & simulator checks</button><button data-bench-view="protocol" aria-selected="false">Goals & protocol</button></nav>
        <div data-bench-panel="impact">${chart('economic-impact')}${chart('cumulative-value')}
          <h4>Who benefits?</h4><div class="pl-table-wrap"><table><thead><tr><th>Versus no campaign</th><th>Platform contribution</th><th>Merchant contribution</th><th>Retained payment volume</th></tr></thead><tbody>${r.summaries.map(s=>`<tr><th>${esc(s.label)}</th><td>${dollars(s.metrics.deltaPlatformUSD.mean)}</td><td>${dollars(s.metrics.deltaMerchantUSD.mean)}</td><td>${dollars(s.metrics.deltaVolumeUSD.mean)}</td></tr>`).join('')}</tbody></table></div><p class="plb-caption">Means across the same paired markets. Model cost is included in platform contribution. Local electricity, hardware and labor are unpriced.</p>
          ${chart('merchant-and-reactivation')}${r.cohortDiagnostic.allLapsedReturnedWithoutCampaign?'<p class="plb-finding"><b>Reactivation has a ceiling effect.</b> Every lapsed shopper in the baseline returned within 70 days without a campaign. This benchmark cannot yet demonstrate prevented churn.</p>':''}
          ${chart('version-progress')}<p class="plb-caption">One measured version is a starting point. Additional versions need compatible metrics; confirmatory testing needs fresh seeds after tuning.</p>
        </div>
        <div data-bench-panel="quality" hidden>${chart('agent-reliability')}
          <h4>Known reasoning mistakes</h4><p class="plb-caption">Manual, non-exhaustive review of the original live run. These findings are not an automated accuracy score.</p><ol class="plb-findings">${r.audit.semanticReview.findings.map(f=>`<li><b>${esc(status(f.verdict))}</b><p>${esc(f.finding)}</p><code>${esc(f.suffix)}</code></li>`).join('')}</ol>
          <h4>Execution and simulator validity</h4><div class="pl-table-wrap"><table><tbody><tr><th>Typed contract checks</th><td>${r.audit.guardTests.filter(t=>t.passed).length} / ${r.audit.guardTests.length} passed</td></tr><tr><th>Invalid actions accepted by tested guards</th><td>${r.audit.guardSummary.falseAccepts}</td></tr><tr><th>Accounting / inventory / budget violations</th><td>${Object.values(r.integrity.violations).reduce((a,b)=>a+b,0)}</td></tr><tr><th>Recorded Gemini attempts / rejected attempts</th><td>${r.audit.attempts} / ${r.audit.rejectedAttempts}</td></tr><tr><th>Mean recorded call latency</th><td>${r.audit.callLatencySeconds.mean.toFixed(2)} seconds</td></tr><tr><th>Source run model cost estimate</th><td>$${r.audit.costUSD.toFixed(6)}</td></tr><tr><th>Benchmark model / payment calls</th><td>0 / 0</td></tr><tr><th>Local world computation</th><td>${r.costs.evaluatedWorldSeconds.toFixed(1)} seconds · training included</td></tr></tbody></table></div>
          <ul class="plb-checks">${r.integrity.probes.map(p=>`<li><span class="plb-badge ${p.passed?'is-pass':'is-fail'}">${p.passed?'pass':'fail'}</span>${esc(p.name)}</li>`).join('')}</ul>
          <p class="plb-finding"><b>Consistency is verified; realism is not calibrated.</b> Channel3 supplies catalog records. Shoppers, merchant costs, refunds and incentive response are simulated. PayPal receipts verify integration, not this economy’s ROI.</p>
          <details><summary>Post-shock recovery measurements</summary><p class="plb-caption">A negative trailing 7-day contribution difference must become nonnegative for 14 consecutive days. Results use mature outcomes retrospectively; this is not proof the agent detected a shock.</p><div class="pl-table-wrap"><table><thead><tr><th>Saved agent plan scenario</th><th>Recovered</th><th>Not recovered by day 100</th><th>Mean days to confirmation*</th></tr></thead><tbody>${r.adaptation.find(a=>a.policy==='recorded_v1').scenarios.map(s=>`<tr><th>${esc(s.scenario.replaceAll('_',' '))}</th><td>${s.recoveredCases} / ${r.seedCount}</td><td>${s.censoredCases}</td><td>${s.meanDaysToConfirmedRecovery===null?'—':s.meanDaysToConfirmedRecovery.toFixed(1)}</td></tr>`).join('')}</tbody></table></div><p class="plb-caption">*Among recovered cases only. Non-recovery is retained as censoring, not dropped from the denominator.</p></details>
        </div>
        <div data-bench-panel="protocol" hidden><h4>Explicit goals</h4><div class="plb-goals">${r.goals.map(g=>`<article><div><h5>${esc(g.label)}</h5><p>${esc(g.rule)}</p></div><span class="plb-badge ${g.status==='PASS'?'is-pass':g.status==='FAIL'?'is-fail':''}">${esc(status(g.status))}</span></article>`).join('')}</div>
          <h4>What stays fixed</h4><ol class="plb-protocol"><li>100 shoppers, 3 merchants, 30 history days, 70 campaign days and 14 follow-up days.</li><li>The same cached Channel3 catalog, starting conditions, external random draws and $300 virtual budget per world.</li><li>Rules and saved plans use the same learner and merchant constraints. A second rules baseline acts immediately to expose latency tradeoffs.</li><li>Local models see only mature past rewards. No evaluation results or hidden shopper traits enter policy fitting.</li><li>95% intervals resample 20 seed clusters, keeping their five scenarios together. The 4 million shopper-day records are not 4 million independent experiments.</li><li>All source model costs, including corrections and final review, are allocated to each saved-plan world. Actual new API spend is zero.</li></ol>
          <h4>Limits of this result</h4><ul class="plb-protocol">${r.limitations.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul>
          <div class="plb-artifacts"><a href="/benchmarks/v1/protocol.json" target="_blank" rel="noopener">Frozen protocol ↗</a><a href="/benchmarks/v1/lock.json" target="_blank" rel="noopener">Code & input hashes ↗</a><a href="/benchmarks/v1/result.json" download>Full result JSON ↓</a><a href="/benchmarks/v1/goals.json" download>Goal statuses ↓</a></div><p class="plb-caption">Benchmark ${esc(r.benchmarkHash.slice(0,12))} · source run ${esc(r.sourceRunId)}</p>
        </div>`;
        for(const button of container.querySelectorAll('[data-bench-view]'))button.onclick=()=>{
          for(const b of container.querySelectorAll('[data-bench-view]'))b.setAttribute('aria-selected',String(b===button));
          for(const p of container.querySelectorAll('[data-bench-panel]'))p.hidden=p.dataset.benchPanel!==button.dataset.benchView;
        };
        const freshButton=document.createElement('button');freshButton.textContent='Fresh Gemini benchmark v2 ↗';freshButton.className='plb-version-switch';freshButton.onclick=()=>{loaded=false;void load(true);};container.prepend(freshButton);
        loaded=true;
      }catch(e){container.innerHTML=`<p role="alert">${esc(e.message)}</p><button id="plb-retry">Retry loading</button>`;container.querySelector('#plb-retry').onclick=()=>load();}
      finally{loading=null;}
    })();return loading;
  }
  return {load};
}

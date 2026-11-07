import {esc} from '../garden/ui.mjs';
import {showLiveScale} from './live-scale-view.mjs';

const dollars = n => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const signed = (n, money = true) => (n > 0 ? '+' : '') + (money ? dollars(n) : n.toLocaleString());

// Display the settled, saved comparison. This view does not run a benchmark.
export function showImpact(root, session, {navigate, showStep}) {
  const comparison = session?.comparison;
  if (!comparison) {
    root.innerHTML = `<div class="impact-page"><header><small>Simulation impact</small><h1>${session?.replay ? 'Results follow the campaign' : 'Waiting for settlement'}</h1><p>Watch the market, then follow the agent’s decisions. The matched comparison appears after purchases, deliveries and refunds settle.</p></header><button class="primary" data-go="market">Watch the market</button>${session?.replay ? '<button data-latest>Jump to settled result</button>' : ''}</div>`;
    root.querySelector('[data-go]').onclick = () => navigate('market');
    root.querySelector('[data-latest]')?.addEventListener('click', () => document.getElementById('live').click());
    return;
  }
  const fixed = comparison.fixed, agent = comparison.team;
  const rows = [
    ['PayPal net', 'platformUSD', true, 'After modeled costs and recorded AI spend'],
    ['Merchant contribution', 'retailerUSD', true, 'Includes remaining inventory value'],
    ['Retained purchases', 'retainedPurchases', false, 'Completed sales after refunds']
  ];
  const publications = session.steps.filter(s => s.actor === 'TRUSTED_PUBLISHER' && s.output);
  root.innerHTML = `<div class="impact-page">
    <header><small>Saved simulation · seed ${session.settings.seed} · Day ${session.day}</small><h1>What changed with the agent?</h1><p>Same shoppers, starting funds and market conditions. Agent + ontology compared with fixed rules.</p></header>
    <div class="impact-results">${rows.map(([label, key, money, note]) => {
      const delta = agent[key] - fixed[key], ceiling = Math.max(Math.abs(fixed[key]), Math.abs(agent[key]), 1), fmt = money ? dollars : n => n.toLocaleString();
      return `<article class="impact-result"><h2>${label}</h2><strong class="${delta < 0 ? 'negative' : 'positive'}">${signed(delta, money)}</strong><small>${fixed[key] > 0 ? signed(100*delta/fixed[key], false).replace(/(\.\d{1})\d+/, '$1')+'% vs fixed' : 'vs fixed rules'}</small><div class="impact-bars">${[['Fixed', fixed[key], 'fixed'], ['Agent', agent[key], 'agent']].map(([name, value, kind]) => `<div><span>${name}</span><b>${fmt(value)}</b><i class="${kind}" style="width:${Math.max(2,100*Math.abs(value)/ceiling)}%"></i></div>`).join('')}</div><p>${note}</p></article>`;
    }).join('')}</div>
    <div class="impact-explanation"><section><h2>Decisions behind the result</h2>${publications.length ? publications.map(step => `<button class="impact-decision" data-checkpoint="${esc(step.id)}"><span>Day ${step.finishedDay ?? step.day}</span><b>${esc(step.output.title || 'Campaign reviewed')}</b><small>${esc(step.output.body || step.output.reason || 'Inspect the recorded decision and its evidence.')}</small><em>See evidence →</em></button>`).join('') : '<p>Open Agent decisions to inspect the recorded checkpoints.</p>'}</section><aside><h2>Follow the evidence</h2><button data-go="workflow">Agent decisions →</button><button data-go="ontology">Ontology associations →</button><button data-go="payments">PayPal payment evidence →</button><dl><dt>Recorded model cost</dt><dd>$${(session.costMicros/1e6).toFixed(4)}</dd><dt>Local model fits</dt><dd>${session.steps.filter(s => s.actor === 'LOCAL_MODEL' && s.status === 'COMPLETED').length}</dd><dt>Native Sandbox receipts in this run</dt><dd>${session.receipts.length}</dd></dl></aside></div>
    <p class="impact-scope">Modeled results from one paired run, not real PayPal profit or proof across all markets. Sandbox receipts use test funds and are counted separately.</p>
    ${session.settings.marketProfile?.startsWith('metropolis-') ? '<details class="impact-more"><summary>Compare the recorded market sizes</summary><div data-scale-results></div></details>' : ''}
  </div>`;
  root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => navigate(b.dataset.go));
  root.querySelectorAll('[data-checkpoint]').forEach(b => b.onclick = () => showStep(b.dataset.checkpoint));
  const more = root.querySelector('.impact-more');
  more?.addEventListener('toggle', () => {
    if (!more.open || more.dataset.loaded) return;
    more.dataset.loaded = 'true';
    showLiveScale(more.querySelector('[data-scale-results]'), session).catch(e => {
      more.querySelector('[data-scale-results]').textContent = e.message;
      delete more.dataset.loaded;
    });
  });
}

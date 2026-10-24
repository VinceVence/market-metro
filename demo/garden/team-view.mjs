import {AGENT_ROLES} from './agent-roles.mjs';
import {esc, pct} from './ui.mjs';

const CAMPAIGNS = {
  recommendation: 'Recommendations',
  reactivation: 'Reactivation offers',
  trend_promotion: 'Trend promotions'
};
const ACTIONS = {
  PAYPAL_TEAM_PLAN: 'Plan PayPal actions', PAYPAL_ACTION_SELECTED: 'Choose payment action', PAYPAL_ACTION_RESULT: 'Verify PayPal outcome',
  SET_OBJECTIVE: 'Set objective', COLLECT_HISTORY: 'Prepare history', DEFINE_SUCCESS: 'Define experiment',
  OPEN_CONTINUOUS_MARKET: 'Open market', COLLECT_OBSERVATIONS: 'Record shopper activity', OBSERVE_TRENDS: 'Analyze demand',
  RESEARCH_PLAN: 'Choose approach', TRAIN_ASYNC: 'Train response models', MODEL_RESULT: 'Validate model',
  FIT_RECOMMENDER: 'Fit recommender', REFRESH_BEFORE_CAMPAIGN: 'Refresh observations',
  PUBLISH_PRODUCT_CAMPAIGN: 'Publish campaign', WAIT_FOR_EVIDENCE: 'Wait for evidence',
  BLOCK_DRIFTED_CANDIDATE: 'Reject candidate', ANALYST_ERROR: 'Review failed', STALE_SNAPSHOT: 'Refresh required'
};
export const actionLabel = action => ACTIONS[action] || String(action || 'Ready').replaceAll('_', ' ').toLowerCase();

export function teamRoster(log, {mode = 'local', status = 'IDLE', selectedRole, compact = false} = {}) {
  const active = {ANALYZING: 'Business lead', TRAINING: 'Data scientist', DECIDING: 'Coordinator'}[status];
  return AGENT_ROLES.map(role => {
    const latest = log.find(entry => entry.role === role.role);
    const working = active === role.role;
    const state = working ? 'Working' : latest ? 'Day ' + latest.day : '—';
    const planner = mode === 'gemini' ? 'Gemini' : mode === 'chat' ? 'Chat' : 'Rules';
    return `<button type="button" class="team-member ${compact ? 'compact' : ''} ${working ? 'working' : ''}" data-role="${role.role}" data-station="${role.station}" aria-pressed="${selectedRole === role.role}" ${!latest && !working && !compact ? 'disabled' : ''} style="--member-color:${role.color}">
      <span class="member-icon" aria-hidden="true">${role.number}</span>
      <span class="member-copy"><b>${role.role}</b><span>${esc(latest ? actionLabel(latest.action) : 'No recent activity')}</span></span>
      <span class="member-state">${esc(state)}${role.role === 'Coordinator' ? '<small>' + planner + '</small>' : ''}</span>
    </button>`;
  }).join('');
}

export function campaignBoard(plan, enabled, day) {
  return `<div class="campaign-board-head"><b>Campaigns</b></div><div class="campaign-choices">${Object.entries(CAMPAIGNS).map(([id, label]) => {
    const active = plan?.campaignType === id && day < plan.expiresDay;
    return `<span class="campaign-choice ${active ? 'active' : ''} ${enabled.includes(id) ? '' : 'disabled'}">${label}${active ? '<i>Selected</i>' : ''}</span>`;
  }).join('')}</div>`;
}

export function decisionView(entry, report) {
  const evidence = entry.evidence || {};
  const choice = evidence.choice;
  let decision = entry.message;
  let result = 'Saved to the decision history.';
  if(entry.action==='PAYPAL_TEAM_PLAN'&&evidence.choice?.actions?.length===0)return {title:'Recommendation needs outcome data',context:'Operational sandbox trial; no buyer-response window was measured.',decision:entry.message,result:'Intentionally unpaid invoices and unactivated offers cannot establish conversion, engagement or campaign pause.',detail:'Preserved Gemini recommendation; use verified operation checkpoints for the actual outcomes.'};
  if(entry.action==='PAYPAL_ACTION_RESULT')return {title:actionLabel(entry.action),context:'Provider readback for '+(evidence.service||'PayPal')+' · evidence through day '+(evidence.asOfDay??entry.day),decision:entry.message,result:evidence.result?.meaning||entry.status,detail:entry.message};
  if(entry.action==='PAYPAL_TEAM_PLAN'||entry.action==='PAYPAL_ACTION_SELECTED')return {title:actionLabel(entry.action),context:evidence.evidence?.source==='AUTHORED_DEMO_REQUEST'?'Authored business request attached to observed shopper and Channel3 product records.':'Observed economy and verified PayPal states.',decision:entry.message,result:'Each selected action has a durable PayPal checkpoint.',detail:entry.message};
  if (entry.action === 'PUBLISH_PRODUCT_CAMPAIGN') {
    decision = `${CAMPAIGNS[choice?.campaignType] || 'Campaign'} · ${evidence.products?.length || 0} products · ${choice?.offerPct ? choice.offerPct + '% discount' : 'full price'}`;
    result = `Published for day ${evidence.effectiveDay}.`;
  } else if (entry.action === 'FIT_RECOMMENDER') {
    decision = 'Compare personalized ranking with popularity.';
    result = `Recall@3: ${pct(evidence.candidateRecall)} vs ${pct(evidence.baselineRecall)} popularity · ${evidence.validationPurchases} validation purchases.`;
  } else if (entry.action === 'MODEL_RESULT') {
    result = `${evidence.trainingRows} training / ${evidence.validationRows} validation rows · ${entry.status || 'evaluated'}.`;
  } else if (entry.action === 'TRAIN_ASYNC') {
    decision = 'Fit response models on completed observations.';
    result = 'Training in progress. Shopping continues.';
  } else if (entry.action === 'RESEARCH_PLAN' && choice) {
    decision = `${choice.retrain ? 'Fit a model for' : 'Evaluate'} ${(CAMPAIGNS[choice.campaignType] || 'marketing').toLowerCase()}.`;
  }
  return {
    title: actionLabel(entry.action),
    context: report
      ? `${report.recentPurchases} purchases vs ${report.previousPurchases} in the previous week · ${report.lapsedCustomers} inactive shoppers.`
      : evidence.asOfDay ? `Completed observations through day ${evidence.asOfDay}.` : 'Saved market observations.',
    decision, result,
    detail: choice?.rationale || entry.message
  };
}

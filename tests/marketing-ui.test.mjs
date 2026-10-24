import test from 'node:test';
import assert from 'node:assert/strict';
import {decisionView, teamRoster, campaignBoard} from '../demo/garden/team-view.mjs';
import {officeState,officeMarkup} from '../demo/garden/office-scene.mjs';
import {simulationTime} from '../demo/garden/ui.mjs';

test('decision summaries retain the recorded evidence and full rationale', () => {
  const entry = {
    action: 'PUBLISH_PRODUCT_CAMPAIGN', message: 'Full recorded explanation.',
    evidence: {products: [{}, {}], effectiveDay: 31, choice: {campaignType: 'recommendation', offerPct: 0, rationale: 'No discount justified.'}}
  };
  const view = decisionView(entry, {recentPurchases: 12, previousPurchases: 17, lapsedCustomers: 8});
  assert.equal(view.decision, 'Recommendations · 2 products · full price');
  assert.equal(view.detail, 'No discount justified.');
  assert.match(view.context, /12 purchases vs 17/);
  assert.equal(view.result, 'Published for day 31.');
  const fit = decisionView({action: 'FIT_RECOMMENDER', message: 'Popularity selected.', evidence: {candidateRecall: .2, baselineRecall: .3, validationPurchases: 40}});
  assert.match(fit.result, /20.0% vs 30.0%/);
  assert.equal(fit.detail, 'Popularity selected.');
});

test('team status is sourced from work records and catalog text stays escaped', () => {
  const html = teamRoster([{role: 'Data scientist', action: '<img src=x>', day: 30}], {mode: 'local', status: 'TRAINING'});
  assert(html.includes('&lt;img src=x&gt;'));
  assert(!html.includes('<img src=x>'));
  assert(html.includes('Working'));
  assert(html.includes('Rules'));
  assert(!html.includes('Gemini'));
  assert(!teamRoster([], {status: 'IDLE'}).includes('Working'));
  const expired = campaignBoard({campaignType: 'recommendation', expiresDay: 31}, ['recommendation'], 31);
  assert(!expired.includes('<i>Selected</i>'));
});

test('office activity and the clock distinguish collection, training and completed days',()=>{
  const collecting=officeState([],{clock:'RUNNING',teamStatus:'IDLE',mode:'local'},1);
  assert.equal(collecting.find(row=>row.active).role,'Data engineer');
  assert.equal(collecting.find(row=>row.role==='Coordinator').badge,'RULES');
  assert.equal(officeState([],{clock:'RUNNING',teamStatus:'TRAINING',mode:'gemini'},30).find(row=>row.active).role,'Data scientist');
  assert(!officeState([],{clock:'COMPLETE',teamStatus:'IDLE'},42).some(row=>row.active));
  assert(officeMarkup({mode:'local'}).includes('Scripted planner'));
  assert.equal(simulationTime({simTime:{day:1,hour:0}}),'Day 1 · 00:00');
  assert.equal(simulationTime({simTime:{day:4,hour:17}}),'Day 4 · 17:00');
  assert.equal(simulationTime({simTime:{day:42,hour:0,complete:true}}),'Day 42 · Complete');
});

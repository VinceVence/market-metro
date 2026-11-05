import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rename, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {runCoordinatedCase} from '../runner.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {canonicalHash, validateTrialReceipt} from './contracts.mjs';
import {assertBinding, digest, fitModel, read, scoreCampaign} from './tools.mjs';
import {createTrialTool, verifyEconomy} from './trials.mjs';
import {checkCampaignModel, MODEL_CHECK} from './model-check.mjs';

const protocol = await read('docs/commerce-expanded/model-check/protocol.json');
assert.equal(protocol.version, MODEL_CHECK);
const archive = 'docs/commerce-expanded/harness-v2/' + protocol.sourceStudy;
const study = await read(join(archive, 'results.json'));
const fixed = (await read('docs/commerce-growth/team-1/development/results.json')).selectedFixed;
const prior = await read('docs/commerce-growth/team-1/training/model.json');
const economy = await verifyEconomy();
const tool = await createTrialTool({fixed, prior, marketProfile: 'expanded-12x600'});
const root = '.local/model-check';
await mkdir(root, {recursive: true});
const work = await mkdtemp(join(root, 'run-'));
const day = protocol.reviewDay;
const start = Date.now();
const save = (path, obj) => writeFile(path, JSON.stringify(obj, null, 2) + '\n');
const money = n => Math.round(n * 1e6) / 1e6;

async function loadFits(dir, checkpoints) {
  const fits = [];
  for (const cp of checkpoints.filter(c => c.actor === 'LOCAL_TRAINING_TOOL')) {
    assert.equal(cp.input.ownMatureRows, 0);
    const spec = {family: cp.input.family, featureView: cp.input.featureView, windowDays: cp.input.windowDays};
    let model;
    try {
      model = await read(join(dir, 'review-' + day, 'fit-' + fits.length, 'model.json'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const {rows} = await read('docs/commerce-growth/autonomy-1/funding-training/dataset.json');
      model = await fitModel(join(work, cp.output.modelHash), rows, [], spec, day);
    }
    assert.equal(digest(model.artifact), cp.output.modelHash);
    assert.equal(model.modelHash, cp.output.modelHash);
    assert.equal(model.cutoffDay, day);
    assert.equal(model.ownRows, 0);
    assert.deepEqual(model.artifact.spec, spec);
    assert.deepEqual(model.report.metrics, cp.output.metrics);
    assert.deepEqual(model.report.coarse, cp.output.coarse);
    fits.push(model);
  }
  assert.equal(fits.length, 2);
  return fits;
}

const reviews = Object.values(study.checkpoints).flatMap(steps =>
  [...new Set(steps.filter(c => c.actor === 'LOCAL_TRAINING_TOOL').map(c => c.day))].map(day => {
    const sameDay = steps.filter(c => c.day === day);
    return {fits: sameDay.filter(c => c.actor === 'LOCAL_TRAINING_TOOL').length,
      modelsInTrials: new Set(sameDay.filter(c => c.actor === 'LOCAL_CAMPAIGN_TRIAL')
        .map(c => c.input.modelHash).filter(Boolean)).size};
  }));
const coverage = {reviews: reviews.length, twoModelsFitted: reviews.filter(r => r.fits === 2).length,
  bothModelsTrialed: reviews.filter(r => r.modelsInTrials >= 2).length};
const locked = [];
for (const item of protocol.cases) {
  assert.ok(!study.rows.some(row => row.seed === item.seed), 'Overlapping source and evaluation seeds');
  const source = study.rows.find(r => r.arm === protocol.sourceArm && r.caseId === item.sourceCase);
  assert.equal(source.regime, item.regime);
  const dir = join(archive, [protocol.sourceStudy, item.sourceCase, protocol.sourceArm].join('-'));
  const record = await read(join(dir, 'checkpoints.json'));
  const checkpoints = record.checkpoints.filter(c => c.day === day);
  const models = await loadFits(dir, checkpoints);
  const campaign = record.schedule.find(c => c.activationDay === day);
  const model = models.find(m => m.modelHash === campaign.modelHash);
  assertBinding(campaign, model);
  const context = campaign.context;
  const evaluate = (contract, fitted) => tool.evaluate(contract, fitted, [], {}, context);
  const incumbentTrial = await evaluate(null, null);
  const trial = await evaluate(campaign, model);
  const archivedTrial = checkpoints.find(c => c.actor === 'LOCAL_CAMPAIGN_TRIAL' && c.output.contractHash === campaign.hash).output;
  validateTrialReceipt(archivedTrial);
  assert.deepEqual(trial.measurement, archivedTrial.measurement);
  assert.deepEqual(trial.cases, archivedTrial.cases);
  const original = {contract: campaign, model, trial};
  const checked = await checkCampaignModel({tested: [original], trained: models, incumbentTrial, context, evaluate});
  assert.ok(['kept', 'switched'].includes(checked.report.status), JSON.stringify(checked.report));
  const calls = checkpoints.flatMap(c => c.provider ?? []);
  assert.ok(calls.length > 0 && calls.every(c => c.status === 'settled'));
  const originalCost = calls.reduce((s, c) => s + c.modelCostMicros, 0) / 1e6;
  assert.ok(Number.isFinite(originalCost));
  locked.push({item, original, selected: checked.selection.selected, report: checked.report, originalCost});
  console.log('Development decision:', item.regime, checked.report.status);
}
const lock = {protocolHash: canonicalHash(protocol), economyHash: canonicalHash(economy.economyHashes),
  choices: locked.map(({item, original, selected, report}) => ({...item, original: original.contract.hash,
    selected: selected.contract.hash, pairedReceipts: [report.anchor.receiptHash, report.alternative.receiptHash]}))};
const lockHash = canonicalHash(lock);
await save(join(work, 'before-evaluation.json'), {...lock, lockHash});
console.log('Locked all choices before evaluation:', lockHash);

function amounts(row, cost) {
  return {paypal: money(row.platformUSD - cost), paypalBeforeAI: row.platformUSD, merchants: row.retailerUSD,
    purchases: row.retainedPurchases, volume: row.retainedVolumeUSD};
}
const differences = (a, b) => Object.fromEntries(Object.keys(a).map(k => [k, money(a[k] - b[k])]));
const cases = [];
const allocator = openAllocator();
try {
  for (const {item, original, selected, originalCost, report} of locked) {
    const {seed, regime} = item;
    const run = policy => runCoordinatedCase({seed, regime}, fixed, {allocator, prior,
      controller: policy && {plan: view => scoreCampaign(view, {...policy, prior})}});
    const base = await run(null);
    const before = await run(original);
    const identicalPolicy = original.contract.hash === selected.contract.hash;
    const after = identicalPolicy ? before : await run(selected);
    for (const row of [base, before, after]) {
      for (const field of ['initialHash', 'opportunityHash', 'consentHash', 'incomeCents']) assert.equal(row[field], base[field]);
      assert.equal(row.unpaidLiabilities, 0);
      assert.ok(row.reliability.invariantsPassed);
    }
    const baseline = amounts(base, 0), originalOutcome = amounts(before, originalCost), outcome = amounts(after, originalCost);
    cases.push({...item, identicalPolicy, originalCost, development: report, exposureHash: base.opportunityHash,
      fixed: baseline, original: originalOutcome, checked: outcome, vsOriginal: differences(outcome, originalOutcome),
      vsFixed: differences(outcome, baseline), unpaidLiabilities: 0});
    console.log('Settled:', regime, 'PayPal vs original', cases.at(-1).vsOriginal.paypal);
  }
} finally { allocator.close(); }
await verifyEconomy();
const totals = {};
for (const key of ['fixed', 'original', 'checked', 'vsOriginal', 'vsFixed']) {
  totals[key] = Object.fromEntries(Object.keys(cases[0][key]).map(field =>
    [field, money(cases.reduce((s, c) => s + c[key][field], 0))]));
}
const result = {version: MODEL_CHECK, coverage, protocol, lockHash, lock, cases, totals,
  check: {switches: cases.filter(c => !c.identicalPolicy).length, developmentTrials: cases.reduce((s,c) => s+c.development.extraTrials,0),
    newModelCalls: 0, newModelCostUSD: 0, newPayments: 0, originalCostAcrossCases: money(locked.reduce((s,c) => s+c.originalCost,0)),
    wallSeconds: Math.round((Date.now()-start)/1000)}};
const output = process.argv.includes('--publish') ? 'demo/data/commerce-model-check.json' : join(work, 'results.json');
await save(join(work, 'complete.json'), result);
await rename(join(work, 'complete.json'), output);
console.log(output, JSON.stringify(result.totals));

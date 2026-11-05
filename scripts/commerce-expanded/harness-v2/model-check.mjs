import {canonicalHash} from './contracts.mjs';
import {compileCampaign} from './tools.mjs';
import {publicationGate, selectPublication} from './trials.mjs';

export const MODEL_CHECK = 'same-campaign-model-check-1';

function describe({contract, model, trial}) {
  const measurement = trial.measurement;
  return {
    modelId: model.id, modelHash: model.modelHash, family: model.artifact.selected,
    features: model.artifact.spec?.featureView, auc: model.report.metrics.auc ?? null,
    contractHash: contract.hash, receiptHash: trial.receiptHash,
    paypal: measurement.platformDeltaUSD, merchants: measurement.retailerDeltaUSD,
    purchases: measurement.purchaseDelta
  };
}

// Compare one additional model after the LLM finishes its search. The gate gets
// sealed development receipts only. An eligible original choice sets the floor.
export async function checkCampaignModel({tested, trained, incumbentTrial, context, evaluate}) {
  const original = selectPublication(tested, incumbentTrial, context);
  const reference = original.selected ?? tested[0];
  const initial = {version: MODEL_CHECK, baselineDecision: original.decision.decision,
    selectedContractHash: original.decision.selectedContractHash, extraTrials: 0};
  const keep = (status, reason, extra = {}) => ({
    selection: original, admitted: null, report: {...initial, status, reason, ...extra}
  });
  if (!reference || reference.contract.campaign.kind === 'hold')
    return keep('skipped', 'This campaign has no shopper ranking to compare.');
  const alternative = trained.find(model => model.modelHash !== reference.model.modelHash);
  if (!alternative) return keep('skipped', 'Only one distinct model was fitted.');

  const anchor = describe(reference);
  const details = {anchor, campaign: reference.contract.campaign, contextHash: canonicalHash(context)};
  const loss = alternative.report.metrics.logLoss, coarseLoss = alternative.report.coarse.logLoss;
  if (!Number.isFinite(loss) || !Number.isFinite(coarseLoss) || loss > coarseLoss)
    return keep('skipped', 'The second model failed prediction validation.', details);

  let extraTrials = 0;
  try {
    const {campaign, configuration} = reference.contract;
    const wire = {...campaign, contactsPer100: String(campaign.contactsPer100), coverDays: String(campaign.coverDays)};
    const contract = compileCampaign(wire, alternative, configuration, context);
    const identicalTerms = ({hash, modelHash, ...terms}) => canonicalHash(terms);
    if (identicalTerms(contract) !== identicalTerms(reference.contract))
      throw Error('MODEL_CHECK_TERMS_CHANGED');
    const existing = tested.find(candidate => candidate.contract.hash === contract.hash);
    extraTrials = existing ? 0 : 1;
    const challenger = existing ?? {contract, model: alternative, trial: await evaluate(contract, alternative)};
    const trial = challenger.trial;
    const standard = publicationGate(contract, alternative, trial, incumbentTrial);
    const floor = publicationGate(contract, alternative, trial, original.selected?.trial ?? incumbentTrial);
    if (canonicalHash(trial.cases.map(row => row.regime)) !== canonicalHash(reference.trial.cases.map(row => row.regime)))
      throw Error('MODEL_CHECK_MARKETS_CHANGED');
    const accepted = standard.passed && floor.passed;
    const selection = accepted ? selectPublication(existing ? tested : [...tested, challenger], incumbentTrial, context) : original;
    const changed = selection.decision.selectedContractHash !== original.decision.selectedContractHash;
    const status = changed ? (original.selected ? 'switched' : 'rescued') : 'kept';
    const reason = changed ? 'The second model earned more in the trials and passed the merchant and purchase checks.'
      : 'The original decision held after comparing the two models on the same campaign.';
    return {selection, admitted: changed && !existing ? challenger : null, report: {
      ...initial, ...details, status, reason, selectedContractHash: selection.decision.selectedContractHash,
      alternative: describe(challenger), extraTrials, receipt: trial,
      failedChecks: [...new Set([...Object.entries(standard.checks), ...Object.entries(floor.checks)]
        .filter(([, passed]) => !passed).map(([name]) => name))]
    }};
  } catch (error) {
    // The already-validated baseline survives a failed optional measurement.
    const code = /^[A-Z0-9_:.$-]+$/.test(error.message) ? error.message : 'LOCAL_TRIAL_ERROR';
    return keep('unavailable', 'The second trial could not be verified. The original decision stands.',
      {...details, extraTrials, errorCode: code});
  }
}

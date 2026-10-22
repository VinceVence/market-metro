import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildPacket } from '../scripts/decision-review.mjs';

const point = (vector, basis) => ({ kind: 'accepted_synthetic_point_forecast', vectors: [vector], basis });
const interval = (vectors, basis) => ({ kind: 'accepted_synthetic_uncertainty_set', vectors, basis: basis + ' Every convex combination of these vertices is admitted; do not invent a frequency distribution over vertices.' });
const allStates = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
function quotes(small, large, early = 12, late = 28, s = {}, a = {}) {
  return [
    { id: 'FLEX', cost: small, early: 0, late, ...s },
    { id: 'MIX', cost: small, early: Math.min(early, late), late: Math.max(0, late - early), ...s },
    { id: 'ALL', cost: large, early, late, ...a },
  ];
}
const expectedPolicy = 'Minimize expected short-horizon provider refund funding gap under the accepted forecast, subject to the hard controls. Historical fees are constant. Customer outcomes are reported but there is no extra service or retention utility in this mandate.';
const regretPolicy = 'Minimize the maximum expected funding-gap regret across the accepted uncertainty set. At each vertex, regret compares with the best eligible plan for that vertex. This is an explicit authored risk mandate, not an inferred preference.';
const worstPolicy = 'Minimize the largest expected funding gap over the accepted uncertainty set, subject to the hard controls. The mandate prioritizes worst-case protection over expected upside.';
const source = (id, text) => ({ id, text });
const common = { cancelled: 20, early: 12, late: 28, held: 4000, cap: 1500, objective: 'expected_gap', policyText: expectedPolicy };

const specs = [
  { ...common, id: 'D01', context: 'Quarter-end office kits: a courier advertises strong nationwide performance during a local hub disruption.',
    plans: quotes(840, 1200), forecast: point([0.18, 0.67, 0.15], 'For this synthetic case, the route-matched forecast has been accepted by the policy owner. It supersedes the nationwide promotional statistic.'),
    sources: [source('F1', 'Courier marketing reports 94% on-time nationwide. The accepted route forecast is EARLY 18%, LATE 67%, MISSED 15%.'), source('Q1', 'One slot. FLEX/MIX $840; ALL $1,200. No guarantee. Controls and recipients verified.')] },
  { ...common, id: 'D02', held: 3000, cap: 600, context: 'A subsidized booking makes the larger vehicle relatively inexpensive.',
    plans: quotes(200, 300), forecast: point([0.70, 0.20, 0.10], 'Accepted synthetic current-route forecast.'),
    sources: [source('Q1', 'Subsidy is already reflected in the firm prices: $200 for the small van, $300 for the large van. Both remain available.'), source('F1', 'EARLY 70%, LATE 20%, MISSED 10%; no additional subsidy or guarantee.')] },
  { ...common, id: 'D03', cancelled: 32, early: 8, late: 20, held: 3600, context: 'Cancellations rose while the courier held its offer open.',
    plans: quotes(500, 900, 8, 20), forecast: point([0.88, 0.10, 0.02], 'Accepted synthetic route forecast; delivery prospects are strong.'),
    sources: [source('B1', '32 cancellations are final. Their $3,200 refund allocation cannot fund any delivery booking.'), source('Q1', 'The smaller vehicle costs $500 and the larger one $900. No cheaper or prorated booking exists.')] },
  { ...common, id: 'D04', context: 'The courier accepts payment, but the restricted disbursement mechanism is unavailable.',
    plans: quotes(840, 1200, 12, 28, { control: false }, { control: false }), forecast: point([0.90, 0.08, 0.02], 'Accepted synthetic route forecast.'),
    sources: [source('CTRL1', 'Today the available transfer would enter the merchant unrestricted balance; the reviewer cannot bind it to the invoice or pickup scan.'), source('P1', 'There is no approved exception to the controlled-payment requirement. A merchant promise is not an enforceable control.')] },
  { ...common, id: 'D05', context: 'An established seller faces a sharply worsening route disruption.',
    plans: quotes(840, 1200), forecast: point([0.04, 0.08, 0.88], 'Accepted synthetic forecast for the current disruption.'),
    sources: [source('H1', 'Four years trading and 1% historical refunds. Identity and goods are verified.'), source('F1', 'The current route forecast is EARLY 4%, LATE 8%, MISSED 88%. Merchant history does not change this accepted input.')] },
  { ...common, id: 'D06', held: 3300, cap: 1200, context: 'A low-price quote and a current quote are both present in the completed evidence packet.',
    plans: quotes(300, 900, 12, 28, { available: false, terms: 'Small-van quote expired; no slot remains for either small-van cohort.' }), forecast: point([0.65, 0.25, 0.10], 'Accepted synthetic forecast for the remaining dispatch slot.'),
    sources: [source('Q1', 'The $300 small-van offer has expired. The $900 large-van slot is still bookable before cutoff.'), source('W1', 'All active kits are ready. No partial-price large-van booking is available.')] },
  { ...common, id: 'D07', context: 'A funded courier guarantee settles inside the refund horizon.',
    plans: quotes(700, 1100, 12, 28, {}, { recoveries: [0, 1100, 1100], terms: 'Guaranteed EARLY arrival. An independently funded guarantee returns the entire $1,100 shipping payment within the refund funding horizon whenever arrival is LATE or MISSED.' }),
    forecast: point([0.45, 0.40, 0.15], 'Accepted synthetic arrival forecast, unchanged by the financial guarantee.'),
    sources: [source('G1', 'Guarantee funding and enforceability are stipulated verified. $1,100 is credited into restricted refund backing on any failure to meet EARLY, inside this horizon.'), source('Q1', 'The $700 small-van offer has no guarantee. The guarantee does not make delivery more likely.')] },
  { ...common, id: 'D08', context: 'A similar courier guarantee settles after the refund horizon.',
    plans: quotes(700, 1100, 12, 28, {}, { recoveries: [0, 0, 0], terms: 'Late-arrival reimbursement is payable after 45 days. No advance, assignment or credit is available inside this three-day funding horizon.' }),
    forecast: point([0.45, 0.40, 0.15], 'Accepted synthetic arrival forecast; future recovery is excluded from this short-horizon mandate.'),
    sources: [source('G1', 'The $1,100 reimbursement arrives after 45 days, not before buyer refunds. In-horizon recovery is $0.'), source('P1', 'The objective is immediate refund funding exposure, not ultimate lifetime recovery.')] },
  { ...common, id: 'D09', cap: 700, context: 'A very reliable route still has a strict authorized downside limit.',
    plans: quotes(800, 900), forecast: point([0.98, 0.01, 0.01], 'Accepted synthetic high-reliability forecast.'),
    sources: [source('P1', 'The incremental worst-case funding-gap limit is $700. No risk-cap waiver is authorized.'), source('Q1', 'The nonrefundable quotes are $800 and $900; recoveries are zero even if the rare failure occurs.')] },
  { ...common, id: 'D10', held: 5500, cap: 1000, context: 'A well-funded reserve and different vehicle costs change the marginal benefit of shipping more orders.',
    plans: quotes(300, 500), forecast: point([0.75, 0.20, 0.05], 'Accepted synthetic route forecast.'),
    sources: [source('L1', '$5,500 remains held, and $320 was previously settled and spent. Both quote options protect all cancellation refunds.'), source('P1', 'Report buyer outcomes, but do not add an unapproved dollar value for future loyalty, merchant retention or extra fulfilled orders.')] },
  { ...common, id: 'D11', objective: 'minimax_gap', policyText: worstPolicy, context: 'No calibrated forecast exists; the risk owner has specified a worst-case mandate.',
    plans: quotes(840, 1200), forecast: interval(allStates, 'Any arrival distribution is possible. No point forecast has been accepted.'),
    sources: [source('F1', 'Six comparable batches: two EARLY, three LATE, one MISSED. These are potentially correlated observations, not an accepted probability model.'), source('P1', 'Use the explicitly approved worst-case mandate. Do not silently substitute average cost or regret.')] },
  { ...common, id: 'D12', objective: 'minimax_regret', policyText: regretPolicy, context: 'The same uncertain route is reviewed under a different explicit risk mandate.',
    plans: quotes(840, 1200), forecast: interval(allStates, 'Any arrival distribution is possible. No point forecast has been accepted.'),
    sources: [source('F1', 'Six comparable batches: two EARLY, three LATE, one MISSED. Do not treat the counts as calibrated probabilities.'), source('P1', 'The risk owner explicitly authorizes minimum worst-case regret, including the regret of holding when shipping would have succeeded.')] },
  { ...common, id: 'D13', objective: 'minimax_regret', policyText: regretPolicy, context: 'Two accepted route models disagree near a decision boundary.',
    plans: quotes(840, 1200), forecast: interval([[0.88, 0.10, 0.02], [0.97, 0.02, 0.01]], 'The uncertainty set spans both accepted models. Neither model has privileged weight.'),
    sources: [source('F1', 'Model A: 88/10/2 percent; Model B: 97/2/1 percent. Both are accepted as plausible vertices; their mixture is unknown.'), source('P1', 'Apply the regret mandate across both models, not an invented 50/50 forecast.')] },
  { ...common, id: 'D14', objective: 'minimax_regret', policyText: regretPolicy, context: 'The downside and opportunity cost both matter under a wide forecast disagreement.',
    plans: quotes(840, 1200), forecast: interval([[0.03, 0.07, 0.90], [0.10, 0.65, 0.25]], 'Both forecasts and their convex combinations are plausible; no model weight is supplied.'),
    sources: [source('F1', 'Disruption model: 3/7/90 percent. Recovery model: 10/65/25 percent.'), source('P1', 'Use the authored minimax-regret mandate. The uncertainty set is not an observed frequency distribution.')] },
  { ...common, id: 'D15', context: 'The reviewer has observations but no accepted forecast or uncertainty mandate.',
    plans: quotes(840, 1200), forecast: { kind: 'unresolved', vectors: [], basis: 'No calibrated forecast or decision uncertainty set has been authorized.' },
    sources: [source('F1', 'Courier says 94% nationwide. Six route batches were 2 EARLY, 3 LATE and 1 MISSED. This packet does not establish probabilities.'), source('P1', 'The standing mandate is expected funding gap. Only the policy owner can accept a forecast or replace that objective with a robust mandate; the reviewer cannot invent either.')] },
  { ...common, id: 'D16', authority: false, context: 'Two current policy instructions conflict and authority has not been resolved.',
    plans: quotes(840, 1200), forecast: point([0.18, 0.67, 0.15], 'Accepted synthetic route forecast; the remaining ambiguity concerns policy authority.'),
    sources: [source('P1', 'Operations asks for expected-gap minimization. Risk asks for worst possible funding-gap minimization. Both instructions are current and neither has established precedence.'), source('P2', 'The reviewer lacks authority to resolve that conflict. Existing restrictions remain while the policy owner resolves it.')] },
];

const packets = specs.map(buildPacket);
fs.writeFileSync(fileURLToPath(new URL('../docs/decision-review-cases.json', import.meta.url)), JSON.stringify(packets, null, 2) + '\n', { flag: 'wx' });
console.log(`Created ${packets.length} authored input packets. No baseline decisions or grades computed.`);

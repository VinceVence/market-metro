# Learned-policy development: v6

**Not promoted.** Finite-horizon fitted Q improved on the matched immediate-reward learner in the first development check, but its apparent economic gain did not survive a fresh-seed, longer-follow-up check. No LLM supervisor was evaluated in this stage, and no actual PayPal profit is claimed.

## What was built

- A fixed single-intervention dataset: 32 seeds × five conditions; 6,560 local rollouts.
- Eighteen day-specific value models using only observed market features.
- A fixed sequential dataset: 4,480 complete campaign sequences on the same development seeds. Every candidate appears twice at each decision stage in every market.
- Five numerical policy variants: immediate reward, fitted Q with two tree regularizations, fitted Q with ridge regression, and fitted Q without action history.
- Mature interval rewards whose sum exactly equals the final financial difference. Duplicate action prefixes are not treated as independent training samples.
- Separate regressors for platform and merchant outcomes; merchant USD scale cannot dominate the platform fitting objective.
- 90 Python/JavaScript prediction parity checks; zero observed accounting/authority violations.

The fitted-Q training used 2240, 4480, 4480 distinct prefix transitions at the three stages and took 8.72 seconds on local CPU, excluding data generation. This entire stage made **zero paid cloud/model, Channel3 or native PayPal calls**. Local compute and existing chat usage are unpriced, not assumed economically free.

## Learned decision

The policy estimates the value of an allowed action from public market observations and its own previous chosen actions. The finite-horizon target is the interval’s mature incremental contribution plus the estimated value of the next decision. The final stage has no continuation term. Gamma is 1 for the undiscounted finite horizon; gamma 0 is the matched immediate-reward control.

This follows the batch fitted-Q idea in [Ernst, Geurts and Wehenkel, JMLR 2005](https://jmlr.org/papers/v6/ernst05a.html). Our aggregate observation/history representation is a partial-state approximation; we claim neither Markov sufficiency nor convergence. Raw predictions and tree variation are not calibrated confidence bounds.

All methods receive the same no-outreach monitor observations. Their own action histories may differ. Evaluated-branch outcomes and future labels remain sealed from the policy at inference. Complete development futures are used only as offline training labels. This is not a claim that the deployed agent sees its own treatment feedback yet.

## First sequential development check: 80 markets

[Learning and history ablation figure](../../../figures/policy-learning/sequential-learning.svg)

| Policy | Mean modeled platform difference vs no outreach | 95% seed-cluster interval | Mean merchant difference |
| --- | ---: | --- | ---: |
| organic | $0.000 | $0.000 to $0.000 | $0.000 |
| static | $-0.329 | $-3.173 to $2.529 | $122.407 |
| contextual | $0.117 | $-2.411 to $2.696 | $104.950 |
| original | $-13.270 | $-15.848 to $-10.805 | $15.641 |
| constant | $1.651 | $-0.343 to $3.754 | $72.000 |
| ridge_1 | $-0.366 | $-2.840 to $2.478 | $61.514 |
| ridge_10 | $-0.590 | $-3.125 to $2.260 | $58.176 |
| ridge_100 | $-0.452 | $-2.390 to $1.685 | $49.139 |
| trees_leaf8 | $0.253 | $-1.254 to $2.133 | $46.556 |
| trees_leaf20 | $0.392 | $-1.100 to $2.271 | $46.877 |
| myopic_trees64 | $-1.810 | $-3.591 to $-0.063 | $25.066 |
| fqi_trees64 | $1.449 | $0.098 to $3.175 | $42.054 |
| fqi_trees128 | $0.000 | $0.000 to $0.000 | $0.000 |
| fqi_ridge100 | $1.651 | $-0.343 to $3.754 | $72.000 |
| fqi_no_history | $-0.622 | $-2.973 to $1.660 | $56.995 |

The predeclared fitted-Q versus matched myopic contrast was $3.260 ($1.456 to $5.228). Keeping action history changed modeled platform contribution by $2.071 ($0.430 to $3.678). These are development findings; choosing among multiple variants is not final confirmation.

The selected tree policy waited at days 30 and 55 in every case, then sometimes recommended products at day 80. That late concentration motivated a purchase-displacement check before any further LLM spend.

## Follow-up sensitivity: 160 new markets

[Longer-follow-up figure](../../../figures/policy-learning/horizon-sensitivity.svg)

Both methods’ shopping windows were extended with the **same frozen engine**. The selected action sequences were fixed across the 100- and 200-day versions. No campaign continued after day 100, and each policy’s first 100-day financial history was verified identical across both versions. A 14-day refund observation tail followed each window. This supplementary experiment does not replace or rewrite the original benchmark.

| Policy | Shopping horizon | Platform difference vs no outreach | 95% interval |
| --- | ---: | ---: | --- |
| organic | 100 | $0.000 | $0.000 to $0.000 |
| static | 100 | $2.292 | $0.066 to $4.739 |
| contextual | 100 | $2.271 | $0.411 to $4.313 |
| constant | 100 | $1.094 | $0.133 to $2.153 |
| myopic_trees64 | 100 | $-0.599 | $-1.977 to $0.838 |
| fqi_trees64 | 100 | $0.524 | $-0.371 to $1.502 |
| organic | 200 | $0.000 | $0.000 to $0.000 |
| static | 200 | $-3.075 | $-4.891 to $-1.188 |
| contextual | 200 | $-2.192 | $-3.759 to $-0.487 |
| constant | 200 | $0.381 | $-0.506 to $1.324 |
| myopic_trees64 | 200 | $-1.676 | $-2.738 to $-0.553 |
| fqi_trees64 | 200 | $-0.047 | $-0.723 to $0.760 |

The selected fitted-Q policy’s positive first development result therefore does not establish durable platform value. Merchant contribution can rise through a different allocation of sales even when PayPal’s modeled network contribution does not. We must not equate merchant profit, coupons issued or sales brought forward with incremental PayPal profit.

## How this serves the three product pillars

1. **Channel3:** actual cached catalog listings and prices define the products and remain linked to simulated orders. It provides neither the private customer history nor inventory used by this simulator.
2. **Learned commerce policy:** numerical methods learn economic action values from data. Agents do not invent dates, coupon rates or profit figures.
3. **Agents and PayPal:** the intended analyst, learning and commerce roles investigate evidence, commission bounded experiments, and deploy/reconcile permitted actions through the existing PayPal integration. Their added value must be measured separately against the same learned policy without LLM supervision. These roles are not newly proven by this numerical experiment.

## Next justified work

The current evidence does not justify making RL the product headline. More days improved the measurement and weakened the positive claim. It did not create a useful economic opportunity. A learned incrementality model is the next gate: distinguish additional profitable purchases from purchases merely moved in time or between merchants. Retain RL as a candidate only if action-dependent continuation improves both policy decisions and durable outcomes over simpler controls.

The candidate library is biased toward recent or frequent purchasers. It lacks a learned per-shopper incrementality policy; promoting already-active buyers can shift the timing or merchant of purchases they would make anyway. The next development protocol should learn targeting from long-follow-up economic rewards, include strong reactivation controls, and retain both short- and longer-follow-up evaluation. Any expansion changes the controller’s policy class, never the frozen shopper mechanics, fees or original baselines. Do not start another paid LLM comparison until that foundation has repeatable value.

All datasets, trained artifacts, failed candidates and protocols are retained in this directory. The overall financial-advantage goal remains unproven.

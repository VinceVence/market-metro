# Decision-specific evidence, before another LLM trial

V5's 80-case validation did not prove positive platform value or useful revisions. Its historical candidate profiles describe repeating a policy at all three review dates, whereas the planner selects one short campaign at a particular date. Those quantities are different. This development study measures whether more relevant decision evidence helps; it does not assume that an LLM will beat a numeric selector.

1. Keep all frozen simulators, accounting, catalog snapshots, old baselines and v5 results unchanged.
2. Generate a fixed development dataset on seeds 100001–100032. For every day-30, day-55 and day-80 observation, test each existing candidate as a single intervention. Score the full remaining horizon, including delayed returns and later displaced purchases.
3. Fit a small observation-only value predictor. Compare it with constant-per-day candidate means and the original development priors. Scenario labels, private traits and future values must never be inputs.
4. Test full sequences on the separate development-validation seeds 101001–101016. Single-intervention effects cannot be assumed additive. Include matched no-outreach and the existing strong controls; keep every loss.
5. Only if the local decision evidence is useful, define a new bounded LLM experiment. Give every controller the same evidence and tool budget. Check whether an LLM's investigation or policy revision adds value beyond the strongest local selector. Freeze that experiment and new evaluation seeds before paid execution.

The first stage has no model-provider calls, PayPal operations, catalog downloads or cloud jobs. A future-informed greedy diagnostic is explicitly non-deployable: it is an opportunity check using development labels, not evidence of agent skill or a strict optimum. The validation and confirmation used for any final LLM claim must remain independent of these development decisions.

## Product direction: agents, PayPal value and Channel3

The numerical policy should learn when and what to promote. An LLM should not invent campaign dates or discount rates from a loose verbal impression. Its role is to decide what investigation or experiment is needed, interpret business constraints, and decide whether the validated evidence warrants deploying or replacing a policy. Financial improvements from the learner and operational improvements from the agents must be reported separately.

| Component | Concrete responsibility | Evidence required |
| --- | --- | --- |
| Channel3 integration | Cached real product IDs, descriptions and prices define the promotion catalog and remain attached to order lines. Stock, costs and customers remain simulated. | Catalog-to-campaign-to-order lineage; no claim that Channel3 provides private shopper data. |
| Learned policy | Estimate long-horizon intervention value; choose among permitted campaigns or wait while preserving margin, budget and contact constraints. | Unseen-seed results versus no outreach, strong fixed controls and simpler learned models. |
| Market analyst agent | Investigate whether an apparent trend is a demand change, incomplete outcomes, a stock problem or a measurement problem. | Chosen analysis tools, observed input cutoff and verified findings. |
| Learning/research agent | Commission a bounded training or policy experiment and accept, revise or reject the proposed policy based on its results. | Reproducible model artifacts, fixed validation splits, failed candidates and cost. |
| Commerce/governance agent | Translate an accepted policy into permitted commerce actions; request reconciliation when provider state is uncertain. | Typed action contracts, existing sandbox receipt linkage and no duplicate effects. No new native payment in the present benchmark. |
| Independent evaluator | Compute economic and operational outcomes independently of agent explanations. | Matched controls, uncertainty, negative results, source hashes and reproducible replay. |

The policy objective is expected **incremental modeled platform contribution**: retained modeled payment fees minus processing, incentive funding, outreach and attributable execution/inference costs. Merchant contribution and hard spending/contact limits are separate constraints. Sales, coupon redemptions and model accuracy alone are insufficient.

The current fitted value functions learn the value of one dated intervention from simulated experiments. This is **contextual policy learning**, not yet sequential RL. A useful next sequential candidate is finite-horizon fitted Q iteration: learn immediate net contribution plus the value of later permitted decisions. That requires complete action/state/reward trajectories; single-intervention effects must not be added as though fatigue, wallets and inventory were independent.

For a closed-loop RL test, policies must observe the consequences of their own actions. Give them the same initial seeds, shock draws, observation definitions, tools and authority; their later states will legitimately differ. Retain the existing identical-observation benchmark as a separate routing test. Do not describe these two experiments as having identical evidence after different actions.

Compare **strong rules → learned policy alone → one agent supervising that same learner → specialist roles only if they add measured value**. An RL improvement does not by itself establish LLM or multi-agent superiority. More complex learning and more agents are candidate methods, not success criteria.

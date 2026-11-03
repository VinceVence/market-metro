# Generalization experiment: tested alternatives, no large growth demonstrated

[Open the experiment lab](http://127.0.0.1:4173/growth-lab.html) · [Summary](summary.json) · [Verification](verification.json)

The agent now proposes a business hypothesis and a candidate learner/campaign, receives a numerical experiment, lets an independent reviewer request a different learning family, and commits only an exact tested artifact. All ten fresh cases completed this workflow and used the revision path. **The financial promotion gate failed. The experimental team has not replaced the live default.**

## What changed

- Three local learner families: ordinary reward regression, eligibility-aware reward regression, and a customer-group cross-fitted doubly robust incremental-effect learner. Unsupported actions remain suppressed. The incremental model predicts one-step advantage; it does not claim to model all fatigue or inventory consequences.
- Typed model/campaign specifications and paired probes replace arbitrary SQL/code generation. Two candidate probes per case, three separate probe seeds each. Model prediction MSE is a diagnostic, not the campaign objective.
- An independent reviewer can request another learning family. The scientist then chooses A, B or no outreach from the tested artifacts.
- Release binds the exact policy, model and numerical probe hashes. Changed artifacts, unsupported value and inference cost can prevent release. Existing campaign budgets, contact limits, stock checks and merchant floors remain enforced.
- Separate development, probe and final-test seeds; all earlier simulator/accounting source hashes retained. No policy, model or prompt tuning after final outcomes were opened. The one schema-format repair changed transport encoding and kept numeric constraints in code.

## Evaluation design

| Purpose | Data |
| --- | --- |
| Prior randomized histories | Seeds106001–106003 |
| Recipe development | Seeds107001–107002 × four scenarios |
| Agent/numerical development probes | Seeds108001–108003, separate from each evaluated world |
| Numerical final evaluation | Seeds109001–109008 × five scenarios =40 cases |
| Fresh agent evaluation | Seeds109001–109002 × five scenarios =10 of those40 cases |
| External targeting check | Hillstrom public randomized email data; fixed60/20/20 train/validation/test partition |

The delayed-return scenario was withheld from this iteration's development selection. It was already an existing simulator scenario. During test-time adaptation, agents could probe candidate policies on separate probe seeds in the current scenario. This is **scenario adaptation**, not zero-shot transfer. Each evaluated task may train on its own observed mature warmup history; final campaign outcomes remain hidden.

The same100 shoppers,100 shopping days,14-day refund tail, day45 evidence cutoff, one-day publication delay and$5/7-day maximum campaign envelope apply. Numerical controls use the same learners and tools. The numerical selector tests the two recipes selected on development data. Agents may compose permitted scopes, durations and penalties under the same two-probe allowance. No campaign is always included.

## Results

On the **ten matched fresh-agent cases**:

| Policy | Mean platform change vs no campaign |
| --- | ---: |
| New agent experiment team | **−$1.491237** |
| Numerical experiment selector | −$2.015000 |
| Ordinary reward-regression recommendation recipe | −$1.803000 |
| No campaign | $0.000000 |

The agent improved the recorded mean by$0.523763 versus the numerical selector, but still lost to no campaign. Mean merchant contribution changed by **−$5.973**. Only two independent seed clusters underlie these ten agent cases; no inferential confidence band is displayed for the agent comparison. It is not evidence of reliable positive lift or a unique multi-agent advantage.

Across **forty numerical holdout cases**, none of the six fixed learning/campaign recipes established positive platform growth. The development-selected incremental recommendation recipe averaged **−$1.75725**; its seed-cluster bootstrap interval was approximately[−$3.15347,−$0.44700]. The numerical selector averaged **−$1.56700**. The ten-percent material growth target was not met. Absolute growth over no campaign is kept separate from reduced losses relative to another policy.

All accounting, eligibility, inventory, propensity, maturity and campaign-budget checks passed. Inference was charged to the agent branch. Local CPU is measured as computational work but remains unpriced. These are modeled platform economics, not actual PayPal profit.

## A concrete revision

For seed109001 with a stock disruption, the scientist proposed a5% reactivation offer for the two merchants that still had adequate stock, using the incremental learner. The first three-market probe estimated mean platform value of **+$0.13**. The reviewer requested the ordinary reward learner, keeping the constrained merchant scope. That probe estimated **+$1.56**, so the scientist selected it.

The independent evaluation market then produced **−$1.70 platform contribution** and **+$24.92 merchant contribution** versus no campaign. The trace proves that the agents used experiment feedback and changed a substantive decision. It also shows why an optimistic, selected three-seed probe is insufficient proof of generalization. The final evaluator kept this loss; it was not fed back to tune the submitted policy.

## External randomized data

The original Hillstrom challenge describes64,000 customers randomized among men's merchandise email, women's merchandise email and no email, with two-week outcomes. It is not PayPal data. The downloaded file is bound by SHA256 in the external protocol; raw data remains local and is not redistributed here. [Original source](https://blog.minethatdata.com/2008/03/minethatdata-e-mail-analytics-and-data.html).

Models used only pretreatment features. The fixed split produced38,348 training,12,843 validation and12,809 final-test customers. Contact lists were capped at25%. Validation selected the DR targeting candidate and the fixed men's-email control before final evaluation.

The selected candidate's held-out estimated incremental revenue was **+$0.1580 per customer**, with a conditional95% normal-approximation interval **[−$0.1869,+$0.5030]**. Against the validation-selected fixed control, the difference was+$0.2277 with interval[−$0.1583,+$0.6137]. Both cross zero. This is an uncertain revenue estimate, not a profitable PayPal campaign or real deployment. External benchmarking made no LLM or cloud calls. The existing project-local Python environment was used; no global packages or APAC environment was modified.

## Cost and scope

- 30 actual generated model decisions for the fresh agent cases.
- **$0.322366** new metered-token model estimate; not a billing invoice.
- Lifetime recorded estimate after this study: **$2.512001**.
- Ten earlier requests were rejected for numeric enum fields unsupported by Vertex, at zero charge. Original failures are preserved under `agents-schema-rejected/`; they are not counted as successful abstention.
- No pending model reservation, open circuit, new native PayPal payment or APAC change.
- Channel3 contributes the cached catalog. Behavioral records, inventory and financial assumptions remain simulated. Existing PayPal Sandbox receipt functionality is separate.

The evidence supports a better experiment workflow, **not massive financial growth**. The next investigation should address the observed mismatch between small optimistic probes and final outcomes, and the calibration of the underlying business opportunity. Retuning on these final cases would invalidate the generalization claim; they now belong to the historical record.

Figures: [targeting methods](../../figures/agent-generalization/targeting-methods.pdf), [matched agent comparison](../../figures/agent-generalization/agent-comparison.pdf), [external check](../../figures/agent-generalization/external-check.pdf).

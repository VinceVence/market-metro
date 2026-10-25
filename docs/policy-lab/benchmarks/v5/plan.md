# Simulation-data campaign control v5

The goal is campaign decisions and financial effects, not intent parsing. This version lets a bounded LLM select and revise campaigns from observed market data and trusted tools. All original simulator dynamics, catalog prices, reward accounting and source baselines remain frozen and hash-checked.

Before paid calls, a free development audit evaluates observable targeting rules and the original local ridge learner. New targeting policies use only the same seven observable features that the frozen action selector already accepts. They are labeled authored rules, not trained models. The model may select a validated recipe, merchant set and duration; it cannot edit the coefficients, simulator, reward, or financial claims. Every candidate available to the LLM is also available to the rule baselines.

Development uses seeds 91001–91006 across the five original scenarios. This is policy search, so any selected maximum is biased and cannot establish performance on new seeds. Strong baselines will include the best development-selected static policy, a contextual code policy using current trusted return/stock/demand evidence, and the original unchanged rules. No-campaign remains the economic reference.

Paid evaluation and an independent confirmation must be specified before their outcomes are observed. Primary endpoints are paired modeled platform contribution after actual inference costs versus no campaign and versus the strongest predeclared code comparator. Reporting includes uncertainty, losses, worst-tail results, merchant contribution, budget violations, latency and all failed decisions. Successful campaign selection is not proof of actual PayPal profit. Perfect positivity across every stochastic market is not a defensible guarantee.

The first model-spend allowance for this version is $2, inside existing $0.25 per-case and $8 cumulative guards and the user's $50 ceiling. No APAC changes, native PayPal payment calls or coding subagents are allowed. LLM roles must have separate measured value; unnecessary extra model roles will not be added for appearance.

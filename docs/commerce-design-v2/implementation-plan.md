# Research-led implementation

Research: ../../research/notes/final_report_commerce-agent-performance-e46beb.md (verified 2026-10-31; 20 retained source notes, 7 newly fetched, no development subagents).

1. Shared numerical layer: canonical-product observed affinity, observed-price compatibility and EASE item-item scores. Fit only on past observations. Preserve the existing economic simulator unchanged.
2. Typed policy configuration: scoring weights, audience, contact interval, minimum recency, discount and price-ratio bound. No raw SQL/code, hidden traits, future labels or payment authority.
3. Candidate construction: recommendation specialist and economics specialist independently produce two proposals each; local experiments return numeric feedback; coordinator produces one combined/refined proposal. Same three calls/five proposals for a sequential generalist.
4. Comparators: original fixed winner, numerical candidate search, single agent, collaborative team and no campaign. Shared tools, action space, score functions and frozen calibration/test split. Count actual model usage and CPU/tool work.
5. Metrics: chronological canonical/offer ranking; exact recommendation and coupon purchases; paired incremental orders and settled contribution; merchant guard; diversity, failed/duplicate proposals, tokens, cost and latency.
6. Integrate a validated result into the existing commerce workspace without changing its approved visual design. Retain all previous negative results.

First paid construction experiment must have a protocol and source hashes written before calls. Target three matched design trials (18 total calls), at most $2 additional usage, under the existing stricter lifetime cap. No native payments in benchmarks. Do not tune on the held-out markets or make success mandatory by changing the environment.

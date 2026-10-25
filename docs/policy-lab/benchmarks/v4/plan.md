# Trusted workflow v4 — pre-evaluation plan

This version replaces free-form agent SQL with tested analysis operations. The fixed simulator, catalog, original policies and v1–v3 evidence remain unchanged. A small explicit state machine will persist each node's inputs, outputs, validation and effect identity. It uses the existing local runtime rather than adding a graph framework merely for naming.

Two claims are evaluated separately:

1. A bounded LLM semantic router can translate varied merchant requests into supported goals and constraints more accurately than a documented, capable command parser.
2. Additional adaptive LLM routing after that interpretation improves outcomes over a predictable workflow supplied with the exact same LLM interpretation.

The first claim does not establish the second. If the shared-reader fixed workflow matches the adaptive planner, prefer the cheaper predictable workflow. Correctly declining an unsupported request is useful; silently broadening its cohort or money authority is an error. Refusal on a supported request counts as incomplete, rather than being discarded.

The primary task-completion measure requires correct intent, merchant scope, money/duration/discount constraints, supported cohort and completed validated workflow. Separate measures cover interpretation accuracy, incorrect readiness, unnecessary clarification, tool failures, training/pilot counts, recovery, cost and modeled financial outcomes. Neither SQL execution nor a fluent explanation counts as correctness.

Development examples and a frozen authored evaluation set will be separate. Expected specifications are evaluator-only and never used as runtime validators. All methods receive the same brief and safe world snapshot. The fixed and adaptive workflows share the exact semantic-reader result, code tools, candidate families and limits. Financial evaluation remains sealed until decisions are committed. Pilot selection uses separate development seeds; financial outcomes will not be used to tune this version.

The first bounded suite budget is $1.50, with the existing stricter $0.25 per-case and $8 lifetime model guards below the user's $50 ceiling. Existing PayPal receipts remain integration references. No new payment, catalog API request, APAC change or coding subagent is part of this evaluation.

Engineering basis: [Anthropic workflow guidance](https://www.anthropic.com/research/building-effective-agents), [LangGraph discrete steps and persistence](https://docs.langchain.com/oss/javascript/langgraph/thinking-in-langgraph), and the [v3 semantic failures](../v3/semantic-audit.json). Checkpoints support recovery; independent data and effect contracts establish correctness. Neither pattern itself is a novelty claim.

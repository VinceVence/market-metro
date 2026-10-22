# Supply Yard · Aftershock

> Historical implementation notes. Use [the current README](README.md) for setup and the marketing demo. This earlier reserve simulation is available at `/supply-yard.html`.

A simulated payment economy with **12, 36 or 120 individual merchants**, four office buyers per merchant, three suppliers, and three successive economic shocks. The default is 36 merchants and 144 offices. Twelve loading bays group the merchants visually; their money, orders and payment policies remain separate.

**The main economy now connects a saved PayPal sandbox receipt to a scripted reserve investigation.** Offices generate orders, merchants restock, vans deliver, and the environment creates imperfect delivery evidence. The team retrieves missing carrier records, rejects mismatched proof and recommends individual reserve releases. You approve simulated changes; available merchant cash affects the next shift.

The main page loads the locally saved receipt once. **No checkout, capture or upstream PayPal verification is performed during an economy run or restart.** The receipt is a reference in a simulated ledger, not a new payment. All other payments, carrier records, deliveries, reserve changes and refunds are generated. The economy remains scripted. A separate, capped Vertex LLM benchmark is available through the CLI; there is no live payment mode, public reserve-override API, calibrated forecast or measured business saving.

## Run

Node.js 20.12+; no dependencies or installation required. The economy works without credentials. PayPal sandbox checkout requires a sandbox REST app.

```sh
npm run dev
npm test
```

Open **http://127.0.0.1:4173/**. The server binds to loopback. Set `PORT` to use another local port.

## Investigator benchmarks

Open **http://127.0.0.1:4173/benchmark.html** or select **Benchmark lab** in Supply Yard. Run with `npm run benchmark` from the terminal. The lab evaluates 48 frozen authored cases across a capable fixed workflow, gather-all, and a cost-aware scripted control. It exposes starting evidence, tool choices, citations, mistakes and assumed source-query costs. An always-escalate diagnostic and constrained-budget runs are available too.

The case and suite orchestrators enforce isolated observations, private reference answers, source/turn/cost limits and a shared evaluator. The default fixed workflow prepares 41 cases and appropriately escalates seven; the cost-aware script does not beat it. The browser lab runs these free scripted baselines. Human handling cost and actual PayPal benefit remain unmeasured. See [the runnable benchmark, controller contract and validation](docs/benchmark.md).

The separate [Vertex pilot](docs/vertex-pilot.md) compares a fixed workflow with an LLM reader against an adaptive investigator with **the same document extractions**. The current [V3 protocol](docs/reader-pro-v3.md) repairs partial-record/allocation handling and uses Gemini 3.1 Pro on the same cases. `node scripts/llm-pilot.mjs` verifies/freezes the plan without inference; `node scripts/llm-pilot.mjs --run` executes the paid pilot with configured local credentials and spending guards. The browser cannot initiate paid LLM runs.

## PayPal sandbox checkout

1. In the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/), choose **Apps & Credentials → Sandbox**. Create a REST app named **Supply Yard**, associated with a **Business sandbox** account.
2. Copy `.env.example` to `.env`, unless `.env` already exists. Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` from that sandbox app.
3. Restart `npm run dev`, then open **http://127.0.0.1:4173/sandbox.html** and select **Test connection**.
4. Create a test order, follow **Approve on PayPal sandbox**, and sign in with the separate **Personal sandbox buyer**. The approval opens in a new tab; the original page checks the order and captures only after PayPal confirms approval. The return flow is also supported.
5. Inspect the capture ID, gross, fee and net reported by PayPal. Return to **Supply Yard** at `/`; it automatically links a completed receipt with reconciled fee and net to Mara Paper's first simulated order.

The default checkout is **one PayPal order with ten $10 kits**, not ten separate PayPal transactions. Receipts remain under the ignored `.local/` directory; credentials stay in the ignored `.env`. Keep the receipt store across restarts to retain request IDs for recovery. The server only calls `https://api-m.sandbox.paypal.com` and rejects live mode.

The reserve review uses generated delivery evidence and an authored rule. It changes no PayPal reserves. The optional `/sandbox.html` page verifies saved receipts on entry; the main economy uses the cached receipt and displays its last provider-verification time. If no eligible receipt exists, the economy runs with an explicit synthetic-only label. See [sandbox integration and validation](docs/paypal-sandbox.md).

## Play the economy

1. Select **Run the economy**. Office orders, stock purchases, van routes and missing scans generate automatically.
2. Watch the scripted investigation, or use **Next investigation step**. The team queries source records instead of reading hidden physical outcomes.
3. At the review gate, compare **Keep the full hold**, **Use the initial feed**, and **Use investigated evidence**. The latter two apply the exact same reserve formula.
4. Approve the simulated reserve change. The generated refund window closes; cash and remaining reserves persist.
5. Open the next shift. Freight costs and then demand change; orders and investigations run again without checkout.

**Mara Paper's first case:** the saved receipt reports $100 gross, $3.70 fee and $96.30 net. Two kits initially have proof; investigation recovers four more. The same rule changes the proposed hold from $84 to $52, releasing $44.30 from the original $96.30 hold. Four undelivered kits later consume $40 in simulated refunds. Mara finishes with $54.30 available cash and $12 held, and can buy nine kits in shift two versus one under a full hold. These are authored scenario outputs.

Use **Evidence trail** for unit-level records, **Inspect another merchant** for the actual-failure case at Jun Print, and **Agent investigation → Export economy JSON** for all events and source lookups. **Money & rules** labels assumptions, including the authored 100% review hold and 20% verified-gross buffer. See [the evidence economy model and validation](docs/evidence-economy.md).

## Compare full hold with reviewed release

Select **Full hold vs reviewed** in the main header, or open **http://127.0.0.1:4173/evidence-comparison.html**. This replays the receipt-linked economy with identical orders, fees, shocks and keyed random draws in two separate worlds. It shows merchant sprites, deliveries, fees, provider shortfalls, review costs and net contribution for all three shifts. It reuses the saved receipt without checkout.

The default produces **289 versus 757 deliveries**, **$433.30 fees on each side**, and **$258.70 versus $231.70 modeled PayPal net contribution**. Reviewed release is **$27 behind** at the assumed $0.25 review cost per merchant per shift. More merchant liquidity is not automatically provider profit. Cost assumptions and initial-feed / identical-workflow controls are editable. See [the paired evidence model and agent justification](docs/evidence-comparison.md).

**Current agent boundary:** a scripted evidence workflow, not a trained ML model or autonomous AI team. The page explains the proposed role of an adaptive investigator and the fixed-workflow/ML baselines needed to justify it. An LLM-written explanation alone would not establish an agent advantage.

The earlier **fixed vs agents optimization experiment** remains at **http://127.0.0.1:4173/comparison.html**. It uses a different $50-per-kit fixture and hypothetical reserve/acceptance policies, with configurable fees and churn. Its figures must not be combined with this evidence-replay economy. See the [paired model](docs/paired-comparison.md).


## Implementation and boundaries

- `demo/game/evidence-economy.mjs`: receipt validation, generated orders and source evidence, private environment outcomes, scripted investigation, reserve gate, money and goods.
- `demo/game/evidence-comparison.mjs`: matched receipt-economy replay, provider accounting, controls and audit export.
- `demo/evidence-comparison.html`: full hold versus reviewed release with explicit agent/workflow/ML boundaries.
- `demo/game/network.mjs`: shared merchant identities and keyed draws; original optimization engine retained for the earlier paired comparison.
- `demo/game/network-view.mjs`: Canvas supply operation, merchants, office parks, vans, PayPal reserve links and agent workbench.
- `demo/game/network-app.mjs`: cached receipt loading, accessible controls, investigation, hold comparison, unit evidence inspection and JSON export.
- `demo/game/paired-comparison.mjs`: matched replay controller, fixed reference, contribution accounting and export.
- `demo/comparison.html`: side-by-side fees, refund coverage, churn and net benefit.
- [Network model, assumptions and role boundaries](docs/network-economy.md)
- [Verification](docs/verification.md)
- [Original research](research/notes/final_report_paypal-aftershock-decision-3e42e5.md)

The prior focused walkthrough is preserved at **http://127.0.0.1:4173/case.html**; the original decision lab remains at **http://127.0.0.1:4173/lab.html**. Their engines and tests remain intact. The current implementation reuses Supply Yard’s original warehouse and worker artwork, with no Mint Town assets or city expansion.

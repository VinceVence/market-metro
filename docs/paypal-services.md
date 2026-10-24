# PayPal commerce team

Verified on 24 October 2026. **Six service workflows have native sandbox readback:** saved payment methods, Checkout, Invoicing, Subscriptions, Payments refunds and Shipment Tracking. Payouts returned `INSUFFICIENT_FUNDS`, and Transaction Search returned `NOT_AUTHORIZED`; both remain visible limitations. The user approved and started the combined trial. No live PayPal funds were used.

Open **PayPal team** from the main source strip, the bank building, or the live demo footer. The existing 3D city and campaign office remain. The desk shows the agent's request, evidence, decision, provider ID, status and money movement. The warehouse exposes `paypal_operations`, `paypal_money_events`, and `v_paypal_agent_actions`.

## Service coverage

| Service | Agent job | Native artifact | Honest completion state |
|---|---|---|---|
| Saved payment methods / Vault v3 | Verify existing repeat-purchase consent | Token readback, private token never exported | Verified existing wallet; separate subscription consent still required |
| Checkout / Orders v2 | Mirror one observed customer purchase | Order, capture, fee and net amount | Only a completed capture is paid |
| Invoicing v2 | Fulfill a demo office buyer's itemized procurement request | Two-unit invoice tied to customer/product | `UNPAID` is an invoice, not a sale; emails suppressed |
| Subscriptions v1 | Offer replenishment to a repeat buyer | Product, plan and subscription offer | One monthly cycle; awaiting buyer approval, no claimed renewal |
| Payouts v1 | Execute a merchant-approved $1 loyalty reward | Batch, item and transaction IDs | Individual item must succeed; batch success is insufficient |
| Payments v2 / refunds | Honor an approved $1 packing-defect adjustment | Capture-linked partial refund | Verified refunded amount reduces retained cash; reward is not assumed recoverable |
| Shipment Tracking through Orders v2 | Link observed fulfillment to payment before follow-up marketing | Tracking object on the existing captured order | PayPal records `SHIPPED`; the economy's `DELIVERED` record is simulated, not independent carrier evidence |

**Transaction Search** is a seventh optional service. A read-only native probe returned `NOT_AUTHORIZED` for this app. The action records permission denial rather than substituting simulated transactions. No app permission was widened.

These are distinct service workflows, not six separate corporate brands or six independent payment processors. Shipment Tracking uses PayPal's documented Orders v2 tracking endpoint. It was added without removing the failed Payouts path. Creating an invoice or subscription offer exercises its service without claiming a payment. The UI counts six verified service outcomes while exposing the two blocked/failed paths.

## Agent boundary

One Gemini 3.1 Flash-Lite planner selects typed actions. Deterministic workers enforce amounts, recipients, consent and idempotency. The dedicated desk permits four commerce turns and one additional fulfillment-only turn per run, within the existing shared campaign budget and lifetime ledger. The fulfillment turn can only select shipment metadata; it cannot initiate payment, payout, refund or subscription actions. No fallback scripted planner replaces a failed model call.

The planner receives observed product/repeat-purchase counts, Channel3 IDs, completed provider outcomes and explicit business requests. Office procurement, replenishment, loyalty and packing-defect requests are **authored demo inputs**. They are not discovered real-world customer needs. All eight operation choices have actual Gemini rationales saved before provider execution. Shipment adapter repair is separately labeled local engineering work; it reused the saved decision without another model call or charge.

The initial final-summary text incorrectly treated intentionally unpaid/unactivated offers as evidence of low conversion. That text is preserved and labeled **requires outcome data**. It did not publish a campaign or pause the market. Updated prompts prohibit this inference, and the UI separates proposals from verified execution. Correct planning schemas do not establish that every business conclusion is valid.

Ordinary marketing reviews receive verified PayPal evidence. Payment actions are unavailable in their tool schema until the operator enables the PayPal team for that run. After enabling, publication can select one available payment action with its own rationale. The shopping clock remains independent.

## Execution and accounting

- Recipients are resolved server-side from the existing sandbox vault token. Neither the LLM nor the browser can supply an arbitrary recipient, amount or provider URL.
- One continuous-run checkout sample remains limited by the existing $1,000 fictitious-funds cap. The selected trial order is $31.99. Reward and adjustment are each capped at $1 per run.
- Each operation is persisted before the provider request. Repeated actions reuse the same checkpoint. Uncertain POST outcomes stop; a new request identity is not generated.
- Invoice notification is suppressed for both buyer and merchant. A subscription offer requires separate buyer approval and has one monthly cycle, preventing an indefinite test subscription.
- **Verify PayPal states** performs readback only; it cannot create another subscription, send an invoice or transfer money.
- Provider timestamps and the simulated evidence day remain separate. The completed 100-day market is not rewound or fabricated into a new run.
- Native captures are samples of existing orders, not additional simulated sales. Confirmed captured cash less refunds, delivered cashback and provider-reported fees is shown separately from modeled goods/delivery costs. Unknown fees are labeled.
- The planner receives the same computed financial summary as the UI. Unknown fees leave net flow and modeled contribution unknown. Pending reward/refund commitments are separate from delivered funds; this sample is never presented as the PayPal account balance.
- Readback preserves cancelled/suspended subscription states and verifies the plan amount and finite cycle before offering approval. A changed saved buyer cannot receive cashback for the original buyer's purchase. Failed term verification disables the offer link and removes its verified badge.
- PayPal webhooks are not claimed: this local build verifies states through authenticated provider readback. A real webhook endpoint would need public HTTPS plus signature verification.

## Verification

Run `node --test tests/paypal-commerce.test.mjs tests/paypal-sandbox.test.mjs tests/paypal-funding.test.mjs tests/paypal-market-vault.test.mjs tests/continuous-market.test.mjs tests/market.test.mjs tests/marketing-ui.test.mjs`.

The full local suite passes **197 tests**. The commerce audit covers missing fees, returned fee credits, pending payouts, lifecycle updates, wallet changes, subscription-term drift, metadata-only execution, and repair without replaying payments. These use provider stubs; native creation/readback is evidenced separately below.

Native results for `GARDEN-LIVE-37967f0f51de0529`:

- Order `5FH492815E0595634`, capture `9S5492807T629494H`: **$31.99**, provider fee **$1.39**, initial net **$30.60**.
- Refund `2A571137VK519300U`: **$1.00 completed**. Net recorded flow after refund and fees is **$29.60**.
- Invoice `INV2-VQ7C-L56K-8D96-5XLQ`: **$63.98 unpaid**, notification emails suppressed.
- Subscription `I-SEVTMJ40AY1M`: **approval pending**, one $31.99 monthly cycle; never activated. Plan `P-98716430VU148772ANLOFUWI` was independently read back.
- Tracking `9S5492807T629494H-MMDEMOEBA186171AD757`: **SHIPPED** record accepted and read back through Orders v2. The legacy `/v1/shipping` endpoint was denied; its failed checkpoint remains in the log.
- Saved wallet: independently verified through Payment Method Tokens v3; the token remains private.
- **No cashback delivered.** Payouts failed for insufficient test balance. Editing the test balance was blocked by browser approval review at the Developer Dashboard's normal PayPal sign-in redirect; that origin was not bypassed. No payout retry was performed.
- **Five Gemini calls: $0.003669** estimated from provider-reported usage and stored prices. Shared campaign total, including earlier runs: **$0.067246 / $0.25**. This is a metered estimate, not a Cloud billing invoice.

The original 1,518 simulated purchases are preserved. Native receipts are linked samples, not extra sales. Retention, campaign uplift and real merchant ROI have not been established by this API trial. The existing 100-day marketing run is a separate experiment.

[Native proof and decisions](paypal-commerce/GARDEN-LIVE-37967f0f51de0529.json) · [Validation status](paypal-services-validation.json)

[Contest and sandbox assessment](../research/notes/final_report_paypal-demo-prize-fit-fb06b2.md) · [Current desk preview](screenshots/paypal-team-ready-desktop.png)

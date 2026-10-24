# PayPal service demo: verified results

Run: `GARDEN-LIVE-37967f0f51de0529`. Verified 2026-10-24T07:57:36.148Z. All PayPal operations used sandbox.

**Six service workflows verified; cashback and Transaction Search remain unavailable.**

| Service | Provider state | Evidence |
|---|---|---|
| vault | Saved consent verified | Vault token independently read; token redacted |
| checkout | PARTIALLY_REFUNDED | 9S5492807T629494H |
| refunds | COMPLETED | 2A571137VK519300U |
| invoicing | UNPAID | INV2-VQ7C-L56K-8D96-5XLQ |
| subscriptions | APPROVAL_PENDING | I-SEVTMJ40AY1M |
| tracking | SHIPPED | 9S5492807T629494H-MMDEMOEBA186171AD757 |

## One shopper trace

At fictional merchant **Clover Trading**, shopper `GARDEN-LIVE-37967f0f51de0529-U0214` bought a Channel3-sourced JAM Paper Desk Supply Assortment Pack, Red, 1 Rubber Bands 1 Binder Clips 1 Coloured Staples 1 Regular Paperclips (3345REASRTD). Catalog ID: `w7qtfaR`; emulator order: `GARDEN-LIVE-37967f0f51de0529-O83214`. The original product source is `CHANNEL3_API`.

PayPal captured **$31.99**, charged **$1.39** in recorded fees, and completed a **$1.00** refund. Confirmed net flow is **$29.60**. This is not the merchant's available PayPal balance. The attempted reward delivered **$0.00**.

Goods and delivery costs are simulator assumptions: **$21.76**, giving **$7.84 modeled contribution before outreach**. This does not establish campaign uplift or PayPal profit.

## Agent choices and actual results

| Service | Why Gemini selected it | Actual result |
|---|---|---|
| vault | Verify the existing buyer consent for the repeat purchase to ensure secure processing. | VERIFIED |
| checkout | Reconcile the observed shopper purchase (GARDEN-LIVE-37967f0f51de0529-O83214) to finalize the transaction and determine net proceeds. | PARTIALLY_REFUNDED |
| invoicing | Generate an itemized invoice for the requested two units of the JAM Paper Desk Essentials Office Supply Kit as requested by the demo buyer. | UNPAID |
| subscriptions | Create a finite, one-cycle monthly replenishment offer for the requested office supply kit to address the buyer's request for subscription options. | AWAITING_BUYER |
| reporting | Perform a reconciliation of the transaction history to verify the current financial state against provider records. | BLOCKED — NOT_AUTHORIZED |
| payouts | Merchant-approved $1 loyalty reward for the completed purchase of the JAM Paper Desk Supply Assortment Pack. | FAILED — INSUFFICIENT_FUNDS |
| refunds | Processing $1 partial refund for reported packing defect as per merchant policy. | COMPLETED |
| tracking | The simulated delivery is complete. Linking this metadata to the PayPal order provides a clear fulfillment record, which is a necessary prerequisite for initiating post-purchase customer engagement or loyalty follow-ups. | VERIFIED |

The four original commerce calls and one fulfillment call are actual Gemini requests. The shipment adapter repair used the saved decision and original order; it made no new model call or payment. The initial final summary wrongly inferred low conversion from intentionally pending offers. That recommendation is retained and flagged as requiring an observed buyer-response window. The worker results, not model wording, determine payment status.

## Cost and integrity

- Model requests: 5. Metered estimate: **$0.003669**; shared total **$0.067246 / $0.25**. Provider-reported tokens and stored rates, not a Cloud billing invoice.
- Original simulated orders: **1518**, unchanged. Native captures are samples, not extra sales.
- Warehouse: **8** PayPal operations, **2** native money events, **8** joined action rows. Foreign-key violations: **0**.
- Local verification: **197 tests passed**.
- The six verified workflows are wallet, checkout, invoice, subscription offer, refund, and shipment tracking. Subscription remains unactivated.

- Payouts failed with INSUFFICIENT_FUNDS; no cashback was delivered.
- Transaction Search is NOT_AUTHORIZED.
- Invoice intentionally unpaid; subscription intentionally unactivated.
- Shipment metadata accepted by PayPal; physical delivery remains simulated.
- The initial final Gemini conversion/engagement inference lacks an outcome window and is flagged for review.

[Machine-readable proof](GARDEN-LIVE-37967f0f51de0529.json) · [Demo guide](../paypal-services.md) · [Screenshot](../screenshots/paypal-six-services-verified.png)

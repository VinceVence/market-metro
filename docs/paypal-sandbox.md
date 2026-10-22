# PayPal sandbox integration

The `/sandbox.html` page connects a local checkout to PayPal Orders v2. Its saved receipt now feeds the main [12/36/120-merchant evidence economy](evidence-economy.md) as a payment reference. The economy's ledger and reserve decisions remain simulated; it reads the local receipt snapshot without starting or verifying a new checkout.

## Checkout sequence

1. The server exchanges sandbox app credentials for an OAuth token. The browser receives only connection status.
2. The buyer chooses 1–10 office kits at a server-owned unit price of $10 USD.
3. The server saves a local checkout and idempotency keys before creating the PayPal order.
4. PayPal returns an approval link on its sandbox domain. It opens in a separate tab. The user signs in with a Personal sandbox buyer account, distinct from the app's Business sandbox account.
5. The return URL identifies the local checkout and PayPal order. The server independently reads the order and requires `APPROVED` before capturing.
6. After capture, the server reads PayPal again. Only a matching order/reference/currency/amount and a completed provider capture enable the review.
7. The UI displays the provider capture ID, gross payment, fee, net proceeds and verification timestamp. Unknown fee/net values stay unknown.

The original page checks the existing order with bounded backoff for up to five minutes after the approval link is opened. A provider-confirmed `APPROVED` state triggers the ordinary server capture route. This avoids dependence on PayPal's browser redirect. **Verify with PayPal** also resumes a previously approved checkout; it does not submit buyer approval or capture an unapproved order. Opening a saved receipt verifies its current provider state without requiring another checkout.

The integration uses `POST /v1/oauth2/token`, `POST /v2/checkout/orders`, `GET /v2/checkout/orders/{id}`, and `POST /v2/checkout/orders/{id}/capture` on the fixed sandbox API origin. A return URL is not payment proof. Pending, refunded and mismatched captures are ineligible for the scripted review.

## Generated reserve review

The default generated scenario confirms delivery of 60% of the kits. The adverse scenario returns no delivery confirmations. These are authored fixture outcomes, not carrier observations and not an LLM investigation.

The authored target is `unverified gross + 20% of verified delivered gross`. For ten $10 kits with six delivered, the target moves from $100 to $52. The simulated held amount is capped by PayPal's actual reported net proceeds. For example, a **test fixture** with a $3 fee has $97 net, $52 held and $45 available after simulated approval. This is not a PayPal fee quote or an actual payment result.

The human approval button changes only the local review state. There is no API call to change PayPal reserves and no inference that the authored reserve rule is commercially appropriate.

## Setup and storage

Use Node 20.12+ and the project `.env.example`. Put the sandbox Client ID and Secret in `.env`, then restart the local server. The current server never reads credentials from browser inputs. Environment variables already present in the shell take precedence over `.env`.

PayPal developer accounts normally receive separate Personal and Business sandbox accounts. A Business sandbox account is a fictitious seller account, not an upgrade of the user's real account.

The local receipt store `.local/paypal-sandbox.json` contains order/capture IDs, retry keys, amounts, states and timestamps. Buyer names, addresses, emails, client secrets and OAuth tokens are not retained in its records. Different client IDs have separate record visibility. Corrupt storage fails explicitly rather than being silently reset.

This is a single-process, loopback-only development server. Mutations require the same local origin and a JSON request with the app's custom header. These controls do not constitute a hosted multi-user authentication system.

## Validation on 20 October 2026

- All 78 tests passed: the previous 65 simulation checks and 13 new sandbox/integration checks.
- Provider responses in automated tests are mocked. They verify approval gates, captured-vs-pending handling, idempotency across restart, lost-response recovery, amount validation, redaction, persistence and HTTP boundaries.
- The local browser page loaded without console warnings/errors. At a 390px viewport the document width remained 390px, and checkout/review actions stayed disabled with missing credentials.
- Actual PayPal sandbox OAuth **succeeded** after the user configured the local credentials. A native $100 order (ten $10 kits) was created successfully and its sandbox approval link opened.
- Buyer approval and capture are **verified**. After the user submitted PayPal's approval, a read-only provider check returned `APPROVED`. PayPal's return flow stalled, so the existing server capture route completed that already-approved order. A subsequent provider read returned order and capture status `COMPLETED`.
- Native sandbox result: order `8JN96388HX791412P`, capture `7UA38506PR3477149`, gross **$100.00**, PayPal fee **$3.70**, net **$96.30**. These are observed sandbox values, not production fee estimates.
- The local browser displayed the verified receipt and used it in the scripted review: six of ten generated kit records delivered, **$52.00** authored reserve target and **$44.30** proposed available funds from the observed net proceeds.
- Automatic approval review blocked the assistant from clicking the PayPal purchase button. The user supplied buyer approval; no browser-control workaround was used to submit it. The application's normal server capture followed PayPal's verified approval.
- During initial setup, the Developer Dashboard returned `unauthorized` in the available browser. The user subsequently supplied app credentials locally; no client secret was copied into chat or browser code.

## References

- [Get started and obtain sandbox credentials](https://developer.paypal.com/api/get-started/)
- [Sandbox accounts](https://developer.paypal.com/tools/sandbox/accounts/)
- [Authentication](https://developer.paypal.com/api/rest/authentication)
- [Create an order](https://developer.paypal.com/sdk/orders/v2/orders-create/)
- [Capture an order](https://developer.paypal.com/api/orders/v2/orders-capture/)
- [Idempotency](https://developer.paypal.com/api/rest/reference/idempotency/)

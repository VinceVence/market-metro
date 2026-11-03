# Commerce workspace

The current entry point is `/studio.html`. It keeps the compact workspace layout and DM Sans, using a PayPal-inspired navy, blue and cyan palette. The navigation is Live market, Agent team, Campaigns, Warehouse, Insights and PayPal sandbox. AG Studio powers warehouse grids and the embedded analytics view at `/reports.html`.

**Run campaign** creates one new live workflow. **Replay** plays its saved days and decisions without new model or payment calls. Run settings select the seed and optional single Sandbox sample. The workflow has a shared $0.25 model cap beneath the existing project spend limits. Existing saved-wallet consent is reused.

## What actually runs

1. Seeded shoppers trade for 30 virtual days. The authored catalog and simulator generate the warehouse records.
2. The local scientist fits and validates a ranker. A Gemini analyst reads observed evidence; a Gemini strategist chooses a bounded campaign program.
3. The strategist can request a fresh local model fit. An independent Gemini reviewer receives current observed evidence and approves or revises the program.
4. Trusted code publishes the reviewed campaign and enforces stock, frequency, budget and merchant-margin constraints. Shopping continues while the model calls are pending.
5. A second review considers the newer observations after the rival sale. Customer choices, offers, purchases and model versions are persisted.
6. After returns settle, one eligible campaign-contact order can be mirrored through the saved PayPal Sandbox buyer. The actual capture, fee and merchant net are linked to the same warehouse order. No real funds are used.

The analyst, strategist and reviewer are separate model invocations. Model fitting, customer simulation, publication and payment execution are local/provider tools, not additional LLMs. Policy families are bounded; agents do not write SQL or arbitrary code. The reviewer approves a program; local validated ranking updates operate within that program.

## Verified run

`COMMERCE-4980808c005eefd6`, seed 150001, completed on October 30, 2026:

- 577 orders including warmup; 242 coupons issued and 7 redeemed.
- Five fresh Gemini decisions across two reviews, six local fits, including one strategist-requested fit at Day 68.
- First campaign published on Day 48; retained after the second review on Day 74.
- Model usage: **$0.021008** from the token ledger.
- Native Sandbox capture **0AS11654PJ581524K**: **$18.00 gross**, **$0.91 fee**, **$17.09 merchant net**.

The captured order was Lia 02's full-price Writing Pad Set purchase after a campaign contact. It was **not a redeemed coupon**. Actual redemption examples include Emi 02's Desktop Filing Tray: $45.60 paid, $2.40 discount. These remain distinct in the UI and receipt trace.

This was one end-to-end run, not a comparative performance benchmark. The reactivation count and market economics are simulated, and no incremental PayPal profit is asserted. [Recorded decisions and result](live-run.json) contain the original inputs, public rationales, model usage and receipt references.

**Subsequent local comparison:** [Current campaign versus no campaign](paired-control.md) reproduced the live order/action records exactly, then compared matched controls without new provider calls. It measured32 extra purchases and $23.42 extra modeled platform contribution on this one seed. The extra agent-requested fit added only about$0.47 versus a fixed replay of the chosen program; this does not establish a material multi-agent advantage.

**October 31 fresh-decision pilot:** [Four new markets versus a development-selected baseline](confirmation-2026-10-31/README.md) used20 fresh provider calls. All four agent runs beat no campaign, but all matched the fixed program's operating outcomes and lost its comparison by their model usage cost. Total new model cost was $0.136928. The predeclared advancement check failed; no superiority claim is supported.

## Setup and recovery

Run `npm ci` and `npm run dev`. A fresh workspace can show the market preview without provider credentials. Live decisions use the existing isolated Vertex configuration under `.local/gcp/`; native samples additionally require the existing PayPal Sandbox app and saved buyer. These private credentials and local database are not included in the repository.

SQLite tables `commerce_room_runs`, `commerce_room_steps` and `commerce_room_frames` retain the workflow and replay. A server interruption marks active work interrupted; unknown provider requests are not automatically repeated. Completed runs reopen without rerunning models or capturing again. The current workspace retains the verified replay; a fresh clone does not automatically contain its private local database.

Validation for this change was syntax checking and the single live browser walkthrough: campaign publication, requested retraining, coupon traces, base-table viewing, receipt reconciliation and replay. No benchmark sweep was run.

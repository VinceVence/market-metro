# Clover Quarter: playable campaign rehearsal

**Historical demo record:** the toy-village UI was reverted to the prior Market Metro city view. The recorded campaign, local models, Channel3 product snapshots and PayPal sandbox receipt remain preserved. Open `/workflow.html?id=WF-933b5a62eaf3f188` to inspect the saved campaign and customer traces.

The guided demo uses the existing checkpointed workflow: mission → 28-day history → warehouse analysis → local logistic/tree fitting → validated coupon plan → shopper responses → rival-sale review → follow-up → selected PayPal sandbox capture → evaluation.

**Attribution:** the coordinator and dialogue are scripted. Local training, coupon eligibility, shopper outcomes and database records execute for real. Jev inference, generated MLE-STAR feature/code search and Harness² harness optimization are not implemented. Their roles are labeled in the story's research details.

## Recorded demonstration

Workflow **WF-933b5a62eaf3f188**, seed 314, 300 simulated shoppers, 14 campaign days plus two follow-up days.

- 6,300 training rows and 2,100 later validation rows.
- Logistic loss **0.2224067**, versus **0.2635139** offer-rate baseline and **0.2695922** tree loss.
- **74 coupons**, **17 redemptions**, **222 campaign-window purchases**, **4,800 customer decisions**.
- **$69.78 / $300** virtual campaign budget used; **zero holdout coupons**.
- One native PayPal Sandbox capture: **2RF288859F952982L**, **$28.79** gross, **$1.28** provider fee, **$27.51** net.
- That receipt joins Willow Goods order **O41777**, shopper **Nico 12**, a **10% coupon**, and Channel3 product **w7qtfaR**.
- Repeat-purchase difference **+15.2 percentage points**, approximate interval **−1.0 to +31.4**. Positive lift is not established.

Channel3 data is an actual cached API snapshot, not a fresh search during playback. The currently loaded project configuration does not expose an enabled Channel3 key; the cache remains usable. Customers, inventory, margins and bulk transactions are simulated. One saved test buyer and store represent the fictional economy.

## What helped and what needs work

The local model comparison selected the stronger candidate; eligibility and budget checks constrained offers; checkpoints stopped for review when the observed rival indicator changed; receipt verification linked the simulated purchase to actual sandbox evidence. These are demonstrated implementation behaviors.

The dialogue does not establish autonomous-agent quality. This demo has no fixed-workflow comparison, no validated uplift model, no automatic harness editing and no production ROI evidence. A future reasoning worker must choose investigations on unfamiliar cases; a typed router must be calibrated before it receives control.

## Replay and data access

**Replay without new payments** reads saved checkpoints only. **Follow Nico** opens the model/coupon/order/receipt trace. **Channel3 collection** shows product photos, source IDs, snapshot dates and merchant listing links. **PayPal records** shows native provider IDs and fees. **Warehouse** exposes the underlying base tables and joined views.

The native sample limit is enforced in the shared market payment layer, including manual capture controls. Retry and restart reuse request identities. Completed story replay cannot retrain, issue coupons or capture another payment.

Validation: full suite **158 passed**; after tightening the workflow sample cap, the affected workflow/payment suite **12 passed**. Browser checks covered campaign completion, saved replay, catalog and receipt views, and a 390px mobile layout. Screenshots are in docs/screenshots/cozy-*.


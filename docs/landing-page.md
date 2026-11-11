# Market Metro landing page

Route: `/landing.html`. The existing root judge walkthrough and deep links are preserved.

The design adapts the user's blue / white / red reference: oversized DM Sans typography, the actual three-dimensional market in the foreground, and red reserved for calls to action and active navigation. No new frontend dependencies were added.

The depth pass keeps that palette and adds directional light, a grounded city shadow, two saved-evidence callouts, a raised integrations strip, a layered screenshot frame, and a receipt-style payment breakdown. The hero callouts refer to the existing two model fits, six recorded decisions and $96 Sandbox capture; they are links to saved evidence, not live notifications.

The hero uses `createGarden` with an opt-in transparent canvas and the saved day-35 frame from `demo/data/judge-reactivation.json`. The default renderer remains opaque for the existing app. Shopper animation is presentation only: the landing page makes no simulation mutations, model requests or payments. Reduced motion pauses the scene; failed graphics or data loading leaves the saved environment image visible.

The keyboard-accessible evidence tabs show original application captures. Their links open the judge walkthrough, ontology explorer, AG Studio workspace and native Sandbox receipt. The campaign gains retain the matched-simulation scope and merchant inventory-value qualification.

## Assets

- Screenshots: original captures from `submission-media/gallery/assets/`, copied into `demo/landing/assets/` for deployment.
- Brand marks: existing PayPal, Gemini and Google Cloud vectors from `docs/figures/planner-v23/assets/`; source attribution remains in that directory's `sources.json`.
- The AG Studio integration label uses the existing Lucide Network icon, not a newly invented vendor logo. Lucide licence and attribution remain in `docs/presentations/ontology-paypal/vectors/`.
- Font: the existing self-hosted DM Sans files and OFL licence in `demo/assets/fonts/`.

## Verification

Desktop and mobile visual checks cover the real WebGL hero, evidence-tab selection and keyboard navigation. Public-server smoke tests cover the new page and correct JPEG MIME type, alongside existing payment and secret-path restrictions. No fresh inference or payment is needed to test the page.

# Submission readiness — 8 November 2026

**Code candidate: ready for the main-branch release gate. Public submission: not yet complete.** This audit prepares the source, judge instructions, submission copy and reviewable video script. It does not publish the repository, upload a video or submit Devpost forms.

## Must finish before submission

| Priority | Gap | Concrete next step |
|---|---|---|
| Required | GitHub is still private by request | Approve public visibility after reviewing the release. MIT license is already present. |
| Required | No final public video URL | Review the [1:43 Remotion preview](http://localhost:3000/MarketMetroSubmission) and female narration, export and verify the final MP4, then publish to YouTube. |
| Required | Devpost entry is not verified as submitted | Paste [submission copy](submission-draft.md), add repository/video links, select applicable categories and complete the entrant declarations. |
| Required third-party coverage | AG Studio is running in evaluation mode; no trial key is configured | Obtain sponsor trial/license coverage that includes judging. The sponsor advertises a free 45-day trial. Do not remove vendor notices. |
| Optional | No hosted demo is claimed | Use the verified local setup, which is permitted; host only if there is time to validate it. |
| Competitive gap | Dashboards are authored layouts | Describe the custom widget, theming, layout editing and decision evidence accurately. Do not claim that the current dashboard layout is AI-generated. |

The official deadline is **12 November at noon PST / 13 November at 4:00 AM Manila**. The rules require a working build, public open-source repository, project description and publicly visible YouTube demonstration under three minutes. Complete local instructions can satisfy demo access. Keep access available through judging, which ends December 15. [Official rules](https://paypalaihackathon.devpost.com/rules) · [Schedule](https://paypalaihackathon.devpost.com/details/dates)

AG Grid’s brief favors integrated AG Studio dashboards, custom widgets, theming and layout controls; it also encourages its agent framework. The current implementation demonstrates native grids/charts, a custom PayPal evidence widget and inspectable decisions. [Sponsor brief and trial](https://paypalaihackathon.devpost.com/details/aggrid)

A project may combine one grand prize with one sponsor prize, or one honorable mention with one sponsor prize. Grand prize, Best Demo and Agentic Commerce awards should not be presented as stackable wins. [Prize rules](https://paypalaihackathon.devpost.com/rules)

## Release checks

A clean tracked checkout was created without `.env`, the runtime database, saved wallets, cloud credentials or untracked research scratch.

- Clean npm installation completed using a workspace-local cache; no machine-wide permissions were changed.
- The app started on a separate local port with `--no-recover`. PayPal correctly reported Sandbox mode and `configured: false`.
- Judge HTML, matching archived Intelligence data, the chart library, brand asset and read-only ontology/reference endpoints returned HTTP 200.
- The final zero-provider submission gate passed **69 checks**, including unfinished-review handling, unique model chart categories, receipt identity, idempotency, consent validation and protection against replayed charges.
- A new 12-store/600-shopper seed ran through day 126, held an ambiguous mapping, accepted the corrected mapping and settled with **zero provider and native-payment calls**. This separate end-to-end check passed, bringing verification to **70 checks** in total. It took about 85 seconds locally. This validates execution, not a new financial-performance claim.
- `npm audit --omit=dev` reported zero known vulnerabilities on November 8. This is a package advisory result, not a complete security certification.
- A targeted tracked-file scan found no credential values after excluding empty example assignments. Local secrets and databases remain ignored. The scan does not certify every historical commit.
- The repo contains about 571.5 MiB of tracked files, mostly historical evidence. That evidence is preserved rather than riskily deleted immediately before release. Untracked scratch is excluded.

Commands:

```sh
npm ci --ignore-scripts
npm test
npm run dev -- --no-recover
```

Optional new-seed check, after README’s Python setup:

```sh
npm run test:judge-simulation
```

`npm test` runs the submission gate. `npm run test:historical` retains older experiments that require additional local fixtures. Neither the submission tests nor the new-seed test initiates paid provider requests; PayPal API tests use test doubles.

## One story and one primary result

The primary walkthrough, receipt and AG Grid dashboards all use `GARDEN-AUTO-e26323c97cbcb456`, seed 92111706, with 12 merchants and 600 shoppers.

| Primary claim | Verified value | Boundary |
|---|---:|---|
| Modeled PayPal gain vs fixed | +$114.96 / +3.47% | Includes $0.032325 estimated inference usage; not actual PayPal profit |
| Merchant contribution gain | +$1,024.86 | Includes inventory value |
| Extra retained purchases | +16 | 643 vs 627 in the same frozen market |
| Native Sandbox proof | $96 gross = $3.56 fee + $92.44 proceeds | Existing order mirrored once; fictitious funds |
| Review work | 6 recorded LLM decisions, 2 local fits | Replay does not make new calls |

The 24-feed ontology test and the 384-store scale study are separate supporting evidence. Do not attribute the primary financial gain solely to ontology, merge the scale receipts with this run, or claim a demonstrated multi-agent advantage. The current strongest demonstrated setup is one planner plus local tools and a deterministic verifier.

## Materials ready for review

- [Submission description](submission-draft.md)
- [Video storyboard and narration](demo-plan.md)
- [Voiceover text](video-narration.txt)
- [Remotion-ready scene timing and evidence manifest](submission-video.json)
- [Architecture with ontology and PayPal planes](presentations/ontology-paypal/README.md)
- [Existing screenshots](screenshots/intelligence/)
- [Third-party notices](../THIRD_PARTY_NOTICES.md)

An editable Remotion composition now exists with actual app recordings and local Kokoro neural female narration. Its preview duration is 103.1 seconds. No final MP4 or public upload is claimed yet. Review the voice, caption timing and footage before export. See [video setup and source notices](../video/README.md).

## Source verification

Official Devpost rules and sponsor search results were checked November 8; the complete stored rules were also read. A fresh sponsor-page fetch could not update the research cache, so the current official indexed sponsor page supplied that brief. No new research pipeline, model experiment, sponsor outreach, production deployment or paid generation was run for this release audit.

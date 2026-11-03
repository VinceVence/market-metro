# Current implementation audit, 3 November 2026

Verified sources: scripts/commerce-growth/autonomy/controller.mjs, train.py, funding-calibration.mjs, live.mjs; scripts/commerce-growth/team/control.mjs; scripts/commerce-expanded/runner.mjs; docs/commerce-expanded/live-run-1.json.

The fixed comparator already fits a recent14 demand forecast and uses joint stock allocation. The live team runs at most two reviews and six LLM calls. Roles receive a prepared evidence packet, choose forest/logistic and a small policy vocabulary; they do not conduct an open tool-use experiment loop. Previews use audience=all and minimumNetCents=0, whereas publication may choose recent_interest or lapsed and thresholds5/10. Publication checks historical coarse-classifier log loss, not measured profit of the exact campaign.

First review snapshot is internal day30 (display day31), publication effective internal day41 (display day42):11 simulated days. Second snapshot day61, effective day71:10 days. Three first-review provider calls took11664ms in total and the local fit roughly2.2 seconds; wall time is mapped into simulated dates. Original live background mode keeps fixed policy active while waiting.

First training:2762 historical contacts and0 matured contacts from the new run. Second:2959 total,197 local matured contacts, or6.66% local. Delayed retained labels require day+26<current day. The funding-odds adjustment is an assumption about transfer from authorization response to eventual retained purchase. On715 issued recommendations, Brier error worsened0.16166379 to0.16798016.

Current live expanded run:875 vs871 retained purchases, modeled PayPal contribution4373.386553 vs4364.26 after0.013447 model dollars, retailer51741 vs51763.38. No native payment calls, zero unpaid liabilities.

Further read-only verification of the saved expanded world found 40 contacts with responded=true and authorized=false at contact time that later produced retained orders. For example, REQUEST-30-447 was contacted on internal day30 and captured on day35. Immediate authorization is therefore an auxiliary label, not a necessary same-day condition for an eventual retained purchase. This count is an after-settlement diagnostic, not information available before those contacts.

## Timing-only diagnostic

Both arms use the same already trained first historical-only model and campaign. No second model, own-trajectory labels, fresh LLM decisions or paid calls. Decision-barrier activates on day30; delayed on day41. Same seed, finite needs, consent, initial state and income hashes verified per pair. Seed20261103 was previously seen;20261104 is an additional timing check, not an independent architecture benchmark.

| Seed | Early minus delayed PayPal USD | Merchant USD | Retained purchases |
|---|---:|---:|---:|
| 20261103 | 49.45 | 621.55 | 5 |
| 20261104 | -109.64 | -1674.68 | -10 |

Mean early-minus-delayed: -30.095 modeled PayPal USD, -526.565 merchant USD, -2.5 retained purchases. Timing changes outcomes, but earlier deployment is not a reliable improvement for this saved campaign. Correct clock design is an evaluation-validity fix; it cannot rescue a weak policy by itself.

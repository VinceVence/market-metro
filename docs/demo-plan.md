# Market Metro video plan

**Draft for review · 2:45 · 1920 × 1080 · 30 fps**

Open with the functioning simulation. Follow the same saved 12-store campaign through evidence, planning, verification, purchase, PayPal receipt and measured impact. The short merchant-feed demonstration is explicitly a separate test. The 384-store study belongs in supporting materials, not this primary storyline.

The source timeline is [submission-video.json](submission-video.json). The clean recording script is [video-narration.txt](video-narration.txt). No video or voice audio has been rendered.

## Storyboard

| Time | Scene | App action |
|---|---|---|
| 0:00–0:18 | Start inside the economy | Keep Day 1 visible. Pan across stores, shoppers and the PayPal building. Use real recorded app footage. |
| 0:18–0:32 | Make the business decision concrete | Advance to Agent decisions, first stop. Highlight electronics and furniture interest versus funded units. |
| 0:32–0:50 | Show the data contract | In the feed verifier, show a split checkout, then the ambiguous-link hold. Label this as a separate data-quality demonstration. |
| 0:50–1:14 | Show the LLM choosing work | Open Day 31 Analyze, then Train, and inspect the saved proposal. Cut to Model training with both distinct model bars. |
| 1:14–1:34 | Show why the model changed | Choose Agent decisions, then Next to the model-change stop. Highlight the two development-trial rows and selected boosted model. |
| 1:34–1:50 | Follow one shopper | Advance to Shopper response. Focus Form & Function and the Day 35 purchase → Day 36 delivery trace. |
| 1:50–2:10 | Connect the purchase to PayPal | Show this campaign’s native receipt, its capture ID, fee and test merchant proceeds. Briefly open the warehouse-order link. |
| 2:10–2:28 | Show the matched gain | Choose Impact to show the settled table. Highlight fixed vs planner values, then the three gain figures. |
| 2:28–2:45 | End with inspectable evidence | Show AG Grid model/decision rows, click one checkpoint, and briefly show the ontology graph. End on the Market → Agent decisions → Impact navigation and project title. |

## Narration

### 0:00 — Start inside the economy

This is Market Metro: twelve merchants, six hundred simulated shoppers, and a market that keeps a record of what people want, what they buy, and what actually gets delivered. We built it to test agentic commerce against measurable outcomes.

### 0:18 — Make the business decision concrete

The business question is simple: who should we contact, and what should we recommend? High interest does not always mean a funded purchase. The agent needs to turn those signals into a campaign merchants can actually fulfill.

### 0:32 — Show the data contract

First, the data must mean the same thing across merchants. Our ontology verifier counts a split checkout once and holds ambiguous relationships. In a separate test of twenty-four synthetic feeds, it accepted all twelve usable exports; fixed mapping accepted six. Both held every unsafe export.

### 0:50 — Show the LLM choosing work

Back in our recorded campaign, the LLM investigates demand, chooses a twenty-eight-day market-feedback window, and requests two local model fits. It proposes ranked recommendations and shopping-needs inquiries for up to thirty-six consenting shoppers a day. These are saved decisions from a real model run, with the inputs and tool results available to inspect.

### 1:14 — Show why the model changed

The LLM preferred the two-stage response model. The financial verifier tested both rankings with the same campaign in three development markets. Boosted trees earned more while clearing merchant and purchase checks, so the verifier selected that model. The agent proposes; typed tools and financial checks control execution.

### 1:34 — Follow one shopper

Now follow Shopper one-seventy-nine. Sixteen days after their last purchase, they receive a recommendation for a mobile side table, buy it for ninety-six dollars, and receive it the next day. The same request went unfilled under fixed rules.

### 1:50 — Connect the purchase to PayPal

That exact warehouse order was mirrored once through PayPal Sandbox. Here is the completed ninety-six-dollar capture: a three-dollar-fifty-six fee and ninety-two dollars forty-four in test merchant proceeds. PayPal supplies the execution and receipt proof. The simulated payment economics let us compare campaigns without charging real shoppers.

### 2:10 — Show the matched gain

After refunds and settlement, this campaign delivered sixteen more retained purchases, one thousand twenty-four dollars eighty-six in additional merchant contribution, and one hundred fourteen dollars ninety-six in modeled PayPal net over fixed rules. The original model usage cost about three cents. These are simulated results, not production profit.

### 2:28 — End with inspectable evidence

AG Studio brings the evidence together: market trends, model validation, LLM usage, campaign decisions, and payment reconciliation. Judges can inspect the same campaign or run a new seed with the saved policy. Market Metro makes commerce decisions traceable, testable, and connected to PayPal.

## Remotion production direction

- Build one composition with the scene IDs and frame counts in the JSON. Each actual app clip gets its own sequence; captions and emphasis overlays remain editable.
- Use recorded interaction footage, not a fabricated interface or a slide-only substitute. Zoom into the active card/table so it is legible at 1080p.
- Keep the PayPal blue sidebar, white environment and DM Sans. Use the existing application assets and vector marks with their notices; add no stock music.
- Include the simulation boundary on financial screens. Label historical training data and the separate feed test. Keep receipt source, gross, fee and proceeds visible.
- Use one LLM planner plus deterministic tools/verifier in labels. Do not portray distinct autonomous LLM employees, AI-generated dashboard layouts, a 2× profit result, or actual PayPal production earnings.
- After script review: capture clips, record narration, assemble in Remotion Studio, review timing, then export and verify the final video is under 180 seconds. Upload publicly to YouTube when approved.

## Review decisions

Please review the opening, technical depth and closing. The narration currently uses an explanatory product-demo voice. A personal founder narration can use the same timings.

## Evidence

- [Saved campaign and receipt](../demo/data/judge-reactivation.json)
- [Matching AG Grid evidence](../demo/data/judge-intelligence.json)
- [Separate held-out merchant-feed comparison](../demo/data/ontology-study.json)
- [Architecture assets](presentations/ontology-paypal/README.md)

## Upload copy draft

**Title:** Market Metro | Agentic Commerce That Learns | PayPal AI Hackathon

Market Metro turns observed merchant activity into trained models, tested campaigns and traceable PayPal payments. This demo follows one saved 12-store, 600-shopper simulation from Day 1 to a recorded agent decision, purchase and native PayPal Sandbox receipt.

Against fixed rules in that same simulation: 16 more retained purchases, $1,024.86 additional merchant contribution, and $114.96 higher modeled PayPal net after estimated model cost. Merchant contribution includes inventory value. These are simulated outcomes, not actual PayPal profit. The $96 Sandbox capture is an existing order and uses fictitious funds.

Built with PayPal Sandbox, Gemini on Vertex AI, local scikit-learn models, SQLite, Three.js and AG Studio. The ontology feed comparison is a separate synthetic-data test.

Source and setup: https://github.com/VinceVence/market-metro
Original code: MIT. Third-party components retain their own licenses.

Publish only after the narration/video review and public repository release. The JSON contains the same upload text for reuse.

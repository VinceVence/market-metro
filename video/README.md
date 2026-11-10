# Market Metro video preview

An editable **2:33.6** Remotion composition with recurring illustrated characters, connected story graphics, actual app evidence, an original upbeat music bed and event sound effects and upbeat neural female narration. A quiet shopper gets a useful recommendation, purchases, and receives the item; the film follows the agent tools, PayPal proof and AG Grid evidence behind that outcome.

## Preview

```sh
cd video
npm ci
npm run dev -- --port=3000
```

Open http://localhost:3000/MarketMetroSubmission and press Play. The main video and ten individual scenes are editable in Studio. Footage and narration are bundled: previewing needs no credentials, speech-model download, paid calls or payments. No final submission MP4 has been exported.

## Evidence and media

- Thirteen retained clips contain actual app recordings and clean renderer-camera shots: 1,731 frames sampled at roughly 15 fps, encoded at 30 fps. No app UI or financial rows were fabricated. Some recordings are gently retimed to fit the voiceover.
- The app footage uses the same saved 12-store campaign. Shopper behavior and financial gains are simulated; the $96 receipt is archived native PayPal Sandbox evidence using fictitious funds.
- Native AG Grid sorting, the decision drill-down, a custom PayPal widget and dashboard resizing were performed in the app. Its layouts are authored, not AI-generated.
- The narrator is the local Kokoro-82M stock female preset **af_heart**, at 0.94–0.95 synthesis speed. No hosted speech service or voice cloning was used.
- Captions use model phoneme boundaries where these match the transcript; other phrase timings are estimated. Review caption timing before publishing.

## Metro-line visual system

Each chapter after the introduction is a station on route M. `src/film/Metro.tsx` draws a persistent route map and a brief passing train at chapter cuts. The 0.73-second wipe clears before the incoming narration; quieter chimes mark the three major handoffs. Shared motion primitives (word-by-word headlines, chapter labels, framed app windows, bursts and pulses) live in `src/film/Design.tsx`.

The ontology chapter is a metro-style map of shoppers, contacts, products and payments, followed by separate recommendation and inquiry lines and a before/after-contact timeline. The planner, shopper and Market Metro intro chapters now include the agent-decision, shopper-outcome and live-traffic recordings. The verifier shows both candidates' PayPal and merchant gains with their AUC; the winner has the lower AUC and the higher outcomes. Every displayed value is read from `public/data/case.json` or `public/data/ontology-role.json`.

## Merchant, problem, question, introduction

The user’s vector night street, daylight camera push and merchant reveal are preserved. Leo’s problem leads to the question, then Market Metro is introduced as an AI commerce environment. The market view and Observe → Train → Test → Measure sequence explain the product before the next chapter introduces ontology.

Subtitles, logo, music, question intonation and the measured payoff remain. No new app behavior or benchmark result is claimed by the edit.

## Question delivery and impact

The question is a separate take with a 0.4-second breath and a gentle 2.5-semitone rise on the final word. Local Praat PSOLA changes pitch without changing the clip duration; the before/after contour settings are in `public/question-delivery.json`. The remainder uses the same stock voice.

The payoff compares fixed and agent purchase counts, then highlights incremental volume, merchant contribution and modeled PayPal net. All displayed values are read from the saved case. No new financial result is claimed.

## Logo and visual separation

The original route-M mark is shared by `public/brand/metro.svg` and `../demo/commerce/mark.svg`. The new logo and kinetic WHO/WHAT cards remain on a clean white canvas. The custom walking scene was removed.

`demo/video-capture.html` opts into a presentation-only grass/tree perimeter and offers a native traffic shot. It changes no economic records. Native routes are recorded immediately after the saved frame replay starts, with a small representative crowd to avoid congestion. The 3D renderer and gait are the app's own, not newly animated cartoon legs.

## Sound and pacing

The original 86 BPM score and event cues are synthesized locally (`scripts/score.py`). Music ducks under the leveled female narration. Opening impacts and train sounds are softer; station chimes mark ontology, shopping and impact. The measured master gain is shared by voice and effects and baked into the music bed. `src/Soundtrack.tsx` keeps each cue editable.

The story runs 153.6 seconds with eighteen-frame picture overlaps, short train wipes, and explicit 0.5–1.8 second reading holds. Word timing drives key events; estimated timings are labeled in the manifest. `npm run score` generates the score and a local audio-only mix. No APAC files or cloud resources are modified.

## Edit and verify

`src/Composition.tsx` contains the independent scene sequences; `src/scenes/` contains their voice and inline captions; `src/film/` contains the merchant story, animation and focused demo cut-ins. `public/footage.json` records capture provenance. `public/narration-neural.json` records measured audio durations. The script and final timings are in `../docs/submission-video.json`.

```sh
npm run check
```

This checks types, media files, narration durations and the under-three-minute limit without provider calls.

## Regenerate speech locally

These steps are optional; they are not needed to preview the bundled video.

```sh
# From the repository root
uv venv .local/video-voice-venv --python 3.12 --cache-dir .local/uv-cache
uv pip install --python .local/video-voice-venv/bin/python --cache-dir .local/uv-cache -r video/requirements-voice.txt
```

Download the official [ONNX model](https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.onnx) and [voice bank](https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin) into `.local/voice-models/kokoro/`. Run `npm --prefix video run voice` to synthesize on CPU and synchronize timing and captions. The synchronizer rejects videos of three minutes or more. Weights, raw frames and Python environments stay outside Git.

## Notices

- [Remotion](https://www.remotion.dev/) and its media/font/caption packages retain their own licenses.
- The [Basic Captions element](https://www.remotion.dev/elements/captions/basic-captions/) source is copied unchanged; application CSS supplies the DM Sans styling.
- [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) has Apache-2.0 weights; [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) is MIT inference code. Weights are not distributed here.
- Praat-Parselmouth 0.4.7 (GPL-3.0-or-later) is an optional local audio-production dependency; it is not shipped in the app runtime.
- DM Sans retains its OFL in `public/fonts/`. Brand marks remain their owners’ property. AG Studio evaluation notices remain in the footage; see the parent repository’s third-party notices.

The landscape and clean shop shots use `demo/video-capture.html`, the existing Three.js renderer and saved data. Isolating a merchant is a render-window change only. APAC was a read-only storytelling reference; no APAC code or cloud project was changed.

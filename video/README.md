# Market Metro video preview

An editable **2:00** Remotion composition with recurring illustrated characters, connected story graphics, actual app evidence, an original upbeat music bed and event sound effects and upbeat neural female narration. A quiet shopper gets a useful recommendation, purchases, and receives the item; the film follows the agent tools, PayPal proof and AG Grid evidence behind that outcome.

## Preview

```sh
cd video
npm ci
npm run dev -- --port=3000
```

Open http://localhost:3000/MarketMetroSubmission and press Play. The main video and ten individual scenes are editable in Studio. Footage and narration are bundled: previewing needs no credentials, speech-model download, paid calls or payments. No final submission MP4 has been exported.

## Evidence and media

- Eleven retained clips contain actual app recordings and clean renderer-camera shots: 1,551 frames sampled at roughly 15 fps, encoded at 30 fps. No app UI or financial rows were fabricated. Some recordings are gently retimed to fit the voiceover.
- The app footage uses the same saved 12-store campaign. Shopper behavior and financial gains are simulated; the $96 receipt is archived native PayPal Sandbox evidence using fictitious funds.
- Native AG Grid sorting, the decision drill-down, a custom PayPal widget and dashboard resizing were performed in the app. Its layouts are authored, not AI-generated.
- The narrator is the local Kokoro-82M stock female preset **af_heart**, at 1.02 synthesis speed. No hosted speech service or voice cloning was used.
- Captions use model phoneme boundaries where these match the transcript; other phrase timings are estimated. Review caption timing before publishing.

## Merchant, problem, question, introduction

The film opens with an aerial metro view, pushes into the storefront, and introduces Leo, an illustrative merchant persona struggling for days to bring shoppers back. The automation question follows, immediately before Market Metro appears. Characters blink, look toward evidence, frown, think and brighten after the purchase. Opening shots share matching positions and dissolve over eighteen frames.

The ontology then connects shopper/product/payment meaning, separates recommendation and inquiry training tasks, and restricts predictors to information available before contact. Its historical cohort counts are checked against the saved study; primary campaign gain is not attributed solely to ontology.

Readable DM Sans subtitles are restored. Unrelated footer commentary stays removed. Synchronized captions are also in `public/captions.vtt`; the narration transcript remains in the submission docs.

## Question delivery and impact

The question is a separate slower take with a 0.6-second pause and a rising final word. Local Praat PSOLA changes pitch without changing the clip duration; the before/after contour settings are in `public/question-delivery.json`. The remainder uses the same stock voice.

The payoff compares fixed and agent purchase counts, then highlights incremental volume, merchant contribution and modeled PayPal net. All displayed values are read from the saved case. No new financial result is claimed.

## Sound and pacing

The continuous 120 BPM score and thirteen event cues are original local synthesis (`scripts/score.py`). Music ducks under narration. `src/Soundtrack.tsx` keeps each cue editable. The story runs 120.8 seconds with eighteen-frame picture dissolves and approximately 0.12–0.15 seconds between adjacent spoken segments. Narration word timing drives key events; estimated timings remain labeled in the manifest. `npm run score` regenerates the score and a local audio-only mix for checking levels. No APAC files or cloud resources are modified.

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

The clean shop shots use `demo/video-capture.html`, the existing Three.js renderer and saved data. Isolating a merchant is a render-window change only. APAC was a read-only storytelling reference; no APAC code or cloud project was changed.

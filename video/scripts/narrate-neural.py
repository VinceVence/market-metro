"""Local stock female voice; no API keys, cloud inference or payment calls."""
import json
import time
from pathlib import Path

import onnxruntime as ort
import soundfile as sf
import numpy as np
from kokoro_onnx import Kokoro

ort.disable_telemetry_events()
ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT.parent / '.local/voice-models/kokoro'
PLAN = json.loads((ROOT.parent / 'docs/submission-video.json').read_text())
OUT = ROOT / 'public/narration-neural'
OUT.mkdir(exist_ok=True)
VOICE = 'af_heart'
SPEED = 1.06

options = ort.SessionOptions()
options.intra_op_num_threads = 2
options.inter_op_num_threads = 1
options.log_severity_level = 3
session = ort.InferenceSession(str(MODEL / 'kokoro-v1.0.onnx'), sess_options=options,
                              providers=['CPUExecutionProvider'])
speaker = Kokoro.from_session(session, str(MODEL / 'voices-v1.0.bin'))


def phrase_captions(text, seconds, timings):
    """Use model word boundaries when they match the normalized transcript."""
    words = text.split()
    bounds, start, end = [], None, None
    for t in timings:
        if t.phoneme.isspace():
            if start is not None:
                bounds.append((start, end))
                start = end = None
        else:
            start = t.start if start is None else start
            end = t.end
    if start is not None:
        bounds.append((start, end))
    aligned = len(bounds) == len(words)
    if not aligned:
        weights = [len(w) + (6 if w[-1:] in '.?!' else 0) for w in words]
        total, at = sum(weights), 0
        bounds = []
        for weight in weights:
            bounds.append((seconds * at / total, seconds * (at + weight) / total))
            at += weight
    result, group, first = [], [], 0
    for i, word in enumerate(words):
        group.append(word)
        if len(group) >= 7 or word.endswith(('.', '?', '!')) or i == len(words) - 1:
            result.append(dict(text=' '.join(group), startMs=round(250 + bounds[first][0] * 1000),
                               endMs=round(250 + bounds[i][1] * 1000), timestampMs=None,
                               confidence=None, pageBreakAfter=True))
            group, first = [], i + 1
    return result, 'model phoneme boundaries' if aligned else 'estimated phrase timing'


previous_path = ROOT / 'public/narration-neural.json'
previous = json.loads(previous_path.read_text()) if previous_path.exists() else {}
records = []
for scene in PLAN['scenes']:
    text = scene['narration'].replace('AG ', 'A G ').replace('LLM', 'L L M').replace('-', ' ')
    cached = next((r for r in previous.get('scenes', []) if r['id'] == scene['id']), None)
    if cached and previous.get('voice') == VOICE and cached.get('speed') == SPEED and cached.get('text') == text and (ROOT / 'public' / cached['file']).exists():
        records.append(cached)
        print(scene['id'] + ': reused unchanged local voice', flush=True)
        continue
    started = time.monotonic()
    samples, rate, timings = speaker.create_timed(text, voice=VOICE, speed=SPEED,
                                                lang='en-us', continuous=True,
                                                sentence_pause=.11, clause_pause=.06)
    seconds = len(samples) / rate
    if seconds <= 0:
        raise RuntimeError('Empty narration: ' + scene['id'])
    target = OUT / (scene['id'] + '.wav')
    # Consistent spoken level; music is mixed around this, not guessed per clip.
    rms = float(np.sqrt(np.mean(samples ** 2)))
    samples *= min(.13 / max(rms, 1e-6), .88 / max(float(np.max(np.abs(samples))), 1e-6))
    sf.write(target, samples, rate)
    captions, method = phrase_captions(text, seconds, timings)
    records.append(dict(id=scene['id'], voice=VOICE, speed=SPEED, seconds=seconds,
                        source='Local Kokoro-82M neural speech on CPU', sampleRate=rate,
                        file='narration-neural/' + target.name, text=text, captions=captions,
                        captionTiming=method, generationSeconds=round(time.monotonic() - started, 2)))
    print(scene['id'] + ': ' + str(round(seconds, 2)) + ' s; ' + method, flush=True)

(ROOT / 'public/narration-neural.json').write_text(json.dumps(dict(
    voice=VOICE, model='Kokoro-82M v1.0', engine='kokoro-onnx 0.6.1',
    providerCalls=0, sourceURL='https://github.com/thewh1teagle/kokoro-onnx', scenes=records
), indent=2) + '\n')

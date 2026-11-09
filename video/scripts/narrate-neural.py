"""Local stock female voice; no API keys, cloud inference or payment calls."""
import json
import time
from types import SimpleNamespace
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
SPEED = .98

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
    word_times = [dict(text=w, startMs=round(250+b[0]*1000), endMs=round(250+b[1]*1000)) for w,b in zip(words,bounds)]
    return result, 'model phoneme boundaries' if aligned else 'estimated phrase timing', word_times


def question_rise(samples, rate, start, semitones):
    """Give the final voiced word a rising contour without changing its duration."""
    import parselmouth
    from parselmouth.praat import call
    sound = parselmouth.Sound(samples, sampling_frequency=rate)
    manipulation = call(sound, 'To Manipulation', .01, 120, 450)
    tier = call(manipulation, 'Extract pitch tier')
    points = [(call(tier, 'Get time from index', i), call(tier, 'Get value at index', i))
              for i in range(1, call(tier, 'Get number of points') + 1)]
    tail = [(t, f) for t, f in points if t >= start]
    if len(tail) < 3:
        raise RuntimeError('Question ending has insufficient voiced material')
    first, last = tail[0][0], tail[-1][0]
    base = float(np.median([f for _, f in tail[:3]]))
    target = min(340.0, base * 2 ** (semitones / 12))
    rising = call('Create PitchTier', 'question-rise', 0, len(samples) / rate)
    for t, f in points:
        if t >= first:
            p = (t - first) / (last - first)
            f = base + (target - base) * p * p * (3 - 2 * p)
        call(rising, 'Add point', t, f)
    call([rising, manipulation], 'Replace pitch tier')
    result = call(manipulation, 'Get resynthesis (overlap-add)').values[0]
    assert len(result) == len(samples)
    return result, dict(method='Praat PSOLA',startSeconds=first,endSeconds=last,
                       startHz=round(base,1),endHz=round(target,1),semitones=semitones)


previous_path = ROOT / 'public/narration-neural.json'
previous = json.loads(previous_path.read_text()) if previous_path.exists() else {}
records = []
for scene in PLAN['scenes']:
    text = scene['narration'].replace('AG ', 'A G ').replace('LLM', 'L L M').replace('-', ' ')
    delivery = scene.get('delivery', {})
    speed = delivery.get('speed', SPEED)
    cached = next((r for r in previous.get('scenes', []) if r['id'] == scene['id']), None)
    if cached and cached.get('words') and cached.get('delivery', {}) == delivery and previous.get('voice') == VOICE and cached.get('speed') == speed and cached.get('text') == text and (ROOT / 'public' / cached['file']).exists():
        records.append(cached)
        print(scene['id'] + ': reused unchanged local voice', flush=True)
        continue
    started = time.monotonic()
    if delivery.get('questionTake'):
        question, rest = text.split('?', 1)
        q, rate, qt = speaker.create_timed(question+'?', voice=VOICE,
                    speed=delivery['questionSpeed'], lang='en-us', continuous=True)
        _, _, question_words = phrase_captions(question+'?', len(q)/rate, qt)
        q, contour = question_rise(q, rate, question_words[-1]['startMs']/1000-.25,
                                  delivery['riseSemitones'])
        answer, answer_rate, at = speaker.create_timed(rest.strip(), voice=VOICE,
                    speed=speed, lang='en-us', continuous=True, sentence_pause=.10, clause_pause=.05)
        assert rate == answer_rate
        pause = np.zeros(round(delivery['pauseAfterQuestion']*rate), dtype=q.dtype)
        offset=(len(q)+len(pause))/rate
        samples=np.concatenate([q,pause,answer])
        q_captions, q_method, q_words = phrase_captions(question+'?',len(q)/rate,qt)
        a_captions, a_method, a_words = phrase_captions(rest.strip(),len(answer)/rate,at)
        def shifted(items):
            return [{**item,'startMs':round(item['startMs']+offset*1000),
                     'endMs':round(item['endMs']+offset*1000)} for item in items]
        segmented=(q_captions+shifted(a_captions),q_method+' / '+a_method,q_words+shifted(a_words))
        timings=list(qt)+[SimpleNamespace(phoneme=' ',start=len(q)/rate,end=offset)]+[
            SimpleNamespace(phoneme=t.phoneme,start=t.start+offset,end=t.end+offset) for t in at]
        sf.write(ROOT/'public/question-take.wav', q, rate)
        (ROOT/'public/question-delivery.json').write_text(json.dumps(contour,indent=2)+'\n')
    else:
        samples, rate, timings = speaker.create_timed(text, voice=VOICE, speed=speed,
                                                lang='en-us', continuous=True,
                                                sentence_pause=.10, clause_pause=.05)
    seconds = len(samples) / rate
    if seconds <= 0:
        raise RuntimeError('Empty narration: ' + scene['id'])
    target = OUT / (scene['id'] + '.wav')
    # Consistent spoken level; music is mixed around this, not guessed per clip.
    rms = float(np.sqrt(np.mean(samples ** 2)))
    samples *= min(.13 / max(rms, 1e-6), .88 / max(float(np.max(np.abs(samples))), 1e-6))
    sf.write(target, samples, rate)
    captions, method, words = segmented if delivery.get('questionTake') else phrase_captions(text, seconds, timings)
    records.append(dict(id=scene['id'], voice=VOICE, speed=speed, delivery=delivery, seconds=seconds,
                        source='Local Kokoro-82M neural speech on CPU', sampleRate=rate,
                        file='narration-neural/' + target.name, text=text, captions=captions, words=words,
                        captionTiming=method, generationSeconds=round(time.monotonic() - started, 2)))
    print(scene['id'] + ': ' + str(round(seconds, 2)) + ' s; ' + method, flush=True)

(ROOT / 'public/narration-neural.json').write_text(json.dumps(dict(
    voice=VOICE, model='Kokoro-82M v1.0', engine='kokoro-onnx 0.6.1',
    providerCalls=0, sourceURL='https://github.com/thewh1teagle/kokoro-onnx', scenes=records
), indent=2) + '\n')

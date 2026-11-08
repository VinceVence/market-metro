"""Original upbeat score and event cues. CPU synthesis; no downloads or API calls."""
import json
import subprocess
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
PLAN = json.loads((ROOT / 'public/data/plan.json').read_text())
VOICE = json.loads((ROOT / 'public/narration-neural.json').read_text())
SR, BPM = 44100, 120
TOTAL = PLAN['durationInFrames'] / PLAN['fps']
N = round(TOTAL * SR)
rng = np.random.default_rng(314)
music = np.zeros((N, 2), np.float32)
scratch = ROOT.parent / '.local/video-review'
scratch.mkdir(exist_ok=True, parents=True)
OUT = ROOT / 'public/music'
OUT.mkdir(exist_ok=True)

def hz(m): return 440 * 2 ** ((m - 69) / 12)
def clock(d): return np.arange(round(d * SR), dtype=np.float32) / SR
def envelope(t, decay=4): return np.minimum(t / .005, 1) * np.exp(-t * decay) * np.minimum((t[-1]-t)/.03, 1)
def pluck(note, duration=.6):
    t = clock(duration); f = hz(note)
    a = sum(np.sin(2*np.pi*f*k*t)*np.exp(-t*(4+k*2))/k**1.8 for k in range(1,6))
    return a * np.minimum(t/.004, 1) * np.minimum((t[-1]-t)/.03, 1)
def bass(note):
    t=clock(.38); f=hz(note)
    return (np.sin(2*np.pi*f*t)+.24*np.sin(4*np.pi*f*t))*envelope(t,5)
def kick():
    t=clock(.32); phase=2*np.pi*(46*t+90*(1-np.exp(-t*35))/35)
    return np.sin(phase)*envelope(t,11)
def noise(d, low=1800):
    t=clock(d); n=rng.normal(size=len(t)); spectrum=np.fft.rfft(n)
    f=np.fft.rfftfreq(len(t),1/SR); spectrum*=np.minimum(f/low,1)**3
    return np.fft.irfft(spectrum,len(t)).astype(np.float32)
def clap():
    t=clock(.2); e=sum(np.where(t>=x,np.exp(-np.maximum(0,t-x)*65),0) for x in [0,.011,.023])
    return noise(.2)*e*.16*np.minimum((t[-1]-t)/.03,1)
def hat():
    t=clock(.07); return noise(.07,6500)*envelope(t,70)*.22
def put(bus,signal,at,level=1,pan=0):
    i=round(at*SR); end=min(N,i+len(signal))
    if i<0 or end<=i:return
    signal=signal[:end-i]
    stereo=np.column_stack([signal*np.sqrt((1-pan)/2),signal*np.sqrt((1+pan)/2)]) if signal.ndim==1 else signal
    bus[i:end]+=stereo*level

chords=[[62,66,69,73],[59,62,66,69],[55,59,62,66],[57,61,64,67]]
roots=[38,35,31,33]
for bar in range(int(TOTAL/2)+1):
    at=bar*2; notes=chords[(bar//2)%4]; root=roots[(bar//2)%4]
    # A warm offbeat piano/pluck groove, with a restrained repeating hook.
    for j in range(8):
        note=notes[[0,2,1,3,2,1,3,2][j]]+(12 if j in [3,7] else 0)
        put(music,pluck(note),at+j*.25,.19,(-1 if j%2 else 1)*.4)
        put(music,hat(),at+j*.25,.25 if j%2 else .15,.3)
    for beat in range(4):
        put(music,kick(),at+beat*.5,.34)
        if beat%2:put(music,clap(),at+beat*.5,.44,-.12)
    for beat in [0,1.5,2,3.5]:put(music,bass(root),at+beat*.5,.25)
    for offset in [.5,1.5]:
        for n in notes:put(music,pluck(n,.8),at+offset,.065,-.25)
    if bar%4 in [2,3]:
        for j,n in enumerate([notes[2]+12,notes[1]+12,notes[3]+12]):
            put(music,pluck(n,.8),at+j*.5,.10,.32)

# Small stereo delays add space without a giant reverberant wash.
for delay,gain in [(int(.125*SR),.16),(int(.25*SR),.09)]:
    music[delay:]+=music[:-delay,::-1].copy()*gain
music*=min(.17/(np.sqrt(np.mean(music**2))+1e-8),.80/(np.max(np.abs(music))+1e-8))
time=np.arange(N)/SR; duck=np.ones(N)*.58
voice_bus=np.zeros_like(music)
for scene,voice in zip(PLAN['scenes'],VOICE['scenes']):
    start=scene['startFrame']/PLAN['fps']+.25; end=start+voice['seconds']
    depth=np.minimum(np.clip((time-start+.12)/.12,0,1),np.clip((end+.3-time)/.3,0,1))
    duck=np.minimum(duck,.58-depth*.26)
    samples,rate=sf.read(ROOT/'public'/voice['file'])
    resampled=np.interp(np.arange(round(len(samples)*SR/rate))*rate/SR,np.arange(len(samples)),samples)
    put(voice_bus,resampled,start,np.sqrt(2))
music*=duck[:,None]
music*=np.minimum(time/.08,1)[:,None]*np.minimum((TOTAL-time)/.55,1)[:,None]

# Audible, brief cues: notification, transition, purchase, verified receipt.
effects={}
for name,notes in [('notify',[81,86]),('coin',[86,93,98]),('verified',[74,78,81])]:
    a=np.zeros(round(.7*SR),np.float32)
    for j,n in enumerate(notes):
        s=pluck(n,.42); i=round(j*.07*SR); a[i:i+len(s)]+=s
    effects[name]=a/(np.max(np.abs(a))+1e-8)*.75
t=clock(.32); a=noise(.32,900)*np.sin(np.pi*t/.32)**2
effects['sweep']=a/(np.max(np.abs(a))+1e-8)*.55
for name,a in effects.items():sf.write(OUT/(name+'.wav'),a,SR)

byid={s['id']:s for s in PLAN['scenes']}
def when(name,offset):return byid[name]['startFrame']/PLAN['fps']+offset
def cue(name,word,fallback):
    voice=next(s for s in VOICE['scenes'] if s['id']==name)
    return next((w['startMs']/1000 for w in voice.get('words',[]) if ''.join(c for c in w['text'].lower() if c.isalnum())==word),fallback)
events=[('sweep',1.5,.3),('notify',when('problem',.25),.35),
        ('notify',when('ontology',2.0),.22),('sweep',when('planner',.1),.3),
        ('verified',when('verifier',cue('verifier','selects',6)),.28),('notify',when('shopper',cue('shopper','recommendation',2)),.35),
        ('coin',when('shopper',cue('shopper','buy',4)),.45),('verified',when('shopper',cue('shopper','arrives',7)),.3),
        ('verified',when('paypal',cue('paypal','capture',3)),.4),('coin',when('impact',cue('impact','sixteen',3)),.33),
        ('sweep',when('ag_grid',.1),.25),('verified',when('close',.15),.28)]
effect_bus=np.zeros_like(music)
for name,at,gain in events:put(effect_bus,effects[name],at,gain,np.float32(0))
sf.write(scratch/'score.wav',music,SR)
subprocess.run([str(ROOT/'node_modules/.bin/remotion'),'ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(scratch/'score.wav'),'-c:a','libmp3lame','-b:a','192k',str(OUT/'upbeat-score.mp3')],check=True,cwd=ROOT)
mix=voice_bus+music+effect_bus
assert float(np.max(np.abs(mix)))<.99, 'Mix would clip; rebalance before shipping'
sf.write(scratch/'spotlight-mix.wav',mix,SR)
sf.write(scratch/'spotlight-audio-sample.wav',mix[:15*SR],SR)
meta={'bpm':BPM,'seconds':TOTAL,'original':True,'providerCalls':0,
      'musicRmsDb':round(float(20*np.log10(np.sqrt(np.mean(music**2)))),2),
      'mixPeakDb':round(float(20*np.log10(np.max(np.abs(mix)))),2),
      'cues':[{'file':name,'at':round(at,3),'volume':gain} for name,at,gain in events]}
(OUT/'sound-design.json').write_text(json.dumps(meta,indent=2)+'\n')
# Keep each cue independently editable in the Studio timeline.
nodes='\n'.join('  <Audio name="'+name+' · event" src={staticFile("music/'+name+'.wav")} from={Math.round('+str(round(at,3))+'*fps)} volume={'+str(gain)+'} premountFor={fps}/>' for name,at,gain in events)
(ROOT/'src/Soundtrack.tsx').write_text('import {Audio} from "@remotion/media";\nimport {staticFile,useVideoConfig} from "remotion";\nexport const Soundtrack=()=>{const {fps}=useVideoConfig();return <>\n  <Audio name="Upbeat original score · 120 BPM · voice ducking" src={staticFile("music/upbeat-score.mp3")} volume={1} premountFor={fps}/>\n'+nodes+'\n</>;};\n')
print(json.dumps(meta))

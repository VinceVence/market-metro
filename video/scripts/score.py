"""Original upbeat score and event cues. CPU synthesis; no downloads or API calls."""
import json
import subprocess
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
PLAN = json.loads((ROOT / 'public/data/plan.json').read_text())
VOICE = json.loads((ROOT / 'public/narration-neural.json').read_text())
SR, BPM = 44100, 86
BEAT = 60 / BPM
BAR = 4 * BEAT
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

def word_at(name,word,fallback):
    voice=next(v for v in VOICE['scenes'] if v['id']==name)
    return next((w['startMs']/1000 for w in voice.get('words',[]) if ''.join(c for c in w['text'].lower() if c.isalnum())==word),fallback)
HELLO=word_at('market','leo',4.6)   # camera push into Leo's store
DAY=HELLO+1.3                        # push lands, daylight is up

# Night hook: a low, slow pad instead of the groove, so the opening feels like a question.
pad_t=clock(DAY+1.2)
pad=np.zeros(len(pad_t),np.float32)
for n,g in [(38,.5),(45,.35),(50,.3),(53,.22),(57,.16),(62,.08)]:
    f=hz(n); pad+=g*(np.sin(2*np.pi*f*pad_t)+.18*np.sin(4*np.pi*f*pad_t))*(1+.25*np.sin(2*np.pi*(.18+n*.003)*pad_t))
pad*=np.minimum(pad_t/1.2,1)*np.clip((DAY+1.2-pad_t)/1.4,0,1)
pad_stereo=np.column_stack([pad,np.roll(pad,int(.011*SR))])
music[:len(pad)]+=pad_stereo*.11

chords=[[62,66,69,73],[59,62,66,69],[55,59,62,66],[57,61,64,67]]
roots=[38,35,31,33]
FULL=PLAN['scenes'][1]['startFrame']/PLAN['fps']   # the groove only reaches full energy once the story is set up
for bar in range(int(TOTAL/BAR)+1):
    at=bar*BAR; notes=chords[(bar//2)%4]; root=roots[(bar//2)%4]
    # Silent through the night hook; a relaxed half-time groove arrives with daylight.
    if at+BAR<=DAY-.8: continue
    energy=float(np.clip((at-DAY)/8,0,.55) if at<FULL else .55+.45*np.clip((at-FULL)/6,0,1))
    for j in range(4):
        note=notes[[0,2,1,3][j]]+(12 if j==3 else 0)
        put(music,pluck(note,.9),at+j*BEAT,.04+.13*energy,(-1 if j%2 else 1)*.35)
    for j in range(4):
        put(music,hat(),at+(j+.5)*BEAT,.12*energy,.3)
    for beat in [0,2]:
        put(music,kick(),at+beat*BEAT,.09+.2*energy)
    put(music,clap(),at+2*BEAT,.34*energy,-.12)
    for beat in [0,1.5,2]:put(music,bass(root),at+beat*BEAT,.13+.1*energy)
    for n in notes:put(music,pluck(n,1.8),at,.055,-.25)
    if bar%4 in [2,3]:
        for j,n in enumerate([notes[2]+12,notes[1]+12,notes[3]+12]):
            put(music,pluck(n,1.0),at+j*BEAT,.09*energy,.32)

# Small stereo delays add space without a giant reverberant wash.
for delay,gain in [(int(BEAT/2*SR),.14),(int(BEAT*SR),.08)]:
    music[delay:]+=music[:-delay,::-1].copy()*gain
music*=min(.17/(np.sqrt(np.mean(music**2))+1e-8),.80/(np.max(np.abs(music))+1e-8))
music*=1.5  # the half-time groove is sparser, so lift it back to sit ~11 dB under the voice
time=np.arange(N)/SR; duck=np.ones(N)*.62
voice_bus=np.zeros_like(music)
for scene,voice in zip(PLAN['scenes'],VOICE['scenes']):
    start=scene['startFrame']/PLAN['fps']+.25; end=start+voice['seconds']
    depth=np.minimum(np.clip((time-start+.12)/.12,0,1),np.clip((end+.3-time)/.3,0,1))
    duck=np.minimum(duck,.62-depth*.44)
    samples,rate=sf.read(ROOT/'public'/voice['file'])
    samples=samples if samples.ndim==1 else samples.mean(1)
    speech=samples[np.abs(samples)>.01]
    samples=samples*10**((-19.5-20*np.log10(np.sqrt(np.mean(speech**2))))/20)
    samples=samples*1.3
    samples=np.where(np.abs(samples)>.7,np.sign(samples)*(.7+.25*np.tanh((np.abs(samples)-.7)/.25)),samples)
    # The film plays these leveled copies, so every scene sits at the same loudness.
    (ROOT/'public/narration-mix').mkdir(exist_ok=True)
    sf.write(ROOT/'public/narration-mix'/Path(voice['file']).name,samples.astype(np.float32),rate)
    resampled=np.interp(np.arange(round(len(samples)*SR/rate))*rate/SR,np.arange(len(samples)),samples)
    put(voice_bus,resampled,start,1)
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
bird=np.zeros(round(2.4*SR),np.float32)
for start,pitch in [(.1,1800),(.55,2200),(1.3,1950),(1.55,2600)]:
    t=clock(.19); phase=2*np.pi*(pitch*t+900*t*t/.19)
    chirp=np.sin(phase)*np.sin(np.pi*t/.19)**2*.45
    i=round(start*SR);bird[i:i+len(chirp)]+=chirp
effects['birds']=bird
door=np.zeros(round(1.2*SR),np.float32)
for offset,note in [(0,88),(.18,81)]:
    a=pluck(note,.8);i=round(offset*SR);door[i:i+len(a)]+=a*.7
effects['door']=door
station=np.zeros(round(1.1*SR),np.float32)
for offset,note in [(0,79),(.16,83)]:
    a=pluck(note,.9);i=round(offset*SR);station[i:i+len(a)]+=a*.6
effects['station']=station
steps=np.zeros(round(3.2*SR),np.float32)
for i,at in enumerate(np.arange(0,2.9,.37)):
    t=clock(.12);step=(noise(.12,700)*np.exp(-t*45)*.12+np.sin(2*np.pi*100*t)*np.exp(-t*40)*.35)*np.minimum(t/.003,1)
    j=round(at*SR);steps[j:j+len(step)]+=step*(.8 if i%2 else 1)
effects['steps']=steps
t=clock(.24);effects['page']=noise(.24,1200)*np.sin(np.pi*t/.24)**2*.16
t=clock(.12);t=clock(1.6); effects['riser']=(noise(1.6,500)*.5+np.sin(2*np.pi*(180*t+260*t*t/1.6))*.25)*(t/1.6)**2.2*np.minimum((t[-1]-t)/.04,1)
effects['riser']=effects['riser']/(np.max(np.abs(effects['riser']))+1e-8)*.6
t=clock(.9); effects['thump']=np.sin(2*np.pi*(42*t+60*(1-np.exp(-t*20))/20))*np.exp(-t*5)*np.minimum(t/.004,1)*np.minimum((t[-1]-t)/.05,1)*.8
hit=np.zeros(round(1.6*SR),np.float32); k=kick(); hit[:len(k)]+=k*.6
for j,n in enumerate([74,78,81,86]):
    a=pluck(n,1.3); i=round(j*.035*SR); hit[i:i+len(a)]+=a*.32
effects['hit']=hit/(np.max(np.abs(hit))+1e-8)*.8
ARRIVE,DWELL,DEPART=1.05,.8,1.0
t=clock(ARRIVE+.3); w=noise(ARRIVE+.3,320); effects['arrive']=w*np.minimum(t/.25,1)*np.clip(1-t/(ARRIVE+.3),0,1)**1.6
effects['arrive']/=np.max(np.abs(effects['arrive']))/.5
t=clock(DEPART+.2); w=noise(DEPART+.2,320); effects['depart']=w*(t/(DEPART+.2))**2*np.minimum((t[-1]-t)/.3,1)
effects['depart']/=np.max(np.abs(effects['depart']))/.5
t=clock(.12); effects['pop']=(np.sin(2*np.pi*(850*t+100*t*t))+.3*np.sin(2*np.pi*1700*t))*np.exp(-t*45)*np.minimum(t/.003,1)*.65
for name,a in effects.items():sf.write(OUT/(name+'.wav'),a,SR)

byid={s['id']:s for s in PLAN['scenes']}
def when(name,offset):return byid[name]['startFrame']/PLAN['fps']+offset
def cue(name,word,fallback):
    voice=next(s for s in VOICE['scenes'] if s['id']==name)
    return next((w['startMs']/1000 for w in voice.get('words',[]) if ''.join(c for c in w['text'].lower() if c.isalnum())==word),fallback)
events=[('thump',word_at('market','walk',.5)-.05,.45),('thump',word_at('market','look',1.4)-.05,.5),
        ('thump',word_at('market','leave',2.8)-.05,.55),('riser',DAY-1.6,.32),('hit',DAY-.05,.42),
        ('steps',when('market',cue('market','customers',10)),.4),
        ('page',when('market',cue('market','clues',19)),.6),
        ('pop',when('market',cue('market','who',17))-.45,.52),
        ('pop',when('market',cue('market','offer',18)-.5)-.45,.52),
        ('notify',when('problem',.25),.35),
        ('verified',when('problem',cue('problem','meet',6)),.24),
        ('notify',when('ontology',2.0),.22),
        ('verified',when('verifier',cue('verifier','paypal',8)+.4),.28),('notify',when('shopper',cue('shopper','recommendation',2)),.35),
        ('coin',when('shopper',cue('shopper','buy',4)),.45),('verified',when('shopper',cue('shopper','arrives',7)),.3),
        ('verified',when('paypal',cue('paypal','follow',8)),.4),('coin',when('impact',cue('impact','sixteen',3.5)),.33),
        ('verified',when('close',.15),.28)]
events+=[('station',when(s['id'],-.1 if i else .05),.3) for i,s in enumerate(PLAN['scenes'][1:])]
events+=[(n,when(s['id'],at),g) for s in PLAN['scenes'][2:-1] for n,at,g in [('arrive',-ARRIVE-.1,.2),('depart',DWELL-.1,.18)]]
effect_bus=np.zeros_like(music)
events=[(name,at,(.14 if name=='sweep' and at<10 else gain))
        for name,at,gain in events if at>=10 or name in ('sweep','thump','riser','hit','steps','page','pop')]
for name,at,gain in events:put(effect_bus,effects[name],at,gain,np.float32(0))
mix=voice_bus+music+effect_bus
master_gain=min(1.0,.94/float(np.max(np.abs(mix))))
mix*=master_gain
music*=master_gain
sf.write(scratch/'score.wav',music,SR)
subprocess.run([str(ROOT/'node_modules/.bin/remotion'),'ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(scratch/'score.wav'),'-c:a','libmp3lame','-b:a','192k',str(OUT/'upbeat-score.mp3')],check=True,cwd=ROOT)
assert float(np.max(np.abs(mix)))<.99, 'Mix would clip; rebalance before shipping'
sf.write(scratch/'spotlight-mix.wav',mix,SR)
sf.write(scratch/'spotlight-audio-sample.wav',mix[:15*SR],SR)
meta={'bpm':BPM,'seconds':TOTAL,'original':True,'providerCalls':0,'masterGain':master_gain,
      'musicRmsDb':round(float(20*np.log10(np.sqrt(np.mean(music**2)))),2),
      'mixPeakDb':round(float(20*np.log10(np.max(np.abs(mix)))),2),
      'cues':[{'file':name,'at':round(at,3),'volume':gain} for name,at,gain in events]}
(OUT/'sound-design.json').write_text(json.dumps(meta,indent=2)+'\n')
# Keep each cue independently editable in the Studio timeline.
nodes='\n'.join('  <Audio name="'+name+' · event" src={staticFile("music/'+name+'.wav")} from={Math.round('+str(round(at,3))+'*fps)} volume={'+str(gain*master_gain)+'} premountFor={fps}/>' for name,at,gain in events)
(ROOT/'src/Soundtrack.tsx').write_text('import {Audio} from "@remotion/media";\nimport {staticFile,useVideoConfig} from "remotion";\nexport const Soundtrack=()=>{const {fps}=useVideoConfig();return <>\n  <Audio name="Upbeat original score · 120 BPM · voice ducking" src={staticFile("music/upbeat-score.mp3")} volume={1} premountFor={fps}/>\n'+nodes+'\n</>;};\n')
print(json.dumps(meta))

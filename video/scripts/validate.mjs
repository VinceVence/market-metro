import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const plan=read('public/data/plan.json'),audio=read('public/narration-neural.json'),footage=read('public/footage.json');
assert.equal(audio.voice,'af_heart');assert.equal(audio.providerCalls,0);
assert.ok(plan.durationInFrames/plan.fps<180);
assert.deepEqual(read('public/data/case.json'),read('../demo/data/judge-reactivation.json'));
const ontology=read('public/data/ontology-role.json'),audit=read('../demo/data/ontology-training.json').development.audit;
assert.equal(ontology.inquiryContacts,audit.routedToInquiries);
assert.equal(ontology.productContacts+ontology.inquiryContacts,audit.windowRows);
assert.deepEqual(ontology.paths,audit.plan.paths);
const score=read('public/music/sound-design.json');
assert.equal(score.seconds,plan.durationInFrames/plan.fps);
assert.equal(score.providerCalls,0);assert.ok(score.mixPeakDb<0);
assert.ok(existsSync(resolve(root,'public/music/upbeat-score.mp3')));
assert.ok(score.cues.length>=8);
for(const cue of score.cues)assert.ok(existsSync(resolve(root,'public/music/'+cue.file+'.wav')));
assert.ok(Object.keys(footage.clips).length>=11);
for(const clip of Object.values(footage.clips)){
 assert.ok(clip.capturedFrames>40);assert.ok(clip.sourceURL.startsWith('http://127.0.0.1:4173/'));
 assert.ok(existsSync(resolve(root,'public',clip.file)));
}
const cli=resolve(root,'node_modules/.bin/remotion');
let previousVoiceEnd=0,previousHold=0;
for(const scene of plan.scenes){
 const clip=audio.scenes.find(a=>a.id===scene.id);assert.ok(clip);
 const actual=JSON.parse(execFileSync(cli,['ffprobe','-v','quiet','-show_entries','format=duration','-of','json',resolve(root,'public',clip.file)],{cwd:root,encoding:'utf8'}));
 assert.ok(Math.abs(Number(actual.format.duration)-clip.seconds)<.02);
 assert.ok(clip.seconds+.27<=scene.durationInFrames/plan.fps);
 assert.ok(scene.durationInFrames/plan.fps-clip.seconds-.25<1+(scene.holdAfterNarration||0),'Scene tail must match the intended reading hold');
 assert.ok(clip.captions.length>0);
 const voiceStart=scene.startFrame/plan.fps+.25;
 if(previousVoiceEnd)assert.ok(voiceStart-previousVoiceEnd>previousHold&&voiceStart-previousVoiceEnd<previousHold+.3,'Narration handoff must match the explicit reading hold');
 previousVoiceEnd=voiceStart+clip.seconds;
 previousHold=scene.holdAfterNarration||0;
}
console.log(JSON.stringify({durationSeconds:plan.durationInFrames/plan.fps,voice:audio.voice,recordedClips:Object.keys(footage.clips).length,capturedFrames:Object.values(footage.clips).reduce((n,c)=>n+c.capturedFrames,0),narrationTracks:audio.scenes.length,paidCalls:0,payments:0}));

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));

test('reviewable video plan starts in the market, stays under three minutes and binds every scene to evidence',async()=>{
 const plan=await read('docs/submission-video.json');
 assert.ok(['DRAFT_FOR_USER_REVIEW','PREVIEW_READY_FOR_REVIEW'].includes(plan.status));
 assert.equal(plan.rendered,false);
 if(plan.status==='PREVIEW_READY_FOR_REVIEW'){
  assert.equal(plan.audioGenerated,true);
  const audio=await read('video/public/narration-neural.json');
  assert.equal(audio.voice,plan.production.voiceId);assert.equal(audio.providerCalls,0);
  for(const scene of plan.scenes){
   const clip=audio.scenes.find(c=>c.id===scene.id);assert.ok(clip);
   await access('video/public/'+clip.file);
   assert.ok(clip.seconds+.27<=scene.durationInFrames/plan.fps,'Narration must finish before its scene ends');
  }
 }else assert.equal(plan.audioGenerated,false);
 assert.equal(plan.scenes[0].id,'market');assert.equal(plan.scenes[0].startFrame,0);
 let end=0,words=0;
 for(const scene of plan.scenes){
  assert.equal(scene.startFrame,end);assert.ok(scene.durationInFrames>0);
  end+=scene.durationInFrames;words+=scene.narration.split(/\s+/).length;
  assert.ok(scene.url.startsWith('/'));assert.ok(scene.evidence.length);
  for(const path of scene.evidence)await access(path);
 }
 assert.equal(end,plan.durationInFrames);assert.ok(end/plan.fps<180);
 assert.ok(words>170&&words<300);assert.equal(plan.production.paidModelCalls,0);assert.equal(plan.production.payments,0);
 const narration=await readFile('docs/video-narration.txt','utf8');
 for(const scene of plan.scenes)assert.ok(narration.includes(scene.narration));
});

test('submission headline agrees with the saved campaign and native receipt',async()=>{
 const d=await read('demo/data/judge-reactivation.json'),copy=await readFile('docs/submission-draft.md','utf8');
 assert.equal(d.vsFixed.paypal.toFixed(2),'114.96');assert.equal(d.vsFixed.merchants.toFixed(2),'1024.86');assert.equal(d.vsFixed.purchases,16);
 assert.equal(d.receipt.gross_cents,9600);assert.equal(d.receipt.fee_cents+d.receipt.net_cents,9600);
 for(const value of ['$114.96','$1,024.86','627','643'])assert.ok(copy.includes(value));
 assert.ok(copy.includes('six recorded LLM decisions'));assert.ok(copy.includes('not PayPal’s actual profit'));
});

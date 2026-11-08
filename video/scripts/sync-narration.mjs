import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const plan=read('../docs/submission-video.json'),audio=read('public/narration-neural.json');
const clips=read('public/footage.json').clips;
const components=['MarketScene','DemandScene','OntologyScene','PlannerScene','VerifierScene','ShopperScene','PayPalScene','ImpactScene','AGGridScene','ClosingScene'];
// Short breathing room, with picture overlaps bridging adjacent sentences.
const overlap=plan.overlapFrames||0;
const durations=plan.scenes.map(s=>Math.ceil((audio.scenes.find(a=>a.id===s.id).seconds+.45)*plan.fps));
if(durations.reduce((a,b)=>a+b,0)>=180*plan.fps)throw Error('Natural narration exceeds three minutes; review pacing before changing the timeline.');
const writes=[];let cursor=0;
for(const [index,scene] of plan.scenes.entries()){
  const recording=audio.scenes.find(a=>a.id===scene.id),path=resolve(root,'src/scenes',components[index]+'.tsx');
  let src=readFileSync(path,'utf8');
  const parts=[...src.matchAll(/<Series.Sequence name="([^"]+)" durationInFrames=\{([^}]+)\} premountFor=\{fps\}>([\s\S]*?)<\/Series.Sequence>/g)];
  if(!parts.length&&!src.includes('../film/'))throw Error('Missing editable scene: '+path);
  const frames=parts.map(p=>p[2].includes('*fps')?Number(p[2].split('*')[0])*plan.fps:Number(p[2]));
  let used=0,part=0;
  src=src.replace(/<Series.Sequence name="([^"]+)" durationInFrames=\{[^}]+\} premountFor=\{fps\}>([\s\S]*?)<\/Series.Sequence>/g,(_,name,body)=>{
    const duration=part===parts.length-1?durations[index]-used:Math.round(durations[index]*frames[part]/frames.reduce((a,b)=>a+b,0));
    const rate=Math.min(1,(clips[name].seconds-.04)/(duration/plan.fps));used+=duration;part++;
    return `<Series.Sequence name="${name}" durationInFrames={${duration}} premountFor={fps}>${body.replace(/playbackRate=\{[^}]+\}/,`playbackRate={${rate.toFixed(6)}}`)}</Series.Sequence>`;
  });
  src=src.replace(/src=\{staticFile\("narration\/([^\"]+)"\)\}/g,'src={staticFile("narration-neural/$1")}')
    .replace(/name="Daniel · local male narration"/g,'name="Heart · local neural female narration"')
    .replace(/captions=\{\[[\s\S]*?\]\}/,'captions={'+JSON.stringify(recording.captions,null,2)+'}');
  if(index)cursor-=overlap;
  writes.push([path,src]);scene.startFrame=cursor;scene.durationInFrames=durations[index];cursor+=durations[index];
}
let main=readFileSync(resolve(root,'src/Composition.tsx'),'utf8'),i=0;
main=main.replace(/(<Series\.Sequence\s+name=")[^"]+("\s+durationInFrames=)\{[^}]+\}(?:\s+offset=\{[^}]+\})?/g,(_,a,b)=>{const index=i++,s=plan.scenes[index];return a+s.title+b+'{'+durations[index]+'} offset={'+(index?-overlap:0)+'}';});
if(i!==plan.scenes.length)throw Error('Main timeline differs from the approved scene list.');
main=main.replace(/(id="MarketMetroSubmission"\s+component=\{MarketMetroSubmission\}\s+durationInFrames=)\{\d+\}/,'$1{'+cursor+'}');
writes.push([resolve(root,'src/Composition.tsx'),main]);
let registrations=readFileSync(resolve(root,'src/Root.tsx'),'utf8');
for(const [n,name] of components.entries())registrations=registrations.replace(new RegExp('(id="'+name+'"\\s+component=\\{'+name+'\\}\\s+durationInFrames=)\\{\\d+\\}'),'$1{'+durations[n]+'}');
writes.push([resolve(root,'src/Root.tsx'),registrations]);
plan.durationInFrames=cursor;plan.targetSeconds=cursor/plan.fps;plan.status='PREVIEW_READY_FOR_REVIEW';plan.audioGenerated=true;
plan.production.stage='Editable Remotion preview assembled; final MP4 not exported';
plan.production.audio='Local Kokoro-82M neural female voice (af_heart), optimistic and warm; no hosted speech API';
plan.production.voiceId=audio.voice;plan.production.previewURL='http://localhost:3000/MarketMetroSubmission';
for(const p of ['../docs/submission-video.json','public/data/plan.json'])writes.push([resolve(root,p),JSON.stringify(plan,null,2)+'\n']);
for(const [path,value] of writes)writeFileSync(path,value);
console.log(JSON.stringify({voice:audio.voice,frames:cursor,seconds:cursor/plan.fps,scenes:durations.length}));

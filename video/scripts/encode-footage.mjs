import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const captures=resolve(root,'../.local/video-capture'),out=resolve(root,'public/footage');
const cli=resolve(root,'node_modules/.bin/remotion'),manifest=resolve(root,'public/footage.json');
mkdirSync(out,{recursive:true});
const records=existsSync(manifest)?JSON.parse(readFileSync(manifest,'utf8')).clips:{};
const film=resolve(root,'src/film');
const used=new Set(readdirSync(film).filter(f=>f.endsWith('.tsx')).flatMap(f=>[...readFileSync(resolve(film,f),'utf8').matchAll(/<(?:Clip|HeroVideo)\s+file="([^"]+)"/g)].map(m=>m[1])));
for(const name of readdirSync(captures)){
  if(!used.has(name))continue;
  const dir=resolve(captures,name),capture=resolve(dir,'capture.json');if(!existsSync(capture))continue;
  const raw=readFileSync(capture,'utf8'),hash=createHash('sha256').update(raw).digest('hex');
  const target=resolve(out,name+'.mp4');if(records[name]?.captureHash===hash&&existsSync(target))continue;
  const info=JSON.parse(raw);if(info.frames.length<2)throw Error('Not a recording: '+name);
  const lines=info.frames.flatMap((f,i)=>[
    `file '${f.file}'`,
    'duration '+Math.max(.001,((info.frames[i+1]?.atMs??info.durationMs)-f.atMs)/1000).toFixed(6)
  ]);lines.push(`file '${info.frames.at(-1).file}'`);
  writeFileSync(resolve(dir,'frames.txt'),lines.join('\n')+'\n');
  execFileSync(cli,['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',resolve(dir,'frames.txt'),'-t',String(info.durationMs/1000),'-r','30','-fps_mode','cfr','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','-an',target],{cwd:root,stdio:'inherit'});
  const probe=JSON.parse(execFileSync(cli,['ffprobe','-v','quiet','-show_entries','format=duration:stream=width,height,r_frame_rate','-of','json',target],{cwd:root,encoding:'utf8'}));
  records[name]={file:'footage/'+name+'.mp4',seconds:Number(probe.format.duration),width:probe.streams[0].width,height:probe.streams[0].height,capturedFrames:info.frames.length,captureSeconds:info.durationMs/1000,sourceURL:info.url,captureHash:hash,source:'Recorded actual app viewport; frames captured through CUA, encoded locally'};
  console.log(name+': '+records[name].seconds+' s, '+info.frames.length+' actual captured frames');
}
writeFileSync(manifest,JSON.stringify({clips:records},null,2)+'\n');

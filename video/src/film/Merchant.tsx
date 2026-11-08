import {Stage,HeroVideo,Label,Note,Sfx,ramp,useTime} from './Design';
export function Merchant(){const t=useTime();return <Stage label="A merchant's story">
 <HeroVideo file="film-world" zoom={1+.12*ramp(t,0,3)} opacity={1-ramp(t,2,3)}/>
 <HeroVideo file="film-shop" zoom={1+.10*ramp(t,3,13)} x={80} opacity={ramp(t,2,3)}/>
 <div style={{position:'absolute',inset:0,background:'linear-gradient(90deg,#f7faff 0%,#f7faffee 24%,#f7faff00 65%)',opacity:ramp(t,2,3)}}/>
 <div style={{position:'absolute',left:115,top:205,width:650,opacity:ramp(t,.3,1)}}>
  <Label>12 shops. 600 simulated shoppers.</Label>
  <h1 style={{fontSize:112,lineHeight:1.02,letterSpacing:-5,margin:'28px 0'}}>{t<5?'The shop is open.':<>Meet Form<br/>& Function.</>}</h1>
  <div style={{fontSize:38,lineHeight:1.45,color:'#507092',opacity:ramp(t,6,7)}}>Stock ready.<br/>A customer worth bringing back.</div>
 </div>
 <Sfx file="soft-sweep" at={2.4} volume={.13}/><Note>Simulated merchant · camera view of the app's saved market</Note>
 </Stage>;}

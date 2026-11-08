import {CanvasImage,staticFile,useVideoConfig} from 'remotion';
import {Stage,HeroVideo,ramp,useTime,C} from './Design';
export function Ending(){const t=useTime(),{fps}=useVideoConfig();return <Stage label="Agentic commerce that learns">
 <HeroVideo file="film-return" zoom={1.12} opacity={.14}/>
 <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24,opacity:ramp(t,0,.6)}}><CanvasImage src={staticFile('brand/metro.svg')} premountFor={fps} style={{width:95,height:95}}/><div style={{fontSize:150,fontWeight:700,letterSpacing:-8}}>Market Metro</div><div style={{fontSize:60,fontWeight:400}}>Agentic Commerce That Learns</div><div style={{display:'flex',gap:45,alignItems:'center',marginTop:30,color:C.blue,fontSize:28}}><span>PayPal Sandbox</span><span style={{color:'#9aafc4'}}>×</span><span>AG Studio</span></div></div>
 </Stage>;}

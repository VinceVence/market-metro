import {Sequence,useVideoConfig} from 'remotion';
import data from '../../public/data/case.json';
import {Stage,HeroVideo,Label,Icon,Clip,ProductTable,Note,ramp,useTime,usd} from './Design';
export function Return(){const t=useTime(),{fps}=useVideoConfig();return <Stage label="The returning shopper">
 <HeroVideo file="film-return" zoom={1+.12*ramp(t,0,8)} x={90} opacity={1-.92*ramp(t,6,7)}/>
 <div style={{position:'absolute',inset:0,background:'linear-gradient(90deg,#f8fbff 0%,#f8fbffee 20%,transparent 65%)'}}/>
 <div style={{position:'absolute',left:115,top:185,width:850}}><Label>Shopper 179 · Form & Function</Label><div style={{fontSize:112,lineHeight:1.05,fontWeight:700,letterSpacing:-5,marginTop:25}}>{t<6?<>A useful<br/>match.</>:<>Mobile<br/>Side Table.</>}</div><div style={{fontSize:146,fontWeight:700,letterSpacing:-7,color:'#0877e5',marginTop:20,opacity:ramp(t,6.5,7.3)}}>{usd(data.shopper.grossCents/100)}</div><div style={{display:'flex',gap:16,alignItems:'center',fontSize:32,color:'#426b88',marginTop:24,opacity:ramp(t,9,10)}}><Icon kind="truck" size={46}/>Day 35 purchase → Day 36 delivery</div></div>
 {t>=6&&t<13&&<div style={{position:'absolute',left:1120,top:250,opacity:ramp(t,6,7),translate:`0px ${(1-ramp(t,6,7))*50}px`}}><ProductTable/><div style={{fontSize:22,color:'#6b839b',textAlign:'center'}}>Product illustration · simulated purchase</div></div>}
 <Sequence from={13*fps} premountFor={fps}><Clip file="shopper" box={[1025,265,790,570]} crop={[803,170,445,325]}/></Sequence>
 <Note>In the matched fixed-policy branch, the same request went unfilled</Note>
 </Stage>;}

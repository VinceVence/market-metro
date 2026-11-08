import data from '../../public/data/case.json';
import {Stage,Label,Icon,Note,Sfx,ramp,useTime,C} from './Design';
export function Quiet(){const t=useTime();return <Stage dark label="A shopper goes quiet">
 <div style={{position:'absolute',left:120,top:180}}><Label style={{color:C.cyan}}>A gap in the relationship</Label><div style={{fontSize:330,fontWeight:700,lineHeight:1.1,letterSpacing:-20,opacity:ramp(t,0,.8)}}>{data.shopper.daysSincePurchase}</div><div style={{fontSize:53,color:'#c4daee'}}>days between market purchases.</div></div>
 <div style={{position:'absolute',left:1210,top:245,textAlign:'center',opacity:ramp(t,1,2)}}><div style={{width:220,height:220,borderRadius:110,background:'#ffffff10',border:'1px solid #ffffff35',display:'grid',placeItems:'center',margin:'0 auto 30px'}}><Icon kind="person" size={120} color="#9ad8ff"/></div><div style={{fontSize:60,fontWeight:600}}>Shopper 179</div><div style={{fontSize:32,color:'#a5c3df',marginTop:18}}>What would bring them back?</div></div>
 <div style={{position:'absolute',left:130,right:130,top:785,display:'flex',alignItems:'center',gap:22}}>{Array.from({length:17},(_,i)=><div key={i} style={{height:i===0||i===16?27:14,width:i===0||i===16?27:14,borderRadius:20,background:i===0?'#fff':i===16?C.blue:'#5f7894',opacity:i===0?1:ramp(t,2+i*.13,2.5+i*.13)}}/>)}</div>
 <div style={{position:'absolute',left:130,top:840,fontSize:28,color:'#97badb'}}>Day 19 <span style={{marginLeft:530}}>Day 35</span></div>
 <Sfx file="soft-tap" at={1.2} volume={.12}/><Note dark>Saved synthetic shopper · inactivity is not a claim of permanent churn</Note>
 </Stage>;}

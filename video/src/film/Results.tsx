import data from '../../public/data/case.json';
import {Stage,Label,Note,ramp,useTime,usd,C} from './Design';
export function Results(){const t=useTime();return <Stage label="Measured against fixed rules">
 <div style={{position:'absolute',left:120,top:150}}><Label>Across the 12-store market · after settlement</Label><div style={{fontSize:108,fontWeight:700,letterSpacing:-5,marginTop:20}}>The campaign made a difference.</div></div>
 <div style={{position:'absolute',left:120,top:360,width:510,opacity:ramp(t,.4,1.1)}}><div style={{fontSize:236,fontWeight:700,letterSpacing:-14,color:C.blue}}>+{Math.round(data.vsFixed.purchases*ramp(t,1,2.2))}</div><div style={{fontSize:42,lineHeight:1.25}}>retained<br/>purchases</div><div style={{fontSize:29,color:C.muted,marginTop:27}}>627 fixed → 643 planner</div></div>
 <div style={{position:'absolute',left:740,top:430,width:1070,display:'grid',gridTemplateColumns:'1fr 1fr',gap:38}}>{[['Modeled PayPal net',data.vsFixed.paypal,'+3.47% after model cost'],['Merchant contribution',data.vsFixed.merchants,'Includes inventory value']].map(([name,value,note],i)=><div key={String(name)} style={{borderLeft:'1px solid #cbdae7',paddingLeft:32,opacity:ramp(t,3+i*1.2,3.7+i*1.2)}}><div style={{fontSize:30,color:C.muted,minHeight:75}}>{name}</div><div style={{fontSize:85,fontWeight:700,letterSpacing:-4,color:i?C.ink:'#138d70'}}>+{usd(Number(value))}</div><div style={{fontSize:27,color:C.muted,marginTop:24}}>{note}</div></div>)}</div>
 <div style={{position:'absolute',left:745,top:760,fontSize:29,color:C.muted,opacity:ramp(t,7,8)}}>Original estimated model usage: $0.032325</div>
 <Note>One paired simulated run. These are not PayPal production earnings.</Note>
 </Stage>;}

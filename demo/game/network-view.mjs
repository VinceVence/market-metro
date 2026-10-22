import {rounded,label,carton,drawWorker,drawVan} from './yard-art.mjs';
import {GROUPS,SHIFTS,total,usd} from './network.mjs';
export const NW=1200,NH=780;
const bays=GROUPS.map((name,i)=>({name,x:300+i%4*155,y:95+Math.floor(i/4)*175,w:140,h:145,entry:{x:370+i%4*155,y:253+Math.floor(i/4)*175}}));
const stores=[0,1,2].map(i=>({x:30,y:90+i*180,w:205,h:140,entry:{x:250,y:185+i*180}}));
const parks=['West studios','Ledger offices','Civic workspaces','Union businesses'].map((name,i)=>({name,x:990,y:70+i*140,w:180,h:115,entry:{x:975,y:140+i*140}}));
const tones=['#a96956','#b48a42','#54869d','#4c8676'];
export function createNetworkView(canvas,onGroup){
  canvas.width=NW*2;canvas.height=NH*2;const c=canvas.getContext('2d');c.scale(2,2);const media=matchMedia('(prefers-reduced-motion: reduce)');let world;
  function text(s,x,y,size=12,color='#365668',align='left'){label(c,s,x,y,size,color,align);}
  function line(points,color,width=2,dash=[]){c.save();c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.setLineDash(dash);c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();c.restore();}
  function point(points,t){const lens=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));let distance=total(lens,n=>n)*t;for(let i=0;i<lens.length;i++){if(distance>lens[i]){distance-=lens[i];continue;}const f=lens[i]?distance/lens[i]:0,a=points[i],b=points[i+1];return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,direction:Math.abs(b.x-a.x)>Math.abs(b.y-a.y)?b.x>a.x?'right':'left':b.y>a.y?'down':'up'};}return {...points.at(-1),direction:'right'};}
  function tag(s,x,y,tone='#487d95',fill='#f6fafc'){c.font='600 11px "DM Sans",sans-serif';const width=c.measureText(s).width+14;rounded(c,x-width/2,y-15,width,22,4,fill,tone+'55');text(s,x,y,11,tone,'center');}
  function room(p,title,accent){rounded(c,p.x+3,p.y+5,p.w,p.h,6,'#8198a322');rounded(c,p.x,p.y,p.w,p.h,5,'#f8faf8','#b6c8d0');rounded(c,p.x,p.y,p.w,27,4,'#dce6ea');c.fillStyle=accent;c.fillRect(p.x,p.y+4,4,p.h-8);text(title,p.x+12,p.y+18,12);}
  function draw(w,selected){
    world=w;c.clearRect(0,0,NW,NH);c.fillStyle='#e9eef0';c.fillRect(0,0,NW,NH);
    for(let x=0;x<NW;x+=40)line([{x,y:45},{x,y:NH}],'#dde5e8',.7);for(let y=40;y<NH;y+=40)line([{x:0,y},{x:NW,y}],'#dde5e8',.7);
    text('SUPPLIERS OWN THE STOCK',31,35,11,'#6a8492');text(`${w.count} MERCHANTS · 12 LOADING BAYS`,300,35,11,'#6a8492');text(`${w.count*4} OFFICE BUYERS`,990,35,11,'#6a8492');
    for(const x of [265,950]){line([{x,y:55},{x,y:640}],'#d2dde2',17);line([{x,y:55},{x,y:640}],'#f8f6e9',2,[8,10]);}
    for(const y of [253,428,603])line([{x:265,y},{x:975,y}],'#d2dde2',17);
    const evidenceMode=w.mode==='EVIDENCE_REPLAY';
    const plan=w.plans.find(p=>p.kind===w.selectedPlan),executing=['delivery','settling','settled'].includes(w.phase);
    for(let i=0;i<3;i++){
      const p=stores[i],s=w.warehouses[i];room(p,s?.name||['Northshore','Eastline','Harbor Stock'][i],s?.stock===0?'#b87a5a':'#97a9b0');
      for(let k=0;k<2;k++){c.fillStyle='#6d8998';c.fillRect(p.x+18,p.y+62+k*35,168,5);c.fillStyle='#d7a967';c.fillRect(p.x+18,p.y+39,4,72);c.fillRect(p.x+182,p.y+39,4,72);}
      const n=s?Math.min(6,Math.ceil(s.stock/Math.max(1,s.opening)*6)):6;for(let j=0;j<n;j++)carton(c,p.x+30+j%3*50,p.y+37+Math.floor(j/3)*35,.9,'KIT');
      if(s?.opening===0){rounded(c,p.x+27,p.y+50,151,34,4,'#f5e2d7');text('DISPATCH STOPPED',p.x+p.w/2,p.y+72,12,'#9d654d','center');}
      text(s?`${s.stock} kits available`:'Awaiting shift',p.x+14,p.y+127,12);if(s)tag(`${s.successBps/100}% assumed`,p.x+148,p.y+155,'#7f8b90','#f5f8f8');
    }
    for(const [i,p] of bays.entries()){
      const members=w.merchants.filter(m=>m.group===i),rows=plan?.rows.filter(r=>members.some(m=>m.id===r.id))||[],due=total(members,'due'),got=total(members,'delivered'),release=executing?total(members,'released'):total(rows,'release');
      const accent=executing?(got?'#60937c':'#b5916b'):plan&&release?'#60937c':'#8fa6b3';room(p,p.name,accent);
      if(selected===i){c.strokeStyle='#367693';c.lineWidth=3;c.strokeRect(p.x-3,p.y-3,p.w+6,p.h+6);}
      rounded(c,p.x+14,p.y+39,110,43,3,'#e5d7c0');rounded(c,p.x+19,p.y+43,44,30,2,'#b9d3d2');carton(c,p.x+82,p.y+44,.9);
      const count=Math.min(3,members.length);for(let j=0;j<count;j++){c.save();c.translate(p.x+28+j*35,p.y+104);c.scale(.6,.6);drawWorker(c,0,0,members[j].id,'merchant');c.restore();}
      text(`${members.length} merchant${members.length>1?'s':''} · ${due||'—'} paid kits`,p.x+10,p.y+119,10);
      text(executing?`${got}/${due} delivered`:`${usd(total(members,'reserve'))} reserve`,p.x+10,p.y+135,11,executing&&got?'#477d66':'#6b8290');
      if(w.phase==='review')tag(release?`Release ${usd(release)}`:'Hold reserve',p.x+p.w/2,p.y-7,release?'#3a7b9f':'#8f7967',release?'#eaf4fb':'#faf4ed');
      if(evidenceMode&&w.phase==='debate'){
        const proofs=w.cases.filter(u=>members.some(m=>m.id===u.merchant)),confirmed=proofs.filter(u=>u.confirmed).length;
        tag(`${confirmed}/${proofs.length} proven`,p.x+p.w/2,p.y-7,confirmed?'#437f70':'#9b7655',confirmed?'#edf7f0':'#fff2e0');
      }
      if(evidenceMode&&i===0&&w.paymentReference&&w.shift===0){
        rounded(c,p.x+85,p.y+85,46,17,3,'#e0eef7');text('PAYPAL',p.x+108,p.y+97,8,'#28638a','center');
      }
      const packing=w.shipments.filter(d=>d.group===i&&d.stage==='packing');if(packing.length)tag(`Packing ${total(packing,'units')} kits`,p.x+p.w/2,p.y+41,'#976f3b','#fff3dc');
    }
    for(const [i,p] of parks.entries()){
      room(p,p.name,'#8eaab6');for(let j=0;j<3;j++){rounded(c,p.x+14+j*52,p.y+42,43,26,3,'#d7c5aa');rounded(c,p.x+21+j*52,p.y+34,27,20,2,'#577b8f');rounded(c,p.x+24+j*52,p.y+37,21,14,1,'#b2d6e2');}
      const offices=w.offices.filter(o=>o.park===i);text(`${offices.length} offices`,p.x+13,p.y+85,12);text(`${total(offices,'received')} kits received · total`,p.x+13,p.y+102,10,'#6b8795');
    }
    if(w.phase==='orders'){
      for(let i=0;i<12;i++){const a=parks[Math.floor(i/3)].entry,b=bays[i].entry,path=[a,{x:950,y:a.y},{x:950,y:b.y},b];line(path,'#5290ab66',2,[5,7]);const q=point(path,media.matches ? .5 : Math.min(.96,(w.time-w.phaseAt)/3));rounded(c,q.x-10,q.y-9,20,18,3,'#fff','#73a3b7');text('↙',q.x,q.y+4,12,'#4a8199','center');}
    }
    for(const d of w.shipments){
      if(d.delay>0||d.stage==='complete')continue;const s=stores[d.source].entry,b=bays[d.group].entry,o=parks[Math.floor(d.group/3)].entry;
      const route=d.stage==='pickup'?[{x:280,y:640},{x:265,y:640},{x:265,y:s.y},s]:d.stage==='merchant'?[s,{x:265,y:s.y},{x:265,y:b.y},b]:[b,{x:950,y:b.y},{x:950,y:o.y},o];
      const q=d.stage==='packing'?b:point(route,d.progress);if(d.stage!=='packing')line(route,'#b18a492f',3);
      c.save();c.translate(q.x,q.y);c.scale(.64,.64);drawVan(c,0,0,q.direction||'right',d.stage!=='pickup');c.restore();
    }
    if(evidenceMode&&w.phase==='debate'){
      const b=bays[selected],path=[{x:601,y:655},{x:950,y:655},{x:950,y:b.entry.y},b.entry];
      line(path,'#54869d88',3,[5,7]);
      const q=point(path,media.matches?.5:(w.time%3)/3);
      rounded(c,q.x-10,q.y-10,20,20,3,'#f8fbfd','#54869d');text('?',q.x,q.y+4,13,'#54869d','center');
    }
    if(w.phase==='review'||(evidenceMode?w.phase==='settling':w.phase==='delivery')&&w.time-w.phaseAt<3.5){
      for(const [i,b] of bays.entries()){
        const members=w.merchants.filter(m=>m.group===i),amount=w.phase==='review'?total((plan?.rows||[]).filter(r=>members.some(m=>m.id===r.id)),'release'):total(members,'released');
        if(!amount)continue;const path=[{x:265,y:655},{x:265,y:b.entry.y},b.entry];line(path,'#4086ae44',2,[4,6]);
        if(w.phase===(evidenceMode?'settling':'delivery')){const q=point(path,media.matches ? .6 : Math.min(.98,(w.time-w.phaseAt)/2.8));rounded(c,q.x-9,q.y-9,18,18,9,'#3983ac');text('$',q.x,q.y+4,12,'#fff','center');}
      }
    }
    rounded(c,28,656,298,98,8,'#255a80');text('PayPal',46,684,23,'#fff');text(evidenceMode?'SIMULATED RESERVE REVIEW':'PAYMENTS & RESERVE AUTHORITY',46,703,10,'#b9d8e9');text(w.phase==='review'?`Proposed release: ${usd(plan?.released||0)}`:`${usd(total(w.merchants,'reserve'))} held · ${usd(w.ledger.paypalCoverage)} covered`,46,735,13,'#fff');
    line([{x:330,y:707},{x:374,y:707}],'#91b4c3',2,[3,5]);text('← advice',352,695,9,'#678594','center');
    const roles=w.roles||['Risk','Commerce','Network','Coordinator'];
    roles.forEach((name,i)=>{const x=390+i*195,active=w.phase==='debate'&&w.debate[Math.max(0,w.debateIndex-1)]?.role===name;
      rounded(c,x-5,660,178,91,7,active?'#f4faf7':'#f3f7f8',active?tones[i]:'#c6d7de');c.save();c.translate(x+28,724);c.scale(.8,.8);drawWorker(c,0,0,'agent'+i,'agent',0);c.restore();text(name,x+53,686,13,tones[i]);text((evidenceMode?['Protect funds','Retrieve records','Free cash','Recommend holds']:['Protect refunds','Keep trading','Test spillovers','Revise the plan'])[i],x+53,706,10,'#718792');text(active?'SPEAKING':w.plans.length?'SCRIPTED POLICY':'WAITING',x+53,731,9,active?tones[i]:'#94a5ad');
    });
  }
  canvas.addEventListener('click',e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*NW,y=(e.clientY-r.top)/r.height*NH;const index=bays.findIndex(p=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h);if(index>=0)onGroup(index);});
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*NW,y=(e.clientY-r.top)/r.height*NH;canvas.style.cursor=bays.some(p=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h)?'pointer':'default';});
  return {draw,reduced:()=>media.matches};
}

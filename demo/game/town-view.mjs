import {WIDTH,HEIGHT,PLACES,paintYard,drawWorker,drawVan,carton,rounded,label} from './yard-art.mjs';
import {usd} from './economy.mjs';
import {streetRoute} from './streets.mjs';

const roleById={C100:'merchant',C099:'merchant',C098:'dispatcher',C097:'reviewer',C096:'supplier',C009:'agent',C012:'agent',C016:'agent',C001:'customer',C002:'customer',C003:'customer',C004:'customer',office:'customer',warehouse:'supplier'};
export function portrait(id){const canvas=document.createElement('canvas');canvas.width=80;canvas.height=88;const c=canvas.getContext('2d');c.fillStyle='#e3ebef';c.fillRect(0,0,80,88);c.save();c.translate(40,87);c.scale(1.6,1.6);drawWorker(c,0,0,id,roleById[id]||'supplier');c.restore();return canvas.toDataURL('image/png');}
export function createHarborView(canvas,onSelect){
  canvas.width=WIDTH*2;canvas.height=HEIGHT*2;const ctx=canvas.getContext('2d');ctx.scale(2,2);
  const background=document.createElement('canvas');background.width=WIDTH*2;background.height=HEIGHT*2;const bctx=background.getContext('2d');bctx.scale(2,2);
  let ready=false,world=null,hover=null;const media=matchMedia('(prefers-reduced-motion: reduce)');
  const place=id=>PLACES.find(p=>p.id===id);
  function scenery(){paintYard(bctx);ready=true;}document.fonts.ready.then(scenery);
  function tag(text,x,y,color='#42677f',fill='#f8fbfc',size=11){ctx.font=`600 ${size}px "DM Sans",sans-serif`;const width=ctx.measureText(text).width+18;x=Math.max(width/2+5,Math.min(WIDTH-width/2-5,x));rounded(ctx,x-width/2+1,y-17,width,23,5,'#748c9b24');rounded(ctx,x-width/2,y-19,width,23,4,fill,'#bdcdd6');label(ctx,text,x,y-4,size,color,'center');}
  function kitStock(p,count){for(let i=0;i<count;i++)carton(ctx,p.x+42+(i%2)*119,p.y+65+Math.floor(i/2)*40,1.35,'KIT');}
  function position(id){if(place(id))return place(id).entry;if(id==='customers')return place('office-a').entry;return world.actors.find(a=>a.id===id)||place('lab').entry;}
  function routeLine(points,color,progress=null,units=0){
    if(points.length<2)return;
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.strokeStyle=color+'26';ctx.lineWidth=12;ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash([5,7]);ctx.stroke();ctx.setLineDash([]);
    const end=points.at(-1),before=points.at(-2),angle=Math.atan2(end.y-before.y,end.x-before.x);
    ctx.save();ctx.translate(end.x,end.y);ctx.rotate(angle);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-10,-5);ctx.lineTo(-10,5);ctx.fill();ctx.restore();
    if(progress!==null){
      const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));
      let distance=lengths.reduce((s,n)=>s+n,0)*Math.min(.96,Math.max(.04,progress));
      for(let i=0;i<lengths.length;i++){if(distance>lengths[i]){distance-=lengths[i];continue;}
        const t=lengths[i]?distance/lengths[i]:0,x=points[i].x+(points[i+1].x-points[i].x)*t,y=points[i].y+(points[i+1].y-points[i].y)*t;
        rounded(ctx,x-15,y-13,30,26,4,'#fff',color);label(ctx,String(units),x,y+4,13,color,'center');ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(x-8,y-7);ctx.lineTo(x+8,y-7);ctx.stroke();break;
      }
    }
    ctx.restore();
  }
  function requestRoute(from,to,units){const a=position(from),b=position(to),t=media.matches ? .55 : Math.min(.96,(world.time-world.orderFlow.startedAt)/3.6);routeLine([a,...streetRoute(a,b)],'#4a8ba8',t,units);}
  function highlight(id,color){const p=place(id);ctx.save();ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(p.x-4,p.y-4,p.w+8,p.h+8,9);ctx.stroke();ctx.restore();}
  function flowNote(title,detail,color='#4b738b'){
    rounded(ctx,40,280,250,53,6,'#f7fafb','#c0d1da');rounded(ctx,40,280,4,53,2,color);label(ctx,title,53,300,11,color);label(ctx,detail,53,318,10,'#617c8e');
  }
  function drawFlow(w){
    const d=w.delivery,van=w.actors.find(a=>a.id==='courier');
    if(w.phase===0){
      if(w.orderFlow.stage==='restock'){
        requestRoute('mara','primary',4);highlight('primary','#b18a58');flowNote('MARA REQUESTS A RESTOCK','Two office orders → one batch of 4');
      }else{
        if(w.orderFlow.stage==='requests'){requestRoute('office-a','mara',2);requestRoute('office-b','mara',2);highlight('mara','#4a8ba8');}
        flowNote(w.orderFlow.stage==='ready'?'FOLLOW ONE SUPPLY RUN':'OFFICES REQUEST STOCK','2 kits each · existing paid orders');
      }
    }else if(w.phase===1){
      routeLine([position('mara'),...streetRoute(position('mara'),position('primary'))],'#bc775a');
      highlight('primary','#bc775a');flowNote('RESTOCK BLOCKED','Supplier failed. Agents step in next.','#aa694d');
    }else if(w.phase===2){
      for(const e of w.evidence){highlight({stock:'supply',ledger:'paypal',terms:'mara'}[e.id],e.found?(e.finding.ok?'#61958a':'#bc8a55'):'#5795a7');const a=w.actors.find(a=>a.id===e.agent);if(a.path.length)routeLine([a,...a.path],'#5795a7');}
      flowNote('AGENTS INVESTIGATE',`${w.evidence.filter(e=>e.found).length}/3 checks · stock, cash, delivery`,'#3d8290');
    }else if(w.phase===3||w.phase===4){
      const release=(w.phase===4?w.approval.decision:w.recommendation.decision)==='RELEASE';
      highlight('paypal','#4e87b0');flowNote(w.phase===3?'AGENTS ADVISE → YOU DECIDE':'REVIEWER HAS APPROVED',release?(w.phase===3?'Propose $60 release · $140 stays held':'Release $60 approved · $140 will stay'):(w.phase===4?'Keep $200 held · no stock purchase':'Keep funds held · recovery not verified'),'#3f7299');
    }else if(d){
      const notes={pickup:['VAN → BACKUP STOCK','4 paid kits awaiting collection'],restock:['VAN → MARA’S PACKING DESK','4 kits on board · offices still waiting'],packing:['MARA PACKS THE ORDERS','2 kits for West · 2 for Ledger'],'office-a':['VAN → WEST STUDIO','4 kits on board · first office next'],'office-b':['VAN → LEDGER OFFICE','2 kits on board · final office next'],complete:['BOTH OFFICES RESTOCKED','4 kits delivered · no new charge']};
      flowNote(...notes[d.stage],d.stage==='complete'?'#467e6d':'#9a783f');
      if(van.path.length)routeLine([van,...van.path],'#b68b4b');
      if(d.stage==='packing')highlight('mara','#b68b4b');
    }else flowNote(w.refundPending?'REFUND AWAITING CONFIRMATION':'ORDERS CANCELLED',w.refundPending?'Stock stays put · money has not moved':`PayPal covers ${usd(w.ledger.paypalPaid)} in this branch`,'#aa694d');
  }
  function moneyFlow(e,index){const f=e.flow,age=world.time-e.at-index*.7;if(!f||age<0||age>6||media.matches)return;const a=position(f.from),b=position(f.to),t=Math.min(1,age/2.4),cy=Math.min(a.y,b.y)-65;
    ctx.globalAlpha=age>4?(6-age)/2:.9;ctx.strokeStyle=f.kind==='refund'?'#b96e54':'#bd9458';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(a.x,a.y-20);ctx.quadraticCurveTo((a.x+b.x)/2,cy,b.x,b.y-20);ctx.stroke();ctx.setLineDash([]);
    const x=(1-t)**2*a.x+2*(1-t)*t*(a.x+b.x)/2+t*t*b.x,y=(1-t)**2*(a.y-20)+2*(1-t)*t*cy+t*t*(b.y-20);
    rounded(ctx,x-10,y-9,20,18,4,f.kind==='goods'?'#b99163':'#d6ad67');label(ctx,f.kind==='goods'?'4':'$',x,y+4,12,'#fff8e9','center');tag(f.kind==='goods'?'4 supply kits':usd(f.amount),x,y-16,'#7e6649','#fff8e9',10);ctx.globalAlpha=1;
  }
  function draw(w){
    world=w;if(!ready)scenery();ctx.clearRect(0,0,WIDTH,HEIGHT);ctx.imageSmoothingEnabled=true;ctx.drawImage(background,0,0,WIDTH,HEIGHT);
    drawFlow(w);
    const source=place('primary'),backup=place('supply'),merchant=place('mara');
    kitStock(source,w.phase===0?4:0);kitStock(backup,w.quote.stock+(w.delivery?.awaitingPickup||0));
    if(w.phase>0){rounded(ctx,source.x+33,source.y+77,194,37,4,'#f2dfd4','#d5b29a');label(ctx,'SHIPMENT FAILED',source.x+130,source.y+101,13,'#9c6048','center');}
    tag(w.phase===0?'4 kits incoming':'0 kits available',source.x+130,source.y+source.h-14,w.phase>0?'#a26048':'#527686',w.phase>0?'#fff1e8':'#f4f9fa');
    tag(w.delivery?.awaitingPickup?'4 paid kits · pickup pending':w.quote.reservedBy==='jun'?'4 kits reserved by Jun':`${w.quote.stock} kits · $160 upfront`,backup.x+130,backup.y+backup.h-13,'#7e633d','#fbf2e4');
    const merchantStatus=w.delivery?(w.delivery.stage==='packing'?'Packing 2 + 2 kits':['office-a','office-b','complete'].includes(w.delivery.stage)?'4 kits dispatched':'Awaiting restock'):w.phase===5?(w.refundPending?'Refund pending':'Order cancelled'):w.phase>0?'$160 needed · $100 available':w.orderFlow.stage==='restock'?'Restock request: 4 kits':'2 offices × 2 kits';
    tag(merchantStatus,merchant.x+merchant.w/2,merchant.y+43,'#8d693d','#fff2dd');
    for(let n=0;n<(w.delivery?.packing||0);n++)carton(ctx,merchant.x+30+(n%2)*44,merchant.y+64+Math.floor(n/2)*27,.9,'KIT');
    for(const office of w.offices){const p=place(office.id),complete=office.received===office.requested,refunded=w.orders[0].refund==='COMPLETED';
      for(let n=0;n<office.stock;n++){ctx.fillStyle='#e5f0f2';ctx.fillRect(p.x+177,p.y+69-n*5,19,5);ctx.strokeStyle='#95b6c4';ctx.strokeRect(p.x+177,p.y+69-n*5,19,5);}
      tag(complete?`Received 2 · on hand ${office.stock}`:refunded?`Refunded · on hand ${office.stock}`:`On hand ${office.stock} · ordered 2`,p.x+p.w/2,p.y+p.h+24,complete?'#3a7568':'#4b738b',complete?'#e9f5ee':'#f6fafb',11);
      const blink=!w.paused&&!media.matches&&office.stock>0&&Math.floor(w.time*2)%2===0;ctx.fillStyle=blink?'#5ba992':'#99c2b6';ctx.fillRect(p.x+162,p.y+66,4,3);
      if(w.phase===0&&w.orderFlow.stage!=='restock')tag(w.orderFlow.stage==='ready'?'Need 2 supply kits':'Request sent · 2 kits',p.x+p.w/2,p.y-7,'#397a96','#eef7fb',11);
      if(complete){highlight(office.id,'#6b9c89');tag('✓  2 kits delivered',p.x+p.w/2,p.y-7,'#3d7865','#edf8f0',11);}
    }
    const selected=place(w.selected);if(selected){ctx.strokeStyle='#5b91ad';ctx.lineWidth=2;ctx.strokeRect(selected.x-3,selected.y-3,selected.w+6,selected.h+6);}
    for(const a of [...w.actors].sort((a,b)=>a.y-b.y)){
      if(a.id===w.selected||a.id===hover){ctx.strokeStyle='#5a91ad';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(a.x,a.y+2,a.role==='courier'?33:14,6,0,0,Math.PI*2);ctx.stroke();}
      if(a.role==='courier'){drawVan(ctx,a.x,a.y,a.direction,(w.delivery?.load||0)>0);continue;}
      const frame=a.path.length&&!w.paused&&!media.matches?Math.floor(a.walk*6)%4:0;drawWorker(ctx,a.x,a.y,a.skinId,a.role,frame,a.direction);
    }
    for(const a of w.actors.filter(a=>a.role==='agent')){const e=w.evidence.find(e=>e.agent===a.id);if(w.phase===2&&!e.found)tag(a.name+(a.path.length?'':' · checking'),a.x,a.y-59,'#3b7182','#eff8f9',9);}
    if(w.phase>=2&&w.phase<5)for(const e of w.evidence.filter(e=>e.found)){
      const p=place({stock:'supply',ledger:'paypal',terms:'mara'}[e.id]),short=e.finding.ok?{stock:'4 kits verified',ledger:'$300 recoverable',terms:'$160 · before deadline'}[e.id]:'Check needed';
      tag(`${w.actors.find(a=>a.id===e.agent).name} · ${short}`,p.x+p.w/2,p.y-7,e.finding.ok?'#3a786c':'#9d6f45',e.finding.ok?'#ebf6ef':'#fff1df',10);
    }
    tag(w.delivery?'Reserve $200 → $140':`Reserve ${usd(w.ledger.reserve)}`,place('paypal').x+135,place('paypal').y+40,'#396d91','#edf5fb',10);
    if(w.delivery){const van=w.actors.find(a=>a.id==='courier');tag(w.delivery.stage==='complete'?'Run complete':w.delivery.stage==='packing'?'Loading…':`${w.delivery.load} kits on board`,van.x,van.y-27,'#856637','#fff7e8',10);}
    const flows=w.events.filter(e=>e.flow&&w.time-e.at<9).flatMap(e=>e.flow.to==='customers'?['office-a','office-b'].map(id=>({...e,flow:{...e.flow,to:id,amount:e.flow.amount/2}})):[e]);flows.forEach(moneyFlow);
    if(hover){const a=w.actors.find(a=>a.id===hover);if(a&&a.role!=='agent')tag(a.name,a.x,a.y-61,'#456d85','#f6fafb',10);}
  }
  function pick(event){if(!world)return null;const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)/r.width*WIDTH,y=(event.clientY-r.top)/r.height*HEIGHT;
    const actor=[...world.actors].reverse().find(a=>a.role==='courier'?Math.abs(x-a.x)<34&&Math.abs(y-a.y)<23:Math.abs(x-a.x)<18&&y>a.y-53&&y<a.y+8);if(actor)return actor.id;
    return PLACES.find(p=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h)?.id||null;
  }
  canvas.addEventListener('pointermove',e=>{hover=pick(e);canvas.style.cursor=hover?'pointer':'default';});canvas.addEventListener('pointerleave',()=>{hover=null;});canvas.addEventListener('click',e=>{const id=pick(e);if(id)onSelect(id);});
  return {draw,portrait,reduced:()=>media.matches};
}

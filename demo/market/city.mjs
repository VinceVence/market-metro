// Original code-drawn isometric metropolis. No Mint Town sprites or generated image assets.
const palette=['#f2bd89','#93b6d6','#b9c3a0','#b8a9d0','#d69fa5','#dfc67c'];
const shade=(hex,f)=>{const n=parseInt(hex.slice(1),16);return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.min(255,Math.max(0,Math.round(v*f))).toString(16).padStart(2,'0')).join('');};
export function createCity(canvas,onSelect){
  const ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let width=0,height=0,scale=1,zoom=1,pan={x:0,y:0},frame=null,selected=null,hover=null,paused=true,last=performance.now(),time=0,hits=[],pulses=[],drag=null;
  const positions=[];for(let y=0;y<7;y++)for(let x=0;x<6;x++)if(!(y===3&&(x===2||x===3)))positions.push({x:2.2+x*4.2,y:2.2+y*3.8});
  function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;const d=Math.min(2,devicePixelRatio||1);canvas.width=width*d;canvas.height=height*d;ctx.setTransform(d,0,0,d,0,0);scale=Math.min(width/1070,height/690);}
  new ResizeObserver(resize).observe(canvas);
  const point=(x,y,z=0)=>({x:(x-y)*17,y:(x+y)*8.5-z});
  const polygon=(pts,fill,stroke)=>{ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.7;ctx.stroke();}};
  function plane(x,y,w,d,z,color,stroke){polygon([point(x,y,z),point(x+w,y,z),point(x+w,y+d,z),point(x,y+d,z)],color,stroke);}
  function box(x,y,w,d,h,color){
    polygon([point(x,y+d),point(x+w,y+d),point(x+w,y+d,h),point(x,y+d,h)],shade(color,.68));
    polygon([point(x+w,y),point(x+w,y+d),point(x+w,y+d,h),point(x+w,y,h)],shade(color,.84));
    plane(x,y,w,d,h,color,'#172a3450');
  }
  function text(s,x,y,size=11,color='#e8e4dc',align='center'){ctx.font=`600 ${size}px "DM Sans",sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(s,x,y);}
  function tree(x,y){const p=point(x,y);ctx.fillStyle='#162b2d45';ctx.beginPath();ctx.ellipse(p.x,p.y+3,9,4,0,0,7);ctx.fill();ctx.fillStyle='#786451';ctx.fillRect(p.x-1,p.y-13,3,13);ctx.fillStyle='#547f6f';ctx.beginPath();ctx.ellipse(p.x,p.y-17,8,11,0,0,7);ctx.fill();ctx.fillStyle='#74997b';ctx.beginPath();ctx.ellipse(p.x-2,p.y-21,6,7,0,0,7);ctx.fill();}
  function building(x,y,w,d,h,color,kind,index,name,isMerchant=false,id=null){
    plane(x+.2,y+.25,w,d,0,'#101f2845');box(x,y,w,d,h,color);
    // Two visible façades with different window lighting and recessed ground-floor shopfronts.
    const levels=Math.max(1,Math.floor((h-10)/11));
    for(let floor=0;floor<levels;floor++)for(let col=0;col<3;col++){
      const z=9+floor*11,win=(floor+col+index)%4===0?'#f4d493':'#d7e7e090';
      const a=point(x+.28+col*w/3,y+d+.005,z),b=point(x+.28+col*w/3+w*.17,y+d+.005,z);
      polygon([a,b,{x:b.x,y:b.y-5},{x:a.x,y:a.y-5}],win);
      const c=point(x+w+.005,y+.2+col*d/3,z),e=point(x+w+.005,y+.2+col*d/3+d*.17,z);
      polygon([c,e,{x:e.x,y:e.y-5},{x:c.x,y:c.y-5}],(index+floor)%3===0?'#f4d493':'#add6dc80');
    }
    if(kind===1){box(x+.2,y+.2,w-.4,d-.4,h+14,shade(color,1.02));plane(x+.35,y+.3,w-.7,d-.6,h+15,'#31485d');}
    if(kind===2){plane(x+.15,y+.15,w-.3,d-.3,h+1,'#5f776b');for(let n=0;n<3;n++)plane(x+.3+n*.42,y+.3,.3,.8,h+2,'#526a7f');}
    if(kind===3){const p=point(x+w/2,y+d/2,h+8);ctx.strokeStyle='#a8c2ce';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-24);ctx.stroke();ctx.fillStyle='#f4bc73';ctx.beginPath();ctx.arc(p.x,p.y-24,2.4,0,7);ctx.fill();}
    if(isMerchant){
      const awningColor=['#c95d4a','#3d8195','#a476a7','#50896f'][index%4];
      for(let n=0;n<5;n++)plane(x+n*w/5,y+d-.1,w/5,.45,13,n%2?'#e9e0ce':awningColor);
      const p=point(x+w*.5,y+d,20);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(.46);ctx.fillStyle='#20323f';ctx.fillRect(-w*7,-6,w*14,12);text(name.slice(0,13).toUpperCase(),0,3,6.8,'#f6ecd6');ctx.restore();
      const center=point(x+w/2,y+d/2,h+8),base=point(x+w,y+d);
      hits.push({id,x:center.x-36,y:center.y-12,w:75,h:base.y-center.y+22});
      if(id===selected||id===hover){
        plane(x-.18,y-.18,w+.36,d+.36,1,'#e9ba5b55','#f9d283');
        ctx.strokeStyle='#ffd481';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(center.x,center.y-4);ctx.lineTo(center.x,center.y-20);ctx.stroke();
        ctx.fillStyle='#f5cf84';ctx.beginPath();ctx.arc(center.x,center.y-24,5,0,7);ctx.fill();
      }
    }
  }
  function hub(){
    plane(10.1,12.6,6.3,3.3,1,'#b4baac');
    box(11.4,13.1,3.3,2.0,100,'#80b4da');
    plane(11.65,13.3,2.8,1.6,102,'#166bc2');
    for(let n=0;n<7;n++){
      const a=point(11.65,15.11,17+n*11),b=point(14.45,15.11,17+n*11);
      polygon([a,b,{x:b.x,y:b.y-6},{x:a.x,y:a.y-6}],n%2?'#dbf0f5':'#a4d6ef');
    }
    const sign=point(13,15.25,80);ctx.save();ctx.translate(sign.x,sign.y);ctx.rotate(.46);ctx.fillStyle='#123964';ctx.fillRect(-36,-14,72,24);text('PayPal',0,3,16,'#c4eeff');ctx.restore();
    const roof=point(13,14.3,116);text('PAYMENT EXCHANGE',roof.x,roof.y,8,'#c1deed');
    for(let i=0;i<3;i++){plane(10.4+i*1.8,15.4,.9,.25,1,'#f2dc9c');}
  }
  function person(x,y,color){const p=point(x,y);ctx.fillStyle='#13262b55';ctx.beginPath();ctx.ellipse(p.x,p.y+2,3.5,1.7,0,0,7);ctx.fill();ctx.fillStyle=color;ctx.fillRect(p.x-2,p.y-6,4,6);ctx.fillStyle='#e8c39d';ctx.beginPath();ctx.arc(p.x,p.y-8,2.1,0,7);ctx.fill();}
  function car(x,y,color,van=false){box(x,y,van ? .72 : .5,van?1.1:.85,van?8:5,color);plane(x+.06,y+.1,van ? .58 : .38,.3,van?9:6,'#bdd8e4');}
  function draw(){
    const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;if(!paused&&!reduced.matches)time+=dt;
    ctx.clearRect(0,0,width,height);
    const bg=ctx.createRadialGradient(width*.5,height*.45,20,width*.5,height*.5,width*.8);bg.addColorStop(0,'#263b49');bg.addColorStop(1,'#111d27');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
    ctx.save();ctx.translate(width*.5+pan.x,height*.15+pan.y);ctx.scale(scale*zoom,scale*zoom);ctx.translate(0,40);
    // An island city, water edge, raised streets and three commercial neighborhoods.
    plane(-2,-2,30,31,-15,'#122c3d');
    for(let i=0;i<18;i++){const p=point(-3+i*1.8,30);ctx.strokeStyle='#325c7045';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+14,p.y-3);ctx.stroke();}
    box(-.8,-.8,27.2,29,5,'#667e80');plane(0,0,25.6,27.4,6,'#8f9c91');
    for(let row=0;row<7;row++)for(let col=0;col<6;col++)plane(.35+col*4.2,.35+row*3.8,3.2,2.8,6,['#9aa799','#9ba4a2','#a9aa91'][Math.floor(row/3)%3]);
    for(let col=0;col<7;col++){
      plane(-.3+col*4.2,-.35,.72,28.1,7,'#3b4c55');
      for(let z=0;z<26;z+=1.6)plane(.02+col*4.2,z,.04,.55,8,'#b3bdb755');
    }
    for(let row=0;row<8;row++){
      plane(-.4,-.25+row*3.8,26.2,.75,7,'#3b4c55');
      for(let z=0;z<26;z+=1.6)plane(z,.08+row*3.8,.6,.035,8,'#b3bdb755');
    }
    const merchants=frame?.merchants||Array.from({length:24},(_,i)=>({merchant_id:`preview-${i}`,name:['Paper & Co.','Orbit Audio','Hearth Market','Thread Studio','Field Supply','Lumen Living'][i%6],color:palette[i%6],sold:0}));
    const items=[];
    for(let i=0;i<positions.length;i++){
      const pos=positions[i],m=merchants[i];const tall=i<6||i%9===0;
      items.push({depth:pos.x+pos.y,draw:()=>building(pos.x-1.1,pos.y-1.0,2.05,1.75,tall?66+(i%4)*20:28+(i%3)*13,m?.color||'#9babae',i%4,i,m?.name||'CITY WORKS',!!m,m?.merchant_id)});
      if(i%2===0)items.push({depth:pos.x+pos.y+2.5,draw:()=>tree(pos.x-1.5,pos.y+1.15)});
    }
    items.push({depth:27.5,draw:hub});hits=[];
    items.sort((a,b)=>a.depth-b.depth).forEach(i=>i.draw());
    for(let i=0;i<42;i++){
      const progress=(time*(.4+(i%3)*.1)+i*1.73)%26;
      const lane=i%7*3.8+.15;
      if(i%4===0)car(progress,lane,['#f0c988','#c3d9e6','#da9f94'][i%3],i%8===0);
      else person(progress,lane+.48,['#e0ad70','#9dcbd2','#c4a6de','#f4e0af'][i%4]);
    }
    for(const pulse of pulses){const age=now-pulse.at;if(age>2200)continue;const index=merchants.findIndex(m=>m.merchant_id===pulse.id);if(index<0)continue;const pos=positions[index],p=point(pos.x,pos.y,85+age*.015);ctx.globalAlpha=1-age/2200;text(pulse.text,p.x,p.y,12,pulse.color);ctx.globalAlpha=1;}
    pulses=pulses.filter(p=>now-p.at<2300);
    [['EXCHANGE QUARTER',3,0],['STUDIO MILE',24,9],['FOUNDRY PARK',6,27]].forEach(([s,x,y])=>{const p=point(x,y,15);text(s,p.x,p.y,9,'#cfdbd9');});
    ctx.restore();
    requestAnimationFrame(draw);
  }
  const hitAt=e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left-width*.5-pan.x)/(scale*zoom),y=(e.clientY-r.top-height*.15-pan.y)/(scale*zoom)-40;return [...hits].reverse().find(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h)?.id||null;};
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y,moved:false};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{
    if(drag){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5)drag.moved=true;if(drag.moved)pan={x:drag.px+e.clientX-drag.x,y:drag.py+e.clientY-drag.y};return;}
    hover=hitAt(e);canvas.style.cursor=hover?'pointer':'grab';
  });
  canvas.addEventListener('pointerup',e=>{const hit=hitAt(e);if(drag&&!drag.moved&&hit){selected=hit;onSelect(hit);}drag=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.65,Math.min(1.8,zoom-e.deltaY*.001));},{passive:false});
  resize();requestAnimationFrame(draw);
  return {setFrame(next){frame=next;for(const a of next.activities||[])if(a.type==='purchase'||a.type==='refund')pulses.push({id:a.merchantId,at:performance.now(),text:(a.type==='refund'?'−':'+')+'$'+(a.amount/100).toFixed(0),color:a.type==='refund'?'#ffb0a2':'#e8d595'});pulses=pulses.slice(-30);},setPaused(value){paused=value;},select(id){selected=id;},home(){pan={x:0,y:0};zoom=1;},zoomIn(){zoom=Math.min(1.8,zoom+.15);},zoomOut(){zoom=Math.max(.65,zoom-.15);}};
}

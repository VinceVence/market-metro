// Original supply-operation artwork. No Mint Town scenery or character assets.
export const WIDTH=960,HEIGHT=600;
export const PLACES=[
  {id:'primary',x:35,y:65,w:260,h:175,name:'Northshore warehouse',kind:'warehouse',entry:{x:305,y:265}},
  {id:'supply',x:35,y:355,w:260,h:170,name:'Backup stock',kind:'backup',entry:{x:305,y:545}},
  {id:'jun',x:390,y:65,w:215,h:110,name:'Jun · Print supplies',kind:'merchant',entry:{x:495,y:195}},
  {id:'mara',x:390,y:215,w:215,h:180,name:'Mara · Office supply',kind:'packing',entry:{x:495,y:430}},
  {id:'office-a',x:710,y:65,w:215,h:150,name:'West Studio',kind:'office',entry:{x:685,y:230}},
  {id:'office-b',x:710,y:285,w:215,h:120,name:'Ledger Office',kind:'office',entry:{x:685,y:430}},
  {id:'lab',x:390,y:475,w:215,h:90,name:'Agent workbench',kind:'agents',entry:{x:495,y:580}},
  {id:'paypal',x:710,y:475,w:215,h:90,name:'PayPal · reserve desk',kind:'paypal',entry:{x:685,y:545}}
];
export const NODES=[[325,40],[325,195],[495,195],[660,195],[660,40],[325,265],[305,265],[325,430],[495,430],[660,430],[660,230],[685,230],[685,430],[325,545],[305,545],[325,580],[430,580],[480,580],[530,580],[660,580],[660,545],[685,545],[495,580]].map(([x,y])=>({x,y}));
export const EDGES=[[0,1],[1,2],[2,3],[3,4],[1,5],[5,6],[5,7],[7,8],[8,9],[3,10],[10,9],[10,11],[9,12],[7,13],[13,14],[13,15],[15,16],[16,17],[17,22],[22,18],[18,19],[9,20],[20,19],[20,21]];
const C={floor:'#e8edf0',ink:'#314a5d',line:'#b6c5cd',steel:'#7d98a9',navy:'#3f657f',amber:'#dfa35c',kraft:'#cda779',cream:'#f8f7ee'};
export function rounded(ctx,x,y,w,h,r,fill,stroke=null){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
export function label(ctx,text,x,y,size=13,color=C.ink,align='left'){ctx.fillStyle=color;ctx.font=`600 ${size}px "DM Sans",sans-serif`;ctx.textAlign=align;ctx.fillText(text,x,y);}
export function carton(ctx,x,y,scale=1,letter='A4'){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);rounded(ctx,0,2,28,23,2,'#ac8864');rounded(ctx,0,0,28,21,2,C.kraft);ctx.fillStyle='#edcc98';ctx.fillRect(12,0,4,21);ctx.strokeStyle='#a5825e';ctx.strokeRect(.5,.5,27,20);ctx.fillStyle='#f7f1df';ctx.fillRect(3,8,8,7);label(ctx,letter,7,13,5,'#5a665f','center');ctx.restore();
}
export function pallet(ctx,x,y,count=2){rounded(ctx,x-3,y+23,67,5,1,'#a28769');ctx.fillStyle='#8b735e';for(let j=0;j<3;j++)ctx.fillRect(x+j*23,y+28,5,4);for(let i=0;i<count;i++)carton(ctx,x+(i%2)*31,y-Math.floor(i/2)*23);}
function shelf(ctx,x,y,w){
  ctx.fillStyle='#657d8c';ctx.fillRect(x,y,w,7);ctx.fillRect(x,y+40,w,6);ctx.fillRect(x,y+78,w,6);
  ctx.fillStyle='#d39b58';ctx.fillRect(x,y-4,6,92);ctx.fillRect(x+w-6,y-4,6,92);
}
function desk(ctx,x,y,w=68){
  rounded(ctx,x+3,y+4,w,32,3,'#93a6ac');rounded(ctx,x,y,w,28,3,'#d9c3a5');rounded(ctx,x+17,y-7,31,19,2,'#455f73');rounded(ctx,x+20,y-5,25,13,1,'#9cc8dc');ctx.fillStyle='#e7eef0';ctx.fillRect(x+23,y+16,24,6);ctx.fillStyle='#9e7d58';ctx.fillRect(x+6,y+27,4,10);ctx.fillRect(x+w-10,y+27,4,10);
  rounded(ctx,x+25,y+35,22,17,5,'#67899f');
}
function printer(ctx,x,y){rounded(ctx,x+3,y+7,40,28,3,'#96a9b2');rounded(ctx,x,y,40,30,3,'#f0f4f4','#afc1c9');rounded(ctx,x+8,y+3,23,5,1,'#7894a5');ctx.fillStyle='#3e758d';ctx.fillRect(x+8,y+16,24,6);ctx.fillStyle='#fff';ctx.fillRect(x+12,y+19,16,18);ctx.strokeStyle='#b9c9cf';ctx.beginPath();ctx.moveTo(x+16,y+26);ctx.lineTo(x+25,y+26);ctx.stroke();}
function room(ctx,p){
  rounded(ctx,p.x+5,p.y+8,p.w,p.h,7,'#a9b7bf40');rounded(ctx,p.x,p.y,p.w,p.h,6,'#f7f8f5','#9fb3be');
  ctx.fillStyle=p.kind==='warehouse'||p.kind==='backup'?'#b4c4cc':'#cedbe0';ctx.fillRect(p.x+1,p.y+1,p.w-2,30);
  ctx.fillStyle=p.kind==='paypal'?'#44749d':p.kind==='packing'?'#cd9351':'#809eae';ctx.fillRect(p.x+1,p.y+1,5,p.h-2);
  label(ctx,p.name,p.x+15,p.y+21,12,p.kind==='paypal'?'#24577d':C.ink);
  if(p.kind==='warehouse'||p.kind==='backup'){
    shelf(ctx,p.x+22,p.y+51,p.w-45);
    ctx.fillStyle='#e8ecea';ctx.fillRect(p.x+10,p.y+p.h-28,p.w-20,20);
    for(let j=0;j<8;j++){ctx.fillStyle=j%2?'#d9ae69':'#586974';ctx.fillRect(p.x+16+j*27,p.y+p.h-8,21,5);}
  }else if(p.kind==='packing'){
    rounded(ctx,p.x+18,p.y+52,p.w-36,75,3,'#c9d3d2');rounded(ctx,p.x+23,p.y+57,p.w-46,65,2,'#e7d8bd');
    rounded(ctx,p.x+34,p.y+71,49,33,2,'#b7d1d2');ctx.strokeStyle='#8aaeb3';ctx.lineWidth=1;for(let j=0;j<4;j++){ctx.beginPath();ctx.moveTo(p.x+36+j*12,p.y+73);ctx.lineTo(p.x+36+j*12,p.y+102);ctx.stroke();}
    ctx.fillStyle='#e3b366';ctx.beginPath();ctx.arc(p.x+137,p.y+88,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e7d8bd';ctx.beginPath();ctx.arc(p.x+137,p.y+88,7,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#b59c76';ctx.setLineDash([3,3]);ctx.strokeRect(p.x+86,p.y+66,18,45);ctx.setLineDash([]);
    rounded(ctx,p.x+19,p.y+138,65,25,3,'#5c8296');label(ctx,'PACKING',p.x+52,p.y+154,9,'#f5f7f3','center');
  }else if(p.kind==='merchant'){
    desk(ctx,p.x+20,p.y+49,75);carton(ctx,p.x+129,p.y+57);ctx.fillStyle='#94aab4';ctx.fillRect(p.x+126,p.y+85,65,4);
  }else if(p.kind==='office'){
    desk(ctx,p.x+16,p.y+49,75);printer(ctx,p.x+132,p.y+56);
  }else if(p.kind==='paypal'){
    rounded(ctx,p.x+16,p.y+43,38,30,4,'#396b96');label(ctx,'P',p.x+35,p.y+64,20,'#fff','center');
    rounded(ctx,p.x+69,p.y+46,122,24,3,'#dce8ed');label(ctx,'Review & authorize',p.x+130,p.y+62,9,'#41657c','center');
  }else{
    for(let i=0;i<3;i++){rounded(ctx,p.x+16+i*63,p.y+44,53,27,3,'#bdccd1');rounded(ctx,p.x+25+i*63,p.y+39,35,22,2,'#4c6f80');ctx.fillStyle='#b3d6dd';ctx.fillRect(p.x+28+i*63,p.y+42,29,14);}
  }
}
export function paintYard(ctx){
  ctx.fillStyle=C.floor;ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.strokeStyle='#d9e1e5';ctx.lineWidth=1;for(let x=0;x<WIDTH;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,HEIGHT);ctx.stroke();}for(let y=0;y<HEIGHT;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
  label(ctx,'SUPPLY IN',45,34,10,'#698395');label(ctx,'SORT & PACK',396,34,10,'#698395');label(ctx,'OFFICE ORDERS',716,34,10,'#698395');
  // Shared loading lanes, not a street grid or city map.
  ctx.lineWidth=18;ctx.lineCap='round';ctx.strokeStyle='#d5dfe3';
  for(const [a,b] of [[{x:325,y:45},{x:325,y:580}],[{x:660,y:45},{x:660,y:580}],[{x:325,y:195},{x:660,y:195}],[{x:325,y:430},{x:685,y:430}],[{x:325,y:580},{x:685,y:580}]]){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  ctx.strokeStyle='#f6f5e7';ctx.lineWidth=2;ctx.setLineDash([8,10]);for(const x of [325,660]){ctx.beginPath();ctx.moveTo(x,45);ctx.lineTo(x,585);ctx.stroke();}ctx.setLineDash([]);ctx.lineCap='butt';
  for(const p of PLACES)room(ctx,p);
  // The space below the inbound dock holds the current action caption.
  for(const x of [355,625]){ctx.fillStyle='#d5a55f';ctx.beginPath();ctx.moveTo(x,427);ctx.lineTo(x+10,430);ctx.lineTo(x,433);ctx.fill();}
  // Forklift parked alongside the inbound bay.
  rounded(ctx,65,248,39,19,3,'#d9a65f');ctx.fillStyle='#4d6875';ctx.fillRect(75,242,15,13);ctx.strokeStyle='#556b76';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(105,240);ctx.lineTo(105,268);ctx.lineTo(118,268);ctx.stroke();
  ctx.fillStyle='#40515e';ctx.beginPath();ctx.arc(73,269,5,0,Math.PI*2);ctx.arc(98,269,5,0,Math.PI*2);ctx.fill();
}

const SKIN=['#d7aa85','#b18162','#ecc9a7','#91674d'];
const hash=text=>[...text].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,17);
export function drawWorker(ctx,x,y,id,role='merchant',frame=0,direction='down'){
  const n=hash(id),skin=SKIN[n%4],vest=['supplier','dispatcher'].includes(role),agent=role==='agent',coat=agent?'#3b8394':role==='reviewer'?'#3f6b91':vest?'#d9a24d':['#4d718a','#b77b58','#779199'][n%3],stride=Math.sin(frame*Math.PI/2)*3;
  ctx.save();ctx.translate(x,y);ctx.fillStyle='#5d778b26';ctx.beginPath();ctx.ellipse(0,1,11,4,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#425665';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-4,-14);ctx.lineTo(-5-stride,0);ctx.moveTo(4,-14);ctx.lineTo(5+stride,0);ctx.stroke();
  rounded(ctx,-9,-31,18,20,4,coat);ctx.strokeStyle=skin;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-10,-27);ctx.lineTo(-11+stride,-15);ctx.moveTo(10,-27);ctx.lineTo(12-stride,-17);ctx.stroke();
  ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(0,-40,7,9,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#3d454a';ctx.beginPath();ctx.ellipse(0,-45,7,4,0,Math.PI,Math.PI*2);ctx.fill();
  if(vest){rounded(ctx,-9,-49,18,6,3,'#efc35c');ctx.fillStyle='#e6edca';ctx.fillRect(-7,-24,14,3);ctx.fillRect(-5,-29,2,17);ctx.fillRect(4,-29,2,17);}
  else{ctx.fillStyle='#d9eaf0';ctx.fillRect(-3,-30,6,5);ctx.fillStyle=agent?'#f2e3bd':'#d5e8eb';ctx.fillRect(3,-24,4,5);}
  if(direction!=='up'){ctx.fillStyle='#3b4a52';ctx.fillRect(direction==='left'?-4:direction==='right'?3:-3,-41,2,2);if(direction==='down')ctx.fillRect(3,-41,2,2);}
  if(role==='merchant'||agent){rounded(ctx,10,-25,9,13,1,'#ede7d6','#8d9da1');ctx.strokeStyle='#8da2aa';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(12,-21);ctx.lineTo(17,-21);ctx.moveTo(12,-17);ctx.lineTo(17,-17);ctx.stroke();}
  ctx.restore();
}
export function drawVan(ctx,x,y,direction='left',loaded=false){
  ctx.save();ctx.translate(x,y);if(direction==='up'||direction==='down')ctx.rotate(Math.PI/2);if(direction==='right'||direction==='down')ctx.scale(-1,1);
  ctx.fillStyle='#68829330';ctx.beginPath();ctx.ellipse(0,9,31,12,0,0,Math.PI*2);ctx.fill();
  rounded(ctx,-29,-15,58,28,6,'#4c819e');rounded(ctx,-29,-12,19,22,4,'#6ba2bc');rounded(ctx,-25,-9,13,12,2,'#c0dce5');rounded(ctx,-5,-12,29,21,2,'#f2f4ee');ctx.fillStyle='#ddb16e';ctx.fillRect(0,-4,20,3);label(ctx,loaded?'SUPPLY':'VAN',9,5,5,'#5e7581','center');
  ctx.fillStyle='#344958';for(const xx of [-19,18]){ctx.beginPath();ctx.ellipse(xx,14,5,4,0,0,Math.PI*2);ctx.fill();}ctx.restore();
}

// Original code-drawn pixel art. Rendering consumes public simulation events only.
export function createGarden(parent,{onCustomer,onMerchant,onTeam}={}){
  const P=window.Phaser,W=1200,H=800;
  let scene,frame=null,zoom=1,drag=false,lastPointer=null;
  const actors=new Map(),shops=[],labels=[];
  const grass=['#8eac63','#92af68','#9ab66c','#88a65f'];
  const roofs=['#b65d48','#698c92','#b68a48','#6b8c61','#9d6b72','#c39354','#668a88','#a0714e'];
  const positions=Array.from({length:12},(_,i)=>({x:200+(i%4)*240,y:i<4?250:i<8?558:710}));
  const pixel=(key,width,height,paint)=>{
    const texture=scene.textures.createCanvas(key,width,height),c=texture.getContext();c.imageSmoothingEnabled=false;paint(c);texture.refresh();
  };
  const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const text=(x,y,value,size=12,color='#354738')=>scene.add.text(x,y,value,{fontFamily:'DM Sans, sans-serif',fontSize:size,color,fontStyle:'bold',align:'center',padding:{x:4,y:2}}).setOrigin(.5).setDepth(1500);
  function assets(){
    for(let i=0;i<4;i++)pixel('grass'+i,32,32,c=>{rect(c,0,0,32,32,grass[i]);for(let j=0;j<7;j++)rect(c,(j*13+i*3)%30,(j*19+i*7)%30,2,1,j%2?'#b1c781':'#78965b');});
    pixel('path',32,32,c=>{rect(c,0,0,32,32,'#d9c59a');rect(c,0,0,32,2,'#cfb88b');for(let j=0;j<6;j++)rect(c,(j*11)%30,(j*7)%30,2,1,'#bda679');});
    pixel('water',32,32,c=>{rect(c,0,0,32,32,'#79b3b0');rect(c,4,9,13,2,'#a7cfbf');rect(c,20,22,10,2,'#b7d9c9');});
    pixel('tree',48,70,c=>{rect(c,20,46,9,24,'#765d40');rect(c,26,48,3,19,'#9b7951');rect(c,8,30,34,25,'#456c45');rect(c,3,23,40,22,'#527d4a');rect(c,9,10,31,29,'#628a50');rect(c,16,3,19,21,'#729a59');rect(c,10,25,11,6,'#82a760');rect(c,28,36,11,7,'#3f6943');});
    pixel('flower',16,16,c=>{rect(c,7,8,2,8,'#547343');rect(c,3,10,4,2,'#64894c');rect(c,4,3,8,6,'#f1c481');rect(c,6,1,4,10,'#efb177');rect(c,7,4,2,3,'#8e6744');});
    for(let i=0;i<8;i++)pixel('shop'+i,84,88,c=>{
      rect(c,7,24,72,61,'#6c604a');rect(c,9,26,68,56,'#f0dfb6');rect(c,9,70,68,12,'#c0a880');
      rect(c,5,29,76,5,'#754e3e');rect(c,8,20,70,11,roofs[i]);rect(c,13,12,60,10,roofs[i]);rect(c,20,5,46,9,roofs[i]);
      rect(c,20,4,46,3,'#ddad78');for(let y=14;y<29;y+=6)rect(c,9,y,66,2,'#60473a55');
      rect(c,51,2,8,15,'#af9472');rect(c,50,1,10,4,'#d5bc94');rect(c,12,34,63,4,'#f5edcd');
      for(let x=12;x<74;x+=9)rect(c,x,34,5,9,i%2?'#d09462':'#85a09a');
      rect(c,14,48,18,19,'#778e81');rect(c,17,50,12,12,'#b5c8b1');rect(c,22,49,2,16,'#eaddb4');rect(c,15,57,16,2,'#eaddb4');
      rect(c,53,48,18,19,'#778e81');rect(c,56,50,12,12,'#b5c8b1');rect(c,61,49,2,16,'#eaddb4');rect(c,54,57,16,2,'#eaddb4');
      rect(c,35,49,16,33,'#8b6c4a');rect(c,38,52,10,16,'#b7c2a1');rect(c,46,72,2,2,'#f1cd83');rect(c,33,80,20,5,'#bfa681');
      rect(c,6,68,7,14,'#b87753');rect(c,4,62,11,10,'#6f9659');rect(c,73,70,8,12,'#b87753');rect(c,72,64,10,8,'#7fa367');
      rect(c,12,44,20,3,'#caac80');rect(c,53,44,20,3,'#caac80');
    });
    pixel('house',64,60,c=>{rect(c,8,23,49,34,'#d8c7a1');rect(c,4,20,57,8,'#887b63');rect(c,10,12,45,9,'#a18e6a');rect(c,17,5,31,9,'#ab9872');rect(c,25,33,12,24,'#816d51');rect(c,12,33,9,12,'#aac0ac');rect(c,42,33,9,12,'#aac0ac');});
    for(let skin=0;skin<6;skin++)for(let step=0;step<3;step++)pixel('person'+skin+'-'+step,18,27,c=>{
      const clothes=['#b87757','#7396a0','#d1a45b','#8a80a2','#779768','#bd7f92'],skins=['#e5b785','#c68e60','#9c6b4a','#edc399','#bc865c','#d5a778'];
      rect(c,5,22,9,3,'#52644855');rect(c,5,18,3,6+(step===1?1:0),'#4e5d5b');rect(c,10,18,3,6-(step===1?1:0),'#4e5d5b');
      rect(c,4,11,10,9,clothes[skin]);rect(c,2,12,3,6,skins[skin]);rect(c,14,12,2,6,skins[skin]);
      rect(c,4,3,10,10,skins[skin]);rect(c,3,2,12,5,skin%2?'#5b493d':'#92734d');rect(c,4,1,9,3,skin%2?'#5b493d':'#92734d');
      rect(c,5,7,1,2,'#4c4438');rect(c,11,7,1,2,'#4c4438');rect(c,7,11,4,1,'#ae7856');rect(c,4,24,5,2,'#675344');rect(c,10,24,5,2,'#675344');
    });
    pixel('van',38,24,c=>{rect(c,2,5,30,15,'#e5d9b9');rect(c,25,8,11,12,'#bb8060');rect(c,27,9,7,6,'#a9c4b5');rect(c,7,8,14,8,'#769485');rect(c,6,19,7,5,'#4b5148');rect(c,27,19,7,5,'#4b5148');});
  }
  function ground(){
    const g=scene.add.graphics().setDepth(1);
    for(let y=0;y<H;y+=32)for(let x=0;x<W;x+=32)scene.add.image(x,y,x>=1120?'water':'grass'+((x/32+y/32*3)%4)).setOrigin(0);
    const road=(x,y,w,h)=>{for(let a=x;a<x+w;a+=32)for(let b=y;b<y+h;b+=32)scene.add.image(a,b,'path').setOrigin(0);};
    road(64,276,1024,64);road(64,580,1024,64);road(64,276,64,512);road(1024,276,64,512);road(64,756,1024,32);road(512,308,128,288);
    g.fillStyle(0xcbbb96).fillRect(448,348,256,180);g.lineStyle(4,0xb3a181).strokeRect(450,350,252,176);
    g.fillStyle(0x8ea785).fillRect(479,374,194,124);g.fillStyle(0xd7cfac).fillRect(510,389,130,94);
    g.fillStyle(0x819b95).fillRect(528,400,94,72);g.fillStyle(0xb8d5c2).fillRect(537,408,76,55);g.fillStyle(0x8db8b1).fillRect(545,417,60,40);
    g.fillStyle(0xede2bb).fillRect(567,395,18,46);g.fillStyle(0xd3bc8c).fillRect(558,399,36,12);
    for(const [x,y] of [[36,130],[90,65],[1100,140],[1110,450],[41,510],[360,390],[780,397],[1060,740],[47,741],[945,718],[722,735]]){
      scene.add.image(x,y,'tree').setOrigin(.5,1).setScale(1.5).setDepth(y);
    }
    for(let i=0;i<30;i++)scene.add.image(455+(i%10)*25,355+Math.floor(i/10)*77,'flower').setDepth(430);
    for(let i=0;i<4;i++)scene.add.image(235+i*225,751,'house').setOrigin(.5,1).setScale(1.4).setDepth(751);
    for(const [x,y] of [[380,390],[755,490]]){g.fillStyle(0x816548).fillRect(x,y,50,9);g.fillRect(x+3,y+17,44,7);g.fillRect(x+6,y+5,4,30);g.fillRect(x+41,y+5,4,30);}
    text(574,511,'MARKET SQUARE',11,'#657456');
    const studio=scene.add.image(173,420,'shop5').setOrigin(.5,1).setScale(1).setDepth(420).setInteractive({useHandCursor:true});studio.on('pointerup',()=>onTeam?.());
    text(173,391,'TEAM STUDIO',11).setBackgroundColor('#f4e8c9');text(173,409,'Local models',8,'#5e705b');
    const pay=scene.add.image(950,420,'shop1').setOrigin(.5,1).setScale(1).setDepth(420);
    text(950,391,'PayPal',14,'#315d6c').setBackgroundColor('#f4e8c9');text(950,409,'Simulated checkout',8,'#5e705b');
    scene.add.image(1034,669,'van').setScale(1.45).setDepth(670);
  }
  function fit(){
    if(!scene)return;const c=scene.cameras.main;
    c.setZoom(Math.min(scene.scale.width/1050,scene.scale.height/650)*zoom);c.centerOn(W/2,H/2);
  }
  function renderShops(){
    shops.forEach(x=>x.destroy());labels.forEach(x=>x.destroy());shops.length=0;labels.length=0;
    const data=frame?.merchants||Array.from({length:8},(_,i)=>({position:i,name:['Willow Goods','Oak & Ink','Corner Supply','Sunroom Market','River General','Juniper House','The Desk Shop','Clover Trading'][i]}));
    for(const m of data){
      const p=positions[m.position],im=scene.add.image(p.x,p.y,'shop'+m.position%8).setScale(1.55).setOrigin(.5,1).setDepth(p.y);
      im.setInteractive({useHandCursor:true}).on('pointerup',()=>{if(!drag&&m.merchant_id)onMerchant?.(m.merchant_id);});shops.push(im);
      const name=text(p.x,p.y+13,m.name,14,'#365640');labels.push(name);
    }
  }
  function setActor(u,animate){
    let actor=actors.get(u.id);
    if(!actor){
      const home={x:160+(u.index%4)*225+(u.index%5)*8,y:768+(u.index%3)*5};
      const image=scene.add.sprite(home.x,home.y,'person'+u.index%6+'-0').setScale(1.55).setOrigin(.5,1).setDepth(home.y).setInteractive({useHandCursor:true});
      const bubble=text(home.x,home.y-48,'',11,'#624d35').setBackgroundColor('#fff0be').setVisible(false);
      image.on('pointerup',()=>{if(!drag)onCustomer?.(u.id);});
      actor={image,bubble,home};actors.set(u.id,actor);
    }
    actor.data=u;const p=frame.merchants.find(m=>m.merchant_id===u.lastMerchant)?.position??u.index%frame.merchants.length;
    const target=positions[p],busy=['purchase','redeem','browse','coupon'].includes(u.lastAction),x=busy?target.x+(u.index%5-2)*9:actor.home.x,y=busy?target.y+35+(u.index%3)*7:actor.home.y;
    actor.bubble.setText(u.lastAction==='redeem'?'✓ '+u.coupon?.pct+'%':u.lastAction==='coupon'?(u.coupon?.pct||5)+'%':u.lastAction==='purchase'?'＋':'').setVisible(['redeem','coupon','purchase'].includes(u.lastAction));
    scene.tweens.killTweensOf(actor.image);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(animate&&!reduced){
      actor.image.play('walk'+u.index%6,true);
      const sourceStreet=actor.image.y<450?307:actor.image.y<660?611:772;
      const street=y<400?307:y<660?611:772,edge=actor.image.x<600?96:1056;
      scene.tweens.chain({targets:actor.image,tweens:[{y:sourceStreet,duration:140},{x:edge,duration:340},{y:street,duration:300},{x,duration:420},{y,duration:160}],onComplete:()=>actor.image.stop()});
    }else actor.image.setPosition(x,y);
  }
  const game=new P.Game({type:P.CANVAS,parent,width:parent.clientWidth,height:parent.clientHeight,backgroundColor:'#8fac68',pixelArt:true,roundPixels:true,antialias:false,
    scale:{mode:P.Scale.RESIZE},render:{pixelArt:true},scene:{
      create(){scene=this;assets();ground();
        for(let i=0;i<6;i++)this.anims.create({key:'walk'+i,frames:[0,1,2,1].map(j=>({key:'person'+i+'-'+j})),frameRate:7,repeat:-1});
        renderShops();fit();this.scale.on('resize',fit);
        this.input.on('pointerdown',p=>{lastPointer={x:p.x,y:p.y};drag=false;});
        this.input.on('pointermove',p=>{if(p.isDown&&lastPointer){const dx=p.x-lastPointer.x,dy=p.y-lastPointer.y;if(Math.abs(dx)+Math.abs(dy)>3)drag=true;this.cameras.main.scrollX-=dx/this.cameras.main.zoom;this.cameras.main.scrollY-=dy/this.cameras.main.zoom;lastPointer={x:p.x,y:p.y};}});
        this.input.on('pointerup',()=>{lastPointer=null;setTimeout(()=>drag=false,30);});
        this.input.on('wheel',(p,objects,dx,dy)=>{zoom=Math.min(2.5,Math.max(.8,zoom+(dy<0?.10:-.10)));fit();});
        if(frame)setFrame(frame);
      },
      update(){for(const a of actors.values()){a.image.setDepth(a.image.y);a.bubble.setPosition(a.image.x,a.image.y-45).setDepth(1600);}}
    }});
  function setFrame(next){
    const changed=frame?.runId!==next.runId,dayChanged=frame?.tick!==next.tick;
    frame=next;if(!scene)return;
    if(changed){for(const a of actors.values()){a.image.destroy();a.bubble.destroy();}actors.clear();renderShops();}
    const active=(next.activities||[]).filter(a=>a.customerId&&['redemption','coupon','purchase'].includes(a.type)).slice(0,14).map(a=>a.customerId);
    const ids=new Set([...next.customers.slice(0,34).map(u=>u.id),...active]);
    for(const [id,a]of actors)if(!ids.has(id)){scene.tweens.killTweensOf(a.image);a.image.destroy();a.bubble.destroy();actors.delete(id);}
    for(const u of next.customers.filter(u=>ids.has(u.id)))setActor(u,!changed&&dayChanged);
  }
  return {setFrame,zoomIn(){zoom=Math.min(2.5,zoom+.15);fit();},zoomOut(){zoom=Math.max(.8,zoom-.15);fit();},home(){zoom=1;fit();},destroy(){game.destroy(true);}};
}

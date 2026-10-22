import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildDistrict} from './city-art.mjs';
import {createLayout,createWalker,requestDestination,updateWalker,homePoint,shopPoint,distance} from './tycoon-motion.mjs';

const shirtColors=[0xc67f5b,0x648ca5,0xc6a855,0x8679a8,0x6e9572,0xb17b91];
const skins=[0xe0b38e,0xc59068,0x9b6a4d,0xedc19b,0xb8835c,0xd1a47d];

export function createGarden(parent,{onCustomer,onMerchant,onTeam,onPayments}={}){
  let frame=null,layout=createLayout(8),lastRun=null,lastTick=-1,scene,renderer,camera,controls,world,raf=0;
  let hovered=null,selected=null,pointerInside=false,dragging=false,down=null,lastTime=0,statsTime=0,rotationTarget=null;
  const pointer=new THREE.Vector2(),ray=new THREE.Raycaster(),actors=new Map(),pickables=[],labels=[],materials=new Map();
  let mode='city',city=null,labelClock=0;
  const svgNS='http://www.w3.org/2000/svg',connections=document.createElementNS(svgNS,'svg');connections.classList.add('city-connections');connections.setAttribute('aria-hidden','true');parent.append(connections);
  const labelLayer=document.createElement('div');labelLayer.className='city-labels';labelLayer.setAttribute('aria-label','Places in the district');parent.append(labelLayer);
  const tooltip=document.createElement('div');tooltip.className='world-tooltip';tooltip.hidden=true;tooltip.setAttribute('role','status');
  tooltip.innerHTML='<strong></strong><span></span>';parent.append(tooltip);
  let pointerX=0,pointerY=0,hoverRing,selectRing,van=null;
  const boxGeo=new THREE.BoxGeometry(1,1,1),bodyGeo=new THREE.CapsuleGeometry(.22,.45,3,7),headGeo=new THREE.SphereGeometry(.19,9,6);
  const limbGeo=new THREE.CapsuleGeometry(.075,.36,2,6),shoeGeo=new THREE.BoxGeometry(.17,.10,.28),hairGeo=new THREE.SphereGeometry(.198,9,5,0,Math.PI*2,0,Math.PI*.62),handGeo=new THREE.SphereGeometry(.075,6,5),shadowGeo=new THREE.CircleGeometry(.35,16);
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mat=(color,options={})=>{const key=String(color)+JSON.stringify(options);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.82,...options}));return materials.get(key);};
  function mesh(group,geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
  function box(group,x,y,z,w,h,d,color){const m=mesh(group,boxGeo,mat(color),x,y,z);m.scale.set(w,h,d);return m;}
  function activate(entity){
    selected=entity;placeRing(selectRing,selected);
    if(entity?.type==='customer')onCustomer?.(entity.id);
    else if(entity?.type==='merchant'&&entity.id)onMerchant?.(entity.id);
    else if(entity?.type==='team')onTeam?.(entity.station);
    else if(entity?.type==='payments')onPayments?.();
    else if(entity?.type==='commerce')onTeam?.('campaigns');
  }
  function makeLabel(entity){
    const button=document.createElement('button');button.className='city-label '+entity.type;button.type='button';button.style.setProperty('--place-color',entity.color);
    button.dataset.place=entity.id||entity.name;button.dataset.kind=entity.type;
    const badge=document.createElement('span');badge.className='place-number';badge.textContent=entity.number;
    const body=document.createElement('span');body.className='place-body';
    const name=document.createElement('b');name.textContent=entity.name;
    const detail=document.createElement('small');detail.textContent=entity.detail;body.append(name,detail);button.append(badge,body);
    button.setAttribute('aria-label',entity.name+'. '+entity.detail);button.title=entity.name+' · '+entity.detail;
    button.onclick=()=>activate(entity);labelLayer.append(button);labels.push({entity,button});
  }
  function environment(){
    const merchants=frame?.merchants||layout.merchants.map((m,i)=>({position:i,name:['Willow Goods','Oak & Ink','Corner Supply','Sunroom Market','River General','Juniper House','The Desk Shop','Clover Trading'][i%8]}));
    city=buildDistrict(layout,merchants);world=city.root;scene.add(world);pickables.length=0;labelLayer.replaceChildren();labels.length=0;
    for(const entity of city.entities){entity.group.traverse(o=>{if(o.isMesh)pickables.push(o);});makeLabel(entity);}
    const commerce={type:'commerce',id:'commerce',name:'Customers & shops',detail:'Offers → purchases → delivery outcomes',x:0,z:0,height:1.0,number:'↔',color:'#8a7046'};makeLabel(commerce);
    van={group:city.van,target:null,state:'parked',pause:0};parent.dataset.renderState='ready';parent.dataset.mode=mode;
  }
  function updateLabels(){
    const width=parent.clientWidth,height=parent.clientHeight,occupied=[],placed=new Map();
    const projected=labels.map(label=>{
      const e=label.entity,v=new THREE.Vector3(e.x,e.height+1.8,e.z).project(camera);
      return {...label,x:(v.x+1)*width/2,y:(1-v.y)*height/2,depth:v.z};
    }).sort((a,b)=>(a.entity===selected?-1:b.entity===selected?1:0)||a.depth-b.depth);
    const leaders=[];let visible=0;
    for(const {entity,button,x,y,depth}of projected){
      const allowed=mode==='agents'?entity.type!=='merchant'||entity===selected:['merchant','payments'].includes(entity.type)||entity===selected;
      button.hidden=!allowed;button.classList.toggle('is-selected',selected===entity);
      if(!allowed)continue;
      button.classList.toggle('network-label',mode==='agents'&&entity.type!=='merchant');
      const w=button.offsetWidth,h=button.offsetHeight;
      const candidates=[[0,0],[0,-38],[-32,-18],[32,-18],[0,38],[-45,22],[45,22],[0,70],[0,-70],[-80,0],[80,0],[0,108],[0,-108]];
      let position=null;
      if(depth>-1&&depth<1&&x>0&&x<width&&y>-30&&y<height)for(const [dx,dy]of candidates){
        const left=x-w/2+dx,top=y-h-8+dy;
        if(left<8||left+w>width-48||top<10||top+h>height-12)continue;
        if(occupied.some(r=>left<r.right+7&&left+w>r.left-7&&top<r.bottom+7&&top+h>r.top-7))continue;
        position={left,right:left+w,top,bottom:top+h};break;
      }
      button.hidden=!position;
      if(position){
        const p=position;button.style.transform='translate('+Math.round(p.left)+'px,'+Math.round(p.top)+'px)';occupied.push(p);visible++;
        placed.set(entity.station||entity.id,{x:p.left+w/2,y:p.top+h/2,w,h,anchorX:x,anchorY:y});
        leaders.push('<path d="M '+(p.left+w/2).toFixed(1)+' '+(p.bottom).toFixed(1)+' L '+x.toFixed(1)+' '+y.toFixed(1)+'" class="place-leader"/>');
      }
    }
    connections.setAttribute('viewBox','0 0 '+width+' '+height);
    let arcs='';
    if(mode==='agents'){
      const paths=[['data','models','data'],['models','hq','data'],['hq','campaigns','offer'],['campaigns','commerce','offer'],['commerce','payments','payment'],['payments','data','payment']];
      for(const [from,to,kind]of paths){
        const a=placed.get(from),b=placed.get(to);if(!a||!b)continue;
        const feedback=from==='payments',across=Math.abs(a.y-b.y)<80;
        const x1=feedback?a.x-a.w/2:across?a.x+a.w/2:a.x,y1=across?a.y:a.y+a.h/2;
        const x2=feedback?b.x-b.w/2:across?b.x-b.w/2:b.x,y2=across?b.y:b.y-b.h/2;
        const cx=feedback?Math.min(x1,x2)-85:(x1+x2)/2,cy=feedback?(y1+y2)/2:across?Math.min(y1,y2)-26:(y1+y2)/2;
        arcs+='<path d="M '+x1+' '+y1+' Q '+cx+' '+cy+' '+x2+' '+y2+'" class="flow-line '+kind+'" marker-end="url(#arrow-'+kind+')"/>';
      }
    }
    connections.innerHTML='<defs>'+[['data','#8c7ab8'],['offer','#bd8e48'],['payment','#3d8da5']].map(([id,color])=>'<marker id="arrow-'+id+'" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" fill="'+color+'"/></marker>').join('')+'</defs>'+arcs+leaders.join('');
    parent.dataset.visibleLabels=String(visible);
  }
  function setMode(next){const value=next==='agents'?'agents':'city';if(value!==mode){selected=null;if(selectRing)selectRing.visible=false;}mode=value;parent.dataset.mode=mode;updateLabels();}
  function focusStation(station){
    const e=city?.entities.find(e=>e.station===station||e.id===station);if(!e||!camera)return;
    const offset=camera.position.clone().sub(controls.target);controls.target.set(e.x,0,e.z+5);camera.position.copy(controls.target).add(offset);camera.zoom=1.6;camera.updateProjectionMatrix();controls.update();selected=e;placeRing(selectRing,e);
  }
  function person(u,position,slot){
    const group=new THREE.Group(),skin=mat(skins[u.index%skins.length]),shirt=mat(shirtColors[u.index%shirtColors.length]);
    const legs=[],arms=[];
    mesh(group,bodyGeo,shirt,0,.96,0);
    mesh(group,headGeo,skin,0,1.53,0);
    const hair=mesh(group,hairGeo,mat(u.index%2?0x594c42:0x8e775a),0,1.59,0);
    hair.rotation.x=-.08;
    for(const sign of [-1,1]){
      const leg=new THREE.Group();leg.position.set(sign*.12,.62,0);mesh(leg,limbGeo,mat(0x536669),0,-.23,0);
      mesh(leg,shoeGeo,mat(0x6f6559),0,-.48,.055);group.add(leg);legs.push(leg);
      const arm=new THREE.Group();arm.position.set(sign*.28,1.14,0);mesh(arm,limbGeo,shirt,0,-.20,0);mesh(arm,handGeo,skin,0,-.43,0);group.add(arm);arms.push(arm);
    }
    const bag=box(group,.40,.62,.04,.24,.38,.22,0xd6ab60);bag.visible=['purchase','redeem'].includes(u.lastAction);
    const marker=mesh(group,shadowGeo,new THREE.MeshBasicMaterial({color:0x334c3c,transparent:true,opacity:.12,depthWrite:false}),0,.018,0);marker.rotation.x=-Math.PI/2;marker.castShadow=false;
    group.position.set(position.x,.82,position.z);world.add(group);
    const entity={type:'customer',id:u.id,name:u.name,data:u,group,width:1.1,depth:1.1};
    group.traverse(o=>{if(o.isMesh){o.userData.entity=entity;pickables.push(o);}});
    const actor={data:u,entity,group,legs,arms,bag,walker:createWalker(u.id,position,position,u.index),slot,home:{...position},targetSlot:null};
    actors.set(u.id,actor);return actor;
  }
  function clearWorld(){
    hovered=null;selected=null;tooltip.hidden=true;labelLayer.replaceChildren();labels.length=0;pickables.length=0;
    const shared=new Set([boxGeo,bodyGeo,headGeo,limbGeo,shoeGeo,hairGeo,handGeo,shadowGeo]);
    const geos=new Set(),mats=new Set(),sharedMaterials=new Set(materials.values());
    if(world){world.traverse(o=>{if(o.geometry&&!shared.has(o.geometry))geos.add(o.geometry);if(o.material&&!sharedMaterials.has(o.material))mats.add(o.material);});scene.remove(world);}
    geos.forEach(g=>g.dispose());for(const m of mats){m.map?.dispose();m.dispose();}
    actors.clear();city=null;connections.replaceChildren();
  }
  function cameraHome(){
    if(!camera||!controls)return;
    rotationTarget=null;controls.target.set(0,3,-4);camera.position.set(44,65,78);camera.zoom=1;camera.updateProjectionMatrix();controls.update();resize(true);
  }
  function resize(fit=false){
    if(!renderer)return;const width=parent.clientWidth,height=parent.clientHeight;if(width<1||height<1)return;
    renderer.setSize(width,height,false);const aspect=width/height,vertical=fit?Math.max(35,(layout.width+8)/(aspect*2.0)):camera.userData.vertical||38;
    camera.userData.vertical=vertical;camera.left=-vertical*aspect;camera.right=vertical*aspect;camera.top=vertical;camera.bottom=-vertical;camera.updateProjectionMatrix();
  }
  function ring(color){const g=new THREE.PlaneGeometry(1,1),m=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.30,side:THREE.DoubleSide,depthWrite:false});const mesh=new THREE.Mesh(g,m);mesh.rotation.x=-Math.PI/2;mesh.visible=false;scene.add(mesh);return mesh;}
  function placeRing(r,entity){
    r.visible=!!entity&&entity.type!=='commerce';if(!r.visible)return;if(entity.type==='customer'&&!entity.group.visible){r.visible=false;return;}
    const pos=entity.type==='customer'?entity.group.position:{x:entity.x,z:entity.z};
    r.position.set(pos.x,.825,pos.z);r.scale.set(entity.width+1.0,entity.depth+1.0,1);
  }
  function hover(){
    if(!pointerInside||dragging){tooltip.hidden=true;hovered=null;hoverRing.visible=false;return;}
    ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(pickables.filter(o=>o.userData.entity?.group.visible!==false),false)[0];hovered=hit?.object.userData.entity||null;
    parent.dataset.hoverType=hovered?.type||'';placeRing(hoverRing,hovered);parent.style.cursor=hovered?'pointer':'grab';tooltip.hidden=!hovered;
    if(!hovered)return;
    tooltip.querySelector('strong').textContent=hovered.name;
    let detail='Click to inspect';
    if(hovered.type==='merchant'){
      const m=frame?.merchants.find(m=>m.merchant_id===hovered.id);detail=m?m.sold+' items sold · '+m.stock+' in stock · Click to inspect':'Storefront · start a season to inspect';
    }else if(hovered.type==='customer'){
      const u=actors.get(hovered.id)?.data;detail=u?(u.lastAction==='redeem'?'Redeemed '+u.coupon?.pct+'% coupon':u.lastAction==='coupon'?'Received '+u.coupon?.pct+'% offer':u.lastAction==='purchase'?'Completed a purchase':u.lastAction==='browse'?'Browsing the market':'Neighborhood customer')+' · Click for history':'Customer';
    }else if(hovered.type==='team')detail=hovered.detail+' · click for responsibilities & evidence';
    else detail='PayPal sandbox samples · '+(frame?.receipts?.filter(r=>r.status==='COMPLETED').length||0)+' verified this season · click for receipts';
    tooltip.querySelector('span').textContent=detail;
    const x=Math.max(12,Math.min(pointerX+16,parent.clientWidth-tooltip.offsetWidth-12)),y=Math.max(12,Math.min(pointerY+18,parent.clientHeight-tooltip.offsetHeight-12));
    tooltip.style.transform='translate('+x+'px,'+y+'px)';parent.dataset.hoverType=hovered.type;
  }
  function setFrame(next){
    const changed=lastRun!==next.runId,newDay=lastTick!==next.tick;frame=next;
    if(!renderer||parent.dataset.renderState!=='ready')return;
    if(changed){clearWorld();layout=createLayout(next.merchantCount);environment();cameraHome();lastRun=next.runId;}
    // A fixed representative population prevents same-day polling or new events from popping people in/out.
    const sampleCount=Math.min(32,next.customers.length);
    const ids=new Set(Array.from({length:sampleCount},(_,i)=>next.customers[Math.floor(i*next.customers.length/sampleCount)].id));
    if(selected?.type==='customer')ids.add(selected.id);
    // Stable actors keep their positions and routes when a frame is polled again.
    for(const [id,a]of actors)if(!ids.has(id)){
      a.group.traverse(o=>{const i=pickables.indexOf(o);if(i>=0)pickables.splice(i,1);});a.group.removeFromParent();actors.delete(id);
    }
    const homeCounts=new Map(),shopCounts=new Map();
    for(const u of next.customers.filter(u=>ids.has(u.id))){
      const homeIndex=u.index%layout.columns,homeSlot=homeCounts.get(homeIndex)||0;homeCounts.set(homeIndex,homeSlot+1);
      const a=actors.get(u.id)||person(u,homePoint(layout,u.index,homeSlot),homeSlot);
      a.data=u;a.entity.data=u;a.bag.visible=['purchase','redeem'].includes(u.lastAction);
      if(changed||newDay){
        const mi=next.merchants.findIndex(m=>m.merchant_id===u.lastMerchant);
        const visiting=mi>=0&&['browse','purchase','redeem','coupon'].includes(u.lastAction);
        const slot=shopCounts.get(mi)||0;if(visiting)shopCounts.set(mi,slot+1);
        const destination=visiting?shopPoint(layout,mi,slot):a.home;
        if(reduced()){a.walker.position={...destination};a.walker.path=[];a.walker.pending=null;}
        else requestDestination(a.walker,destination,next.runId+':'+next.tick+':'+u.lastAction,visiting?'visit':'home');
      }
    }
    if(newDay&&next.activities?.some(a=>a.type==='delivery')&&van?.state==='parked'){
      const event=next.activities.find(a=>a.type==='delivery'),merchant=next.merchants.find(m=>m.merchant_id===event.merchantId);
      van.target=layout.merchants[merchant?.position||0].x;van.state='outbound';
    }
    lastTick=next.tick;parent.dataset.actorCount=String(actors.size);
  }
  try{
    scene=new THREE.Scene();scene.background=new THREE.Color(0xdfe8ed);scene.fog=new THREE.Fog(0xdfe8ed,160,255);
    renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.93;
    renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','3D market. Drag to pan, right-drag to orbit, scroll to zoom. Arrow keys pan; R rotates; Home resets.');
    parent.prepend(renderer.domElement);camera=new THREE.OrthographicCamera(-50,50,30,-30,.1,240);
    controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.10;controls.screenSpacePanning=false;controls.enableRotate=true;
    controls.minPolarAngle=.35;controls.maxPolarAngle=1.30;controls.minZoom=.65;controls.maxZoom=3.5;
    controls.mouseButtons={LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.ROTATE};
    controls.touches={ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_ROTATE};controls.zoomSpeed=.65;controls.panSpeed=.85;
    scene.add(new THREE.HemisphereLight(0xe5f1ff,0xb5a58b,2.0));
    const sun=new THREE.DirectionalLight(0xffedd0,2.6);sun.position.set(-35,65,35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
    Object.assign(sun.shadow.camera,{left:-65,right:65,top:55,bottom:-55,near:1,far:160});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;sun.shadow.radius=4;scene.add(sun);
    const floor=mesh(scene,new THREE.PlaneGeometry(600,600),mat(0xdfe8ed),0,-1.2,0);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
    hoverRing=ring(0x83bb9b);selectRing=ring(0xe2b765);environment();cameraHome();
    const observer=new ResizeObserver(()=>resize(false));observer.observe(parent);
    renderer.domElement.addEventListener('pointermove',e=>{
      const r=renderer.domElement.getBoundingClientRect();pointerX=e.clientX-r.left;pointerY=e.clientY-r.top;pointer.set(pointerX/r.width*2-1,-pointerY/r.height*2+1);pointerInside=true;
      if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5){dragging=true;parent.style.cursor='grabbing';tooltip.hidden=true;}
    });
    renderer.domElement.addEventListener('pointerleave',()=>{pointerInside=false;tooltip.hidden=true;});
    renderer.domElement.addEventListener('pointerdown',e=>{renderer.domElement.focus({preventScroll:true});rotationTarget=null;down={x:e.clientX,y:e.clientY};dragging=false;});
    renderer.domElement.addEventListener('pointerup',e=>{
      if(down&&!dragging&&e.button===0){hover();activate(hovered);}
      down=null;dragging=false;
    });
    renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
    renderer.domElement.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','+','-','=','r','R','Escape'].includes(e.key))return;e.preventDefault();
      if(e.key==='Home')cameraHome();else if(['r','R'].includes(e.key))rotate();else if(e.key==='+'||e.key==='=')zoom(1.15);else if(e.key==='-')zoom(1/1.15);else if(e.key==='Escape'){selected=null;selectRing.visible=false;tooltip.hidden=true;}
      else {const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0);right.y=0;right.normalize();const forward=new THREE.Vector3(-right.z,0,right.x);const v=(e.key==='ArrowLeft'?right.multiplyScalar(-2):e.key==='ArrowRight'?right.multiplyScalar(2):e.key==='ArrowUp'?forward.multiplyScalar(-2):forward.multiplyScalar(2));camera.position.add(v);controls.target.add(v);}
    });
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();parent.dataset.renderState='context-lost';tooltip.hidden=false;tooltip.querySelector('strong').textContent='3D view paused';tooltip.querySelector('span').textContent='Graphics context interrupted. Reload to restore the view; saved data is safe.';});
    renderer.domElement.addEventListener('webglcontextrestored',()=>{parent.dataset.renderState='ready';tooltip.hidden=true;if(frame)setFrame(frame);});
    function loop(){
      raf=requestAnimationFrame(loop);const now=performance.now(),dt=Math.min(.05,(now-lastTime)/1000||.016);lastTime=now;
      const walkers=[...actors.values()].map(a=>a.walker);
      for(const a of actors.values()){
        updateWalker(a.walker,layout,reduced()?0:dt,walkers);
        a.group.position.set(a.walker.position.x,.82,a.walker.position.z);a.group.rotation.y=a.walker.heading;
        a.group.visible=!(a.walker.goal?.label==='home'&&!a.walker.path.length&&!a.walker.pending&&distance(a.walker.position,a.home)<.2);
        const swing=a.walker.moving?Math.sin(a.walker.stride)*.48:0;
        a.legs[0].rotation.x=swing;a.legs[1].rotation.x=-swing;a.arms[0].rotation.x=-swing*.65;a.arms[1].rotation.x=swing*.65;
      }
      if(van&&van.state!=='parked'){
        if(van.pause>0){van.pause-=dt;if(van.pause<=0)van.state='returning';}
        else {const target=van.state==='outbound'?van.target:layout.edge+5,dx=target-van.group.position.x;
          const personNearby=walkers.some(a=>Math.abs(a.position.z-1.5)<1&&Math.abs(a.position.x-van.group.position.x)<2.8);
          if(!personNearby){van.group.position.x+=Math.sign(dx)*Math.min(Math.abs(dx),dt*5);van.group.rotation.y=dx<0?0:Math.PI;}
          if(Math.abs(dx)<.1){if(van.state==='outbound')van.pause=2.2;else van.state='parked';}
        }
      }
      if(rotationTarget){const offset=camera.position.clone().sub(controls.target),spherical=new THREE.Spherical().setFromVector3(offset);const d=Math.atan2(Math.sin(rotationTarget-spherical.theta),Math.cos(rotationTarget-spherical.theta));spherical.theta+=d*Math.min(1,dt*7);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));if(Math.abs(d)<.005)rotationTarget=null;}
      controls.update();
      const tx=THREE.MathUtils.clamp(controls.target.x,-layout.edge,layout.edge),tz=THREE.MathUtils.clamp(controls.target.z,-25,25);
      camera.position.x+=tx-controls.target.x;camera.position.z+=tz-controls.target.z;controls.target.set(tx,controls.target.y,tz);
      hover();placeRing(selectRing,selected);renderer.render(scene,camera);if(now-labelClock>60){labelClock=now;updateLabels();}
      if(now-statsTime>700){statsTime=now;parent.dataset.camera=JSON.stringify({x:+camera.position.x.toFixed(2),z:+camera.position.z.toFixed(2),zoom:+camera.zoom.toFixed(2)});parent.dataset.moving=String(walkers.filter(w=>w.moving).length);parent.dataset.drawCalls=String(renderer.info.render.calls);}
    }
    function dispose(){cancelAnimationFrame(raf);observer.disconnect();controls.dispose();renderer.dispose();}
    parent._dispose3D=dispose;loop();
  }catch(error){
    parent.dataset.renderState='unavailable';const warning=document.createElement('div');warning.className='graphics-warning';warning.textContent='The 3D view could not start. Models, tables and saved runs remain available. '+error.message;parent.append(warning);
  }
  function zoom(factor){if(!camera)return;camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,.65,3.5);camera.updateProjectionMatrix();}
  function rotate(){if(!camera)return;const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));rotationTarget=s.theta+Math.PI/4;}
  return {setFrame,setMode,focusStation,zoomIn(){zoom(1.15);},zoomOut(){zoom(1/1.15);},rotate,home:cameraHome,destroy(){parent._dispose3D?.();clearWorld();}};
}

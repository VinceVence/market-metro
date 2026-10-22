import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// View-only architecture. None of these decorative props create commerce events.
export function buildDistrict(layout, merchants) {
  const root=new THREE.Group(),entities=[],mats=new Map(),unit=new THREE.BoxGeometry(1,1,1);
  const C={asphalt:0x465564,curb:0x9ca8ad,pave:0xd6d0c1,cream:0xf1e7d3,navy:0x203e4e,glass:0x527d8d,light:0xa9d0d4,metal:0x3e5662,wood:0xa67954,leaf:0x3d7563};
  const material=(color,extra={})=>{const k=color+JSON.stringify(extra);if(!mats.has(k))mats.set(k,new THREE.MeshStandardMaterial({color,roughness:.85,...extra}));return mats.get(k);};
  function mesh(g,geo,mat,x=0,y=0,z=0){const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
  function box(g,x,y,z,w,h,d,c){const o=mesh(g,unit,material(c),x,y,z);o.scale.set(w,h,d);return o;}
  function cyl(g,x,y,z,r,h,c,n=12){return mesh(g,new THREE.CylinderGeometry(r,r,h,n),material(c),x,y,z);}
  function merge(g){
    const buckets=new Map();
    for(const o of [...g.children])if(o.isMesh&&!o.material.map){o.updateMatrix();const geo=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrix);if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(geo);g.remove(o);if(o.geometry!==unit)o.geometry.dispose();}
    for(const [mat,geos]of buckets){mesh(g,mergeGeometries(geos,false),mat);geos.forEach(x=>x.dispose());}
  }
  function sign(g,text,x,y,z,w,bg='#173e4a',fg='#fff4d6',h=1.0){
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;
    const c=canvas.getContext('2d');c.fillStyle=bg;c.fillRect(0,0,768,128);c.fillStyle=fg;c.font='700 65px "DM Sans", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,384,69,720);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
    const p=mesh(g,new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map}),x,y,z);p.castShadow=false;return p;
  }
  function window(g,x,y,z,w=1.5,h=1.9,trim=C.cream){
    box(g,x,y,z,w+.18,h+.2,.17,trim);box(g,x,y,z+.10,w,h,.08,C.navy);
    box(g,x-.03,y+.04,z+.15,w-.15,h-.16,.035,C.glass);box(g,x-w*.19,y+.03,z+.18,w*.12,h-.20,.025,C.light);
    box(g,x,y,z+.21,.07,h,.055,trim);box(g,x,y-.06,z+.21,w,.06,.055,trim);box(g,x,y-h/2-.05,z+.22,w+.30,.13,.35,trim);
  }
  function arch(g,x,y,z,w,h,color){
    const r=w/2,shape=new THREE.Shape();shape.moveTo(-r,0);shape.lineTo(-r,h-r);shape.absarc(0,h-r,r,Math.PI,0,true);shape.lineTo(r,0);shape.closePath();
    mesh(g,new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false,curveSegments:10}),material(color),x,y,z);
    box(g,x,y+(h-r)/2,z+.15,.08,h-r,.04,C.cream);box(g,x,y+h-r,z+.15,w,.08,.04,C.cream);
  }
  function awning(g,w,z,color){
    const a=box(g,0,2.8,z+.7,w,.16,1.4,color);a.rotation.x=.15;
    for(let x=-w/2+.28;x<w/2;x+=.7){const a=box(g,x,2.8,z+.7,.3,.18,1.4,C.cream);a.rotation.x=.15;box(g,x,2.60,z+1.36,.3,.32,.1,C.cream);}
    box(g,0,2.60,z+1.32,w,.30,.09,color);
  }
  function storefront(g,color,back=false){
    const face=new THREE.Group();if(back)face.rotation.y=Math.PI;
    box(face,0,1.6,3.57,9.2,2.8,.20,color);
    for(const x of [-3.0,2.9]){
      box(face,x,1.65,3.72,2.8,2.2,.08,C.navy);box(face,x,1.72,3.79,2.56,1.98,.05,C.glass);
      box(face,x-1.1,1.75,3.83,.16,1.95,.04,C.light);box(face,x,1.1,3.92,2.5,.09,.22,C.wood);
      for(let i=0;i<4;i++)box(face,x-.8+i*.5,1.35+(i%2)*.1,3.98,.27,.45+(i%2)*.2,.25,[0xd8ae6c,0xabc0b2,0xc07558,0xe6dcc6][i]);
      box(face,x,1.8,3.89,.09,2.1,.06,C.cream);
    }
    box(face,0,1.38,3.75,1.35,2.4,.12,C.navy);box(face,0,1.53,3.83,1.08,1.95,.05,C.light);box(face,.42,1.28,3.90,.05,.33,.06,C.cream);
    box(face,0,.18,3.84,1.6,.28,.6,0xa3a3a0);g.add(face);merge(face);
  }
  function pitchedRoof(g,y,w,d,color){
    const geo=new THREE.CylinderGeometry(0,1,1,4,1);geo.rotateY(Math.PI/4);
    const roof=mesh(g,geo,material(color),0,y,0);roof.scale.set(w*.77,2.6,d*.77);
  }
  function tree(g,x,z,size=1){
    box(g,x,.91,z,1.8,.26,1.8,0xb9b5a3);box(g,x,1.06,z,1.5,.10,1.5,0x6f7764);
    cyl(g,x,2.4,z,.13,2.8,0x81674e,7);
    const a=mesh(g,new THREE.IcosahedronGeometry(1.3,1),material(C.leaf),x,4.2,z);a.scale.set(size,size*1.4,size);
    mesh(g,new THREE.IcosahedronGeometry(1.04,1),material(0x658c68),x-.35,5.1,z+.15).scale.setScalar(size);
  }
  function register(group,meta){
    const entity={...meta,group};group.userData.entity=entity;group.traverse(o=>{if(o.isMesh)o.userData.entity=entity;});entities.push(entity);root.add(group);return entity;
  }
  const brickColors=[0xab6954,0xd4c3a5,0x87978d,0xf3e8ce,0xd79b7b,0x3b635d,0xe6ded0,0xa55e43];
  const heights=[8.5,7.2,4.2,5.4,6.4,6.7,7.6,4.5];
  const accents=[0x264f49,0x274351,0xd2a354,0x69836f,0x3c6475,0xe4c998,0x496d79,0x354d49];
  function retail(m,i){
    const kind=i%8,h=heights[kind],g=new THREE.Group(),color=brickColors[kind],accent=accents[kind];
    g.position.set(m.x,.78,m.z);g.rotation.y=m.side<0?0:Math.PI;
    box(g,0,.12,0,10.45,.25,7.4,0xb3b2a8);box(g,0,h/2+.2,0,10,h,7,color);
    // Every shop has a street entrance and a pedestrian-court entrance.
    storefront(g,accent);storefront(g,accent,true);
    if(kind===0||kind===4){
      for(let y=3.35;y<h;y+=.45)for(const side of [-1,1])box(g,0,y,side*3.53,9.9,.035,.05,kind===0?0xbf8467:0xe5b694);
      for(const side of [-1,1]){
        const face=new THREE.Group();face.rotation.y=side<0?Math.PI:0;
        for(let y=3.5;y<h-1.1;y+=2.6)for(const x of [-3.2,0,3.2]){arch(face,x,y,3.62,2.15,2.1,C.cream);arch(face,x,y+.14,3.78,1.78,1.84,C.navy);window(face,x,y+.9,3.87,1.52,1.22);}
        g.add(face);merge(face);
      }
      box(g,0,h+.28,0,10.65,.35,7.6,C.cream);box(g,0,h+.53,0,10.2,.2,7.2,accent);
      if(kind===0){box(g,0,h+.9,-2.6,5.8,.9,1.3,color);box(g,0,h+1.4,-2.6,6.3,.14,1.5,C.cream);}
      else {cyl(g,-3.5,h-.2,2,1.45,1.9,color,16);const cap=mesh(g,new THREE.ConeGeometry(1.65,2.1,16),material(accent),-3.5,h+1.8,2);}
      awning(g,8.8,3.55,accent);
    }else if(kind===1){
      for(const x of [-4.6,-1.5,1.5,4.6])box(g,x,4.9,3.65,.35,4.8,.35,C.cream);
      for(const z of [-3.6,3.6])for(const x of [-3,0,3]){const p=new THREE.Group();p.position.set(x,0,z);if(z<0)p.rotation.y=Math.PI;window(p,0,5.2,0,2.0,2.8,accent);g.add(p);merge(p);}
      box(g,0,7.25,0,10.6,.35,7.6,C.cream);box(g,0,7.8,0,7.5,.9,5.2,color);box(g,0,8.3,0,8,.18,5.7,C.cream);
      cyl(g,2.8,9.05,-1.2,.85,1.25,0x596b6d);cyl(g,2.8,9.75,-1.2,.93,.14,C.metal);
    }else if(kind===2){
      for(let x=-4.7;x<5;x+=.5)box(g,x,2.7,-3.56,.055,3.6,.1,0x687f77);
      for(let x=-3.3;x<=3.3;x+=3.3){const roof=box(g,x,h+.52,0,3.5,.2,7.6,C.cream);roof.rotation.z=.32;box(g,x+1.3,h+.3,0,.18,1.6,7.1,accent);}
      box(g,-3.7,.65,4.25,1.4,.6,1.2,C.wood);box(g,-3.7,1.3,4.25,1.1,.7,.9,0xcfa16f);
      for(const x of [-4.7,4.7])box(g,x,1.4,3.84,.2,2.6,.22,accent);
    }else if(kind===3){
      for(const side of [-1,1]){box(g,side*5.05,3.1,0,.12,4.4,6.5,C.glass);for(let z=-3;z<=3;z+=1.2)box(g,side*5.15,3.1,z,.12,4.5,.10,C.cream);}
      for(const direction of [-1,1]){const roof=box(g,direction*2.55,h+.72,0,5.7,.18,7.7,C.light);roof.rotation.z=-direction*.30;for(let z=-3.4;z<3.6;z+=.85){const rib=box(g,direction*2.55,h+.86,z,5.8,.09,.09,C.cream);rib.rotation.z=-direction*.30;}}
      box(g,0,h+1.56,0,.12,.15,7.8,accent);awning(g,9.4,3.55,accent);
    }else if(kind===5){
      for(const side of [-1,1]){const f=new THREE.Group();if(side<0)f.rotation.y=Math.PI;for(const x of [-3.3,0,3.3])window(f,x,4.7,3.56,1.6,2.1);g.add(f);merge(f);}
      const roof=mesh(g,new THREE.CylinderGeometry(3.9,5.9,2.0,4,1),material(0x3a4b53),0,h+1,0);roof.rotation.y=Math.PI/4;roof.scale.z=.72;
      for(const x of [-3,0,3]){box(g,x,h+1,2.5,1.3,1.5,.8,C.cream);window(g,x,h+1.05,2.94,.85,1.0,accent);}
      box(g,0,3.25,0,10.35,.26,7.4,C.cream);
    }else if(kind===6){
      box(g,0,5,0,10.25,3.9,7.2,C.glass);for(let x=-4.9;x<5;x+=1.2){box(g,x,5,3.66,.12,3.9,.10,C.cream);box(g,x,5,-3.66,.12,3.9,.1,C.cream);}
      for(const y of [3.2,5.1,7.1])box(g,0,y,0,10.6,.20,7.7,C.cream);
      box(g,-1.6,8.1,-.8,6.8,1.9,5.4,C.cream);box(g,-1.6,8.2,1.95,5.8,1.2,.1,C.glass);
      for(const x of [2.4,4.2]){box(g,x,7.55,1.7,1.2,.7,1.2,C.wood);mesh(g,new THREE.IcosahedronGeometry(.7,1),material(C.leaf),x,8.15,1.7);}
    }else{
      const roof=mesh(g,new THREE.CylinderGeometry(3.7,3.7,10.7,20,1,false,0,Math.PI),material(0x52666a),0,h,0);roof.rotation.z=Math.PI/2;roof.rotation.y=Math.PI/2;
      for(let x=-4.5;x<=4.5;x+=1)box(g,x,2.65,-3.57,.065,3.9,.10,0xc18b66);
      box(g,0,3.1,3.7,10.7,.35,1.1,accent);box(g,0,.35,-4.1,7,.6,1,C.wood);
      for(const x of [-3,3])box(g,x,1.05,-4.1,1.3,.8,.85,0xc89b65);
    }
    for(const sx of [-1,1])for(const z of [-1.6,1.4]){box(g,sx*5.06,Math.min(4.8,h-1),z,.12,1.5,1.55,C.navy);box(g,sx*5.14,Math.min(4.8,h-1),z,.05,1.25,1.30,C.light);}
    // Roof equipment, planted entrances and a standing offer board give useful scale cues.
    if(![2,3,5,7].includes(kind)){box(g,-2,h+.65,-1.6,1.6,.7,1.2,C.metal);for(let z=-2;z<-1;z+=.16)box(g,-2,h+1.03,z,1.3,.035,.04,0xa9b9b4);}
    for(const x of [-4.6,4.6]){box(g,x,.55,4.1,.65,.8,.65,0x836a54);mesh(g,new THREE.IcosahedronGeometry(.51,1),material(C.leaf),x,1.3,4.1);}
    const board=box(g,2.1,.88,4.6,.80,1.25,.16,C.navy);board.rotation.x=-.12;box(g,2.1,1.02,4.71,.51,.43,.03,0xe3b96b);
    merge(g);
    const name=m.name||'Market store';const hex='#'+accent.toString(16).padStart(6,'0');
    sign(g,name.toUpperCase(),0,3.2,3.91,8.7,hex,'#fff4d6',.88);
    const rear=sign(g,name.toUpperCase(),0,3.2,-3.91,8.7,hex,'#fff4d6',.88);rear.rotation.y=Math.PI;
    register(g,{type:'merchant',id:m.merchant_id,name,x:m.x,z:m.z,width:10.6,depth:8,height:h+(kind===5?2:1.6),number:String(i+1).padStart(2,'0'),color:hex,detail:'Fictional merchant · inspect stock & sales'});
  }
  const ground=new THREE.Group(),edge=layout.edge,outerX=edge+7;
  box(ground,0,-.1,0,layout.width+10,1.5,96,0x889995);box(ground,0,.68,0,layout.width+9,.14,95,C.pave);
  box(ground,0,.77,0,layout.width+8,.12,6.5,C.asphalt);
  for(const x of [-outerX,outerX])box(ground,x,.77,0,6,.12,92,C.asphalt);
  for(const z of [-38,38])box(ground,0,.77,z,layout.width+8,.12,6,C.asphalt);
  for(const z of [-5.4,5.4,-22,22]){
    box(ground,0,.80,z,edge*2+2,.22,z===22||z===-22?2.8:4.2,C.pave);
    for(let x=-edge;x<=edge;x+=2)box(ground,x,.925,z,.035,.012,z===22||z===-22?2.8:4.2,0xb5b6af);
  }
  for(const z of [-3.4,3.4]){box(ground,0,.87,z,edge*2+3,.30,.25,C.curb);box(ground,0,.83,z+(z<0?.25:-.25),edge*2+2,.03,.12,0xd5b878);}
  for(const x of layout.gaps){box(ground,x,.80,0,2.4,.2,45.5,C.pave);box(ground,x,.79,0,2.5,.02,6.5,C.asphalt);for(let z=-2.6;z<3;z+=.75)box(ground,x,.82,z,2.1,.02,.38,0xebe3cf);}
  for(let x=-edge-8;x<edge+8;x+=4.4)if(layout.gaps.every(g=>Math.abs(x-g)>1.6))box(ground,x,.83,0,2,.02,.11,0xdcc58c);
  for(const z of [-38,38])for(let x=-edge;x<edge;x+=4.5)box(ground,x,.84,z,2,.015,.12,0xceb776);
  for(const x of [-outerX,outerX])for(let z=-34;z<35;z+=4.5)box(ground,x,.84,z,.12,.015,2,0xceb776);
  for(const m of layout.merchants){box(ground,m.x,.80,m.z,11.2,.18,8.4,0xbdbdb3);box(ground,m.x,.80,m.side*7.8,10.6,.18,4.3,C.pave);}
  // Side courts have planting, street furniture and a bike stand, away from customer paths.
  for(const x of layout.gaps)for(const z of [-18.7,18.7]){
    tree(ground,x+2.4,z,.78);box(ground,x-2.2,1.12,z,2.4,.16,.65,C.wood);box(ground,x-2.2,1.55,z+.25,2.4,.65,.12,C.wood);
    for(const dx of [-.85,.85])box(ground,x-2.2+dx,.95,z,.12,.55,.6,C.metal);
    cyl(ground,x-3.6,1.24,z,.27,.85,C.metal,10);
  }
  for(const x of layout.gaps)for(const z of [-4.1,4.1]){
    const px=x-1.6;cyl(ground,px,3.6,z,.075,5.5,C.metal,8);box(ground,px+.35,6.30,z,.85,.12,.12,C.metal);box(ground,px+.70,6.20,z,.55,.16,.42,C.cream);
  }
  for(const x of [-edge+.8,edge-.8])for(const z of [-3.8,3.8]){
    cyl(ground,x,2.6,z,.08,3.6,C.metal,8);box(ground,x,4.1,z,.36,1.1,.35,C.navy);
    cyl(ground,x,1.06,z+.8,.11,.5,0xd7b764,8);
    const light=mesh(ground,new THREE.SphereGeometry(.10,6,6),material(z>0?0xe8aa64:0x87c6a5),x,4.3,z+.19);light.castShadow=false;
  }
  // Parking lanes and loading courts read as a working district rather than a toy island.
  for(const x of layout.centers)for(const z of [-33.5,33.5]){
    for(let dx=-4;dx<=4;dx+=2.7)box(ground,x+dx,.84,z,.065,.015,2.8,0xaaa999);
    box(ground,x,.84,z-1.4,8.1,.015,.065,0xaaa999);
  }
  for(const x of [-edge-2,edge+2])for(const z of [-29,-13,13,29])tree(ground,x,z,.92);
  merge(ground);root.add(ground);
  for(const m of merchants)retail({...layout.merchants[m.position],...m},m.position);

  const stations=[
    {station:'data',name:'Data Exchange',roles:'Data engineer',x:layout.centers[0],height:5.2,color:0x3d7882,number:'D'},
    {station:'models',name:'Model Lab',roles:'Data scientist + experiment analyst',x:layout.centers[Math.floor(layout.columns/2)-1],height:11,color:0x665a91,number:'M'},
    {station:'hq',name:'Operations HQ',roles:'Business lead + coordinator',x:layout.centers[Math.floor(layout.columns/2)],height:14,color:0x254e66,number:'H'},
    {station:'campaigns',name:'Campaign Studio',roles:'Campaign manager',x:layout.centers.at(-1),height:6.4,color:0xb97c3b,number:'C'}
  ];
  for(const s of stations){
    const g=new THREE.Group();g.position.set(s.x,.8,-28.8);const h=s.height;
    box(g,0,.1,0,10.4,.25,7,C.curb);
    if(s.station==='data'){
      box(g,0,h/2,0,10,h,6.5,0x8da4a3);for(let x=-4.7;x<5;x+=.6)box(g,x,h/2,3.3,.08,h,.10,C.cream);
      for(const x of [-2.6,2.6]){box(g,x,1.8,3.44,3.4,3.4,.15,C.navy);for(let y=.3;y<3.5;y+=.3)box(g,x,y,3.55,3.1,.09,.05,0x74919a);}
      for(const x of [-3.3,0,3.3]){const roof=box(g,x,h+.45,0,3.5,.2,7,C.cream);roof.rotation.z=.28;}
      for(let i=0;i<3;i++)box(g,4-i*.9,.5+(i%2)*.5,4,.8,.8,.7,C.wood);
    }else if(s.station==='models'){
      box(g,0,h/2,0,8.6,h,6.2,C.glass);
      for(let y=1;y<h;y+=2.2)box(g,0,y,0,9,.20,6.7,C.cream);
      for(const x of [-4.2,-2.1,0,2.1,4.2]){box(g,x,h/2,3.2,.14,h,.14,C.light);box(g,x,h/2,-3.2,.14,h,.14,C.light);}
      box(g,0,h+.2,0,9.6,.5,7.1,s.color);box(g,-3,h+.8,-1.8,2,.8,2,C.metal);
      const dish=mesh(g,new THREE.SphereGeometry(.9,12,8,0,Math.PI*2,0,Math.PI/2),material(C.cream),2.7,h+1.2,0);dish.rotation.z=.6;
    }else if(s.station==='hq'){
      box(g,0,3.4,0,10,6.8,6.5,C.cream);box(g,.8,10,-.4,6.6,6.5,5.7,C.cream);
      for(const face of [-1,1]){for(let y=1.7;y<6.6;y+=2)for(const x of [-3.8,-1.3,1.3,3.8])box(g,x,y,face*3.30,1.5,1.3,.10,C.glass);for(let y=7.9;y<13.3;y+=1.9)for(const x of [-1.4,.8,3])box(g,x,y,face*2.5-.4,1.2,1.2,.12,C.glass);}
      box(g,.8,13.8,-.4,7.1,.5,6.2,s.color);box(g,.8,14.45,-.4,4.3,.8,4.2,s.color);cyl(g,.8,15.8,-.4,.06,2,C.metal,6);
      box(g,0,2.3,3.55,3.5,3.8,.2,s.color);box(g,0,3.9,4.1,5,.16,1.5,s.color);
    }else{
      box(g,0,h/2,0,10,h,6.5,0xd5b27b);for(const x of [-3.2,0,3.2])window(g,x,3.7,3.33,2.3,3.5,s.color);
      box(g,0,h+.2,0,10.4,.35,6.9,C.cream);box(g,0,h+1.8,0,7,2.8,.35,C.navy);
      sign(g,'MAKE IT COUNT',0,h+1.8,.21,6.4,'#203e4e','#eed6a6',1.8);
    }
    merge(g);sign(g,s.name.toUpperCase(),0,1.2,3.67,7.7,'#'+s.color.toString(16),'#fff4dc',.9);
    register(g,{type:'team',id:s.station,station:s.station,name:s.name,detail:s.roles,x:s.x,z:-28.8,width:10.5,depth:7.2,height:h+2,number:s.number,color:'#'+s.color.toString(16)});
  }
  // PayPal is a ledger/payment connection, visually separate from the team that sets campaigns.
  const pay=new THREE.Group();pay.position.set(0,.8,28);
  box(pay,0,1.7,0,9,3.4,6,0xe8eff0);box(pay,0,2,3.1,7.8,2.6,.15,C.glass);
  for(const x of [-3.8,0,3.8])box(pay,x,1.8,3.25,.18,3.4,.18,0xf1f5f2);
  box(pay,0,3.6,0,10,.4,7,0x1466a1);box(pay,0,4.4,-.5,7.4,1.3,2.8,0x123874);
  for(const x of [-4,4])box(pay,x,1.7,-3.2,.16,3.4,.25,0x1466a1);
  merge(pay);sign(pay,'PayPal',0,4.5,1,5,'#123874','#ffffff',1.05);const ps=sign(pay,'PayPal',0,4.5,-2,5,'#123874','#ffffff',1.05);ps.rotation.y=Math.PI;
  register(pay,{type:'payments',id:'payments',name:'PayPal ledger',detail:'Selected native sandbox captures · linked warehouse receipts',x:0,z:28,width:10,depth:7,height:5.6,number:'P',color:'#1466a1'});

  // A quieter outer neighborhood creates a city horizon without competing with the playable shops.
  const context=new THREE.Group();
  for(let i=0;i<layout.centers.length;i++){
    const x=layout.centers[i],g=new THREE.Group();g.position.set(x,.8,28);
    box(g,0,2.8,0,5.4,5.6,4.5,[0xd2ba9e,0xb6c4bd,0xc9957c][i%3]);
    pitchedRoof(g,6.3,5.6,4.5,0x596871);
    for(const z of [-2.3,2.3])for(const dx of [-1.4,1.4]){const f=new THREE.Group();f.position.set(dx,0,z);if(z<0)f.rotation.y=Math.PI;window(f,0,3.8,0,1.0,1.5);g.add(f);merge(f);}
    box(g,0,1.2,-2.34,.9,2.2,.1,C.navy);merge(g);context.add(g);
  }
  for(let i=0;i<layout.columns+3;i++){
    const x=(i-(layout.columns+2)/2)*12,h=9+(i*7%13),g=new THREE.Group();g.position.set(x,.5,-47);
    const col=[0x9baeb2,0xc1c5bc,0xa5b2b4,0xc4b5a3][i%4];box(g,0,h/2,0,9,h,7,col);box(g,0,h+.15,0,9.5,.3,7.4,0x899a9e);
    for(let y=2;y<h-1;y+=2.2)for(const dx of [-3,-1,1,3])box(g,dx,y,3.55,1.1,1.15,.10,0x657f8c);
    if(i%2)box(g,1,h+1,0,4,2,4,col);merge(g);context.add(g);
  }
  root.add(context);
  function vehicle(color,truck=false){
    const g=new THREE.Group();box(g,0,.72,0,truck?3.1:2.9,truck?1.6:.72,1.45,color);box(g,truck?-1.9:-.1,1.17,0,truck?1.2:1.6,.7,1.30,color);
    box(g,truck?-2:0,1.24,.68,truck?.9:1.35,.47,.06,C.glass);box(g,truck?-2:0,1.24,-.68,truck?.9:1.35,.47,.06,C.glass);
    for(const x of [-1.08,1.08])for(const z of [-.75,.75]){const wheel=cyl(g,x,.4,z,.32,.18,0x263743,10);wheel.rotation.x=Math.PI/2;}
    box(g,-1.5,.68,.5,.05,.17,.22,0xf8e9b9);box(g,-1.5,.68,-.5,.05,.17,.22,0xf8e9b9);merge(g);return g;
  }
  for(let i=0;i<layout.centers.length;i++)for(const side of [-1,1]){const car=vehicle([0xead3a2,0x8caca6,0xb27d63,0x738f9d][i%4]);car.position.set(layout.centers[i]+(side<0?2.7:-2.7),.84,side*33.2);car.rotation.y=Math.PI/2;root.add(car);}
  const van=vehicle(0xe8c781,true);van.position.set(edge+5,.84,1.5);root.add(van);
  unit.dispose();
  return {root,entities,van,stations};
}

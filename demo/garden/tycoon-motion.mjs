export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function createLayout(count=8){
  const columns=Math.ceil(count/2),edge=columns*8;
  const centers=Array.from({length:columns},(_,i)=>(i-(columns-1)/2)*16);
  const gaps=Array.from({length:columns+1},(_,i)=>-edge+i*16);
  const xs=[...centers,...gaps].sort((a,b)=>a-b),zs=[-22,-5.4,5.4,22];
  const nodes=[],links=[];
  for(const z of zs)for(const x of xs)nodes.push({x,z});
  const at=(x,z)=>nodes.findIndex(n=>n.x===x&&n.z===z);
  for(const z of zs)for(let i=1;i<xs.length;i++)links.push([at(xs[i-1],z),at(xs[i],z)]);
  for(const x of gaps)for(let i=1;i<zs.length;i++)links.push([at(x,zs[i-1]),at(x,zs[i])]);
  const merchants=Array.from({length:count},(_,i)=>({x:centers[i%columns],z:i<columns?-13:13,side:i<columns?-1:1,width:10,depth:7,index:i}));
  const footprints=merchants.map(m=>({x:m.x,z:m.z,w:m.width,d:m.depth}));
  footprints.push({x:0,z:-28,w:9,d:6},{x:0,z:28,w:9,d:6});
  for(const x of centers)footprints.push({x,z:28,w:5.4,d:4.5});
  return {columns,edge,centers,gaps,xs,zs,nodes,links,merchants,footprints,width:edge*2+18,depth:76};
}
export function isWalkable(layout,p,radius=.24){
  return layout.footprints.every(b=>Math.abs(p.x-b.x)>=b.w/2+radius||Math.abs(p.z-b.z)>=b.d/2+radius);
}
function nearest(layout,p){
  let index=0,best=Infinity;layout.nodes.forEach((n,i)=>{const d=distance(n,p);if(d<best){best=d;index=i;}});return index;
}
export function route(layout,start,destination){
  if(distance(start,destination)<.15)return [];
  const first=nearest(layout,start),last=nearest(layout,destination);
  const dist=layout.nodes.map(()=>Infinity),previous=layout.nodes.map(()=>-1),open=new Set(layout.nodes.map((_,i)=>i));
  dist[first]=0;
  while(open.size){
    let current=-1;for(const n of open)if(current<0||dist[n]<dist[current])current=n;
    if(current===last)break;open.delete(current);
    for(const [a,b]of layout.links){
      const neighbor=a===current?b:b===current?a:-1;if(neighbor<0||!open.has(neighbor))continue;
      const d=dist[current]+distance(layout.nodes[current],layout.nodes[neighbor]);if(d<dist[neighbor]){dist[neighbor]=d;previous[neighbor]=current;}
    }
  }
  const indices=[last];while(indices[0]!==first&&previous[indices[0]]>=0)indices.unshift(previous[indices[0]]);
  const points=[{...start},...indices.map(i=>({...layout.nodes[i]})),{...destination}].filter((p,i,a)=>!i||distance(p,a[i-1])>.08);
  // Keep right on shared paths. Corner offsets remain in the wide sidewalk junctions.
  return points.map((p,i)=>{
    if(i===0||i===points.length-1)return p;
    const before=points[i-1],after=points[i+1],dx=after.x-before.x,dz=after.z-before.z,l=Math.hypot(dx,dz)||1;
    const shifted={x:p.x+dz/l*.29,z:p.z-dx/l*.29};
    return isWalkable(layout,shifted)?shifted:p;
  }).slice(1);
}
export function homePoint(layout,index,slot=0){
  return {x:layout.centers[index%layout.columns]+((slot%8)-3.5)*.72,z:22.6+Math.floor(slot/8)*.72};
}
export function shopPoint(layout,index,slot=0){
  const m=layout.merchants[index];return {x:m.x+((slot%8)-3.5)*.72,z:m.side*(6.25+Math.floor(slot/8)*.72)};
}
export function createWalker(id,position,home,index=0){
  return {id,index,position:{...position},home:{...home},path:[],pending:null,goal:null,lastKey:null,heading:0,stride:0,dwell:0,speed:3.4+(index%5)*.17,moving:false};
}
export function requestDestination(w,destination,key,label='visit'){
  if(w.lastKey===key)return false;w.lastKey=key;w.pending={destination:{...destination},label};return true;
}
export function updateWalker(w,layout,seconds,neighbors=[]){
  const dt=Math.min(.05,Math.max(0,seconds));
  const begin=()=>{w.goal=w.pending;w.pending=null;w.path=route(layout,w.position,w.goal.destination);w.dwell=0;};
  if(w.pending&&(!w.path.length||distance(w.position,w.path[0])<.55))begin();
  if(!w.path.length){
    w.moving=false;
    if(w.dwell>0)w.dwell=Math.max(0,w.dwell-dt);
    return;
  }
  const target=w.path[0],d=distance(w.position,target);
  if(d<(w.path.length>1?.55:.12)){w.path.shift();if(!w.path.length){w.dwell=w.goal?.label==='home'?0:2+(w.index%4)*.3;w.moving=false;}return;}
  const dx=(target.x-w.position.x)/d,dz=(target.z-w.position.z)/d;
  let step=Math.min(w.speed*dt,d),sideX=0,sideZ=0;
  for(const other of neighbors){
    if(other===w)continue;const gap=distance(w.position,other.position);if(gap<.75&&gap>.01){
      const approaching=(other.position.x-w.position.x)*dx+(other.position.z-w.position.z)*dz>0;
      if(approaching){step*=Math.max(.12,gap/.75);sideX+=(w.position.x-other.position.x)/gap*.24*dt;sideZ+=(w.position.z-other.position.z)/gap*.24*dt;}
    }
  }
  let next={x:w.position.x+dx*step+sideX,z:w.position.z+dz*step+sideZ};
  if(!isWalkable(layout,next))next={x:w.position.x+dx*step,z:w.position.z+dz*step};
  const clear=p=>isWalkable(layout,p)&&neighbors.every(other=>other===w||distance(p,other.position)>=.52);
  if(!clear(next)){
    const sidestep=w.speed*dt*.75;
    const right={x:w.position.x+dz*sidestep,z:w.position.z-dx*sidestep};
    const left={x:w.position.x-dz*sidestep,z:w.position.z+dx*sidestep};
    if(clear(right))next=right;
    else if(clear(left))next=left;
    else {w.moving=false;return;}
  }
  if(isWalkable(layout,next)){w.stride+=distance(w.position,next)*5;w.position=next;w.moving=step>.005;}
  const heading=Math.atan2(dx,dz),difference=Math.atan2(Math.sin(heading-w.heading),Math.cos(heading-w.heading));
  w.heading+=difference*Math.min(1,dt*9);
}

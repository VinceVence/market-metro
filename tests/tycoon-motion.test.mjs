import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayout,createWalker,requestDestination,updateWalker,route,homePoint,shopPoint,isWalkable,distance} from '../demo/garden/tycoon-motion.mjs';

test('3D pedestrian paths and forecourt slots avoid all building footprints at both supported sizes',()=>{
  for(const count of [8,12]){
    const layout=createLayout(count);
    for(let i=0;i<32;i++){
      const from=homePoint(layout,i,Math.floor(i/layout.columns)),to=shopPoint(layout,i%count,Math.floor(i/count));
      assert(isWalkable(layout,from));assert(isWalkable(layout,to));
      const points=[from,...route(layout,from,to)];
      for(let k=1;k<points.length;k++)for(let s=0;s<=30;s++){
        const p={x:points[k-1].x+(points[k].x-points[k-1].x)*s/30,z:points[k-1].z+(points[k].z-points[k-1].z)*s/30};
        assert(isWalkable(layout,p),'Route clips a building: '+JSON.stringify(p));
      }
    }
    const slots=Array.from({length:24},(_,i)=>shopPoint(layout,0,i));
    for(let i=0;i<slots.length;i++)for(let j=0;j<i;j++)assert(distance(slots[i],slots[j])>=.7);
  }
});

test('same-day refreshes preserve a walk and a new destination never teleports the customer',()=>{
  const layout=createLayout(),home=homePoint(layout,0,0),w=createWalker('C',home,home,0),destination=shopPoint(layout,3,0);
  requestDestination(w,destination,'day-1');for(let i=0;i<100;i++)updateWalker(w,layout,1/60,[w]);
  const before={...w.position},path=JSON.stringify(w.path);
  assert.equal(requestDestination(w,destination,'day-1'),false);assert.deepEqual(w.position,before);assert.equal(JSON.stringify(w.path),path);
  requestDestination(w,shopPoint(layout,5,1),'day-2');
  for(let i=0;i<3000;i++){const old={...w.position};updateWalker(w,layout,1/60,[w]);assert(distance(old,w.position)<=w.speed/60+.001);assert(isWalkable(layout,w.position));}
  assert(distance(w.position,shopPoint(layout,5,1))<.2,'Customer completes the recorded visit');
  requestDestination(w,w.home,'day-3','home');for(let i=0;i<3000;i++)updateWalker(w,layout,1/60,[w]);
  assert(distance(w.position,w.home)<.2,'Customer returns when the next observed state is home');
});

test('a crowded two-way replay preserves body spacing and eventually clears its routes',()=>{
  const layout=createLayout(),walkers=Array.from({length:32},(_,i)=>{
    const p=homePoint(layout,i,Math.floor(i/4)),w=createWalker('C'+i,p,p,i);
    requestDestination(w,shopPoint(layout,i%8,Math.floor(i/8)),'trip');return w;
  });
  for(let t=0;t<3600;t++){
    for(const w of walkers){updateWalker(w,layout,1/30,walkers);assert(isWalkable(layout,w.position));}
    for(let i=0;i<walkers.length;i++)for(let j=0;j<i;j++)assert(distance(walkers[i].position,walkers[j].position)>=.519);
  }
  assert(walkers.every(w=>!w.path.length));
  for(const w of walkers)requestDestination(w,w.home,'return','home');
  for(let t=0;t<3600;t++)for(const w of walkers)updateWalker(w,layout,1/30,walkers);
  assert(walkers.every(w=>!w.path.length&&distance(w.position,w.home)<.2));
});

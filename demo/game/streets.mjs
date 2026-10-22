import { NODES, EDGES } from './yard-art.mjs';

// Loading-lane routes stay outside work areas and storage racks.
export function streetRoute(from, to) {
  const nearest = p => NODES.reduce((best, n, i) => Math.hypot(n.x-p.x,n.y-p.y) < Math.hypot(NODES[best].x-p.x,NODES[best].y-p.y) ? i : best, 0);
  const start=nearest(from), end=nearest(to), dist=NODES.map(()=>Infinity), prev=NODES.map(()=>null), open=new Set(NODES.map((_,i)=>i));
  dist[start]=0;
  while(open.size){
    const node=[...open].reduce((a,b)=>dist[a]<dist[b]?a:b); open.delete(node); if(node===end)break;
    for(const [a,b] of EDGES){const next=a===node?b:b===node?a:null;if(next===null||!open.has(next))continue;
      const score=dist[node]+Math.hypot(NODES[node].x-NODES[next].x,NODES[node].y-NODES[next].y);
      if(score<dist[next]){dist[next]=score;prev[next]=node;}
    }
  }
  const path=[];for(let i=end;i!==null;i=prev[i])path.unshift({...NODES[i]});
  if(Math.hypot(path.at(-1).x-to.x,path.at(-1).y-to.y)>1)path.push({...to});
  return path.filter((p,i)=>i||Math.hypot(p.x-from.x,p.y-from.y)>2);
}

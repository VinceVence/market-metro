import {createGarden} from '../garden/world.mjs';
import {merchantWindow} from './merchant-window.mjs';
// A presentation-only camera over the same renderer and saved frames as the app.
// Merchant isolation changes only the render window, never the economic records.
const data=await fetch('/data/judge-reactivation.json').then(r=>r.json());
const garden=createGarden(document.getElementById('world'),{autoFit:true});
garden.setNamesVisible(false);
function shot(kind){
 const day=kind==='return'?35:1,source=data.frames[day];
 let frame=source;
 if(kind!=='world'){
  const index=source.merchants.findIndex(m=>m.merchant_id===data.shopper.merchantId);
  frame=merchantWindow(source,index,1).frame;
  frame={...frame,runId:frame.runId+'-'+kind,customers:kind==='return'?source.customers.filter(c=>c.id===data.shopper.id):[],featuredIds:kind==='return'?[data.shopper.id]:[]};
 }
 garden.setFrame(frame);garden.setPaused(false);
 if(kind==='world')garden.home();else{garden.focusStation(data.shopper.merchantId);garden.zoomIn();garden.zoomIn();}
 document.body.dataset.shot=kind;
 document.getElementById('status').textContent=(kind==='world'?'Saved market':data.shopper.merchant)+' · day '+day+' · presentation camera only';
}
document.getElementById('world-shot').onclick=()=>shot('world');
document.getElementById('shop-shot').onclick=()=>shot('shop');
document.getElementById('return-shot').onclick=()=>shot('return');
document.getElementById('orbit').onclick=()=>garden.rotate();
document.getElementById('hide').onclick=()=>document.body.classList.add('recording');
document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='h')document.body.classList.toggle('recording');});
shot('world');

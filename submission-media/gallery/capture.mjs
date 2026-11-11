// Local media-only viewport. Same app, same saved data, enlarged in the browser.
// No provider credentials are loaded; payment, simulation and model writes are denied.
import {createSupplyYardServer} from '../../scripts/serve.mjs';
import {createPayPalSandbox} from '../../scripts/paypal-sandbox.mjs';
import {createInvestigationService} from '../../scripts/studio/investigation.mjs';
import {createStudioProvider} from '../../scripts/studio/investigation-provider.mjs';

const pages={
 market:'/judge.html',
 environment:'/video-capture.html',
 landing:'/landing.html',
 agents:'/agent-studio.html',
 models:'/analytics.html?run=judge-demo&view=models',
 impact:'/analytics.html?run=judge-demo&view=profits',
 ontology:'/analytics.html?run=judge-demo&view=ontology',
 paypal:'/analytics.html?run=judge-demo&view=payments'
};
const paypal=await createPayPalSandbox({clientId:'',clientSecret:'',storePath:null});
process.env.STUDIO_AGENT_ENABLED='false';
const investigation=createInvestigationService({provider:createStudioProvider({enabled:false})});
const server=createSupplyYardServer(paypal,{status(){return {};}});
const handler=server.listeners('request')[0];
server.removeListener('request',handler);
server.on('request',async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:4174');
 if(req.headers.host!=='127.0.0.1:4174'){res.writeHead(403);res.end();return;}
 if(!['GET','HEAD'].includes(req.method)&&url.pathname!=='/api/market/studio-investigation/verify'){
  res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'CAPTURE_READ_ONLY',message:'Capture mode permits saved evidence only.'}}));return;
 }
 if(req.method==='POST'&&url.pathname==='/api/market/studio-investigation/verify'){
  try{
   let body='';for await(const part of req){body+=part;if(body.length>4096)throw Error('Request too large');}
   const result=await investigation.verify(JSON.parse(body));
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
  }catch{res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'Saved evidence verification failed.'}}));}
  return;
 }
 if(url.pathname==='/__capture'){
  const view=url.searchParams.get('view')||'market',page=pages[view];
  if(!page){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Market Metro media: ${view}</title><style>html,body{margin:0;width:3000px;height:2000px;overflow:hidden;background:white}iframe{display:block;width:1200px;height:800px;border:0;transform:scale(2.5);transform-origin:top left}</style><iframe title="Actual Market Metro application" src="${page}"></iframe></html>`);return;
 }
 handler(req,res);
});
server.listen(4174,'127.0.0.1',()=>console.log('Media viewport: http://127.0.0.1:4174/__capture?view=market'));

import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupplyYardServer} from '../scripts/serve.mjs';
import {createPayPalSandbox} from '../scripts/paypal-sandbox.mjs';
import {publicStartAllowed} from '../scripts/public-demo.mjs';
import {api} from '../demo/garden/ui.mjs';

test('upstream busy responses are readable and mutations are never automatically retried',async t=>{
 let attempts=0;
 t.mock.method(globalThis,'fetch',async()=>{attempts++;return new Response('Rate exceeded.',{status:429});});
 await assert.rejects(()=>api('/api/paypal/orders',{amount:100}),/shared demo is busy/);
 assert.equal(attempts,1);
});

test('public demo serves evidence with security headers and rejects provider, export and secret paths',async()=>{
 const paypal=await createPayPalSandbox({clientId:'',clientSecret:'',storePath:null});
 const server=createSupplyYardServer(paypal,{status(){return{};}},null,null,null,{publicDemo:true});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const path of ['/healthz','/','/landing.html','/analytics.html','/data/judge-reactivation.json','/vendor/ag-studio-3.0.0.js']){
   const response=await fetch(base+path,{headers:{host:'judge.example'}});
   assert.equal(response.status,200,path);assert.equal(response.headers.get('x-frame-options'),'DENY');
   assert.ok(response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));await response.arrayBuffer();
  }
  const landingImage=await fetch(base+'/landing/assets/market.jpg');
  assert.equal(landingImage.status,200);assert.equal(landingImage.headers.get('content-type'),'image/jpeg');await landingImage.arrayBuffer();
  const runtime=await(await fetch(base+'/api/runtime')).json();assert.equal(runtime.payments,false);assert.equal(runtime.freshPlanning,false);
  for(const path of ['/api/paypal/orders','/api/paypal/funding/start','/api/market/planner/start','/api/market/catalog/sync','/api/market/compare']){
   const response=await fetch(base+path,{method:'POST',headers:{origin:base,'content-type':'application/json','x-supply-yard':'sandbox'},body:'{}'});
   assert.equal(response.status,403,path);
  }
  for(const path of ['/.env','/.git/config','/.local/gcp/config.json','/api/market/export'])assert.ok([403,404].includes((await fetch(base+path)).status),path);
  assert.equal((await fetch(base+'/api/market/autonomy/start',{method:'POST',headers:{origin:'https://attacker.invalid','content-type':'application/json','x-supply-yard':'sandbox'},body:'{}'})).status,403);
 }finally{await new Promise(r=>server.close(r));}
});

test('public start contract excludes fresh models, Sandbox samples and larger markets',()=>{
 const safe={execution:'saved',sandbox:false,marketProfile:'expanded-12x600',harnessVersion:'v2',plannerMode:'single',modelCheck:true};
 assert.ok(publicStartAllowed(safe));
 for(const change of [{execution:'fresh'},{sandbox:true},{marketProfile:'metropolis-384'},{plannerMode:'team'},{}]){
  if(Object.keys(change).length)assert.equal(publicStartAllowed({...safe,...change}),false);
 }
 assert.equal(publicStartAllowed({}),false);
});

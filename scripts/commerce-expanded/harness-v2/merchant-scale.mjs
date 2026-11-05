import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {assertBinding,read,scoreCampaign} from './tools.mjs';
import {canonicalHash} from './contracts.mjs';

export const scaleFolder='docs/merchant-scale';
export const scaleProtocol=await read(scaleFolder+'/protocol.json');

export function enrolledStores(merchants, feeds, district) {
  assert.ok(scaleProtocol.feeds.includes(feeds));
  const groups=Map.groupBy(merchants,m=>m.category);
  assert.equal(groups.size,4);
  const ids=[];
  for(const [category,group] of [...groups.values()].entries()){
    assert.equal(group.length,3);
    for(let i=0;i<feeds/4;i++)ids.push(group[(district+category+i)%3].id);
  }
  return new Set(ids);
}

// All historical product identities stay available for category features.
// Only stock and incoming quantities from nonparticipating feeds are hidden.
export function withFeeds(view, enrolled) {
  if(enrolled.size===view.merchants.length)return view;
  const visible=new Set(view.products.filter(p=>enrolled.has(p.merchantId)).map(p=>p.id));
  return {...view,products:view.products.map(p=>visible.has(p.id)?p:{...p,stock:0,reserved:0,available:0,initialStock:0}),
    inbound:view.inbound.filter(i=>visible.has(i.productId))};
}

let inputs;
export function loadScaleInputs(){
  return inputs??=(async()=>{
    const [{hash,...data},judge,prior]=await Promise.all([
      readFile(scaleFolder+'/ranking-inputs.json.gz').then(b=>JSON.parse(gunzipSync(b))),
      read('demo/data/judge-reactivation.json'),read('docs/commerce-growth/team-1/training/model.json')
    ]);
    assert.equal(canonicalHash(data),hash);assert.equal(data.protocolHash,canonicalHash(scaleProtocol));
    assert.equal(judge.decision.contractHash,data.contract.hash);assertBinding(data.contract,data.model);
    assert.equal(data.views.length,scaleProtocol.seeds.length);
    return {...data,hash,prior};
  })().catch(error=>{inputs=undefined;throw error;});
}

export async function rankDistricts(districts,feeds){
  if(!scaleProtocol.districts.includes(districts)||!scaleProtocol.feeds.includes(feeds))throw RangeError('Unsupported merchant scale');
  const {views,model,contract,prior}=await loadScaleInputs();
  const batches=views.slice(0,districts).map((v,i)=>withFeeds(v,enrolledStores(v.merchants,feeds,i)));
  const start=performance.now();
  const plans=batches.map(view=>scoreCampaign(view,{contract,model,prior}));
  const rankingMs=performance.now()-start;
  let recommendations=0,inquiries=0;const examples=[];
  for(const [i,p] of plans.entries()){
    const items=p.actions.filter(a=>a.kind==='recommend');recommendations+=items.length;inquiries+=p.actions.length-items.length;
    if(items.length){const a=items[0];examples.push({district:i+1,shopper:a.customerId,
      product:batches[i].products.find(x=>x.catalogId===a.catalogId).title});}
  }
  return {districts,feeds,participatingMerchants:districts*feeds,visibleListings:districts*feeds*4,
    shoppers:batches.reduce((s,v)=>s+v.audience.length,0),recommendations,inquiries,rankingMs,examples,
    actionHash:canonicalHash(plans.map(p=>p.actions)),modelHash:model.modelHash,newModelCalls:0};
}

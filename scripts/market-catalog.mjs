import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { execFile } from 'node:child_process';
import { SAMPLE_PRODUCTS } from '../demo/market/engine.mjs';
import { SandboxError } from './paypal-sandbox.mjs';

const httpsUrl = x => {try {const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
const catalogLabel = value => typeof value==='string'?value:typeof value?.name==='string'?value.name:null;
async function catalogFetch(url,options) {
  try{return await fetch(url,options);}
  catch(error){
    // Some local Node installs omit the OS trust store. curl still verifies TLS with that store.
    // Only a failed TLS handshake is retried; an ambiguous HTTP request is never replayed.
    if(!['SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(error.cause?.code))throw error;
    if(url!=='https://api.trychannel3.com/v1/search')throw error;
    const config=[`url = ${JSON.stringify(url)}`,'request = "POST"',...Object.entries(options.headers).map(([k,v])=>`header = ${JSON.stringify(`${k}: ${v}`)}`),`data = ${JSON.stringify(options.body)}`].join('\n');
    const output=await new Promise((resolve,reject)=>{
      const child=execFile('curl',['--config','-','--silent','--show-error','--proto','=https','--connect-timeout','10','--max-time','20','--max-redirs','0','--write-out','\n%{http_code}'],{maxBuffer:4*1024*1024},(err,stdout)=>err?reject(new Error('Verified catalog connection failed.')):resolve(stdout));
      // The API key travels over stdin, never process arguments or a temporary file.
      child.stdin.on('error',()=>{});child.stdin.end(config);
    });
    const split=output.lastIndexOf('\n'),status=Number(output.slice(split+1));
    return new Response(output.slice(0,split),{status});
  }
}
export function normalizeChannel3(data) {
  const products=Array.isArray(data)?data:(data.products??data.results??data.data?.products??[]);
  if(!Array.isArray(products))return [];
  return products.flatMap((p,i)=>{
    const offer=p.offers?.find(o=>(o.price?.currency||o.currency||'USD')==='USD')||p.offers?.[0]||{};
    const raw=offer.price??p.price??p.min_price;
    const value=typeof raw==='object'?(raw.amount??raw.price??raw.value??raw.min):raw;
    const currency=raw?.currency||raw?.currency_code||offer.currency||p.currency||'USD';
    const amount=Number(value), title=p.title||p.name, id=p.id||p.product_id;
    if(!id||typeof title!=='string'||!Number.isFinite(amount)||amount<=0||amount>2000||currency!=='USD')return [];
    const image=p.image_url||p.image?.url||p.images?.[0]?.url||p.images?.[0];
    return [{id:String(id),channel3Id:String(id),title:title.slice(0,180),brand:(catalogLabel(p.brand)||catalogLabel(p.brands?.[0])||catalogLabel(offer.merchant)||'Channel3 Market').slice(0,70),category:(catalogLabel(p.category)||'Unspecified').slice(0,60),priceCents:Math.round(amount*100),currency:'USD',source:'CHANNEL3_API',sourceUrl:httpsUrl(offer.url||p.url||p.product_url),imageUrl:httpsUrl(image),symbol:['◈','✦','◎'][i%3],retrievedAt:new Date().toISOString()}];
  });
}
export async function createMarketCatalog({env=process.env,envFile=null,path,fetchImpl=catalogFetch}={}) {
  let cache=null;
  if(path)try{cache=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  for(const product of cache?.products||[])if(product.category==='[object Object]')product.category='Unspecified';
  // Reload only the two Channel3 settings. Existing PayPal credentials and process configuration stay isolated.
  const config=()=>{const values=envFile&&existsSync(envFile)?parseEnv(readFileSync(envFile,'utf8')):{};return {key:(values.CHANNEL3_API_KEY??env.CHANNEL3_API_KEY??'').trim(),free:(values.CHANNEL3_FREE_CREDITS_CONFIRMED??env.CHANNEL3_FREE_CREDITS_CONFIRMED)==='true'};};
  return {
    status(){const c=config();return {configured:Boolean(c.key),mode:cache?.products?.length?'CHANNEL3_CACHE':'SAMPLE',productCount:cache?.products?.length||SAMPLE_PRODUCTS.length,syncedAt:cache?.syncedAt||null,freeCreditCallsEnabled:c.free,message:cache?.products?.length?'Cached Channel3 API products; simulations make no catalog calls.':'Authored sample products. Channel3 has not been called.'};},
    products(){return cache?.products?.length?structuredClone(cache.products):structuredClone(SAMPLE_PRODUCTS);},
    async sync(){
      const c=config();
      if(!c.key)throw new SandboxError(409,'CHANNEL3_KEY_MISSING','Add CHANNEL3_API_KEY to .env to import live catalog data. Sample products are available now.');
      if(!c.free)throw new SandboxError(409,'FREE_CREDITS_REQUIRED','Use a free/sponsor key and set CHANNEL3_FREE_CREDITS_CONFIRMED=true. No paid catalog calls are enabled.');
      if(cache?.syncedAt&&Date.now()-Date.parse(cache.syncedAt)<86400000)return this.status();
      // Reuse a successful search for 24 hours. No auto top-up, model, or retailer checkout.
      let response;
      try{response=await fetchImpl('https://api.trychannel3.com/v1/search',{method:'POST',headers:{'x-api-key':c.key,'Content-Type':'application/json'},body:JSON.stringify({query:'office home everyday essentials under 100 dollars',limit:24}),signal:AbortSignal.timeout(20000),redirect:'error'});}
      catch{throw new SandboxError(502,'CHANNEL3_CONNECTION','Could not establish a verified connection to Channel3. Existing catalog preserved.');}
      if(!response.ok)throw new SandboxError(502,'CHANNEL3_UNAVAILABLE',`Channel3 returned HTTP ${response.status}; existing catalog preserved.`);
      const products=normalizeChannel3(await response.json());
      if(!products.length)throw new SandboxError(502,'CHANNEL3_SCHEMA','Channel3 returned no usable USD products; sample/catalog data preserved.');
      cache={syncedAt:new Date().toISOString(),products};
      if(path){await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(cache,null,2),{mode:0o600});}
      return this.status();
    },
  };
}

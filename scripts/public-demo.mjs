// Public hosting keeps payments and campaign execution locked. Studio investigations have a separate durable model allowance.
export const PUBLIC_RUNTIME = Object.freeze({publicDemo:true,freshPlanning:false,payments:false,
  maxMerchants:12,maxShoppers:600,maxRunsPerInstance:4,
  storage:'Temporary shared demo sessions; download results before the instance restarts.'});

const reads = new Set(['/api/market/intelligence/runs','/api/market/intelligence',
  '/api/market/autonomy/latest','/api/market/autonomy/scale-results',
  '/api/market/room/latest','/api/market/room/preview','/api/market/table','/api/market/schema',
  '/api/market/merchant-scale/rank','/api/paypal/funding','/api/paypal/status','/api/paypal/orders']);
export function publicRouteAllowed(method,path){
  if(method==='GET'||method==='HEAD')return reads.has(path)||
    /^\/api\/market\/ontology\/(reference|training|planner|feed|verify)$/.test(path)||
    /^\/api\/market\/autonomy\/AUTONOMY-[a-f0-9]{16}(\/trace)?$/.test(path);
  return method==='POST'&&(path==='/api/market/autonomy/start'||
    /^\/api\/market\/studio-investigation\/(plan|verify)$/.test(path)||
    /^\/api\/market\/autonomy\/AUTONOMY-[a-f0-9]{16}\/(mapping|tick)$/.test(path));
}
export function publicStartAllowed(input){
  return input?.execution==='saved'&&input.sandbox===false&&input.marketProfile==='expanded-12x600'&&
    input.harnessVersion==='v2'&&input.plannerMode==='single'&&input.modelCheck===true;
}
export function publicHeaders(res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
}

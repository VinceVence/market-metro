import http from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPayPalSandbox, SandboxError } from './paypal-sandbox.mjs';
import {createSandboxFunding} from './paypal-funding.mjs';
import { createBenchmarkService, BenchmarkError } from '../benchmark/service.mjs';
import { createMarketStore, SCHEMA, csv } from './market-store.mjs';
import { createMarketCatalog } from './market-catalog.mjs';
import { createMarketService } from './market-service.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  res.end(JSON.stringify(body));
}
async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 4096) throw new SandboxError(413, 'BODY_TOO_LARGE', 'Request is too large.');
  }
  try { return text ? JSON.parse(text) : {}; }
  catch { throw new SandboxError(400, 'INVALID_JSON', 'Request body must be JSON.'); }
}

export function createSupplyYardServer(paypal, benchmark=createBenchmarkService({storePath:resolve(root,'.local/benchmarks/latest.json')}), market=null, funding=null) {
  const server = http.createServer(async (req, res) => {
    try {
      const port = server.address().port;
      const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!hosts.includes(req.headers.host)) return json(res, 403, { error: { code: 'LOCAL_ONLY', message: 'Use the local Supply Yard address.' } });
      const origin = `http://${req.headers.host}`;
      const url = new URL(req.url, origin), path = decodeURIComponent(url.pathname);
      if (path.startsWith('/api/')) {
        if(path.startsWith('/api/market')&&!market)return json(res,503,{error:{code:'MARKET_UNAVAILABLE',message:'Market service is not initialized.'}});
        if(req.method==='GET'&&path==='/api/market/status')return json(res,200,market.status());
        if(req.method==='GET'&&path==='/api/market/payment-sample')return json(res,200,market.paymentSample(url.searchParams.get('run')));
        if(req.method==='GET'&&path==='/api/market/run')return json(res,200,market.frame(url.searchParams.get('id')));
        if(req.method==='GET'&&path==='/api/market/table'){
          const runId=url.searchParams.get('run');market.frame(runId);
          return json(res,200,market.store.table(url.searchParams.get('name'),runId,{limit:url.searchParams.get('limit'),offset:url.searchParams.get('offset')}));
        }
        if(req.method==='GET'&&path==='/api/market/export'){
          const id=url.searchParams.get('run');market.frame(id);const format=url.searchParams.get('format')||'json',name=url.searchParams.get('name');
          let content,type,extension;
          if(format==='sqlite'){content=await market.store.snapshot(id);type='application/vnd.sqlite3';extension='sqlite';}
          else if(format==='sql'){content=SCHEMA;type='application/sql';extension='sql';}
          else if(format==='csv'){const meta=market.store.table(name,id);const data=market.store.export(id);content=csv({...meta,rows:data.tables[name]||data.views[name]});type='text/csv; charset=utf-8';extension='csv';}
          else if(format==='json'){content=JSON.stringify(market.store.export(id),null,2);type='application/json';extension='json';}
          else throw new SandboxError(400,'INVALID_EXPORT','Choose SQLite, JSON, CSV or SQL schema.');
          res.writeHead(200,{'Content-Type':type,'Content-Disposition':`attachment; filename="market-metro-${id.replace(/[^a-zA-Z0-9-]/g,'')}.${extension}"`,'Cache-Control':'no-store'});res.end(content);return;
        }
        if (req.method === 'GET' && path === '/api/benchmarks/status') return json(res, 200, benchmark.status());
        if (req.method === 'GET' && path === '/api/benchmarks/latest') return json(res, 200, { report: await benchmark.latest() });
        if(req.method==='GET'&&path==='/api/paypal/funding')return json(res,200,funding?.status()||{ready:false,mode:'SANDBOX',description:'Reusable sandbox buyer is not configured.'});
        if (req.method === 'GET' && path === '/api/paypal/status') return json(res, 200, paypal.status());
        if (req.method === 'GET' && path === '/api/paypal/orders') return json(res, 200, { orders: paypal.list() });
        if (req.method !== 'POST') return json(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
        if (req.headers.origin !== origin || req.headers['x-supply-yard'] !== 'sandbox'
            || req.headers['content-type']?.split(';')[0] !== 'application/json') {
          return json(res, 403, { error: { code: 'SAME_ORIGIN_REQUIRED', message: 'Use the sandbox controls in this local app.' } });
        }
        const input = await body(req);
        if (!input || Array.isArray(input) || typeof input !== 'object') throw new SandboxError(400, 'INVALID_JSON', 'Expected a JSON object.');
        if(path==='/api/market/runs')return json(res,200,await market.create(input));
        if(path==='/api/market/compare')return json(res,200,await market.compare(input.runId));
        if(path==='/api/market/catalog/sync')return json(res,200,await market.syncCatalog());
        const mirrorRun=path.match(/^\/api\/market\/runs\/([^/]+)\/mirror$/);
        if(mirrorRun)return json(res,200,await market.mirror(mirrorRun[1],input.orderIds));
        const marketRun=path.match(/^\/api\/market\/runs\/([^/]+)\/(advance|control)$/);
        if(marketRun)return json(res,200,marketRun[2]==='advance'?await market.advance(marketRun[1],input.steps):market.control(marketRun[1],input));
        const marketReceipt=path.match(/^\/api\/market\/receipts\/([^/]+)\/refresh$/);
        if(marketReceipt)return json(res,200,await market.refreshReceipt(marketReceipt[1]));
        if (path === '/api/benchmarks/run') return json(res, 200, { report: await benchmark.run(input) });
        if(path==='/api/paypal/funding/start'||path==='/api/paypal/funding/complete'){
          if(!funding)throw new SandboxError(503,'FUNDING_UNAVAILABLE','The reusable sandbox buyer is not initialized.');
          return json(res,200,path.endsWith('/start')?await funding.start(origin):await funding.complete(input.state));
        }
        if (path === '/api/paypal/connect') return json(res, 200, await paypal.connect());
        if (path === '/api/paypal/orders') return json(res, 200, await paypal.create(input, origin));
        const match = path.match(/^\/api\/paypal\/orders\/([^/]+)\/(refresh|capture)$/);
        if (match) {
          const result = match[2] === 'refresh' ? await paypal.refresh(match[1]) : await paypal.capture(match[1], input.orderId);
          return json(res, 200, result);
        }
        return json(res, 404, { error: { code: 'NOT_FOUND', message: 'Unknown API route.' } });
      }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
      if(path.startsWith('/vendor/three/')||path.startsWith('/vendor/three-addons/')){
        const addon=path.startsWith('/vendor/three-addons/');
        const base=resolve(root,addon?'node_modules/three/examples/jsm':'node_modules/three/build');
        const file=resolve(base,path.slice(addon?21:14));
        if(!file.startsWith(base+sep)||!file.endsWith('.js')){res.writeHead(403);res.end();return;}
        const content=await readFile(file);res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'public, max-age=3600'});res.end(content);return;
      }
      if(path==='/vendor/phaser.js'){const content=await readFile(resolve(root,'node_modules/phaser/dist/phaser.min.js'));res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'public, max-age=3600'});res.end(content);return;}
      const base = path.startsWith('/figures/') ? resolve(root, 'docs/figures') : resolve(root, 'demo');
      const relative = path.startsWith('/figures/') ? path.slice(9) : path === '/' ? 'index.html' : path.slice(1);
      const file = resolve(base, relative);
      if (!file.startsWith(base + sep)) { res.writeHead(403); res.end(); return; }
      const content = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (error instanceof SandboxError || error instanceof BenchmarkError) return json(res, error.status, { error: { code: error.code, message: error.message, debugId: error.debugId } });
      if (error.code === 'ENOENT') { res.writeHead(404); res.end('Not found'); return; }
      json(res, 500, { error: { code: 'LOCAL_SERVER_ERROR', message: 'The local server could not complete this request. Refresh before retrying a payment.' } });
    }
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'));
  const paypal = await createPayPalSandbox({ storePath: resolve(root, '.local/paypal-sandbox.json') });
  const catalog=await createMarketCatalog({path:resolve(root,'.local/market-catalog.json'),envFile:resolve(root,'.env')});
  const store=createMarketStore(resolve(root,'.local/market-metro.sqlite'));
  const funding=await createSandboxFunding({paypal,path:resolve(root,'.local/paypal-vault-setup.json')});
  const market=createMarketService({paypal,catalog,store,funding});
  const server = createSupplyYardServer(paypal,undefined,market,funding);
  server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Market Metro: http://127.0.0.1:${server.address().port}`));
}

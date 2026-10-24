import {DatabaseSync,constants} from 'node:sqlite';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createFreshWorld} from '../policy-lab/fresh-world.mjs';
import {trainBandit} from '../policy-lab/learner.mjs';
import {ACTIONS,ASSUMPTIONS} from '../policy-lab/economy.mjs';

export const ROOT=resolve(import.meta.dirname,'../..');
export const BASE=resolve(ROOT,'docs/policy-lab/benchmarks/v3');
export const FIELDS=['bias','recency_30d','purchases_7d','offers_7d','price_scale','observed_merchant_affinity','recent_refunds'];
export const sha=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export const readJSON=async path=>JSON.parse(await readFile(path,'utf8'));
export const saveJSON=async(path,value)=>{await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(path+'.tmp',path);};
export async function frozenInputs(){
  const v1=await readJSON(resolve(ROOT,'docs/policy-lab/benchmarks/v1/lock.json'));
  const v2=await readJSON(resolve(ROOT,'docs/policy-lab/benchmarks/v2/protocol.json'));
  for(const [p,h]of Object.entries({...v1.code,...v2.code}))if(sha(await readFile(resolve(ROOT,p)))!==h)throw Error('FROZEN_ENGINE_OR_BASELINE_CHANGED: '+p);
  const bytes=await readFile(resolve(ROOT,'docs/policy-lab/benchmarks/v1/inputs.json'));if(sha(bytes)!==v1.inputsHash)throw Error('FROZEN_CATALOG_CHANGED');
  return {catalog:JSON.parse(bytes).catalog,assumptions:ASSUMPTIONS,originalBenchmarkHash:v1.benchmarkHash,v2ProtocolHash:v2.protocolHash};
}

export function observedWorld({id,seed,scenario,catalog,budgetCents=30000,cutoff=45}){
  const runner=createFreshWorld({id,seed,scenario,catalog,settings:{customerCount:100,days:100,budgetCents},startedAt:'2026-10-24T01:00:00.000Z'});
  while(runner.world.tick<cutoff)runner.step();return runner;
}

export function createSnapshot(path,runner){
  const db=new DatabaseSync(path),w=runner.world;
  db.exec(`CREATE TABLE observations(action_id TEXT PRIMARY KEY,day INTEGER,customer_id TEXT,selected_action TEXT,propensity REAL,matures_day INTEGER,reward_cents INTEGER,${FIELDS.map(f=>f+' REAL').join(',')});
    CREATE TABLE orders(order_id TEXT PRIMARY KEY,day INTEGER,merchant_index INTEGER,customer_id TEXT,gross_cents INTEGER,observed_refund_cents INTEGER,modeled_fee_cents INTEGER,processing_cents INTEGER);
    CREATE TABLE customers(customer_id TEXT PRIMARY KEY,segment TEXT,purchases INTEGER,last_purchase_day INTEGER);
    CREATE TABLE merchants(merchant_index INTEGER PRIMARY KEY,name TEXT,stock INTEGER,max_offer_pct INTEGER);
    CREATE TABLE catalog(product_id TEXT PRIMARY KEY,merchant_index INTEGER,title TEXT,price_cents INTEGER,channel3_id TEXT,source TEXT);
    CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT);`);
  const insert=(table,rows)=>{if(!rows.length)return;const keys=Object.keys(rows[0]),stmt=db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`);for(const row of rows)stmt.run(...keys.map(k=>row[k]??null));};
  db.exec('BEGIN');
  insert('observations',runner.actions.map(a=>({action_id:a.action_id,day:a.day,customer_id:a.customer_id,selected_action:a.selected_action,propensity:a.propensity,matures_day:a.matures_day,reward_cents:a.reward_cents,...Object.fromEntries(FIELDS.map((f,i)=>[f,JSON.parse(a.context_json)[i]]))})));
  const orderDay=new Map(runner.actions.filter(a=>a.order_id).map(a=>[a.order_id,a.day]));
  insert('orders',[...runner.orders.values()].map(o=>({order_id:o.order_id,day:orderDay.get(o.order_id),merchant_index:w.merchants.findIndex(m=>m.merchant_id===o.merchant_id),customer_id:o.customer_id,gross_cents:o.total_cents,observed_refund_cents:o.refund,modeled_fee_cents:o.fee,processing_cents:o.processing})));
  insert('customers',w.customers.map(u=>({customer_id:u.customer_id,segment:u.segment,purchases:u.purchases,last_purchase_day:u.lastPurchase})));
  insert('merchants',runner.evidence().merchants.map(m=>({merchant_index:m.index,name:m.name,stock:m.stock,max_offer_pct:m.maxOfferPct})));
  insert('catalog',w.products.map(p=>({product_id:p.product_id,merchant_index:w.merchants.findIndex(m=>m.merchant_id===p.merchant_id),title:p.title,price_cents:p.price_cents,channel3_id:p.channel3_product_id,source:p.source})));
  insert('metadata',[{key:'cutoff_exclusive',value:String(w.tick)},{key:'money',value:'All amounts are simulated integer cents; fees and costs are assumptions.'},{key:'outcome_maturity',value:'Only reward_cents that are not NULL are mature. Observed refunds on recent orders remain incomplete.'}]);
  db.exec('COMMIT');
  const schema=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name").all();db.close();return schema;
}

export function querySnapshot(path,sql){
  if(typeof sql!=='string'||sql.length>5000)throw Error('SQL_LENGTH_LIMIT');
  const text=sql.trim().replace(/;$/,'');if(!/^(select|with)\b/i.test(text)||text.includes(';'))throw Error('READ_ONLY_SELECT_REQUIRED');
  const db=new DatabaseSync(path,{readOnly:true,allowExtension:false});
  try{
    const functions=new Set(['count','sum','avg','total','min','max','coalesce','ifnull','nullif','abs','round','lower','upper','length','substr','substring','trim','ltrim','rtrim','like','glob','row_number','rank','dense_rank','lag','lead']);
    db.setAuthorizer((action,first,second)=>action===constants.SQLITE_FUNCTION?(functions.has(String(second||first).toLowerCase())?constants.SQLITE_OK:constants.SQLITE_DENY):[constants.SQLITE_SELECT,constants.SQLITE_READ,constants.SQLITE_RECURSIVE].includes(action)?constants.SQLITE_OK:constants.SQLITE_DENY);
    const stmt=db.prepare('SELECT * FROM ('+text+') LIMIT 101'),rows=stmt.all();
    const result={columns:stmt.columns().map(c=>c.name),rows:rows.slice(0,100),truncated:rows.length>100};
    if(Buffer.byteLength(JSON.stringify(result))>16000)throw Error('QUERY_OUTPUT_LIMIT');return result;
  }finally{db.close();}
}
export async function boundedQuery(path,sql){
  const {stdout}=await promisify(execFile)(process.execPath,[import.meta.filename,'--query',path,Buffer.from(sql).toString('base64')],{timeout:2000,maxBuffer:24000});
  const result=JSON.parse(stdout);if(result.error)throw Error(result.error);return result;
}

// A small typed expression compiler, never eval(). Generated linear expressions
// compile back to the frozen engine's seven observable inputs. No target leakage.
export function compileFeature(expression){
  if(typeof expression!=='string'||expression.length>160)throw Error('INVALID_FEATURE_EXPRESSION');
  const tokens=expression.match(/[A-Za-z_]\w*|(?:\d+(?:\.\d*)?|\.\d+)|[()+*/-]/g)||[];
  if(tokens.join('')!==expression.replace(/\s/g,''))throw Error('INVALID_FEATURE_TOKEN');let i=0;
  const constant=v=>[v,0,0,0,0,0,0],isConstant=v=>v.slice(1).every(x=>x===0);
  function atom(){const token=tokens[i++];if(token==='-')return atom().map(x=>-x);if(token==='+')return atom();if(token==='('){const v=sum();if(tokens[i++]!==')')throw Error('UNBALANCED_FEATURE');return v;}if(FIELDS.includes(token))return FIELDS.map(f=>Number(f===token));if(token!==undefined&&/^(\d|\.)/.test(token))return constant(Number(token));throw Error('UNKNOWN_OR_UNSAFE_FEATURE: '+token);}
  function product(){let a=atom();while(['*','/'].includes(tokens[i])){const op=tokens[i++],b=atom();if(op==='/'){if(!isConstant(b)||b[0]===0)throw Error('DIVISOR_MUST_BE_NONZERO_CONSTANT');a=a.map(x=>x/b[0]);}else{if(!isConstant(a)&&!isConstant(b))throw Error('ONLY_LINEAR_FEATURES_SUPPORTED');a=isConstant(b)?a.map(x=>x*b[0]):b.map(x=>x*a[0]);}}return a;}
  function sum(){let a=product();while(['+','-'].includes(tokens[i])){const op=tokens[i++],b=product();a=a.map((x,j)=>x+(op==='+'?b[j]:-b[j]));}return a;}
  const vector=sum();if(i!==tokens.length||vector.some(v=>!Number.isFinite(v)||Math.abs(v)>10))throw Error('FEATURE_COEFFICIENT_LIMIT');return vector;
}

export function normalizeModelSpec({family='ridge',features,windowDays=42}){
  if(!['ridge','mean'].includes(family))throw Error('MODEL_FAMILY_MUST_BE_RIDGE_OR_MEAN');
  if(!Array.isArray(features))throw Error('FEATURES_MUST_BE_AN_ARRAY_OF_LINEAR_EXPRESSIONS');
  features=features.filter(f=>f!=='bias'&&f!=='1');
  if(features.length>6)throw Error('AT_MOST_6_NON_INTERCEPT_FEATURES: the intercept is added automatically');
  if(![28,42,56].includes(windowDays))throw Error('WINDOW_DAYS_MUST_BE_28_42_OR_56');
  features.forEach(compileFeature);return {family,features,windowDays};
}
export function fitCandidate(actions,{family='ridge',features,windowDays=42,cutoffDay=45}){
  ({family,features,windowDays}=normalizeModelSpec({family,features,windowDays}));
  const compiled=features.map(compileFeature);
  const vectors=family==='mean'?[compileFeature('bias')]:[compileFeature('bias'),...compiled];
  while(vectors.length<7)vectors.push(Array(7).fill(0));
  const records=actions.map(a=>{const x=JSON.parse(a.context_json);return {...a,context_json:JSON.stringify(vectors.map(v=>v.reduce((n,k,j)=>n+k*x[j],0)))};});
  const model=trainBandit(records,{cutoffDay,windowDays,actions:ACTIONS}),raw=structuredClone(model);
  for(const arm of Object.values(model.arms)){arm.coef=FIELDS.map((_,j)=>arm.coef.reduce((n,c,k)=>n+c*vectors[k][j],0));arm.inverse=Array.from({length:7},()=>Array(7).fill(0));}
  const usedFeatures=family==='mean'?[]:features;
  const datasetHash=sha(actions.filter(a=>a.day<cutoffDay&&a.matures_day<=cutoffDay&&a.day>=cutoffDay-windowDays).map(a=>[a.day,a.selected_action,a.context_json,a.reward_cents]));
  model.type=family==='mean'?'compiled_action_mean':'compiled_linear_feature_ridge';model.recipe={family,features:usedFeatures,windowDays,datasetHash};
  model.disclosure='Agent-authored bounded linear features. Coefficients compile to the unchanged seven-input policy interface. Prediction MSE is not causal lift.';
  return {artifact:model,rawArtifact:raw,vectors,summary:{type:model.type,features:usedFeatures,windowDays,datasetHash,trainingRows:model.trainingRows,validationRows:model.validationRows,mse:model.mse,baselineMse:model.baselineMse,runtimeMs:model.runtimeMs,disclosure:model.disclosure}};
}

export function runPolicy({id,seed,scenario,catalog,plan,artifact,budgetCents=30000,cutoff=45,includeTrace=false}){
  const runner=observedWorld({id,seed,scenario,catalog,budgetCents,cutoff});
  runner.publish(plan,artifact,cutoff);
  while(runner.world.tick<114)runner.step();
  const result=runner.result(plan.id||'research_policy');
  if(includeTrace)result.trace=runner.actions.filter(a=>a.day>=cutoff&&(a.selected_action!=='none'||a.order_id)).slice(0,30).map(a=>({day:a.day,customerId:a.customer_id,action:a.selected_action,orderId:a.order_id,modelId:a.model_id,rewardCents:a.reward_cents,order:a.order_id?runner.orders.get(a.order_id):null,source:'SIMULATED'}));
  return result;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href&&process.argv[2]==='--query'){
  try{console.log(JSON.stringify(querySnapshot(process.argv[3],Buffer.from(process.argv[4],'base64').toString('utf8'))));}catch(e){console.log(JSON.stringify({error:String(e.message).slice(0,400)}));}
}

// One owned schema subset for Vertex tool declarations and strict runtime checks.
// This is not a general JSON-Schema library. Unsupported types fail closed.
import {createHash} from 'node:crypto';
export const VERSION='commerce-harness-v2.2';
export const en=values=>({type:'STRING',enum:[...values]});
export const textSchema={type:'STRING',minLength:1,maxLength:2200};
export const objectSchema=properties=>({type:'OBJECT',properties,required:Object.keys(properties)});
const sha={type:'STRING',pattern:'^[a-f0-9]{64}$'};
export const contextSchema=objectSchema({day:{type:'INTEGER',minimum:0,maximum:365},marketProfile:en(['frozen-3x100','expanded-12x600']),snapshotHash:sha});
export const campaignSchema=freeze(objectSchema({
 kind:{...en(['product_recommendations','intent_assistance','ranked_discovery','reactivation','open_discovery','hold']),description:'product_recommendations: SKU recommendations only. intent_assistance: recommendations plus general inquiries for recent non-search interest. ranked_discovery: both for recent interest. reactivation: returning shoppers inactive for 14 days. open_discovery: also consider consented general inquiries without recent product interest, only when modeled value is positive. hold: no outreach; organic shopping continues.'},
 objective:en(['paypal','joint']),contactsPer100:en(['3','6','10']),forecast:en(['recent7','recent14','adaptive']),coverDays:en(['0','3','7']),
 supplierSettlement:{...en(['paypal_fast','allow_bank_delay']),description:'Supplier payment rail. Bank settlement can add delay; this is not shopper targeting.'},
 productPreference:{...en(['lowest_acceptable_price','requested_preference']),description:'Which acceptable PRODUCT to replenish. This never selects preferred shoppers.'}
}));
export function validate(value,schema,path='$'){
 const fail=()=>{throw Error('CONTRACT_INVALID:'+path);};
 if(value===null&&schema.nullable)return value;
 switch(schema.type){
  case 'OBJECT':
   if(!value||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)fail();
   for(const key of Object.keys(value))if(!Object.hasOwn(schema.properties,key))fail();
   for(const key of schema.required||[])if(!Object.hasOwn(value,key))fail();
   for(const [key,v]of Object.entries(value))validate(v,schema.properties[key],path+'.'+key);break;
  case 'STRING':
   if(typeof value!=='string'||schema.minLength&&value.trim().length<schema.minLength||schema.maxLength&&value.length>schema.maxLength||schema.pattern&&!new RegExp(schema.pattern).test(value))fail();break;
  case 'NUMBER':case 'INTEGER':
   if(typeof value!=='number'||!Number.isFinite(value)||schema.type==='INTEGER'&&!Number.isSafeInteger(value)||schema.minimum!==undefined&&value<schema.minimum||schema.maximum!==undefined&&value>schema.maximum)fail();break;
  case 'BOOLEAN':if(typeof value!=='boolean')fail();break;
  case 'ARRAY':if(!Array.isArray(value)||schema.minItems!==undefined&&value.length<schema.minItems)fail();value.forEach((v,i)=>validate(v,schema.items,path+'['+i+']'));break;
  default:throw Error('CONTRACT_UNSUPPORTED_SCHEMA:'+schema.type);
 }
 if(schema.enum&&!schema.enum.includes(value))fail();return value;
}
export function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export function canonicalHash(value){
 const normalize=x=>Array.isArray(x)?x.map(normalize):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,normalize(x[k])])):x;
 return createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
}
export function toolDeclaration(name,fields,evidenceId){return freeze({name,description:'Propose bounded work. The deterministic controller owns validation and final publication.',parameters:objectSchema({...fields,rationale:textSchema,evidenceId:en([evidenceId])})});}
export function validateToolReply(reply,tools){
 const tool=tools.find(t=>t.name===reply?.name);if(!tool)throw Error('CONTRACT_UNEXPECTED_TOOL');
 // Vertex can include a transport call ID; it is not a campaign argument.
 validate(reply,{type:'OBJECT',properties:{name:en([tool.name]),args:tool.parameters,id:{type:'STRING',minLength:1,maxLength:256}},required:['name','args']});return freeze(structuredClone({name:reply.name,args:reply.args}));
}
export function marketProfileFor(view){
 if(view.audience.length===600&&view.merchants.length===12)return 'expanded-12x600';
 if(view.audience.length===100&&view.merchants.length===3)return 'frozen-3x100';
 throw Error('CONTRACT_UNSUPPORTED_MARKET');
}
const amount={type:'NUMBER'},count={type:'NUMBER',minimum:0};
const measurementSchema=objectSchema({platformUSD:amount,retailerUSD:amount,retainedPurchases:count,platformDeltaUSD:amount,retailerDeltaUSD:amount,purchaseDelta:amount,unpaidLiabilities:{type:'INTEGER',minimum:0},retainedVolumeUSD:count,volumeDeltaUSD:amount,partnerCashDeltaUSD:amount,inventoryRatio:{...count,nullable:true},contactCount:count,contactDelta:amount,outreachCostUSD:count,outreachCostDeltaUSD:amount});
const receiptSchema=objectSchema({
 contractHash:{type:'STRING',pattern:'^(FIXED|[a-f0-9]{64})$'},modelHash:{...sha,nullable:true},trialHash:sha,
 evaluationContextHash:sha,reviewContextHash:sha,prefixHash:sha,measurement:measurementSchema,
 cases:{type:'ARRAY',minItems:1,items:objectSchema({regime:textSchema,platformDeltaUSD:amount,retailerDeltaUSD:amount,purchaseDelta:amount})},
 scope:textSchema,activeMarketFutureUsed:{type:'BOOLEAN',enum:[false]},source:en(['LOCAL_TRUSTED_EVALUATOR'])
});
export function sealTrialReceipt(body){validate(body,receiptSchema);return freeze({...structuredClone(body),receiptHash:canonicalHash(body)});}
export function validateTrialReceipt(receipt){
 if(!receipt||Object.getPrototypeOf(receipt)!==Object.prototype)throw Error('CONTRACT_INVALID_RECEIPT');
 const {receiptHash,...body}=receipt;validate(receiptHash,sha);validate(body,receiptSchema);
 if(canonicalHash(body)!==receiptHash)throw Error('CONTRACT_RECEIPT_CHANGED');return receipt;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {economicGates,paymentContribution} from '../scripts/commerce-growth/autonomy/finalize-economic-workflow.mjs';

test('economic promotion cannot be earned by supplier fee growth that drains partners',()=>{
 const base={platformUSD:100,retailerUSD:800,terminalCashUSD:2000,terminalInventoryUSD:200,retainedVolumeUSD:3000,unpaidLiabilities:0};
 const candidate={...base,platformUSD:120,terminalCashUSD:1900,terminalInventoryUSD:300};
 const gates=economicGates(candidate,base,.10);assert.equal(gates.positivePayPalNet,true);assert.equal(gates.partnerCash,false);assert.equal(gates.inventory,false);assert.equal(Object.values(gates).every(Boolean),false);
 assert.equal(economicGates({...base,platformUSD:100.01},base,.10).positivePayPalNet,false);
});
test('PayPal contribution excludes payment principal and includes fees, costs and returned fees',()=>{
 const entries=[{kind:'RETAIL_CAPTURE',from:'buyer',to:'merchant',cents:10000},{kind:'PAYMENT_FEE',from:'merchant',to:'platform',cents:400},{kind:'PAYMENT_FEE_RETURN',from:'platform',to:'merchant',cents:40},{kind:'PAYMENT_PROCESSING',from:'platform',to:'processor',cents:100},{kind:'OUTREACH',from:'platform',to:'messages',cents:5},{kind:'SUPPLIER_PAYMENT_FEE',from:'supplier',to:'platform',cents:80}].map(e=>({...e,day:40}));
 const values=paymentContribution(entries);assert.deepEqual(values,{retailFees:4,supplierFees:.8,processing:-1,outreach:-.05,refunds:-.4,other:0});assert.ok(Math.abs(Object.values(values).reduce((s,v)=>s+v,0)-3.35)<1e-9);
});

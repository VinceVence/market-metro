// Verify the cash-envelope identities on already recorded trajectories.
// Reuses saved observations; no model calls or new performance trials.
import {readFile,writeFile} from 'node:fs/promises';
import {warmGrowthWorld} from '../evaluate.mjs';
const read=p=>readFile(p,'utf8').then(JSON.parse),root='docs/commerce-growth/envelope-1',protocol=await read('docs/commerce-growth/team-1/protocol.json'),checks=[];
for(const c of protocol.testCases){
 const w=warmGrowthWorld({seed:c.seed,regime:c.regime}),party=new Set([...w.merchants.map(m=>m.id),'wholesaler','manufacturer']),opening=[...party].reduce((s,id)=>s+w.accounts[id],0),minimum=Math.min(...w.products.map(p=>p.costCents));
 if(w.supplierInvoices.some(i=>i.status!=='PAID')||(w.accounts.procurement_clearing||0)!==0)throw Error('WARMUP_SUPPLIER_CASH_ASSUMPTION_CHANGED');
 for(const arm of ['single','multi']){
  const t=await read('docs/commerce-growth/team-1/test/'+c.id+'-'+arm+'/trajectory.json'),ledger=t.ledger.filter(e=>e.day>=30),orders=t.orders.filter(o=>o.day>=30),
   movement=ledger.reduce((s,e)=>s+(party.has(e.to)?e.cents:0)-(party.has(e.from)?e.cents:0),0),
   H=orders.reduce((s,o)=>s+(o.refundStatus==='SETTLED'?0:o.grossCents-o.feeCents)-o.merchants.reduce((s,m)=>s+m.deliveryCents,0),0),
   retail=orders.reduce((s,o)=>s+(o.refundStatus==='SETTLED'?0:o.feeCents)-o.processingCents,0),
   sum=kind=>ledger.filter(e=>e.kind===kind).reduce((s,e)=>s+e.cents,0),raw=sum('RAW_MATERIAL_EXPENSE'),fees=sum('SUPPLIER_PAYMENT_FEE'),bank=sum('BANK_PAYMENT_FEE'),holding=sum('INVENTORY_HOLDING_COST'),
   roots=t.invoices.filter(i=>i.stage==='RETAIL_TO_WHOLESALE'&&i.createdDay>=30),T=roots.reduce((s,i)=>s+i.grossCents,0),
   pp=t.invoices.filter(i=>i.rail==='paypal'&&i.status==='PAID'&&i.paidDay>=30),U=pp.reduce((s,i)=>s+i.grossCents,0),N=pp.length;
  const oldFlow=movement-H+raw+fees+bank+holding,oldPositive=w.liabilities.filter(l=>l.status==='FEE_REBATE_DUE').reduce((s,l)=>s+l.amountCents,0);
  if(oldFlow>oldPositive)throw Error('OLD_CASH_ALLOWANCE_TOO_SMALL');
  const a=1.7+.5/minimum,gamma=.42-.8/minimum,eta=.0229/(.0349+gamma/a);
  if(U>a*T+1e-7||raw<gamma*T-1e-7||fees<.0349*U+48.5*N-1e-7)throw Error('CASH_EXPENSE_ENVELOPE_FAILED');
  const supplierNet=pp.reduce((s,i)=>s+i.feeCents-i.processingCents,0),supplierUpper=eta*(H+oldPositive-movement)+(30-48.5*eta)*N;
  if(supplierUpper+1e-7<supplierNet)throw Error('SUPPLIER_NET_CASH_ENVELOPE_FAILED');
  checks.push({case:c.id,arm,openingPartnerCashCents:opening,closingPartnerCashCents:opening+movement,oldFlowCents:oldFlow,
   actualSupplierNetCents:supplierNet,supplierUpperAtActualClosingCashCents:supplierUpper,retailNetCents:retail});
 }
}
const report={verifiedAt:new Date().toISOString(),cashIdentitiesChecked:true,trajectories:checks,
 scope:'Checks the cash-envelope derivation against recorded single/team trajectories using their actual closing cash. It does not claim those trajectories pass the fixed-reference cash floor or the2x target.',newModelCalls:0};
await writeFile(root+'/cash-mapping-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({trajectories:checks.length,verified:true,newModelCalls:0}));

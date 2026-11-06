export function balances(w){
  const merchant=Object.fromEntries(w.merchants.map(m=>[m.id,{cash:w.accounts[m.id],inventory:0,pipeline:0,refunds:0,rent:0}]));
  for(const p of w.products)merchant[p.merchantId].inventory+=p.stock*p.costCents;
  for(const p of w.procurements)if(p.status!=='DELIVERED')merchant[p.merchantId].pipeline+=p.costCents;
  for(const o of w.orders)if(o.refundStatus==='PENDING_FUNDS')for(const m of o.merchants)merchant[m.id].refunds+=m.grossCents;
  let feeDue=0,exposure=0;
  for(const l of w.liabilities){if(l.status==='HOLDING_COST_DUE')merchant[l.merchantId].rent+=l.amountCents;if(l.status==='FEE_REBATE_DUE')feeDue+=l.amountCents;if(l.status==='UNPAID_REFUND')exposure+=l.amountCents;}
  for(const m of Object.values(merchant))m.equity=m.cash+m.inventory+m.pipeline-m.refunds-m.rent;
  return {merchant,platformCash:w.accounts.platform,platformNet:w.accounts.platform-feeDue-exposure,feeDue,exposure,
    wholesaler:w.accounts.wholesaler,manufacturer:w.accounts.manufacturer};
}

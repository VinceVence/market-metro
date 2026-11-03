export const REQUIRED_WIDGETS={sales:['net_sales','merchant_sales'],refunds:['refunds','merchant_sales'],campaigns:['campaign_costs','daily_sales'],models:['model_quality','orders'],payments:['payment_evidence','order_ledger']};
// LLMs choose the investigation. The local compiler guarantees its cited facts have views.
export function coverEvidence(analysis,proposed){
 const required=new Set(['payment_evidence',...(REQUIRED_WIDGETS[analysis.focus]||[])]);
 for(const {metricId} of analysis.evidence||[]){
  if(metricId.endsWith('.refundUSD'))required.add('refunds');
  if(/\.modelFits$|Recall$/.test(metricId))required.add('model_quality');
  if(/\.(contacts|outreachUSD|subsidyUSD)$/.test(metricId))required.add('campaign_costs');
 }
 if(required.size>6)throw Error('Too many required evidence views; narrow the question.');
 const widgets=[...required,...proposed.filter(w=>!required.has(w))].slice(0,6);
 return {widgets,added:widgets.filter(w=>!proposed.includes(w)),removed:proposed.filter(w=>!widgets.includes(w))};
}

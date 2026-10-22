export function buildReserveReview(order, scenario = 'mixed') {
  const receipt = order?.receipt;
  if (receipt?.provenance !== 'PAYPAL_SANDBOX' || receipt.status !== 'COMPLETED'
      || order.orderStatus !== 'COMPLETED' || order.paymentState !== 'COMPLETED'
      || receipt.currency !== 'USD' || !Number.isInteger(order.quantity)
      || order.quantity < 1 || order.quantity > 10 || receipt.grossCents !== order.quantity * 1000) {
    throw new Error('A verified, completed PayPal sandbox capture is required.');
  }
  if (!['mixed', 'unresolved'].includes(scenario)) throw new Error('Unknown evidence scenario.');
  const delivered = scenario === 'mixed' ? Math.floor(order.quantity * 0.6) : 0;
  const evidence = Array.from({ length: order.quantity }, (_, index) => ({
    unit: index + 1, amountCents: 1000, provenance: 'GENERATED_SCENARIO',
    reference: `${order.id.slice(0, 8)}-KIT-${index + 1}`,
    observation: index < delivered ? 'Delivery confirmation' : 'Delivery unverified',
    verifiedDelivered: index < delivered,
  }));
  const verifiedGross = delivered * 1000;
  const unresolvedGross = receipt.grossCents - verifiedGross;
  const target = unresolvedGross + verifiedGross * 0.2;
  const net = receipt.netCents;
  if (net !== null && (!Number.isInteger(net) || net < 0 || net > receipt.grossCents
      || !Number.isInteger(receipt.feeCents) || net + receipt.feeCents !== receipt.grossCents)) {
    throw new Error('PayPal net proceeds do not reconcile.');
  }
  return {
    provenance: 'SIMULATED_RESERVE_REVIEW', scenario, captureId: receipt.captureId, evidence,
    policy: 'Authored rule: 100% of unresolved gross + 20% of verified delivered gross. No real PayPal reserve changes.',
    verifiedGross, unresolvedGross, beforeTarget: receipt.grossCents, afterTarget: target,
    beforeHeld: net, afterHeld: net === null ? null : Math.min(net, target),
    availableAfter: net === null ? null : Math.max(0, net - target),
    approved: false,
  };
}

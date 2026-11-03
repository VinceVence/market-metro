"""Evaluator-only headroom for a possible customer-reach extension.

Relax who can spend on each existing need, but retain aggregate household funds.
This is not a legal cross-customer transfer, a new simulator or a deployable
policy. Its purpose is to test a necessary opportunity ceiling before seeking
any new buyer-behavior scope or paying for agents.
"""
import copy
import hashlib
import importlib.util
import json
import time
from pathlib import Path

spec = importlib.util.spec_from_file_location('constraint_audit', 'scripts/commerce-deadlines/constraint-audit.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

root = Path('docs/commerce-deadlines/reachability-envelope-1')
root.mkdir(exist_ok=False)
base = Path('docs/commerce-deadlines/headroom-bound-2')
inputs = json.loads((base / 'inputs.json').read_text())
prices = {r['key']: r for r in json.loads(Path('docs/commerce-deadlines/price-envelope-inputs.json').read_text())['requests']}
fixed = sum(c['reference']['platformUSD'] for c in inputs['cases'])
rows = []
for name, path in [
    ('all_wallets_posted_prices', base / 'linear-model.json'),
    ('all_wallets_price_flexibility', Path('docs/commerce-deadlines/constraint-audit-1/price_envelope_25pct-model.json')),
]:
    raw = path.read_bytes()
    model = json.loads(raw)
    variables = {n: i for i, n in enumerate(model['variables'])}
    gross_names = {str(c['seed']) + ':gross:' + r['id'] for c in inputs['cases'] for r in c['requests']}
    # Remove only per-buyer cash prefix rows. Replace with market-level cash
    # ceilings; otherwise this would manufacture the previous unfunded result.
    for i, constraint in enumerate(model['inequalities']):
        if constraint and all(v == 1 and model['variables'][int(j)] in gross_names for j, v in constraint.items()):
            model['inequalities'][i] = {}; model['rhs'][i] = 0
    for case in inputs['cases']:
        tag = str(case['seed'])
        total_funds = sum(b['prefix'][-1]['usd'] for b in case['budgets'])
        retained = {}
        for r in case['requests']:
            key = tag + ':gross:' + r['id']
            if key not in variables:
                continue
            g = variables[key]; c = variables[key.replace(':gross:', ':cost:')]
            cap = prices[key]['maxQuoteUSD'] if name.endswith('flexibility') else r['maxGrossUSD']
            model['bounds'][g][1] = cap
            model['bounds'][c][1] = .8 * cap + 1e-7
            if not r['refunded']:
                retained[str(g)] = 1
        model['inequalities'].append(retained); model['rhs'].append(total_funds)
    for i, var in enumerate(model['variables']):
        if any(var.endswith(':' + kind) for kind in ['new_procurement', 'merchant_paypal', 'factory_gross', 'factory_paypal']):
            model['bounds'][i][1] *= 3
    result = audit.solve(model)
    certificate = result.pop('certificate')
    (root / (name + '-model.json')).write_text(json.dumps(model))
    (root / (name + '-certificate.json')).write_text(json.dumps(certificate))
    ratio = result['conservativeCeilingUSD'] / fixed
    row = {'id': name, 'sourceModelHash': hashlib.sha256(raw).hexdigest(), **result,
           'ratio': ratio, 'maximumNewFixedMeanUSDFor2x': result['conservativeCeilingUSD'] / 12,
           'maximumNewFixedImprovementBefore2xImpossiblePct': 100 * (ratio / 2 - 1),
           'legalPolicy': False, 'agentPerformance': False}
    rows.append(row)
    print(json.dumps(row), flush=True)
report = {'createdAt': time.time(), 'sourceInputHash': inputs['hash'], 'rows': rows,
          'fixedTotalUSD': fixed, 'fixedMeanUSD': fixed / 6,
          'newModelCalls': 0, 'nativePaymentCalls': 0, 'targetAchieved': False,
          'scope': 'Proposal-only opportunity envelope. Existing six development markets, same total household resources, original maximum purchase count, product-price envelopes and financial floors. Relaxes need-to-buyer matching, the timing of funds, inventory availability, merchant financing and transport delays. Cannot authorize moving money between buyers or imply consent. A new growth-aware fixed baseline has not been measured.'}
(root / 'results.json').write_text(json.dumps(report, indent=2) + '\n')

"""Evaluator-only constraint sensitivity. Never changes the simulator or a policy.

Reads the registered LP, changes explicitly labelled bounds in copies, and
records residual-corrected dual ceilings. Relaxed cases are diagnostics, not
legal actions, a policy, or evidence of agent performance.
"""
import copy
import hashlib
import json
import math
import time
from decimal import Decimal, getcontext, ROUND_CEILING
from pathlib import Path

import numpy as np
from scipy.optimize import linprog
from scipy.sparse import coo_matrix

SOURCE = Path('docs/commerce-deadlines/headroom-bound-2')
DEST = Path('docs/commerce-deadlines/constraint-audit-1')


def matrix(rows, width):
    rr, cc, vv = [], [], []
    for i, row in enumerate(rows):
        for j, v in row.items():
            rr.append(i); cc.append(int(j)); vv.append(v)
    return coo_matrix((vv, (rr, cc)), shape=(len(rows), width)).tocsr()


def solve(model):
    start = time.perf_counter()
    a = matrix(model['inequalities'], len(model['variables']))
    e = matrix(model['equalities'], len(model['variables']))
    result = linprog(model['objective'], A_ub=a, b_ub=model['rhs'],
                     A_eq=e, b_eq=model['equalityRhs'], bounds=model['bounds'], method='highs')
    row = {'status': int(result.status), 'runtimeSeconds': time.perf_counter() - start}
    if not result.success:
        return row
    # A residual-corrected dual certificate: valid even when stationarity has
    # floating-point residuals. All variables have finite boxes and lower=0.
    getcontext().prec = 60
    D = lambda x: Decimal(str(float(x)))
    y = [min(D(x), Decimal(0)) for x in result.ineqlin.marginals]
    z = [D(x) for x in result.eqlin.marginals]
    q = [min(D(x), Decimal(0)) for x in result.upper.marginals]
    residual = [D(c) - qq for c, qq in zip(model['objective'], q)]
    lower = sum((D(b) * v for b, v in zip(model['rhs'], y)), Decimal(0))
    lower += sum((D(b) * v for b, v in zip(model['equalityRhs'], z)), Decimal(0))
    lower += sum((D(b[1]) * v for b, v in zip(model['bounds'], q)), Decimal(0))
    for constraints, duals in [(model['inequalities'], y), (model['equalities'], z)]:
        for constraint, dual in zip(constraints, duals):
            for j, coefficient in constraint.items():
                residual[int(j)] -= D(coefficient) * dual
    lower += sum((min(v, Decimal(0)) * D(b[1]) for v, b in zip(residual, model['bounds'])), Decimal(0))
    ceiling = (-lower + D(model['constantUpperUSD']) + D(model['cushionUSD'])).quantize(Decimal('.01'), rounding=ROUND_CEILING)
    return {**row, 'conservativeCeilingUSD': float(ceiling),
            'primalObjectiveUSD': -float(result.fun) + model['constantUpperUSD'],
            'certificate': {'inequalityDuals': [str(v) for v in y],
                            'equalityDuals': [str(v) for v in z],
                            'upperBoundDuals': [str(v) for v in q],
                            'conservativeUpperUSD': str(ceiling)},
            'terminalInventoryUSD': sum(result.x[i] for i, n in enumerate(model['variables']) if n.endswith(':closing_inventory')),
            'retailGrossUSD': sum(result.x[i] for i, n in enumerate(model['variables']) if ':gross:REQUEST-' in n)}


def main():
    DEST.mkdir(parents=True, exist_ok=False)
    original_bytes = (SOURCE / 'linear-model.json').read_bytes()
    original = json.loads(original_bytes)
    inputs = json.loads((SOURCE / 'inputs.json').read_text())
    fixed = sum(c['reference']['platformUSD'] for c in inputs['cases'])
    floor_start = len(original['rhs']) - 4
    request_caps = {str(c['seed']) + ':gross:' + r['id']: r['maxGrossUSD']
                    for c in inputs['cases'] for r in c['requests']}
    cases = [
        ('registered', 'No changes: reproduce the registered ceiling', []),
        ('inventory_cap_2x', 'DIAGNOSTIC ONLY: allow closing inventory twice the fixed reference', ['inventory2']),
        ('inventory_cap_5x', 'DIAGNOSTIC ONLY: allow closing inventory five times the fixed reference', ['inventory5']),
        ('no_partner_floors', 'DIAGNOSTIC ONLY: remove partner contribution floors; preserve inventory cap', ['noFloors']),
        ('unfunded_requests', 'INVALID BUSINESS MODEL diagnostic: remove buyer funding constraints', ['unfunded']),
        ('price_envelope_25pct', 'Optimistic price-action envelope: up to25% higher quotes, unchanged buyer resources; still bounded by the declared budgets in the supplement', ['price']),
    ]
    # Optional public request supplement generated from the same deterministic
    # stream. It supplies budgets and alternative price envelopes, never data
    # to the application planner. Its hash is recorded alongside the LP hash.
    supplement_path = SOURCE.parent / 'price-envelope-inputs.json'
    supplement = json.loads(supplement_path.read_text())
    prices = {r['key']: r for r in supplement['requests']}
    results = []
    for name, scope, changes in cases:
        model = copy.deepcopy(original)
        if any(x.startswith('inventory') for x in changes):
            factor = 2 if 'inventory2' in changes else 5
            cap = sum(c['reference']['terminalInventoryUSD'] for c in inputs['cases']) * factor
            model['rhs'][-1] = cap
            for i, var in enumerate(model['variables']):
                if var.endswith(':closing_inventory'):
                    model['bounds'][i][1] = cap
                elif any(var.endswith(':' + k) for k in ['new_procurement', 'merchant_paypal', 'factory_gross', 'factory_paypal']):
                    model['bounds'][i][1] += cap - original['rhs'][-1]
        if 'noFloors' in changes:
            for i in range(floor_start, floor_start + 3):
                model['inequalities'][i] = {}; model['rhs'][i] = 0
        if 'unfunded' in changes:
            for i, var in enumerate(model['variables']):
                if var in request_caps:
                    model['bounds'][i][1] = request_caps[var]
                elif ':cost:REQUEST-' in var:
                    model['bounds'][i][1] = .6 * request_caps[var.replace(':cost:', ':gross:')] + 1e-7
                elif any(var.endswith(':' + k) for k in ['new_procurement', 'merchant_paypal', 'factory_gross', 'factory_paypal']):
                    model['bounds'][i][1] *= 3
            # Buyer prefix rows contain only gross variables with coefficient1.
            for i, row in enumerate(model['inequalities']):
                if row and all(v == 1 and model['variables'][int(j)] in request_caps for j, v in row.items()):
                    model['inequalities'][i] = {}; model['rhs'][i] = 0
        if 'price' in changes:
            names = {n: i for i, n in enumerate(model['variables'])}
            for key, p in prices.items():
                if key not in names:
                    continue
                g = names[key]; n = names[key.replace(':gross:', ':count:')]; c = names[key.replace(':gross:', ':cost:')]
                cap = min(p['maxQuoteUSD'], p['resourcesUSD'])
                model['bounds'][g][1] = cap
                model['bounds'][c][1] = max(.8 * cap, model['bounds'][c][1])
                for row in model['inequalities']:
                    keys = set(row)
                    if keys == {str(g), str(n)}:
                        row[str(n)] = -p['maxQuoteUSD'] if row[str(g)] == 1 else p['minQuoteUSD']
                    elif keys == {str(g), str(c)}:
                        row[str(g)] = .43 / 1.25 if row[str(c)] == -1 else -.60 / .75
            for i, var in enumerate(model['variables']):
                if any(var.endswith(':' + k) for k in ['new_procurement', 'merchant_paypal', 'factory_gross', 'factory_paypal']):
                    model['bounds'][i][1] *= 2  # Loose finite boxes, not extra funding.
        result = solve(model)
        certificate = result.pop('certificate', None)
        if certificate:
            (DEST / (name + '-certificate.json')).write_text(json.dumps(certificate))
            (DEST / (name + '-model.json')).write_text(json.dumps(model))
        row = {'id': name, 'scope': scope, **result, 'ratio': result.get('conservativeCeilingUSD', 0) / fixed,
               'legalPolicy': False, 'agentPerformance': False}
        results.append(row)
        print(json.dumps(row), flush=True)
    assert math.isclose(results[0]['conservativeCeilingUSD'], 11755.60, abs_tol=.01)
    assert (SOURCE / 'linear-model.json').read_bytes() == original_bytes
    report = {'createdAt': time.time(), 'sourceHash': hashlib.sha256(original_bytes).hexdigest(),
              'supplementHash': hashlib.sha256(supplement_path.read_bytes()).hexdigest(),
              'fixedTotalUSD': fixed, 'rows': results, 'newModelCalls': 0, 'nativePaymentCalls': 0,
              'targetAchieved': False, 'stage': 'Evaluator-only diagnostic on existing development markets; no test markets opened'}
    (DEST / 'results.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()

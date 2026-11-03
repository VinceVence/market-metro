"""Check diagnostic dual certificates independently, without SciPy or builder imports."""
import json
import sys
from decimal import Decimal, getcontext, ROUND_CEILING
from pathlib import Path

getcontext().prec = 60
D = lambda x: Decimal(str(x))
root = Path(sys.argv[1] if len(sys.argv)>1 else 'docs/commerce-deadlines/constraint-audit-1')
rows = []
for row in json.loads((root / 'results.json').read_text())['rows']:
    name = row['id']
    model = json.loads((root / (name + '-model.json')).read_text())
    certificate = json.loads((root / (name + '-certificate.json')).read_text())
    y, z, q = [list(map(D, certificate[k])) for k in ['inequalityDuals', 'equalityDuals', 'upperBoundDuals']]
    assert len(y) == len(model['rhs']) and len(z) == len(model['equalityRhs']) and len(q) == len(model['objective'])
    assert all(v.is_finite() and v <= 0 for v in y + q) and all(v.is_finite() for v in z)
    assert all(D(lo) == 0 and D(hi).is_finite() and D(hi) >= 0 for lo, hi in model['bounds'])
    residual = [D(c) - v for c, v in zip(model['objective'], q)]
    lower = sum((D(b) * v for b, v in zip(model['rhs'], y)), D(0))
    lower += sum((D(b) * v for b, v in zip(model['equalityRhs'], z)), D(0))
    lower += sum((D(b[1]) * v for b, v in zip(model['bounds'], q)), D(0))
    for constraints, dual in [(model['inequalities'], y), (model['equalities'], z)]:
        for constraint, v in zip(constraints, dual):
            for j, coefficient in constraint.items():
                residual[int(j)] -= D(coefficient) * v
    lower += sum((min(v, D(0)) * D(b[1]) for v, b in zip(residual, model['bounds'])), D(0))
    ceiling = (-lower + D(model['constantUpperUSD']) + D(model['cushionUSD'])).quantize(D('.01'), rounding=ROUND_CEILING)
    assert ceiling <= D(certificate['conservativeUpperUSD']) == D(row['conservativeCeilingUSD'])
    rows.append({'case': name, 'certificateVerified': True, 'ceilingUSD': str(ceiling)})
result = {'certificates': rows, 'optimizerCalls': 0,
          'scope': 'Verifies the stored diagnostic LP bounds, not deployability, agent performance or production PayPal economics.'}
(root / 'verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))

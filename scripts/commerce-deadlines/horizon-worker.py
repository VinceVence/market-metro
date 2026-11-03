"""Numerical receding-horizon tool; consumes public packets over JSON lines.
It cannot read seeds, environment state, future requests, or payment credentials.
"""
import json
import sys
import time

import numpy as np
from scipy.optimize import milp, Bounds, LinearConstraint
from scipy.sparse import coo_matrix


def solve(job):
    start = time.perf_counter()
    choices, procurement = job['choices'], job['procurement']
    variables = len(choices) + len(procurement)
    if not variables:
        return {'selected': [], 'procurement': [], 'status': 0, 'gap': 0, 'runtimeSeconds': 0}
    rows, columns, values, lower, upper = [], [], [], [], []

    def constraint(coefficients, bound):
        index = len(upper)
        for j, value in coefficients.items():
            if value:
                rows.append(index); columns.append(j); values.append(value)
        lower.append(-np.inf); upper.append(bound)

    for request in dict.fromkeys(q['requestId'] for q in choices):
        constraint({i: 1 for i, q in enumerate(choices) if q['requestId'] == request}, 1)
    for product in job['products']:
        pid = product['id']
        for day in sorted(set(q['offset'] for q in choices if pid in q['quantities'])):
            coefficients = {i: q['quantities'][pid] for i, q in enumerate(choices)
                            if q['offset'] <= day and pid in q['quantities']}
            coefficients.update({len(choices) + i: -1 for i, p in enumerate(procurement)
                                 if p['productId'] == pid and p['arrivalOffset'] <= day})
            stock = product['available'] + sum(p['quantity'] for p in job['inbound']
                                               if p['productId'] == pid and p['offset'] <= day)
            constraint(coefficients, stock)
        # Shared physical quantity limit, irrespective of how many rails exist.
        constraint({len(choices) + i: 1 for i, p in enumerate(procurement) if p['productId'] == pid},
                   max((p['limit'] for p in procurement if p['productId'] == pid), default=0))
        # Longer lead times have tighter pending-demand limits. Commit those
        # orders first; every nested prefix must fit its own demand ceiling.
        for lead in set(p['arrivalOffset'] for p in procurement if p['productId'] == pid):
            constraint({len(choices) + i: 1 for i, p in enumerate(procurement)
                        if p['productId'] == pid and p['arrivalOffset'] >= lead},
                       max(p['limit'] for p in procurement if p['productId'] == pid and p['arrivalOffset'] == lead))
    for merchant in job['merchants']:
        constraint({len(choices) + i: p['unitCostCents'] for i, p in enumerate(procurement)
                    if p['merchantId'] == merchant['id']}, merchant['cashCents'])
    objective = [-q['value'] for q in choices] + [p['penalty'] for p in procurement]
    highs = [1] * len(choices) + [p['limit'] for p in procurement]
    a = coo_matrix((np.asarray(values, dtype=float),
                    (np.asarray(rows, dtype=np.int32), np.asarray(columns, dtype=np.int32))),
                   shape=(len(upper), variables)).tocsc()
    result = milp(c=np.asarray(objective), integrality=np.ones(variables),
                  bounds=Bounds(np.zeros(variables), np.asarray(highs)),
                  constraints=LinearConstraint(a, np.asarray(lower), np.asarray(upper)),
                  options={'time_limit': 2., 'mip_rel_gap': .005})
    if result.x is None:
        return {'selected': [], 'procurement': [], 'status': int(result.status), 'gap': None,
                'runtimeSeconds': time.perf_counter() - start}
    return {'selected': np.flatnonzero(result.x[:len(choices)] > .5).tolist(),
            'procurement': [{'index': i, 'quantity': int(round(n))}
                            for i, n in enumerate(result.x[len(choices):]) if n > .5],
            'status': int(result.status), 'gap': float(result.mip_gap),
            'runtimeSeconds': time.perf_counter() - start}


for line in sys.stdin:
    job = {}
    try:
        job = json.loads(line)
        print(json.dumps({'id': job['id'], **solve(job)}), flush=True)
    except Exception as exc:
        print(json.dumps({'id': job.get('id'), 'error': str(exc)}), flush=True)

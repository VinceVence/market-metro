"""Fit observation-only campaign value models. CPU only, no provider SDK."""
from pathlib import Path
import json, time, hashlib, os
os.environ.setdefault('OMP_NUM_THREADS', '1')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')
import numpy as np
import sklearn
from sklearn.linear_model import Ridge
from sklearn.ensemble import ExtraTreesRegressor

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'docs/policy-lab/benchmarks/v6'
data = json.loads((BASE / 'training-table.json').read_text())
source_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
spec = {'phase': 'DEVELOPMENT_ONLY', 'method': 'Learn long-horizon single-intervention value; not sequential RL yet',
        'trainingDataHash': data['hash'], 'codeHash': source_hash,
        'models': ['constant', 'ridge_1', 'ridge_10', 'ridge_100', 'trees_leaf8', 'trees_leaf20'],
        'features': data['features'], 'candidateIds': data['candidateIds'],
        'split': 'All 32 predeclared training seeds; choose hyperparameters using separate development-validation seeds only.',
        'software': {'numpy': np.__version__, 'sklearn': sklearn.__version__}}
path = BASE / 'fit-protocol.json'
if path.exists() and json.loads(path.read_text()) != spec:
    raise RuntimeError('FIT_PROTOCOL_CHANGED')
path.write_text(json.dumps(spec, indent=2) + '\n')
start = time.perf_counter(); models = {}; parity = []
for day in [30, 55, 80]:
    rows = [row for row in data['rows'] if row['day'] == day]
    x = np.array([row['x'] for row in rows]); y = np.array([row['platform'] + row['merchant'] for row in rows])
    center = x.mean(axis=0); scale = x.std(axis=0); scale[scale < 1e-12] = 1
    fitted = {'constant': {'kind': 'constant', 'mean': y.mean(axis=0).tolist()}}
    for penalty in [1, 10, 100]:
        m = Ridge(alpha=penalty).fit((x-center)/scale, y)
        coef = m.coef_/scale
        fitted['ridge_'+str(penalty)] = {'kind': 'ridge', 'coef': coef.tolist(), 'intercept': (m.intercept_-coef@center).tolist()}
        for sample in x[:4]:
            parity.append({'day': day, 'model': 'ridge_'+str(penalty), 'x': sample.tolist(), 'expected': m.predict(((sample-center)/scale)[None])[0].tolist()})
    for leaf in [8, 20]:
        m = ExtraTreesRegressor(n_estimators=80, min_samples_leaf=leaf, max_depth=6, random_state=514, n_jobs=1).fit(x, y)
        trees = []
        for estimator in m.estimators_:
            t = estimator.tree_
            trees.append({'left': t.children_left.tolist(), 'right': t.children_right.tolist(),
                          'feature': t.feature.tolist(), 'threshold': t.threshold.tolist(), 'value': t.value.reshape(t.node_count, -1).tolist()})
        fitted['trees_leaf'+str(leaf)] = {'kind': 'extra_trees', 'outputs': y.shape[1], 'trees': trees}
        for sample in x[:4]:
            parity.append({'day': day, 'model': 'trees_leaf'+str(leaf), 'x': sample.tolist(), 'expected': m.predict(sample[None])[0].tolist()})
    models[str(day)] = fitted
out = {'phase': 'DEVELOPMENT_ONLY', 'protocol': spec, 'candidateIds': data['candidateIds'],
       'models': models, 'parity': parity, 'runtimeSeconds': time.perf_counter()-start,
       'limitations': ['These fit simulated intervention effects, not real PayPal margins.',
                       'Single-intervention predictions must be tested in complete policy sequences.',
                       'Tree variation is not a calibrated confidence interval.']}
(BASE / 'value-models.json').write_text(json.dumps(out, separators=(',', ':')) + '\n')
print(json.dumps({'models': len(models)*6, 'rows': len(data['rows']), 'runtimeSeconds': out['runtimeSeconds'], 'cloudCalls': 0}))

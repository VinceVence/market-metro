"""Finite-horizon fitted Q over public market observations and action history.

The simulator is partially observed; this finite history is an approximation.
Platform and merchant predictions use separate regressors, so the larger USD
scale of merchant outcomes cannot dominate the platform fitting objective.
"""
from pathlib import Path
import json, os, hashlib, time
os.environ.setdefault('OMP_NUM_THREADS', '1')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.ensemble import ExtraTreesRegressor

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'docs/policy-lab/benchmarks/v6'
VARIANTS = [
    {'id': 'myopic_trees64', 'family': 'trees', 'leaf': 64, 'history': True, 'gamma': 0},
    {'id': 'fqi_trees64', 'family': 'trees', 'leaf': 64, 'history': True, 'gamma': 1},
    {'id': 'fqi_trees128', 'family': 'trees', 'leaf': 128, 'history': True, 'gamma': 1},
    {'id': 'fqi_ridge100', 'family': 'ridge', 'alpha': 100, 'history': True, 'gamma': 1},
    {'id': 'fqi_no_history', 'family': 'trees', 'leaf': 64, 'history': False, 'gamma': 1},
]

def select(q):
    """Compare each action with waiting at this state, including carryover."""
    # Stable cross-runtime comparisons below the simulator's one-cent granularity.
    rounded = np.floor(q*1e6 + .5)
    allowed = rounded[:, :, 1] >= rounded[:, :1, 1]
    score = np.where(allowed, rounded[:, :, 0], -np.inf)
    return score.argmax(axis=1)

def bellman(rewards, next_q, gamma):
    if next_q is None or gamma == 0:
        return rewards.copy()
    selected = select(next_q)
    return rewards + gamma * next_q[np.arange(len(next_q)), selected]

def observation_features(e):
    n = e['customers']
    x = [e['recentPurchases']/(7*n), e['previousPurchases']/(7*n),
         e['recentPremiumPurchases']/(7*n), e['previousPremiumPurchases']/(7*n),
         e['activeBuyers']/n, e['lapsedBuyers']/n]
    for m in e['merchants']:
        x.extend([m['stock']/90, m['minStockLast14']/90, m['matureReturns']/m['matureOrders'],
                  m['matureOrders']/100, m['recentOrders']/(7*n), m['directMarkdownPct']/100])
    return x

def state(e, history, count):
    return observation_features(e) + [float(len(history)>t and history[t]==a) for t in [0, 1] for a in range(count)]

def design(states, actions, variant, count):
    observed = states if variant['history'] else states[:, :24]
    return np.concatenate([observed, np.eye(count)[actions]], axis=1)

def all_actions(states, variant, count):
    return design(np.repeat(states, count, axis=0), np.tile(np.arange(count), len(states)), variant, count)

def fit_component(x, y, variant):
    if variant['family'] == 'ridge':
        center = x.mean(axis=0); scale = x.std(axis=0); scale[scale < 1e-12] = 1
        model = Ridge(alpha=variant['alpha']).fit((x-center)/scale, y)
        coef = model.coef_/scale
        artifact = {'kind': 'ridge', 'coef': [coef.tolist()], 'intercept': [float(model.intercept_-coef@center)]}
        return lambda z: model.predict((z-center)/scale), artifact
    model = ExtraTreesRegressor(n_estimators=80, max_depth=7, min_samples_leaf=variant['leaf'], random_state=654, n_jobs=1).fit(x, y)
    trees = []
    for estimator in model.estimators_:
        t = estimator.tree_
        trees.append({'left': t.children_left.tolist(), 'right': t.children_right.tolist(),
                      'feature': t.feature.tolist(), 'threshold': t.threshold.tolist(),
                      'value': t.value.reshape(t.node_count, 1).tolist()})
    return model.predict, {'kind': 'extra_trees', 'outputs': 1, 'trees': trees}

def main():
    protocol = json.loads((BASE / 'sequence-protocol.json').read_text())
    hashes = {}; groups = [[], [], []]; count = len(protocol['candidateIds'])
    for seed in protocol['trainingSeeds']:
        path = BASE / 'sequences' / f'{seed}.json'; raw = path.read_bytes()
        hashes[str(seed)] = hashlib.sha256(raw).hexdigest(); document = json.loads(raw)
        if document['protocolHash'] != protocol['hash']:
            raise RuntimeError('SEQUENCE_PROTOCOL_MISMATCH')
        for case in document['cases']:
            prefixes = set()
            for episode in case['episodes']:
                for stage in range(3):
                    key = (stage, *episode['actions'][:stage+1])
                    if key in prefixes:
                        continue
                    prefixes.add(key)
                    groups[stage].append({'seed': seed, 'state': state(case['observations'][stage], episode['actions'][:stage], count),
                        'action': episode['actions'][stage], 'reward': episode['rewards'][stage],
                        'next': state(case['observations'][stage+1], episode['actions'][:stage+1], count) if stage < 2 else None})
    spec = {'phase': 'OFFLINE_RL_DEVELOPMENT_ONLY', 'sequenceProtocolHash': protocol['hash'],
            'sourceHash': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'dataHashes': hashes,
            'variants': VARIANTS, 'uniqueTransitionsPerStage': [len(g) for g in groups],
            'targets': 'Mature incremental platform and merchant contribution. Independent regressors; no implicit cross-objective MSE weighting.',
            'method': 'Backward fitted Q for three decision stages; gamma=1 is the undiscounted finite-horizon total. Gamma=0 is the myopic control.',
            'constraints': 'Each action must have predicted merchant continuation at least as high as the wait action. Frozen executor retains its hard limits.'}
    spec['hash'] = hashlib.sha256(json.dumps(spec, sort_keys=True).encode()).hexdigest()
    path = BASE / 'q-models.json'
    if path.exists():
        old = json.loads(path.read_text())
        if old['protocol']['hash'] != spec['hash']:
            raise RuntimeError('Q_FIT_PROTOCOL_CHANGED')
        print(json.dumps({'reused': True, 'protocolHash': spec['hash']})); return
    (BASE / 'q-fit-protocol.json').write_text(json.dumps(spec, indent=2)+'\n')
    start = time.perf_counter(); artifacts = {}; parity = []
    for variant in VARIANTS:
        fitted = {}; exported = {}
        for stage in [2, 1, 0]:
            records = groups[stage]; states = np.array([r['state'] for r in records])
            actions = np.array([r['action'] for r in records]); rewards = np.array([r['reward'] for r in records])
            x = design(states, actions, variant, count); next_q = None
            if stage < 2 and variant['gamma']:
                next_states = np.array([r['next'] for r in records]); nx = all_actions(next_states, variant, count)
                next_q = np.stack([fitted[stage+1][key](nx) for key in ['platform', 'merchant']], axis=1).reshape(-1, count, 2)
            targets = bellman(rewards, next_q, variant['gamma']); components = {}; predictors = {}
            for column, key in enumerate(['platform', 'merchant']):
                predictors[key], components[key] = fit_component(x, targets[:, column], variant)
                for row in x[:3]:
                    parity.append({'variant': variant['id'], 'stage': stage, 'component': key, 'x': row.tolist(), 'expected': float(predictors[key](row[None])[0])})
            fitted[stage] = predictors; exported[str(stage)] = components
        artifacts[variant['id']] = {'definition': variant, 'stages': exported}
    out = {'phase': 'OFFLINE_RL_DEVELOPMENT_ONLY', 'protocol': spec, 'candidateIds': protocol['candidateIds'],
           'models': artifacts, 'parity': parity, 'runtimeSeconds': time.perf_counter()-start,
           'limits': ['Partial-observation history approximation; no Markov or convergence guarantee.',
                      'Estimated values are not calibrated confidence bounds or proof of profit.',
                      'All training markets are development only; no current validation future is an input.']}
    path.write_text(json.dumps(out, separators=(',', ':'))+'\n')
    print(json.dumps({'variants': len(artifacts), 'uniqueTransitionsPerStage': spec['uniqueTransitionsPerStage'], 'runtimeSeconds': out['runtimeSeconds'], 'cloudCalls': 0}))

if __name__ == '__main__':
    main()

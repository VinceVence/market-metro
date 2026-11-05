"""Fit and compare bounded feature sets on whole historical markets using local CPU."""
import json
import sys
import time
import warnings
from pathlib import Path

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.feature_selection import f_classif
from sklearn.metrics import average_precision_score, brier_score_loss, log_loss, roc_auc_score

root = Path(sys.argv[1])
job = json.loads((root / 'feature-job.json').read_text())
names, rows = job['names'], job['rows']
x = np.asarray([r['x'] for r in rows], dtype=float)
y = np.asarray([r['target'] for r in rows], dtype=int)
groups = np.asarray([r['market'] for r in rows])
sku = np.asarray([r['kind'] == 'recommend' for r in rows])
buckets = np.asarray([r['bucket'] for r in rows])
markets = sorted(set(groups[sku].tolist()))
recipes = job['plan']['recipes']
allowed = [names.index(f) for f in recipes[-1]['fields']]
if len(markets) < 3 or sku.sum() < 200 or y[sku].sum() < 20:
    raise ValueError('INSUFFICIENT_MATURE_PRODUCT_CONTACTS')
started = time.perf_counter()


def estimator():
    # Match the frozen judge's boosted-tree fit exactly.
    return GradientBoostingClassifier(n_estimators=120, learning_rate=.05, max_depth=2,
                                      min_samples_leaf=30, subsample=.9, random_state=17)


def quality(actual, pred):
    has_both = len(set(actual)) == 2
    return {'logLoss': float(log_loss(actual, pred, labels=[0, 1])),
            'brier': float(brier_score_loss(actual, pred)),
            'auc': float(roc_auc_score(actual, pred)) if has_both else None,
            'averagePrecision': float(average_precision_score(actual, pred)) if actual.sum() else None}


def columns(arm, recipe, train):
    if arm == 'pooled':
        return list(range(len(names)))
    if arm != 'statistical':
        return [names.index(f) for f in recipe['fields']]
    # Selection is fitted inside each training fold, never on the held-out market.
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        f, _ = f_classif(x[train][:, allowed], y[train])
    scores = np.where(np.isnan(f), -np.inf, f)
    order = sorted(range(len(allowed)), key=lambda j: (-scores[j], allowed[j]))
    return sorted(allowed[j] for j in order[:len(recipe['fields'])])


cache = {}
def evaluate(arm, recipe):
    oof, prior = np.zeros(len(rows)), np.zeros(len(rows))
    folds = []
    for market in markets:
        test = (groups == market) & sku
        train = (groups != market) & (True if arm == 'pooled' else sku)
        selected = columns(arm, recipe, train)
        key = (arm == 'pooled', market, tuple(selected))
        if key not in cache:
            model = estimator().fit(x[train][:, selected], y[train])
            cache[key] = model.predict_proba(x[test][:, selected])[:, 1]
        oof[test] = cache[key]
        for bucket in set(buckets[test]):
            history = (groups != market) & sku & (buckets == bucket)
            prior[test & (buckets == bucket)] = (y[history].sum() + .5) / (history.sum() + 2)
        folds.append({'market': market, 'rows': int(test.sum()), 'metrics': quality(y[test], oof[test]),
                      'coarse': quality(y[test], prior[test])})
    metrics = quality(y[sku], oof[sku])
    aucs = [f['metrics']['auc'] for f in folds if f['metrics']['auc'] is not None]
    metrics['macroMarketAUC'] = float(np.mean(aucs)) if aucs else None
    metrics['macroLogLoss'] = float(np.mean([f['metrics']['logLoss'] for f in folds]))
    return {'metrics': metrics, 'coarse': quality(y[sku], prior[sku]), 'wholeMarketFolds': folds}


def fit_final(arm, recipe, report):
    train = np.ones(len(y), dtype=bool) if arm == 'pooled' else sku
    selected = columns(arm, recipe, train)
    model = estimator().fit(x[train][:, selected], y[train])
    trees = []
    for tree in model.estimators_.ravel():
        t = tree.tree_
        # The existing serving/value heads consume the original feature vector.
        # Lift only split indices. No excluded column can enter this classifier.
        trees.append({'feature': [selected[int(i)] if i >= 0 else int(i) for i in t.feature],
                      'threshold': t.threshold.tolist(), 'left': t.children_left.tolist(),
                      'right': t.children_right.tolist(), 'value': t.value[:, 0, 0].tolist()})
    priors = model.init_.class_prior_
    classifier = {'family': 'boosted', 'featureNames': names, 'intercept': float(np.log(priors[1] / priors[0])),
                  'learningRate': model.learning_rate, 'trees': trees}
    idx = np.linspace(0, len(rows)-1, min(32, len(rows)), dtype=int)
    parity = [{'x': x[i].tolist(), 'probability': float(p)} for i, p in
              zip(idx, model.predict_proba(x[idx][:, selected])[:, 1])]
    report = {**report, 'rows': int(train.sum()), 'positives': int(y[train].sum()),
              'byContactType': {'recommend': report['metrics']}, 'runtimeSeconds': time.perf_counter()-started}
    return {'classifier': classifier, 'fields': [names[i] for i in selected], 'markets': markets, 'report': report, 'parity': parity}


arms = ['pooled', 'sku_all', 'statistical', 'ontology'] if job['controls'] else ['ontology']
fits, choices, search = {}, {}, {}
for arm in arms:
    options = recipes if arm in ('ontology', 'statistical') else [recipes[-1]]
    trials = [(r, evaluate(arm, r)) for r in options]
    winner, report = min(trials, key=lambda pair: (pair[1]['metrics']['macroLogLoss'], len(pair[0]['fields']), pair[0]['name']))
    fits[arm] = fit_final(arm, winner, report)
    choices[arm] = ('top_'+str(len(winner['fields'])) if arm == 'statistical' else
                    'all_pooled' if arm == 'pooled' else winner['name'])
    search[arm] = [{'candidate': ('top_'+str(len(r['fields'])) if arm == 'statistical' else
                                 'all_pooled' if arm == 'pooled' else r['name']),
                    'fields': len(names) if arm == 'pooled' else len(r['fields']),
                    'macroLogLoss': h['metrics']['macroLogLoss'], 'auc': h['metrics']['auc']} for r, h in trials]
(root / 'feature-fits.json').write_text(json.dumps({'fits': fits, 'choices': choices, 'search': search}, allow_nan=False))

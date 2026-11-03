"""Local external sanity check. No LLM, network, PayPal or cloud calls."""
import os
os.environ.setdefault("OMP_NUM_THREADS", "2")
import hashlib
import json
from pathlib import Path
import numpy as np
import csv
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import KFold

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/agent-mesh/growth-lab/external"
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / ".local/campaign-research/hillstrom.csv"
EXPECTED_HASH = "0e5893329d8b93cefecc571777672028290ab69865718020c78c7284f291aece"
data_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
assert data_hash == EXPECTED_HASH
numeric = ["recency", "history", "mens", "womens", "newbie"]
categorical = ["history_segment", "zip_code", "channel"]
protocol = {
    "datasetSha256": data_hash, "dataset": "Hillstrom public randomized email challenge,2008",
    "split": "SHA256(hillstrom-v1:row_index),60% train,20% validation,20% final test; no reshuffle",
    "features": numeric + categorical, "outcome": "two-week spend in USD",
    "assignmentProbability": 1/3, "contactBudgetFraction": .25,
    "models": {"nuisance": "HistGradientBoostingRegressor(max_iter80,max_leaf_nodes7,min_samples_leaf100,l2_regularization10,random_state517)",
               "incremental": "two-fold cross-fitted multi-arm DR pseudo-effects, Ridge(alpha10)"},
    "candidateSelection": "Choose response, direct-incremental or DR by validation DR revenue value only, then lock before final test",
    "controlSelection": "Best of fixed random Mens, random Womens or high-history department message selected on validation only",
    "evaluation": "Common train-only nuisance models; known randomization; paired DR policy value minus no email.95% normal-approximation interval conditional on fixed trained policy and target list.",
    "limits": ["Not PayPal data, not actual campaign deployment, no fees or profit inferred", "One historical experiment; no modern-market calibration", "Contact lists are chosen from pretreatment features only; heldout outcomes never select a policy", "Inference does not include uncertainty from retraining or choosing a different dataset"],
}
protocol["hash"] = hashlib.sha256(json.dumps(protocol, sort_keys=True).encode()).hexdigest()
path = OUT / "protocol.json"
if path.exists():
    assert json.loads(path.read_text()) == protocol, "Do not modify protocol after observing test data"
else:
    path.write_text(json.dumps(protocol, indent=2))
if (OUT / "result.json").exists():
    print("External check already complete; saved results retained.")
    raise SystemExit(0)

with SOURCE.open(newline="") as handle:
    records = list(csv.DictReader(handle))
assert len(records) == 64000 and not set(numeric + categorical) & {"segment", "visit", "conversion", "spend"}
arm = np.array([{"No E-Mail": 0, "Mens E-Mail": 1, "Womens E-Mail": 2}[r["segment"]] for r in records])
y = np.array([float(r["spend"]) for r in records])
raw = np.array([[float(r[k]) if k in numeric else r[k] for k in numeric + categorical] for r in records], dtype=object)
history = np.array([float(r["history"]) for r in records])
mens = np.array([int(r["mens"]) for r in records])
womens = np.array([int(r["womens"]) for r in records])
assert np.isfinite(y).all() and (y >= 0).all()
bucket = np.array([int(hashlib.sha256(f"hillstrom-v1:{i}".encode()).hexdigest()[:8], 16) % 1000 for i in range(len(records))])
idx = {"train": np.where(bucket < 600)[0], "validation": np.where((bucket >= 600) & (bucket < 800))[0], "test": np.where(bucket >= 800)[0]}
assert not set(idx["train"]) & set(idx["test"])
assert not set(idx["validation"]) & set(idx["test"])
pre = ColumnTransformer([("num", StandardScaler(), list(range(len(numeric)))), ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), list(range(len(numeric), len(numeric) + len(categorical))))])
train = idx["train"]
X = pre.fit_transform(raw[train])
a, target = arm[train], y[train]

def base_model():
    return HistGradientBoostingRegressor(max_iter=80, max_leaf_nodes=7, min_samples_leaf=100, l2_regularization=10, random_state=517)

def fit_arms(x, actions, outcome):
    return [base_model().fit(x[actions == k], outcome[actions == k]) for k in range(3)]

def predict(models, x):
    return np.column_stack([np.maximum(0, m.predict(x)) for m in models])

oof = np.zeros((len(train), 3))
for fit_ids, held_ids in KFold(2, shuffle=True, random_state=517).split(X):
    oof[held_ids] = predict(fit_arms(X[fit_ids], a[fit_ids], target[fit_ids]), X[held_ids])
phi = oof.copy()
for k in range(3):
    phi[:, k] += 3 * (a == k) * (target - oof[:, k])
effect_models = [Ridge(alpha=10).fit(X, phi[:, k] - phi[:, 0]) for k in [1, 2]]
mu_models = fit_arms(X, a, target)

def policies(ids):
    x = pre.transform(raw[ids])
    mu = predict(mu_models, x)
    effect = np.column_stack([m.predict(x) for m in effect_models])
    n = len(ids)
    budget = int(n * .25)
    random_rank = np.array([int(hashlib.sha256(f"mail-target:{i}".encode()).hexdigest()[:8], 16) for i in ids])
    random_target = np.argsort(random_rank, kind="stable")[:budget]
    hist_target = np.argsort(-history[ids], kind="stable")[:budget]
    out = {"no_email": np.zeros(n, dtype=int)}
    for k, name in [(1, "fixed_mens"), (2, "fixed_womens")]:
        out[name] = np.zeros(n, dtype=int)
        out[name][random_target] = k
    out["history_department"] = np.zeros(n, dtype=int)
    department = np.where(mens[ids] >= womens[ids], 1, 2)
    out["history_department"][hist_target] = department[hist_target]
    for name, scores in [("response", mu[:, 1:]), ("direct_incremental", mu[:, 1:] - mu[:, :1]), ("dr_incremental", effect)]:
        best = scores.argmax(axis=1)
        value = scores[np.arange(n), best]
        chosen = np.argsort(-value, kind="stable")[:budget]
        chosen = chosen[value[chosen] > 0]
        out[name] = np.zeros(n, dtype=int)
        out[name][chosen] = best[chosen] + 1
    return out, mu

def evaluate(ids):
    plans, mu = policies(ids)
    observed_a, observed_y = arm[ids], y[ids]
    baseline = mu[:, 0] + 3 * (observed_a == 0) * (observed_y - mu[:, 0])
    results, vectors = {}, {}
    for name, choice in plans.items():
        selected_mu = mu[np.arange(len(ids)), choice]
        v = selected_mu + 3 * (observed_a == choice) * (observed_y - selected_mu) - baseline
        if name == "no_email":
            assert np.all(v == 0)
        mean, se = float(v.mean()), float(v.std(ddof=1) / np.sqrt(len(v)))
        results[name] = {"incrementalRevenueUSDPerCustomer": mean, "low95": mean - 1.96*se, "high95": mean + 1.96*se, "targeted": int((choice > 0).sum()), "customers": len(ids)}
        vectors[name] = v
    return results, vectors

validation, _ = evaluate(idx["validation"])
selected = max(["response", "direct_incremental", "dr_incremental"], key=lambda k: validation[k]["incrementalRevenueUSDPerCustomer"])
control = max(["fixed_mens", "fixed_womens", "history_department"], key=lambda k: validation[k]["incrementalRevenueUSDPerCustomer"])
(OUT / "selection-before-test.json").write_text(json.dumps({"protocolHash": protocol["hash"], "validation": validation, "selected": selected, "control": control}, indent=2))
test_results, vectors = evaluate(idx["test"])
d = vectors[selected] - vectors[control]
se = float(d.std(ddof=1)/np.sqrt(len(d)))
result = {"protocolHash": protocol["hash"], "scope": "EXTERNAL_RANDOMIZED_EMAIL_BENCHMARK_NOT_PAYPAL_ROI", "splitSizes": {k: len(v) for k, v in idx.items()}, "selected": selected, "bestFixedControl": control, "test": test_results,
          "selectedVsFixed": {"meanUSDPerCustomer": float(d.mean()), "low95": float(d.mean()-1.96*se), "high95": float(d.mean()+1.96*se)}, "llmCalls": 0, "paidCloudUSD": 0, "localCPUUnpriced": True}
(OUT / "result.json").write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))

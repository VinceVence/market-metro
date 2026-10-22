"""Local CPU-only model training. Reads a bounded JSON dataset from stdin; no network."""
import json, sys, time, hashlib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import log_loss, brier_score_loss
from sklearn.pipeline import make_pipeline

started = time.perf_counter()
payload = json.load(sys.stdin)
names = payload["features"]
rows = payload["rows"]
cutoff = int(payload["cutoff"])
seed = int(payload["seed"]) % (2**32)
assert len(rows) <= 120000 and len(names) == 11
assert all(int(r["day"]) < cutoff for r in rows), "Future observations rejected"
X0 = np.asarray([[float(r[k]) for k in names] for r in rows], dtype=float)
a = np.asarray([r["offered_pct"] / 10 for r in rows], dtype=float)
X = np.column_stack([X0, a, X0*a[:, None]])
y = np.asarray([r["purchased"] for r in rows], dtype=int)
days = np.asarray([r["day"] for r in rows], dtype=int)
valid_from = cutoff-7
train = days < valid_from
valid = days >= valid_from
assert np.isfinite(X).all() and set(y).issubset({0, 1})
digest = hashlib.sha256(json.dumps(rows, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
if train.sum() < 300 or valid.sum() < 100 or len(set(y[train])) < 2:
    print(json.dumps({"status":"INSUFFICIENT_DATA","reason":"Need at least 300 historical rows, 100 later validation rows, and both outcomes."}))
    sys.exit(0)

def portable(model):
    if hasattr(model, "named_steps"):
        scaler, clf = model.steps[0][1], model.steps[1][1]
        return {"type":"logistic","coef":clf.coef_[0].tolist(),"intercept":float(clf.intercept_[0]),
                "mean":scaler.mean_.tolist(),"scale":scaler.scale_.tolist()}
    tree = model.tree_
    values = tree.value[:, 0, :]
    probability = (values[:, 1] / values.sum(axis=1)).tolist()
    return {"type":"tree","left":tree.children_left.tolist(),"right":tree.children_right.tolist(),
            "feature":tree.feature.tolist(),"threshold":tree.threshold.tolist(),"probability":probability}

def score_artifact(art, data):
    if art["type"] == "logistic":
        z=(data-np.asarray(art["mean"]))/np.asarray(art["scale"])
        z=z @ np.asarray(art["coef"])+art["intercept"]
        return 1/(1+np.exp(-np.clip(z, -40, 40)))
    out=[]
    for row in data:
        n=0
        while art["left"][n] != -1:
            n=art["left"][n] if row[art["feature"][n]] <= art["threshold"][n] else art["right"][n]
        out.append(art["probability"][n])
    return np.asarray(out)

# A fitted offer-specific constant is a stronger baseline than one global conversion rate.
arm_rates={offer: float((y[train & (a == offer)].sum()+1)/(sum(train & (a == offer))+2)) for offer in [0, .5, 1]}
base=np.asarray([arm_rates[offer] for offer in a[valid]])
baseline_loss=float(log_loss(y[valid], base, labels=[0, 1]))
champion=payload.get("champion")
champion_loss=float(log_loss(y[valid], score_artifact(champion, X[valid]), labels=[0,1])) if champion else None
candidates=[]
models=[
    ("logistic",make_pipeline(StandardScaler(),LogisticRegression(C=.25,max_iter=350,random_state=seed))),
    ("tree",DecisionTreeClassifier(max_depth=5,min_samples_leaf=max(25,int(train.sum()*.012)),random_state=seed))
]
for name, model in models:
    model.fit(X[train], y[train])
    probability=model.predict_proba(X[valid])[:,1]
    candidates.append({"type":name,"log_loss":float(log_loss(y[valid], probability, labels=[0,1])),
                       "brier":float(brier_score_loss(y[valid], probability))})
best_index=min(range(len(candidates)), key=lambda i: candidates[i]["log_loss"])
best=candidates[best_index]
reference=min(baseline_loss, champion_loss if champion_loss is not None else baseline_loss)
promoted=best["log_loss"] < reference-.001
model=models[best_index][1]
# Only after temporal validation, refit the selected candidate on all already-observed days.
model.fit(X,y)
artifact=portable(model)
parity_indices=np.linspace(0,len(X)-1,min(8,len(X)),dtype=int)
assert np.max(np.abs(score_artifact(artifact,X[parity_indices])-model.predict_proba(X[parity_indices])[:,1])) < 1e-10
print(json.dumps({
 "status":"PROMOTED" if promoted else "REJECTED",
 "reason":"Candidate improves later-day log loss by at least 0.001." if promoted else "Candidate did not beat the champion/offer-rate baseline by 0.001; keep the current policy.",
 "model_type":best["type"],"dataset_hash":digest,"training_rows":int(train.sum()),"validation_rows":int(valid.sum()),
 "train_through_day":int(days[train].max()),"validation_from_day":int(days[valid].min()),"validation_through_day":int(days[valid].max()),
 "validation_log_loss":best["log_loss"],"baseline_log_loss":baseline_loss,"champion_log_loss":champion_loss,"brier_score":best["brier"],
 "candidates":candidates,"artifact":artifact,"runtime_ms":round((time.perf_counter()-started)*1000),
 "parity":[{"features":{k:rows[i][k] for k in names},"offer":rows[i]["offered_pct"],"p":float(model.predict_proba(X[[i]])[0,1])} for i in parity_indices]
},allow_nan=False))

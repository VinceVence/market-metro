"""Model action advantage versus the retained incumbent, using training-only
paired simulator experiments. No future-state oracle is available at inference.
"""
import json,time,hashlib
from pathlib import Path
import numpy as np
from sklearn.ensemble import RandomForestRegressor,ExtraTreesRegressor
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error

base=Path('docs/commerce-economy-v5/action-learning-1')
if (base/'models.json').exists():raise RuntimeError('MODELS_ALREADY_EXIST')
t0=time.time();d=json.loads((base/'dataset.json').read_text());rows=d['rows'];X=np.asarray([r['x'] for r in rows]);Y=np.asarray([r['y'] for r in rows]);train=np.asarray([r['split']=='train' for r in rows]);groups=np.asarray([r['episode'] for r in rows])
assert len(X)>1000 and np.isfinite(X).all() and np.isfinite(Y).all()
assert set(groups[train]).isdisjoint(set(groups[~train]))
scales=np.array([100.,1000.]);ys=Y/scales
models={};diagnostics={};parity={}
for name in ['ridge','forest','extra_trees']:
 if name=='ridge':
  scaler=StandardScaler().fit(X[train]);learner=Ridge(alpha=10).fit(scaler.transform(X[train]),ys[train]);pred=learner.predict(scaler.transform(X[~train]))*scales
  artifact={'kind':'linear','mean':scaler.mean_.tolist(),'scale':scaler.scale_.tolist(),'coefficient':learner.coef_.tolist(),'intercept':learner.intercept_.tolist(),'outcomeScale':scales.tolist()}
 else:
  cls=RandomForestRegressor if name=='forest' else ExtraTreesRegressor
  learner=cls(n_estimators=96,max_depth=6,min_samples_leaf=12,max_features=.8,random_state=940001,n_jobs=2).fit(X[train],ys[train]);pred=learner.predict(X[~train])*scales
  artifact={'kind':'forest','trees':[{'feature':e.tree_.feature.tolist(),'threshold':e.tree_.threshold.tolist(),'left':e.tree_.children_left.tolist(),'right':e.tree_.children_right.tolist(),'value':e.tree_.value[:,:,0].tolist()} for e in learner.estimators_],'outcomeScale':scales.tolist()}
 models[name]=artifact;parity[name]=pred[:32].tolist();gate=(pred[:,0]>0)&(pred[:,1]>=0)
 validation=[]
 for seed in sorted(set(groups[~train])):
  k=groups[~train]==seed;actual=Y[~train][k];g=gate[k]
  validation.append({'episode':int(seed),'cases':int(k.sum()),'overrideFraction':float(g.mean()),'meanRealizedAdvantageCents':(g[:,None]*actual).mean(axis=0).tolist()})
 diagnostics[name]={'effectRMSE':np.sqrt(np.mean((pred-Y[~train])**2,axis=0)).tolist(),'overrideFraction':float(gate.mean()),'estimatedPolicyAdvantageCents':(gate[:,None]*Y[~train]).mean(axis=0).tolist(),'episodes':validation}
artifact={'version':'action-advantage-1','featureNames':d['features'],'datasetHash':hashlib.sha256((base/'dataset.json').read_bytes()).hexdigest(),'protocolHash':d['protocolHash'],'trainingMarkets':sorted(map(int,set(groups[train]))),'validationMarkets':sorted(map(int,set(groups[~train]))),'trainingRows':int(train.sum()),'validationRows':int((~train).sum()),'models':models,'runtimeSeconds':time.time()-t0,'scope':'Forecasts of per-customer28-day advantage over one incumbent action, under incumbent continuation. Labels are paired simulated counterfactuals, not real merchant effects. Models use only public observations. Offline random-candidate gating does not prove a deployed ranking policy or the2x target.'}
(base/'models.json').write_text(json.dumps(artifact));(base/'model-validation.json').write_text(json.dumps({'diagnostics':diagnostics,'runtimeSeconds':artifact['runtimeSeconds']},indent=2));(base/'parity.json').write_text(json.dumps({'x':X[~train][:32].tolist(),'predictions':parity}));print(json.dumps({'rows':len(X),'runtime':artifact['runtimeSeconds'],'diagnostics':diagnostics},indent=2))

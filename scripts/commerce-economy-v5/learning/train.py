"""Local response-model experiment; only X features reach the learner.

Randomized timing assignment identifies action value under the trial's randomized
continuation policy. Predictions are estimates, not individual causal facts or
purchase probabilities. Model validation is grouped by complete market episodes.
"""
import json, time, hashlib
from pathlib import Path
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import GroupKFold
from sklearn.metrics import mean_squared_error
import sklearn

base=Path('docs/commerce-economy-v5/learning-1')
if (base/'model.json').exists():raise RuntimeError('MODEL_ALREADY_EXISTS_NO_OVERWRITE')
started=time.time();data=json.loads((base/'dataset.json').read_text());rows=data['rows']
X=np.asarray([r['x'] for r in rows],dtype=np.float64);Y=np.asarray([r['y'] for r in rows],dtype=np.float64)
T=np.asarray([r['assigned'] for r in rows]);G=np.asarray([r['episode'] for r in rows]);mask=np.asarray([r['split']=='train' for r in rows])
assert X.shape[1]==len(data['features']) and np.isfinite(X).all() and np.isfinite(Y).all()
assert set(G[mask]).isdisjoint(set(G[~mask]))
Xtr,Ytr,Ttr,Gtr=X[mask],Y[mask],T[mask],G[mask];Xv,Yv,Tv,Gv=X[~mask],Y[~mask],T[~mask],G[~mask]
# A random potential product has no causal effect in the control condition.
# Its descriptors are omitted from the control nuisance model to reduce noise.
control=[0,1,2,3,4,5,6,7,14,16,17,21]
def forest(seed,trees=48):return RandomForestRegressor(n_estimators=trees,max_depth=7,min_samples_leaf=50,max_features=.8,max_samples=.8,random_state=seed,n_jobs=2)
def export(m):
 return [{'feature':t.tree_.feature.tolist(),'threshold':t.tree_.threshold.tolist(),'left':t.tree_.children_left.tolist(),'right':t.tree_.children_right.tolist(),'value':t.tree_.value[:,0,0].tolist()} for t in m.estimators_]
models=[];diagnostics=[];predictions=[]
for outcome in range(2):
 m0o=np.zeros(len(Xtr));m1o=np.zeros(len(Xtr))
 for fold,(fit,held) in enumerate(GroupKFold(n_splits=3).split(Xtr,groups=Gtr)):
  a=fit[Ttr[fit]==0];b=fit[Ttr[fit]==1]
  m0=forest(101+fold+outcome*10).fit(Xtr[a][:,control],Ytr[a,outcome]);m1=forest(201+fold+outcome*10).fit(Xtr[b],Ytr[b,outcome])
  m0o[held]=m0.predict(Xtr[held][:,control]);m1o[held]=m1.predict(Xtr[held])
 pseudo=m1o-m0o+Ttr*(Ytr[:,outcome]-m1o)/.5-(1-Ttr)*(Ytr[:,outcome]-m0o)/.5
 tau=forest(301+outcome,64).fit(Xtr,pseudo)
 a=Ttr==0;b=Ttr==1;m0=forest(401+outcome,64).fit(Xtr[a][:,control],Ytr[a,outcome]);m1=forest(501+outcome,64).fit(Xtr[b],Ytr[b,outcome])
 pred=tau.predict(Xv);predictions.append(pred);models.append({'target':['platformDeltaCents','retailerDeltaCents'][outcome],'forest':export(tau)})
 pred_actual=np.where(Tv==1,m1.predict(Xv),m0.predict(Xv[:,control]))
 diagnostics.append({'outcome':outcome,'factualRMSE':float(np.sqrt(mean_squared_error(Yv[:,outcome],pred_actual))),'meanPredictedEffectCents':float(pred.mean()),'featureImportance':dict(zip(data['features'],map(float,tau.feature_importances_)))})
predictions=np.array(predictions).T;gate=(predictions[:,0]>0)&(predictions[:,1]>=0)
ips=Tv[:,None]*Yv/.5-(1-Tv[:,None])*Yv/.5
values=[]
for episode in sorted(set(Gv)):
 k=Gv==episode;values.append({'episode':int(episode),'opportunities':int(k.sum()),'sendFraction':float(gate[k].mean()),'alwaysSendAdvantageCents':ips[k].mean(axis=0).tolist(),'estimatedGatedAdvantageCents':(gate[k,None]*ips[k]).mean(axis=0).tolist()})
artifact={'version':'response-dr-1','featureNames':data['features'],'trainingProtocolHash':data['protocolHash'],'datasetHash':hashlib.sha256((base/'dataset.json').read_bytes()).hexdigest(),'trainingEpisodes':sorted(map(int,set(Gtr))),'validationEpisodes':sorted(map(int,set(Gv))),'trainingRows':len(Xtr),'validationRows':len(Xv),'models':models,'estimand':'14-day retained retail contribution advantage of recommending now versus deferring under the randomized continuation policy; not the effect of never advertising. Only observed features; no private traits or counterfactual oracle labels.','sklearnVersion':sklearn.__version__,'runtimeSeconds':time.time()-started}
(base/'model.json').write_text(json.dumps(artifact))
(base/'model-validation.json').write_text(json.dumps({'diagnostics':diagnostics,'episodes':values,'scope':'Offline randomized-candidate gating diagnostic only. It does not validate selection of the best product from all products, total market profit, or the2x goal. A paired policy rollout is required.','runtimeSeconds':artifact['runtimeSeconds']},indent=2))
# Public numerical parity fixture verifies the portable evaluator, never supplied
# to a policy as future labels.
(base/'parity.json').write_text(json.dumps({'x':Xv[:32].tolist(),'predictions':predictions[:32].tolist()}))
print(json.dumps({'trainingRows':len(Xtr),'validationRows':len(Xv),'runtimeSeconds':artifact['runtimeSeconds'],'episodeDiagnostics':values},indent=2))

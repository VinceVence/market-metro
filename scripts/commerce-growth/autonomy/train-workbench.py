"""Actual CPU model fitting chosen by application agents; no private predictors.

Whole source markets (including both collection policies) stay in one fold.
Response hurdle uses observed response, never immediate funding as a required
step: some observed requests become funded later and still retain a purchase.
"""
import json, sys, time, hashlib
from pathlib import Path
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss, brier_score_loss, roc_auc_score, average_precision_score

root=Path(sys.argv[1]); data=json.loads((root/'dataset.json').read_text()); spec=json.loads((root/'spec.json').read_text())
names=data['featureNames']; rows=data['rows']; family=spec['family']
assert family in ['forest','logistic','response_hurdle','boosted']
x=np.asarray([r['x'] for r in rows],dtype=float); y=np.asarray([r['retained'] for r in rows],dtype=int)
responded=np.asarray([r['responded'] for r in rows],dtype=int); groups=np.asarray([r['episode'] for r in rows])
assert len(set(groups))>=3 and len(rows)>=500 and np.isfinite(x).all() and np.all(y<=responded)
assert len(set(y))==2 and len(set(responded))==2
net=np.asarray([r['retailNetCents']+r['merchantOrderContributionCents'] for r in rows],dtype=float)
payment=np.asarray([r['retailNetCents'] for r in rows],dtype=float); started=time.perf_counter()

def forest(): return RandomForestClassifier(n_estimators=80,max_depth=5,min_samples_leaf=20,max_features=None,random_state=17,n_jobs=1)
def fit(indices):
 if family=='response_hurdle':
  a=forest().fit(x[indices],responded[indices]); positive=indices[responded[indices]==1]
  b=forest().fit(x[positive],y[positive]); return a,b
 if family=='logistic': return make_pipeline(StandardScaler(),LogisticRegression(C=.5,max_iter=400)).fit(x[indices],y[indices])
 if family=='boosted': return GradientBoostingClassifier(n_estimators=120,learning_rate=.05,max_depth=2,min_samples_leaf=30,subsample=.9,random_state=17).fit(x[indices],y[indices])
 return forest().fit(x[indices],y[indices])
def predict(m,xx):
 return m[0].predict_proba(xx)[:,1]*m[1].predict_proba(xx)[:,1] if family=='response_hurdle' else m.predict_proba(xx)[:,1]
def score(yy,p):
 return {'logLoss':float(log_loss(yy,p,labels=[0,1])),'brier':float(brier_score_loss(yy,p)), 'auc':float(roc_auc_score(yy,p)) if len(set(yy))==2 else None,'averagePrecision':float(average_precision_score(yy,p)) if np.any(yy) else None}
def coarse(train,test):
 buckets={}
 for i in train:
  key=rows[i]['kind']+'|'+rows[i]['observedBucket'].split('|')[2]
  n,k=buckets.get(key,(0,0)); buckets[key]=n+1,k+y[i]
 return np.asarray([(buckets.get(rows[i]['kind']+'|'+rows[i]['observedBucket'].split('|')[2],(0,0))[1]+.5)/(buckets.get(rows[i]['kind']+'|'+rows[i]['observedBucket'].split('|')[2],(0,0))[0]+2) for i in test])

out=np.zeros(len(rows)); simple=np.zeros(len(rows)); folds=[]
for group in sorted(set(groups)):
 train=np.flatnonzero(groups!=group); test=np.flatnonzero(groups==group); model=fit(train)
 out[test]=predict(model,x[test]); simple[test]=coarse(train,test)
 folds.append({'market':int(group),'rows':len(test),'metrics':score(y[test],out[test]),'coarse':score(y[test],simple[test])})
model=fit(np.arange(len(rows)))
def export(estimator,kind='forest'):
 result={'family':kind,'featureNames':names}
 if kind=='logistic':
  result.update(mean=estimator[0].mean_.tolist(),scale=estimator[0].scale_.tolist(),coefficients=estimator[1].coef_[0].tolist(),intercept=float(estimator[1].intercept_[0])); return result
 if kind=='boosted':
  prior=estimator.init_.class_prior_; trees=[]
  for tree in estimator.estimators_.ravel():
   t=tree.tree_; trees.append({'feature':t.feature.tolist(),'threshold':t.threshold.tolist(),'left':t.children_left.tolist(),'right':t.children_right.tolist(),'value':t.value[:,0,0].tolist()})
  result.update(intercept=float(np.log(prior[1]/prior[0])),learningRate=estimator.learning_rate,trees=trees); return result
 trees=[]
 for tree in estimator.estimators_:
  t=tree.tree_; counts=t.value[:,0,:]; p=counts[:,1]/counts.sum(axis=1)
  trees.append({'feature':t.feature.tolist(),'threshold':t.threshold.tolist(),'left':t.children_left.tolist(),'right':t.children_right.tolist(),'probability':p.tolist()})
 result.update(trees=trees,importance=dict(zip(names,map(float,estimator.feature_importances_)))); return result
classifier={'family':family,'featureNames':names,'response':export(model[0]),'retainedGivenResponse':export(model[1])} if family=='response_hurdle' else export(model,family)
values={}; payment_values={}
for kind in ['recommend','ask_need']:
 for dest,target in [(values,net),(payment_values,payment)]:
  positive=[i for i,r in enumerate(rows) if r['kind']==kind and r['retained']]; negative=[i for i,r in enumerate(rows) if r['kind']==kind and not r['retained']]
  dest[kind]={'retainedNetCents':float(np.mean(target[positive])) if positive else 0,'failedNetCents':float(np.mean(target[negative])) if negative else -5}
value_model=RandomForestRegressor(n_estimators=60,max_depth=4,min_samples_leaf=12,max_features=None,random_state=47,n_jobs=1).fit(x[y==1],net[y==1]); trees=[]
for tree in value_model.estimators_:
 t=tree.tree_; trees.append({'feature':t.feature.tolist(),'threshold':t.threshold.tolist(),'left':t.children_left.tolist(),'right':t.children_right.tolist(),'value':t.value[:,0,0].tolist()})
artifact={'version':'commerce-workbench-model-1','featureNames':names,'trainingRows':len(rows),'trainingEpisodes':sorted(map(int,set(groups))),'selected':family,'models':{family:classifier},'valueModel':None,'valueMeans':payment_values,
 'sharedValueMeans':values,'sharedValueModel':{'featureNames':names,'trees':trees},'spec':spec,'datasetHash':hashlib.sha256((root/'dataset.json').read_bytes()).hexdigest()}
indices=np.linspace(0,len(rows)-1,min(32,len(rows)),dtype=int); parity=[]
for i,p,v in zip(indices,predict(model,x[indices]),value_model.predict(x[indices])):
 kind=rows[i]['kind']; parity.append({'x':x[i].tolist(),'expected':float(p),'kind':kind,'expectedSharedNetCents':float(p*v+(1-p)*values[kind]['failedNetCents'])})
report={'status':'COMPLETED','spec':spec,'rows':len(rows),'positives':int(y.sum()),'wholeMarketFolds':folds,'metrics':score(y,out),'coarse':score(y,simple),
 'byContactType':{kind:score(y[[i for i,r in enumerate(rows) if r['kind']==kind]],out[[i for i,r in enumerate(rows) if r['kind']==kind]]) for kind in ['recommend','ask_need']},
 'runtimeSeconds':time.perf_counter()-started,'scope':'Leave-one-source-market-out validation. Both collection policies share the same held-out source market. This chooses models, not evidence of campaign profit.'}
report['metrics']['macroMarketAUC']=float(np.mean([f['metrics']['auc'] for f in folds if f['metrics']['auc'] is not None]))
for name,value in [('models.json',artifact),('report.json',report),('parity.json',parity)]: (root/name).write_text(json.dumps(value,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['status','spec','rows','metrics','coarse','runtimeSeconds']}))

"""Cheap local model tool. Whole-market validation; no private simulator inputs."""
import hashlib,json,time,sys
from pathlib import Path
import numpy as np
from sklearn.ensemble import RandomForestClassifier,RandomForestRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import log_loss,brier_score_loss,roc_auc_score,average_precision_score

root=Path(sys.argv[1]) if len(sys.argv)>1 else Path('docs/commerce-growth/autonomy-1/training')
shared_value='--shared-value' in sys.argv
value_aware='--value-aware' in sys.argv or shared_value
progress=json.loads((root/'progress.json').read_text())
assert progress['status']=='COMPLETED','Training collection is incomplete'
data=json.loads((root/'dataset.json').read_text());rows=data['rows'];names=data['featureNames']
x=np.asarray([r['x'] for r in rows],dtype=float);y=np.asarray([r['retained'] for r in rows]);groups=np.asarray([r['episode'] for r in rows])
payment_net=np.asarray([r['retailNetCents'] for r in rows],dtype=float)
net=payment_net+np.asarray([r['merchantOrderContributionCents'] for r in rows],dtype=float) if shared_value else payment_net
assert x.shape[1]==len(names) and np.isfinite(x).all() and set(y)=={0,1}
started=time.perf_counter()
def model(family):
 return make_pipeline(StandardScaler(),LogisticRegression(C=.5,max_iter=400)) if family=='logistic' else RandomForestClassifier(n_estimators=80,max_depth=5,min_samples_leaf=20,max_features=None,random_state=17,n_jobs=1)
def score(a,p):
 return {'logLoss':float(log_loss(a,p,labels=[0,1])),'brier':float(brier_score_loss(a,p)),
  'auc':float(roc_auc_score(a,p)) if len(set(a))==2 else None,
  'averagePrecision':float(average_precision_score(a,p)) if np.any(a) else None}
def coarse(train,test):
 groups={}
 for i in train:
  key=(rows[i]['kind'],'fresh' if x[i,0]<=2 else 'recent' if x[i,0]<=7 else 'cold')
  count,positive=groups.get(key,(0,0));groups[key]=(count+1,positive+int(y[i]))
 return np.asarray([(groups.get((rows[i]['kind'],'fresh' if x[i,0]<=2 else 'recent' if x[i,0]<=7 else 'cold'),(0,0))[1]+.5)/(groups.get((rows[i]['kind'],'fresh' if x[i,0]<=2 else 'recent' if x[i,0]<=7 else 'cold'),(0,0))[0]+2) for i in test])
def means(indices,values=None):
 if values is None:values=net
 result={}
 for kind in ['recommend','ask_need']:
  subset=[i for i in indices if rows[i]['kind']==kind];yes=[i for i in subset if y[i]];no=[i for i in subset if not y[i]]
  result[kind]={'retainedNetCents':float(np.mean(values[yes])) if yes else 0,'failedNetCents':float(np.mean(values[no])) if no else -5}
 return result
def value_model(indices):
 positive=indices[y[indices]==1]
 estimator=RandomForestRegressor(n_estimators=60,max_depth=4,min_samples_leaf=12,max_features=None,random_state=47,n_jobs=1)
 estimator.fit(x[positive],net[positive]);return estimator
def rmse(a,b):return float(np.sqrt(np.mean((a-b)**2)))
predictions={k:np.zeros(len(rows)) for k in ['coarse','logistic','forest']};folds=[]
value_predictions={k:np.zeros(len(rows)) for k in predictions};proxy_predictions={k:np.zeros(len(rows)) for k in predictions}
for episode in sorted(set(groups)):
 train=np.flatnonzero(groups!=episode);test=np.flatnonzero(groups==episode);fold={'episode':int(episode),'rows':len(test),'metrics':{}}
 observed=means(train);success_proxy=np.asarray([observed[rows[i]['kind']]['retainedNetCents'] for i in test]);failure=np.asarray([observed[rows[i]['kind']]['failedNetCents'] for i in test]);success=value_model(train).predict(x[test]) if value_aware else success_proxy
 for family in predictions:
  if family=='coarse':p=coarse(train,test)
  else:
   fitted=model(family);fitted.fit(x[train],y[train]);p=fitted.predict_proba(x[test])[:,1]
  predictions[family][test]=p;fold['metrics'][family]=score(y[test],p)
  value_predictions[family][test]=p*success+(1-p)*failure;proxy_predictions[family][test]=p*success_proxy+(1-p)*failure
  if value_aware:fold['metrics'][family].update(valueRMSECents=rmse(net[test],value_predictions[family][test]),pooledValueRMSECents=rmse(net[test],proxy_predictions[family][test]))
 folds.append(fold)
summary={k:score(y,p) for k,p in predictions.items()}
if value_aware:
 for k in predictions:summary[k].update(valueRMSECents=rmse(net,value_predictions[k]),pooledValueRMSECents=rmse(net,proxy_predictions[k]))
selected=min(['logistic','forest'],key=lambda k:summary[k]['valueRMSECents' if value_aware else 'logLoss'])
models={};parity=[]
for family in ['logistic','forest']:
 fitted=model(family);fitted.fit(x,y);out={'family':family,'featureNames':names}
 if family=='logistic':
  scaler=fitted[0];classifier=fitted[1];out.update(mean=scaler.mean_.tolist(),scale=scaler.scale_.tolist(),coefficients=classifier.coef_[0].tolist(),intercept=float(classifier.intercept_[0]))
 else:
  trees=[]
  for tree in fitted.estimators_:
   t=tree.tree_;counts=t.value[:,0,:];probability=counts[:,1]/counts.sum(axis=1)
   trees.append({'feature':t.feature.tolist(),'threshold':t.threshold.tolist(),'left':t.children_left.tolist(),'right':t.children_right.tolist(),'probability':probability.tolist()})
  out['trees']=trees;out['importance']=dict(zip(names,map(float,fitted.feature_importances_)))
 models[family]=out
 for i,p in zip(np.linspace(0,len(rows)-1,min(64,len(rows)),dtype=int),fitted.predict_proba(x[np.linspace(0,len(rows)-1,min(64,len(rows)),dtype=int)])[:,1]):parity.append({'family':family,'x':x[i].tolist(),'expected':float(p)})
value_means=means(np.arange(len(rows)));value_artifact=None
if value_aware:
 fitted_value=value_model(np.arange(len(rows)));trees=[]
 for estimator in fitted_value.estimators_:
  t=estimator.tree_;trees.append({'feature':t.feature.tolist(),'threshold':t.threshold.tolist(),'left':t.children_left.tolist(),'right':t.children_right.tolist(),'value':t.value[:,0,0].tolist()})
 value_artifact={'type':'conditional_retained_shared_contribution' if shared_value else 'conditional_retained_payment_value','featureNames':names,'trees':trees,'importance':dict(zip(names,map(float,fitted_value.feature_importances_))),'target':'Observed payment plus retailer order contribution, conditional on a retained purchase.' if shared_value else 'Observed retail payment net after processing and outreach, conditional on a retained purchase.'}
 for row in parity:
  amount=float(fitted_value.predict(np.asarray([row['x']]))[0]);kind='recommend' if row['x'][names.index('is_recommendation')]>0 else 'ask_need'
  row.update(kind=kind);row['expectedSharedNetCents' if shared_value else 'expectedNetCents']=row['expected']*amount+(1-row['expected'])*value_means[kind]['failedNetCents']
artifact={'version':'observed-shared-contribution-1' if shared_value else 'observed-intent-value-2' if value_aware else 'observed-intent-response-1','featureNames':names,'trainingEpisodes':sorted(map(int,set(groups))),
 'trainingRows':len(rows),'selected':selected,'models':models,'datasetHash':hashlib.sha256((root/'dataset.json').read_bytes()).hexdigest(),
 'valueMeans':means(np.arange(len(rows)),payment_net) if shared_value else value_means,'valueModel':None if shared_value else value_artifact,
 **({'sharedValueMeans':value_means,'sharedValueModel':value_artifact,'sharedValueScope':'Observed payment net plus retailer order contribution after goods, delivery and fee/refund costs. Excludes inventory holding, supplier contribution and displaced future purchases.'} if shared_value else {}),
 'scope':'Observed conditional retained-purchase probability. Not causal uplift, guaranteed conversion or a held-out commerce-profit result.'}
report={'status':'COMPLETED','valueAware':value_aware,'valueTarget':'payment_plus_retailer_order_contribution' if shared_value else 'retail_payment_net','trainingRows':len(rows),'positiveRows':int(y.sum()),'wholeMarketFolds':folds,'summary':summary,'selected':selected,
 'beatsCoarseLogLoss':summary[selected]['logLoss']<summary['coarse']['logLoss'],'modelCalls':0,'nativePayments':0,'modelCostUSD':0,'runtimeSeconds':time.perf_counter()-started,
 'scope':'Leave-one-development-market-out model validation. Test folds select a model family and are not final unseen commerce evaluation. No buyer/merchant IDs, regime labels, seeds, hidden needs or future outcomes are features.'}
for name,value in [('models.json',artifact),('model-report.json',report),('parity.json',parity)]:
 (root/name).write_text(json.dumps(value,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['status','trainingRows','positiveRows','summary','selected','beatsCoarseLogLoss','runtimeSeconds']},indent=2))

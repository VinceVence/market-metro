"""Can day30 evidence predict which campaign strategy improves contribution?
Leave an entire paired economy out; never split shoppers from one economy
between fitting and prediction. Hindsight outcome selection is not deployment.
"""
import json,time
from pathlib import Path
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

base=Path('docs/commerce-economy-v5/expert-headroom-1')
if (base/'router-predictions.json').exists():raise RuntimeError('ROUTER_PREDICTIONS_EXIST')
data=json.loads((base/'router-data.json').read_text());rows=data['rows'];X=np.array([r['x'] for r in rows]);Y=np.array([r['outcomes'] for r in rows]);groups=np.array([r['episode'] for r in rows]);scales=np.array([100,1000]);experts=data['experts'];start=time.time();out={};diagnostics={}
for name in ['ridge','forest']:
 pred=np.zeros_like(Y,dtype=float)
 for episode in sorted(set(groups)):
  tr=groups!=episode;va=~tr
  assert set(groups[tr]).isdisjoint(set(groups[va]))
  if name=='ridge':
   scaler=StandardScaler().fit(X[tr]);learner=Ridge(alpha=100).fit(scaler.transform(X[tr]),(Y[tr]/scales).reshape(tr.sum(),-1));y=learner.predict(scaler.transform(X[va]))
  else:
   learner=RandomForestRegressor(n_estimators=128,max_depth=4,min_samples_leaf=40,max_features=.8,random_state=78104,n_jobs=2).fit(X[tr],(Y[tr]/scales).reshape(tr.sum(),-1));y=learner.predict(X[va])
  pred[va]=y.reshape(va.sum(),len(experts),2)*scales
 selection=[];realized=[]
 for i,r in enumerate(rows):
  legal=np.where((pred[i,:,0]>10)&(pred[i,:,1]>=0))[0]
  j=int(legal[np.argmax(pred[i,legal,0])]) if len(legal) else 0
  selection.append({'episode':r['episode'],'index':r['index'],'expert':experts[j],'estimatedAdvantageCents':pred[i,j].tolist()});realized.append(Y[i,j])
 out[name]=selection;diagnostics[name]={'estimatedPolicyAdvantageCents':np.mean(realized,axis=0).tolist(),'overrideFraction':float(np.mean([r['expert']!='incumbent' for r in selection])),'effectRMSECents':np.sqrt(np.mean((pred-Y)**2,axis=(0,1))).tolist()}
(base/'router-predictions.json').write_text(json.dumps({'models':out,'diagnostics':diagnostics,'runtimeSeconds':time.time()-start,'scope':'Development learnability diagnostic with whole-market cross-fitting.'}));print(json.dumps(diagnostics,indent=2))

"""Predict intervention value, not purchases that may happen without outreach.
All source-market actions stay together in each cross-validation fold.
"""
import json,sys
from pathlib import Path
import numpy as np
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
from sklearn.tree import DecisionTreeRegressor
root=Path(sys.argv[1]); rows=json.loads((root/'dataset.json').read_text())['rows']; names=rows[0]['features']['featureNames']
actions=list(dict.fromkeys(r['result']['action'] for r in rows)); markets=list(dict.fromkeys(r['market'] for r in rows)); index={(r['market'],r['result']['action']):r for r in rows}
def vector(r):
 x=r['features']['x']; v=r['features']['values']; n=np.expm1(v['contacts_log'])
 return x+[float(round(v['response_rate']*(n+4)-1)),float(round(v['authorization_rate']*(n+4)-1))]
names=names+['observed_response_count','observed_authorization_count'];x=np.asarray([vector(index[(m,actions[0])]) for m in markets]);
y={a:np.asarray([[index[(m,a)]['target']['platformDeltaUSD'],index[(m,a)]['target']['retailerDeltaUSD']] for m in markets]) for a in actions}
def fit(train,family,parameter):
 return {a:(make_pipeline(StandardScaler(),Ridge(alpha=parameter)) if family=='ridge' else DecisionTreeRegressor(max_depth=parameter,min_samples_leaf=1,random_state=7)).fit(x[train],y[a][train]) for a in actions if a!='continue_numerical'}
def choose(pred):
 eligible=[a for a,p in pred.items() if p[0]>0 and p[1]>=-1e-7]
 return max(eligible,key=lambda a:pred[a][0]) if eligible else 'continue_numerical'
def export(model,family):
 if family=='ridge':return {'type':'ridge','mean':model[0].mean_.tolist(),'scale':model[0].scale_.tolist(),'coefficients':model[1].coef_.tolist(),'intercept':model[1].intercept_.tolist()}
 t=model.tree_;return {'type':'tree','feature':t.feature.tolist(),'threshold':t.threshold.tolist(),'left':t.children_left.tolist(),'right':t.children_right.tolist(),'value':t.value[:,:,0].tolist()}
reports=[]
for family,parameters in [('ridge',[1,10,100]),('tree',[1,2,3])]:
 for parameter in parameters:
  outcomes=[]
  for i,m in enumerate(markets):
   trained=fit(np.asarray([j for j in range(len(markets)) if j!=i]),family,parameter);pred={a:trained[a].predict(x[i:i+1])[0] for a in trained};action=choose(pred);target=index[(m,action)]['target'];outcomes.append({'market':m,'action':action,**target})
  full=fit(np.arange(len(markets)),family,parameter);model={'version':'paired-policy-value-1','family':family,'parameter':parameter,'featureNames':names,'trainingMarkets':markets,'heads':{a:export(m,family) for a,m in full.items()},'scope':'Observed day45 context -> paired full-horizon intervention advantage versus continuing the existing numerical policy.'}
  rid=family+'-'+str(parameter);(root/(rid+'-model.json')).write_text(json.dumps(model,indent=2)+'\n')
  (root/(rid+'-parity.json')).write_text(json.dumps([{'market':int(markets[i]),'predictions':{a:list(map(float,m.predict(x[i:i+1])[0])) for a,m in full.items()}} for i in range(len(markets))],indent=2)+'\n')
  reports.append({'id':rid,'meanNetGainUSD':float(np.mean([o['platformDeltaUSD'] for o in outcomes])),'meanRetailerGainUSD':float(np.mean([o['retailerDeltaUSD'] for o in outcomes])),'meanPurchaseGain':float(np.mean([o['purchaseDelta'] for o in outcomes])),'decisions':outcomes})
oracle=[]
for m in markets:
 valid=[r for r in rows if r['market']==m and r['target']['retailerDeltaUSD']>=0 and r['result']['unpaidLiabilities']==0];oracle.append(max(valid,key=lambda r:r['target']['platformDeltaUSD']))
result={'status':'COMPLETED','markets':len(markets),'rows':len(rows),'leaveOneMarketOut':reports,'oracleTrainingCeilingUSD':float(np.mean([r['target']['platformDeltaUSD'] for r in oracle])),'scope':'Development cross-validation, not fresh confirmation or application-agent performance. Oracle ceiling uses training labels and is evaluator-only.'}
(root/'model-report.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'status':'COMPLETED','ceiling':result['oracleTrainingCeilingUSD'],'models':[{k:r[k] for k in ['id','meanNetGainUSD','meanRetailerGainUSD','meanPurchaseGain']} for r in reports]},indent=2))

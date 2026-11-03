"""A bounded local constrained-EI probe selector, not a safety certificate.
Separate GP marginals approximate financial constraints as conditionally
independent for acquisition. Exact simulation still decides feasibility.
This is not Letham et al.'s noisy-EI implementation or an ROI guarantee.
"""
import json,sys,time,warnings
from pathlib import Path
import numpy as np
from scipy.special import ndtr
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import Matern,ConstantKernel

start=time.time();data=json.loads(Path(sys.argv[1]).read_text());history=data['history'];candidates=data['candidates'];ref=data['reference'];categories=['Stationery','Electronics','Furniture','Office bundles']
def features(c):
 q=c.get('quotePlan');b=c['business'];rails={'bank':0,'auto':.5,'paypal':1}
 return [int(q is not None),*[(q['byCategory'][k]-.75)/.5 if q else .5 for k in categories],*[(v+5)/10 for v in (q['merchantAdjustPct'] if q else [0,0,0])],rails[b['economics']['merchantRail']],rails[b['economics']['supplierRail']],*[v/28 for v in b['demand']['stockDays']],int(c.get('expert')=='adjacent_bundle'),int(b['demand']['useLostDemand']),c.get('cashSchedule',{}).get('day',0)/100]
keys=['platformUSD','retailerUSD','wholesalerUSD','manufacturerUSD','terminalCashUSD','terminalInventoryUSD']
X=np.asarray([features(r['config']) for r in history]);Z=np.asarray([features(c) for c in candidates]);Y=np.asarray([[r['mean'][k] for k in keys] for r in history]);assert np.isfinite(X).all() and np.isfinite(Z).all() and X.shape[1]==16
kernel=ConstantKernel(1,(.1,10))*Matern(length_scale=np.ones(X.shape[1]),length_scale_bounds=(.15,4),nu=2.5)
with warnings.catch_warnings(record=True) as caught:
 model=GaussianProcessRegressor(kernel=kernel,alpha=.01,normalize_y=True,random_state=77291,n_restarts_optimizer=0).fit(X,Y)
 mu,sigma=model.predict(Z,return_std=True)
sigma=np.maximum(sigma,1e-6)
def feasible(r):
 m=r['mean'];return all(m[k]>=ref[k]-1e-8 for k in keys[1:5]) and m['terminalInventoryUSD']<=ref['terminalInventoryUSD']*1.1+1e-8
best=max(r['mean']['platformUSD'] for r in history if feasible(r));delta=mu[:,0]-best;z=delta/sigma[:,0];ei=delta*ndtr(z)+sigma[:,0]*np.exp(-.5*z*z)/np.sqrt(2*np.pi)
prob=np.ones(len(candidates))
for j,k in enumerate(keys[1:5],1):prob*=ndtr((mu[:,j]-ref[k])/sigma[:,j])
prob*=ndtr((ref['terminalInventoryUSD']*1.1-mu[:,5])/sigma[:,5])
acquisition=ei*prob
if not np.isfinite(acquisition).all():raise RuntimeError('NONFINITE_ACQUISITION')
selected=int(np.argmax(acquisition));output={'selected':selected,'method':'GP constrained expected improvement','featureCount':X.shape[1],'trainingCandidates':len(X),'candidatePool':len(Z),'bestObservedFeasibleUSD':best,'predictedMetrics':dict(zip(keys,map(float,mu[selected]))),'predictedStd':dict(zip(keys,map(float,sigma[selected]))),'heuristicFeasibilityScore':float(prob[selected]),'acquisition':float(acquisition[selected]),'kernel':str(model.kernel_),'warnings':[str(w.message) for w in caught],'runtimeSeconds':time.time()-start,'limits':'Acquisition uses approximate marginal independence and regularized GP uncertainty. It does not establish calibrated financial safety or held-out gain; exact trial gates remain mandatory.'}
Path(sys.argv[2]).write_text(json.dumps(output,indent=2)+'\n');print(json.dumps({'selected':selected,'runtimeSeconds':output['runtimeSeconds'],'acquisition':output['acquisition']}))

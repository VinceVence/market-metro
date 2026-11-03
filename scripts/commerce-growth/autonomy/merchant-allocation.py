"""Secondary allocation over identical customer baskets. No economic state access."""
import json,sys,time
import numpy as np
from scipy.optimize import milp,Bounds,LinearConstraint
from scipy.sparse import coo_matrix

for line in sys.stdin:
 started=time.perf_counter()
 try:
  job=json.loads(line);quotes=job['quotes'];n=len(quotes);requests=list(dict.fromkeys(q['requestId'] for q in quotes));products=list(job['stock']);merchants=list(job['anchors'])
  floors=job.get('minimumByMerchant') or {};floor_names=['floor:'+m for m in floors]
  names=requests+products+['aggregate']+merchants+floor_names;index={k:i for i,k in enumerate(names)};rr=[];cc=[];vv=[]
  lower=np.asarray([1.]*len(requests)+[0.]*len(products)+[job['minimumAggregate']]+[-job['past'][m] for m in merchants]+list(floors.values()))
  upper=np.asarray([1.]*len(requests)+[job['stock'][p] for p in products]+[np.inf]*(1+len(merchants)+len(floors)))
  for j,q in enumerate(quotes):
   rr.append(index[q['requestId']]);cc.append(j);vv.append(1.)
   for p,k in q['quantities'].items():rr.append(index[p]);cc.append(j);vv.append(k)
   rr.append(index['aggregate']);cc.append(j);vv.append(sum(q['merchant'].values()))
   for m,v in q['merchant'].items():rr.append(index[m]);cc.append(j);vv.append(v)
   for m,v in q['merchant'].items():
    if m in floors:rr.append(index['floor:'+m]);cc.append(j);vv.append(v)
  for m in merchants:rr.append(index[m]);cc.append(n);vv.append(-job['anchors'][m])
  matrix=coo_matrix((np.asarray(vv,dtype=float),(np.asarray(rr,dtype=np.int32),np.asarray(cc,dtype=np.int32))),shape=(len(names),n+1)).tocsc()
  objective=np.zeros(n+1)
  if floors:objective[:n]=-np.asarray([sum(q['merchant'].values()) for q in quotes])
  else:objective[-1]=-1
  solution=milp(c=objective,integrality=np.asarray([1]*n+[0]),bounds=Bounds(np.asarray([0.]*n+[-1e6]),np.asarray([1.]*n+[1e6])),constraints=LinearConstraint(matrix,lower,upper),options={'time_limit':2.,'mip_rel_gap':.001})
  result={'id':job['id'],'selected':[] if solution.x is None else np.flatnonzero(solution.x[:n]>.5).tolist(),'status':int(solution.status),'gap':None if solution.x is None else float(solution.mip_gap),'runtimeSeconds':time.perf_counter()-started}
  print(json.dumps(result),flush=True)
 except Exception as e:print(json.dumps({'id':job.get('id') if 'job' in locals() else None,'error':str(e)}),flush=True)

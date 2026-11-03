"""Persistent numerical worker: exact set packing over the shared bounded
basket list. It never reads simulator files, seeds or future buyer outcomes.
"""
import json,sys,time
import numpy as np
from scipy.optimize import milp,Bounds,LinearConstraint
from scipy.sparse import coo_matrix

for line in sys.stdin:
 start=time.time()
 try:
  job=json.loads(line);quotes=job['quotes'];stock=job['stock'];requests=list(dict.fromkeys(q['requestId'] for q in quotes));products=list(stock);names=requests+products;index={k:i for i,k in enumerate(names)};n=len(quotes)
  if not n:result={'selected':[],'status':0,'gap':0}
  else:
   row=[];col=[];values=[]
   for j,q in enumerate(quotes):
    row.append(index[q['requestId']]);col.append(j);values.append(1)
    for p,k in q['quantities'].items():row.append(index[p]);col.append(j);values.append(k)
   matrix=coo_matrix((np.asarray(values,dtype=float),(np.asarray(row,dtype=np.int32),np.asarray(col,dtype=np.int32))),shape=(len(names),n)).tocsc()
   result0=milp(c=-np.asarray([q['value'] for q in quotes]),integrality=np.ones(n),bounds=Bounds(np.zeros(n),np.ones(n)),constraints=LinearConstraint(matrix,np.zeros(len(names)),np.asarray([1]*len(requests)+[stock[p] for p in products])),options={'time_limit':2.,'mip_rel_gap':.001})
   result={'selected':[] if result0.x is None else np.flatnonzero(result0.x>.5).tolist(),'status':int(result0.status),'gap':None if result0.x is None else float(result0.mip_gap)}
  result.update(id=job['id'],runtimeSeconds=time.time()-start);print(json.dumps(result),flush=True)
 except Exception as e:print(json.dumps({'id':job.get('id') if 'job' in locals() else None,'error':str(e)}),flush=True)

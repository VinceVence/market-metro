"""Looser retailer-aggregate version; no individual-store profit floors.
Retains the individual-store result separately rather than redefining the goal.
"""
import json,sys,time
from pathlib import Path
from fractions import Fraction as F
import numpy as np
from scipy.optimize import linprog
from scipy.sparse import vstack,coo_matrix
sys.path.insert(0,str(Path(__file__).parent))
from solve import build,dynamic_bounds,SCALE

root=Path('docs/commerce-growth/envelope-1');out=root/'aggregate';out.mkdir(exist_ok=False);data=json.loads((root/'inputs.json').read_text());start=time.perf_counter()
choices,rewards,buyers,cuts,constant,matrix,rhs,offset,beta=build(data)
assert all(c['kind']=='merchant_floor' for c in cuts[-3:])
terms={j:-sum(c['merchantProfitCents']) for j,c in enumerate(choices) if sum(c['merchantProfitCents'])}
floor=sum(c['bound'] for c in cuts[-3:]);cuts=cuts[:-3]+[{'kind':'aggregate_merchant_floor','terms':terms,'bound':floor}]
row=coo_matrix(([v for v in terms.values()],([0]*len(terms),list(terms))),shape=(1,len(choices))).tocsr();matrix=vstack([matrix[:-3],row]).tocsr();rhs=np.r_[rhs[:-3],float(floor)]
r=linprog([-float(x) for x in rewards],A_ub=matrix,b_ub=rhs,bounds=(0,1),method='highs')
assert r.success,r.message
mu=[max(F(0),F(str(-float(v)))) for v in r.ineqlin.marginals[offset:]]
total,by_buyer,rounded,upper_constant=dynamic_bounds(choices,rewards,buyers,cuts,constant,mu)
upper=(total+len(data['cases'])*100*SCALE+SCALE-1)//SCALE;fixed=sum(F(str(c['reference']['platformUSD'])) for c in data['cases'])
result={'inputHash':data['hash'],'scope':'Evaluator-only exact-basket bound with aggregate retailer floor; individual retailer and supplier floors are relaxed. Not a policy score.',
 'conservativeUpperUSD':upper/100,'fixedTotalUSD':float(fixed),'ratio':float(F(upper,100)/fixed),'goalAchieved':False,'runtimeSeconds':time.perf_counter()-start,'newModelCalls':0}
certificate={'inputHash':data['hash'],'rewardScale':SCALE,'beta':str(beta),'constantCents':str(constant),'multipliers':[str(x) for x in mu],
 'byBuyer':by_buyer,'upperConstantCents':str(upper_constant),'upperBeforeCushionNanocents':total,'conservativeUpperCents':upper}
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n');(out/'certificate.json').write_text(json.dumps(certificate,indent=2)+'\n')
(out/'choice-model.json').write_text(json.dumps({'choices':choices,'buyers':buyers,'coupling':[dict(c,terms={str(k):v for k,v in c['terms'].items()},bound=str(c['bound'])) for c in cuts],'roundedRewards':rounded}))
print(json.dumps(result,indent=2))

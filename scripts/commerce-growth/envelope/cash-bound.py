"""Replace the inventory allowance with the registered partner-cash floor.
This is a supplementary upper-bound calculation, not a changed performance
benchmark. No business policy or simulator is modified.
"""
import json,sys,time
from pathlib import Path
from fractions import Fraction as F
import numpy as np
from scipy.optimize import linprog
from scipy.sparse import vstack,coo_matrix
sys.path.insert(0,str(Path(__file__).parent))
from solve import build,dynamic_bounds,SCALE
individual='--individual' in sys.argv
root=Path('docs/commerce-growth/envelope-1');out=root/('cash-individual' if individual else 'cash');out.mkdir(exist_ok=False)
data=json.loads((root/'inputs.json').read_text());cash=json.loads((root/'cash-inputs.json').read_text());start=time.perf_counter()
choices,_,buyers,cuts,_,matrix,rhs,offset,_=build(data)
minimum=min(F(str(c['minimumProcurementUnitUSD']))*100 for c in data['cases'])
a=F(17,10)+F(1,2)/minimum
gamma=F(42,100)-F(4,5)/minimum
eta=F(229,10000)/(F(349,10000)+gamma/a)
assert gamma>0 and 30-F(97,2)*eta>0
cash_allowance=sum(c['oldCashPositiveUpperCents']-c['referenceClosingCashCents']+c['openingPartnerCashCents'] for c in cash['cases'])
batches=sum(c['maximumRootPaypalBatches']+c['maximumFactoryPaypalBatches'] for c in data['cases'])
constant=eta*cash_allowance+(30-F(97,2)*eta)*batches+sum(F(str(c['oldPositiveUpper']['platformUSD']))*100 for c in data['cases'])
rewards=[F(c['retailPlatformCents'])+eta*(sum(c['merchantProfitCents'])+c['costCents'])-(data['outreachCostCents'] if c['needsContact'] else 0) for c in choices]
if not individual:
 terms={j:-sum(c['merchantProfitCents']) for j,c in enumerate(choices) if sum(c['merchantProfitCents'])};floor=sum(c['bound'] for c in cuts[-3:]);cuts=cuts[:-3]+[{'kind':'aggregate_merchant_floor','terms':terms,'bound':floor}]
 row=coo_matrix((list(terms.values()),([0]*len(terms),list(terms))),shape=(1,len(choices))).tocsr();matrix=vstack([matrix[:-3],row]).tocsr();rhs=np.r_[rhs[:-3],float(floor)]
r=linprog([-float(x) for x in rewards],A_ub=matrix,b_ub=rhs,bounds=(0,1),method='highs');assert r.success,r.message
mu=[max(F(0),F(str(-float(v)))) for v in r.ineqlin.marginals[offset:]]
total,by_buyer,rounded,upper_constant=dynamic_bounds(choices,rewards,buyers,cuts,constant,mu)
upper=(total+len(data['cases'])*100*SCALE+SCALE-1)//SCALE;fixed=sum(F(str(c['reference']['platformUSD'])) for c in data['cases'])
result={'scope':'Supplementary evaluator-only bound with '+('individual' if individual else 'aggregate')+' retailer contribution and aggregate partner-cash preservation, but no terminal-inventory cap. Not a policy score or a change to the primary benchmark.',
 'conservativeUpperUSD':upper/100,'fixedTotalUSD':float(fixed),'ratio':float(F(upper,100)/fixed),'goalAchieved':False,'runtimeSeconds':time.perf_counter()-start,'newModelCalls':0}
certificate={'mode':'partner_cash_no_inventory_cap','inputHash':data['hash'],'rewardScale':SCALE,'a':str(a),'gamma':str(gamma),'eta':str(eta),'constantCents':str(constant),'multipliers':[str(v) for v in mu],'byBuyer':by_buyer,'upperConstantCents':str(upper_constant),'upperBeforeCushionNanocents':total,'conservativeUpperCents':upper}
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n');(out/'certificate.json').write_text(json.dumps(certificate,indent=2)+'\n');(out/'choice-model.json').write_text(json.dumps({'choices':choices,'buyers':buyers,'coupling':[dict(c,terms={str(k):v for k,v in c['terms'].items()},bound=str(c['bound'])) for c in cuts],'roundedRewards':rounded}))
print(json.dumps(result,indent=2))

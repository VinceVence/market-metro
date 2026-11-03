"""Lagrangian upper envelope with exact per-buyer basket/budget DP.
The LP chooses nonnegative multipliers; the certificate does NOT depend on
trusting LP optimality. For any such multipliers, independent integer DP gives
a valid upper bound. Rewards round upwards at one nanocent before exact DP.
"""
import json,time,math
from fractions import Fraction as F
from pathlib import Path
import numpy as np
from scipy.optimize import linprog
from scipy.sparse import coo_matrix

ROOT=Path('docs/commerce-growth/envelope-1')
SCALE=10**9
NEG=-9_000_000_000_000_000_000
def ceilfrac(q):return -((-q.numerator)//q.denominator)
def frac(value):return F(str(value))


def build(data):
    choices=[];rewards=[];rows=[];rhs=[];coupling=[];buyers=[]
    min_unit=min(c['minimumProcurementUnitUSD'] for c in data['cases'])
    # Factory invoice rounding <= half a cent per procurement line; each line
    # has cost at least min_unit dollars. Use exact rational coefficients.
    beta=F(229,10000)*(F(17,10)+F(1,200)/frac(min_unit))
    inventory_cap=sum(frac(c['reference']['terminalInventoryUSD']) for c in data['cases'])*110
    opening=sum(frac(c['openingInventoryUSD']) for c in data['cases'])*100
    batch_count=sum(c['maximumRootPaypalBatches']+c['maximumFactoryPaypalBatches'] for c in data['cases'])
    constant=beta*(inventory_cap-opening)+30*batch_count+sum(frac(c['oldPositiveUpper']['platformUSD']) for c in data['cases'])*100
    merchant_floor=[sum(c['merchantFloorsCents'][i] for c in data['cases'])-sum(frac(c['oldPositiveUpper']['retailerUSD'])*100 for c in data['cases']) for i in range(3)]
    for c in data['cases']:
        budget_by_id={b['customerId']:b for b in c['budgets']}
        for customer,budget in budget_by_id.items():
            requests=[]
            for request in sorted((r for r in c['requests'] if r['customerId']==customer and r['options']),key=lambda r:(r['latestCaptureDay'],r['id'])):
                cap=next(p['usd'] for p in budget['prefix'] if p['day']==request['latestCaptureDay'])
                variables=[]
                for option in request['options']:
                    if option['grossCents']>frac(cap)*100:continue
                    j=len(choices);variables.append(j)
                    p=F(option['retailPlatformCents'])+beta*option['costCents']-(data['outreachCostCents'] if request['needsContact'] else 0)
                    choices.append({'market':c['seed'],'customer':customer,'request':request['id'],**option,'refunded':request['refunded'],'needsContact':request['needsContact']})
                    rewards.append(p)
                if not variables:continue
                rows.append({j:1 for j in variables});rhs.append(1)
                requests.append({'id':request['id'],'day':request['latestCaptureDay'],'capUnits':math.floor(frac(cap)), 'variables':variables,
                                 'needsContact':request['needsContact'],'start':request['contactStart'],'end':request['contactEnd']})
            if not requests:continue
            for deadline in sorted(set(r['day'] for r in requests)):
                cap=next(p['usd'] for p in budget['prefix'] if p['day']==deadline)
                rows.append({j:choices[j]['grossCents'] for r in requests if r['day']<=deadline for j in r['variables'] if not choices[j]['refunded']});rhs.append(float(frac(cap)*100))
            hidden=[r for r in requests if r['needsContact']]
            # Necessary interval-capacity inequalities for 7-day contact gaps.
            # Only requests whose WHOLE contact window lies in the interval
            # contribute. Omitting partial overlaps makes the cut optimistic.
            for start in sorted(set(r['start'] for r in hidden)):
                for end in sorted(set(r['end'] for r in hidden)):
                    if end<start:continue
                    member=[r for r in hidden if r['start']>=start and r['end']<=end]
                    capacity=(end-start)//data['contactGapDays']+1
                    if len(member)<=capacity:continue
                    terms={j:1 for r in member for j in r['variables']}
                    coupling.append({'kind':'contact_interval','market':c['seed'],'customer':customer,'start':start,'end':end,'capacity':capacity,'terms':terms,'bound':F(capacity)})
            buyers.append({'market':c['seed'],'customer':customer,'requests':requests})
    for merchant in range(3):
        coupling.append({'kind':'merchant_floor','merchant':merchant,'terms':{i:-x['merchantProfitCents'][merchant] for i,x in enumerate(choices) if x['merchantProfitCents'][merchant]},'bound':-merchant_floor[merchant]})
    offset=len(rows)
    for cut in coupling:rows.append(cut['terms']);rhs.append(float(cut['bound']))
    rr=[];cc=[];vv=[]
    for i,row in enumerate(rows):
        for j,v in row.items():rr.append(i);cc.append(j);vv.append(v)
    matrix=coo_matrix((vv,(rr,cc)),shape=(len(rows),len(choices))).tocsr()
    return choices,rewards,buyers,coupling,constant,matrix,np.asarray(rhs),offset,beta


def dynamic_bounds(choices,rewards,buyers,coupling,constant,multipliers):
    adjusted=list(rewards);upper_constant=constant
    for cut,multiplier in zip(coupling,multipliers):
        if multiplier<0:raise ValueError('Negative Lagrange multiplier')
        upper_constant+=multiplier*cut['bound']
        for j,coefficient in cut['terms'].items():adjusted[j]-=multiplier*coefficient
    rounded=[ceilfrac(q*SCALE) for q in adjusted]
    results=[]
    for buyer in buyers:
        cap=max(r['capUnits'] for r in buyer['requests']);dp=np.full(cap+1,NEG,dtype=np.int64);dp[0]=0
        for request in buyer['requests']:
            before=dp;after=before.copy();best={}
            for j in request['variables']:
                cost=0 if choices[j]['refunded'] else choices[j]['grossCents']//100
                best[cost]=max(best.get(cost,NEG),rounded[j])
            # All alternatives use the previous table, never another option
            # from the same request. This enforces one complete basket/need.
            for cost,reward in best.items():
                if cost>cap:continue
                source=before[:cap+1-cost];candidate=np.where(source==NEG,NEG,source+reward)
                np.maximum(after[cost:],candidate,out=after[cost:])
            after[request['capUnits']+1:]=NEG;dp=after
        value=int(dp.max());results.append({'market':buyer['market'],'customer':buyer['customer'],'upperNanocents':value,'requests':len(buyer['requests'])})
    total=sum(r['upperNanocents'] for r in results)+ceilfrac(upper_constant*SCALE)
    return total,results,rounded,upper_constant


def main():
    data=json.loads((ROOT/'inputs.json').read_text());started=time.perf_counter()
    choices,rewards,buyers,cuts,constant,matrix,rhs,offset,beta=build(data)
    result=linprog([-float(x) for x in rewards],A_ub=matrix,b_ub=rhs,bounds=(0,1),method='highs')
    if not result.success:raise RuntimeError('Basket relaxation failed: '+result.message)
    multipliers=[max(F(0),frac(-y)) for y in result.ineqlin.marginals[offset:]]
    total,by_buyer,rounded,upper_constant=dynamic_bounds(choices,rewards,buyers,cuts,constant,multipliers)
    fixed=sum(frac(c['reference']['platformUSD']) for c in data['cases'])
    # Add one USD/market beyond exact arithmetic and upward reward rounding.
    cushion=len(data['cases'])*100*SCALE;upper_cents=(total+cushion+SCALE-1)//SCALE
    output={'scope':'Evaluator-only exact-basket/buyer-budget upper envelope. Not a deployable policy or agent result.',
        'inputHash':data['hash'],'choices':len(choices),'buyers':len(buyers),'couplingCuts':len(cuts),'lpStatus':int(result.status),
        'relaxedLpUpperUSD':(-float(result.fun)+float(constant))/100,
        'conservativeUpperUSD':upper_cents/100,'fixedTotalUSD':float(fixed),'ratio':float(F(upper_cents,100)/fixed),
        'targetRatio':2,'goalAchieved':False,'additionalCushionUSD':len(data['cases']),'runtimeSeconds':time.perf_counter()-started,
        'newModelCalls':0,'nativePaymentCalls':0}
    certificate={'inputHash':data['hash'],'rewardScale':SCALE,'beta':str(beta),'constantCents':str(constant),
        'multipliers':[str(v) for v in multipliers],'byBuyer':by_buyer,'upperConstantCents':str(upper_constant),
        'upperBeforeCushionNanocents':total,'conservativeUpperCents':upper_cents,
        'proof':'For coupled Ax<=b, max p.x <= mu.b + max (p-mu.A).x for any mu>=0. Integer DP maximizes the latter over each buyer complete-basket/prefix-budget relaxation. All rewards round upward; no LP optimality is assumed.'}
    (ROOT/'result.json').write_text(json.dumps(output,indent=2)+'\n');(ROOT/'certificate.json').write_text(json.dumps(certificate,indent=2)+'\n')
    (ROOT/'choice-model.json').write_text(json.dumps({'choices':choices,'buyers':buyers,'coupling':[dict(c,terms={str(k):v for k,v in c['terms'].items()},bound=str(c['bound'])) for c in cuts],'roundedRewards':rounded}))
    print(json.dumps(output,indent=2))


if __name__=='__main__':main()

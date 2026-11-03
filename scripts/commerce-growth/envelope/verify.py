"""Independent exact-arithmetic certificate check. No SciPy or builder import.
Uses sparse dictionaries for complete-basket DP rather than NumPy arrays.
"""
import json,sys,hashlib
from pathlib import Path
from fractions import Fraction as F

root=Path('docs/commerce-growth/envelope-1');directory=root/(sys.argv[1] if len(sys.argv)>1 else '')
raw=(root/'inputs.json').read_text().strip();data=json.loads(raw);start=raw.rfind(',"hash":');assert start>0
assert hashlib.sha256((raw[:start]+'}').encode()).hexdigest()==data['hash']
model=json.loads((directory/'choice-model.json').read_text());cert=json.loads((directory/'certificate.json').read_text())
assert cert['inputHash']==data['hash'];scale=cert['rewardScale'];assert scale==10**9
beta=F(229,10000)*(F(17,10)+F(1,200)/min(F(str(c['minimumProcurementUnitUSD'])) for c in data['cases']))
cash_mode=cert.get('mode')=='partner_cash_no_inventory_cap'
if cash_mode:
 cash=json.loads((root/'cash-inputs.json').read_text());minimum=min(F(str(c['minimumProcurementUnitUSD']))*100 for c in data['cases'])
 a=F(17,10)+F(1,2)/minimum;gamma=F(42,100)-F(4,5)/minimum;eta=F(229,10000)/(F(349,10000)+gamma/a)
 assert all(F(cert[k])==v for k,v in [('a',a),('gamma',gamma),('eta',eta)])
 constant=eta*sum(c['oldCashPositiveUpperCents']-c['referenceClosingCashCents']+c['openingPartnerCashCents'] for c in cash['cases'])
 constant+=(30-F(97,2)*eta)*sum(c['maximumRootPaypalBatches']+c['maximumFactoryPaypalBatches'] for c in data['cases'])+100*sum(F(str(c['oldPositiveUpper']['platformUSD'])) for c in data['cases'])
else:
 assert beta==F(cert['beta'])
 constant=beta*(sum(F(str(c['reference']['terminalInventoryUSD'])) for c in data['cases'])*110-sum(F(str(c['openingInventoryUSD'])) for c in data['cases'])*100)
 constant+=30*sum(c['maximumRootPaypalBatches']+c['maximumFactoryPaypalBatches'] for c in data['cases'])+100*sum(F(str(c['oldPositiveUpper']['platformUSD'])) for c in data['cases'])
assert constant==F(cert['constantCents'])
requests={(c['seed'],r['id']):r for c in data['cases'] for r in c['requests']}
rewards=[]
for c in model['choices']:
 r=requests[c['market'],c['request']];assert r['reachable']
 option={k:c[k] for k in ['grossCents','costCents','shippingCents','retailPlatformCents','merchantProfitCents']}
 assert option in r['options'];assert c['refunded']==r['refunded'] and c['customer']==r['customerId']
 assert c['needsContact']==r['needsContact'] and c['grossCents']%100==0
 extra=eta*(sum(c['merchantProfitCents'])+c['costCents']) if cash_mode else beta*c['costCents']
 rewards.append(F(c['retailPlatformCents'])+extra-(data['outreachCostCents'] if r['needsContact'] else 0))
assert len(cert['multipliers'])==len(model['coupling'])
for cut,amount in zip(model['coupling'],cert['multipliers']):
 multiplier=F(amount);assert multiplier>=0
 if cut['kind']=='contact_interval':
  assert cut['capacity']==(cut['end']-cut['start'])//data['contactGapDays']+1 and F(cut['bound'])==cut['capacity']
  for j,a in cut['terms'].items():
   c=model['choices'][int(j)];r=requests[c['market'],c['request']]
   assert a==1 and c['market']==cut['market'] and c['customer']==cut['customer'] and r['needsContact'] and r['contactStart']>=cut['start'] and r['contactEnd']<=cut['end']
 elif cut['kind']=='merchant_floor':
  expected=-sum(c['merchantFloorsCents'][cut['merchant']] for c in data['cases'])+100*sum(F(str(c['oldPositiveUpper']['retailerUSD'])) for c in data['cases'])
  assert F(cut['bound'])==expected
  assert cut['terms']=={str(j):-c['merchantProfitCents'][cut['merchant']] for j,c in enumerate(model['choices']) if c['merchantProfitCents'][cut['merchant']]}
 elif cut['kind']=='aggregate_merchant_floor':
  expected=-sum(sum(c['merchantFloorsCents']) for c in data['cases'])+300*sum(F(str(c['oldPositiveUpper']['retailerUSD'])) for c in data['cases'])
  assert F(cut['bound'])==expected
  assert cut['terms']=={str(j):-sum(c['merchantProfitCents']) for j,c in enumerate(model['choices']) if sum(c['merchantProfitCents'])}
 else:raise AssertionError('Unknown coupling constraint')
 constant+=multiplier*F(cut['bound'])
 for j,a in cut['terms'].items():rewards[int(j)]-=multiplier*int(a)
ceil=lambda x:-((-x.numerator)//x.denominator)
rounded=[ceil(x*scale) for x in rewards];assert rounded==model['roundedRewards'];assert constant==F(cert['upperConstantCents'])
computed=[]
option_key=lambda c:(c['grossCents'],c['costCents'],c['shippingCents'],c['retailPlatformCents'],tuple(c['merchantProfitCents']))
expected_buyers=set()
for case in data['cases']:
 for budget in case['budgets']:
  for r in case['requests']:
   if r['customerId']!=budget['customerId'] or not r['options']:continue
   cap=F(str(next(p['usd'] for p in budget['prefix'] if p['day']==r['latestCaptureDay'])))*100
   if any(o['grossCents']<=cap for o in r['options']):expected_buyers.add((case['seed'],budget['customerId']))
assert {(b['market'],b['customer']) for b in model['buyers']}==expected_buyers
for buyer in model['buyers']:
 states={0:0};case=next(c for c in data['cases'] if c['seed']==buyer['market']);budget=next(b for b in case['budgets'] if b['customerId']==buyer['customer'])
 expected_groups=[]
 for r in case['requests']:
  if r['customerId']!=buyer['customer'] or not r['options']:continue
  cap=F(str(next(p['usd'] for p in budget['prefix'] if p['day']==r['latestCaptureDay'])))*100
  if any(o['grossCents']<=cap for o in r['options']):expected_groups.append(r)
 assert [r['id'] for r in sorted(expected_groups,key=lambda r:(r['latestCaptureDay'],r['id']))]==[g['id'] for g in buyer['requests']]
 for group in buyer['requests']:
  r=requests[buyer['market'],group['id']];cap=F(str(next(p['usd'] for p in budget['prefix'] if p['day']==r['latestCaptureDay'])));assert group['capUnits']==cap.numerator//cap.denominator
  best={}
  assert {option_key(model['choices'][j]) for j in group['variables']}=={option_key(o) for o in r['options'] if o['grossCents']<=cap*100}
  for j in group['variables']:
   option=model['choices'][j];assert option['market']==buyer['market'] and option['customer']==buyer['customer'] and option['request']==group['id'];assert option['grossCents']<=cap*100
   cost=0 if option['refunded'] else option['grossCents']//100;best[cost]=max(best.get(cost,-10**30),rounded[j])
  next_states={n:v for n,v in states.items() if n<=group['capUnits']}
  for spent,value in states.items():
   for cost,reward in best.items():
    if spent+cost<=group['capUnits']:next_states[spent+cost]=max(next_states.get(spent+cost,-10**30),value+reward)
  states=next_states
 value=max(states.values());computed.append({'market':buyer['market'],'customer':buyer['customer'],'upperNanocents':value,'requests':len(buyer['requests'])})
assert computed==cert['byBuyer']
total=sum(x['upperNanocents'] for x in computed)+ceil(constant*scale);assert total==cert['upperBeforeCushionNanocents']
upper=(total+len(data['cases'])*100*scale+scale-1)//scale;assert upper==cert['conservativeUpperCents']
result={'certificateVerified':True,'conservativeUpperUSD':upper/100,'buyersChecked':len(computed),'priceOptionsChecked':len(rewards),
 'scope':'Verifies Lagrange arithmetic and exact per-buyer DP independently. Quote enumeration completeness and the financial envelope derivation are separate obligations.'}
(directory/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))

"""Independent arithmetic verification of the saved LP dual certificate.
No optimization call and no import of the model builder are used here.
"""
import json,sys
from pathlib import Path
from decimal import Decimal,getcontext,ROUND_CEILING
getcontext().prec=60
root=Path(sys.argv[1] if len(sys.argv)>1 else 'docs/commerce-deadlines/headroom-bound-2');m=json.loads((root/'linear-model.json').read_text());c=json.loads((root/'dual-certificate.json').read_text());D=lambda v:Decimal(str(v))
assert m['inputHash']==c['inputHash']
y=list(map(D,c['inequalityDuals']));z=list(map(D,c['equalityDuals']));q=list(map(D,c['upperBoundDuals']))
assert len(y)==len(m['inequalities']) and len(z)==len(m['equalities']) and len(q)==len(m['variables'])
assert all(v.is_finite() and v<=0 for v in y+q) and all(v.is_finite() for v in z)
assert all(D(lo)==0 and D(hi).is_finite() and D(hi)>=0 for lo,hi in m['bounds'])
r=[D(v)-qq for v,qq in zip(m['objective'],q)]
lower=sum((D(b)*v for b,v in zip(m['rhs'],y)),Decimal(0))+sum((D(b)*v for b,v in zip(m['equalityRhs'],z)),Decimal(0))+sum((D(bound[1])*v for bound,v in zip(m['bounds'],q)),Decimal(0))
for rows,dual in [(m['inequalities'],y),(m['equalities'],z)]:
 for row,v in zip(rows,dual):
  for key,a in row.items():r[int(key)]-=D(a)*v
lower+=sum((min(v,Decimal(0))*D(bound[1]) for v,bound in zip(r,m['bounds'])),Decimal(0))
upper=(-lower+D(m['constantUpperUSD'])+D(m['cushionUSD'])).quantize(Decimal('.01'),rounding=ROUND_CEILING)
assert upper<=D(c['conservativeUpperUSD'])
# Exact integer checks of all rounding residues over the fee-rate period.
for gross in range(1,10001):
 fee=(349*gross+5000)//10000+49;processing=(120*gross+5000)//10000+20
 assert 10000*(fee-processing)<=229*gross+300000
 assert -20000*processing<=-240*gross-390000
 assert 20000*fee>=698*gross+970000
result={'certificateVerified':True,'conservativeUpperUSD':str(upper),'roundingResiduesChecked':10000,'scope':'Verifies the stored linear relaxation certificate and fee envelopes. The mapping from simulation to the relaxation is documented separately; this is not an agent performance result.'}
(root/'certificate-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))

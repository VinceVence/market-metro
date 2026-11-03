"""Inventory-safeguard sensitivity of an already certified upper envelope.
No policy or simulator parameter is changed. The same nonnegative Lagrange
multipliers remain valid when only the additive inventory allowance changes.
"""
import json
from pathlib import Path
from fractions import Fraction as F
root=Path('docs/commerce-growth/envelope-1')
data=json.loads((root/'inputs.json').read_text());cert=json.loads((root/'aggregate/certificate.json').read_text());result=json.loads((root/'aggregate/result.json').read_text())
beta=F(cert['beta']);inventory=sum(F(str(c['reference']['terminalInventoryUSD'])) for c in data['cases']);fixed=F(str(result['fixedTotalUSD']))
base=F(cert['upperBeforeCushionNanocents'],100*cert['rewardScale'])+len(data['cases']);rows=[]
for text in ['1.0','1.1','1.5','2.0','2.5','3.0']:
 factor=F(text);upper=base+beta*inventory*(factor-F('1.1'));cents=(upper*100).__ceil__()
 rows.append({'inventoryMultiple':float(factor),'upperUSD':cents/100,'upperRatio':float(F(cents,100)/fixed),'additionalInventoryUSDPerMarket':float(inventory*(factor-F('1.1'))/len(data['cases']))})
needed=F('1.1')+(2*fixed-base)/(beta*inventory)
report={'scope':'Sensitivity to the registered evaluation safeguard, not a simulator mutation or an attained policy. Shopper money, needs, prices and behavior are unchanged. Cash preservation, inventory demand and physical feasibility are not established at the larger allowances.',
 'rows':rows,'inventoryMultipleForUpperToReach2x':float(needed),'newModelCalls':0,'goalAchieved':False}
(root/'inventory-sensitivity.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))

"""Tighten the financial envelope using impossible-to-reach requests only.
Actual agents never see this future truth. Contact limits, uncertainty, stock
and most operational costs are still relaxed, so this is not a policy score.
"""
import json
import importlib.util
from pathlib import Path

spec=importlib.util.spec_from_file_location('auditor','scripts/commerce-deadlines/constraint-audit.py')
auditor=importlib.util.module_from_spec(spec);spec.loader.exec_module(auditor)
root=Path('docs/commerce-growth/headroom-bound-1');output=root/'reachable';output.mkdir(exist_ok=False)
model=json.loads((root/'linear-model.json').read_text());reach=json.loads((root/'reachability.json').read_text())
names={n:i for i,n in enumerate(model['variables'])}
for r in reach['rows']:
    if r['key'] not in names:continue
    g=names[r['key']];n=names[r['key'].replace(':gross:',':count:')];c=names[r['key'].replace(':gross:',':cost:')]
    if not r['reachable']:
        for i in [g,n,c]:model['bounds'][i][1]=0
    elif r['needsContact']:
        model['objective'][n]+=.05  # At least one paid contact per discovered need.
result=auditor.solve(model)
if result['status']!=0:raise RuntimeError('REACHABILITY_BOUND_INFEASIBLE: '+str(result))
certificate=result.pop('certificate');fixed=json.loads((root/'result.json').read_text())['fixedTotalUSD']
row={'id':'reachable',**result,'ratio':result['conservativeCeilingUSD']/fixed,'legalPolicy':False,'agentPerformance':False}
(output/'reachable-model.json').write_text(json.dumps(model));(output/'reachable-certificate.json').write_text(json.dumps(certificate))
(output/'results.json').write_text(json.dumps({'rows':[row],'fixedTotalUSD':fixed,'newModelCalls':0,'targetAchieved':False,
 'scope':'Optimistic consent/response-aware financial ceiling. Private future facts used only to exclude unreachable needs and require one outreach charge; no actor access or execution evidence.'},indent=2)+'\n')
print(json.dumps(row,indent=2))

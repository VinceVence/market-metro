"""An optimistic pooled LP bound for the frozen deadline action interface.
USD units. Positive-profit constraints are relaxed upper expressions, so any
feasible actual policy must fit inside this financial relaxation. This does not
produce an executable policy or establish2x performance.
"""
import json,time,sys,math,argparse
from decimal import Decimal,getcontext,ROUND_CEILING
from pathlib import Path
import numpy as np
from scipy.optimize import linprog
from scipy.sparse import coo_matrix

parser=argparse.ArgumentParser();parser.add_argument('--root',default='docs/commerce-deadlines/headroom-bound-2');parser.add_argument('--verify-witness',action='store_true');options=parser.parse_args()
root=Path(options.root);data=json.loads((root/'inputs.json').read_text());start=time.time();variables=[];objective=[];bounds=[];ineq=[];rhs=[];equal=[];erhs=[];case_vars=[];inventory_cap=1.1*sum(c['reference']['terminalInventoryUSD'] for c in data['cases'])
def var(name,profit=0,bound=(0,None)):
 i=len(variables);variables.append(name);objective.append(-profit);bounds.append(bound);return i
def constraint(values,b):ineq.append(values);rhs.append(b)
def equation(values,b):equal.append(values);erhs.append(b)
retailer={};wholesaler={};manufacturer={};inventory={};constant=0
def add(target,i,v):target[i]=target.get(i,0)+v
for market in data['cases']:
 tag=str(market['seed']);budgets={b['customerId']:b['prefix'] for b in market['budgets']};requests=[]
 for r in market['requests']:
  if r['latestCaptureDay']<30:continue
  available=next(p['usd'] for p in budgets[r['customerId']] if p['day']==r['latestCaptureDay']);z=int(r['refunded'])
  gross_cap=min(r['maxGrossUSD'],available);g=var(tag+':gross:'+r['id'],.0229-.0349*z,(0,gross_cap));n=var(tag+':count:'+r['id'],.30-.495*z,(0,1));c=var(tag+':cost:'+r['id'],bound=(0,.6*gross_cap+1e-7))
  constraint({g:1,n:-r['maxGrossUSD']},0);constraint({g:-1,n:r['minGrossUSD']},0)
  constraint({c:-1,g:.43},0);constraint({c:1,g:-.60},0)
  constraint({c:1,g:-.7651,n:3.985},0) #20% margin; minimum single shipment/fee
  add(retailer,g,(1-z)*.9651);add(retailer,n,-3.50-(1-z)*.485);add(retailer,c,-1)
  requests.append({**r,'g':g,'n':n,'c':c})
 for buyer,prefix in budgets.items():
  owned=[r for r in requests if r['customerId']==buyer]
  for day in sorted(set(r['latestCaptureDay'] for r in owned)):
   money=next(p['usd'] for p in prefix if p['day']==day);constraint({r['g']:1 for r in owned if r['latestCaptureDay']<=day and not r['refunded']},money)
 epsilon=math.ceil((.005/market['minimumProcurementUnitUSD'])*1e12)/1e12
 procurement_cap=sum(bounds[r['c']][1] for r in requests)+inventory_cap;factory_cap=(.7+epsilon)*procurement_cap
 T=var(tag+':new_procurement',bound=(0,procurement_cap));G=var(tag+':factory_gross',bound=(0,factory_cap));X=var(tag+':merchant_paypal',.0229,(0,procurement_cap));Y=var(tag+':factory_paypal',.0229,(0,factory_cap));A=var(tag+':root_paypal_invoices',.30,(0,market['scoreDays']));B=var(tag+':factory_paypal_invoices',.30,(0,2*market['scoreDays']));I=var(tag+':closing_inventory',bound=(0,inventory_cap));inventory[I]=1
 equation({T:1,I:-1,**{r['c']:-1 for r in requests}},-market['openingInventoryUSD'])
 constraint({G:1,T:-(.7+epsilon)},0);constraint({G:-1,T:.7-epsilon},0)
 constraint({X:1,T:-1},0);constraint({Y:1,G:-1},0)
 constraint({A:market['minimumProcurementUnitUSD'],X:-1},0)
 minimum_factory=(.7*market['minimumProcurementUnitUSD']-.005)
 constraint({B:minimum_factory,Y:-1},0)
 for i,v in [(T,1),(G,-1),(X,-.0349),(A,-.485)]:add(wholesaler,i,v)
 for i,v in [(G,.4),(T,epsilon),(Y,-.0349),(B,-.485)]:add(manufacturer,i,v)
 constant+=market['oldPositiveUpper']['platformUSD']
 case_vars.append({'seed':market['seed'],'g':[r['g'] for r in requests],'n':[r['n'] for r in requests],'T':T,'I':I})
for field,coef in [('retailerUSD',retailer),('wholesalerUSD',wholesaler),('manufacturerUSD',manufacturer)]:
 floor=sum(c['reference'][field]-c['oldPositiveUpper'][field] for c in data['cases']);constraint({i:-v for i,v in coef.items()},-floor)
constraint(inventory,inventory_cap)
def matrix(rows):
 rr=[];cc=[];vv=[]
 for j,row in enumerate(rows):
  for i,v in row.items():rr.append(j);cc.append(i);vv.append(v)
 return coo_matrix((vv,(rr,cc)),shape=(len(rows),len(variables))).tocsr()
model={'inputHash':data['hash'],'variables':variables,'objective':objective,'bounds':bounds,'inequalities':ineq,'rhs':rhs,'equalities':equal,'equalityRhs':erhs,'constantUpperUSD':constant,'cushionUSD':len(data['cases'])}
(root/'linear-model.json').write_text(json.dumps(model))
if options.verify_witness:
 witness=json.loads((root/'witness.json').read_text());v=np.asarray([witness['values'].get(name,0) for name in variables]);upper_violation=float(np.max(matrix(ineq)@v-np.asarray(rhs)));equality_violation=float(np.max(np.abs(matrix(equal)@v-np.asarray(erhs))));bound_violation=max(max(lo-x,x-hi) for x,(lo,hi) in zip(v,bounds));upper_value=float(-np.dot(objective,v)+constant)
 check={'scope':'Actual strongest-fixed trajectories mapped into the relaxation','constraintViolation':upper_violation,'equalityViolation':equality_violation,'boundViolation':float(bound_violation),'relaxedObjectiveUSD':upper_value,'actualPlatformUSD':witness['actualPlatformUSD'],'actualInsideRelaxation':max(upper_violation,equality_violation,bound_violation)<1e-6 and upper_value+1e-6>=witness['actualPlatformUSD']};(root/'witness-verification.json').write_text(json.dumps(check,indent=2)+'\n');print(json.dumps(check,indent=2));sys.exit(0 if check['actualInsideRelaxation'] else 1)
result=linprog(objective,A_ub=matrix(ineq),b_ub=rhs,A_eq=matrix(equal),b_eq=erhs,bounds=bounds,method='highs')
out={'inputHash':data['hash'],'status':int(result.status),'message':result.message,'variables':len(variables),'constraints':len(ineq)+len(equal),'runtimeSeconds':time.time()-start,'targetAchieved':False,'scope':'Optimistic pooled financial LP; evaluator-only, not a policy or observed performance.'}
if result.success:
 upper=-float(result.fun)+constant;fixed=sum(c['reference']['platformUSD'] for c in data['cases']);out.update(upperTotalUSD=upper,fixedTotalUSD=fixed,upperRatio=upper/fixed,upperMeanUSD=upper/len(data['cases']),constantUpperUSD=constant,maxPrimalViolation=float(max(np.max(matrix(ineq)@result.x-np.asarray(rhs)),np.max(np.abs(matrix(equal)@result.x-np.asarray(erhs))))),perCaseResources=[{'seed':v['seed'],'grossUSD':float(sum(result.x[i] for i in v['g'])),'fractionalOrders':float(sum(result.x[i] for i in v['n'])),'procurementUSD':float(result.x[v['T']]),'closingInventoryUSD':float(result.x[v['I']])} for v in case_vars])
 (root/'solution.json').write_text(json.dumps({'variableNames':variables,'values':result.x.tolist()}))
 # A residual-corrected dual bound is valid for finite variable boxes even
 # without exact stationarity. Compute it at50-decimal precision, then add
 # one USD per market as an explicit numerical/model-rounding safety cushion.
 getcontext().prec=50;D=lambda n:Decimal(str(float(n)));duals=[min(D(y),Decimal(0)) for y in result.ineqlin.marginals];eqduals=[D(y) for y in result.eqlin.marginals];upperduals=[min(D(y),Decimal(0)) for y in result.upper.marginals];residual=[D(c)-q for c,q in zip(objective,upperduals)];lower=sum((D(b)*y for b,y in zip(rhs,duals)),Decimal(0))+sum((D(b)*y for b,y in zip(erhs,eqduals)),Decimal(0))+sum((D(b[1])*q for b,q in zip(bounds,upperduals)),Decimal(0))
 for row,y in zip(ineq,duals):
  for i,a in row.items():residual[i]-=D(a)*y
 for row,y in zip(equal,eqduals):
  for i,a in row.items():residual[i]-=D(a)*y
 correction=sum((min(r,Decimal(0))*D(b[1]) for r,b in zip(residual,bounds)),Decimal(0));lower+=correction;certified=(-lower+D(constant)+Decimal(len(data['cases']))).quantize(Decimal('.01'),rounding=ROUND_CEILING)
 out.update(conservativeDualUpperUSD=float(certified),conservativeDualRatio=float(certified)/fixed,dualResidualCorrectionUSD=float(correction),additionalCushionUSD=len(data['cases']))
 (root/'dual-certificate.json').write_text(json.dumps({'inputHash':data['hash'],'inequalityDuals':[str(y) for y in duals],'equalityDuals':[str(y) for y in eqduals],'upperBoundDuals':[str(y) for y in upperduals],'residualCorrectionUSD':str(correction),'conservativeUpperUSD':str(certified),'proof':'For Ax<=b, Ex=d, 0<=x<=u, any y<=0 and q<=0 give c.x >= y.b+lambda.d+q.u+sum(min(c-A^T.y-E^T.lambda-q,0)*u). Negate to bound maximization and add the objective constant.'}))
(root/'result.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))

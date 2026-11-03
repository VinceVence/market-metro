"""Low-dimensional expert combination. Validation separates entire markets."""
import json,sys
from pathlib import Path
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score,log_loss,brier_score_loss,average_precision_score
root=Path(sys.argv[1]);d=json.loads((root/'data.json').read_text());train=d['training'];test=d.get('testing',[]);spec=json.loads((root/'spec.json').read_text()) if (root/'spec.json').exists() else {}
x=np.asarray([r['x'] for r in train]);y=np.asarray([r['y'] for r in train]);groups=np.asarray([r['market'] for r in train]);xx=np.asarray([r['x'] for r in test]);yy=np.asarray([r['y'] for r in test]);gg=np.asarray([r['market'] for r in test])
def metrics(y,p,g):
 aucs=[roc_auc_score(y[g==k],p[g==k]) for k in sorted(set(g)) if len(set(y[g==k]))==2]
 return {'auc':float(roc_auc_score(y,p)),'macroMarketAUC':float(np.mean(aucs)),'brier':float(brier_score_loss(y,p)),'logLoss':float(log_loss(y,p)),'averagePrecision':float(average_precision_score(y,p))}
def fit(indices,mode,c):
 return {key:LogisticRegression(C=c,max_iter=400).fit(x[selected,:2] if mode=='by_kind' else x[selected],y[selected]) for key,selected in ([('all',indices)] if mode=='pooled' else [(str(kind),indices[x[indices,2]==kind]) for kind in [0,1]])}
def predict(models,rows,mode):
 if mode=='pooled':return models['all'].predict_proba(rows)[:,1]
 p=np.zeros(len(rows))
 for kind in [0,1]:
  index=rows[:,2]==kind;p[index]=models[str(kind)].predict_proba(rows[index,:2])[:,1]
 return p
results=[]
for mode in ([spec['mode']] if 'mode' in spec else ['pooled','by_kind']):
 assert mode in ['pooled','by_kind']
 for c in [.1,1,10]:
  oof=np.zeros(len(train))
  for group in sorted(set(groups)):
   tr=np.flatnonzero(groups!=group);te=np.flatnonzero(groups==group);oof[te]=predict(fit(tr,mode,c),x[te],mode)
  model=fit(np.arange(len(train)),mode,c);pred=predict(model,xx,mode) if len(test) else None
  artifact={'version':'expert-score-stack-1','mode':mode,'C':c,'heads':{key:{'coefficients':m.coef_[0].tolist(),'intercept':float(m.intercept_[0])} for key,m in model.items()},'trainingMarkets':sorted(map(int,set(groups))),'trainingRows':len(train)}
  name=mode+'-'+str(c);(root/(name+'-model.json')).write_text(json.dumps(artifact,indent=2)+'\n')
  results.append({'id':name,'cv':metrics(y,oof,groups),'development':metrics(yy,pred,gg) if len(test) else None,'model':artifact})
result={'status':'COMPLETED','source':'LOCAL_EXPERT_TRAINING' if spec else 'NUMERICAL_DEVELOPMENT_NOT_LLM','freshConfirmation':False,'incumbent':metrics(yy,np.asarray([r['incumbent'] for r in test]),gg) if len(test) else None,'feedback':metrics(yy,np.asarray([r['feedback'] for r in test]),gg) if len(test) else None,'candidates':results}
if spec:
 selected=max(results,key=lambda r:(r['cv']['auc'],-r['cv']['brier']));(root/'selected.json').write_text(json.dumps(selected['model'],indent=2)+'\n')
 fitted=fit(np.arange(len(train)),selected['model']['mode'],selected['model']['C']);indices=np.linspace(0,len(train)-1,min(32,len(train)),dtype=int)
 (root/'parity.json').write_text(json.dumps([{'index':int(i),'expected':float(p)} for i,p in zip(indices,predict(fitted,x[indices],selected['model']['mode']))],indent=2)+'\n')
 (root/'report.json').write_text(json.dumps({'status':'COMPLETED','spec':spec,'rows':len(train),'markets':len(set(groups)),'metrics':selected['cv'],'baselineOnSameLabels':metrics(y,np.asarray([r['incumbent'] for r in train]),groups),'candidates':[{'id':r['id'],'metrics':r['cv']} for r in results],'selectedC':selected['model']['C'],'scope':'Whole-market cross-validation of an expert combiner. Base experts were trained on separate source markets. Earlier observations can inform later predictions, never future outcomes.'},indent=2)+'\n')
(root/'results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({**{k:result[k] for k in ['status','incumbent','feedback']},'candidates':[{k:r[k] for k in ['id','cv','development']} for r in results]},indent=2))

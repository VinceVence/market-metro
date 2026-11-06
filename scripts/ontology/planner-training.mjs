import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {ontologyTrainingAdvisor} from './training-advisor.mjs';
import {trainingMatrix,productTask,mapTrainingTask} from './training.mjs';
import {FEATURE_VIEWS} from '../commerce-growth/autonomy/team-workbench-tools.mjs';
import {predictResponse} from '../commerce-growth/autonomy/features.mjs';
import {digest,FAMILIES} from '../commerce-expanded/harness-v2/tools.mjs';
import {en} from '../commerce-expanded/harness-v2/contracts.mjs';

export function selectTrainingFeatures(plan,requested){
  assert.ok(Array.isArray(requested)&&requested.length>=2,'Select at least two pre-contact features');
  assert.equal(new Set(requested).size,requested.length,'Repeated training feature');
  const allowed=plan.paths.flatMap(path=>path.fields);
  assert.ok(requested.every(name=>allowed.includes(name)),'Feature is unavailable before contact');
  for(const relation of ['intent','shopper']){
    assert.ok(plan.paths.find(path=>path.id===relation)?.fields.some(name=>requested.includes(name)),
      'Include the '+relation+' relationship for this prediction task');
  }
  return allowed.filter(name=>requested.includes(name));
}

export const llmTrainingAdvisor={
  ...ontologyTrainingAdvisor,
  describe(historical,own,data,day){
    const advice=ontologyTrainingAdvisor.describe(historical,own,data,day);
    const plan=mapTrainingTask(productTask,FEATURE_VIEWS[data.featureView]);
    return {...advice,relations:plan.paths,allowedFeatures:plan.paths.flatMap(p=>p.fields),
      action:'Choose the product-contact training cohort and the exact features for its boosted-tree model. Include a prior intent and a shopper history feature. Earlier market history is available only in the market_feedback dataset. Price and stock remain available to value and fulfillment regardless of this classifier. Explain each included group and any excluded group. The tool fits only your selected list; then the financial verifier compares both models.'};
  },
  experiment(advice){
    return {name:'train_ontology_model',fields:{first:en(FAMILIES),target:en([productTask]),
      features:{type:'ARRAY',minItems:2,items:en(advice.allowedFeatures)}}};
  },
  async fit(dir,historical,own,base,day,choice){
    assert.equal(choice.target,productTask);
    const matrix=trainingMatrix(historical,own,base,day);
    const fields=selectTrainingFeatures(matrix.plan,choice.features);
    const plan={...matrix.plan,recipes:[{name:'llm_selected',fields}]};
    const job={...matrix,plan,controls:false};
    await mkdir(dir,{recursive:true});
    await writeFile(join(dir,'feature-job.json'),JSON.stringify(job));
    await promisify(execFile)(resolve('.local/marketing-venv/bin/python'),
      [resolve('scripts/ontology/train-features.py'),resolve(dir)],{timeout:240000,maxBuffer:250000});
    const {fits}=JSON.parse(await readFile(join(dir,'feature-fits.json'),'utf8'));
    const fitted=fits.ontology;
    assert.deepEqual(fitted.fields,fields);
    for(const row of fitted.parity){
      assert.ok(Math.abs(predictResponse(fitted.classifier,row.x,matrix.names)-row.probability)<1e-9,'Local training and serving diverged');
    }
    const spec={family:'boosted',featureView:base.artifact.spec.featureView,windowDays:base.artifact.spec.windowDays,
      trainingTask:productTask,selection:'llm_selected'};
    const artifact={...base.artifact,selected:'boosted',models:{boosted:fitted.classifier},
      trainingRows:fitted.report.rows,trainingEpisodes:fitted.markets,datasetHash:digest(job),spec,trainingFields:fields};
    const modelHash=digest(artifact);
    const report={...fitted.report,spec,inquiryValue:base.report?.inquiryValue,
      featureTriage:{selection:'llm_selected',fields,rows:fitted.report.rows,positive:fitted.report.positives,
        target:plan.target,reason:choice.rationale},scope:'Product contacts; whole historical markets held out.'};
    const model={id:'V2-MODEL-'+modelHash.slice(0,12),modelHash,artifact,report,cutoffDay:day,ownRows:matrix.ownRows};
    await writeFile(join(dir,'model.json'),JSON.stringify(model));
    await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
    return model;
  }
};

// The LLM chooses the question's focus and evidence; code verifies the references.
import {REQUIRED_WIDGETS} from '../../demo/studio/coverage.mjs';
export {REQUIRED_WIDGETS};
export const OPERATING_CONTEXT=Object.freeze({
 training:'Days 1–30 are intentional observation/warmup. The first local ranker is scheduled after 30 complete days, so its first visible record is Day 31. It updates every 14 campaign days. Zero fits at Day 30 is expected, not evidence of a failed pipeline.',
 payments:'Native Sandbox captures are optional, manually selected integration samples, independent of local model training and recommendation readiness. They are not generated during this replay. Zero captures means zero recorded native captures in THIS run only. Other runs are outside this snapshot: do not infer global integration health, missing integration, absence of payment issues, or production activity.',
 interpretation:'The agent cannot inspect customer feedback, production payments or causal campaign lift here. Recommend those as future investigations only. The dashboard is descriptive. Model scores assess ranking; they do not measure campaign profit.'
});
export function evidenceCatalog(snapshot){
 const rows=[];
 const add=(prefix,values,label)=>{for(const [key,value] of Object.entries(values))if(typeof value==='number'&&Number.isFinite(value))rows.push({id:prefix+'.'+key,label:label+' · '+key,value,unit:key.endsWith('USD')?'USD':key.toLowerCase().includes('recall')?'fraction':'count'});};
 add('summary',snapshot.summary,'Observed totals including warmup');
 snapshot.facts.merchants.forEach((r,i)=>add('merchant'+i,r,r.merchant));
 snapshot.facts.campaigns.forEach((r,i)=>add('campaign'+i,r,r.kind+' including warmup'));
 snapshot.facts.models.forEach((r,i)=>add('model'+i,r,'Local model at cutoff '+r.day));
 return rows;
}
export function validateGrounding(output,catalog){
 if(!Array.isArray(output.evidence)||output.evidence.length<2||output.evidence.length>4||new Set(output.evidence.map(e=>e.metricId)).size!==output.evidence.length)throw Error('INVALID_EVIDENCE_REFERENCES');
 for(const e of output.evidence){const fact=catalog.find(f=>f.id===e.metricId);if(!fact||e.value!==fact.value)throw Error('UNSUPPORTED_EVIDENCE_VALUE');}
 for(const key of ['nextStep','limitation'])if(typeof output[key]!=='string'||!output[key].trim()||output[key].length>700)throw Error('MISSING_ANALYSIS_BOUNDARY');
}
export function validateHandoff(output,analysis,parentId){
 if(output.analysisId!==parentId)throw Error('DESIGNER_WRONG_PARENT');
 const required=new Set(['payment_evidence',...(REQUIRED_WIDGETS[analysis.focus]||[])]);
 if([...required].some(id=>!output.widgets.includes(id)))throw Error('DESIGNER_MISSING_EVIDENCE_VIEW');
}

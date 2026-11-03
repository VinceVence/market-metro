import {readFile,writeFile} from 'node:fs/promises';
import {decisionAttribution} from './decision-study.mjs';
const dir=process.argv[2],load=async name=>JSON.parse(await readFile(dir+'/'+name+'.json','utf8'));
const [results,progress,protocol]=await Promise.all([load('results'),load('progress'),load('protocol')]);
if(results.status!=='COMPLETED'||progress.status!=='COMPLETED'||results.id!==progress.id||results.id!==protocol.id)throw Error('STUDY_NOT_COMPLETE');
const attribution=decisionAttribution(results.comparisons,progress.arms,progress.arms.team.candidates.numerical.programHash);
if(results.multiAgentBenefitObserved!==attribution.multiAgentBenefitObserved||results.llmBenefitBeyondNumericalControlObserved!==attribution.llmBenefitBeyondNumericalControlObserved){
 await writeFile(dir+'/raw-results-before-attribution-audit.json',JSON.stringify(results,null,2)+'\n',{flag:'wx'});
 await writeFile(dir+'/attribution-audit.json',JSON.stringify({reason:'Identical policies produced identical commerce outcomes. Different prompt costs must not be labeled multi-agent decision value.',before:{multiAgentBenefitObserved:results.multiAgentBenefitObserved,llmBenefitBeyondNumericalControlObserved:results.llmBenefitBeyondNumericalControlObserved},after:attribution,measurementsChanged:false,policiesChanged:false},null,2)+'\n');
}
Object.assign(results,attribution);await writeFile(dir+'/results.json',JSON.stringify(results,null,2)+'\n');
const report={results,calls:progress.calls,arms:progress.arms,cases:protocol.confirmation,protocol};
await writeFile('demo/data/commerce-decision-study.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({id:results.id,status:results.status,cost:results.totalModelCostUSD}));

import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {loadActionModels,predictActionValue} from './action-policy.mjs';
import {hash} from '../../commerce-design-v2/evaluate.mjs';
const dir='docs/commerce-economy-v5/action-learning-1',read=p=>readFile(p,'utf8').then(JSON.parse),m=await loadActionModels(),p=await read(dir+'/protocol.json'),d=await read(dir+'/dataset.json'),fixture=await read(dir+'/parity.json');
for(const [f,h] of Object.entries(p.hashes))assert.equal(hash(await readFile(f,'utf8')),h,f);
assert.equal(m.datasetHash,hash(await readFile(dir+'/dataset.json','utf8')));assert.equal(m.protocolHash,p.hash);assert.equal(m.trainingMarkets.some(seed=>m.validationMarkets.includes(seed)),false);assert.equal(m.featureNames.some(s=>/wallet|private|favorite|seed|scenario|customer.?id/i.test(s)),false);
let maxError=0;for(const [name,model] of Object.entries(m.models))for(let i=0;i<fixture.x.length;i++){const prediction=predictActionValue(model,fixture.x[i]);for(let j=0;j<prediction.length;j++)maxError=Math.max(maxError,Math.abs(prediction[j]-fixture.predictions[name][i][j]));}assert.ok(maxError<1e-7);
const result={passed:true,rows:d.rows.length,features:m.featureNames.length,models:Object.keys(m.models),maxPortablePredictionError:maxError,privateFeatures:false,economicSourceUnchanged:true,scope:'Model/data verification only. No profit or target-achievement claim.'};await writeFile(dir+'/verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));

import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {authoredCatalog} from './catalog.mjs';
import {ASSUMPTIONS,VERSION} from './engine.mjs';
export const ROOT=resolve(import.meta.dirname,'../..'),BASE=resolve(ROOT,'docs/behavior-v4');
export const sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
export const read=async f=>JSON.parse(await readFile(resolve(BASE,f),'utf8'));
export async function save(f,value){const path=resolve(BASE,f);await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(path+'.tmp',path);}
export async function environment(){
 const catalog=authoredCatalog(),code={};for(const f of ['catalog.mjs','engine.mjs','policies.mjs','runner.mjs'])code[f]=sha(await readFile(resolve(import.meta.dirname,f)));
 const protocol={version:VERSION,code,catalogHash:sha(catalog),source:'AUTHORED_SIMULATION',assumptions:ASSUMPTIONS,shoppingDays:230,campaignStop:130,budgetCents:5000,demo:{seed:150001,scenario:'preference_shift'},evaluationScenarios:['steady','rival_sale','budget_squeeze','supply_delay','returns_wave','preference_shift'],validation:'Exploratory paired demo only. New catalog; no inherited benchmark or production profit claim.'};protocol.hash=sha(protocol);
 try{if((await read('manifest.json')).hash!==protocol.hash)throw Error('OWNED_SOURCE_CHANGED_AFTER_FREEZE');}catch(e){if(e.code!=='ENOENT')throw e;await save('manifest.json',protocol);await save('catalog.json',{source:'AUTHORED_SIMULATION',products:catalog});}
 return {protocol,catalog};
}

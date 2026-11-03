import {readFile,writeFile} from 'node:fs/promises';
const dir=process.argv[2],read=async p=>JSON.parse(await readFile(dir+'/'+p+'.json','utf8'));
const [results,protocol,rows,single,team]=await Promise.all([read('results'),read('protocol'),read('confirmation-rows'),read('single/checkpoints'),read('team/checkpoints')]);
if(results.status!=='COMPLETED'||single.status!=='COMPLETED'||team.status!=='COMPLETED'||results.id!==protocol.id)throw Error('INCOMPLETE_WORKBENCH_STUDY');
await writeFile('demo/data/commerce-team-workbench.json',JSON.stringify({results,protocol,rows,designs:{single,team}},null,2)+'\n');
console.log(JSON.stringify({id:results.id,calls:results.freshCalls,cost:results.totalCostUSD}));

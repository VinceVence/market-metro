// Isolated local trial process; never receives an active confirmation world.
import {readFile,writeFile} from 'node:fs/promises';
import {runCoordinatedCase as runOriginal} from '../../commerce-growth/team/runner.mjs';
import {runCoordinatedCase as runExpanded} from '../runner.mjs';
import {outreachPlan} from '../../commerce-growth/team/control.mjs';
import {openAllocator} from '../../commerce-deadlines/solver.mjs';
import {scoreCampaign,assertBinding} from './tools.mjs';
const input=JSON.parse(await readFile(process.argv[2],'utf8')),allocator=openAllocator(),rows=[];
try{
 if(!['frozen-3x100','expanded-12x600'].includes(input.marketProfile))throw Error('V2_INVALID_TRIAL_MARKET');
 const runCoordinatedCase=input.marketProfile==='expanded-12x600'?runExpanded:runOriginal;
 for(const contract of input.schedule)assertBinding(contract,input.models[contract.modelHash]);
 for(const settings of input.cases){
  const controller={async plan(view){const contract=input.schedule.filter(c=>c.activationDay<=view.day).at(-1);return contract?scoreCampaign(view,{contract,model:input.models[contract.modelHash],prior:input.prior}):{...outreachPlan(view,input.fixed.config,input.prior),configuration:input.fixed.config};}};
  rows.push(await runCoordinatedCase(settings,{id:'v2-development',config:input.fixed.config},{allocator,prior:input.prior,controller}));
 }
 await writeFile(process.argv[3],JSON.stringify({key:input.key,rows}));
}finally{allocator.close();}

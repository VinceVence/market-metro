import {showLiveAutonomyPerformance} from './autonomy-performance.mjs';
import {showNetPerformance} from './net-performance.mjs';
import {showHarnessV2} from './harness-v2-performance.mjs';

export async function showPerformance(root,detail,session=null){
 const requested=new URL(location.href).searchParams.get('evaluation'),choices=new Set(['harness-v2','harness-v221','harness-v22','harness-v21','net-revision',...(session?.settings.autonomy?['current']:[])]);
 const selected=choices.has(requested)?requested:session?.settings.autonomy&&!requested?'current':'harness-v2';
 if(selected==='current')showLiveAutonomyPerformance(root,detail,session);
 else if(selected==='net-revision')await showNetPerformance(root,detail);
 else if(selected==='harness-v21')await showHarnessV2(root,detail,'/data/commerce-harness-v21.json');
 else if(selected==='harness-v22')await showHarnessV2(root,detail,'/data/commerce-harness-v22.json');
 else if(selected==='harness-v221')await showHarnessV2(root,detail,'/data/commerce-harness-v221.json');
 else await showHarnessV2(root,detail);
 const select=document.createElement('select');select.setAttribute('aria-label','Benchmark version');
 if(session?.settings.autonomy)select.add(new Option('Current live run','current'));
 select.add(new Option('V2.3 · value-model confirmation','harness-v2'));
 select.add(new Option('V2.2.1 · recorded comparison','harness-v221'));
 select.add(new Option('V2.2 · recorded comparison','harness-v22'));
 select.add(new Option('V2.1 · recorded comparison','harness-v21'));
 select.add(new Option('Locked v1 evidence','net-revision'));select.value=selected;
 select.onchange=()=>{const url=new URL(location.href);url.searchParams.set('evaluation',select.value);history.replaceState(null,'',url);void showPerformance(root,detail,session).catch(e=>{root.textContent=e.message;});};
 root.querySelector('.channel-heading').append(select);
}

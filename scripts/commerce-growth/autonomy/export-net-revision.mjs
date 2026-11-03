import {readFile,writeFile} from 'node:fs/promises';
const root='docs/commerce-growth/roc-net-goal-1',read=async p=>JSON.parse(await readFile(p,'utf8'));
const results=await read(root+'/net-revision-confirmation-1/results.json'),protocol=await read(root+'/net-revision-confirmation-1/protocol.json'),{rows}=await read(root+'/net-revision-confirmation-1/rows.json'),decision=await read(root+'/net-revision-decision.json'),development=await read(root+'/net-revision-development-1/results.json');
if(results.status!=='COMPLETED'||protocol.decisionHash!==decision.decisionHash)throw Error('INCOMPLETE_OR_UNBOUND_NET_REPORT');
const ledger=await read('.local/gcp/model-spend.json');
const example=await read(root+'/net-revision-confirmation-1/customer-example.json');
const data={results,protocol,rows,decision,development,example,spend:{newDesignUSD:decision.costUSD,lifetimeRecordedUSD:ledger.entries.reduce((s,e)=>s+(e.chargedMicros??e.reservedMicros??0),0)/1e6,unsettled:ledger.entries.filter(e=>e.status!=='settled').length},figure:'/data/commerce-net-revision.png',labels:{fixed:'Strong fixed rules',numerical:'Existing learned workflow',revised:'Gemini’s revised workflow',without_outreach:'Remove broader inquiries',without_fulfillment:'Remove basket coordination'}};
await writeFile('demo/data/commerce-net-revision.json',JSON.stringify(data));console.log(JSON.stringify({exported:'demo/data/commerce-net-revision.json',markets:protocol.cases.length,recordedSpendUSD:data.spend.lifetimeRecordedUSD}));

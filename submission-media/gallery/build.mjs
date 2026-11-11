// One local renderer for submission figures. No application changes or network calls.
// Visual primitives follow docs/figures/submission-method/build.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const out=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(out,'../..');
const require=createRequire(path.join(root,'.local/diagram-tools/package.json'));
const {Resvg}=require('@resvg/resvg-js');
for(const name of ['upload','masters']) fs.mkdirSync(path.join(out,name),{recursive:true});
// Monochrome diagram linework; logos and app imagery retain their original colors.
const C={ink:'#151515',muted:'#4b4b4b',line:'#a0a0a0',blue:'#202020',navy:'#202020',teal:'#202020',purple:'#202020',amber:'#202020',red:'#202020',pale:'#fff'};
const fonts=[400,600,700].map(w=>path.join(root,`demo/assets/fonts/dm-sans-${w}.ttf`));
const assets=path.join(root,'docs/figures/planner-v23/assets');
const vectors=path.join(root,'docs/presentations/ontology-paypal/vectors');
const saved=JSON.parse(fs.readFileSync(path.join(root,'demo/data/judge-reactivation.json')));
let s=[],cropIndex=0;
const e=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function text(v,x,y,size=29,weight=400,color=C.ink,anchor='start') {s.push(`<text x="${x}" y="${y}" font-family="DM Sans" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${e(v)}</text>`);}
function lines(a,x,y,size=28,color=C.muted,anchor='start',gap=39){a.forEach((v,i)=>text(v,x,y+i*gap,size,400,color,anchor));}
function rect(x,y,w,h,fill='#fff',stroke=C.line,r=0,dash=''){s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" ${dash?`stroke-dasharray="${dash}"`:''}/>`);}
function rule(x,y,w,color=C.line){s.push(`<path d="M${x} ${y}h${w}" stroke="${color}" stroke-width="1.8"/>`);}
function image(file,x,y,w,h,fit='meet'){
 const mime=file.endsWith('.svg')?'image/svg+xml':file.endsWith('.jpg')?'image/jpeg':'image/png';
 s.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid ${fit}" href="data:${mime};base64,${fs.readFileSync(file).toString('base64')}"/>`);
}
function photoCrop(name,[cx,cy,cw,ch],x,y,w,h){
 const id='photo-crop-'+(++cropIndex);
 s.push(`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${cx} ${cy} ${cw} ${ch}" preserveAspectRatio="xMidYMid meet"><defs><clipPath id="${id}"><rect x="${cx}" y="${cy}" width="${cw}" height="${ch}"/></clipPath></defs><g clip-path="url(#${id})">`);
 image(path.join(out,'assets/hires',name+'.jpg'),0,0,3000,2000);
 s.push('</g></svg>');
}
function icon(name,x,y,size=50,color=C.blue){
 const body=fs.readFileSync(path.join(vectors,name+'.svg'),'utf8').replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').replaceAll('currentColor',color);
 s.push(`<g transform="translate(${x} ${y}) scale(${size/24})" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</g>`);
}
function arrow(points,color=C.ink,dashed=false,head=true){
 let d=`M${points[0][0]} ${points[0][1]}`;
 for(let i=1;i<points.length-1;i++){
  const [x,y]=points[i],[px,py]=points[i-1],[nx,ny]=points[i+1],a=Math.hypot(x-px,y-py),b=Math.hypot(nx-x,ny-y),r=Math.min(12,a/2,b/2);
  d+=`L${x-(x-px)/a*r} ${y-(y-py)/a*r}Q${x} ${y} ${x+(nx-x)/b*r} ${y+(ny-y)/b*r}`;
 }
 const [x,y]=points.at(-1),[px,py]=points.at(-2),n=Math.hypot(x-px,y-py),ux=(x-px)/n,uy=(y-py)/n;
 d+=`L${x} ${y}`;
 s.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round" ${dashed?'stroke-dasharray="9 8"':''}/>`);
 if(head)s.push(`<path d="M${x-12*ux-5*uy} ${y-12*uy+5*ux}L${x} ${y}L${x-12*ux+5*uy} ${y-12*uy-5*ux}" fill="none" stroke="${color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`);
}
function tag(label,x,y,color=C.blue){text(label,x,y,23,600,color);}
function node(x,y,w,h,label,sub,name,color=C.blue,fill='#fff'){
 rect(x,y,w,h,fill,color);icon(name,x+24,y+24,44,color);text(label,x+86,y+56,29,700,color);
 if(name==='ShieldCheck')rect(x+6,y+6,w-12,h-12,'none',color);
 if(sub)lines(Array.isArray(sub)?sub:[sub],x+25,y+108,26,C.muted,'start',35);
}
function header(n,title,subtitle){
 s=[`<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1600" viewBox="0 0 2400 1600"><title>${e(title)}</title><defs><pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M-2 2L2 -2M0 10L10 0M8 12L12 8" stroke="#777" stroke-width="1"/></pattern></defs><rect width="2400" height="1600" fill="#fff"/>`];
 image(path.join(root,'demo/commerce/mark.svg'),62,42,45,45);tag('Market Metro',124,75,C.ink);text(`Figure ${Number(n)}`,2338,75,24,400,C.muted,'end');
 text(title,60,154,46,600);text(subtitle,62,204,27,400,C.muted);
}
function footer(caption){rule(60,1490,2280);text(caption,60,1533,23,400,C.muted);text('Market Metro · PayPal AI Hackathon',2340,1570,20,400,C.muted,'end');}
function legend(y=1420){
 arrow([[70,y+8],[150,y+8]]);text('Data or action flow',175,y+18,25);
 arrow([[720,y+8],[800,y+8]],C.ink,true);text('Conditional link / bounded tools',825,y+18,25);
 rect(1610,y-12,52,36);rect(1616,y-6,40,24,'none');text('Verification gate',1690,y+18,25);
}
function write(name){s.push('</svg>');const svg=s.join('\n');fs.writeFileSync(path.join(out,'masters',name+'.svg'),svg);fs.writeFileSync(path.join(out,'upload',name+'.png'),new Resvg(svg,{font:{fontFiles:fonts,loadSystemFonts:false,defaultFontFamily:'DM Sans'}}).render().asPng());}

// 01 — image-led cover; actual environment, large type and scoped outcomes.
header('01','Market Metro','Agentic commerce that learns');
image(path.join(out,'assets/hires/environment.jpg'),-40,350,1770,1040);
text('A market to explore.',60,310,64,700);
text('Decisions you can trace.',60,386,64,700);
tag('ONE RECORDED CAMPAIGN',1790,310);
text('12',1790,405,80,700);text('merchants',1920,405,32);
text('600',1790,485,68,700);text('shoppers',1955,485,32);
rule(1790,535,550);
[['Search','Observe',['Shopper behavior','and merchant stock.']],['BrainCircuit','Learn',['Local model training','and campaign trials.']],['ShieldCheck','Verify',['Check the economics.','Link payment evidence.']]].forEach(([ic,title,body],i)=>{
 const y=590+i*205;icon(ic,1790,y,48);text(title,1862,y+37,34,700);lines(body,1790,y+96,28,C.muted,'start',40);
});
rule(60,1320,2280);
[['+$114.96','Modeled PayPal net'],['+$1,024.86','Merchant contribution'],['+16','Retained purchases']].forEach(([value,label],i)=>{
 const x=60+i*785;text(value,x,1404,58,700);text(label,x,1450,27,400,C.muted);
});
footer('Matched fixed rules · seed 92111706 · gains are simulated; native PayPal evidence uses Sandbox test funds.');
write('01-market-metro');

// 02 — four planes; native receipt branch is distinct from modeled financial outcomes.
header('02','System architecture','Environment, agent, data and payment planes');
rect(60,275,1010,555,'#fff','#a0a0a0',22);tag('(a) Environment plane',90,321,C.blue);
image(path.join(out,'assets/hires/environment.jpg'),88,352,634,398);
text('Market Metro',750,407,32,700);lines(['Seeded shoppers','Finite budgets','Merchant inventory','Delivery outcomes'],750,462,27,C.muted,'start',47);
text('Purchases continue; review checkpoints bound decisions.',90,790,26,400,C.blue);
rect(1250,275,1090,555,'#fff','#a0a0a0',22);tag('(b) Agent + execution plane',1280,321,C.purple);
node(1280,366,440,168,'LLM planner',['Analyze demand; choose data,','features and campaign.'],'BrainCircuit',C.purple,'#fff');
node(1840,366,460,168,'Financial verifier',['Check matched trials; publish','or retain the incumbent.'],'ShieldCheck',C.teal,'#fff');
arrow([[1720,450],[1840,450]],C.purple);
rect(1280,592,1020,190,'#fff','#a0a0a0',14,'6 7');tag('Bounded tool sandbox',1306,631,C.amber);
icon('SlidersHorizontal',1310,660,44,C.amber);lines(['Train & rank','Local Python models'],1376,684,26,C.ink,'start',36);
icon('FlaskConical',1660,660,44,C.amber);lines(['Test candidates','Development markets'],1726,684,26,C.ink,'start',36);
arrow([[1510,534],[1510,592]],C.purple);arrow([[2070,592],[2070,534]],C.teal);
arrow([[1070,427],[1250,427]],C.blue);text('Observe',1160,407,23,600,C.blue,'middle');
text('Campaign',1160,728,23,600,C.teal,'middle');
rect(60,940,1010,416,'#fff','#a0a0a0',22);tag('(c) Data + ontology plane',90,986,C.blue);
node(90,1030,395,185,'Event warehouse',['Orders, contacts, outcomes','and saved checkpoints.'],'History',C.blue);
node(585,1030,450,185,'Ontology contract',['Entity links • units • timing','Valid training rows & features.'],'Network',C.teal);
arrow([[485,1120],[585,1120]],C.blue);arrow([[565,830],[565,940]],C.blue);text('Write observed events',592,895,23,500,C.blue);
text('Ambiguous mappings hold before training or publication.',92,1304,27,600,C.teal);
arrow([[1070,1100],[1160,1100],[1160,570],[1250,570]],C.teal);text('Valid inputs',1178,933,22,600,C.teal);
// Bridge separates the two directions at their single unavoidable crossing.
s.push('<path d="M1174 750 Q1160 726 1146 750" fill="none" stroke="#fff" stroke-width="11"/>');
arrow([[1250,750],[1174,750]],C.teal,false,false);
s.push(`<path d="M1174 750 Q1160 726 1146 750" fill="none" stroke="${C.teal}" stroke-width="2.8"/>`);
arrow([[1146,750],[1070,750]],C.teal);
rect(1250,940,1090,416,'#fff','#a0a0a0',22);tag('(d) Payment + evidence plane',1280,986,C.navy);
image(path.join(assets,'paypal.svg'),1290,1032,68,70);text('PayPal Sandbox',1380,1080,33,700,C.navy);
lines(['Selected existing order → capture → linked receipt','Native test funds, reconciled once to the warehouse.'],1290,1144,27,C.muted,'start',42);
rule(1280,1202,1020);icon('Network',1290,1235,44,C.blue);text('AG Studio',1353,1270,30,700,C.blue);text('Models · decisions · economics · receipts',1590,1270,25,400,C.muted);
arrow([[1070,1140],[1250,1140]],C.navy);text('Order',1160,1173,23,600,C.navy,'middle');
arrow([[1250,1320],[1070,1320]],C.navy);text('Receipt',1160,1299,23,600,C.navy,'middle');
legend();footer('One LLM campaign planner with trusted tools; the separate Studio agent handoff is detailed in Figure 04.');
write('02-system-architecture');

// 03 — semantic integrity, without claiming automatic causal uplift from ontology alone.
header('03','Ontology and data contracts','Entity relationships, checkout grain and prediction-time boundaries');
rect(60,278,720,1000,'#fff','#a0a0a0',22);tag('(a) Incoming merchant records',94,325,C.blue);
[['Merchant orders','Order ID · merchant ID · amount','ReceiptText'],['Shopper activity','Searches · contacts · purchases','UsersRound'],['Payment evidence','Capture ID · currency · fees','WalletCards']].forEach(([a,b,c],i)=>node(96,375+i*192,646,150,a,b,c,C.blue));
icon('CirclePause',98,1005,50,C.red);text('Two possible parent links?',169,1042,31,700,C.red);
lines(['Hold the join. Do not invent identity,','duplicate a purchase, or train on','an unresolved relationship.'],98,1100,29,C.muted,'start',45);
arrow([[780,740],[878,740],[878,500],[960,500]],C.teal);
text('Resolve',866,445,27,600,C.teal,'middle');text('& certify',866,480,27,600,C.teal,'middle');
rect(960,278,1380,1000,'#fff','#a0a0a0',22);tag('(b) Typed relationships + prediction-time meaning',994,325,C.teal);
// Spacious graph, ports aligned and labels outside connecting lines.
node(1000,393,350,144,'Shopper','Who acted?','UsersRound',C.blue);
node(1550,393,350,144,'Contact','What was shown?','Megaphone',C.blue);
node(1000,690,350,144,'Checkout','One shopper purchase','ReceiptText',C.teal,'#fff');
node(1550,690,350,144,'Merchant order','A portion of that basket','Store',C.amber);
node(1990,690,310,144,'Payment','Money + receipt','WalletCards',C.navy);
node(1550,990,350,144,'Product','Item + prior interest','Search',C.blue);
arrow([[1350,465],[1550,465]],C.blue);text('receives',1450,441,25,500,C.muted,'middle');
arrow([[1175,537],[1175,690]],C.blue);text('buys',1200,620,25,500,C.muted);
arrow([[1350,762],[1550,762]],C.teal);text('1 : many',1450,738,25,600,C.teal,'middle');
arrow([[1900,762],[1990,762]],C.navy);
arrow([[1725,834],[1725,990]],C.amber);text('contains',1750,928,25,500,C.muted);
arrow([[1725,537],[1725,607],[1310,607],[1310,690]],C.blue,true);text('may lead to',1490,592,25,500,C.muted,'middle');
rect(1000,990,350,210,'#fff','#a0a0a0',16);tag('Training boundary',1024,1033,C.purple);lines(['Past signals only','Mature outcomes','Known money units'],1024,1084,28,C.ink,'start',42);
arrow([[1550,1095],[1350,1095]],C.purple);text('valid features',1450,1069,22,500,C.purple,'middle');
text('Same graph supports learning and dashboard verification.',1000,1240,26,600,C.teal);
rect(60,1324,2280,119,'#fff','#a0a0a0',16);icon('ShieldCheck',90,1356,52,C.teal);
text('Verified cohort',163,1389,31,700,C.teal);text('125 merchant orders',550,1389,37,700);arrow([[1050,1375],[1160,1375]],C.teal);text('114 unique checkouts',1210,1389,37,700);text('Count each basket once.',1930,1389,27,400,C.muted);
footer('Observed Studio cohort: Circuit Corner, The Bundle Shop and Paper Lane. Ontology integrity is not an isolated profit claim.');
write('03-ontology');

// 04 — exact native Studio flow: two LLM roles, not six disguised model agents.
header('04','AG Studio agent orchestration','Two LLM roles connected by native tools and deterministic verification');
rect(60,265,2280,140,'#fff','#a0a0a0',18);icon('Search',90,307,50,C.blue);
text('“Which merchants deserve a closer look because refunds are eroding sales?”',166,325,35,600);
text('The planner reads observed merchant metrics and the saved campaign context.',166,370,28,400,C.muted);
const step=(x,y,num,title,role,ic,color,body,tool)=>{
 rect(x,y,660,308,'#fff',color);if(role==='Deterministic gate')rect(x+6,y+6,648,296,'none',color);tag(`${num} · ${role}`,x+28,y+43,color);icon(ic,x+28,y+73,51,color);text(title,x+103,y+112,34,700,color);lines(body,x+28,y+171,29,C.muted,'start',41);rule(x+28,y+255,604);text(tool,x+28,y+290,23,600,color);
};
step(60,475,'01','Commerce planner','LLM decision','BrainCircuit',C.purple,['Choose the cohort and question.','Three merchants selected.'],'plan_merchant_investigation');
step(870,475,'02','Studio query','Native tool','Search',C.amber,['Project allowed fields; filter IDs.','Return the actual merchant rows.'],'execute_query → delegate_to');
step(1680,475,'03','Ontology verifier','Deterministic gate','ShieldCheck',C.teal,['Match source values and scope.','Reconcile basket parents and money.'],'verify_cohort_insights');
arrow([[720,625],[870,625]],C.purple);arrow([[1530,625],[1680,625]],C.amber);
step(1680,900,'04','Insight editor','LLM decision','BrainCircuit',C.purple,['Select supported insights and views.','No invented values or new sales.'],'Choose verified fact IDs + view types');
step(870,900,'05','Checked publisher','Deterministic gate','ShieldCheck',C.teal,['Require source-backed facts.','Preserve checkout and PayPal scope.'],'publish_verified_views');
step(60,900,'06','AG Studio dashboard','Native output','Network',C.blue,['Five views, tables and receipt proof.','Inspect or arrange the saved layout.'],'complete_task → return to planner');
arrow([[2010,783],[2010,900]],C.teal);text('certified facts',2040,848,24,500,C.teal);
arrow([[1680,1050],[1530,1050]],C.purple);arrow([[870,1050],[720,1050]],C.teal);
rect(60,1284,2280,151,'#fff','#a0a0a0',18);
[['2','LLM decisions',C.purple],['6','Native tool calls',C.amber],['5','Published views',C.blue],['$0.001530','Estimated inference cost',C.teal]].forEach(([v,k,c],i)=>{text(v,105+i*570,1353,46,700,c);text(k,105+i*570,1401,27,400,C.muted);});
footer('Saved investigation INSIGHT-60d69504559ddfb4 · replay reruns tools without model calls · dashboard updates only');
write('04-agent-framework');

// 05 — native PayPal trace connected to the concrete shopper story and campaign economics.
header('05','Campaign outcomes and PayPal payment lineage','A matched policy comparison with separately reconciled native payment evidence');
rect(60,270,2280,190,'#fff','#a0a0a0',20);
icon('UsersRound',90,315,58,C.blue);text('Shopper 179',172,323,33,700);lines(['16 days since last purchase','Shown a ranked recommendation'],172,367,27,C.muted,'start',39);
arrow([[660,363],[780,363]],C.purple);icon('Store',820,315,60,C.teal);text('Form & Function',904,323,33,700);lines(['Mobile Side Table · $96','Bought day 35 · delivered day 36'],904,367,27,C.muted,'start',39);
arrow([[1530,363],[1660,363]],C.navy);image(path.join(assets,'paypal.svg'),1712,311,74,82);text('PayPal Sandbox',1810,330,35,700,C.navy);lines(['Existing order selected','Native test capture completed'],1810,375,27,C.muted,'start',39);
rect(60,525,950,865,'#fff','#a0a0a0',22);tag('(a) Matched campaign economics',94,574,C.blue);
text('More retained purchases.',94,645,40,700);text('Both sides gain.',94,695,40,700);
const labels=[['PayPal net',3309.83,3424.787675,'+$114.96',C.navy],['Merchant contribution',38928.95,39953.81,'+$1,024.86',C.teal],['Retained purchases',627,643,'+16',C.purple]];
labels.forEach(([label,a,b,delta,c],i)=>{
 const y=766+i*181;tag(label,94,y,c);text(delta,966,y+6,37,700,c,'end');
 for(const [name,value,j,col] of [['Fixed',a,0,'url(#hatch)'],['Planner',b,1,c]]){
  text(name,94,y+49+j*49,25,400,C.muted);const w=490*value/(b*1.1);rect(218,y+25+j*49,w,30,col,C.ink);text(value<1000?String(value):'$'+value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),752,y+49+j*49,26,600,C.ink);
 }
});
rule(94,1296,882);text('Same seed · same starting economy · AI cost included',94,1340,25,400,C.muted);
rect(1080,525,1260,865,'#fff','#a0a0a0',22);tag('(b) Native payment proof',1114,574,C.navy);
// Native receipt-card crop; the complete untouched capture is retained in assets/.
tag('Actual app receipt',1114,807,C.muted);
const receiptRegion=JSON.parse(fs.readFileSync(path.join(out,'assets/hires/regions.json'))).paypal;
photoCrop('paypal',[receiptRegion.x,receiptRegion.y,receiptRegion.width,receiptRegion.height],1114,835,1192,367);
rect(1114,611,1192,140,'#fff','#a0a0a0',13);image(path.join(assets,'paypal.svg'),1144,650,46,49);
text('$96.00',1210,667,39,700,C.navy);text('=',1403,667,35,400,C.muted);text('$3.56',1466,667,39,700,C.navy);text('+',1650,667,35,400,C.muted);text('$92.44',1712,667,39,700,C.teal);
text('test purchase',1210,713,25,400,C.muted);text('native fee',1466,713,25,400,C.muted);text('test merchant proceeds',1712,713,25,400,C.muted);
icon('History',1120,1254,48,C.blue);text('One existing purchase. One linked receipt.',1194,1285,31,700,C.navy);
text('No new sale is added by the payment proof.',1194,1331,27,400,C.muted);
text('Capture 2M324038C71499318 · linked once to the warehouse order',1114,1442,25,600,C.navy);
footer('Modeled gains; merchant contribution includes inventory value. The native Sandbox receipt uses test funds and adds no sale.');
write('05-paypal-architecture');

// 06–09 — focused native app crops, with large vector annotations.
function sideMetric(value,label,body,y){
 text(value,1868,y,60,700);text(label,1868,y+47,28,600);lines(body,1868,y+91,25,C.muted,'start',35);
}
function appImage(name,crop,x=60,y=270,w=1740,h=1170){
 rect(x,y,w,h,'#fff','#d4dae1',0);photoCrop(name,crop,x+8,y+8,w-16,h-16);
}
header('06','Agents query. The ontology verifies. Studio publishes.','Actual Agent Studio · a saved investigation, replayed through native tools');
appImage('agents',[540,0,2410,1700]);
sideMetric('2','LLM roles',['Commerce planner','and insight editor.'],355);
rule(1868,550,470);
sideMetric('6','Native tool calls',['Query → verify → publish','with saved checkpoints.'],655);
rule(1868,850,470);
sideMetric('114','Unique checkouts',['Reconciled from','125 merchant orders.'],955);
text('5 verified views',1868,1275,33,700);text('Published into AG Studio.',1868,1320,25,400,C.muted);
footer('Saved cohort investigation · AG Studio evaluation build · no new model calls or payments for this capture.');
write('06-agent-studio');

header('07','Local training. Inspectable experiments.','Actual AG Charts validation plots and AG Grid model registry');
tag('(a) Recommendation validation',60,265);
appImage('models',[850,1220,2080,780],60,300,1740,653);
sideMetric('2','Model families',['Response hurdle','and boosted models.'],390);
sideMetric('2,762','Training observations',['20 selected features','4.43 seconds of local fitting.'],680);
tag('(b) Recorded model artifacts',60,1030);
appImage('models-registry',[850,850,2050,400],60,1060,2280,400);
footer('Saved day-31 experiments · validation quality alone does not establish profit · AG Studio evaluation build.');
write('07-model-training');

header('08','Every gain has a baseline.','Actual campaign dashboard · the same seed, market and starting conditions');
appImage('impact',[740,410,2220,1580]);
sideMetric('+$114.96','Modeled PayPal net',['After estimated model cost.','Fixed: $3,309.83','Planner: $3,424.79'],365);
rule(1868,615,470);
sideMetric('+$1,024.86','Merchant contribution',['Includes inventory value.','Fixed: $38,928.95','Planner: $39,953.81'],725);
rule(1868,980,470);
sideMetric('+16','Retained purchases',['643 vs 627 under fixed rules.','Estimated AI cost: $0.032325'],1090);
footer('One saved controlled simulation · not production ROI · AG Studio evaluation build.');
write('08-campaign-impact');

header('09','Follow the checkout lineage.','Actual ontology explorer · parent checkouts, merchant portions and their evidence');
appImage('ontology',[740,390,2220,1580]);
sideMetric('1,384','Unique checkouts',['One shopper purchase','is counted once.'],355);
rule(1868,555,470);
sideMetric('1,922','Merchant orders',['Several merchants can','fulfill one checkout.'],660);
rule(1868,860,470);
sideMetric('538','Split checkouts',['The graph exposes the','parent–child relationship.'],965);
text('1 native receipt',1868,1275,33,700);text('Linked without another sale.',1868,1320,25,400,C.muted);
footer('Whole-market history through day 126, including warmup · AG Studio evaluation build.');
write('09-ontology-explorer');

// Six campaign-led product ads precede the research/evidence figures in filename order.
const A={ink:'#112746',blue:'#006bdc',muted:'#526782',paper:'#f6f8fb',line:'#dce5ee'};
function adStart(title){
 s=[`<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1600" viewBox="0 0 2400 1600"><title>${e(title)}</title><defs><filter id="ad-soft" x="-25%" y="-25%" width="150%" height="170%"><feGaussianBlur stdDeviation="20"/></filter></defs><rect width="2400" height="1600" fill="#fff"/>`];
 image(path.join(root,'demo/commerce/mark.svg'),90,65,64,64);text('Market Metro',178,111,32,700,A.ink);
 text('Agentic Commerce That Learns',2310,107,26,400,A.muted,'end');
}
function adType(value,x,y,size=144,color=A.ink,weight=700){s.push(`<text x="${x}" y="${y}" font-family="DM Sans" font-size="${size}" font-weight="${weight}" letter-spacing="${-size*.045}" fill="${color}">${e(value)}</text>`);}
function adBox(x,y,w,h,{fill='#fff',stroke=A.line,shadow=true,r=24}={}){
 if(shadow)s.push(`<rect x="${x}" y="${y+20}" width="${w}" height="${h}" rx="${r}" fill="${A.ink}" fill-opacity=".12" filter="url(#ad-soft)"/>`);
 s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
}
function adFoot(scope){rule(90,1500,2220,A.line);text(scope,90,1545,25,400,A.muted);}
function ticket(x,y,w,h,title,subtitle){
 adBox(x,y,w,h,{r:12});
 for(let px=x+14;px<x+w-12;px+=28)s.push(`<path d="M${px-14} ${y+h-1}l14 13 14-13" fill="#fff" stroke="${A.line}" stroke-width="1"/>`);
 text(title,x+44,y+65,30,700,A.ink);text(subtitle,x+44,y+106,24,400,A.muted);
 rule(x+42,y+143,w-84,A.line);
}

// Ad 1: the product promise, with the native environment as the hero asset.
adStart('Let AI do your marketing.');
image(path.join(out,'assets/hires/environment.jpg'),650,400,1790,1110);
adType('Let AI do',90,322,168);
adType('your marketing.',90,505,168,A.blue);
text('A market where agents learn, test campaigns, and show their work.',96,583,37,400,A.muted);
[['Search','Observe','Shopper signals.'],['BrainCircuit','Train','Local models.'],['ShieldCheck','Verify','A campaign with evidence.']].forEach(([ic,title,body],i)=>{
 const y=770+i*168;icon(ic,96,y,52,A.blue);text(title,174,y+42,42,700,A.ink);text(body,174,y+88,29,400,A.muted);
});
text('Follow one complete campaign.',96,1420,36,700,A.ink);
image(path.join(assets,'paypal.svg'),1980,1390,55,60);text('PayPal Sandbox',2052,1434,28,600,A.ink);
adFoot('A commerce simulation with recorded AI decisions and native PayPal Sandbox payment evidence.');
write('00-01-let-ai-do-your-marketing');

// Ad 2: the concrete reactivation story, grounded in Shopper 179's saved trace.
adStart('Give quiet shoppers a reason to return.');
adType('Give quiet shoppers',90,292,136);
adType('a reason to return.',90,450,136,A.blue);
adType('16',75,1010,490);
text('days since their last purchase.',106,1090,42,600,A.ink);
lines(['A recommendation for a mobile side table.', 'Shopper 179 returned and bought it.'],106,1195,36,A.muted,'start',54);
s.push('<g transform="rotate(2 1810 930)">');
ticket(1370,545,890,830,'SHOPPER 179','Recorded customer journey');
icon('Megaphone',1418,735,54,A.blue);text('Day 35 · recommended',1500,771,32,600,A.ink);
text('Mobile Side Table',1418,872,53,700,A.ink);
text('Form & Function',1418,922,31,400,A.muted);
adType('$96.00',1410,1130,160,A.blue);
text('Simulated purchase · day 35',1418,1192,31,400,A.muted);
rule(1412,1230,806,A.line);icon('ShieldCheck',1418,1270,42,A.ink);text('Delivered on day 36',1485,1304,32,600,A.ink);
s.push('</g>');
adFoot('Recorded shopper case · seed 92111706 · the existing $96 purchase is also linked to a native Sandbox receipt.');
write('00-02-a-reason-to-return');

// Ad 3: a visual explanation of checkout grain, not an invented financial result.
adStart('One checkout. Counted once.');
adType('One checkout.',90,305,164);
adType('Counted once.',90,491,164,A.blue);
adType('1,384',85,850,160);text('unique shopper checkouts',97,911,37,600,A.ink);
adType('1,922',85,1170,160);text('merchant-order portions',97,1231,37,600,A.ink);
adBox(1390,600,620,210,{stroke:A.blue,r:24});icon('ReceiptText',1434,647,64,A.blue);text('Parent checkout',1530,687,45,700,A.ink);text('Count this purchase once.',1434,759,30,400,A.muted);
arrow([[1700,810],[1700,900],[1310,900],[1310,1000]],A.ink);
arrow([[1700,900],[2110,900],[2110,1000]],A.ink);
ticket(1080,1000,470,330,'Merchant order','Portion 1');
ticket(1870,1000,440,330,'Merchant order','Portion 2');
text('Same parent ID',1124,1242,31,600,A.blue);text('Same parent ID',1914,1242,31,600,A.blue);
text('Verified links guide counts, joins and training data.',910,1425,31,600,A.ink);
adFoot('Whole-market history through day 126, including warmup · 538 split checkouts · relationship illustration.');
write('00-03-counted-once');

// Ad 4: the verifier actually revised the initial LLM model choice.
adStart('Make every model earn its place.');
adType('Make every model',90,292,146);
adType('earn its place.',90,465,146,A.blue);
adBox(90,635,990,718,{shadow:false,r:22});icon('BrainCircuit',138,682,60,A.ink);
text('LLM proposal',226,727,31,600,A.muted);text('Response hurdle',138,827,55,700,A.ink);
adType(saved.decision.original.auc.toFixed(3),132,1010,132);text('Recommendation AUROC',140,1061,29,400,A.muted);
adType('+$'+saved.decision.original.paypal.toFixed(2),132,1240,103);text('Mean trial PayPal net gain vs fixed',140,1297,28,400,A.muted);
arrow([[1115,1020],[1230,1020]],A.blue);
adBox(1270,600,1040,788,{stroke:A.blue,r:22});icon('ShieldCheck',1320,652,66,A.blue);
text('Verifier choice',1412,701,32,600,A.blue);text('Boosted model',1320,815,61,700,A.ink);
adType(saved.decision.chosen.auc.toFixed(3),1315,999,132);text('Recommendation AUROC',1325,1050,29,400,A.muted);
adType('+$'+saved.decision.chosen.paypal.toFixed(2),1315,1240,121,A.blue);text('Mean trial PayPal net gain vs fixed',1325,1302,30,400,A.muted);
text('The financial gate changed which model ranked shoppers.',96,1440,35,600,A.ink);
adFoot('Recorded local model review · development-trial means, USD vs fixed rules · not production ROI.');
write('00-04-make-models-earn-their-place');

// Ad 5: showcase the two real Studio roles and native verified UI.
adStart('Ask. Verify. Publish.');
adType('Ask.',90,380,198);
adType('Verify.',90,625,198);
adType('Publish.',90,870,198,A.blue);
lines(['Your business question.', 'A source-backed answer.', 'A dashboard that changes.'],99,1035,40,A.muted,'start',62);
image(path.join(assets,'gemini.svg'),99,1320,48,48);text('2 LLM roles',170,1359,32,600,A.ink);
icon('Network',99,1405,43,A.ink);text('5 verified Studio views',170,1439,32,600,A.ink);
adBox(1080,230,1225,1210,{r:24});photoCrop('agents',[1330,0,1620,1690],1105,256,1175,1160);
adFoot('Recorded AG Studio investigation · native query, ontology check, delegation and publication · evaluation build.');
write('00-05-ask-verify-publish');

// Ad 6: the outcome hook, explicitly scoped to the matched recorded simulation.
adStart('More purchases. Proof attached.');
adType('More purchases.',90,292,155);
adType('Proof attached.',90,475,155,A.blue);
adType('+16',50,1090,480);
text('retained purchases',105,1180,58,700,A.ink);
text('643 vs 627 under fixed rules',107,1250,32,400,A.muted);
text('SAME-SEED COMPARISON',1400,638,25,600,A.muted);
adType('+$114.96',1385,815,118,A.blue);text('Modeled PayPal net gain',1400,874,34,600,A.ink);text('After estimated model cost',1400,923,28,400,A.muted);
rule(1400,980,910,A.line);
adType('+$1,024.86',1385,1135,112);text('Merchant contribution gain',1400,1195,34,600,A.ink);text('Includes inventory value',1400,1244,28,400,A.muted);
image(path.join(assets,'paypal.svg'),100,1380,66,72);text('Native payment evidence: $96 Sandbox capture',200,1430,35,600,A.ink);
adFoot('Recorded simulation vs fixed rules · 12 merchants, 600 shoppers · same seed and starting conditions.');
write('00-06-more-purchases-proof-attached');

for(const name of ['06-agent-studio','07-model-training','08-campaign-impact','09-ontology-explorer'])fs.rmSync(path.join(out,'upload',name+'.jpg'),{force:true});
const manifest={created:'2026-11-11',aspectRatio:'3:2',style:'Six ad-style showcases followed by nine research and actual-app evidence images',capture:{sourcePixels:[3000,2000],layoutPixels:[1200,800],scale:2.5,format:'JPEG from browser; exported as PNG without another JPEG encode'},evidence:{source:'demo/data/judge-reactivation.json',seed:saved.seed,vsFixed:saved.vsFixed,nativeCapture:saved.receipt.capture_id},images:fs.readdirSync(path.join(out,'upload')).sort().map(name=>({name,bytes:fs.statSync(path.join(out,'upload',name)).size,kind:name.startsWith('00-')?'ad-style product showcase':Number(name.slice(0,2))<6?'research figure':'focused actual-app capture with vector annotations'}))};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
s=['<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="2250" viewBox="0 0 1800 2250"><rect width="1800" height="2250" fill="#fff"/>'];
text('MARKET METRO · SUBMISSION GALLERY',30,49,27,700,C.navy);
const previewTitles=['Let AI do your marketing','Give shoppers a reason to return','One checkout. Counted once.','Make models earn their place','Ask. Verify. Publish.','More purchases. Proof attached.','Product overview','System architecture','Ontology & data integrity','AG Studio agent handoff','PayPal & campaign value','Verified agent investigation','Training + model registry','Matched campaign impact','Checkout lineage'];
manifest.images.forEach((entry,i)=>{
 const x=30+(i%3)*590,y=82+Math.floor(i/3)*430;
 rect(x,y,560,373,'#fff','#a0a0a0');image(path.join(out,'upload',entry.name),x+1,y+1,558,371);
 text(`${String(i+1).padStart(2,'0')}  ${previewTitles[i]}`,x,y+405,21,600,C.ink);
});
s.push('</svg>');
fs.writeFileSync(path.join(out,'preview.png'),new Resvg(s.join('\n'),{font:{fontFiles:fonts,loadSystemFonts:false,defaultFontFamily:'DM Sans'}}).render().asPng());
s=['<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="960" viewBox="0 0 1800 960"><rect width="1800" height="960" fill="#fff"/>'];
text('MARKET METRO · SIX PRODUCT STORIES',30,49,27,700,A.ink);
manifest.images.slice(0,6).forEach((entry,i)=>{const x=30+(i%3)*590,y=82+Math.floor(i/3)*430;image(path.join(out,'upload',entry.name),x,y,560,373);text(`${i+1}  ${previewTitles[i]}`,x,y+405,21,600,A.ink);});
s.push('</svg>');fs.writeFileSync(path.join(out,'ad-preview.png'),new Resvg(s.join('\n'),{font:{fontFiles:fonts,loadSystemFonts:false,defaultFontFamily:'DM Sans'}}).render().asPng());
console.log(manifest.images);

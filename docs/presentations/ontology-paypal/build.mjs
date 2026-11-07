import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Presentation, PresentationFile} from '@oai/artifact-tool';
import {GlobalFonts} from '@napi-rs/canvas';
const root=process.env.METRO_ROOT||process.cwd();
const out=path.join(root,'docs/presentations/ontology-paypal');
const build=path.join(root,'.local/architecture-deck');
const assets=path.join(root,'docs/figures/planner-v23/assets');
for(const weight of [400,600,700]) GlobalFonts.registerFromPath(path.join(root,`demo/assets/fonts/dm-sans-${weight}.ttf`),'DM Sans');
const read=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const scale=await read('demo/data/metropolis-live-results.json');
const r=scale.rows.find(x=>x.merchants===384);
const receipt=(await read('demo/data/judge-reactivation.json')).receipt;
const live=await read('demo/data/ontology-live-campaign.json');
const P=Presentation.create({slideSize:{width:1600,height:900}});
P.theme.defaultFont='DM Sans';
const C={ink:'#152B45',muted:'#536B83',blue:'#0070E0',navy:'#003087',cyan:'#009CDE',line:'#C7D6E6',paper:'#FFFFFF',light:'#F2F7FC',teal:'#24767B',mint:'#EFF8F6',violet:'#746096',lav:'#F5F2FA',amber:'#A2632A',sand:'#FFF6E9',green:'#207853',red:'#AB453F'};
function shape(s,x,y,w,h,fill='none',stroke='none',geometry='rect',width=1){return s.shapes.add({geometry,position:{left:x,top:y,width:w,height:h},fill,line:{fill:stroke,width,style:'solid'}})}
function txt(s,text,x,y,w,h,size=24,color=C.ink,bold=false,align='left'){
 const v=shape(s,x,y,w,h);v.text=text;v.text.style={typeface:'DM Sans',fontSize:size,color,bold,alignment:align,verticalAlignment:'middle',insets:0,autoFit:'none',wrap:'square'};return v;
}
function line(s,x1,y1,x2,y2,color=C.line,width=2,dash=false,end=false){
 const flip=x2<x1||y2<y1;
 return s.shapes.add({geometry:'connector',kind:'straight',position:{left:Math.min(x1,x2),top:Math.min(y1,y2),width:Math.abs(x2-x1),height:Math.abs(y2-y1)},line:{fill:color,width,style:dash?'dashed':'solid'},...(end?{[flip?'head':'tail']:{type:'triangle',width:'med',length:'med'}}:{})});
}
function arrow(s,points,color=C.blue,dash=false){points.slice(1).forEach((p,i)=>line(s,...points[i],...p,color,2,dash,i===points.length-2));}
async function img(s,name,x,y,w,h){const bytes=await fs.readFile(path.join(assets,name));return s.images.add({blob:bytes,contentType:name.endsWith('.svg')?'image/svg+xml':'image/png',alt:name.replace(/[-.]/g,' '),fit:'contain',position:{left:x,top:y,width:w,height:h}});}
function panel(s,x,y,w,h,title,fill,color){const p=shape(s,x,y,w,h,fill,C.line);line(s,x,y,x,y+h,color,5);txt(s,title,x+18,y+10,w-36,34,23,color,true);return p;}
function node(s,title,sub,x,y,w,h,fill=C.paper,color=C.ink){const a=shape(s,x,y,w,h,fill,C.line,'roundRect');txt(s,title,x+14,y+12,w-28,32,24,color,true);if(sub)txt(s,sub,x+14,y+49,w-28,h-57,21,C.muted);return a;}
function footer(s,text,n){line(s,50,850,1550,850);txt(s,text,50,863,1465,24,17,C.muted);txt(s,String(n).padStart(2,'0'),1510,860,40,26,19,C.muted,false,'right');}
function page(title,subtitle){const s=P.slides.add();s.background.fill=C.paper;txt(s,title,50,40,1500,62,44,C.ink,true);if(subtitle)txt(s,subtitle,52,107,1490,36,24,C.muted);return s;}
function notes(s,text,sources=[]){s.speakerNotes.text=text+'\n\nImplementation and evidence\n'+sources.map(p=>path.join(root,p)).join('\n')+'\n\nBrand asset provenance\n'+path.join(assets,'sources.json');}
function table(s,values,x,y,width,height,widths,highlightRows=[]){const t=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width,height,columnWidths:widths,values});t.borders.assign({fill:C.line,width:.7});for(let i=0;i<values.length;i++)for(let j=0;j<values[i].length;j++){const c=t.getCell(i,j);c.fill=i===0?C.navy:highlightRows.includes(i)?C.light:C.paper;c.text.style={typeface:'DM Sans',fontSize:i===0?21:24,color:i===0?'#FFFFFF':C.ink,bold:i===0||highlightRows.includes(i),alignment:j===0?'left':'right',verticalAlignment:'middle',insets:12};}return t;}
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
const plus=n=>(n<0?'−':'+')+money(Math.abs(n));

// 1. A concise, quantified opening. All three values come from one shared market.
{
 const s=page('Market Metro','Ontology-guided commerce planning with PayPal Sandbox execution');
 txt(s,'An agent that learns what to market,\nthen checks whether the campaign pays.',55,190,1420,150,58,C.navy,true);
 txt(s,'384 merchants · 19,200 simulated shoppers · settled through day 126',58,370,1420,40,27,C.muted);
 const m=[[plus(r.delta.paypal),'Modeled PayPal net','After model inference cost'],[plus(r.delta.merchants),'Merchant contribution','Includes inventory valuation'],['+532','Retained purchases','After the return / settlement window']];
 for(let i=0;i<m.length;i++){const x=55+i*510;line(s,x,474,x+440,474,i===0?C.blue:C.line,3);txt(s,m[i][0],x,495,480,90,58,i===0?C.blue:C.ink,true);txt(s,m[i][1],x,596,470,42,28,C.ink,true);txt(s,m[i][2],x,645,465,37,23,C.muted);}
 txt(s,'Same seed and starting economy as strong fixed rules. One observed run at this scale.',58,760,1470,45,25,C.muted);
 footer(s,'Modeled outcomes in an authored economy. Native Sandbox integration is demonstrated separately.',1);
 notes(s,'Opening example, not a production ROI claim. The 384-merchant run completed through day 126 and incurred $0.059695 in token-estimated model cost. Extra retained sales volume was $78,636. The run used twelve fresh provider responses and initiated zero native PayPal payments. There is one seed at this scale, not an unseen-seed confidence interval. We retain the negative merchant result at 96 merchants in the final slide.', ['demo/data/metropolis-live-results.json','docs/commerce-metropolis/README.md']);
}
// 2. Revised implementation. The old five planes remain, and ontology is the new bridge.
{
 const s=page('Revised system architecture','Five existing planes, with ontology checks for evidence and training.');
 panel(s,50,175,400,375,'A  Market environment',C.mint,C.teal);
 await img(s,'environment-snapshot.png',66,225,368,218);
 txt(s,'Browse → buy → receive',72,458,355,34,24,C.ink,true);
 txt(s,'Shared economy · 384-store limit',72,501,357,28,21,C.muted);
 panel(s,50,590,400,240,'C  Data plane',C.light,C.navy);
 await img(s,'sqlite.svg',74,647,38,38);
 txt(s,'SQLite warehouse',127,646,289,37,27,C.ink,true);
 txt(s,'Checkouts • merchant orders\nContacts • returns • receipts\nModels • decisions • checkpoints',75,700,345,104,23,C.muted);
 panel(s,500,175,340,655,'Ontology layer',C.sand,C.amber);
 txt(s,'1  Verify the feed',522,238,294,36,27,C.ink,true);
 txt(s,'Resolve keys and money units.\nCount each checkout once.',522,285,292,66,23,C.muted);
 const co=node(s,'Checkout','one payment',566,381,207,81,C.paper,C.amber);
 const mo1=node(s,'Order A','',520,493,142,57,C.paper,C.amber),mo2=node(s,'Order B','',678,493,142,57,C.paper,C.amber);
 arrow(s,[[627,462],[627,477],[591,477],[591,493]],C.amber);arrow(s,[[711,462],[711,477],[749,477],[749,493]],C.amber);
 txt(s,'2  Define training',522,578,295,38,27,C.ink,true);
 txt(s,'Correct target + contact cohort\nAllowed pre-contact features\nMature outcomes for labels',522,630,298,100,22,C.muted);
 txt(s,'Ambiguous feed → HOLD',522,763,300,38,24,C.amber,true);
 panel(s,895,175,655,277,'B  LLM agent',C.lav,C.violet);
 await img(s,'google-cloud.svg',1484,187,37,32);
 const nodes=[['Investigate','Demand + payment signals'],['Train','Choose data + features'],['Plan','Propose + revise campaign']];
 nodes.forEach((n,i)=>node(s,n[0],n[1],916+i*209,246,190,117,C.paper,C.violet));
 arrow(s,[[1106,303],[1125,303]],C.violet);arrow(s,[[1315,303],[1334,303]],C.violet);
 txt(s,'Every choice saves evidence IDs and a checkpoint',918,391,595,37,23,C.violet);
 panel(s,895,500,655,164,'D  Local tools + experiment sandbox',C.lav,C.violet);
 await img(s,'scikit-learn.svg',918,554,54,40);
 txt(s,'Model fit',979,553,160,30,23,C.ink,true);
 txt(s,'3 proxy trials',1140,553,170,30,23,C.ink,true);
 txt(s,'Verify + bind',1340,553,185,30,23,C.ink,true);
 txt(s,'Python / sklearn',918,600,198,31,21,C.muted);
 txt(s,'600 shoppers each',1137,600,198,31,21,C.muted);
 txt(s,'Publish or keep policy',1335,600,204,31,20,C.muted);
 panel(s,895,712,655,118,'E  PayPal execution',C.light,C.blue);
 await img(s,'paypal.svg',918,760,40,48);
 txt(s,'Saved wallet → capture → linked receipt',980,759,545,38,24,C.navy,true);
 arrow(s,[[250,550],[250,590]],C.teal);
 arrow(s,[[450,709],[500,709]],C.navy);
 arrow(s,[[840,310],[895,310]],C.amber);
 arrow(s,[[1220,452],[1220,500]],C.violet);
 arrow(s,[[1527,500],[1527,452]],C.violet,true);
 arrow(s,[[895,788],[872,788],[872,840],[470,840],[470,784],[450,784]],C.blue,true);
 txt(s,'order ↔ receipt',574,813,265,26,18,C.blue,false,'center');
 // Campaign return line is intentionally above the system planes.
 arrow(s,[[1550,581],[1575,581],[1575,157],[250,157],[250,175]],C.teal);
 txt(s,'checked campaign returns to the market',930,130,470,28,18,C.teal);
 footer(s,'Proxy trials screen proposals. The final comparison runs the full market. Screenshot shows the saved representative app view.',2);
 notes(s,'This extends the existing A-E architecture in docs/figures/planner-v23. A and C preserve the environment and warehouse. Ontology is a new logical bridge on warehouse exports, not a separate database service. B is one LLM with bounded tools, not a claim of several autonomous LLMs. D executes training, deterministic financial guards and immutable contract binding. The financial verifier uses three 12-merchant/600-shopper proxy markets. Reviews pause economic dates at displayed days 31 and 61. E runs selected native Sandbox orders and returns provider-linked receipts; the large-scale validation itself makes no native payments. The saved screenshot depicts an earlier representative view of the same renderer. The small checkout graph shows cardinality only; its A/B merchant legs are schematic. Agent decisions and tool results are checkpointed. The return line denotes only a checked campaign, not unrestricted LLM execution.', ['docs/figures/planner-v23/README.md','scripts/commerce-metropolis/feed-gate.mjs','scripts/commerce-metropolis/feed-verifier.mjs','scripts/commerce-metropolis/harness/controller.mjs','scripts/commerce-metropolis/harness/contracts.mjs','scripts/ontology/planner-training.mjs','scripts/commerce-growth/autonomy/live.mjs']);
}
// 3. Mapping and measurable ontology role.
{
 const s=page('Where the ontology changes the existing system','Two enforceable boundaries — feed admission and training — with saved reasons for every hold.');
 txt(s,'EXISTING PLANE',55,176,340,36,21,C.muted,true);
 txt(s,'REVISED RESPONSIBILITY',470,176,640,36,21,C.muted,true);
 txt(s,'WHAT THE JUDGE SEES',1150,176,390,36,21,C.muted,true);
 const rows=[
 ['A  Market','Same seeded shopper and stock rules','Live market'],
 ['C  Data','Checkout ↔ merchant-order identities','Ontology graph'],
 ['B  Agent','Choose a target, cohort and feature list','Reason + tool call'],
 ['D  Tools / verifier','Check maturity, fit model, test campaign','Fit + trial + publish / hold'],
 ['E  PayPal','Reconcile gross, fee and merchant proceeds','Native receipt lineage']];
 rows.forEach((a,i)=>{const y=231+i*83;line(s,52,y-9,1548,y-9);txt(s,a[0],55,y,378,50,25,C.ink,true);txt(s,a[1],470,y,630,50,25,C.muted);txt(s,a[2],1150,y,390,50,24,C.navy);});
 line(s,52,647,1548,647);
 txt(s,'12/12',58,681,250,84,56,C.blue,true);txt(s,'valid feeds certified',58,768,365,35,24,C.ink);
 txt(s,'6/12',510,681,250,84,56,C.muted,true);txt(s,'with the fixed mapping',510,768,365,35,24,C.ink);
 txt(s,'12/12',990,681,250,84,56,C.amber,true);txt(s,'unsafe feeds held by both',990,768,510,35,24,C.ink);
 footer(s,'Held-out authored feed study · 24 cases · zero unsafe feeds certified by either approach. NVIDIA-inspired, project-owned verifier.',3);
 notes(s,'Architecture correspondence uses the labels of the earlier diagram. File map: A scripts/commerce-metropolis/kernel.mjs, environment.mjs and engine.mjs. C scripts/commerce-metropolis/warehouse.mjs and feed-verifier.mjs. Ontology training rules in scripts/ontology/training.mjs and planner-training.mjs. B-D scripts/commerce-metropolis/harness/controller.mjs, tools.mjs, trials.mjs, contracts.mjs, model-check.mjs. Saved app state in scripts/commerce-growth/autonomy/live.mjs. Native payments use the existing server PayPal handlers and receipt warehouse. The feed benchmark is a controlled authored schema-family test, not arbitrary real merchant data. The 2x number is usable valid-feed coverage only. Both methods held all 12 unsafe feeds, so ontology is not credited with unique safety gains there. It is inspired by NVIDIA auto-ontology, not a deployed NVIDIA runtime or a partnership.', ['demo/data/ontology-study.json','docs/ontology/README.md','scripts/ontology/training.mjs','scripts/ontology/planner-training.mjs','scripts/commerce-metropolis/warehouse.mjs']);
}
// 4. PayPal-centered system with real and modeled roles kept visibly separate.
{
 const s=page('PayPal at the center of the commerce loop','The agent optimizes payment outcomes. Selected purchases prove the execution and reconciliation path.');
 node(s,'LLM campaign planner','Checks payment value together with merchant contribution',530,173,540,115,C.lav,C.violet);
 const central=shape(s,600,365,400,304,C.light,C.blue,'roundRect',2);
 await img(s,'paypal.svg',629,391,63,74);
 txt(s,'PayPal',710,393,250,67,42,C.navy,true);
 txt(s,'Sandbox execution',630,473,340,36,29,C.navy,true);
 txt(s,'Saved wallet → Orders → Capture',630,512,340,45,22,C.ink);
 line(s,626,566,974,566,C.line);
 txt(s,'Modeled PayPal net gain',630,577,340,30,22,C.blue,true);
 txt(s,'+$3,310.75',630,613,340,43,34,C.navy,true);
 node(s,'Simulated shoppers','Receive relevant outreach.\nFund requests and keep purchases.',50,390,430,154,C.mint,C.teal);
 node(s,'Merchants / test store','Market measures contribution.\nNative payment uses one test store.',1120,390,430,154,C.mint,C.teal);
 txt(s,'+532 retained purchases',64,567,430,42,30,C.teal,true);
 txt(s,'+$36,042.88 contribution',1130,567,428,42,30,C.teal,true);
 node(s,'Ontology + warehouse','One checkout, linked merchant legs.\nGross = fee + test merchant proceeds.',50,690,480,133,C.sand,C.amber);
 node(s,'Archived native receipt','$96.00 gross − $3.56 fee = $92.44 net\nCOMPLETED · fictitious test funds',1070,690,480,133,C.light,C.blue);
 arrow(s,[[800,288],[800,365]],C.violet,true);
 txt(s,'fees + funding checks',815,309,285,31,21,C.violet);
 arrow(s,[[480,466],[600,466]],C.blue);
 txt(s,'selected\norder',491,397,106,62,20,C.blue,false,'center');
 arrow(s,[[1000,466],[1120,466]],C.blue);
 txt(s,'test\nproceeds',1009,397,104,62,20,C.blue,false,'center');
 arrow(s,[[800,669],[800,751],[1070,751]],C.blue);
 arrow(s,[[1070,790],[555,790],[530,790]],C.blue);
 txt(s,'receipt + order link',637,755,390,29,20,C.blue,false,'center');
 arrow(s,[[50,723],[35,723],[35,241],[530,241]],C.amber,true);
 txt(s,'validated outcomes',170,252,305,34,21,C.amber);
 footer(s,'Solid blue = native test payment / receipt path. Dashed = analysis. Gains are modeled; the archived $96 receipt is a separate 12-store run.',4);
 notes(s,'PayPal is central through two concrete responsibilities. First, native Sandbox execution proves saved buyer consent, Orders create/capture and exact receipt reconciliation. Second, the simulator models payment fees, processing, refunds, outreach and supplier settlement, and the verifier measures platform and merchant outcomes together. The current scaled study generated zero native payments, so the archived $96 receipt cannot be presented as a new 384-store receipt. Capture ID 2M324038C71499318 belongs to order GARDEN-AUTO-e26323c97cbcb456-SIM-CAPTURE-756-MERCHANT-7, PayPal order 7Y121350Y1983874T, USD 96 gross, 3.56 fee, 92.44 merchant proceeds. These proceeds are not PayPal profit. The diagram shows the validated active path. It does not claim autonomous production access, live revenue, PayPal internal customer data, or completed use of every PayPal product. Modeled fee assumptions differ from native receipt charges. The retained purchases and merchant gain around the diagram are from the 384-store run. The small left return line represents the warehouse feeding validated analysis to the planner.', ['demo/data/judge-reactivation.json','demo/data/metropolis-live-results.json','scripts/commerce-metropolis/kernel.mjs','scripts/commerce-metropolis/balances.mjs','scripts/commerce-metropolis/suppliers.mjs']);
}
// 5. Concrete LLM decisions versus deterministic work.
{
 const s=page('One real review, followed through to the outcome','384-merchant run · fresh model responses · economic time pauses while the review runs');
 const xs=[55,445,835,1225], ww=325;
 const steps=[['DAY 31 · LLM','Choose evidence','28-day window\nProduct-contact target\nEight pre-contact features'],['LOCAL MODEL FIT','Compare predictions','Recommendation AUC\n0.7503 → 0.7620\nOntology model selected'],['LLM + VERIFIER','Revise the campaign','Intent assistance\nRecent-14 demand forecast\n7-day stock cover'],['CHECKPOINT','Publish the plan','10 contacts / 100 shoppers\nAffordable product preference\nModeled fast settlement']];
 steps.forEach((a,i)=>{const x=xs[i];txt(s,a[0],x,195,ww,35,20,i===0||i===2?C.violet:C.blue,true);line(s,x,245,x+ww,245,C.line,2);txt(s,a[1],x,270,ww,74,33,C.ink,true);txt(s,a[2],x,366,ww,150,25,C.muted);if(i<3)arrow(s,[[x+ww+9,306],[xs[i+1]-16,306]],C.blue);});
 line(s,55,551,1550,551);
 txt(s,'DAY 61',55,596,290,40,24,C.violet,true);
 txt(s,'A new recommendation campaign failed the verifier.\nThe system kept the approved day-31 policy.',350,583,1200,103,32,C.ink,true);
 txt(s,'DAY 126',55,730,290,40,24,C.teal,true);
 txt(s,'+532 retained purchases  ·  +$78,636 retained sales volume',350,715,1190,70,34,C.teal,true);
 footer(s,'AUC is compared on recommendation contacts. Campaign trials use 600-shopper proxies; final financial results use the full market.',5);
 notes(s,'What the LLM actually chose: investigate payment funnel and intent freshness, select a 28-day intent_context dataset, request boosted training for retained_recommendation with age, search, signal_count, category_affinity, recency, prior_purchases, price_usd and stock. Model d746ce0f65a0 used 2762 pooled rows. Ontology model acb28b01cf5a used 1230 product contacts. Their recommendation-contact AUC values were 0.750325 and 0.762041. The first LLM proposal used adaptive forecast, three cover days and six contacts/100. It failed the proxy verifier. A deterministic component trial with recent14 and seven cover days passed. The LLM used those results to request ten contacts/100 with the same chosen ontology model. The exact contract hash dab9b207c04dc90129b92bc68de26e3fefe38f842021d6931f666b20242f1aad was approved and executed. At day61 the LLM trained another pair with 56-day market_feedback data. The broader candidate had better prediction metrics there. New product-only campaigns did not pass the incumbent checks, so no campaign replacement was published. The workflow includes judgment and deterministic evidence production; we do not credit the LLM with inventing the fixed component trial or executing arbitrary code.', ['demo/data/metropolis-live-results.json','scripts/commerce-metropolis/harness/tools.mjs','scripts/commerce-metropolis/harness/model-check.mjs']);
}
// 6. Separate direct planner comparison, preserving the small study's scope.
{
 const s=page('Fixed rules, planner, planner + ontology','Matched 12-merchant / 600-shopper campaign · one seed · fresh LLM decisions in both planner arms');
 const vals=[['Approach','Modeled PayPal net','Merchant contribution','Retained purchases'],['Fixed rules','$3,309.83','$38,928.95','627'],['Planner','$3,391.08','$39,494.31','642'],['Planner + ontology','$3,424.78','$39,953.81','643']];
 table(s,vals,55,205,1490,335,[460,330,390,310],[3]);
 txt(s,'+$33.70',60,588,410,87,56,C.blue,true);txt(s,'PayPal net vs planner',60,683,410,42,27,C.ink,true);
 txt(s,'+$459.50',570,588,430,87,56,C.ink,true);txt(s,'Merchant contribution vs planner',570,683,440,75,27,C.ink,true);
 txt(s,'+1',1110,588,360,87,56,C.teal,true);txt(s,'Retained purchase vs planner',1110,683,400,75,27,C.ink,true);
 footer(s,'This is one end-to-end comparison. Fresh decisions also changed; it does not isolate the causal effect of ontology alone.',6);
 notes(s,'Direct three-way evidence from ontology-live-campaign.json. Values after model inference cost. Total model estimate across the two LLM arms was $0.077443 for twelve responses. The ontology arm in this older 12-store trial retained the broader 20-field model after the proposed 8-feature model was weaker. Do not confuse it with the newer 384-store run where the eight-feature ontology model was actually deployed. The demonstrated benefit is the complete workflow, including selecting or rejecting training candidates. No claim of a pure ablation or repeated-seed statistical significance. Exact values are fixed 3309.83, planner 3391.075432, planner ontology 3424.777125. Merchant contribution 38928.95,39494.31,39953.81. Purchases627,642,643.', ['demo/data/ontology-live-campaign.json','docs/ontology/README.md']);
}
// 7. Scaling evidence and judge navigation, including the negative case.
{
 const s=page('Scaling the shared market','Fresh planner + ontology decisions at each size · matched fixed comparator · settled through day 126');
 table(s,[['Merchants / shoppers','Δ PayPal net','Δ merchant contribution','Δ retained purchases'],...scale.rows.map(v=>[`${v.merchants} / ${v.shoppers.toLocaleString('en-US')}`,plus(v.delta.paypal),plus(v.delta.merchants),`+${v.delta.purchases}`])],55,197,1490,300,[450,330,410,300],[3]);
 txt(s,'The 384-store run',57,546,440,50,32,C.ink,true);
 txt(s,'12 fresh decisions\n$0.059695 estimated inference cost\n0 unpaid liabilities at settlement',57,609,680,132,27,C.muted);
 txt(s,'Judge walkthrough',844,546,650,50,32,C.ink,true);
 txt(s,'1  Observe the market\n2  Inspect ontology associations\n3  Follow the plan and verifier\n4  Compare results and receipt lineage',844,606,690,168,26,C.navy);
 footer(s,'One seed per size. The 96-store merchant result is negative. Scaling combines population and policy effects; $96 Sandbox proof is separate.',7);
 notes(s,'The scale ladder is one shared market at each size, not a sum of independent districts. Planner and fixed use identical generated needs, consent, income and starting state. Fees, processing rules and simulator version stay the same within each paired comparison. At 384 stores, fixed vs planner net is 100111.95 vs103422.700305, merchant contribution1254057.38 vs1290100.26, purchases19810vs20342, retainedvolume2816704vs2895340. PayPal modeled net is the change in platform account after modeled retail/supplier fees, processing, outreach, and settled refund/fee obligations, then model-cost deduction. It is not gross sales or actual corporate profit. Merchant contribution includes inventory and pipeline valuation. Cautions: scale proposals are checked on three 600-shopper proxy markets, one seed per size, fresh policy choices differ across sizes, no native payments were made by these scale runs. The successful scale calls cost0.177020 in total, or0.218706 including the interrupted attempt. The project ledger snapshot was7.573648 under the user50dollarcap. The judge routes are studio.html?session=AUTONOMY-d8f8e3695c9118cb&view=market&judge=1, then view=ontology, view=workflow, view=performance. Archived native receipt appears in judge.html#result. The app renderer shows representative shoppers and pages32stores while all384merchants and19200shoppers participate.', ['demo/data/metropolis-live-results.json','docs/commerce-metropolis/README.md','scripts/commerce-metropolis/balances.mjs','scripts/commerce-metropolis/live-data.mjs']);
}
await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(build,'deck.json'),JSON.stringify(P.toProto()));
for(let i=0;i<P.slides.items.length;i++){
 const s=P.slides.items[i];
 const stem=`slide-${String(i+1).padStart(2,'0')}`;
 await fs.writeFile(path.join(out,stem+'.png'),new Uint8Array(await (await P.export({slide:s,format:'png',scale:1})).arrayBuffer()));
 await fs.writeFile(path.join(build,stem+'.layout.json'),await (await s.export({format:'layout'})).text());
}
await(await PresentationFile.exportPptx(P)).save(path.join(build,'candidate.pptx'));
const spec={sourceCommit:'09888186b7c746ce7b60c32baa8e9c93956c0c51',created:'2026-11-07',font:'DM Sans',slides:7,evidence:['demo/data/metropolis-live-results.json','demo/data/judge-reactivation.json','demo/data/ontology-live-campaign.json','demo/data/ontology-study.json'].map(p=>({path:p}))};
for(const f of spec.evidence) f.sha256=createHash('sha256').update(await fs.readFile(path.join(root,f.path))).digest('hex');
await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(spec,null,2)+'\n');
console.log(JSON.stringify({slides:7,draft:path.join(build,'candidate.pptx'),previews:out}));

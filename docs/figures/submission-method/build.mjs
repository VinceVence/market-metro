import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const root=process.cwd(),out=path.join(root,'docs/figures/submission-method');
const require=createRequire(path.join(root,'.local/diagram-tools/package.json'));
const {Resvg}=require('@resvg/resvg-js');
fs.mkdirSync(out,{recursive:true});
const C={ink:'#173046',muted:'#657789',line:'#b8c6d2',blue:'#2d659b',teal:'#4d866b',purple:'#8063a2',amber:'#b77b40',paypal:'#003087'};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
let svg=[];
function text(s,x,y,size=25,weight=400,color=C.ink,anchor='start'){
 svg.push(`<text x="${x}" y="${y}" font-family="DM Sans" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(s)}</text>`);
}
function lines(a,x,y,size=23,color=C.muted,anchor='start'){a.forEach((s,i)=>text(s,x,y+i*(size+8),size,400,color,anchor));}
function rect(x,y,w,h,fill='#fff',stroke=C.line,rx=14,dash=''){
 svg.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="1.6" ${dash?`stroke-dasharray="${dash}"`:''}/>`);
}
function arrow(points,color=C.ink,dashed=false,head=true){
 svg.push(`<path d="${points.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" ${dashed?'stroke-dasharray="8 7"':''} ${head?`marker-end="url(#arrow-${color.slice(1)})"`:''}/>`);
}
function icon(name,x,y,size=44,color=C.ink){
 const raw=fs.readFileSync(path.join(root,'docs/presentations/ontology-paypal/vectors',name+'.svg'),'utf8');
 const body=raw.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').replaceAll('currentColor',color);
 svg.push(`<g transform="translate(${x} ${y}) scale(${size/24})" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</g>`);
}
function image(file,x,y,w,h){const ext=path.extname(file),mime=ext==='.svg'?'image/svg+xml':'image/png';svg.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" href="data:${mime};base64,${fs.readFileSync(path.join(root,file)).toString('base64')}"/>`);}
function card(x,y,w,h,name,title,body,color,fill='#fff'){
 rect(x,y,w,h,fill,color);icon(name,x+22,y+23,43,color);text(title,x+82,y+53,26,700,color);lines(body,x+24,y+99,22);
}
function node(x,y,label,color,dx=0,dy=35,anchor='middle'){
 svg.push(`<circle cx="${x}" cy="${y}" r="12" fill="${color}" stroke="#fff" stroke-width="3"/>`);text(label,x+dx,y+dy,22,600,color,anchor);
}

svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1440" viewBox="0 0 2400 1440" role="img" aria-labelledby="title desc"><title id="title">Market Metro system architecture: fixed campaign rules and ontology-guided planning</title><desc id="desc">Shared seeded commerce data feeds a fixed policy and an ontology-guided LLM workflow. Typed tools train and test candidate models. A deterministic verifier publishes a bound campaign or keeps the incumbent. Both policies are measured through paired settlement; selected saved orders separately receive native PayPal Sandbox receipts, inspected in AG Grid.</desc><defs>`);
for(const c of Object.values(C))svg.push(`<marker id="arrow-${c.slice(1)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${c}"/></marker>`);
svg.push('</defs><rect width="2400" height="1440" fill="#fff"/>');
text('MARKET METRO',60,53,22,700,C.blue);text('From commerce data to a tested campaign',60,105,43,700);
text('Shared inputs. Different decision paths. Comparable outcomes.',60,145,24,400,C.muted);

// Shared environment and warehouse, outside the decision-policy comparison.
rect(60,183,2280,153,'#f8fafc','#d5dfe7');
image('docs/figures/planner-v23/assets/environment-snapshot.png',80,199,258,120);
text('Environment',360,227,27,700);lines(['Seeded shoppers, stock,','cash and demand'],360,262,22);
icon('History',790,222,54,C.blue);text('Warehouse',865,227,27,700);lines(['Activity, contacts, orders,','settled outcomes and receipts'],865,262,22);
icon('ShieldCheck',1440,222,54,C.teal);text('Observation boundary',1515,227,27,700);lines(['Same cutoff for both arms;','no future active-market outcomes'],1515,262,22);
arrow([[670,258],[745,258]],C.blue);
arrow([[390,336],[390,385]],C.blue);arrow([[1330,336],[1330,385]],C.blue);

// Parallel policy panes echo the user's paper figure, without importing its algorithm.
rect(60,395,680,650,'#fbfdff','#a8bfd6',18);
rect(790,395,1550,650,'#fff','#b8cdbf',18);
text('(a) Fixed campaign rules',90,440,30,700,C.blue);
text('Policy logic stays fixed during the run',90,478,22,400,C.muted);
card(95,530,260,145,'SlidersHorizontal','Rulebook',['Preset campaign logic'],C.blue,'#f5f9fe');
card(445,530,260,145,'Megaphone','Campaign',['Products, timing, offers'],C.blue,'#f5f9fe');
arrow([[355,603],[445,603]],C.blue);
arrow([[575,675],[575,710],[400,710],[400,745]],C.blue);
card(140,745,520,160,'Store','Market execution',['Same stock, cash and','fulfillment constraints'],C.blue);
arrow([[400,905],[400,976]],C.blue);
text('Settle and measure',400,1010,26,700,C.blue,'middle');

text('(b) Ontology-guided planner + verifier',820,440,30,700,C.teal);
text('One LLM chooses bounded actions; trusted tools execute and verify them',820,478,22,400,C.muted);
card(825,530,250,145,'Search','Question',['Who to contact?','What to recommend?'],C.ink);
arrow([[1075,600],[1110,600]],C.ink);

// Typed ontology: relationships and prediction-time meaning, not SpectRAG diffusion.
rect(1110,515,405,345,'#f8fcf9',C.teal,32,'5 6');
text('Ontology',1312,541,27,700,C.teal,'middle');
for(const e of [ [[1170,650],[1300,610]],[[1300,610],[1430,650]],[[1170,650],[1300,728]],[[1430,650],[1300,728]],[[1300,728],[1190,804]],[[1190,804],[1420,804]],[[1300,728],[1420,804]] ])arrow(e,'#9baea3',false,false);
node(1170,650,'Shopper',C.blue,0,34);
node(1300,610,'Prior interest',C.teal,0,-26);
node(1430,650,'Product',C.teal,0,34);
node(1300,728,'Contact',C.blue,0,30);
node(1190,804,'Checkout',C.blue,0,34);
node(1420,804,'Merchant order',C.amber,0,34);
text('1:n',1303,796,18,600,C.muted,'middle');
rect(1110,892,405,100,'#fff',C.teal,14,'5 5');icon('ShieldCheck',1129,918,35,C.teal);lines(['Identity, grain and timing','Target → rows → valid features'],1180,927,21,C.teal);

arrow([[1515,605],[1570,605]],C.teal);
card(1570,530,345,145,'BrainCircuit','LLM planner',['Analyze • choose • revise','Target, cohort and features'],C.purple,'#faf7fd');
card(1980,530,310,145,'ShieldCheck','Verifier',['Financial guards','Owns publication'],C.teal,'#f5faf7');
arrow([[1915,605],[1980,605]],C.purple);
arrow([[2030,733],[2030,710],[1950,710],[1950,511],[1742,511],[1742,530]],C.purple,true);text('trial feedback',1845,503,18,500,C.purple,'middle');

card(1570,733,345,133,'SlidersHorizontal','Local tools',['Fit models • score campaigns'],C.amber,'#fffaf3');
card(1980,733,310,155,'FlaskConical','Matched trials',['Separate development','markets'],C.amber,'#fffaf3');
arrow([[1742,675],[1742,733]],C.purple);arrow([[1915,800],[1980,800]],C.amber);arrow([[2135,733],[2135,675]],C.amber);
rect(1570,905,345,87,'#fff',C.purple,12,'5 5');icon('History',1590,929,34,C.purple);lines(['Saved checkpoints','Inputs • results • decisions'],1640,936,20,C.purple);
arrow([[1742,866],[1742,905]],C.purple,true);
rect(1980,905,310,87,'#f4faf6',C.teal);icon('ShieldCheck',1999,928,36,C.teal);lines(['Publish tested contract','or retain the incumbent'],2049,937,21,C.teal);
arrow([[2290,602],[2316,602],[2316,949],[2290,949]],C.teal);
arrow([[2135,992],[2135,1070]],C.teal);
arrow([[400,1031],[400,1070]],C.blue);

// Evaluation and the separate provider evidence lane.
rect(60,1081,2280,221,'#f8fafc','#c6d3de');
icon('FlaskConical',85,1110,48,C.ink);text('Paired settlement',151,1144,27,700);
lines(['Purchases, payment volume,','merchant contribution, modeled','PayPal net and inference cost'],86,1189,22);
image('docs/figures/planner-v23/assets/paypal.svg',755,1100,65,55);text('PayPal Sandbox',856,1144,28,700,C.paypal);
text('Selected saved order → capture → receipt',756,1189,23,600,C.paypal);
text('$96 = $3.56 fee + $92.44 merchant proceeds',756,1229,23,400,C.ink);
text('Native test funds; linked once to the warehouse order',756,1265,20,400,C.muted);
icon('Network',1695,1112,48,C.blue);text('AG Grid review',1761,1144,27,700,C.blue);
lines(['Models • decisions • receipts','Auditable evidence for judges'],1695,1189,22);
text('Modeling results and native receipts stay distinct',1695,1265,20,400,C.muted);
arrow([[1515,1189],[1640,1189]],C.paypal);
arrow([[650,1189],[725,1189]],C.paypal);

rect(60,1335,2280,67,'#fff','#ccd7df',13);
const legend=[['Data / fixed rules',C.blue],['Ontology checks',C.teal],['LLM decisions',C.purple],['Trusted tools',C.amber],['Native PayPal path',C.paypal]];
legend.forEach(([label,color],i)=>{svg.push(`<rect x="${84+i*325}" y="1358" width="22" height="22" rx="4" fill="${color}"/>`);text(label,117+i*325,1377,21,500,C.ink);});
arrow([[1760,1369],[1810,1369]],C.ink);text('Flow',1828,1377,21);arrow([[1955,1369],[2010,1369]],C.purple,true);text('Review / feedback',2025,1377,21);
svg.push('</svg>');
const body=svg.join('\n');
fs.writeFileSync(path.join(out,'system-comparison.svg'),body);
const raster=new Resvg(body,{font:{fontFiles:[400,600,700].map(w=>path.join(root,`demo/assets/fonts/dm-sans-${w}.ttf`)),loadSystemFonts:false,defaultFontFamily:'DM Sans'},fitTo:{mode:'width',value:2400}});
fs.writeFileSync(path.join(out,'system-comparison.png'),raster.render().asPng());
console.log('Wrote system-comparison.svg and 2400px PNG');

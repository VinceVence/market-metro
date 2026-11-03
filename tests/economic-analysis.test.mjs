import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {exploreMarket,analyzeTrends,buildRecommendations} from '../scripts/commerce-growth/autonomy/economic-analysis.mjs';
import {economicResources,runEconomicPatch} from '../scripts/commerce-growth/autonomy/economic-runtime.mjs';
import {openEconomicHarness,compactEconomicEvidence} from '../scripts/commerce-growth/autonomy/economic-harness.mjs';
import {economicContactPlan,economicObservation} from '../scripts/commerce-growth/autonomy/economic-tools.mjs';
import {warmGrowthWorld} from '../scripts/commerce-growth/evaluate.mjs';import {beginGrowthDay} from '../scripts/commerce-growth/environment.mjs';
import {openAllocator} from '../scripts/commerce-deadlines/solver.mjs';
const r=await economicResources(),source=JSON.parse(await readFile('docs/commerce-growth/economic-final-1/public-observation.json','utf8'));
test('EDA excludes future rows, reconciles category revenue and preserves missing attribution',()=>{
 const v=structuredClone(source),before=exploreMarket(v,{dimension:'category',windowDays:14});
 assert.ok(Math.abs(before.rows.reduce((s,g)=>s+g.grossUSD,0)-before.totals.capturedUSD)<1e-8);
 v.pastOrders.push({...v.pastOrders[0],id:'future',day:999,grossCents:999999999});
 const after=exploreMarket(v,{dimension:'category',windowDays:14});assert.deepEqual(after.rows,before.rows);assert.equal(after.quality.orders.futureOrCurrentExcluded,1);
 const merchants=exploreMarket(v,{dimension:'merchant',windowDays:14});assert.ok(merchants.rows.every(g=>g.signals===null&&g.contacts===null));
});
test('trends use equal historical windows and flag sparse or warmup comparisons',()=>{
 const v=structuredClone(source),category=v.products[0].category;v.observedSignals=[];
 for(let day=46;day<60;day++)for(let i=0;i<(day<53?1:3);i++)v.observedSignals.push({day,category,customerId:'P'+i,kind:'SEARCH'});
 v.observedSignals.push({day:999,category,customerId:'future',kind:'SEARCH'});
 const t=analyzeTrends(v,{windowDays:7}),row=t.rows.find(r=>r.category===category);assert.equal(row.rateRatio.interestedShoppers,3);assert.equal(row.interpretableInterestTrend,true);assert.ok(t.series.every(s=>s.day<60));
 const warm=analyzeTrends({...v,day:35},{windowDays:7});assert.equal(warm.phaseComparable,false);assert.ok(warm.rows.every(r=>!r.interpretableInterestTrend));
 const sparse=analyzeTrends({...v,observedSignals:[]},{windowDays:7});assert.ok(sparse.rows.every(r=>r.rateRatio.interestedShoppers===null&&!r.interpretableInterestTrend));
});
test('multiple-interest ranking considers more observed products and obeys consent and contact limits',()=>{
 const v=structuredClone(source),person=v.audience[0],catalog=[...new Map(v.products.map(p=>[p.catalogId,p])).values()];
 for(const p of v.audience)p.marketingConsent=p===person;
 Object.assign(person,{lastContactDay:null,hasOpenRequest:false,purchaseCount:2,lastPurchaseDay:40});
 v.signals=[{day:58,customerId:person.customerId,catalogId:catalog[0].catalogId,category:catalog[0].category,kind:'SEARCH'},{day:59,customerId:person.customerId,catalogId:catalog[1].catalogId,category:catalog[1].category,kind:'SEARCH'}];person.signal=v.signals[1];
 for(const p of v.products)p.available=Math.max(5,p.available);const original=JSON.stringify(v),recipe={mode:'multiple_interests',segment:'all',category:'all'};
 const a=buildRecommendations(v,r,{...recipe,mode:'latest_interest'}),b=buildRecommendations(v,r,recipe);
 assert.equal(a.diagnostics.scoredProducts,1);assert.equal(b.diagnostics.scoredProducts,2);assert.ok(b.actions.length<=1);assert.ok(b.actions.every(x=>x.customerId===person.customerId));assert.equal(JSON.stringify(v),original);
 assert.throws(()=>buildRecommendations(v,r,{...recipe,customerIds:['private']}),/INVALID_RECOMMENDATION_RECIPE/);
 const candidate={policy:{campaign:'targeted_recommendations'},recommendations:{...b,rows:[{customerId:'WRONG-SNAPSHOT'}]}};assert.deepEqual(economicContactPlan(v,r,candidate).actions,b.actions);
});
test('recommendation campaigns require grounded analysis and bind their scored artifact',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'economic-analysis-')),v=structuredClone(source);
 try{
  const h=await openEconomicHarness({view:v,resources:r,path:join(dir,'state.json'),historyDescription:{id:'H1'},compareHistorical:async()=>{throw Error('NO_TRIAL_EXPECTED');}}),recipe={mode:'multiple_interests',segment:'all',category:'all'};
  await assert.rejects(h.execute('build_recommendations',{recipe,evidence_ids:[],reason:'No evidence.'}),/EDA_AND_TRENDS_REQUIRED/);
  const baseline=await h.execute('inspect_baseline_policy',{reason:'Read the real baseline.'}),eda=await h.execute('explore_market',{dimension:'category',window_days:14,reason:'Compare category demand.'}),trend=await h.execute('analyze_market_trends',{window_days:7,reason:'Compare equal recent windows.'}),rec=await h.execute('build_recommendations',{recipe,evidence_ids:[eda.evidenceId,trend.evidenceId],reason:'Score all recently observed products.'});
  const args={policy:{campaign:'targeted_recommendations',objective:'joint',inventory:'v1',forecast_id:'none',recommendation_id:rec.id,cover_days:0,settlement:'fast',duration_days:7,conditions:[]},evidence_ids:[baseline.evidenceId,eda.evidenceId,trend.evidenceId,rec.id],reason:'Test the bound recommendation job.'};
  const preview=await h.execute('preview_policy',args);assert.ok(preview.candidate_id);assert.deepEqual(h.state.candidates[preview.candidate_id].recommendations.recipe,recipe);
  h.state.recommendations[rec.id].recipe.segment='lapsed';await assert.rejects(h.execute('preview_policy',{...args,policy:{...args.policy,duration_days:3}}),/RECOMMENDATIONS_CHANGED_AFTER_SCORING/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('targeted recommendation execution preserves the frozen economy and clears all liabilities',async()=>{
 const settings={seed:301,regime:'discovery',days:36,customers:30},w=warmGrowthWorld(settings);beginGrowthDay(w);const v=economicObservation(w),rec=buildRecommendations(v,r,{mode:'multiple_interests',segment:'all',category:'all'}),candidate={id:'TEST-RECOMMENDATIONS',reviewDay:30,recommendations:rec,policy:{campaign:'targeted_recommendations',objective:'joint',inventory:'v1',forecast_id:'none',recommendation_id:rec.id,cover_days:0,settlement:'fast',duration_days:3,conditions:[]}},allocator=openAllocator();
 try{const baseline=await r.runBaseline(settings,r,allocator),result=await runEconomicPatch(settings,candidate,r,allocator);for(const k of ['initialHash','opportunityHash','consentHash','incomeCents'])assert.equal(result[k],baseline[k],k);assert.equal(result.unpaidLiabilities,0);assert.ok(Number.isFinite(result.platformUSD));assert.deepEqual(result.activeDays,[30,31,32]);}finally{allocator.close();}
});
test('compact evidence preserves exact trend measurements and sharply reduces repeated fields',()=>{
 const t=analyzeTrends(source,{windowDays:14}),c=compactEconomicEvidence(t),unpack=table=>table.values.map(row=>Object.fromEntries(table.columns.map((k,i)=>[k,row[i]])));
 assert.deepEqual(unpack(c.rows),t.rows);assert.deepEqual(unpack(c.series),t.series);assert.equal(c.evidenceId,t.evidenceId);assert.ok(JSON.stringify(c).length<JSON.stringify(t).length*.5);assert.ok(Array.isArray(t.series));
});
test('empty recommendation cohorts return reachable alternatives and cannot replace current outreach',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'recommendation-empty-')),v=structuredClone(source);
 try{const h=await openEconomicHarness({view:v,resources:r,path:join(dir,'state.json'),historyDescription:{id:'H1'},compareHistorical:async()=>{throw Error('NO_TRIAL_EXPECTED');}});
  const base=await h.execute('inspect_baseline_policy',{reason:'Read baseline.'}),category=await h.execute('explore_market',{dimension:'category',window_days:14,reason:'Category EDA.'}),segment=await h.execute('explore_market',{dimension:'customer_segment',window_days:14,reason:'Segment EDA.'}),trend=await h.execute('analyze_market_trends',{window_days:14,reason:'Trend review.'});
  await assert.rejects(h.execute('build_recommendations',{recipe:{mode:'trend_aware',segment:'active',category:'Electronics',trend_window_days:7},evidence_ids:[category.evidenceId,segment.evidenceId,trend.evidenceId],reason:'Mismatched trend window.'}),/TREND_WINDOW_NOT_GROUNDED/);
  const rec=await h.execute('build_recommendations',{recipe:{mode:'trend_aware',segment:'active',category:'Electronics',trend_window_days:14},evidence_ids:[category.evidenceId,segment.evidenceId,trend.evidenceId],reason:'Test the empty cohort.'});
  assert.equal(rec.selectedContacts,0);assert.ok(rec.repairEvidence.segments.some(s=>s.selectedShoppers>0));
  await assert.rejects(h.execute('preview_policy',{policy:{campaign:'targeted_recommendations',objective:'joint',inventory:'v1',forecast_id:'none',recommendation_id:rec.id,cover_days:0,settlement:'fast',duration_days:7,conditions:[]},evidence_ids:[base.evidenceId,rec.id],reason:'Attempt to publish an empty shortlist.'}),/NO_ELIGIBLE_RECOMMENDATIONS/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

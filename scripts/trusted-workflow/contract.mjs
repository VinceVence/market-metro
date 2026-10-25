// Business vocabulary shared by rules, the LLM and the executable workflow.
// No SQL, expressions, private simulator fields or evaluator answers are accepted.
export const MERCHANTS=['Willow Goods','Oak & Ink','Corner Supply'];
export const GOALS=['grow_retained_sales','reactivate_buyers','reduce_return_exposure','understand_market'];
export const ANALYSES=['merchant_sales','mature_returns','reactivation_cohort','model_readiness'];
export const REQUIRED={grow_retained_sales:['merchant_sales','mature_returns','model_readiness'],reactivate_buyers:['reactivation_cohort','mature_returns','model_readiness'],reduce_return_exposure:['mature_returns','merchant_sales'],understand_market:['merchant_sales','mature_returns']};
export const SPEC_KEYS=['status','goal','merchantIndices','budgetCents','maxCouponPct','durationDays','inactiveDays','reason'];
export const AUTHORITY=Object.freeze({maxBudgetCents:10000,maxCouponPct:10,maxDurationDays:14,supportedInactiveDays:7,nativePayments:false});
export function validateSpec(s){
  if(!s||SPEC_KEYS.some(k=>!Object.hasOwn(s,k))||Object.keys(s).some(k=>!SPEC_KEYS.includes(k)))throw Error('SPEC_FIELDS');
  if(!['ready','clarify'].includes(s.status)||typeof s.reason!=='string'||s.reason.length<4||s.reason.length>1200)throw Error('SPEC_STATUS');
  if(s.status==='clarify')return {status:'clarify',goal:null,merchantIndices:[],budgetCents:null,maxCouponPct:null,durationDays:null,inactiveDays:null,reason:s.reason};
  if(!GOALS.includes(s.goal)||!Array.isArray(s.merchantIndices)||!s.merchantIndices.length||s.merchantIndices.some(i=>!Number.isInteger(i)||i<0||i>2)||new Set(s.merchantIndices).size!==s.merchantIndices.length)throw Error('SPEC_TARGET');
  const diagnostic=['reduce_return_exposure','understand_market'].includes(s.goal);
  if(!Number.isSafeInteger(s.budgetCents)||s.budgetCents<0||s.budgetCents>AUTHORITY.maxBudgetCents||![0,5,10].includes(s.maxCouponPct)||!Number.isInteger(s.durationDays)||s.durationDays<0||s.durationDays>AUTHORITY.maxDurationDays)throw Error('SPEC_AUTHORITY');
  if(diagnostic&&(s.budgetCents!==0||s.maxCouponPct!==0||s.durationDays!==0))throw Error('DIAGNOSTIC_HAS_NO_DEPLOYMENT_AUTHORITY');
  if(!diagnostic&&(s.budgetCents===0||s.durationDays===0))throw Error('CAMPAIGN_LIMITS_REQUIRED');
  if(s.inactiveDays!==(s.goal==='reactivate_buyers'?7:0))throw Error('UNSUPPORTED_COHORT');
  return {...s,merchantIndices:[...s.merchantIndices].sort()};
}
export function semanticSpec(s){const v=validateSpec(s);return Object.fromEntries(SPEC_KEYS.filter(k=>k!=='reason').map(k=>[k,v[k]]));}
export const clarify=reason=>validateSpec({status:'clarify',goal:null,merchantIndices:[],budgetCents:null,maxCouponPct:null,durationDays:null,inactiveDays:null,reason});
const evidenceFields=['goal','merchants','budget','discount','duration','inactivity'];
export const SPEC_FUNCTION={name:'interpret_mission',description:'Extract the current request, with exact source excerpts. Preserve unsupported requested values so code can reject them; never substitute supported defaults.',parameters:{type:'OBJECT',properties:{
  status:{type:'STRING',enum:['ready','clarify']},goal:{type:'STRING',nullable:true,enum:GOALS},merchantIndices:{type:'ARRAY',items:{type:'INTEGER'}},budgetCents:{type:'INTEGER',nullable:true},maxCouponPct:{type:'INTEGER',nullable:true},durationDays:{type:'INTEGER',nullable:true},inactiveDays:{type:'INTEGER',nullable:true},reason:{type:'STRING',description:'A brief public explanation of the interpreted objective and constraints; no private chain of thought.'},sourceEvidence:{type:'OBJECT',properties:Object.fromEntries(evidenceFields.map(k=>[k,{type:'STRING',nullable:true,description:'Exact short substring of the current user request supporting '+k+'. Null if missing or not relevant.'}])),required:evidenceFields}
},required:[...SPEC_KEYS,'sourceEvidence']}};

function normalizeQuantity(text){const words={one:1,two:2,three:3,five:5,seven:7,ten:10,fourteen:14,fifteen:15,twenty:20,thirty:30,fifty:50,hundred:100};return text.toLowerCase().replace(/\b(one|two|three|five|seven|ten|fourteen|fifteen|twenty|thirty|fifty|hundred)\b/g,m=>String(words[m])).replace(/\b(?:a|one) week\b/g,'7 days').replace(/(\d+)-day\b/g,'$1 days');}
export function groundInterpretation(raw,brief){
  const {sourceEvidence:e,...s}=raw||{};
  if(s.status==='clarify')return validateSpec(s);
  if(!e||evidenceFields.some(k=>!Object.hasOwn(e,k))||Object.keys(e).some(k=>!evidenceFields.includes(k))||Object.values(e).some(v=>v!==null&&(typeof v!=='string'||!v.trim()||!brief.includes(v))))throw Error('UNGROUNDED_SOURCE_EXCERPT');
  if(!e.goal||!e.merchants)throw Error('MISSING_GOAL_OR_MERCHANT_EVIDENCE');
  const scope=normalizeQuantity(e.merchants);let merchants=MERCHANTS.map((n,i)=>scope.includes(n.toLowerCase())?i:-1).filter(i=>i>=0);
  if(/all (?:(?:three|3) )?(?:shops|merchants|stores)|every (?:shop|merchant|store)|across the district/.test(scope))merchants=[0,1,2];
  for(const [i,n]of MERCHANTS.entries())if(new RegExp('(?:except|exclude|excluding|without)\\s+'+n.toLowerCase()).test(scope))merchants=[0,1,2].filter(j=>j!==i);
  if(JSON.stringify([...s.merchantIndices].sort())!==JSON.stringify(merchants.sort()))throw Error('MERCHANT_SCOPE_NOT_GROUNDED');
  if(!['reduce_return_exposure','understand_market'].includes(s.goal)){
    if(!e.budget||!e.duration||!e.discount)throw Error('MISSING_CAMPAIGN_AUTHORITY_EVIDENCE');
    const money=normalizeQuantity(e.budget);
    if(/\b(?:php|eur|gbp|pesos|euros)\b|[€£₱]/.test(money))throw Error('UNSUPPORTED_CURRENCY');
    const values=[...money.matchAll(/(?:\$|usd\s*)(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:usd|dollars)\b/g)].map(m=>Math.round(Number(m[1]||m[2])*100));
    if(new Set(values).size!==1||values[0]!==s.budgetCents)throw Error('BUDGET_NOT_GROUNDED');
    const durations=[...normalizeQuantity(e.duration).matchAll(/(\d+)\s*days?\b/g)].map(m=>Number(m[1]));
    if(new Set(durations).size!==1||durations[0]!==s.durationDays)throw Error('DURATION_NOT_GROUNDED');
    const discount=normalizeQuantity(e.discount);
    const zero=/no (?:discount|coupon|money off)|without (?:discount|coupon)|do not (?:discount|issue coupons)|don't (?:discount|issue coupons)|full.price|prices unchanged|keep prices unchanged|prices? (?:unchanged|the same)|unchanged prices/.test(discount);
    const rates=[...discount.matchAll(/(\d+)\s*(?:%|percent)/g)].map(m=>Number(m[1]));
    if(zero?s.maxCouponPct!==0:new Set(rates).size!==1||rates[0]!==s.maxCouponPct)throw Error('DISCOUNT_NOT_GROUNDED');
    if(s.goal==='reactivate_buyers'){
      if(!e.inactivity)throw Error('MISSING_COHORT_EVIDENCE');
      const days=[...normalizeQuantity(e.inactivity).matchAll(/(\d+)\s*days?\b/g)].map(m=>Number(m[1]));
      if(new Set(days).size!==1||days[0]!==s.inactiveDays)throw Error('INACTIVITY_NOT_GROUNDED');
    }
  }
  return validateSpec(s);
}

// Strong documented command/keyword baseline: exclusions, negation, common
// synonyms, money words, unit conversion and explicit corrections are supported.
export function rulesInterpret(brief){
  let t=brief.toLowerCase().replaceAll('’',"'");
  const correction=t.match(/(?:final request|final instruction|correction|instead use|updated request)\s*[:—-]\s*([\s\S]+)/);
  if(correction)t=correction[1];
  const words={one:1,two:2,three:3,five:5,seven:7,ten:10,fourteen:14,fifteen:15,twenty:20,thirty:30,fifty:50,hundred:100};
  t=t.replace(/\b(one|two|three|five|seven|ten|fourteen|fifteen|twenty|thirty|fifty|hundred)\b/g,m=>String(words[m])).replace(/\ba week\b/g,'7 days').replace(/(\d+)-day\b/g,'$1 days');
  const goals=[];
  const positive=t.split(/[.;\n]/).filter(s=>!/^\s*(?:we are not|we aren't|do not|don't|not interested in|this is not)\b/.test(s)).join('.');
  if(/reactivat|win.?back|lapsed|inactive|dormant|bring back|come back|returning buyers|stopped buying/.test(positive))goals.push('reactivate_buyers');
  if(/reduce.*return|return exposure|refund exposure|audit.*refund|investigate.*return|return.*risk/.test(positive))goals.push('reduce_return_exposure');
  if(/understand.*market|market.*diagnos|market.*trend|diagnos.*sales|explain.*sales/.test(positive))goals.push('understand_market');
  if(/grow.*(?:retained|sales)|increase.*(?:retained|sales)|recommendation|recommend products|cross.?sell|product discovery/.test(positive))goals.push('grow_retained_sales');
  if(!goals.length&&/analysis only|report only/.test(positive))goals.push('understand_market');
  const unique=[...new Set(goals)];if(unique.length!==1)return clarify('The command parser cannot resolve one supported primary objective.');const goal=unique[0];
  let merchants=MERCHANTS.map((name,i)=>t.includes(name.toLowerCase())?i:-1).filter(i=>i>=0);
  if(/all (?:(?:three|3) )?(?:shops|merchants|stores)|every (?:shop|merchant|store)|across the district/.test(t))merchants=[0,1,2];
  for(const [i,name]of MERCHANTS.entries())if(new RegExp('(?:except|exclude|excluding|without)\\s+'+name.toLowerCase().replace('&','&')).test(t))merchants=([0,1,2].filter(j=>j!==i));
  if(!merchants.length)return clarify('Merchant scope is not explicit.');
  if(['reduce_return_exposure','understand_market'].includes(goal)){
    if(!/no (?:campaign|outreach|spend)|do not (?:launch|deploy|contact)|don't (?:launch|deploy|contact)|only|diagnos|audit/.test(t))return clarify('Confirm diagnostic scope without deployment.');
    return validateSpec({status:'ready',goal,merchantIndices:merchants,budgetCents:0,maxCouponPct:0,durationDays:0,inactiveDays:0,reason:'Recognized a diagnostic request without deployment authority.'});
  }
  const amounts=[...t.matchAll(/(?:\$|usd\s*)(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:usd|dollars)\b/g)].map(m=>Math.round(Number(m[1]||m[2])*100));
  const durations=[...t.matchAll(/(?:for|over|within|last(?:ing)?|duration|end(?:s)? (?:within|after)|up to|at most)\s*(?:a\s+)?(\d+)\s*days?\b/g)].map(m=>Number(m[1]));
  const coupon=/no (?:discount|coupon)|without (?:discount|coupon)|do not (?:discount|issue coupons)|don't (?:discount|issue coupons)|full.price only|keep prices unchanged/.test(t)?0:(t.match(/(?:up to|at most|maximum|cap(?:ped)?(?: at)?|no more than)\s*(\d+)\s*(?:%|percent)/)||[])[1];
  const inactive=(t.match(/(?:inactive|dormant|not (?:bought|purchased)|without (?:buying|purchasing)|stopped buying)(?:\s+for)?\s*(\d+)\s*days?/)||t.match(/(\d+)\s*days?\s+without\s+(?:a\s+)?(?:purchase|order|buying)/)||[])[1];
  const duration=durations.filter(n=>goal!=='reactivate_buyers'||n!==Number(inactive));
  // A separately worded campaign duration may equal the inactivity window.
  const explicitDuration=(t.match(/(?:campaign|test|experiment)(?:\s+(?:may|can|must|should))?\s*(?:last(?:s|ing)?|for|duration:?|ends? after)\s*(\d+)\s*days?/)||[])[1];
  if(new Set(amounts).size!==1||coupon===undefined||(!explicitDuration&&new Set(duration).size!==1)||goal==='reactivate_buyers'&&Number(inactive)!==7)return clarify('The command parser cannot resolve unambiguous supported campaign limits.');
  try{return validateSpec({status:'ready',goal,merchantIndices:merchants,budgetCents:amounts[0],maxCouponPct:Number(coupon),durationDays:Number(explicitDuration||duration[0]),inactiveDays:goal==='reactivate_buyers'?7:0,reason:'Parsed explicit supported campaign constraints using the documented command grammar.'});}catch{return clarify('The request exceeds the supported campaign contract.');}
}

import {pairFeatures,PAIR_FEATURES} from './pair-features.mjs';
import {shelfPrice} from '../engine.mjs';
import {publicEvidence} from '../../behavior-v4/policies.mjs';
export const ACTION_FEATURES=[...PAIR_FEATURES,'suppress','coupon','subscription','intervalDays','discountPct','incumbentSubscription','incumbentDiscount','remainingOutcomeDays'];
export const actionKey=a=>a?JSON.stringify([a.productId,a.pct||0,a.kind||'recommendation',a.intervalDays||0]):'NONE';
export function actions(w,input,old){
 const u=input.customer,byId=new Map(w.products.map(p=>[p.product_id,p])),excluded=new Set(publicEvidence(w).matureMerchantRisk.filter(m=>m.exclude).map(m=>m.merchantIndex)),pool=input.products.filter(p=>p.stock>0&&p.allowedPct.includes(0)&&!excluded.has(p.merchantIndex));
 const recentIntent=u.observedIntent&&input.day-u.observedIntent.day<=14?u.observedIntent.topic:null,category=recentIntent||Object.entries(u.seenCategories).sort((a,b)=>b[1]-a[1])[0]?.[0],history=w.behavior.orders.filter(o=>o.customerId===u.customerId&&o.day<input.day&&!o.refund),paid=history.map(o=>o.gross).sort((a,b)=>a-b),upper=paid.length?paid[Math.floor((paid.length-1)*.75)]:null;
 const candidates=[];if(old)candidates.push({name:'No new contact',action:null});
 const relevant=pool.filter(p=>!category||p.category===category).sort((a,b)=>Math.abs(a.priceCents-(upper||a.priceCents))-Math.abs(b.priceCents-(upper||b.priceCents))||Number(b.merchantIndex===u.lastMerchantIndex)-Number(a.merchantIndex===u.lastMerchantIndex)||a.priceCents-b.priceCents);
 const p=relevant[0],value=relevant.filter(p=>!upper||p.priceCents<=upper*2).sort((a,b)=>b.priceCents-a.priceCents||Number(b.merchantIndex===u.lastMerchantIndex)-Number(a.merchantIndex===u.lastMerchantIndex))[0];
 for(const [name,product] of [['Observed-interest recommendation',p],['Higher-value relevant alternative',value]])if(product)candidates.push({name,action:{productId:product.productId,pct:0,kind:'recommendation'}});
 if(p&&u.purchases>0&&input.day-u.lastPurchase>=14&&p.allowedPct.includes(5))candidates.push({name:'Lapsed-buyer5% offer',action:{productId:p.productId,pct:5,kind:'recommendation'}});
 const consumable=[...history].reverse().find(o=>['Stationery','Office bundles'].includes(byId.get(o.productId)?.category)),sub=consumable?pool.find(p=>p.productId===consumable.productId&&shelfPrice(w,byId.get(p.productId))<=consumable.gross*1.1):null;
 if(sub)for(const intervalDays of [7,14,28])candidates.push({name:'Optional replenishment every'+intervalDays+' days',action:{productId:sub.productId,pct:0,kind:'subscription_offer',intervalDays}});
 const unique=new Map();for(const c of candidates)if(actionKey(c.action)!==actionKey(old)&&!unique.has(actionKey(c.action)))unique.set(actionKey(c.action),c);return [...unique.values()];
}
export function actionFeatures(w,input,alternative,old){
 const a=alternative.action,p=input.products.find(p=>p.productId===(a?.productId||old?.productId));if(!p)throw Error('ACTION_FEATURE_PRODUCT_MISSING');
 return [...pairFeatures(w,input,p,old),Number(!a),Number(!!a?.pct),Number(a?.kind==='subscription_offer'),(a?.intervalDays||0)/28,(a?.pct||0)/5,Number(old?.kind==='subscription_offer'),(old?.pct||0)/5,Math.min(28,w.behavior.days-input.day)/28];
}

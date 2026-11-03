import test from 'node:test';import assert from 'node:assert/strict';
import {predictionMetrics} from '../scripts/commerce-growth/autonomy/prediction-metrics.mjs';
test('ROC handles tied scores and separates pooled from within-market ranking',()=>{
 assert.equal(predictionMetrics([{p:.9,y:1},{p:.1,y:0}]).auc,1);
 assert.equal(predictionMetrics([{p:.5,y:1},{p:.5,y:0}]).auc,.5);
 assert.equal(predictionMetrics([{p:.1,y:1},{p:.9,y:0}]).auc,0);
 assert.equal(predictionMetrics([{p:.1,y:0}]).auc,null);
 const r=predictionMetrics([{p:.9,y:1,market:'a'},{p:.8,y:0,market:'a'},{p:.2,y:0,market:'b'},{p:.1,y:1,market:'b'}]);assert.equal(r.macroMarketAUC,.5);assert.equal(r.marketAUCs.length,2);
 assert.throws(()=>predictionMetrics([{p:1.2,y:1}]),/INVALID/);
});

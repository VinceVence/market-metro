// Export a narrow, credential-free ledger from the existing local judge warehouse.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const judge=JSON.parse(await readFile('demo/data/judge-reactivation.json','utf8'));
const db=new DatabaseSync('.local/market-metro.sqlite',{readOnly:true});
try{
  db.exec('PRAGMA query_only=ON');
  const orders=db.prepare('SELECT order_id,merchant_id,customer_id,total_cents,currency,status FROM orders WHERE run_id=?').all(judge.runId);
  const byId=new Map(orders.map(o=>[o.order_id,o]));
  const baskets=db.prepare('SELECT basket_id,customer_id,gross_cents,legs_json,status FROM autonomy_baskets WHERE run_id=? ORDER BY capture_day,basket_id').all(judge.runId);
  const checkouts=baskets.map(b=>{
    assert.ok(['DELIVERED','REFUNDED'].includes(b.status));
    const legs=JSON.parse(b.legs_json).map(l=>{
      const o=byId.get(l.orderId);
      assert.ok(o && o.currency==='USD' && ['PAID','REFUNDED'].includes(o.status));
      assert.equal(o.merchant_id,l.merchantId);assert.equal(o.customer_id,b.customer_id);assert.equal(o.total_cents,l.grossCents);
      byId.delete(l.orderId);return [o.order_id,o.merchant_id,o.total_cents];
    });
    assert.ok(legs.length>0);assert.equal(b.gross_cents,legs.reduce((s,l)=>s+l[2],0));
    return [b.basket_id,b.gross_cents,legs];
  });
  assert.equal(byId.size,0);
  const [native]=db.prepare('SELECT capture_id,order_id,gross_cents,fee_cents,net_cents FROM paypal_receipts WHERE run_id=? AND status=? AND capture_id=?').all(judge.runId,'COMPLETED',judge.receipt.capture_id);
  assert.ok(native);for(const [key,v] of Object.entries(native))assert.equal(v,judge.receipt[key]);
  const ledger={runId:judge.runId,checkouts},hash=createHash('sha256').update(JSON.stringify(ledger)).digest('hex');
  const target='docs/ontology/judge-ledger.json.gz';
  await writeFile(target+'.tmp',gzipSync(JSON.stringify({judgeLock:judge.lockHash,hash,ledger})));await rename(target+'.tmp',target);
  console.log('Exported',baskets.length,'captured baskets and',orders.length,'reconciled merchant orders.');
}finally{db.close();}

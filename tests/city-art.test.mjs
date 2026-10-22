import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDistrict} from '../demo/garden/city-art.mjs';
import {createLayout} from '../demo/garden/tycoon-motion.mjs';

test('both supported district sizes produce finite geometry and addressable workplaces',()=>{
  // A text-texture stub is enough for geometry checks; screenshots verify the actual renderer.
  const original=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
  try{
    for(const count of [8,12]){
      const layout=createLayout(count),merchants=layout.merchants.map((m,i)=>({position:i,merchant_id:'M'+i,name:'Store '+i}));
      const city=buildDistrict(layout,merchants);city.root.updateMatrixWorld(true);
      assert.equal(city.entities.length,count+5);
      assert.deepEqual(city.entities.filter(e=>e.station).map(e=>e.station),['data','models','hq','campaigns']);
      assert.equal(new Set(city.entities.map(e=>e.id)).size,count+5);
      const geometries=new Set(),materials=new Set();
      city.root.traverse(o=>{
        assert.ok(o.matrixWorld.elements.every(Number.isFinite));
        if(o.geometry){assert.ok(o.geometry.attributes.position.array.every(Number.isFinite),'invalid geometry');geometries.add(o.geometry);}
        if(o.material){assert.ok(['r','g','b'].every(k=>Number.isFinite(o.material.color[k])));materials.add(o.material);}
      });
      for(const g of geometries)g.dispose();for(const m of materials){m.map?.dispose();m.dispose();}
    }
  }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});

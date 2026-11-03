// Independently authored fictional fixtures. No imported catalog, brands, prices,
// images, product IDs, descriptions or trained artifacts from any data provider.
const items=[
 ['PAPER-01','Writing Pad Set','Stationery',1800,'Metro Paper'],
 ['PAPER-02','Index Card Organizer','Stationery',2600,'Metro Paper'],
 ['PAPER-03','Marker and Label Set','Stationery',3400,'Metro Paper'],
 ['PAPER-04','Desktop Filing Tray','Stationery',4800,'Metro Paper'],
 ['DEVICE-01','USB Desk Light','Electronics',4200,'Metro Devices'],
 ['DEVICE-02','Compact Input Board','Electronics',7600,'Metro Devices'],
 ['DEVICE-03','Document Camera','Electronics',14000,'Metro Devices'],
 ['DEVICE-04','Meeting Audio Station','Electronics',21000,'Metro Devices'],
 ['SPACE-01','Mobile Side Table','Furniture',9600,'Metro Workshop'],
 ['SPACE-02','Stacking Office Stool','Furniture',12500,'Metro Workshop'],
 ['SPACE-03','Adjustable Work Seat','Furniture',18500,'Metro Workshop'],
 ['SPACE-04','Compact Work Bench','Furniture',27500,'Metro Workshop'],
 ['PACK-01','New Hire Essentials Pack','Office bundles',6400,'Metro Packs'],
 ['PACK-02','Remote Work Starter Pack','Office bundles',11200,'Metro Packs'],
 ['PACK-03','Shared Desk Setup Pack','Office bundles',16800,'Metro Packs'],
 ['PACK-04','Small Team Supply Pack','Office bundles',22400,'Metro Packs']
];
export const AUTHORED_CATALOG=Object.freeze(items.map(([code,title,category,priceCents,brand])=>Object.freeze({id:'MM-'+code,title,brand:brand+' (fictional)',category,priceCents,currency:'USD',source:'AUTHORED_SIMULATION',sourceUrl:'',imageUrl:'',campaignRole:code==='PACK-02'?'featured_bundle':null,provenance:'Independently authored Market Metro scenario fixture; not a real market quote.'})));
export function usableCatalog(rows=AUTHORED_CATALOG){
 if(!Array.isArray(rows)||rows.length<3)throw Error('AUTHORED_CATALOG_REQUIRED');
 const seen=new Set();return rows.map(p=>{
  if(p.source!=='AUTHORED_SIMULATION'||!/^MM-[A-Z]+-\d{2}$/.test(p.id||'')||p.channel3Id||p.sourceUrl||p.imageUrl||seen.has(p.id)||p.currency!=='USD'||!Number.isSafeInteger(p.priceCents)||p.priceCents<500||p.priceCents>30000||!['Stationery','Electronics','Furniture','Office bundles'].includes(p.category))throw Error('EXTERNAL_OR_INVALID_CATALOG_REJECTED');
  seen.add(p.id);return {...p};
 });
}
export function authoredCatalog(){return usableCatalog(AUTHORED_CATALOG);}
export function createAuthoredCatalogService(){return {products:authoredCatalog,status:()=>({configured:true,mode:'AUTHORED',productCount:AUTHORED_CATALOG.length,source:'AUTHORED_SIMULATION',message:'Fictional products and prices authored for this simulation. No catalog API calls.'}),sync:async()=>({mode:'AUTHORED',productCount:AUTHORED_CATALOG.length})};}
export function itemRelevance(trait,p){
 const topic=p.category===trait.needTopic?1:p.category===trait.favoriteTopic?.55:0,brand=p.brand===trait.favoriteBrand?1:0,price=Math.exp(-Math.abs(Math.log(p.price_cents/trait.comfortPrice)));
 return Math.max(0,Math.min(1,.75*topic+.10*brand+.15*price));
}

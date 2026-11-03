// All features below are derived from public catalog fields, never shopper truth.
export function topicFor(p){
 const title=String(p.title||'').toLowerCase();
 if(/keyboard|touchpad|wireless|logitech/.test(title))return 'Electronics';
 if(/chair|cabinet|drawer|rattan|home office|office desk/.test(title))return 'Furniture';
 if(/stationery|staple|paperclip|rubber band|binder|essentials|supply|pkg/.test(title))return 'Stationery';
 return 'Office bundles';
}
export function usableCatalog(rows){
 const seen=new Set();return rows.filter(p=>p.currency==='USD'&&Number.isSafeInteger(p.priceCents)&&p.priceCents>=500&&p.priceCents<=30000).filter(p=>{const id=p.channel3Id||p.id;if(!id||seen.has(id))return false;seen.add(id);return true;}).map(p=>({...p,category:topicFor(p),categorySource:'DERIVED_FROM_PUBLIC_TITLE',originalCategory:p.category==='[object Object]'?'Unspecified':p.category}));
}
export function itemRelevance(trait,p){
 const topic=p.category===trait.needTopic?1:p.category===trait.favoriteTopic?.55:0;
 const brand=p.brand===trait.favoriteBrand?1:0;
 const price=Math.exp(-Math.abs(Math.log(p.price_cents/trait.comfortPrice)));
 return Math.max(0,Math.min(1,.75*topic+.10*brand+.15*price));
}

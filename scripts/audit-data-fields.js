'use strict';
const fs=require('fs'),path=require('path'),{ROOT}=require('./static-routes');
const {parse}=require('parse5');
const files={Heroes:['heroes'],Buildings:['buildings','buildings-calc','bulid-calc-sub'],Research:['research'],'War Academy':['waracademy-infantry','waracademy-cavalry','waracademy-archer'],'Lord Gear':['governor-gear','governor-charm'],'Hero Gear':['hero-gear-data'],Pets:['pet-upgrade'],Items:['items'],Events:['events'],Training:['ks_training_promotion_per_troop']};
const rows=[];
const sources={gordon:'https://kingshotwiki.com/ko/heroes/kingshot_wiki_hero_name_50005_kingshot_end-2/',olive:'https://kingshotwiki.com/ko/heroes/kingshot_wiki_hero_name_50003_kingshot_end-2/',yang:'https://kingshotwiki.com/ko/heroes/kingshot_wiki_hero_name_50031_kingshot_end-2/'};
function read(f){return JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8').replace(/^\uFEFF/,''));}
function add(category,file,field,value){rows.push({category,file,field,value,status:value==null?'MISSING':'UNVERIFIED',source:null,verified_at:null,confidence:'unverified',notes:value==null?'Not supplied; do not infer a value.':'No field-specific primary evidence recorded. Visible page notice identifies these as unverified references.'});}
function walk(category,file,value,key=''){
 if(/(?:^|\.)(?:sources|confidence|schemaVersion|meta|verifiedAt|verificationStatus|verificationNotes)(?:\.|$)/.test(key))return;
 if(value&&typeof value==='object'){for(const [k,v]of Object.entries(value))walk(category,file,v,key?key+'.'+k:k);return;}
 if(/(?:image|icon|url|path|version|verifiedAt|updated|source|title|description|label|name|slug|\.id)$/i.test(key))return;
 if(value===null||typeof value==='number'||(typeof value==='string'&&/\d/.test(value)&&!/^heroes\./.test(value)&&!/^https?:/.test(value)))add(category,file,key,value);
}
for(const [category,names]of Object.entries(files))for(const name of names){const f='data/'+name+'.json';walk(category,f,read(f));}
for(const lang of ['ko','en','ja','zh-TW']){const f='i18n/'+lang+'/heroes.json';const data=read(f);for(const [k,v]of Object.entries(data))if(/heroes\..*\.(desc|up)$/.test(k))add('Heroes',f,k,v);}
for(const lang of ['ko','en','ja','zh-TW']){const file='i18n/'+lang+'/items.json';for(const [slug,item]of Object.entries(read(file).records))for(const key of ['summary','purpose','acquisition'])add('Items',file,slug+'.'+key,item[key]);}
// Concrete comparisons: no category-wide promotion based on a sample.
const heroes=read('data/heroes.json');
for(const slug of ['gordon','olive']){
 const index=heroes.findIndex(h=>h.slug===slug),h=heroes[index];
 const expected=slug==='gordon'?['1,776','2,220','17,760','+140.11%','+140.11%']:['1,752','2,220','10,822','+90.07%','+90.07%'];
 const fields=[...h.conquest.stats.map((s,i)=>index+'.conquest.stats.'+i+'.value'),...h.expedition.stats.map((s,i)=>index+'.expedition.stats.'+i+'.value')];
 fields.forEach((field,i)=>{const r=rows.find(r=>r.file==='data/heroes.json'&&r.field===field);if(r){r.status=r.value===expected[i]?'VERIFIED':'CONFLICT';r.source=sources[slug];r.verified_at='2026-10-06';r.confidence=r.status==='VERIFIED'?'verified':'conflict';r.notes='Compared displayed Conquest/Expedition total attribute with official Wiki; no exclusive gear for this hero.';}});
}
for(const r of rows.filter(r=>r.file==='i18n/ko/heroes.json'&&/^heroes\.(gordon|olive)\./.test(r.field))){r.status='VERIFIED';r.source=sources[r.field.split('.')[1]];r.verified_at='2026-10-06';r.confidence='verified';r.notes='Manually compared effect, mode and level sequence with official Wiki, not just numeric token presence.';}
for(const r of rows.filter(r=>r.category==='Items'&&r.field==='forgehammers.summary')){r.status='VERIFIED';r.source='https://kingshotwiki.com/ko/hero-gears/영웅장비/';r.verified_at='2026-10-06';r.confidence='verified';r.notes='Purpose and unlock requirements checked; no claim about complete upgrade costs.';}
const yi=heroes.findIndex(h=>h.slug==='yang');
for(const r of rows.filter(r=>r.file==='data/heroes.json'&&r.field.startsWith(yi+'.conquest.stats.'))){r.status='PARTIALLY VERIFIED';r.source=sources.yang;r.verified_at='2026-10-06';r.confidence='partial';r.notes='Official totals 8657/7127/53465 equal stored base 7200/5926/44454 plus exclusive gear 1457/1201/9011. Base/total conditions need an explicit game-screen check; values not overwritten.';}
// Static data tables also need field-level coverage, including Masters and pet effects.
const attr=(n,k)=>(n.attrs||[]).find(a=>a.name===k)?.value||'';
function nodes(n){return[n,...(n.childNodes||[]).flatMap(nodes)];}
function text(n){return n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join(' ').replace(/\s+/g,' ').trim();}
for(const p of require('./public-index-policy.json').paths){
 if(!/^\/ko\/(buildings|pet|masters?|database)\//.test(p))continue;
 const file=p.slice(1)+(p.endsWith('/')?'index.html':'');const all=nodes(parse(fs.readFileSync(path.join(ROOT,file),'utf8')));
 const category=/\/masters?\//.test(p)?'Masters':/\/pet\//.test(p)?'Pets':/\/buildings\//.test(p)?'Buildings':'Other data';
 all.filter(n=>n.tagName==='td').forEach((n,i)=>{const v=text(n);if(/\d/.test(v))add(category,file,'table-cell['+i+']',v);});
}
const summary={};for(const r of rows){const g=summary[r.category]||(summary[r.category]={});g[r.status]=(g[r.status]||0)+1;}
const out=process.env.KS_AUDIT_OUTPUT||path.join(ROOT,'.audit/final-gate');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'data-fields.json'),JSON.stringify({checkedAt:new Date().toISOString(),scope:'Numeric JSON leaves, localized hero skill fields and Korean static data table cells. Missing nonnumeric unlock/prerequisite content and image-only data remain editorial review gaps; this ledger does not imply exhaustive game verification.',summary,rows},null,2));
fs.writeFileSync(path.join(ROOT,'data/verified-fields.json'),JSON.stringify(rows.filter(r=>r.status==='VERIFIED'||r.status==='PARTIALLY VERIFIED'),null,2)+'\n');
fs.writeFileSync(path.join(ROOT,'data/verification-summary.json'),JSON.stringify({reviewedAt:'2026-10-06',status:'PARTIAL',summary,sources,notes:'No category is completely verified. 10 displayed stats, 18 Korean skill fields and 4 localized forgehammer summaries verified; other fields must not be treated as confirmed.'},null,2)+'\n');
console.log(JSON.stringify({fields:rows.length,summary},null,2));

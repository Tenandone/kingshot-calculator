const fs=require('fs'),assert=require('node:assert/strict');
const records=JSON.parse(fs.readFileSync('data/primary-verified-fields.json'));
const proof=Object.fromEntries(records.filter(r=>r.status==='VERIFIED').map(r=>[r.file+'|'+r.field,r]));
const layout=require('../data/calculation-layout.json');const api=require('../js/calculation-proof').create(proof,layout);
const gear=require('../data/governor-gear.json'),charm=require('../data/governor-charm.json'),pets=require('../data/pet-upgrade.json');
assert(api.steps('gear',gear)); assert(api.steps('charm',charm));
for(const kind of ['gear','charm']){const original=kind==='gear'?gear:charm, material=kind==='gear'?'satin':'manual';for(const fraction of [0,.5,1]){const d=structuredClone(original),keys=Object.keys(d.steps),key=keys[Math.floor((keys.length-1)*fraction)];d.steps[key][material]+=1;assert.equal(api.steps(kind,d),false,'Changed source value must block '+kind+' '+key);delete d.steps[key][material];assert.equal(api.steps(kind,d),false,'Missing cost must not become zero');}}
for(const id of ['graywolf','lynx','cheetah','lion','giant-rhino']){const p=pets.pets.find(p=>p.id===id),rows=pets.levelsByRarity[p.rarity];for(const [a,b] of [[0,4],[10,20],[20,rows.length-1]])assert(api.pet(pets,id,rows,a,b),id+' range '+a+'-'+b);}
for(const p of pets.pets.filter(p=>!['graywolf','lynx','cheetah','lion','giant-rhino'].includes(p.id)))assert.equal(api.pet(pets,p.id,pets.levelsByRarity[p.rarity],0,4),false,'Unverified species mapping blocked');
const changed=structuredClone(pets);changed.levelsByRarity.common[1].food=0;assert.equal(api.pet(changed,'graywolf',changed.levelsByRarity.common,0,4),false);
const wrongLevel=structuredClone(pets);wrongLevel.levelsByRarity.common[1].level=99;assert.equal(api.pet(wrongLevel,'graywolf',wrongLevel.levelsByRarity.common,0,4),false);
const reversed={steps:Object.fromEntries(Object.entries(gear.steps).reverse())};assert.equal(api.steps('gear',reversed),false);
const entry=Object.keys(proof)[0];const missing=structuredClone(proof);delete missing[entry].source;assert.equal(require('../js/calculation-proof').create(missing,layout).steps('gear',gear),false);
assert.equal(require('../js/calculation-proof').create({},layout).steps('charm',charm),false);

console.log('PASS: verified material scope, 15 pet ranges, changed/missing value/source, absent proof and unsupported species fail closed. Time conversions are arithmetic only; training remains blocked.');

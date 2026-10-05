'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/'+n+'.json'),'utf8'));
const buildings=read('buildings-calc').buildings;
const tc=buildings.find(b=>b.slug==='towncenter').table;
assert.deepEqual(tc.find(r=>r[0]===2).slice(2,6),[0,180,0,0],'TC2 spends wood, not bread');
assert.equal(tc.find(r=>r[0]===2)[8],0.1,'TC2 takes six base seconds');
for(const slug of ['barracks','range','stable'])assert.equal(buildings.find(b=>b.slug===slug).table.find(r=>r[0]===23)[5],780000);
assert.deepEqual(Object.values(read('governor-gear').steps['신화 T5']).slice(0,3),[451000,4510,910]);
const charms=read('governor-charm').steps;assert.equal(charms['Lv.22'].manual,1105);assert.equal(charms['Lv.22'].blueprint,2400);
const pets=read('pet-upgrade').levelsByRarity;
assert.equal(pets.common.reduce((n,r)=>n+r.food,0),28875);
assert.equal(pets.R.find(r=>r.level===29&&r.type==='level').food,1560);
assert.equal(pets.R.find(r=>r.level===39&&r.type==='level').food,2460);
// The calculator reads raw XP. Its label must not claim that this is a count of 100-XP parts.
for(const lang of ['ko','en','ja','zh-TW'])assert.match(JSON.parse(fs.readFileSync(path.join(__dirname,'../i18n',lang,'hero-gear-calculator.json'))).resources.enhancementPart100,/XP/);
console.log('Primary-cost regressions: resource identity, corrected stages, cumulative food and XP units passed.');

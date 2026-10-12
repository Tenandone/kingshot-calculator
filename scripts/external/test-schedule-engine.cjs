'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),engine=require(path.join(root,'js/schedule-engine.js'));
const rules=JSON.parse(fs.readFileSync(path.join(root,'data/ui/external/schedule-rules.json'),'utf8'));
const clone=()=>JSON.parse(JSON.stringify(rules));
const calc=(now,kingdom=null,r=rules)=>engine.calculate(r,{now,kingdom});
const results=[],frozen=[];
function test(name,fn){try{fn();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:error.message});}}
function ok(value){assert.equal(value.ok,true,JSON.stringify(value.errors));return value;}
test('Observed homepage reference clock aligns with prep-start timer, not matchmaking',()=>{const r=ok(calc('2026-10-12T05:49:21Z'));assert.equal(r.kvk.timer.targetAt,'2026-11-02T00:00:00.000Z');assert.deepEqual(r.kvk.timer.remaining,{milliseconds:1793439000,days:20,hours:18,minutes:10,seconds:39});assert.equal(r.transfer.nextWindow.startAt,'2026-11-08T00:00:00.000Z');});
const kvkCases=[
 ['2026-01-25T23:59:59.999Z','matchmaking','countdown','2026-01-26T00:00:00.000Z'],
 ['2026-01-26T00:00:00Z','preparation','preparation','2026-01-31T10:00:00.000Z'],
 ['2026-01-31T09:59:59.999Z','preparation','preparation','2026-01-31T10:00:00.000Z'],
 ['2026-01-31T10:00:00Z','battle','battle','2026-01-31T22:00:00.000Z'],
 ['2026-01-31T21:59:59.999Z','battle','battle','2026-01-31T22:00:00.000Z'],
 ['2026-01-31T22:00:00Z','idle','countdown','2026-02-23T00:00:00.000Z'],
 ['2026-02-20T23:59:59.999Z','idle','countdown','2026-02-23T00:00:00.000Z'],
 ['2026-02-21T00:00:00Z','matchmaking','countdown','2026-02-23T00:00:00.000Z'],
 ['2026-02-23T00:00:00Z','preparation','preparation','2026-02-28T10:00:00.000Z'],
 ['2026-10-31T00:00:00Z','matchmaking','countdown','2026-11-02T00:00:00.000Z'],
 ['2026-11-07T10:00:00Z','battle','battle','2026-11-07T22:00:00.000Z'],
 ['2026-11-07T22:00:00Z','idle','countdown','2026-11-30T00:00:00.000Z'],
 ['2026-11-30T00:00:00Z','preparation','preparation','2026-12-05T10:00:00.000Z'],
 ['2026-12-28T00:00:00Z','preparation','preparation','2027-01-02T10:00:00.000Z']
];
for(const [now,stage,timer,target] of kvkCases)test('KvK boundary '+now,()=>{const r=ok(calc(now));assert.equal(r.kvk.phase,stage);assert.equal(r.kvk.timer.state,timer);assert.equal(r.kvk.timer.targetAt,target);assert.ok(r.kvk.remainingMs>=0);frozen.push({now,kvk:r.kvk,transfer:r.transfer});});
test('KvK matching is a separate two-day reference and has its own start countdown',()=>{const k=ok(calc('2026-10-12T00:00:00Z')).kvk;assert.equal(k.nextPhase.id,'matchmaking');assert.equal(k.nextPhase.startAt,'2026-10-31T00:00:00.000Z');assert.equal(k.nextPhase.durationMs,2*86400000);assert.equal(k.nextPhase.startsInMs,19*86400000);assert.equal(k.nextCycle.preparationAt,'2026-11-02T00:00:00.000Z');});
test('The cycle before the anchor uses floor division instead of a negative remainder',()=>{const k=ok(calc('2026-01-25T00:00:00Z')).kvk;assert.equal(k.phase,'matchmaking');assert.equal(k.currentPhase.eventNumber,10);assert.equal(k.nextCycle.preparationAt,'2026-01-26T00:00:00.000Z');});
test('Explicit timezone offsets normalize to identical UTC outputs',()=>assert.deepEqual(calc('2026-11-08T09:00:00+09:00',972),calc('2026-11-08T00:00:00Z',972)));
test('Date objects and integer epoch inputs use the same pure contract',()=>{const value='2026-11-08T00:00:00Z';assert.deepEqual(calc(new Date(value)),calc(value));assert.deepEqual(calc(Date.parse(value)),calc(value));});
const transferCases=[
 ['2026-11-07T23:59:59.999Z','listed-window-upcoming','idle'],
 ['2026-11-08T00:00:00Z','listed-window-active','pre-transfer'],
 ['2026-11-10T23:59:59.999Z','listed-window-active','pre-transfer'],
 ['2026-11-11T00:00:00Z','listed-window-active','invitational'],
 ['2026-11-12T23:59:59.999Z','listed-window-active','invitational'],
 ['2026-11-13T00:00:00Z','listed-window-active','open-transfer'],
 ['2026-11-14T23:59:59.999Z','listed-window-active','open-transfer'],
 ['2026-11-15T00:00:00Z','single-step-estimate','idle'],
 ['2027-01-02T23:59:59.999Z','single-step-estimate','idle'],
 ['2027-01-03T00:00:00Z','unavailable','idle'],
 ['2027-03-01T00:00:00Z','unavailable','idle']
];
for(const [now,status,phase] of transferCases)test('Transfer boundary '+now,()=>{const r=ok(calc(now,972));assert.equal(r.transfer.status,status);assert.equal(r.transfer.phase,phase);assert.ok(r.transfer.remainingMs===null||r.transfer.remainingMs>=0);frozen.push({now,kvk:r.kvk,transfer:r.transfer});});
test('Every listed historical window remains a valid three-phase range',()=>{for(const w of rules.transfer.windows){const start=Date.parse(w.startAt),end=Date.parse(w.endAt);assert.equal(ok(calc(start)).transfer.phase,'pre-transfer');assert.equal(ok(calc(start+3*86400000)).transfer.phase,'invitational');assert.equal(ok(calc(start+5*86400000)).transfer.phase,'open-transfer');assert.equal(ok(calc(end-1)).transfer.currentWindow.id,w.id);assert.notEqual(ok(calc(end)).transfer.currentWindow?.id,w.id);}});
test('Source whole-second ends survive separately from normalized exclusive ends',()=>{for(const w of rules.transfer.windows){assert.ok(w.sourceEndAt.endsWith('23:59:59Z'));assert.equal(Date.parse(w.endAt)-Date.parse(w.sourceEndAt),1000);assert.equal(w.endNormalization,'inclusive-second-to-exclusive');}});
test('The 56-day reference fallback is one future instant, without an invented active period',()=>{const t=ok(calc('2026-11-16T00:00:00Z',972)).transfer;assert.equal(t.nextWindow.startAt,'2027-01-03T00:00:00.000Z');assert.equal(t.nextWindow.endAt,null);assert.equal(t.group.status,'not-extended-to-prediction');assert.equal(t.group.range,null);assert.equal(t.currentPhase,null);});
test('The one-time fallback is not represented as a verified recurrence',()=>assert.equal(ok(calc('2026-11-16T00:00:00Z')).transfer.limitation,'56-day-site-heuristic-not-confirmed-recurrence'));
test('Every latest group endpoint matches inclusively',()=>{const w=rules.transfer.windows.at(-1);for(const g of w.groups){for(const kingdom of [g.from,g.to]){const t=ok(calc('2026-11-08T00:00:00Z',kingdom)).transfer;assert.equal(t.group.groupId,g.id);assert.deepEqual(t.group.range,{from:g.from,to:g.to});assert.equal(t.group.eligibilityGuaranteed,false);}}});
test('Kingdoms outside the observed groups stay unmatched',()=>{const t=ok(calc('2026-11-08T00:00:00Z',2235)).transfer;assert.equal(t.group.status,'outside-listed-groups');assert.equal(t.group.range,null);});
test('An omitted kingdom does not imply any eligibility',()=>assert.equal(ok(calc('2026-11-08T00:00:00Z')).transfer.group.status,'select-kingdom'));
test('Latest groups never leak into historical windows',()=>{const t=ok(calc('2026-09-13T00:00:00Z',972)).transfer;assert.equal(t.group.status,'no-group-data');assert.equal(t.group.range,null);});
test('A simulation before source observation does not claim its groups were known',()=>assert.equal(ok(calc('2026-10-01T00:00:00Z',972)).transfer.group.status,'not-yet-observed-at-simulated-date'));
test('Expired group snapshots remain unavailable after the last fallback',()=>{const t=ok(calc('2027-01-03T00:00:00Z',972)).transfer;assert.equal(t.group.status,'expired-reference');assert.equal(t.group.range,null);});
test('Kingdom selection changes group results but not either date engine',()=>{const a=ok(calc('2026-11-08T00:00:00Z',1)),b=ok(calc('2026-11-08T00:00:00Z',972));assert.deepEqual(a.kvk,b.kvk);for(const key of ['status','phase','currentPhase','nextPhase','currentWindow','nextWindow','remainingMs'])assert.deepEqual(a.transfer[key],b.transfer[key]);});
test('Malformed latest date prevents calculation rather than falling back to an older window',()=>{const r=clone();r.transfer.windows.at(-1).startAt='invalid';const out=calc('2026-10-12T00:00:00Z',null,r);assert.equal(out.ok,false);assert.ok(out.errors.some(e=>e.code==='invalid-window-range'));assert.equal(out.transfer,undefined);});
test('Missing or incorrect inclusive-end normalization rejects the model',()=>{const r=clone();r.transfer.windows.at(-1).endAt=r.transfer.windows.at(-1).sourceEndAt;assert.equal(calc('2026-10-12T00:00:00Z',null,r).ok,false);});
test('Overlapping windows and duplicate IDs fail closed',()=>{const r=clone();r.transfer.windows.push({...r.transfer.windows[0],id:'duplicate-span'});assert.equal(calc('2026-10-12T00:00:00Z',null,r).ok,false);const dup=clone();dup.transfer.windows[1].id=dup.transfer.windows[0].id;assert.equal(calc('2026-10-12T00:00:00Z',null,dup).ok,false);});
test('Overlapping groups fail closed rather than choosing the first matching kingdom',()=>{const r=clone();r.transfer.windows.at(-1).groups[1].from=417;assert.equal(calc('2026-11-08T00:00:00Z',417,r).ok,false);});
test('Invalid and coercible kingdom values are rejected',()=>{for(const k of [0,-1,1.5,'972',true,Infinity,1000001])assert.equal(calc('2026-10-12T00:00:00Z',k).ok,false);});
test('Invalid date values do not silently use the current clock',()=>{for(const now of ['2026-10-12','2026-10-12T00:00:00','2026-02-29T00:00:00Z','2026-10-12T24:00:00Z','2026-10-12T00:00:00+14:01',NaN,new Date('invalid'),undefined])assert.equal(calc(now).ok,false);assert.equal(engine.parseInstant(new Date('invalid')),null);});
test('Invalid rule shape, phases and zero period return explicit errors',()=>{for(const mutate of [r=>r.schemaVersion=2,r=>r.kvk.periodDays=0,r=>r.kvk.matchingLeadDays=27,r=>r.transfer.phases[0].id='guessed',r=>r.transfer.fallbackMaxOccurrences=2,r=>r.transfer.windows=[]]){const r=clone();mutate(r);assert.equal(calc('2026-10-12T00:00:00Z',null,r).ok,false);}});
test('Inputs remain byte-identical through all calculations',()=>{const r=clone(),before=JSON.stringify(r),options={now:'2026-11-08T00:00:00Z',kingdom:972},o=JSON.stringify(options);engine.calculate(r,options);assert.equal(JSON.stringify(r),before);assert.equal(JSON.stringify(options),o);});
test('Calculation is independent of Date.now and ambient browser storage/network',()=>{const previous=Date.now;Date.now=()=>{throw Error('ambient time forbidden');};try{assert.equal(calc('2026-10-12T00:00:00Z').ok,true);}finally{Date.now=previous;}const source=fs.readFileSync(path.join(root,'js/schedule-engine.js'),'utf8');assert.ok(!/fetch\(|localStorage|sessionStorage|document\.|eval\(/.test(source));});
test('Model explicitly remains community prediction with source hashes',()=>{assert.equal(rules.assurance,'community-prediction');assert.ok(rules.sources.every(s=>/^https:\/\/kingshot\.net\//.test(s.url)&&/^[a-f0-9]{64}$/.test(s.sha256)));const r=ok(calc('2026-11-08T00:00:00Z'));assert.equal(r.kvk.officiallyConfirmed,false);assert.equal(r.transfer.officiallyConfirmed,false);});
const summary={scope:'Independent schedule-only engine; no third-party source code executed; no existing game calculator tests repeated.',tests:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,ruleSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'data/ui/external/schedule-rules.json'))).digest('hex'),results,frozenCases:frozen};
const at=process.argv.indexOf('--output');if(at>=0){const output=path.resolve(process.argv[at+1]);const relative=path.relative(root,output);if(!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative))throw Error('QA output must stay outside public repository');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(summary,null,2)+'\n');}
console.log(JSON.stringify({tests:summary.tests,passed:summary.passed,failed:summary.failed,failures:results.filter(r=>!r.pass)}));if(summary.failed)process.exitCode=1;

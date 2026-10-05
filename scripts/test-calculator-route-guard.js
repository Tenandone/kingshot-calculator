'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(require('path').join(__dirname,'../public/js/routes.calculators.js'),'utf8');
const body=source.match(/function createRenderGuard\(el, validPaths\) \{[\s\S]*?return \{ isAlive: isAlive \};\s*\}/)[0];
for(const prefix of ['', '/ko','/en','/ja','/zh-tw'])for(const slug of ['building','gear','hero-gear','charm','training','pet']){
 const context={__calcRenderSeq:0,location:{pathname:prefix+'/calc-'+slug+'/'}};
 vm.createContext(context);vm.runInContext(body+';this.makeGuard=createRenderGuard;',context);
 const el={},guard=context.makeGuard(el,['/calc-'+slug]);assert.equal(guard.isAlive(),true,context.location.pathname);
 context.location.pathname=prefix+'/calc-'+slug+'-other/';assert.equal(guard.isAlive(),false);
 context.location.pathname=prefix+'/calc-'+slug+'/';context.makeGuard(el,['/calc-'+slug]);assert.equal(guard.isAlive(),false,'Stale render must stop');
}
console.log('Calculator route guard: all locale paths, route boundaries and stale renders passed.');

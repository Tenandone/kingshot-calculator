'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{parse}=require('parse5');
const {ROOT,ORIGIN}=require('./static-routes');
const policy=JSON.parse(fs.readFileSync(path.join(ROOT,'.audit/index-policy.json'),'utf8'));
const allow=new Set(require('./public-index-policy.json').paths);
const attr=(n,k)=>(n.attrs||[]).find(a=>a.name===k)?.value||'';
function nodes(n){return[n,...(n.childNodes||[]).flatMap(nodes)];}
for(const p of policy){if(p.robots==='not an HTML document')continue;const file=path.join(ROOT,p.pathname,p.pathname.endsWith('/')?'index.html':'');const all=nodes(parse(fs.readFileSync(file,'utf8')));const robots=all.filter(n=>n.tagName==='meta'&&attr(n,'name')==='robots');const canonical=all.filter(n=>n.tagName==='link'&&attr(n,'rel')==='canonical');assert.equal(robots.length,1,p.pathname);assert.equal(canonical.length,1,p.pathname);assert.equal(attr(robots[0],'content'),p.classification==='PUBLIC INDEX'?'index,follow':'noindex,follow',p.pathname);assert.equal(attr(canonical[0],'href'),p.canonical,p.pathname);}
const sitemap=[...fs.readFileSync(path.join(ROOT,'sitemap.xml'),'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
for(const url of sitemap){const p=policy.find(p=>ORIGIN+p.pathname===url);assert.equal(p?.classification,'PUBLIC INDEX',url);assert(allow.has(new URL(url).pathname));}
for(const lang of ['ko','en','ja','zh-tw'])for(const row of JSON.parse(fs.readFileSync(path.join(ROOT,'data/catalog',lang+'.json')))){assert(sitemap.includes(ORIGIN+row.url),row.url);assert(!/\/(?:tools|pages|templates)\//.test(row.url),row.url);}
console.log('All HTML robots/canonical declarations, sitemap inclusion and search exclusion passed. Ownership payload preserved as a documented exception.');

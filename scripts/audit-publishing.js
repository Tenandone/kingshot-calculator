'use strict';
const fs=require('fs'),path=require('path'),{parse}=require('parse5');
const {ROOT,ORIGIN}=require('./static-routes');
const live=process.argv.includes('--live');
const output=process.env.KS_AUDIT_OUTPUT || path.join(ROOT,'.audit');
fs.mkdirSync(output,{recursive:true});
const baseline=JSON.parse(fs.readFileSync(path.join(ROOT,'scripts/broken-links-baseline.json'),'utf8').replace(/^\uFEFF/,''));
const original=process.env.KS_ORIGINAL_SITEMAP;
const maps=[fs.readFileSync(path.join(ROOT,'sitemap.xml'),'utf8')];if(original)maps.push(fs.readFileSync(original,'utf8'));
const urls=[...new Set(maps.flatMap(s=>[...s.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1])))];
const queue=[...urls,...baseline.map(r=>r.Url)], seen=new Set(),rows=[], links=new Map(),assets=new Map(),errors=[];
function targetFile(u) {
 const pathname=decodeURIComponent(new URL(u,ORIGIN).pathname);
 let file=path.resolve(ROOT,'.'+pathname);
 if(file!==ROOT&&!file.startsWith(ROOT+path.sep))throw Error('Outside root');
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)&&!pathname.endsWith('/')&&!path.extname(pathname)&&fs.existsSync(file+'.html'))file+='.html';
 return file;
}
async function get(url,body=true) {
 if(!live){const f=targetFile(url);return fs.existsSync(f)&&fs.statSync(f).isFile()?{status:200,text:body?fs.readFileSync(f,'utf8'):'',url}:{status:404,text:'',url};}
 try{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});return {status:r.status,text:body?await r.text():'',url:r.url};}catch(e){return {status:0,text:e.message,url};}
}
function tree(html){const nodes=[];function visit(n){nodes.push(n);(n.childNodes||[]).forEach(visit);}visit(parse(html));return nodes;}
function attr(n,k){return (n.attrs||[]).find(a=>a.name===k)?.value||'';}
function text(n){if(n.nodeName==='#text')return n.value;if(['script','style','noscript'].includes(n.tagName))return '';return (n.childNodes||[]).map(text).join(' ');}
function internal(raw,base){try{const u=new URL(raw,base);u.hash='';return u.origin===ORIGIN?u.href:null;}catch{return null;}}
async function inspect(url){
 const r=await get(url);const row={url,status:r.status,canonical:'',robots:'',redirect:'',translationKeys:[]};rows.push(row);
 if(r.status!==200){errors.push({type:'http',url,status:r.status});return;}
 const nodes=tree(r.text),baseNode=nodes.find(n=>n.tagName==='base');const base=baseNode?new URL(attr(baseNode,'href'),r.url).href:r.url;
 for(const n of nodes){
  if(n.tagName==='link'&&attr(n,'rel')==='canonical')row.canonical=attr(n,'href');
  if(n.tagName==='meta'&&attr(n,'name')==='robots')row.robots=attr(n,'content');
  if(n.tagName==='meta'&&attr(n,'http-equiv').toLowerCase()==='refresh'){
   row.redirect=internal(attr(n,'content').replace(/^.*?url=/i,''),base)||'';if(row.redirect)queue.push(row.redirect);
  }
  if(n.tagName==='a') {const href=internal(attr(n,'href'),base);if(href){links.set(href,url);if(!/\.(png|webp|jpg|jpeg|gif|svg|pdf|zip|json|txt|xml)$/i.test(new URL(href).pathname))queue.push(href);else assets.set(href,url);}}
  if(['img','script','source','iframe'].includes(n.tagName)) {const src=attr(n,'src');const u=src&&internal(src,base);if(u)assets.set(u,url);}
  if(n.tagName==='link'&&['stylesheet','icon'].includes(attr(n,'rel'))){const u=internal(attr(n,'href'),base);if(u)assets.set(u,url);}
  if(n.tagName==='img'&&attr(n,'srcset'))for(const candidate of attr(n,'srcset').split(',')){const u=internal(candidate.trim().split(/\s+/)[0],base);if(u)assets.set(u,url);}
 }
 row.translationKeys=[...new Set(text(nodes[0]).match(/\b(?:about|privacy|calc|home|nav|footer)\.[a-zA-Z]+(?:\.[a-zA-Z0-9]+)+\b/g)||[])];
 if(row.translationKeys.length)errors.push({type:'translation',url,keys:row.translationKeys});
 if(urls.includes(url)&&row.canonical!==url)errors.push({type:'canonical',url,canonical:row.canonical});
 if(urls.includes(url)&&/noindex/i.test(row.robots))errors.push({type:'sitemap-noindex',url});
}
(async()=>{
 while(queue.length){const batch=[];while(queue.length&&batch.length<6){const url=queue.shift();if(seen.has(url))continue;seen.add(url);batch.push(url);}await Promise.all(batch.map(inspect));}
 const assetRows=[];const assetList=[...assets];for(let i=0;i<assetList.length;i+=8)await Promise.all(assetList.slice(i,i+8).map(async([url,source])=>{
  const css=new URL(url).pathname.endsWith('.css');const r=await get(url,css);assetRows.push({url,source,status:r.status});
  if(r.status!==200)errors.push({type:'asset',url,source,status:r.status});
  if(css&&r.status===200)for(const m of r.text.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)){
   const u=internal(m[1],url);if(u&&!assets.has(u)){assets.set(u,url);assetList.push([u,url]);}
  }
 }));
 const summary={mode:live?'production':'local',sitemapURLs:urls.length,sitemapErrors:errors.filter(e=>urls.includes(e.url)).length,pagesChecked:rows.length,internalLinks:links.size,brokenInternalLinks:[...links.keys()].filter(u=>rows.find(r=>r.url===u)?.status!==200&&!assets.has(u)).length,assetsChecked:assets.size,brokenAssets:assetRows.filter(r=>r.status!==200).length,visibleStaticTranslationKeys:rows.reduce((n,r)=>n+r.translationKeys.length,0),baseline:baseline.map(b=>({url:b.Url,...rows.find(r=>r.url===b.Url)})),errors};
 fs.writeFileSync(path.join(output,live?'production.json':'local.json'),JSON.stringify({summary,rows,assets:assetRows},null,2));
 console.log(JSON.stringify({...summary,baseline:summary.baseline.length,errors:errors.slice(0,35)},null,2));if(errors.length)process.exitCode=1;
})();

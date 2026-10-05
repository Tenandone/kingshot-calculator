'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{parse}=require('parse5');
const {ROOT,ORIGIN}=require('./static-routes');
const live=process.argv.includes('--live');
const out=process.env.KS_AUDIT_OUTPUT||path.join(ROOT,'.audit/professional');
const attr=(n,k)=>(n.attrs||[]).find(a=>a.name===k)?.value||'';
function nodes(n){return [n,...(n.childNodes||[]).flatMap(nodes)];}
function text(n){if(['script','style','nav','footer','header'].includes(n.tagName))return '';return n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join(' ');}
function category(u){const p=new URL(u).pathname.replace(/^\/(ko|en|ja|zh-tw)(?=\/)/i,'');if(p==='/')return 'Home';if(/giftcode|coupon/.test(p))return 'Gift Codes';if(/calc/.test(p))return 'Calculators';if(/\/guides(?:\/|$)/.test(p))return 'Guides';if(/gear|charm/.test(p))return 'Gear';if(/\/database(?:\/|$)/.test(p))return 'Database';for(const [re,name] of [[/hero/,'Heroes'],[/building/,'Buildings'],[/research|waracademy/,'Research'],[/pet/,'Pets'],[/master/,'Masters'],[/alliance/,'Alliance'],[/events?/,'Events'],[/items?/,'Items'],[/database/,'Database'],[/guides?/,'Guides']])if(re.test(p))return name;return 'Other';}
function localFile(u){let p=path.join(ROOT,new URL(u).pathname);if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');if(!fs.existsSync(p)&&fs.existsSync(p+'.html'))p+='.html';return p;}
async function get(u){if(!live){const p=localFile(u);return {status:fs.existsSync(p)?200:404,html:fs.existsSync(p)?fs.readFileSync(p,'utf8'):''};}try{let r=await fetch(u,{signal:AbortSignal.timeout(20000)});if(r.status>=500)r=await fetch(u,{signal:AbortSignal.timeout(20000)});return {status:r.status,html:await r.text()};}catch(e){return {status:0,html:'',error:e.message};}}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const xml=live?(await get(ORIGIN+'/sitemap.xml')).html:fs.readFileSync(path.join(ROOT,'sitemap.xml'),'utf8');
 const sitemap=new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]));
 const queue=[...sitemap];for(const lang of ['ko','en','ja','zh-tw'])for(const slug of ['topup-guide','topup-promotion'])queue.push(`${ORIGIN}/${lang}/guides/${slug}.html`);
 const seen=new Set(),rows=[];
 while(queue.length){const batch=[];while(queue.length&&batch.length<5){const u=queue.shift();if(seen.has(u))continue;seen.add(u);batch.push(u);}
 await Promise.all(batch.map(async url=>{const r=await get(url);const all=nodes(parse(r.html));const main=all.find(n=>n.tagName==='main')||all.find(n=>n.tagName==='body')||all[0];const content=text(main).replace(/\s+/g,' ').trim();const links=[];
 for(const n of all.filter(n=>n.tagName==='a'))try{const u=new URL(attr(n,'href'),url);u.hash='';if(u.origin===ORIGIN){links.push(u.href);if(!/\.(?:png|webp|jpg|svg|json|xml|pdf|zip|txt)$/i.test(u.pathname))queue.push(u.href);}}catch{}
 const description=attr(all.find(n=>n.tagName==='meta'&&attr(n,'name')==='description')||{},'content');
 rows.push({url,status:r.status,category:category(url),title:text(all.find(n=>n.tagName==='title')||{}),description,h1:all.filter(n=>n.tagName==='h1').map(text),canonical:attr(all.find(n=>n.tagName==='link'&&attr(n,'rel')==='canonical')||{},'href'),robots:attr(all.find(n=>n.tagName==='meta'&&attr(n,'name')==='robots')||{},'content')||'index (default)',inSitemap:sitemap.has(url),contentCharacters:content.length,dataCells:all.filter(n=>n.tagName==='td').length,images:all.filter(n=>n.tagName==='img').map(n=>({src:attr(n,'src'),dimensions:!!(attr(n,'width')&&attr(n,'height'))})),explanatoryParagraphs:all.filter(n=>n.tagName==='p'&&text(n).trim().length>=60).length,originality:'Not established by automated inspection; editorial review required',relatedLinks:[...new Set(links)],calculatorLinks:links.filter(u=>/calc/.test(u)),mobileUX:'Requires browser validation; category sample results reported separately',lastUpdated:attr(all.find(n=>n.tagName==='meta'&&attr(n,'property')==='article:modified_time')||{},'content')||null,contentQuality:r.status!==200?'HTTP failure':content.length<180?'Review thin content':'Review accuracy and usefulness',contentHash:crypto.createHash('sha256').update(content).digest('hex')});}));}
 const groups={};for(const r of rows.filter(r=>r.inSitemap)){const g=groups[r.category]||(groups[r.category]={pages:0,images:0,calculatorLinks:0,thin:0});g.pages++;if(r.images.length)g.images++;if(r.calculatorLinks.length)g.calculatorLinks++;if(r.contentCharacters<180)g.thin++;}
 fs.writeFileSync(path.join(out,'inventory.json'),JSON.stringify({mode:live?'production':'local',checkedAt:new Date().toISOString(),groups,rows},null,2));console.log(JSON.stringify({pages:rows.length,sitemap:sitemap.size,groups},null,2));
})();

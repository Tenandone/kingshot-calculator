'use strict';
const fs=require('fs'),path=require('path'),{parse}=require('parse5');
const {ROOT,ORIGIN,readJson}=require('./static-routes');
const attr=(n,k)=>(n.attrs||[]).find(a=>a.name===k)?.value||'';
function nodes(n){return [n,...(n.childNodes||[]).flatMap(nodes)];}
function text(n){return n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join(' ').replace(/\s+/g,' ').trim();}
function category(p){if(/giftcode|coupon/.test(p))return 'codes';if(/calc/.test(p))return 'tools';if(/\/guides\//.test(p))return 'guides';if(/gear|charm/.test(p))return 'gear';if(/\/database\//.test(p))return 'data';if(/\/hero/.test(p))return 'heroes';if(/building/.test(p))return 'buildings';if(/research|waracademy/.test(p))return 'research';if(/pet/.test(p))return 'pets';if(/master/.test(p))return 'masters';if(/items?\//.test(p))return 'items';if(/events?\//.test(p))return 'events';return 'data';}
const urls=[...fs.readFileSync(path.join(ROOT,'sitemap.xml'),'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
const catalogs={ko:[],en:[],ja:[],'zh-tw':[]};const assets={};const heroes=readJson(path.join(ROOT,'data/heroes.json'));
for(const url of urls){const p=new URL(url).pathname;if(/\/(about|privacy|contact|terms)\/$/.test(p)||/^\/(en\/|ja\/|zh-tw\/)?$/.test(p))continue;const lang=p.match(/^\/(en|ja|zh-tw)\//)?.[1]||'ko';const f=path.join(ROOT,p,p.endsWith('/')?'index.html':'');if(!fs.existsSync(f))continue;const all=nodes(parse(fs.readFileSync(f,'utf8')));const main=all.find(n=>n.tagName==='main')||all[0];const h=nodes(main).find(n=>n.tagName==='h1');const title=text(h||all.find(n=>n.tagName==='title')||{}).split('|')[0].trim();const description=attr(all.find(n=>n.tagName==='meta'&&attr(n,'name')==='description')||{},'content');
 const hero=heroes.find(h=>p.includes('/hero/'+h.slug+'/'));
 const img=hero?.image||nodes(main).filter(n=>n.tagName==='img').map(n=>attr(n,'src')).find(src=>src.startsWith('/img/')&&!/logo|banner|og-v/.test(src))||'';
 let image='';if(img&&fs.existsSync(path.join(ROOT,img))&&fs.statSync(path.join(ROOT,img)).size<350000){image=img;assets[p]={image,source:'existing repository asset',alt:title};}
 catalogs[lang].push({url:p,title,description:description.slice(0,200),category:category(p),image,aliases:hero?[hero.name,hero.slug]:[p.split('/').filter(Boolean).pop().replace(/\.html$/,'').replace(/-/g,' ')]});
}
fs.mkdirSync(path.join(ROOT,'data/catalog'),{recursive:true});for(const [lang,entries] of Object.entries(catalogs))fs.writeFileSync(path.join(ROOT,'data/catalog',lang+'.json'),JSON.stringify(entries)+'\n');
fs.writeFileSync(path.join(ROOT,'data/asset-map.json'),JSON.stringify(assets,null,2)+'\n');console.log('Search catalog:',Object.fromEntries(Object.entries(catalogs).map(([k,v])=>[k,v.length])));

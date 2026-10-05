'use strict';
const fs=require('fs'),path=require('path'),{ROOT}=require('./static-routes');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const map={};const {copy}=require('./editorial-context');
for(const lang of ['ko','en','ja','zh-tw']){
 const entries=JSON.parse(fs.readFileSync(path.join(ROOT,'data/catalog',lang+'.json'),'utf8'));
 const heading={ko:'관련 데이터와 계산 도구',en:'Related data and tools',ja:'関連データと計算ツール','zh-tw':'相關資料與計算工具'}[lang];
 for(const e of entries){
  if(!['heroes','buildings','pets','gear','items','research','events'].includes(e.category))continue;
  const calc=/items\/forgehammers/.test(e.url)?'hero-gear':/items\/truegold\//.test(e.url)?'building':e.category==='buildings'?'building':e.category==='pets'?'pet':/charm/.test(e.url)?'charm':/mastery|hero/.test(e.url)?'hero-gear':e.category==='gear'?'gear':null;
  const targets=[entries.find(x=>x.category===e.category&&/\/(heroes|buildings|pet|items|research)\/$/.test(x.url)),calc&&entries.find(x=>x.url.endsWith('/calc-'+calc+'/')),entries.find(x=>x.category==='guides'&&(e.category==='heroes'?/kingshot-f2p-guide\.html/.test(x.url):/f2p-guide\.html/.test(x.url)))].filter(x=>x&&x.url!==e.url);
  if(e.category==='heroes')for(const suffix of ['/database/hero-shards.html','/database/widgets.html','/events/hall-of-heroes/']){const x=entries.find(x=>x.url.endsWith(suffix));if(x&&!targets.includes(x))targets.push(x);}
  if(e.category==='research'){for(const suffix of ['/calc-training/','/buildings/academy.html']){const x=entries.find(x=>x.url.endsWith(suffix));if(x)targets.push(x);}}
  if(e.category==='events'){const guides={'hall-of-governors':'hallofgovernors.html','strongest-governor':'hallofgovernors.html','kingdom-of-power':'kingdom-of-power-prep.html','mystic-trial':'mystic-trial.html','viking-vengeance':'viking'};const slug=e.url.split('/').filter(Boolean).pop();const g=guides[slug]&&entries.find(x=>x.category==='guides'&&x.url.includes(guides[slug]));if(g)targets.unshift(g);const calc=entries.find(x=>x.url.endsWith('/calc-training/'));if(calc)targets.push(calc);}
  if(!targets.length)continue;
  const html='<section data-kd-related style="max-width:1100px;margin:28px auto;padding:18px;border-top:1px solid #cbd5e1"><h2>'+heading+'</h2>'+(copy[lang][e.category]?'<p>'+esc(copy[lang][e.category])+'</p>':'')+'<ul>'+targets.map(x=>'<li><a href="'+esc(x.url)+'">'+esc(x.title)+'</a></li>').join('')+'</ul></section>';
  map[e.url]=html;
  const file=path.join(ROOT,e.url,e.url.endsWith('/')?'index.html':'');let source=fs.readFileSync(file,'utf8');source=source.replace(/<!-- kd-related:start -->[\s\S]*?<!-- kd-related:end -->/g,'');source=source.replace('</main>','<!-- kd-related:start -->'+html+'<!-- kd-related:end -->\n</main>');fs.writeFileSync(file,source.replace(/^[ \t]+$/gm,''));
 }
}
fs.writeFileSync(path.join(ROOT,'data/content-context.json'),JSON.stringify(map)+'\n');
console.log('Contextual link groups:',Object.keys(map).length);

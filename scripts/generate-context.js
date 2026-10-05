'use strict';
const fs=require('fs'),path=require('path'),{ROOT}=require('./static-routes');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const map={};
for(const lang of ['ko','en','ja','zh-tw']){
 const entries=JSON.parse(fs.readFileSync(path.join(ROOT,'data/catalog',lang+'.json'),'utf8'));
 const heading={ko:'관련 데이터와 계산 도구',en:'Related data and tools',ja:'関連データと計算ツール','zh-tw':'相關資料與計算工具'}[lang];
 for(const e of entries){
  if(!['heroes','buildings','pets','gear','items','research'].includes(e.category))continue;
  const calc=e.category==='buildings'?'building':e.category==='pets'?'pet':/charm/.test(e.url)?'charm':/mastery|hero/.test(e.url)?'hero-gear':e.category==='gear'?'gear':null;
  const targets=[entries.find(x=>x.category===e.category&&/\/(heroes|buildings|pet|items|research)\/$/.test(x.url)),calc&&entries.find(x=>x.url.endsWith('/calc-'+calc+'/')),entries.find(x=>x.category==='guides'&&(e.category==='heroes'?/hero\.html/.test(x.url):/f2p-guide\.html/.test(x.url)))].filter(x=>x&&x.url!==e.url);
  if(!targets.length)continue;
  const html='<section data-kd-related style="max-width:1100px;margin:28px auto;padding:18px;border-top:1px solid #cbd5e1"><h2>'+heading+'</h2><ul>'+targets.map(x=>'<li><a href="'+esc(x.url)+'">'+esc(x.title)+'</a></li>').join('')+'</ul></section>';
  map[e.url]=html;
  const file=path.join(ROOT,e.url,e.url.endsWith('/')?'index.html':'');let source=fs.readFileSync(file,'utf8');source=source.replace(/<!-- kd-related:start -->[\s\S]*?<!-- kd-related:end -->/g,'');source=source.replace('</body>','<!-- kd-related:start -->'+html+'<!-- kd-related:end -->\n</body>');fs.writeFileSync(file,source);
 }
}
fs.writeFileSync(path.join(ROOT,'data/content-context.json'),JSON.stringify(map)+'\n');
console.log('Contextual link groups:',Object.keys(map).length);

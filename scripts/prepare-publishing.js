'use strict';
// Shared publishing pass: canonical links, legacy redirects and one policy footer.
const fs = require('fs');
const path = require('path');
const { ROOT, ORIGIN, LANGS } = require('./static-routes');
const MARKER = '<!-- Kingshot legacy redirect: generated -->';
const read = f => fs.readFileSync(f, 'utf8');
const write = (f,s) => { fs.mkdirSync(path.dirname(f), {recursive:true}); fs.writeFileSync(f,s); };
const esc = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function walk(dir) {
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => {
    if (e.name.startsWith('.') || ['node_modules','dist','scripts'].includes(e.name)) return [];
    const p=path.join(dir,e.name);
    return e.isDirectory()?walk(p):e.name.endsWith('.html')?[p]:[];
  });
}
function fileFor(url) {
  const p=decodeURIComponent(new URL(url,ORIGIN).pathname);
  return path.join(ROOT,p.replace(/^\//,''), /\.[^/]+$/.test(p)?'':'index.html');
}
const exists = u => fs.existsSync(fileFor(u)) && fs.statSync(fileFor(u)).isFile();
const aliases = {};
// Windows is case-insensitive; GitHub Pages URLs are not.
const exactPaths = new Map(walk(ROOT).map(file => {
  const urlPath = '/' + path.relative(ROOT,file).replace(/\\/g,'/').replace(/index\.html$/, '');
  return [urlPath.toLowerCase(), urlPath];
}));
const folders=['ko','en','ja','zh-tw'];
// The database menu already has these five published articles. Restore its hub.
for(const lang of LANGS) {
  const links=fs.readdirSync(path.join(ROOT,lang.folder,'database')).filter(x=>x.endsWith('.html'));
  const labels={ko:['성장 데이터','영주 장비·보석과 영웅 성장 재료를 확인할 수 있습니다. 필요한 항목을 선택해 단계별 자료를 확인하세요.'],en:['Growth data','Choose a resource or equipment system to review its published upgrade data.'],ja:['成長データ','装備や成長素材を選び、公開されている段階別データを確認できます。'],'zh-TW':['成長資料','選擇裝備或成長材料，查看已公開的各階段資料。']}[lang.code];
  const canonical=`/${lang.folder}/database/`;
  const items=links.map(name=>{const h=read(path.join(ROOT,lang.folder,'database',name));const title=(h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||name;return `<li><a href="${canonical}${name}">${title}</a></li>`;}).join('\n');
  const metadata=`<meta property="og:title" content="${labels[0]}"><meta property="og:description" content="${labels[1]}"><meta property="og:url" content="${ORIGIN+canonical}"><meta property="og:type" content="website"><meta property="og:image" content="${ORIGIN}/img/kingshotdata-og-v5.png"><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:labels[0],url:ORIGIN+canonical})}</script>`;
  write(fileFor(canonical),`<!doctype html><html lang="${lang.htmlLang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${labels[0]} | KingshotData ${lang.code}</title><meta name="description" content="${labels[1]}"><link rel="canonical" href="${ORIGIN+canonical}">${metadata}<link rel="stylesheet" href="/css/common.css"></head><body><main style="max-width:860px;margin:auto;padding:24px"><h1>${labels[0]}</h1><p>${labels[1]}</p><ul>${items}</ul></main></body></html>`);
}
for(const folder of folders) {
  for(const section of ['pet','buildings','guides','database']) {
    for(const name of fs.readdirSync(path.join(ROOT,folder,section)).filter(x=>x.endsWith('.html')&&x!=='index.html')) {
      const target=`/${folder}/${section}/${name}`;
      const old=target.replace(/\.html$/,'');
      if(!exists(old) || read(fileFor(old)).includes(MARKER)) aliases[old]=target;
      if(folder==='ko') aliases[`/${section}/${name.replace(/\.html$/,'')}`]=target;
    }
  }
  for(const hub of ['buildings','guides','pet','masters','database']) {
    if(folder==='ko') aliases['/'+hub]=`/ko/${hub}/`;
  }
}
for(const name of ['pan','roman','valora']) aliases['/masters/'+name]='/ko/masters/'+name+'/';
aliases['/buildings/towncenter']='/ko/buildings/town-center.html';
aliases['/buildings/commandcenter']='/ko/buildings/commandcenter.html';
aliases['/guides/kingshot-f2p-route-g4']='/ko/guides/kingshot-f2p-guide.html';
aliases['/guides/coupon-countdown']='/tools/coupon-countdown.html';
aliases['/home']='/';
const baseline=JSON.parse(read(path.join(ROOT,'scripts/broken-links-baseline.json')).replace(/^\uFEFF/,''));
const legacyPaths=new Set(baseline.map(r=>new URL(r.Url).pathname.replace(/\/$/,'')));
['/home','/buildings/towncenter','/guides/coupon-countdown','/guides/kingshot-f2p-route-g4'].forEach(p=>legacyPaths.add(p));
function resolve(href,base) {
  try {
    const u=new URL(href,base);
    if(u.origin!==ORIGIN) return href;
    const exact=exactPaths.get(u.pathname.toLowerCase());
    if(exact && exact!==u.pathname) return exact+u.search+u.hash;
    const key=u.pathname.replace(/\/$/,'');
  let target=aliases[key];
  const lang=new URL(base).pathname.match(/^\/(en|ja|zh-tw)\//)?.[1];
  if(lang && !/^\/(ko|en|ja|zh-tw)\//.test(u.pathname) && target?.startsWith('/ko/')) {
    const localized=target.replace('/ko/','/'+lang+'/');if(exists(localized))target=localized;
  }
    return target && exists(target) ? target+u.search+u.hash : href;
  } catch {return href;}
}
function footer(lang) {
 const l=lang==='ko'?['소개','개인정보처리방침','이용약관','문의','게임 개발사 및 퍼블리셔와 독립적으로 운영하는 비공식 팬사이트입니다. 게임 이미지와 상표의 권리는 해당 권리자에게 있습니다.']:lang==='ja'?['サイト紹介','プライバシー','利用規約','お問い合わせ','開発元・パブリッシャーから独立した非公式ファンサイトです。ゲーム素材と商標の権利は各権利者に帰属します。']:lang==='zh-tw'?['關於','隱私權','使用條款','聯絡','本網站為獨立於遊戲開發商與發行商的非官方粉絲網站。遊戲素材與商標屬於各權利人。']:['About','Privacy','Terms','Contact','An unofficial fan site operated independently of the game developer and publisher. Game assets and trademarks belong to their respective owners.'];
 const prefix=lang==='ko'?'':'/'+lang;
 return `<!-- shared-policy-footer:start --><footer class="kd-policy-footer" style="max-width:1100px;margin:32px auto 80px;padding:20px 16px;border-top:1px solid #94a3b8;font:14px/1.7 system-ui"><nav aria-label="Site information" style="display:flex;flex-wrap:wrap;gap:16px">${['about','privacy','terms','contact'].map((x,i)=>`<a href="${prefix}/${x}/">${l[i]}</a>`).join('')}</nav><p>${l[4]}</p></footer><!-- shared-policy-footer:end -->`;
}
const runtime=`// Generated by scripts/prepare-publishing.js. Canonicalize links added by SPA renderers.
(function(){
 'use strict';
 var aliases=${JSON.stringify(aliases)};
 var casePaths=${JSON.stringify(Object.fromEntries([...exactPaths].filter(([key,value])=>key!==value)))};
 function patch(root){
  var anchors=root.matches&&root.matches('a[href]')?[root]:[];
  if(root.querySelectorAll)anchors=anchors.concat(Array.from(root.querySelectorAll('a[href]')));
  anchors.forEach(function(a){
   var u;try{u=new URL(a.getAttribute('href'),location.href);}catch(_){return;}
   if(u.origin!==location.origin)return;
   var exact=casePaths[u.pathname.toLowerCase()]||u.pathname.replace(/^\\/zh-TW(?=\\/)/,'/zh-tw');
   if(exact!==u.pathname){u.pathname=exact;a.setAttribute('href',exact+u.search+u.hash);}
   var target=aliases[u.pathname.replace(/\\/$/,'')];if(!target)return;
   var lang=(location.pathname.match(/^\\/(en|ja|zh-tw)\\//)||[])[1];
   if(lang&&!/^\\/(ko|en|ja|zh-tw)\\//.test(u.pathname)&&target.indexOf('/ko/')===0)target=target.replace('/ko/','/'+lang+'/');
   var href=target+u.search+u.hash;if(a.getAttribute('href')!==href)a.setAttribute('href',href);
  });
 }
 function start(){patch(document);new MutationObserver(function(records){records.forEach(function(r){if(r.type==='attributes')patch(r.target);else r.addedNodes.forEach(function(n){if(n.nodeType===1)patch(n);});});}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();\n`;
write(path.join(ROOT,'js/canonical-links.js'),runtime);
for(const file of walk(ROOT)) {
 let html=read(file); if(html.includes(MARKER)) continue;
 const relative=path.relative(ROOT,file).replace(/\\/g,'/');
 html=html.replace(/Kingshot gift codes, Kingshot coupon codes, Kingshot top up, Kingshot redeem guide, Kingshot codes, Kingshot coupon, KingshotData/g, 'Kingshot data, heroes, buildings, pets, calculators, guides, gift codes, KingshotData');
 html=html.replace(/footer-tools\.js\?v=[^"'\s<>]+/g, 'footer-tools.js?v=2026100602');
 html=html.replace(/canonical-links\.js\?v=[^"'\s<>]+/g, 'canonical-links.js?v=2026100603');
 if ((html.includes('footer-tools.js') || ['tools/coupon-countdown.html','pages/tools/landing.html'].includes(relative)) && !html.includes('/js/site-features.js')) html=html.replace(/<head\b[^>]*>/i, tag => tag+'\n<script src="/js/site-features.js?v=2026100601"></script>');
 const base=ORIGIN+'/'+relative.replace(/index\.html$/,'');
 // Work with HTML attributes (including literal markup in templates), not router identifiers.
 if(!relative.startsWith('templates/'))html=html.replace(/\bhref=(['"])([^'"]+)\1/g,(all,q,href)=>'href='+q+resolve(href,base)+q);
 // Fix the same obsolete URLs in JSON-LD.
 html=html.replace(/https:\/\/kingshotdata\.kr\/[^\s"<>]+/g,u=>{const r=resolve(u,base);return r.startsWith('/')?ORIGIN+r:r;});
 // Keep publisher ownership metadata; no ad requests until individual pages are reviewed.
 html=html.replace(/<script\b[^>]*src=["'][^"']*adsbygoogle\.js[^"']*["'][^>]*>\s*<\/script>/gi,'');
 if(!html.includes('/js/canonical-links.js')&&!/<title[^>]*>\s*Redirecting/i.test(html))html=html.replace(/<\/head>/i,'<script src="/js/canonical-links.js?v=2026100601" defer></script>\n</head>');
 if(folders.some(x=>relative.startsWith(x+'/')) && !html.includes('class="site-footer"') && !/<title[^>]*>\s*Redirecting/i.test(html)) {
   html=html.replace(/(?:\r?\n)*<!-- shared-policy-footer:start -->[\s\S]*?<!-- shared-policy-footer:end -->\s*/g,'');
   html=html.replace(/<\/body>/i,footer(relative.split('/')[0])+'\n</body>');
 }
 if(relative==='templates/spa-shell.html'||html.includes('Generated by scripts/generate-static-routes.js'))html=html.replace(/^[ \t]+$/gm,'');
 if(html!==read(file))write(file,html);
}
for(const [old,target] of Object.entries(aliases)) {
 if(!exists(target)) throw new Error('Missing redirect target '+target);
 const dest=fileFor(old);
 if(!legacyPaths.has(old)) {
   // Remove only this generator's obsolete file inside the verified repository.
   if(dest.startsWith(ROOT+path.sep)&&fs.existsSync(dest)&&read(dest).includes(MARKER))fs.unlinkSync(dest);
   continue;
 }
 if(fs.existsSync(dest)&&!read(dest).includes(MARKER))continue;
 // GitHub Pages has no configurable HTTP redirects. Zero-second refresh is its static fallback.
 write(dest,`<!doctype html>\n${MARKER}\n<html><head><meta charset="utf-8"><title>Redirecting to KingshotData</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="${ORIGIN+target}"><meta http-equiv="refresh" content="0;url=${esc(target)}"></head><body><p>This page has moved.</p><a href="${esc(target)}">Continue to the requested KingshotData page</a></body></html>\n`);
}
write(path.join(ROOT,'scripts/legacy-redirects.json'),JSON.stringify(aliases,null,2)+'\n');
console.log('Prepared canonical links, shared policy footer and '+Object.keys(aliases).length+' legacy aliases. Ad serving stays disabled pending page review.');

'use strict';
// Reviewed prose only. Game data, formulas, existing metadata and tables are not regenerated.
const fs = require('fs'), path = require('path'), {parse} = require('parse5');
const ROOT = path.resolve(__dirname, '..');
const locales = ['ko', 'en', 'ja', 'zh-tw'];
const CONTENT_VERSION = 'ks-community-20261012';
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read = p => fs.readFileSync(path.join(ROOT,p),'utf8');
const write = (p,s) => {fs.mkdirSync(path.dirname(path.join(ROOT,p)),{recursive:true}); if(!fs.existsSync(path.join(ROOT,p)) || read(p)!==s) fs.writeFileSync(path.join(ROOT,p),s);};
const json = p => JSON.parse(read(p));
const save = (p,v) => write(p,JSON.stringify(v,null,read(p).trim().includes('\n')?2:undefined)+'\n');
const attr = (n,k) => (n.attrs||[]).find(a=>a.name===k)?.value;
const nodes = n => [n,...(n.childNodes||[]).flatMap(nodes)];
const nodeText = n => n.nodeName==='#text'?n.value:(n.childNodes||[]).map(nodeText).join('');
const sourceLabels = {
 ko:['출처: 네이버 킹샷공략카페','원문 작성','게시','자료 검토','운영자 자료를 참고해 재구성','회원의 실전 아이디어를 자체 설명으로 재구성'],
 en:['Source: Naver Kingshot Strategy Cafe','Original author','Published','Source review','Rewritten from the operator’s material','Member gameplay ideas independently explained'],
 ja:['出典：Naver キングショット攻略カフェ','原文著者','投稿日','資料確認','運営者の資料を基に再構成','会員の実戦アイデアを独自の説明に再構成'],
 'zh-tw':['來源：Naver Kingshot 攻略咖啡館','原文作者','發布日期','資料檢視','依營運者資料重新編寫','以自己的說明整理會員的實戰想法']
};
function sourceText(u,l) {
 const t=sourceLabels[l];
 const kind={ko:['운영자','회원'],en:['Operator','Member'],ja:['運営者','会員'],'zh-tw':['營運者','會員']}[l];
 return `${t[0]} · ${u.sources.map(s=>`${t[1]}: ${s.author} [${kind[s.kind==='member'?1:0]}] (${t[2]}: ${s.date})`).join(' · ')} · ${t[3]}: ${u.reviewedAt}. ${u.sources.some(s=>s.kind==='member')?t[5]:t[4]}.`;
}
function block(u,l) {
 const v=u.locales[l==='zh-tw'?'zh-TW':l];let i=0;
 const html=v.html.replace(/<(h[23])>/g,(_,tag)=>`<${tag} id="community-${u.id.toLowerCase()}-${++i}">`);
 if(/cafe\.naver|<script|<img|<table|\son\w+=/i.test(html))throw Error('Unreviewed content in '+u.id);
 return `<!-- community-${u.id}:start --><section class="kd-community-guide" data-community-unit="${u.id}" lang="${l==='zh-tw'?'zh-Hant':l}" style="max-width:56rem;margin:2rem auto;padding:0 1rem;text-align:start;line-height:1.8;overflow-wrap:anywhere">${html}<p class="muted community-source" style="font-size:.85rem;line-height:1.7">${esc(sourceText(u,l))}</p></section><!-- community-${u.id}:end -->`;
}
function without(html,id) {return html.replace(new RegExp(`<!-- community-${id}:start -->[\\s\\S]*?<!-- community-${id}:end -->`,'g'),'');}
function append(p,u,l,predicate) {
 let html=without(read(p),u.id);
 const target=nodes(parse(html,{sourceCodeLocationInfo:true})).find(predicate);
 const at=target?.sourceCodeLocation?.endTag?.startOffset;
 if(at==null)throw Error('Missing insertion target '+p);
 write(p,html.slice(0,at)+block(u,l)+html.slice(at));
}
const route = (u,l) => ({E01:`${l}/buildings/court-of-justice.html`,E02:`${l==='ko'?'':l+'/'}events/hero-roulette/index.html`,E03:`${l==='ko'?'':l+'/'}events/merchant-empire/index.html`,E04:`${l}/guides/kingdom-of-power-prep.html`,E05:`${l}/pet/index.html`,E06:`${l}/guides/equipment-investment.html`,E07:`${l}/guides/truegold.html`,E08:`${l}/guides/kingshot-bearhunt.html`,E09:`${l}/guides/transfer.html`,E10:`${l}/guides/alliance-mobilization.html`,E13:`${l==='ko'?'':l+'/'}about/index.html`}[u.id]);
function newGuide(u,l) {
 const v=u.locales[l==='zh-tw'?'zh-TW':l],slug=u.id==='E06'?'equipment-investment':'alliance-mobilization';
 const template=read(`${l}/guides/transfer.html`),head=template.match(/<head[^>]*>([\s\S]*?)<\/head>/i)[1];
 // Reuse the site's existing shared assets and navigation, without unrelated page scripts.
 const shared=[...head.matchAll(/<link\b[^>]*>|<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/gi)].map(x=>x[0]).filter(x=>!(/rel=["'](?:canonical|alternate|preload)["']/i.test(x)));
 const url=`https://kingshotdata.kr/${l}/guides/${slug}.html`;
 const alternatives=locales.map(lang=>`<link rel="alternate" hreflang="${lang==='zh-tw'?'zh-TW':lang}" href="https://kingshotdata.kr/${lang}/guides/${slug}.html">`).join('\n');
 const footer=template.match(/<!-- shared-policy-footer:start -->[\s\S]*?<!-- shared-policy-footer:end -->/)?.[0]||'';
 return `<!doctype html>\n<html lang="${l==='zh-tw'?'zh-Hant':l}" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="index,follow"><meta name="color-scheme" content="light dark"><title>${esc(v.title)} | KingshotData</title><meta name="description" content="${esc(v.description)}"><link rel="canonical" href="${url}">${alternatives}<link rel="alternate" hreflang="x-default" href="https://kingshotdata.kr/en/guides/${slug}.html"><meta property="og:type" content="article"><meta property="og:title" content="${esc(v.title)}"><meta property="og:description" content="${esc(v.description)}"><meta property="og:url" content="${url}"><meta property="og:site_name" content="KingshotData"><meta property="og:image" content="https://kingshotdata.kr/img/kingshotdata-og-v5.png"><meta property="og:locale" content="${({ko:'ko_KR',en:'en_US',ja:'ja_JP','zh-tw':'zh_TW'})[l]}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(v.title)}"><meta name="twitter:description" content="${esc(v.description)}"><meta name="twitter:image" content="https://kingshotdata.kr/img/kingshotdata-og-v5.png"><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Article',headline:v.title,description:v.description,inLanguage:l==='zh-tw'?'zh-Hant':l,mainEntityOfPage:url,dateModified:u.reviewedAt,image:'https://kingshotdata.kr/img/kingshotdata-og-v5.png',publisher:{'@type':'Organization',name:'KingshotData'}}).replace(/</g,'\\u003c')}</script>${shared.join('\n')}<style>.community-guide-main{max-width:56rem;margin:2rem auto;padding:0 1rem;line-height:1.8;overflow-wrap:anywhere}.community-guide-main h1{line-height:1.25}.community-guide-main .kd-community-guide{padding:0}.community-guide-main h2,.community-guide-main h3{line-height:1.4;margin-top:1.6em}.community-guide-main li{margin:.5em 0}.community-guide-main a{text-decoration:underline}</style></head><body><header class="top"><div class="brand"><a href="/${l}/" aria-label="KingshotData Home"><img src="/img/brand/bear-symbol-112.png" alt="" width="52" height="52"></a></div><nav class="lang" aria-label="Language">${locales.map(lang=>`<a href="/${lang}/guides/${slug}.html"${lang===l?' aria-current="page"':''}>${lang==='zh-tw'?'TW':lang.toUpperCase()}</a>`).join(' ')}</nav></header><main id="main" class="community-guide-main"><h1>${esc(v.title)}</h1><p>${esc(v.description)}</p>${block(u,l)}</main>${footer}</body></html>\n`;
}
function applyCommunityContent() {
 const data=json('data/editorial/community-guides.json');
 for(const u of data.units) for(const l of locales) {
  const p=route(u,l),key=l==='zh-tw'?'zh-TW':l,v=u.locales[key];
  if(u.id==='E06'||u.id==='E10') {write(p,newGuide(u,l));continue;}
  if(u.id==='E13') {
   // One shared introduction serves both static HTML and the legacy localized renderer.
   const intro=block(u,l),paragraphs=[...v.html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(x=>x[1].replace(/<[^>]+>/g,''));
   for(const name of ['common','about']) {
    const f=`i18n/${key}/${name}.json`,d=json(f);
    for(let i=1;i<=4;i++)d[`about.intro.p${i}`]=paragraphs[i-1]||'';
    delete d['about.intro.p5'];
    d['about.community.source']=sourceText(u,l);
    Object.assign(d,v.aboutCopy||{});save(f,d);
   }
   let html=read(p),article=nodes(parse(html,{sourceCodeLocationInfo:true})).find(n=>n.tagName==='article'&&attr(n,'class')?.includes('ssg-initial-content'));
   if(!article)throw Error('Missing about article');
   const child=article.childNodes||[],h1=child.find(n=>n.tagName==='h1'),next=child.find(n=>n.tagName==='h2');
   const old=child.find(n=>attr(n,'data-community-unit')==='E13');
   const start=h1.sourceCodeLocation.endOffset,end=next?.sourceCodeLocation.startOffset;
   if(end==null)throw Error('Missing about content boundary');
   const copy=json(`i18n/${key}/common.json`);
   const funding=`<section class="about-block" data-community-funding style="text-align:start"><h2>${esc(copy['about.section.ads'])}</h2><p>${esc(copy['about.ads.p1'])}</p><p>${esc(copy['about.ads.p2'])}</p></section>`;
   html=html.slice(0,start)+intro+funding+html.slice(end);
   const content=nodes(parse(html,{sourceCodeLocationInfo:true}));
   const heading=content.find(n=>n.tagName==='h2'&&nodeText(n)===copy['about.section.copyright']);
   const copyright=heading&&content.find(n=>n.tagName==='p'&&n.sourceCodeLocation?.startOffset>heading.sourceCodeLocation.endOffset);
   if(!copyright)throw Error('Missing copyright notice '+p);
   const bounds=copyright.sourceCodeLocation;
   html=html.slice(0,bounds.startOffset)+`<p>${esc(copy['about.copyright.p1'])}</p>`+html.slice(bounds.endOffset);
   write(p,html);continue;
  }
  if(u.id==='E02'||u.id==='E03') {
   const f=`i18n/${key}/events.json`,d=json(f);d.records[u.id==='E02'?'hero-roulette':'merchant-empire'].strategyHtml=block(u,l);save(f,d);
   append(p,u,l,n=>n.tagName==='article'&&attr(n,'class')?.includes('ssg-initial-content'));continue;
  }
  if(u.id==='E05') {
   const f=`data/ui/equipment-pets-items/${l}.json`,d=json(f),list=d.lists.find(x=>x.route===`/${l}/pet/`);if(!list)throw Error('Missing pet list');list.editorialHTML=block(u,l);save(f,d);
   append(p,u,l,n=>n.tagName==='article'&&attr(n,'class')?.includes('kcat-list'));continue;
  }
  append(p,u,l,n=>u.id==='E07'?n.tagName==='section'&&attr(n,'aria-label')==='Truegold Chart':n.tagName==='main');
 }
 // The i18n loader uses force-cache. A release must invalidate old dictionaries
 // even when a returning visitor enters About through another SPA route.
 function refreshCache(dir) {
  for(const entry of fs.readdirSync(path.join(ROOT,dir),{withFileTypes:true})) {
   if(entry.name.startsWith('.')||['node_modules','dist'].includes(entry.name))continue;
   const relative=path.posix.join(dir,entry.name);
   if(entry.isDirectory()){refreshCache(relative);continue;}
   if(!entry.name.endsWith('.html'))continue;
   const html=read(relative),updated=html.replace(/window\.__V="[^"]+"/g,`window.__V="${CONTENT_VERSION}"`)
    .replace(/(\/js\/ui\/equipment-pets-items-view\.js\?v=)[^"'\s<>]+/g,`$1${CONTENT_VERSION}`);
   if(updated!==html)write(relative,updated);
  }
 }
 refreshCache('');
 console.log('Applied community prose to 36 existing and 8 new localized pages.');
}
if(require.main===module)applyCommunityContent();
module.exports={applyCommunityContent,block,sourceText,route};

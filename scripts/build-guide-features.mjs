// Generate only vetted guide behavior from the fixed, reviewed Git baseline.
// This never evaluates fetched HTML/scripts and never edits the original guides.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const qa=path.resolve(site,'../qa');
const BASE='0de7c3697ae1ef4370e2bc0ffdcb53fa761aeb36';
const slugs=['fishing-event-guide','kingdom-of-power-prep','kingshot-giftcode','ssr-hero-vs','truegold'];
const locales=['ko','en','ja','zh-tw'];
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const records=[],functions=[],lookup={};

function readInline(file){
  const html=execFileSync('git',['show',`${BASE}:${file}`],{cwd:site,encoding:'utf8',maxBuffer:4*1024*1024});
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter(m=>!(/\bsrc\s*=/i.test(m[1])||/\btype\s*=\s*["'][^"']*json/i.test(m[1])));
  if(scripts.length!==1)throw new Error(`${file}: expected exactly one vetted inline behavior, found ${scripts.length}`);
  const m=scripts[0];
  return {html,code:m[2],line:html.slice(0,m.index).split('\n').length};
}
function transform(source,slug){
  let code=source;const edits=[];
  function cut(a,b,why){const start=code.indexOf(a),end=code.indexOf(b,start+a.length);if(start<0||end<0)throw new Error(`${slug}: missing boundary ${a} -> ${b}`);const removed=code.slice(start,end);edits.push({why,removedSha256:hash(removed),removedChars:removed.length,startAnchor:a,endAnchor:b});code=code.slice(0,start)+code.slice(end);}
  function replace(re,replacement,why,expected=1){let count=0;code=code.replace(re,m=>{count++;edits.push({why,removedSha256:hash(m),removedChars:m.length,replacement});return replacement;});if(count!==expected)throw new Error(`${slug}: ${why}, expected ${expected}, found ${count}`);}
  if(slug==='fishing-event-guide'){
    cut("var mqMobile =",'var modal =','remove standalone header/tabs sticky lifecycle');
  }else if(slug==='kingdom-of-power-prep'){
    cut('function setStickyTop(){','function setupMobilePreview(){','remove standalone header/tabs sticky measurement');
    replace(/^\s*requestAnimationFrame\(setStickyTop\);\r?\n/gm,'','remove sticky-only scheduled frame');
    replace(/^\s*setTimeout\(setStickyTop, 60\);\r?\n/gm,'','remove sticky-only timeout');
    replace(/^\s*setStickyTop\(\);\r?\n/gm,'','remove sticky calls while retaining mobile table layout listeners',6);
    replace(/^\s*var header = document\.querySelector\('header\.top'\);\r?\n/gm,'','remove header observation');
    replace(/^\s*var tabs = document\.querySelector\('nav\.section-tabs'\);\r?\n/gm,'','remove tabs observation');
    replace(/^\s*if\(header\) ro\.observe\(header\);\r?\n/gm,'','remove header observer target');
    replace(/^\s*if\(tabs\) ro\.observe\(tabs\);\r?\n/gm,'','remove tabs observer target');
    replace(/if\(document\.readyState === 'loading'\)\{[\s\S]*?\}\s*else\{\s*initStickyObservers\(\);\s*setupMobilePreview\(\);\s*bindModalEvents\(\);\s*\}/,'initStickyObservers();\n      setupMobilePreview();\n      bindModalEvents();','mount after reader inserts the guide DOM');
  }else if(slug==='ssr-hero-vs'){
    cut('var mqMobile =','const HEROES =','remove standalone header/tabs sticky lifecycle');
    replace(/^\s*initStickyObservers\(\);\r?\n/gm,'','remove standalone sticky initializer');
    replace(/if\(document\.readyState === 'loading'\)\{\s*document\.addEventListener\('DOMContentLoaded', init\);\s*\}\s*else\{\s*init\(\);\s*\}/,'init();','mount after reader inserts the guide DOM');
  }else if(slug==='kingshot-giftcode'){
    // UI14 coupon intro copy stays aligned with the static first paragraph.
    // Only these reviewed display strings differ from the immutable baseline.
    const couponIntroCopies = [
      ["lead: \"iOS 및 Android용 활성 및 만료된 킹샷:Kingshot 기프트코드 목록 및 킹샷공략 입니다.\"", "lead: \"현재 사용 가능한 킹샷 기프트코드와 공식 교환 페이지를 확인하세요. iOS·Android 입력 방법, 코드가 적용되지 않을 때의 확인 사항, 만료 코드 기록을 함께 제공합니다.\""],
      ["lead: \"iOS・Android向けの有効コードと期限切れコードをまとめたキングショット:Kingshotギフトコード一覧と攻略ページです。\"", "lead: \"使用できるキングショットのギフトコードと公式交換ページを確認できます。iOS・Androidでの入力方法、コードが使えないときの確認事項、期限切れコードの記録も掲載しています。\""],
      ["lead: \"Find active and expired Kingshot gift codes for iOS and Android, plus the official redeem page, code entry guide, and useful Kingshot guides.\"", "lead: \"Find active Kingshot gift codes and the official redeem page. Check how to redeem on iOS and Android, troubleshoot codes that do not work, and view the expired-code archive.\""],
    ];
    for (const [oldCopy,newCopy] of couponIntroCopies) {
      if (code.includes(oldCopy)) replace(oldCopy,newCopy,'UI14 coupon intro copy');
    }
    cut('function setFaqJsonLd(t){','function safeText(s){','head JSON-LD remains owned by the original HTML and reader');
    replace(/^\s*setFaqJsonLd\(t\);\r?\n/gm,'','do not regenerate head JSON-LD');
    replace(/^\s*document\.documentElement\.setAttribute\("lang", (?:lang|"en"|"zh-Hant")\);\r?\n/gm,'','reader owns document language');
    replace(/^\s*document\.title = t\.metaTitle;\r?\n/gm,'','reader owns document title');
    replace(/^\s*document\.querySelector\('meta\[[^\r\n]+\r?\n/gm,'','reader owns metadata',5);
    cut('const mqMobile =','async function init(){','remove standalone header/tabs sticky lifecycle');
    replace(/^\s*initStickyObservers\(\);\r?\n/gm,'','remove standalone sticky initializer');
    replace(/if \(document\.readyState === 'loading'\) \{\s*document\.addEventListener\('DOMContentLoaded', init\);\s*\} else \{\s*init\(\);\s*\}/,'init();','mount after reader inserts the guide DOM');
    replace(/catch \(e\) \{\s*console\.error\(e\);/,'catch (e) {\n          if (e && e.name === "AbortError") return;\n          console.error(e);','route abort is a completed unmount, not a coupon loading failure');
    replace(/function parseExpiryMs\(c\)\{[\s\S]*?(?=function escapeHTML\(s\)\{)/,'function parseExpiryMs(c){ return window.KD_COUPON_STATE.expiry(c).ms; }\n    function isPerpetual(c){ return window.KD_COUPON_STATE.expiry(c).kind === "permanent"; }\n    function isActive(c, nowMs){ return window.KD_COUPON_STATE.isActive(c, nowMs); }\n\n    ','share publication status and expiry rules with every coupon consumer');
    replace(/\.filter\(c => safeText\(c\.code\)\.toLowerCase\(\) !== "jackkaoandks"\)\s*/,'','source publication status replaces consumer-only code blacklist');
    replace(/\.sort\(\(a, b\) => \{[\s\S]*?return ap - bp;\s*\}\)/,'.sort(window.KD_COUPON_STATE.sortActive)','sort known expiries first and retain unknown/permanent active codes');
    replace(/\(function\(\)\{\s*async function init\(\)\{/,'return (function(){\n      async function init(){','return coupon readiness to reader');
    replace(/\n\s*init\(\);\s*\}\)\(\);\s*$/,'\n      return init();\n    })();\n','wait for coupon DOM rendering before restoring reader position');
    replace(/const grid = document\.getElementById\("couponGrid"\);\s*if \(grid\) \{\s*grid\.innerHTML = "";\s*grid\.appendChild\(makeCodeCard\(\{ code:"VIP777", until:"[^"]*" \}, LANG_DATA(?:\.[a-zA-Z]+|\["[^"]+"\])\)\);\s*grid\.appendChild\(makeCodeCard\(\{ code:"Kingshot888", until:"[^"]*" \}, LANG_DATA(?:\.[a-zA-Z]+|\["[^"]+"\])\)\);\s*\}/,'const grid = document.getElementById("couponGrid");\n          if (grid) {\n            grid.textContent = ({ko:"쿠폰을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.",en:"Could not load codes. Please refresh shortly.",ja:"コードを読み込めませんでした。しばらくして再読み込みしてください。","zh-TW":"無法載入優惠碼，請稍後重新整理。"})[currentLanguage] || "Could not load codes.";\n          }','do not manufacture active fallback codes after a failed request');

  }else if(slug==='truegold'){
    cut('function setStickyTop(){','renderTable();','remove standalone header/tabs sticky measurement');
    cut('    setStickyTop();','  })();','remove standalone header/tabs sticky lifecycle');
  }
  if(/setStickyTop|DOMContentLoaded|\beval\s*\(|new\s+Function\s*\(/.test(code))throw new Error(`${slug}: unsupported initializer remains`);
  // Preserve game tables, formula functions and feature handlers verbatim.
  const ranges={
    'truegold':['const ICONS =','function setStickyTop(){'],
    'ssr-hero-vs':['const HEROES =','function init(){'],
    'kingshot-giftcode':['function escapeHTML(s){','function applyLanguage(lang){'],
    'fishing-event-guide':['var modal =','    })();'],
    'kingdom-of-power-prep':['function setupMobilePreview(){','function initStickyObservers(){']
  };
  const [from,to]=ranges[slug],start=source.indexOf(from),end=source.indexOf(to,start+from.length),protectedCode=source.slice(start,end);
  if(start<0||end<0||!code.includes(protectedCode))throw new Error(`${slug}: protected data/formula/feature body changed`);
  return {code,edits,protectedCodeSha256:hash(protectedCode),protectedCodeChars:protectedCode.length};
}

for(const slug of slugs)for(const lang of locales){
  const file=`${lang}/guides/${slug}.html`,input=readInline(file),result=transform(input.code,slug),name=`guideFeature${functions.length}`;
  const existing=records.find(r=>r.transformedSha256===hash(result.code));
  lookup[`${slug}|${lang}`]=existing?existing.functionName:name;
  if(!existing)functions.push(`function ${name}(document, window, fetch, ResizeObserver, setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame, cancelAnimationFrame, navigator) {\n${result.code}\n}`);
  records.push({file,slug,lang,functionName:lookup[`${slug}|${lang}`],baseCommit:BASE,htmlSha256:hash(input.html),sourceLine:input.line,sourceInlineSha256:hash(input.code),transformedSha256:hash(result.code),protectedCodeSha256:result.protectedCodeSha256,protectedCodeChars:result.protectedCodeChars,edits:result.edits});
}

const generated=`/* Generated by scripts/build-guide-features.mjs from reviewed baseline ${BASE}. */
(function(global){
 'use strict';
 if(global.KD_GUIDE_FEATURES) return;
 ${functions.join('\n\n')}
 const registry={${Object.entries(lookup).map(([k,v])=>`${JSON.stringify(k)}:${v}`).join(',\n')}};
 function normalizeLang(value){const v=String(value||'ko').toLowerCase();return v==='zh-tw'||v==='zh-hant'?'zh-tw':v;}
 function mount(slug,lang,ctx){
   const fn=registry[String(slug)+'|'+normalizeLang(lang)];
   if(!fn) return function(){};
   if(!ctx||!ctx.document||!ctx.window) throw new Error('Guide feature mount requires scoped document and window');
   const doc=ctx.document, win=ctx.window;
   const bind=(name)=>ctx[name]||(typeof win[name]==='function'?win[name].bind(win):undefined);
   const body=doc.body, html=doc.documentElement;
   const before={overflow:body&&body.style.overflow,modalOpen:body&&body.classList.contains('modal-open'),js:html&&html.classList.contains('js')};
   let disposed=false;
   function cleanup(){
     if(disposed)return;disposed=true;
     const imageModal=doc.getElementById('imageModal'),tableModal=doc.getElementById('table-modal');
     for(const modal of [imageModal,tableModal]) if(modal){modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');}
     if(body){body.style.overflow=before.overflow||'';body.classList.toggle('modal-open',!!before.modalOpen);}
     if(html&&!before.js&&slug==='ssr-hero-vs')html.classList.remove('js');
     if(typeof ctx.cleanup==='function')ctx.cleanup();
   }
   try{
     const ready=fn(doc,win,ctx.fetch||bind('fetch'),ctx.ResizeObserver||win.ResizeObserver,bind('setTimeout'),bind('clearTimeout'),bind('setInterval'),bind('clearInterval'),bind('requestAnimationFrame'),bind('cancelAnimationFrame'),ctx.navigator||win.navigator);
     cleanup.ready=Promise.resolve(ready);
   }catch(error){cleanup();throw error;}
   return cleanup;
 }
 global.KD_GUIDE_FEATURES=Object.freeze({version:'ks-ui12-guide-features-v1',baseCommit:${JSON.stringify(BASE)},mount,supports:(slug,lang)=>Boolean(registry[String(slug)+'|'+normalizeLang(lang)])});
})(window);
`;
if(/\beval\s*\(|new\s+Function\s*\(/.test(generated))throw new Error('No runtime code evaluation allowed');
fs.mkdirSync(qa,{recursive:true});
fs.writeFileSync(path.join(site,'js/guide-features.js'),generated);
execFileSync(process.execPath,['--check',path.join(site,'js/guide-features.js')],{stdio:'pipe'});
fs.writeFileSync(path.join(qa,'guide-features-build.json'),JSON.stringify({schema:'ks-guide-features-build-v1',generatedAt:new Date().toISOString(),baseCommit:BASE,publicOutput:'js/guide-features.js',outputSha256:hash(generated),sourceVariantCount:records.length,generatedFunctionCount:functions.length,behavior:'fixed static functions only; no fetched script execution; reader owns head and sticky lifecycle',records},null,2)+'\n');
console.log(JSON.stringify({variants:records.length,functions:functions.length,sha256:hash(generated),bytes:Buffer.byteLength(generated)}));

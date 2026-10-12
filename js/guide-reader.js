/* KingShot guide reader: static documents remain the canonical source. */
(function () {
  'use strict';
  if (window.KD_GUIDE_READER) return;
  const VERSION='ks-ui16-tw-20261012', STORE='KSD_GUIDE_READER_V1';
  const pathPattern=/^\/(ko|en|ja|zh-tw)\/guides(?:\/([^/?#]+))?\/?$/i;
  const copy={
    ko:['가이드','가이드 검색','전체','목록','목차','관련 가이드','가이드를 선택하세요','검색 결과가 없습니다.','불러오는 중…','목록으로','초보자','성장','전투','이벤트','보상','시스템'],
    en:['Guides','Search guides','All','List','Contents','Related guides','Choose a guide','No guides found.','Loading…','Back to list','Beginners','Growth','Battle','Events','Rewards','Systems'],
    ja:['ガイド','ガイドを検索','すべて','一覧','目次','関連ガイド','ガイドを選択','該当するガイドはありません。','読み込み中…','一覧に戻る','初心者','育成','戦闘','イベント','報酬','システム'],
    'zh-tw':['攻略','搜尋攻略','全部','列表','目錄','相關攻略','選擇攻略','沒有符合的攻略。','載入中…','返回列表','新手','成長','戰鬥','活動','獎勵','系統']
  };
  let registry, entries, current, shell, content, sidebar, list, input, category, toc, toolbar, status;
  let seq=0, featureCleanup=()=>{}, featureReady=Promise.resolve(), pending, restoring=false, scrollTimer, restoreSeq=0, cancelRestore=()=>{}, state={locales:{},positions:{}};
  const cache=new Map(), categoryKeys=['beginner','growth','battle','events','rewards','systems'];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const locale=()=>current?.locale||location.pathname.split('/')[1]||'ko';
  const words=()=>copy[locale()]||copy.ko;
  const pathKey=p=>p.replace(/\/index\.html$/i,'/').replace(/\/$/,'').toLowerCase();
  function entryFor(value){let u;try{u=new URL(value,location.href);}catch{return null;}if(![location.origin,'https://kingshotdata.kr'].includes(u.origin))return null;return entries?.find(e=>pathKey(e.url)===pathKey(u.pathname))||null;}
  const localURL=value=>{const u=new URL(value,location.href);return u.pathname+u.search+u.hash;};
  function readState(){try{const x=JSON.parse(sessionStorage.getItem(STORE));if(x?.version===1)state={locales:x.locales||{},positions:x.positions||{}};}catch{}}
  function writeState(){try{sessionStorage.setItem(STORE,JSON.stringify({version:1,...state}));}catch{}}
  function localState(){return state.locales[locale()]||(state.locales[locale()]={query:'',category:'all',listY:0});}
  function readingAnchor(){
    const edge=Math.max(0,toolbar?.getBoundingClientRect().bottom||0)+8;let best=null,distance=Infinity;
    content.querySelectorAll('[id]').forEach(el=>{if(el.closest('[hidden],[role="dialog"],.modal,[data-kd-personal]')||!el.getClientRects().length)return;const rect=el.getBoundingClientRect();if(rect.bottom<=0)return;const delta=Math.abs(rect.top-edge);if(delta<distance){distance=delta;best={id:el.id,offset:rect.top};}});
    return best;
  }
  function snapshot(){if(!shell||restoring||pathKey(location.pathname)!==pathKey(current.url))return;const s=localState();s.query=input.value.slice(0,160);s.category=category.value;s.listY=list.scrollTop;
    const mobileList=shell.classList.contains('ks-list-open')&&matchMedia('(max-width:800px)').matches;const value={path:current.url,readY:mobileList?(state.positions[current.url]?.readY||0):scrollY,anchor:mobileList?(state.positions[current.url]?.anchor||null):readingAnchor(),query:s.query,category:s.category,listY:s.listY,open:false,details:[...content.querySelectorAll('details')].map(d=>d.open)};
    state.positions[current.url]=value;try{history.replaceState({...history.state,ksGuide:value},'',location.href);}catch{}writeState();return value;
  }
  function scopes(){
    const controller=new AbortController(), cleanups=[];let alive=true;
    const listen=(target,type,fn,options)=>{if(type==='DOMContentLoaded'){queueMicrotask(()=>{if(alive)fn.call(document,new Event(type));});return;}target.addEventListener(type,fn,options);cleanups.push(()=>target.removeEventListener(type,fn,options));};
    const win=new Proxy(window,{get(target,key){if(key==='addEventListener')return(type,fn,opts)=>listen(window,type,fn,opts);if(key==='matchMedia')return query=>{const media=window.matchMedia(query);return new Proxy(media,{get(m,k){if(k==='addEventListener')return(type,fn,opts)=>listen(m,type,fn,opts);if(k==='addListener')return fn=>{m.addListener(fn);cleanups.push(()=>m.removeListener(fn));};const v=Reflect.get(m,k,m);return typeof v==='function'?v.bind(m):v;}});};if(key==='document')return doc;if(key==='window'||key==='self')return win;const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;},set(target,key,value){target[key]=value;return true;}});
    const doc=new Proxy(document,{get(target,key){if(key==='addEventListener')return(type,fn,opts)=>listen(document,type,fn,opts);if(key==='readyState')return 'complete';if(key==='defaultView')return win;const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;}});
    const timer=(fn,ms,...args)=>{const id=setTimeout(()=>{if(alive)fn(...args);},ms);cleanups.push(()=>clearTimeout(id));return id;};
    const interval=(fn,ms,...args)=>{const id=setInterval(()=>{if(alive)fn(...args);},ms);cleanups.push(()=>clearInterval(id));return id;};
    const observer=Type=>class extends Type{constructor(...args){super(...args);cleanups.push(()=>this.disconnect());}};
    const raf=fn=>{const id=requestAnimationFrame(()=>{if(alive)fn();});cleanups.push(()=>cancelAnimationFrame(id));return id;};
    return {document:doc,window:win,navigator,fetch:(url,options={})=>fetch(url,{...options,signal:controller.signal}),setTimeout:timer,clearTimeout,setInterval:interval,clearInterval,requestAnimationFrame:raf,cancelAnimationFrame,ResizeObserver:observer(ResizeObserver),MutationObserver:observer(MutationObserver),cleanup(){alive=false;controller.abort();cleanups.reverse().forEach(fn=>fn());}};
  }
  function normalize(root,url){root.querySelectorAll('a[href]').forEach(a=>{let raw=a.getAttribute('href');if(raw.startsWith('#')&&!raw.startsWith('#/'))a.setAttribute('href',url+raw);else{try{const u=new URL(raw,new URL(url,location.origin));const e=entryFor(u.href);if(e){a.setAttribute('href',e.url+u.search+u.hash);a.removeAttribute('target');a.removeAttribute('onclick');}}catch{}}});}
  const guideRoot=doc=>doc.querySelector('main')||doc.querySelector('section[aria-label="Truegold Chart"]');
  const metaSelector='link[rel="canonical"],link[rel="alternate"][hreflang],meta[name="description"],meta[property^="og:"],meta[name^="twitter:"],script[type="application/ld+json"]';
  function policyFooter(doc){
    const footer=doc.querySelector('footer.kd-policy-footer');
    return footer?{nav:footer.querySelector('nav[aria-label="Site information"]')?.innerHTML??null,notice:footer.querySelector('p')?.textContent??null}:null;
  }
  function syncPolicyFooter(value){
    const footer=document.querySelector('footer.kd-policy-footer');if(!footer||!value)return;
    const nav=footer.querySelector('nav[aria-label="Site information"]'),notice=footer.querySelector('p');
    if(nav&&typeof value.nav==='string')nav.innerHTML=value.nav;
    if(notice&&typeof value.notice==='string')notice.textContent=value.notice;
    footer.lang=document.documentElement.lang;
    // Keep the footer and its consent-settings button/listeners in place.
  }
  function model(doc,entry){
    const main=guideRoot(doc);if(entry.kind==='detail'&&(!main||!main.querySelector('h1')))throw new Error('Guide document missing');
    const canonical=doc.querySelector('link[rel="canonical"]')?.getAttribute('href');if(entry.kind==='detail'&&pathKey(new URL(canonical||'/',location.origin).pathname)!==pathKey(entry.url))throw new Error('Guide canonical mismatch');
    const outside=[...doc.querySelectorAll('[role="dialog"],.modal,.image-modal,svg')].filter(el=>!main?.contains(el)&&!el.parentElement.closest('[role="dialog"],.modal,.image-modal')&&(el.tagName.toLowerCase()!=='svg'||el.querySelector('symbol')));
    return {title:doc.title,lang:doc.documentElement.lang,policyFooter:policyFooter(doc),main:main?(main.tagName==='MAIN'?main.outerHTML:'<main>'+main.outerHTML+'</main>'):'',extras:outside.map(n=>n.outerHTML).join(''),styles:[...doc.querySelectorAll(doc===document?'style[data-guide-page-style]':'style')].map(s=>s.textContent),meta:[...doc.head.querySelectorAll(metaSelector)].map(n=>n.outerHTML).join('')};
  }
  function setMetadata(m){document.title=m.title;document.documentElement.lang=m.lang;document.documentElement.dataset.lang=locale()==='zh-tw'?'zh-TW':locale();document.head.querySelectorAll(metaSelector).forEach(n=>n.remove());const t=document.createElement('template');t.innerHTML=m.meta;document.head.append(t.content);}
  function stylePage(m){document.querySelectorAll('style[data-guide-page-style]').forEach(n=>n.remove());for(const css of m.styles){const s=document.createElement('style');s.dataset.guidePageStyle='';s.textContent=css;document.head.append(s);}}
  function filtered(){const q=input.value.normalize('NFKC').toLowerCase().trim();return entries.filter(e=>e.kind==='detail'&&e.locale===locale()&&(category.value==='all'||e.category===category.value)&&(!q||[e.title,...(e.aliases||[]),e.slug].join(' ').normalize('NFKC').toLowerCase().includes(q)));}
  function renderList(){const w=words(),items=filtered();list.innerHTML=items.map(e=>`<a href="${esc(e.url)}" ${e.url===current.url?'aria-current="page"':''}><span>${esc(e.title)}</span></a>`).join('')||`<p>${w[7]}</p>`;content.querySelectorAll('[data-guide-entry]').forEach(a=>{a.hidden=!items.some(e=>e.url===a.dataset.guideEntry);});sidebar.querySelector('[data-guide-count]').textContent=items.length+' / '+entries.filter(e=>e.kind==='detail'&&e.locale===locale()).length;}
  function overview(){const w=words();return `<main data-guide-ui class="ks-guide-overview"><h1>${w[0]}</h1><p>${w[6]}</p><div class="ks-guide-overview-links">${entries.filter(e=>e.kind==='detail'&&e.locale===locale()).map(e=>`<a data-guide-entry="${esc(e.url)}" href="${esc(e.url)}"><strong>${esc(e.title)}</strong><span>${esc(e.description||'')}</span></a>`).join('')}</div></main>`;}
  function controls(restore){const w=words(),s=restore||localState();input.setAttribute('aria-label',w[1]);input.placeholder=w[1];input.value=s.query||'';category.setAttribute('aria-label',w[2]);category.innerHTML=`<option value="all">${w[2]}</option>`+categoryKeys.map((k,i)=>`<option value="${k}">${w[10+i]}</option>`).join('');category.value=categoryKeys.includes(s.category)?s.category:'all';sidebar.querySelector('h2').textContent=w[0];const shared=!!document.querySelector('[data-ks-site-nav]');shell.classList.toggle('ks-guide-shared-nav',shared);toolbar.innerHTML=(shared?'':`<a class="ks-guide-brand" href="/${locale()}/">Kingshot Data</a>`)+`<a href="/${locale()}/guides/" class="ks-guide-list-link">${w[3]}</a><button type="button" data-guide-toggle aria-controls="ks-guide-sidebar" aria-expanded="false">${w[1]}</button><button type="button" data-guide-toc-toggle aria-controls="ks-guide-toc" aria-expanded="false">${w[4]}</button>`+(shared?'':`<nav aria-label="Language">${['ko','en','ja','zh-tw'].map(l=>{const e=entries.find(x=>x.locale===l&&x.kind===current.kind&&x.slug===current.slug);return e?`<a data-guide-language="${l}" ${l===locale()?'aria-current="page"':''} href="${esc(e.url)}">${l==='zh-tw'?'TW':l.toUpperCase()}</a>`:'';}).join('')}</nav>`);renderList();list.scrollTop=s.listY||0;}
  function makeToc(){const w=words();let links=[];content.querySelectorAll('h2').forEach((h,i)=>{if(h.closest('.ks-guide-overview,[data-kd-personal],.toc'))return;let target=h.id?h:h.closest('[id]');if(!target||target.id==='ks-guide-content'||target===content){h.id='guide-section-'+i;target=h;}if(links.some(l=>l.id===target.id))return;links.push({id:target.id,text:h.textContent.trim()});});toc.innerHTML=`<h2>${w[4]}</h2>`+links.map(l=>`<a href="${esc(current.url+'#'+encodeURIComponent(l.id))}">${esc(l.text)}</a>`).join('');toc.hidden=!links.length;}
  function postReady(){window.dispatchEvent(new CustomEvent('kd:page-ready'));}
  function safeHash(hash){try{return decodeURIComponent(hash.slice(1));}catch{return hash.slice(1);}}
  async function layoutReady(valid){
    const images=[...content.querySelectorAll('img')].filter(img=>!img.complete&&img.loading!=='lazy');
    await Promise.all(images.map(img=>new Promise(resolve=>{const done=()=>{clearTimeout(timer);img.removeEventListener('load',done);img.removeEventListener('error',done);resolve();};const timer=setTimeout(done,1200);img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});})));
    let last=-1,stable=0;for(let i=0;i<12&&valid()&&stable<2;i++){await new Promise(resolve=>requestAnimationFrame(resolve));const height=content.getBoundingClientRect().height;stable=Math.abs(height-last)<1?stable+1:0;last=height;}
  }
  async function restorePosition(saved,hash){
    cancelRestore();const turn=++restoreSeq,path=current.url,navigation=seq;let canceled=false;restoring=true;
    const events=['wheel','touchstart','pointerdown','keydown'];
    const stop=()=>{canceled=true;if(turn===restoreSeq)restoring=false;events.forEach(type=>window.removeEventListener(type,stop,true));};cancelRestore=stop;events.forEach(type=>window.addEventListener(type,stop,{capture:true,once:true,passive:true}));
    const valid=()=>!canceled&&turn===restoreSeq&&navigation===seq&&current.url===path;
    try{await Promise.resolve(featureReady).catch(()=>{});if(!valid())return;await layoutReady(valid);if(!valid())return;
      const anchor=saved?.anchor,point=anchor?.id?document.getElementById(anchor.id):null;
      if(point&&content.contains(point)&&Number.isFinite(anchor.offset)){scrollTo({top:Math.max(0,scrollY+point.getBoundingClientRect().top-anchor.offset),behavior:'instant'});}
      else if(saved&&Number.isFinite(saved.readY)){scrollTo({top:saved.readY,behavior:'instant'});}
      else if(hash){const el=document.getElementById(safeHash(hash));if(el&&content.contains(el)){for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;el.scrollIntoView({block:'start',behavior:'instant'});}else scrollTo({top:0,behavior:'instant'});}
      else scrollTo({top:0,behavior:'instant'});
    }finally{events.forEach(type=>window.removeEventListener(type,stop,true));if(turn===restoreSeq){restoring=false;if(valid())snapshot();}}
  }
  function mount(m,entry,saved,hash){cancelRestore();featureCleanup();current=entry;stylePage(m);setMetadata(m);syncPolicyFooter(m.policyFooter);content.innerHTML=entry.kind==='list'?overview():m.main+m.extras;content.querySelectorAll('script').forEach(n=>n.remove());content.querySelectorAll('header,nav.tabs,.tabs[aria-label="Section navigation"]').forEach(n=>n.remove());normalize(content,entry.url);content.querySelectorAll('main table').forEach(table=>{if(table.parentElement.matches('section,article,main')){const wrap=document.createElement('div');wrap.className='ks-guide-table';wrap.tabIndex=0;table.before(wrap);wrap.append(table);}});shell.classList.toggle('ks-guide-index',entry.kind==='list');shell.classList.remove('ks-list-open','ks-toc-open');window.KD_NAV?.refreshChrome?.();window.KD_PRIVACY?.refreshLocale?.();controls(saved);const ctx=scopes();featureCleanup=ctx.cleanup;featureReady=Promise.resolve();try{const feature=window.KD_GUIDE_FEATURES?.mount(entry.slug,entry.locale,ctx),cleanup=typeof feature==='function'?feature:feature?.cleanup;featureReady=Promise.resolve(feature?.ready).catch(()=>{});if(typeof cleanup==='function'){featureCleanup=()=>{cleanup();ctx.cleanup();};}}catch(err){ctx.cleanup();throw err;}if(saved?.details)content.querySelectorAll('details').forEach((d,i)=>{if(typeof saved.details[i]==='boolean')d.open=saved.details[i];});makeToc();postReady();restorePosition(saved,hash);}
  async function navigate(value,{pop=false,restore=null}={}){const u=new URL(value,location.href),e=entryFor(u.href);if(!e){location.assign(u.href);return;}const url=e.url+u.search+u.hash;if(!pop)snapshot();cancelRestore();clearTimeout(scrollTimer);const turn=++seq;pending?.abort();pending=new AbortController();status.textContent=words()[8];content.setAttribute('aria-busy','true');
    try{let m=cache.get(e.url);if(!m){const res=await fetch(e.url,{signal:pending.signal,credentials:'same-origin'});if(!res.ok)throw new Error('Guide load failed');m=model(new DOMParser().parseFromString(await res.text(),'text/html'),e);cache.set(e.url,m);if(cache.size>8)cache.delete(cache.keys().next().value);}if(turn!==seq)return;if(!pop)history.pushState({ksGuide:{path:e.url}},'',url);mount(m,e,restore,u.hash);if(!pop){const h=content.querySelector('h1');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}}}
    catch(err){if(err.name==='AbortError'||turn!==seq)return;pop?location.replace(url):location.assign(url);}
    finally{if(turn===seq){status.textContent='';content.removeAttribute('aria-busy');}}
  }
  function onClick(ev){if(ev.defaultPrevented||ev.button!==0||ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.altKey)return;const a=ev.target.closest?.('a[href]');if(!a||a.hasAttribute('download'))return;const e=entryFor(a.href);if(!e)return;if(window.KD_NAV?.claim&&!window.KD_NAV.claim(ev))return;ev.preventDefault();ev.stopImmediatePropagation();a.removeAttribute('target');const u=new URL(a.href,location.href);if(current.url===e.url&&u.hash){snapshot();history.pushState({...history.state},'',e.url+u.search+u.hash);restorePosition(null,u.hash);shell.classList.remove('ks-toc-open');return;}if(current.url===e.url&&!u.hash){toggleList();return;}navigate(e.url+u.search+u.hash);}
  function toggleList(){const opening=!shell.classList.contains('ks-list-open');snapshot();const saved=state.positions[current.url];shell.classList.toggle('ks-list-open');toolbar.querySelector('[data-guide-toggle]')?.setAttribute('aria-expanded',String(opening));if(opening)input.focus();else restorePosition(saved,null);}
  async function start(){if(!pathPattern.test(location.pathname))return;document.querySelectorAll('style').forEach(n=>{if(!n.hasAttribute('data-guide-ui')&&!n.hasAttribute('data-ks-site-nav-style')&&!n.hasAttribute('data-kd-privacy-style'))n.dataset.guidePageStyle='';});readState();const res=await fetch('/data/ui/guides.json?v='+VERSION);if(!res.ok)return;registry=await res.json();entries=registry.entries;current=entryFor(location.href);if(!current)return;const original=model(document,current);cache.set(current.url,original);const oldMain=guideRoot(document);
    document.querySelectorAll('[role="dialog"],.modal,.image-modal,svg').forEach(el=>{if(!oldMain?.contains(el)&&(el.tagName.toLowerCase()!=='svg'||el.querySelector('symbol')))el.remove();});
    shell=document.createElement('div');shell.id='ks-guide-reader';shell.dataset.guideUi='';shell.innerHTML='<header class="ks-guide-toolbar"></header><div class="ks-guide-layout"><aside id="ks-guide-sidebar"><h2></h2><input type="search"><select></select><small data-guide-count></small><nav class="ks-guide-list"></nav></aside><div id="ks-guide-content"></div><aside id="ks-guide-toc"></aside></div><p class="ks-guide-status" role="status"></p>';
    const anchor=oldMain||document.querySelector('#guides-index')||[...document.body.children].find(n=>!n.matches('[data-ks-site-nav]'));anchor.before(shell);anchor.remove();if(current.kind==='list')document.querySelectorAll('.guides-head,.guides-wrap,hr.sep').forEach(n=>n.remove());document.querySelectorAll('body > header,body > nav.tabs,.wrap > header,.wrap > nav[aria-label="Section navigation"],.wrap > .crumbs').forEach(n=>{if(!n.matches('[data-ks-site-nav]')&&!n.closest('[data-ks-site-nav]'))n.remove();});document.body.classList.add('ks-guide-active');content=shell.querySelector('#ks-guide-content');sidebar=shell.querySelector('#ks-guide-sidebar');list=sidebar.querySelector('nav');input=sidebar.querySelector('input');category=sidebar.querySelector('select');toc=shell.querySelector('#ks-guide-toc');toolbar=shell.querySelector('header');status=shell.querySelector('[role="status"]');
    const initial=history.state?.ksGuide?.path===current.url?history.state.ksGuide:state.positions[current.url];history.scrollRestoration='manual';mount(original,current,initial,location.hash);
    document.addEventListener('click',onClick,true);
    for(const control of [input,category])control.addEventListener(control===input?'input':'change',()=>{renderList();snapshot();});list.addEventListener('scroll',()=>{localState().listY=list.scrollTop;writeState();},{passive:true});
    toolbar.addEventListener('click',ev=>{const button=ev.target.closest('button');if(!button)return;if(button.hasAttribute('data-guide-toggle')){toggleList();return;}const key='ks-toc-open';shell.classList.toggle(key);button.setAttribute('aria-expanded',String(shell.classList.contains(key)));if(key==='ks-list-open'&&shell.classList.contains(key))input.focus();snapshot();});
    window.addEventListener('scroll',()=>{if(restoring)return;clearTimeout(scrollTimer);scrollTimer=setTimeout(snapshot,100);},{passive:true});window.addEventListener('pagehide',snapshot);
    window.addEventListener('popstate',ev=>{const e=entryFor(location.href);if(!e){location.reload();return;}if(e.url===current.url){restorePosition(ev.state?.ksGuide,location.hash);return;}navigate(location.href,{pop:true,restore:ev.state?.ksGuide||state.positions[e.url]});});
    document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){if(shell.classList.contains('ks-list-open'))toggleList();shell.classList.remove('ks-toc-open');toolbar.querySelectorAll('button').forEach(b=>b.setAttribute('aria-expanded','false'));}});
  }
  window.KD_GUIDE_READER={version:VERSION,navigate};
  if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',()=>start().catch(()=>{}),{once:true});else start().catch(()=>{});
})();

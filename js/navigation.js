/* Shared navigation policy. Category renderers retain their content and data ownership. */
(function (win, doc) {
  'use strict';
  if (win.KD_NAV) return;
  win.__NAV_VER = 'ks-ui12-20261012';
  const NS = '__ksNavigation', KEY = 'KSD_NAVIGATION_V1:', claims = new WeakSet();
  const push = history.pushState.bind(history), replace = history.replaceState.bind(history);
  const id = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  const path = () => location.pathname + location.search + location.hash;
  const guide = () => !!doc.body?.classList.contains('ks-guide-active');
  const locale = () => location.pathname.match(/^\/(ko|en|ja|zh-tw)(?:\/|$)/i)?.[1].toLowerCase() ||
    (/^\/(?:tools)\//.test(location.pathname) ? (new URLSearchParams(location.search).get('lang') || 'ko').toLowerCase() : 'ko');
  const state = value => value && typeof value === 'object' && !Array.isArray(value) ? {...value} : {};
  let active = history.state?.[NS]?.id || id(), pending = null, observer, timer, endTimer, scrollTimer, awaitingPage=false, awaitingUI=false;
  const scrollSelector='.kd-building-table-region,.kd-building-supplement-table-region,.kh-scroll,.kr-scroll,.kcat-table-scroll';
  let memory = new Map();
  replace({...state(history.state), [NS]: {id: active}}, '', location.href);
  function read(key) { try { return JSON.parse(sessionStorage.getItem(KEY + key)); } catch (_) { return memory.get(key); } }
  function write(key, value) {
    memory.set(key, value);
    try {
      sessionStorage.setItem(KEY + key, JSON.stringify(value));
      const keys = Object.keys(sessionStorage).filter(k => k.startsWith(KEY));
      if (keys.length > 100) keys.slice(0, keys.length - 100).forEach(k => sessionStorage.removeItem(k));
    } catch (_) {}
  }
  function capture() {
    if (guide() || pending) return;
    const main = doc.getElementById('content') || doc.querySelector('main');
    let anchor;
    if (main) anchor = Array.from(main.querySelectorAll('[id]')).filter(el => {
      const r = el.getBoundingClientRect(); return r.width && r.height && r.top <= 160 && r.bottom > 0;
    }).sort((a,b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
    const scrollers = main ? Array.from(main.querySelectorAll(scrollSelector))
      .map((el,index) => ({id:el.id, index, x:el.scrollLeft})).filter(s=>s.x>0).slice(0, 12) : [];
    write(active, {url:path(), x:win.scrollX, y:win.scrollY, anchor:anchor?.id || '', offset:anchor?.getBoundingClientRect().top || 0, scrollers});
  }
  function cancel() { clearTimeout(timer); clearTimeout(endTimer); observer?.disconnect(); observer = null; pending = null; awaitingPage=false;awaitingUI=false; }
  function applyPosition() {
    if (!pending || guide()) return;
    const target = pending.anchor && doc.getElementById(pending.anchor);
    const y = target ? win.scrollY + target.getBoundingClientRect().top - pending.offset : pending.y;
    win.scrollTo({left:pending.x || 0, top:Math.max(0,y || 0), behavior:'instant'});
    for (const s of pending.scrollers || []) {
      const main=doc.getElementById('content')||doc.querySelector('main');
      const el = s.id ? doc.getElementById(s.id) : main?.querySelectorAll(scrollSelector)[s.index];
      if (el) el.scrollLeft = s.x;
    }
  }
  function ready(event) {
    refreshChrome();
    if (!pending || guide()) return;
    if(event?.type==='kd:page-ready')awaitingPage=false;
    if(event?.type==='kd:ui-ready' && event.detail?.path===location.pathname && !/\/growth-planner\/?$/.test(location.pathname))awaitingUI=false;
    if(event?.type==='kd:planner-ready')awaitingUI=false;
    clearTimeout(timer);
    timer = setTimeout(applyPosition, 100);
    if(!awaitingPage&&!awaitingUI){clearTimeout(endTimer);endTimer=setTimeout(()=>{applyPosition();cancel();},1000);}
  }
  function restore() {
    cancel();
    if (guide()) return;
    const saved = read(active);
    if (!saved || saved.url !== path()) return;
    pending = saved;
    awaitingPage=typeof win.navigate==='function';
    awaitingUI=!!win.KD_UI && /^\/(?:(?:ko|en|ja)\/)?(?:heroes|hero\/[^/]+|research(?:\/[^/]+)?|growth-planner)\/?$/.test(location.pathname);
    observer = new MutationObserver(ready);
    const main = doc.getElementById('content') || doc.querySelector('main');
    if (main) observer.observe(main, {childList:true, subtree:true});
    ready();
  }
  // Legacy modules sometimes replace with null. Keep only our namespace, never another module's stale state.
  history.replaceState = function (value, title, url) {
    const next = {...state(value), [NS]:{id:active}};
    replace(next, title, url); refreshChrome();
  };
  history.pushState = function (value, title, url) {
    capture(); cancel();
    const nextId = id();
    push({...state(value), [NS]:{id:nextId}}, title, url);
    active = nextId; refreshChrome();
  };
  function claim(event) { if (claims.has(event)) return false; claims.add(event); return true; }
  const labels = {
    ko:['검색','건물','영웅','연구','장비·아이템','펫','성장 플래너','계산기','가이드','기프트코드','메뉴'],
    en:['Search','Buildings','Heroes','Research','Gear & items','Pets','Growth planner','Calculators','Guides','Gift codes','Menu'],
    ja:['検索','建物','英雄','研究','装備・アイテム','ペット','成長プランナー','計算機','ガイド','ギフトコード','メニュー'],
    'zh-tw':['搜尋','建築','英雄','研究','裝備・道具','寵物','成長規劃','計算器','指南','禮包碼','選單']
  };
  function destinations(l) {
    const p = l === 'ko' ? '' : '/' + l;
    return [p+'/#hub-search', '/'+l+'/buildings/', p+'/heroes/',p+'/research/', '/'+l+'/database/', '/'+l+'/pet/',
      l === 'zh-tw' ? p+'/calculator/' : p+'/growth-planner/', p+'/calculator/', '/'+l+'/guides/', '/'+l+'/guides/kingshot-giftcode.html'];
  }
  function linkLocale(a,l) {
    if(a.hasAttribute('hreflang') || a.closest('.ks-nav-languages'))return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin && u.origin !== 'https://kingshotdata.kr') return;
    if (/kingshot-giftcode(?:\.html)?\/?$/.test(u.pathname)) {
      u.pathname = '/'+l+'/guides/kingshot-giftcode.html';
      a.removeAttribute('data-korean-only');
    } else if (/^\/(?:(?:ko|en|ja|zh-tw)\/)?(?:guides|buildings|database|pet)\/?$/.test(u.pathname)) u.pathname = '/'+l+'/'+u.pathname.split('/').filter(Boolean).at(-1)+'/';
    else if (/^\/(?:(?:ko|en|ja|zh-tw)\/)?(?:heroes|research|items|events|calculator|growth-planner)\/?$/.test(u.pathname)) u.pathname = (l==='ko'?'':'/'+l)+'/'+u.pathname.split('/').filter(Boolean).at(-1)+'/';
    else return;
    if(a.getAttribute('href')!==u.pathname+u.search+u.hash)a.setAttribute('href', u.pathname+u.search+u.hash);
    const span = a.querySelector('span');
    if (/giftcode/.test(u.pathname) && (span || a).textContent !== (labels[l] || labels.ko)[9]) (span || a).textContent = (labels[l] || labels.ko)[9];
  }
  function currentCategory(p) {
    if (/giftcode/.test(p)) return 9;
    if (/\/guides/.test(p)) return 8;
    if (/\/growth-planner/.test(p)) return 6;
    if (/\/calc/.test(p)) return 7;
    if (/\/building/.test(p)) return 1;
    if (/\/hero/.test(p)) return 2;
    if (/\/research|\/alliance\/tech/.test(p)) return 3;
    if (/\/pet/.test(p)) return 5;
    if (/\/(?:database|items)/.test(p)) return 4;
    return 0;
  }
  let refreshing = false;
  function refreshChrome() {
    if (!doc.body || refreshing) return;
    refreshing = true;
    try {
      const l=locale(), words=labels[l]||labels.ko, targets=destinations(l);
      doc.querySelectorAll('.site-header a[href],#mobileDrawer a[href]').forEach(a=>linkLocale(a,l));
      let shared=doc.querySelector('[data-ks-site-nav]');
      const original=doc.querySelector('body > .site-header');
      if (!shared && !original) {
        shared=doc.createElement('header'); shared.dataset.ksSiteNav=''; shared.className='ks-site-nav';
        shared.innerHTML='<div class="ks-nav-bar"><a class="ks-nav-brand" href="/">Kingshot Data</a><button type="button" class="ks-nav-toggle" aria-expanded="false" aria-controls="ks-navigation-links"></button><nav id="ks-navigation-links" aria-label="Site"></nav><nav class="ks-nav-languages" aria-label="Language"></nav></div>';
        doc.body.prepend(shared);
        shared.querySelector('button').addEventListener('click',e=>{const open=shared.classList.toggle('is-open');e.currentTarget.setAttribute('aria-expanded',String(open));});
        shared.addEventListener('keydown',e=>{if(e.key==='Escape'){shared.classList.remove('is-open');shared.querySelector('button').setAttribute('aria-expanded','false');shared.querySelector('button').focus();}});
      }
      if (shared) {
        const key=l+'|'+location.pathname+'|'+Array.from(doc.querySelectorAll('head link[rel="alternate"][hreflang]')).map(a=>a.hreflang+':'+a.href).join('|');
        if (shared.dataset.route !== key) {
          shared.dataset.route=key;
          shared.querySelector('.ks-nav-brand').href=l==='ko'?'/':'/'+l+'/';
          shared.querySelector('button').textContent=words[10];
          const links=shared.querySelector('#ks-navigation-links'); links.replaceChildren();
          targets.forEach((href,i)=>{if(l==='zh-tw'&&i===6)return;const a=doc.createElement('a');a.href=href;a.textContent=words[i];if(currentCategory(location.pathname)===i)a.setAttribute('aria-current','page');links.append(a);});
          const languages=shared.querySelector('.ks-nav-languages');languages.replaceChildren();
          for(const alt of doc.querySelectorAll('head link[rel="alternate"][hreflang]:not([hreflang="x-default"])')){
            const lang=alt.hreflang.toLowerCase(),a=doc.createElement('a'),u=new URL(alt.href);a.href=u.pathname+u.search;a.textContent=lang==='zh-tw'?'繁中':lang.toUpperCase();a.hreflang=alt.hreflang;a.dataset.routerIgnore='true';if(lang===l)a.setAttribute('aria-current','page');languages.append(a);
          }
        }
        doc.documentElement.style.setProperty('--ks-site-nav-height',shared.offsetHeight+'px');
      }
      doc.body.classList.toggle('ks-shared-navigation',!!shared);
      const menu=original?.querySelector('#primaryNav');
      if(menu) {
        for(const host of [menu,doc.querySelector('#mobileDrawer .nav-list')].filter(Boolean)){
          if(host.dataset.ksMenuLocale!==l){
            host.dataset.ksMenuLocale=l;host.replaceChildren();
            targets.forEach((href,i)=>{if(l==='zh-tw'&&i===6)return;const a=doc.createElement('a');a.href=href;a.textContent=words[i];a.dataset.link='';host.append(a);});
          }
          host.querySelectorAll('a').forEach(a=>{const p=new URL(a.href).pathname; if(currentCategory(p)===currentCategory(location.pathname))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
        }
      }
    } finally { refreshing=false; }
  }
  function normalizeLink(a) {
    const raw=a.getAttribute('href'); if(!raw || /^(?:#|mailto:|tel:|javascript:|data:)/i.test(raw) || a.hasAttribute('download')) return null;
    const u=new URL(raw,location.href);
    if(u.origin!==location.origin && u.origin!=='https://kingshotdata.kr')return null;
    if(/\.(?:png|jpe?g|webp|gif|svg|pdf|zip)$/i.test(u.pathname))return null;
    a.removeAttribute('target');
    if(a.closest('.site-header,#mobileDrawer,[data-ks-site-nav]'))linkLocale(a,locale());
    else if(u.origin!==location.origin)a.setAttribute('href',u.pathname+u.search+u.hash);
    return a;
  }
  doc.addEventListener('click',event=>{
    if(event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.defaultPrevented)return;
    const a=event.target.closest?.('a[href]');if(!a || !normalizeLink(a))return;
    capture();
    const shared=a.closest('[data-ks-site-nav]');if(shared){shared.classList.remove('is-open');shared.querySelector('button').setAttribute('aria-expanded','false');}
    // Normalization only: app, guide reader, or the browser owns the actual transition.
  },true);
  win.addEventListener('popstate',()=>{cancel();active=history.state?.[NS]?.id||id();refreshChrome();restore();});
  win.addEventListener('pagehide',capture);
  win.addEventListener('scroll',()=>{if(!pending){clearTimeout(scrollTimer);scrollTimer=setTimeout(capture,120);}},{passive:true});
  ['wheel','touchstart','pointerdown'].forEach(name=>win.addEventListener(name,()=>{if(pending)cancel();},{passive:true}));
  win.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key)&&pending)cancel();});
  ['kd:page-ready','kd:research-ready','kd:planner-ready','kd:ui-ready'].forEach(name=>win.addEventListener(name,ready));
  doc.addEventListener('load',()=>{if(pending)ready();},true);
  doc.addEventListener('i18n:changed',refreshChrome);
  win.addEventListener('resize',refreshChrome);
  win.KD_NAV={version:'ks-ui12-20261012',capture,restore,ready,refreshChrome,claim,normalizeLink,locale,get restoring(){return !!pending;}};
  function start(){refreshChrome();restore();}
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
  win.addEventListener('pageshow',e=>{if(e.persisted)restore();});
})(window,document);

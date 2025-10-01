// /public/js/app.js — SPA Router (History API) for KingshotData.kr
// v2025-09-17+opt (bundle-aware: routes.js / routes.calculators.js)
// ES5-compatible (no arrow functions / optional chaining)
//
// 변경 요약
// - 진입 경로가 /calc-* 또는 /calculator 이면 routes.calculators.js 로드 → window.buildCalculatorRoutes()
// - 그 외 경로는 routes.js 로드 → window.buildRoutes()
// - 최초 진입: selectAndBuildRoutesFor → startRouter → dispatch 순서
// - 내비게이션 중 일반 ↔ 계산기 경계 진입 시 번들 자동 핫스왑
// - calculators 라우트일 때만 calculator.css 로드 (아닐 때 제거)
// - 외부/특수 링크는 가로채지 않음
// - 라우트 프록시 테이블(proxyRoutes) 도입: 실 라우트 준비 전에도 /calc-*·/calculator 접속 안정화
// - 라우트 렌더 이후 document.body 전체 i18n 강제 재적용 (글로벌 UI 누락 방지)
// - popstate 보정: 마지막 계산기 경로 복구(lastCalcPath)
// - ★ 계산기 경로 진입 시, route.render 완료 후 then에서 window.KSD.buildingUI.reset() 호출(실패 시 console.warn)

(function () {
  'use strict';

  // ===== small DOM utils =====
  function $(sel) { return document.querySelector(sel); }

  // ===== Asset version (캐시 무효화) — URL API로 안전 처리 =====
  var ASSET_VER = window.__V || 'now';
  function v(url) {
    if (!url) return url;
    if (/^(data:|blob:|#)/i.test(url)) return url;
    try {
      var u = new URL(url, location.origin);
      if (u.searchParams && typeof u.searchParams.set === 'function') {
        u.searchParams.set('v', ASSET_VER);
        return u.pathname + u.search + u.hash;
      }
      return u.pathname + (u.search ? u.search + '&v=' + ASSET_VER : '?v=' + ASSET_VER) + u.hash;
    } catch (_e) {
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + ASSET_VER;
    }
  }
  if (!window.v) window.v = v;

  // ===== CSS 경로 =====
var CALC_CSS_HREF = '/css/calculator.css';
// var COMPONENTS_CSS_HREF = '/css/components.css';  // 선언은 주석 처리 (호출도 같이 제거)

// ===== bootstrap =====
document.addEventListener('DOMContentLoaded', function () {
  ensureCSS('calculator-css', CALC_CSS_HREF)   // ✅ calculator.css만 로드
    .then(function(){ return ensureI18N(); })
    .then(function(){
      var canon = canonicalize(location.href);
      return selectAndBuildRoutesFor(canon.pathname);
    })
    .then(function(builtRoutes){
      startRouter(builtRoutes || {});
      return dispatch();
    });
});

  // ===== header utils =====
  var yearEl = $('#y');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var nav    = $('#primaryNav');
  var toggle = $('#menuToggle');
  if (nav && toggle) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // ===== dynamic <script> loader (in-flight 병합, async 명시) =====
  var inFlightScripts = new Map(); // key: normalized path, val: Promise

  function normalizeScriptKey(src) {
    try {
      var u = new URL(src, location.origin);
      if (u.searchParams && typeof u.searchParams.delete === 'function') {
        u.searchParams.delete('v');
      }
      return u.origin + u.pathname;
    } catch (_e) {
      return (src || '').split('?')[0];
    }
  }

  function loadScriptOnce(src, opts) {
    if (!src) return Promise.resolve();
    var key = normalizeScriptKey(src);
    if (inFlightScripts.has(key)) return inFlightScripts.get(key);

    var p = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = v(src);
      s.async = true;
      if (opts && opts.type) s.type = opts.type;
      if (opts && opts.integrity) {
        s.integrity = opts.integrity;
        s.crossOrigin = (opts.crossOrigin || 'anonymous');
      }
      s.onload  = function(){ resolve(); };
      s.onerror = function(){ reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });

    inFlightScripts.set(key, p);
    return p.then(function (r) { return r; }, function (e) {
      inFlightScripts.delete(key);
      throw e;
    });
  }

  // ===== dynamic CSS (Promise로 onload 대기, FOUC 방지) =====
  function ensureCSS(id, href) {
    return new Promise(function (resolve) {
      var had = document.getElementById(id);
      if (had) return resolve(had);
      var link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = v(href);
      link.onload = function () { resolve(link); };
      link.onerror = function () { resolve(link); };
      document.head.appendChild(link);
    });
  }
  if (!window.ensureCSS) window.ensureCSS = ensureCSS;

  function removeCSS(id) {
    var node = document.getElementById(id);
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  // ===== HTML fetch (메모리 LRU 캐시 + 버전 키) =====
  var HTML_CACHE_MAX = 24;
  var htmlCache = new Map(); // key: path+'|v='+ASSET_VER, val: string
  function setHtmlCache(key, val) {
    htmlCache.set(key, val);
    if (htmlCache.size > HTML_CACHE_MAX) {
      var firstKey = htmlCache.keys().next().value;
      htmlCache.delete(firstKey);
    }
  }
  function loadHTML(candidates) {
    return (function loop(i){
      if (i >= candidates.length) return Promise.resolve(null);
      var rawPath = candidates[i];
      var cacheKey = rawPath + '|v=' + ASSET_VER;
      if (htmlCache.has(cacheKey)) return Promise.resolve(htmlCache.get(cacheKey));

      var path = v(rawPath);
      return fetch(path, { cache: 'no-store' }).then(function(r){
        if (r.ok) return r.text().then(function(text){
          setHtmlCache(cacheKey, text);
          return text;
        });
        return loop(i+1);
      }).catch(function(){ return loop(i+1); });
    })(0);
  }

  // ===== icon util =====
  function escapeAttr(s) {
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function iconImg(alt, src) {
    return '<img src="' + v(src) + '" alt="' + escapeAttr(alt) + '" class="cat-icon__img" loading="lazy" decoding="async">';
  }

  // ===== DB 상세 렌더 =====
  function rewriteRelativeUrls(doc, base) {
    function isAbs(u){ return /^https?:\/\//i.test(u) || /^(data:|blob:|#)/i.test(u) || u.indexOf('/') === 0; }
    function joinBase(u){ return base + u.replace(/^\.?\//,''); }
    function fixUrl(u){ return isAbs(u) ? u : joinBase(u); }

    var imgs = doc.querySelectorAll('img[src]');
    for (var i=0;i<imgs.length;i++){
      var el = imgs[i];
      var cur = el.getAttribute('src'); if (!cur) continue;
      el.setAttribute('src', v(fixUrl(cur)));
      if (!el.hasAttribute('loading')) el.setAttribute('loading', 'lazy');
      if (!el.hasAttribute('decoding')) el.setAttribute('decoding', 'async');
    }
    var srcsets = doc.querySelectorAll('img[srcset], source[srcset]');
    for (var j=0;j<srcsets.length;j++){
      var el2 = srcsets[j];
      var cur2 = el2.getAttribute('srcset'); if (!cur2) continue;
      var out = cur2.split(',').map(function(part){
        var bits = part.trim().split(/\s+/, 2);
        var u = bits[0], d = bits[1];
        if (!u) return part;
        var fixed = v(fixUrl(u));
        return d ? (fixed + ' ' + d) : fixed;
      }).join(', ');
      el2.setAttribute('srcset', out);
    }

    var links = doc.querySelectorAll('link[href]');
    for (var k=0;k<links.length;k++){
      var el3 = links[k];
      var cur3 = el3.getAttribute('href'); if (!cur3) continue;
      if (!isAbs(cur3)) el3.setAttribute('href', joinBase(cur3));
    }
    var scripts = doc.querySelectorAll('script[src]');
    for (var m=0;m<scripts.length;m++){ if (scripts[m].parentNode) scripts[m].parentNode.removeChild(scripts[m]); }

    var anchors = doc.querySelectorAll('a[href]');
    for (var n=0;n<anchors.length;n++){
      var a = anchors[n];
      var href = a.getAttribute('href'); if (!href) continue;
      if (/^(https?:|mailto:|tel:|#)/i.test(href) || href.indexOf('/') === 0) continue;
      a.setAttribute('data-db-internal', href.replace(/^\.?\//,''));
      a.setAttribute('href', '#');
    }
    return doc;
  }

  function renderDbDetail(el, folder, file) {
    var base = 'pages/database/' + encodeURIComponent(folder) + '/';
    var candidates = file
      ? [ base + file ]
      : [ base + 'index.html', base + 'main.html', base + 'guide.html', base + 'list.html', base + 'README.html' ];

    return loadHTML(candidates).then(function(html){
      if (!html) {
        el.innerHTML = '<div class="placeholder"><h2>데이터베이스</h2><p class="muted">해당 문서를 찾을 수 없습니다.</p></div>';
        return;
      }

      var parser = new DOMParser();
      var doc    = parser.parseFromString(html, 'text/html');
      var fixed  = rewriteRelativeUrls(doc, base);

      var mt = fixed.querySelector('meta[name="db-title"]');
      var tt = fixed.querySelector('title');
      var h1 = fixed.querySelector('h1');
      var metaTitle = (mt && mt.content) || (tt && tt.textContent) || (h1 && h1.textContent) || '데이터베이스';

      var bodyNode = fixed.body ? fixed.body.cloneNode(true) : null;
      if (bodyNode) {
        var firstH1 = bodyNode.querySelector('h1');
        if (firstH1 && firstH1.parentNode) firstH1.parentNode.removeChild(firstH1);
      }
      var bodyHTML = bodyNode ? bodyNode.innerHTML : (fixed.body ? fixed.body.innerHTML : html);

      el.innerHTML = ''
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
        + '  <h1 id="page-title" data-i18n="db.title" style="margin:0;font-size:20px;">' + metaTitle + '</h1>'
        + '</div>'
        + '<div class="db-detail">' + bodyHTML + '</div>';

      var internals = el.querySelectorAll('[data-db-internal]');
      for (var i=0;i<internals.length;i++){
        (function(a){
          a.addEventListener('click', function(e){
            e.preventDefault();
            var next = a.getAttribute('data-db-internal') || '';
            var nextPath = next.replace(/^\.?\//, '');
            var safeNext = nextPath.split('/').map(encodeURIComponent).join('/');
            if (window.navigate) {
              window.navigate('/db/' + encodeURIComponent(folder) + '/' + safeNext);
            }
          }, { passive: false });
        })(internals[i]);
      }
    });
  }

  // ===== i18n helpers =====
  function normalizeLanguage(input) {
    var raw = String(input || '').replace('_','-').toLowerCase();
    if (!raw) return 'ko';
    if (raw.indexOf('ko') === 0) return 'ko';
    if (raw.indexOf('en') === 0) return 'en';
    if (raw.indexOf('ja') === 0) return 'ja';
    if (raw.indexOf('zh') === 0) {
      return (/-((tw|hk|mo))/.test(raw) ? 'zh-TW' : 'zh-CN');
    }
    return 'en';
  }

  function ensureI18N() {
    if (!window.I18N) return Promise.resolve();
    try {
      var saved   = (function(){ try { return localStorage.getItem('lang'); } catch(_){ return null; } })();
      var urlLang = new URLSearchParams(location.search).get('lang');
      var fallback= (navigator.language || 'ko');
      var lang    = normalizeLanguage(urlLang || saved || fallback);
      if (window.I18N.current === lang && typeof window.I18N.t === 'function') return Promise.resolve();
      return window.I18N.init({ lang: lang, namespaces: ['common', 'calc']  }).catch(function(e){
        console.warn('[i18n] init failed:', e);
      });
    } catch (e) {
      console.warn('[i18n] init failed:', e);
      return Promise.resolve();
    }
  }

  // 계산기 루트 내부(#calc-ui, #gear-calc, #charm-calc, #training-calc)는 건드리지 않는 i18n 부분 적용
  function applyI18NOutsideCalc(root) {
    if (!root) return;
    if (!window.I18N || !window.I18N.t) return;

    var SKIP_SEL = '#calc-ui, #gear-calc, #charm-calc, #training-calc';

    var targets = root.querySelectorAll('[data-i18n]');
    for (var i=0;i<targets.length;i++){
      var node = targets[i];
      if (node.closest && node.closest(SKIP_SEL)) continue;
      var key = node.getAttribute('data-i18n');
      var val = window.I18N.t(key, node.textContent || key);
      if (typeof val !== 'undefined') node.textContent = val;
    }

    var attrTargets = root.querySelectorAll('[data-i18n-attr]');
    for (var j=0;j<attrTargets.length;j++){
      var n = attrTargets[j];
      if (n.closest && n.closest(SKIP_SEL)) continue;
      var pairs = (n.getAttribute('data-i18n-attr') || '')
        .split(';');
      for (var k=0;k<pairs.length;k++){
        var pair = (pairs[k] || '').trim(); if (!pair) continue;
        var sp = pair.split(':');
        var attr = (sp[0] || '').trim();
        var key2 = (sp[1] || '').trim();
        if (!attr || !key2) continue;
        var cur = n.getAttribute(attr) || key2;
        var val2 = window.I18N.t(key2, cur);
        if (typeof val2 !== 'undefined') n.setAttribute(attr, val2);
      }
    }

    var phTargets = root.querySelectorAll('[data-i18n-placeholder]');
    for (var a=0;a<phTargets.length;a++){
      var ph = phTargets[a];
      if (ph.closest && ph.closest(SKIP_SEL)) continue;
      var keyp = ph.getAttribute('data-i18n-placeholder');
      ph.setAttribute('placeholder', window.I18N.t(keyp, ph.getAttribute('placeholder') || keyp));
    }
    var ariaTargets = root.querySelectorAll('[data-i18n-aria-label]');
    for (var b=0;b<ariaTargets.length;b++){
      var ar = ariaTargets[b];
      if (ar.closest && ar.closest(SKIP_SEL)) continue;
      var keya = ar.getAttribute('data-i18n-aria-label');
      ar.setAttribute('aria-label', window.I18N.t(keya, ar.getAttribute('aria-label') || keya));
    }
  }

  // localI18nApply 우선 호출(계산기 번들에 존재 시), 미존재 시 부분 적용으로 폴백
  function applyCalcI18NIfAvailable(root) {
    try {
      if (typeof window.localI18nApply === 'function') {
        window.localI18nApply(root || (document.getElementById('content') || document.body), { includeCalc: true });
        return true;
      }
    } catch (_e) {}
    return false;
  }

  // ===== active nav =====
  function setActiveByPath(currentPath) {
    try {
      var firstSeg = '/' + (currentPath.split('/').filter(Boolean)[0] || 'home');
      var anchors = document.querySelectorAll('#primaryNav a[href^="/"]');
      for (var i=0;i<anchors.length;i++){
        var a = anchors[i];
        var href = a.getAttribute('href') || '';
        var seg  = '/' + (href.split('/').filter(Boolean)[0] || 'home');
        a.classList.toggle('is-active', seg === firstSeg);
      }
    } catch(_){}
  }

  // ===== normalize path =====
  function normalize(pathname) {
    var p = pathname.replace(/\/index\.html$/i, '');
    if (p.length > 1 && p.lastIndexOf('/') === p.length - 1) p = p.slice(0, -1);
    return p || '/home';
  }

  function canonicalize(input) {
    var u = new URL(typeof input === 'string' ? input : String(input), location.origin);
    var p = u.pathname.replace(/\/index\.html$/i, '');
    if (p.length > 1 && p.lastIndexOf('/') === p.length - 1) p = p.slice(0, -1);

    // ★ 계산기 경로 예외 처리: /calc-* 또는 /calculator 는 그대로 유지
    if (p.indexOf('/calc-') === 0 || p === '/calculator') {
      u.pathname = p;
      return u;
    }

    var segs = p.split('/').filter(Boolean);
    if (segs[0] === 'heroes' && segs[1]) {
      u.pathname = '/hero/' + segs.slice(1).join('/');
      return u;
    }
    if (segs[0] === 'database' && segs[1]) {
      u.pathname = '/db/' + segs.slice(1).join('/');
      return u;
    }
    if (segs[0] === 'building') {
      u.pathname = '/buildings' + (segs[1] ? '/' + segs.slice(1).join('/') : '');
      return u;
    }
    u.pathname = p || '/home';
    return u;
  }

  // ===== 라우트 번들 로더 (routes.js vs routes.calculators.js) =====
  var routes = null;                   // 현재 사용 중인 라우트 테이블
  var __routeBundle = '';              // 'main' | 'calc'

  function isCalcPathname(p) {
    // /calc-* 또는 /calculator → calculators 번들
    return (p.indexOf('/calc-') === 0) || (p === '/calculator');
  }

  // calculators 라우트에서 사용할 setTitle 헬퍼
  function setTitle(i18nKey, fallback) {
    var title = fallback || '';
    try {
      if (window.I18N && typeof window.I18N.t === 'function') {
        title = window.I18N.t(i18nKey, title || i18nKey);
      }
    } catch (_e) {}
    if (title) { document.title = title; }
  }

  function loadRoutesForType(type) {
    if (type === 'calc') {
      return loadScriptOnce('/public/js/routes.calculators.js').then(function(){
        if (typeof window.buildCalculatorRoutes !== 'function') throw new Error('buildCalculatorRoutes not found');
        routes = window.buildCalculatorRoutes({
          loadHTML: loadHTML,
          loadScriptOnce: loadScriptOnce,
          // calculators 라우트가 필요로 하는 선택적 의존성
          ensureI18NReady: ensureI18N,
          setTitle: setTitle,
          // 기타 도우미
          renderDbDetail: renderDbDetail,
          iconImg: iconImg,
          // 전역 tier map 있으면 전달
          TIER_KEY_MAP_KO: window.TIER_KEY_MAP_KO
        });
        __routeBundle = 'calc';
        return routes;
      }).catch(function(e){
        try { console.error('[router] calculators bundle failed:', e); } catch (_ee) {}
        try { location.reload(); } catch (_er) {}
        return Promise.reject(e);
      });
    } else {
      return loadScriptOnce('/js/routes.js').then(function(){
        if (typeof window.buildRoutes !== 'function') throw new Error('buildRoutes not found');
        routes = window.buildRoutes({
          loadHTML: loadHTML,
          loadScriptOnce: loadScriptOnce,
          setTitle: setTitle,
          renderDbDetail: renderDbDetail,
          iconImg: iconImg
        });
        __routeBundle = 'main';
        return routes;
      });
    }
  }

  function selectAndBuildRoutesFor(pathname) {
    var want = isCalcPathname(pathname) ? 'calc' : 'main';
    if (__routeBundle === want && routes) return Promise.resolve(routes);
    return loadRoutesForType(want);
  }

  function startRouter(initialRoutes) {
    routes = initialRoutes;
  }

  // ===== 프록시 라우트 (실 라우트 준비 전 안전 가드) =====
  var proxyRoutes = (function(){
    var map = {};
    var keys = ['/calculator','/calc-building','/calc-gear','/calc-charm','/calc-training'];

    function makeProxyRoute(key) {
      return {
        title: '로딩 중...',
        render: function(el, rest) {
          el.innerHTML = ''
            + '<div class="placeholder">'
            + '  <h2>로딩 중…</h2>'
            + '  <p class="muted">콘텐츠를 불러오는 중입니다.</p>'
            + '</div>';

          return selectAndBuildRoutesFor(key).then(function(){
            var real = routes && routes[key];
            if (real && typeof real.render === 'function') {
              if (real.title) { try { document.title = real.title; } catch(_e){} }
              return real.render(el, rest);
            } else {
              el.innerHTML = '<div class="placeholder"><h2>로딩 실패</h2><p class="muted">라우트를 찾지 못했습니다.</p></div>';
            }
          });
        }
      };
    }

    for (var i=0;i<keys.length;i++){
      map[keys[i]] = makeProxyRoute(keys[i]);
    }
    return map;
  })();

  function getRoute(key) {
    if (routes && routes[key]) return routes[key];
    if (proxyRoutes && proxyRoutes[key]) return proxyRoutes[key];
    if (routes && routes['/home']) return routes['/home'];
    return {
      title: '로딩 실패',
      render: function(el) {
        el.innerHTML = '<div class="placeholder"><h2>라우트 없음</h2><p class="muted">요청한 페이지를 찾을 수 없습니다.</p></div>';
      }
    };
  }

  // popstate/비동기 전환 레이스 방지용 버전 토큰
  var navVer = 0;

  // ===== popstate 보정 로직 =====
  function correctOnPopstate() {
    try {
      var p = normalize(location.pathname);
      if (p.indexOf('/calc-') === 0 || p === '/calculator') {
        try { sessionStorage.setItem('lastCalcPath', p); } catch (_e2) {}
      }
    } catch (_e) {}
    return false;
  }

  function dispatch() {
    var myVer = ++navVer;
    var canon = null;

    // 1) i18n 준비 → 2) URL 정규화 반영 → 3) 라우트 번들 선택/로드 → 4) CSS 준비 → 5) render
    return ensureI18N().then(function(){
      if (myVer !== navVer) return;

      canon = canonicalize(location.href);
      var wantUrl = canon.pathname + canon.search + canon.hash;
      var haveUrl = location.pathname + location.search + location.hash;
      if (wantUrl !== haveUrl) {
        history.replaceState(null, '', wantUrl);
      }

      return selectAndBuildRoutesFor(canon.pathname);
    }).then(function(){
      if (myVer !== navVer) return;

      var pathNorm = normalize(canon.pathname);
      var segs = pathNorm.split('/').filter(Boolean);
      var key  = '/' + (segs[0] || 'home');
      var rest = '/' + segs.slice(1).join('/');
      var route = getRoute(key);

      var el = document.getElementById('content') || document.body;

      // 계산기 CSS 필요시에만 로드 (아닐 때 제거)
      var isCalcRoute = (key === '/calculator') || (key.indexOf('/calc-') === 0);
      var cssPromise = isCalcRoute ? ensureCSS('calc-css', CALC_CSS_HREF) : (removeCSS('calc-css'), Promise.resolve());

      if (isCalcRoute) {
        try { sessionStorage.setItem('lastCalcPath', pathNorm); } catch (_e3) {}
      }

      return cssPromise.then(function(){
        if (myVer !== navVer) return;

        if (route && route.title) document.title = route.title;

        var p;
        try {
          if (!route || typeof route.render !== 'function') throw new Error('route not found: ' + key);
          p = route.render(el, rest);
        } catch (e) {
          console.error('[router] route render error:', e);
          el.innerHTML = '<div class="placeholder"><h2>로딩 실패</h2><p class="muted">' + ((e && e.message) || '알 수 없는 오류') + '</p></div>';
          p = Promise.resolve();
        }

        return Promise.resolve(p).then(function(){
          if (myVer !== navVer) return;

          // ★★★ 계산기 라우트라면, render 완료 후 DOM이 붙은 시점에서 reset() 실행
          if (isCalcRoute && window.KSD && window.KSD.buildingUI && typeof window.KSD.buildingUI.reset === 'function') {
            try {
              window.KSD.buildingUI.reset();
            } catch (eReset) {
              console.warn('[router] calc reset failed', eReset);
            }
          }

          // 라우트 렌더 후 i18n 재적용
          try {
            var applied = applyCalcI18NIfAvailable(el);
            if (!applied) {
              if (isCalcRoute) {
                applyI18NOutsideCalc(el);
              } else if (window.I18N && typeof window.I18N.applyTo === 'function') {
                window.I18N.applyTo(el);
              }
            }
          } catch (_eApply) {}

          setActiveByPath(pathNorm);

          if (nav && toggle) {
            nav.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
          }

          try { window.scrollTo({ top: 0 }); } catch(_){}

          // ★★★ 최종 강제 글로벌 i18n 재적용 — 헤더/드롭다운/글로벌 UI 누락 방지
          if (window.I18N && typeof window.I18N.applyTo === 'function') {
            try { window.I18N.applyTo(document.body); } catch(_e2) {}
          }

          // 마지막으로 calculators 쪽 localI18nApply가 있다면 한 번 더 강제 적용(드롭다운 등)
          try { applyCalcI18NIfAvailable(document.getElementById('content') || document.body); } catch (_e4) {}
        });
      });
    });
  }

  // ===== navigate =====
  window.navigate = function (to, opts) {
    opts = opts || {};
    var u = canonicalize(to);
    var url = u.pathname + u.search + u.hash;
    if (opts.replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    return dispatch();
  };

  // ===== link interception =====
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var a = e.target;
    while (a && a.tagName !== 'A') a = a.parentElement;
    if (!a) return;

    var href = a.getAttribute('href');
    if (!href) return;

    var target = (a.getAttribute('target') || '').toLowerCase();
    var rel    = (a.getAttribute('rel') || '').toLowerCase();
    if (target && target !== '_self') return;
    if (rel.indexOf('noopener') !== -1 || rel.indexOf('noreferrer') !== -1 || rel.indexOf('external') !== -1) return;

    var routerIgnore = a.getAttribute('data-router-ignore');
    if (a.hasAttribute('download') || (routerIgnore && routerIgnore === 'true')) return;

    if (/^(mailto:|tel:|data:|blob:|javascript:)/i.test(href)) return;

    if (/^(https?:)?\/\//i.test(href)) return;

    var hashIdx = href.indexOf('#/');
    if (hashIdx === 0) {
      e.preventDefault();
      var pathHash = href.slice(1);
      var uHash = canonicalize(pathHash);
      return window.navigate(uHash.pathname + uHash.search + uHash.hash);
    } else if (hashIdx > 0) {
      e.preventDefault();
      var pathMix = '/' + href.slice(hashIdx + 2);
      var uMix = canonicalize(pathMix);
      return window.navigate(uMix.pathname + uMix.search + uMix.hash);
    }

    if (href.charAt(0) === '#') return;

    if (href.charAt(0) === '/') {
      e.preventDefault();
      var uAbs = canonicalize(href);
      return window.navigate(uAbs.pathname + uAbs.search + uAbs.hash);
    }

  }, { passive: false });

  // ===== popstate =====
  try { history.scrollRestoration = 'manual'; } catch (_e){}
  window.addEventListener('popstate', function(){
    if (correctOnPopstate()) return;
    dispatch();
  });

  // ===== 글로벌 i18n 변경 대응 (헤더/푸터/네비 포함) =====
  document.addEventListener('i18n:changed', function(){
    try {
      var content = document.getElementById('content') || document.body;
      if (!applyCalcI18NIfAvailable(content)) {
        applyI18NOutsideCalc(content);
      }
      if (window.I18N && typeof window.I18N.applyTo === 'function') {
        window.I18N.applyTo(document.body);
      }
      applyCalcI18NIfAvailable(content);
    } catch (_e) {}
  }, false);

  

})();

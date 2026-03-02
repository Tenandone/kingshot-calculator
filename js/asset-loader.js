// =========================================================
// /js/asset-loader.js — FULL FINAL
// 목적:
//  - 공통 asset loader (CSS/JS) "중복 로드 방지 + 순서 안정화 + 버전 파라미터(v)"
//  - buildings/static-html 로더에서 안전하게 <link>/<script> 주입 가능
//
// 제공 전역:
//  - window.__ASSET_VER (optional override) / window.__V (existing)
//  - window.v(url)              : 버전 쿼리(v=) 붙인 URL 반환
//  - window.canonical(url)      : v 파라미터 제거한 canonical URL
//  - window.ensureCSS(href)     : CSS 1회만 로드 (Promise)
//  - window.ensureScript(src)   : JS 1회만 로드 (Promise)  ✅ async=false + defer=true
// =========================================================
(function () {
  'use strict';

  // ---- shared caches (persist across reloads in SPA session) ----
  const seenCSS  = window.__KD_SEEN_CSS  || (window.__KD_SEEN_CSS  = new Set());
  const seenJS   = window.__KD_SEEN_JS   || (window.__KD_SEEN_JS   = new Set());
  const inflight = window.__KD_INFLIGHT  || (window.__KD_INFLIGHT  = new Map());

  // ✅ 버전 파라미터 우선순위: __ASSET_VER > __V > 'now'
  const ASSET_VER = window.__ASSET_VER || window.__V || 'now';

  // ---- helpers ----
  function canonical(url) {
    try {
      const u = new URL(url, location.href);
      u.searchParams.delete('v');
      return u.href;
    } catch (e) {
      return String(url);
    }
  }

  function v(url) {
    if (!url) return url;
    if (/^(data:|blob:|#)/i.test(url)) return url;

    try {
      const u = new URL(url, location.href);
      u.searchParams.set('v', ASSET_VER);

      // same-origin이면 상대 경로로 반환(기존 코드 호환)
      return (u.origin !== location.origin) ? u.href : (u.pathname + u.search + u.hash);
    } catch (e) {
      return url + (String(url).includes('?') ? '&' : '?') + 'v=' + ASSET_VER;
    }
  }

  function escAttr(val) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(val);
    return String(val).replace(/["'\\\[\]\(\)\s]/g, '');
  }

  // expose helpers (optional)
  if (!window.canonical) window.canonical = canonical;
  if (!window.v) window.v = v;

  // ---- ensureCSS ----
  window.ensureCSS = window.ensureCSS || function ensureCSS(href) {
    const absKey = canonical(href);
    const selEnsured = 'link[rel="stylesheet"][data-ensured="' + escAttr(absKey) + '"]';
    if (seenCSS.has(absKey) || document.querySelector(selEnsured)) return Promise.resolve();

    const inflightKey = 'css:' + absKey;
    if (inflight.has(inflightKey)) return inflight.get(inflightKey);

    const p = new Promise(function (res, rej) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = v(href);
      l.setAttribute('data-ensured', absKey);
      l.onload  = function(){ seenCSS.add(absKey); res(); };
      l.onerror = function(){ rej(new Error('CSS load failed: ' + href)); };
      document.head.appendChild(l);
    }).finally(function(){ inflight.delete(inflightKey); });

    inflight.set(inflightKey, p);
    return p;
  };

  // ---- ensureScript ----
  // ✅ 핵심: async=true 금지(순서 꼬임 방지)
  // 동적 삽입 스크립트는 기본적으로 실행 순서가 흔들릴 수 있음.
  // async=false + defer=true로 "최대한" 순서/타이밍 안정화.
  window.ensureScript = window.ensureScript || function ensureScript(src, opt) {
    opt = opt || {};
    const absKey = canonical(src);
    const selEnsured = 'script[data-ensured="' + escAttr(absKey) + '"]';
    if (seenJS.has(absKey) || document.querySelector(selEnsured)) return Promise.resolve();

    const inflightKey = 'js:' + absKey;
    if (inflight.has(inflightKey)) return inflight.get(inflightKey);

    const p = new Promise(function (res, rej) {
      const s = document.createElement('script');
      s.src = v(src);

      if (opt.type === 'module') {
        s.type = 'module';
      } else {
        s.async = false;   // ✅ 중요
        s.defer = true;    // ✅ 중요
        if (opt.type) s.type = opt.type;
      }

      if (opt.integrity) {
        s.integrity = opt.integrity;
        s.crossOrigin = opt.crossOrigin || 'anonymous';
      }

      s.setAttribute('data-ensured', absKey);
      s.onload  = function(){ seenJS.add(absKey); res(); };
      s.onerror = function(){ rej(new Error('Script load failed: ' + src)); };
      document.head.appendChild(s);
    }).finally(function(){ inflight.delete(inflightKey); });

    inflight.set(inflightKey, p);
    return p;
  };
})();
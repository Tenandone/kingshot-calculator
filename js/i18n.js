// /js/i18n.js (v1.7) — namespace loader + dot-path + data-i18n[-attr]
// + has/exists + ready + dedupe + optional namespaces + other-lang guard
// + perf: single valid path, immutable cache, parallel preload, fast-apply(init)
//
// 변경 요약
// - buildUrls 단일 경로(/i18n/{lang}/{ns}.json)로 고정 → 404 폭주 제거
// - fetch 캐시(force-cache) + 타임아웃 → 네트워크 대기 최소화
// - preload 병렬 로딩(Promise.all) → 워터폴 제거
// - init: 우선 ns 1개 즉시 적용 → 나머지 백그라운드 병렬 로드(체감 번역 1초대)

(function (global) {
  'use strict';

  // ===== Config =====
  var I18N_VERSION = '2025-09-13';       // 배포 시에만 변경 (빈번히 바꾸지 말 것)
  var I18N_REQUEST_TIMEOUT_MS = 1200;    // 느린 경로 방어 타임아웃

  // ===== State =====
  var dict = {};                         // 현재 언어 병합된 번역 사전
  var current = 'ko';
  var supported = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'];
  var loadedNamespaces = [];             // 사람이 읽기 좋은 기록(중복 방지 X)
  var siteTitleSuffix = 'KingshotData';

  // 디듀프/상태
  // key 형식: `${lang}:${ns}`
  var _nsCache = new Map();              // 완료된 JSON 캐시
  var _nsLoading = new Map();            // 진행 중 Promise
  var _appliedNs = new Set();            // dict에 "병합까지 끝난" (lang:ns) 기록

  // 옵션
  var optionalNS = new Set();            // 없어도 되는 ns 목록
  var strictCurrentLang = false;         // true면 현재 언어 외 호출은 스킵

  // ===== Utils =====
  function fetchJSON(url) {
    var ac = new AbortController();
    var to = setTimeout(function(){ try{ ac.abort(); }catch(_){/* noop */} }, I18N_REQUEST_TIMEOUT_MS);
    // immutable 캐시 활용(쿼리에 VERSION 사용 전제)
    return fetch(url, { signal: ac.signal, cache: 'force-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('i18n load error: ' + url + ' (' + res.status + ')');
        return res.json();
      })
      .finally(function(){ clearTimeout(to); });
  }

  function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target || source;
    target = target && typeof target === 'object' ? target : {};
    Object.keys(source).forEach(function (k) {
      var sv = source[k];
      if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
        target[k] = deepMerge(target[k] || {}, sv);
      } else {
        target[k] = sv;
      }
    });
    return target;
  }

  function getByPath(obj, path) {
    if (!path) return undefined;
    return String(path).split('.').reduce(function (o, key) {
      return (o && o[key] !== undefined) ? o[key] : undefined;
    }, obj);
  }

  // ===== URL Resolver =====
  // 프로젝트 구조는 /i18n/{lang}/{ns}.json 이므로 단일 경로만 사용한다.
  function buildUrls(ns, lang) {
    var v = I18N_VERSION; // 고정 버전(캐시 버스터)
    return ['/i18n/' + lang + '/' + ns + '.json?v=' + v];
  }

  // ===== Loaders (with dedupe) =====
  function loadNamespace(ns, lang) {
    var langToUse = lang || current;

    // 다른 언어 프리페치를 막고 싶으면 차단
    if (strictCurrentLang && langToUse !== current) {
      console.debug('[i18n] skip other-lang preload:', langToUse, '(current:', current + ')', 'ns:', ns);
      return Promise.resolve(true);
    }

    var key = langToUse + ':' + ns;

    // 1) 완료 캐시 존재: 병합/로그 1회만 수행
    if (_nsCache.has(key)) {
      if (!_appliedNs.has(key)) {
        dict = deepMerge(dict, _nsCache.get(key));
        _appliedNs.add(key);
        if (loadedNamespaces.indexOf(ns) === -1) loadedNamespaces.push(ns);
        console.info('[i18n] cached:', key);
      } else {
        console.debug('[i18n] cached-skip:', key);
      }
      return Promise.resolve(true);
    }

    // 2) 진행 중 Promise 존재: 완료 시 병합 1회만
    if (_nsLoading.has(key)) {
      return _nsLoading.get(key).then(function (obj) {
        if (!_appliedNs.has(key)) {
          dict = deepMerge(dict, obj || {});
          _appliedNs.add(key);
          if (loadedNamespaces.indexOf(ns) === -1) loadedNamespaces.push(ns);
        } else {
          console.debug('[i18n] pending-skip:', key);
        }
        return true;
      });
    }

    // 3) 실제 요청 — 단일 경로만 (404 폭주 방지)
    var url = buildUrls(ns, langToUse)[0];

    var p = fetchJSON(url).then(function (obj) {
      _nsCache.set(key, obj);
      if (!_appliedNs.has(key)) {
        dict = deepMerge(dict, obj);
        _appliedNs.add(key);
        if (loadedNamespaces.indexOf(ns) === -1) loadedNamespaces.push(ns);
      }
      console.info('[i18n] loaded:', url);
      return true;
    }).catch(function () {
      if (optionalNS.has(ns)) {
        console.debug('[i18n] optional ns missing (ok):', ns, 'lang:', langToUse);
        return true; // 조용히 통과
      } else {
        console.warn('[i18n] not found ns:', ns, 'lang:', langToUse, 'tried:', url);
        return false;
      }
    }).finally(function () {
      _nsLoading.delete(key);
    });

    _nsLoading.set(key, p.then(function () { return _nsCache.get(key) || {}; }));
    return p;
  }

  function loadUnified(lang) {
    var langToUse = lang || current;
    var url = '/locales/' + langToUse + '.json?v=' + I18N_VERSION;
    var key = langToUse + ':__unified__';

    if (_nsCache.has(key)) {
      if (!_appliedNs.has(key)) {
        dict = deepMerge(dict, _nsCache.get(key));
        _appliedNs.add(key);
        console.info('[i18n] unified cached:', url);
      } else {
        console.debug('[i18n] unified cached-skip:', key);
      }
      return Promise.resolve(true);
    }
    if (_nsLoading.has(key)) {
      return _nsLoading.get(key).then(function (obj) {
        if (!_appliedNs.has(key)) {
          dict = deepMerge(dict, obj || {});
          _appliedNs.add(key);
        } else {
          console.debug('[i18n] unified pending-skip:', key);
        }
        return true;
      });
    }

    var p = fetchJSON(url).then(function (obj) {
      _nsCache.set(key, obj);
      if (!_appliedNs.has(key)) {
        dict = deepMerge(dict, obj);
        _appliedNs.add(key);
      }
      console.info('[i18n] unified loaded:', url);
      return true;
    }).finally(function () { _nsLoading.delete(key); });

    _nsLoading.set(key, p.then(function () { return _nsCache.get(key) || {}; }));
    return p;
  }

  // ===== Translate =====
  function t(key, fallback) {
    var v = getByPath(dict, key);
    if (v === undefined && dict[key] !== undefined) v = dict[key];
    return (v !== undefined) ? v : (fallback !== undefined ? fallback : key);
  }

  function exists(key) {
    return getByPath(dict, key) !== undefined || dict[key] !== undefined;
  }
  function has(key) { return exists(key); }

  function translateScope(scope) {
    var root = scope || document;

    // 텍스트 치환
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = t(key, el.textContent || key);
      if (val !== undefined) el.textContent = val;
    });

    // 속성 치환 (세미콜론 구분; 단일 매핑도 지원)
    root.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      var pairs = (el.getAttribute('data-i18n-attr') || '')
        .split(';').map(function (s) { return s.trim(); }).filter(Boolean);
      pairs.forEach(function (pair) {
        var parts = pair.split(':');
        var attr = (parts[0] || '').trim();
        var key  = (parts[1] || '').trim();
        if (!attr || !key) return;
        var val = t(key, el.getAttribute(attr) || key);
        if (val !== undefined) el.setAttribute(attr, val);
      });
    });

    // 단축 호환
    root.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      el.setAttribute('placeholder', t(key, el.getAttribute('placeholder') || key));
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria-label');
      el.setAttribute('aria-label', t(key, el.getAttribute('aria-label') || key));
    });
  }

  function apply() {
    if (typeof document === 'undefined') return;
    translateScope(document);
    syncTitles(); // 타이틀 누락 보조
  }

  // ===== Init / setLang =====
  function parseNsFromMeta() {
    var m = document.querySelector('meta[name="i18n-ns"]');
    if (!m || !m.content) return [];
    return m.content.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  // ✅ 빠른 적용 모드: 첫 ns 즉시 적용 → 나머지 병렬 후 한 번 더 적용
  function init(opts) {
    opts = opts || {};
    supported = opts.supported || supported;

    optionalNS = new Set(Array.isArray(opts.optional) ? opts.optional : []);
    strictCurrentLang = !!opts.strictCurrentLang;

    var pref = opts.lang;
    if (!pref) {
      try { pref = localStorage.getItem('lang') || 'ko'; } catch (_) { pref = 'ko'; }
    }
    current = supported.indexOf(pref) >= 0 ? pref : supported[0];
    try { localStorage.setItem('lang', current); } catch (_) {}

    try {
      var metaSite = document.querySelector('meta[name="site-title"]');
      if (metaSite && metaSite.content) siteTitleSuffix = metaSite.content;
    } catch (_) {}

    // 프리로드 ns 목록
    var preload = Array.isArray(opts.namespaces) && opts.namespaces.length
      ? opts.namespaces
      : parseNsFromMeta();
    if (!preload.length) preload = ['common'];

    // 적용 범위: 무거운 페이지면 '#calc-ui' 등으로 좁히기
    var root = (function(){
      if (!opts || !opts.root) return document;
      if (typeof opts.root === 'string') return document.querySelector(opts.root) || document;
      return opts.root && opts.root.nodeType === 1 ? opts.root : document;
    })();

    // 1) 우선 ns 하나 먼저 → 즉시 적용 (체감 1초 내)
    var primary = (opts.primaryNs && preload.indexOf(opts.primaryNs) >= 0)
      ? opts.primaryNs
      : preload[0];

    return loadNamespace(primary, current).then(function () {
      applyTo(root); // 1차 적용

      // 2) 나머지 병렬 로드 → 완료 시 한 번 더 적용
      var rest = preload.filter(function(ns){ return ns !== primary; });
      if (!rest.length) {
        document.dispatchEvent(new CustomEvent('i18n:ready', { detail: { lang: current } }));
        return;
      }
      return Promise.all(rest.map(function (ns) { return loadNamespace(ns, current); }))
        .then(function () {
          applyTo(root); // 2차 최종 적용
          document.dispatchEvent(new CustomEvent('i18n:ready', { detail: { lang: current } }));
        });
    });
  }

  function setLang(lang) {
    if (supported.indexOf(lang) < 0) return Promise.resolve(false);
    current = lang;
    try { localStorage.setItem('lang', lang); } catch (_) {}

    // 새 언어 재구성
    dict = {};
    _appliedNs.clear(); // ✅ 언어 전환 시 병합 기록 초기화

    var p;
    if (loadedNamespaces.length) {
      // 병렬 로딩
      p = Promise.all(loadedNamespaces.slice().map(function (ns) {
        return loadNamespace(ns, current);
      }));
    } else {
      p = loadUnified(current);
    }

    return p.then(function () {
      apply();
      try {
        var sp = new URLSearchParams(location.search);
        sp.set('lang', lang);
        history.replaceState(null, '', location.pathname + '?' + sp);
      } catch (_) {}
      document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: lang } }));
      return true;
    });
  }

  function applyTo(root) {
    if (!root) return;
    translateScope(root);
    syncTitles();
  }

  // ===== Ready (모든 pending ns 끝날 때 resolve) =====
  function ready() {
    if (_nsLoading.size === 0) return Promise.resolve();
    return Promise.all(Array.from(_nsLoading.values())).then(function () { /* no-op */ });
  }

  // ===== Title/Meta Fallback =====
  function syncTitles() {
    if (typeof document === 'undefined') return;

    var titleEl = document.querySelector('title');
    if (titleEl && !titleEl.getAttribute('data-i18n')) {
      var h1 = document.getElementById('page-title');
      var key = h1 && h1.getAttribute('data-i18n');
      if (key) {
        var txt = t(key, h1.textContent || key);
        if (txt) document.title = txt + ' | ' + siteTitleSuffix;
      }
    }
    // <meta name="description" data-i18n-attr="content:...">는 translateScope가 처리
  }

  // ===== Export =====
  global.I18N = {
    // Core
    init: init,
    setLang: setLang,
    t: t,
    applyTo: applyTo,
    loadNamespace: loadNamespace,
    loadUnified: loadUnified,
    ready: ready,

    // Existence checks
    exists: exists,
    has: has,

    // getter
    get current() { return current; }
  };
})(window);

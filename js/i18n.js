// /js/i18n.js (v1.4) — namespace loader + dot-path + data-i18n[-attr]
// + has/exists + ready + dedupe + optional namespaces + other-lang guard
//
// 무엇이 달라졌나?
// 1) I18N.exists / I18N.has 제공 → app.js의 I18N.has 안전 사용
// 2) I18N.ready(): 네임스페이스 비동기 로드 완료 보장
// 3) 디듀프: 같은 (lang:ns) 요청/병합 1회만 수행 (중복 로그/병합 제거)
// 4) optional ns: 없는 ns(404)도 조용히 통과 가능
// 5) strictCurrentLang: 현재 언어 외 프리페치 가드(원하면 켜기)
// 6) 기존 API와 완전 호환 (init, setLang, t, applyTo, loadNamespace, loadUnified)

(function (global) {
  'use strict';

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
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('i18n load error: ' + url + ' (' + res.status + ')');
      return res.json();
    });
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
  // ns에 '/'가 있든 없든 둘 다 시도:
  // 1) /i18n/{lang}/{ns}.json
  // 2) /i18n/{ns}/{lang}.json
  function buildUrls(ns, lang) {
    var v = Date.now();
    return [
      '/i18n/' + lang + '/' + ns + '.json?v=' + v,
      '/i18n/' + ns + '/' + lang + '.json?v=' + v
    ];
  }

  // ===== Loaders (with dedupe) =====
  function loadNamespace(ns, lang) {
    var langToUse = lang || current;

    // 다른 언어 프리페치를 막고 싶으면 옵션으로 차단
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

    // 3) 실제 요청 — 두 경로 순차 시도
    var urls = buildUrls(ns, langToUse);
    var i = 0;

    var p = new Promise(function (resolve) {
      function tryNext() {
        if (i >= urls.length) {
          if (optionalNS.has(ns)) {
            console.debug('[i18n] optional ns missing (ok):', ns, 'lang:', langToUse);
            resolve(true); // 조용히 통과
          } else {
            console.warn('[i18n] not found ns:', ns, 'lang:', langToUse, 'tried:', urls);
            resolve(false);
          }
          return;
        }
        var url = urls[i++];
        fetchJSON(url).then(function (obj) {
          _nsCache.set(key, obj);              // 성공 시 캐시
          if (!_appliedNs.has(key)) {
            dict = deepMerge(dict, obj);       // 전역 dict에 병합(1회)
            _appliedNs.add(key);
            if (loadedNamespaces.indexOf(ns) === -1) loadedNamespaces.push(ns);
          }
          console.info('[i18n] loaded:', url);
          resolve(true);
        }).catch(function () { tryNext(); });
      }
      tryNext();
    }).finally(function () {
      _nsLoading.delete(key);
    });

    _nsLoading.set(key, p.then(function () { return _nsCache.get(key) || {}; }));
    return p;
  }

  function loadUnified(lang) {
    var langToUse = lang || current;
    var url = '/locales/' + langToUse + '.json?v=' + Date.now();

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
    }).finally(function () {
      _nsLoading.delete(key);
    });

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

    // 속성 치환
    root.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      var pairs = el.getAttribute('data-i18n-attr')
        .split(';').map(function (s) { return s.trim(); }).filter(Boolean);
      pairs.forEach(function (pair) {
        var parts = pair.split(':');
        var attr = (parts[0] || '').trim();
        var key = (parts[1] || '').trim();
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

  function init(opts) {
    opts = opts || {};
    supported = opts.supported || supported;

    // 옵션 파싱
    optionalNS = new Set(Array.isArray(opts.optional) ? opts.optional : []);
    strictCurrentLang = !!opts.strictCurrentLang;

    // 선호 언어: opts.lang > localStorage > 'ko'
    var pref = opts.lang;
    if (!pref) {
      try { pref = localStorage.getItem('lang') || 'ko'; } catch (_) { pref = 'ko'; }
    }
    current = supported.indexOf(pref) >= 0 ? pref : supported[0];
    try { localStorage.setItem('lang', current); } catch (_) {}

    // 사이트 타이틀 접미사
    try {
      var metaSite = document.querySelector('meta[name="site-title"]');
      if (metaSite && metaSite.content) siteTitleSuffix = metaSite.content;
    } catch (_) {}

    // 프리로드 ns 결정
    var preload = Array.isArray(opts.namespaces) && opts.namespaces.length
      ? opts.namespaces
      : parseNsFromMeta();
    if (!preload.length) preload = ['common'];

    var p = Promise.resolve();
    preload.forEach(function (ns) {
      p = p.then(function () { return loadNamespace(ns, current); });
    });

    return p.then(function () {
      apply();
      document.dispatchEvent(new CustomEvent('i18n:ready', { detail: { lang: current } }));
    });
  }

  function setLang(lang) {
    if (supported.indexOf(lang) < 0) return Promise.resolve(false);
    current = lang;
    try { localStorage.setItem('lang', lang); } catch (_) {}

    // 새 언어 재구성
    dict = {};
    _appliedNs.clear(); // ✅ 언어 전환 시 병합 기록 초기화

    var p = Promise.resolve();
    if (loadedNamespaces.length) {
      loadedNamespaces.slice().forEach(function (ns) {
        p = p.then(function () { return loadNamespace(ns, current); });
      });
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

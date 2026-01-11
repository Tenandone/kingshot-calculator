(function (global) {
  'use strict';

  // ===== Config =====
  var I18N_VERSION = (window.__V || '2025-09-17');      // 배포 시에만 변경 (빈번히 바꾸지 말 것)
  var I18N_REQUEST_TIMEOUT_MS = 1200;    // 느린 경로 방어 타임아웃

  // ===== State =====
  var dict = {};                         // 현재 언어 병합된 번역 사전
  var current = 'ko';
  var supported = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'];
  var loadedNamespaces = ['common','waracademy'];             // 사람이 읽기 좋은 기록(중복 방지용 check 포함)
  var siteTitleSuffix = 'KingshotData';

  // 디듀프/상태
  // key 형식: `${lang}:${ns}`
  var _nsCache = new Map();              // 완료된 JSON 캐시
  var _nsLoading = new Map();            // 진행 중 Promise (key: lang:ns → Promise<object>)
  var _appliedNs = new Set();            // dict에 "병합까지 끝난" (lang:ns) 기록

  // 옵션
  var optionalNS = new Set();            // 없어도 되는 ns 목록
  var strictCurrentLang = false;         // true면 현재 언어 외 호출은 스킵(프리페치 방지)

  // ===== Utils =====

  // 네트워크 JSON 로딩 (타임아웃, immutable 캐시)
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

  // 얕은 객체도 허용하는 안전한 딥 머지
  // 왜? 각 ns JSON을 한 사전에 누적 병합하기 위해 필요
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

  // 'a.b.c' 같은 dot-path 접근
  function getByPath(obj, path) {
    if (!path) return undefined;
    return String(path).split('.').reduce(function (o, key) {
      return (o && o[key] !== undefined) ? o[key] : undefined;
    }, obj);
  }

  // ===== URL Resolver =====
  // 프로젝트 구조는 /i18n/{lang}/{ns}.json 이므로 단일 경로만 사용한다.
  function buildUrls(ns, lang) {
  var v = (window.__V || I18N_VERSION || 'now');   // ✅ 런타임에서 바로 반영
  return ['/i18n/' + lang + '/' + ns + '.json?v=' + v];
}


  // ===== Internal merge helpers (언어 가드) =====

  // 특정 로딩 결과(obj)를 dict에 병합하되, "요청 당시의 lang"이 "현재 lang"과 같을 때만 수행
  // 왜? setLang 도중 이전 언어 응답이 늦게 도착해 현재 언어를 오염시키는 것을 방지
  function mergeNsIfCurrent(lang, ns, obj) {
    if (lang !== current) {
      console.debug('[i18n] stale-merge-skip:', lang + ':' + ns, '(current:', current + ')');
      return false;
    }
    var key = lang + ':' + ns;
    if (_appliedNs.has(key)) {
      console.debug('[i18n] merge-skip (already applied):', key);
      return true;
    }
    dict = deepMerge(dict, obj || {});
    _appliedNs.add(key);
    if (loadedNamespaces.indexOf(ns) === -1) loadedNamespaces.push(ns);
    return true;
  }

  function mergeUnifiedIfCurrent(lang, obj) {
    if (lang !== current) {
      console.debug('[i18n] stale-merge-skip unified:', lang, '(current:', current + ')');
      return false;
    }
    var key = lang + ':__unified__';
    if (_appliedNs.has(key)) {
      console.debug('[i18n] unified merge-skip (already applied):', key);
      return true;
    }
    dict = deepMerge(dict, obj || {});
    _appliedNs.add(key);
    return true;
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

    // 1) 완료 캐시 존재: 필요 시 1회 병합
    if (_nsCache.has(key)) {
      var objFromCache = _nsCache.get(key);
      if (!_appliedNs.has(key)) {
        mergeNsIfCurrent(langToUse, ns, objFromCache);
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
          mergeNsIfCurrent(langToUse, ns, obj || {});
        } else {
          console.debug('[i18n] pending-skip:', key);
        }
        return true;
      });
    }

    // 3) 실제 요청 — 단일 경로만 (404 폭주 방지)
    var url = buildUrls(ns, langToUse)[0];

    var pCore = fetchJSON(url).then(function (obj) {
      _nsCache.set(key, obj);
      mergeNsIfCurrent(langToUse, ns, obj);
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

    // _nsLoading에는 "객체를 반환하는" Promise를 저장해, 다른 경로에서도 재사용 가능하게 함
    _nsLoading.set(key, pCore.then(function () { return _nsCache.get(key) || {}; }));
    return pCore;
  }

  function loadUnified(lang) {
    var langToUse = lang || current;
    var url = '/locales/' + langToUse + '.json?v=' + I18N_VERSION;
    var key = langToUse + ':__unified__';

    if (_nsCache.has(key)) {
      var cached = _nsCache.get(key);
      if (!_appliedNs.has(key)) {
        mergeUnifiedIfCurrent(langToUse, cached);
        console.info('[i18n] unified cached:', url);
      } else {
        console.debug('[i18n] unified cached-skip:', key);
      }
      return Promise.resolve(true);
    }

    if (_nsLoading.has(key)) {
      return _nsLoading.get(key).then(function (obj) {
        if (!_appliedNs.has(key)) {
          mergeUnifiedIfCurrent(langToUse, obj || {});
        } else {
          console.debug('[i18n] unified pending-skip:', key);
        }
        return true;
      });
    }

    var pCore = fetchJSON(url).then(function (obj) {
      _nsCache.set(key, obj);
      mergeUnifiedIfCurrent(langToUse, obj);
      console.info('[i18n] unified loaded:', url);
      return true;
    }).catch(function (err) {
      // unified가 없는 프로젝트도 있으므로 오류는 흘려보냄
      console.debug('[i18n] unified missing or error (ok):', url, String(err && err.message || err));
      return false;
    }).finally(function () {
      _nsLoading.delete(key);
    });

    _nsLoading.set(key, pCore.then(function () { return _nsCache.get(key) || {}; }));
    return pCore;
  }

  // ===== Translate =====

  // t('a.b.c', '없을 때 기본값')
  function t(key, fallback) {
    var v = getByPath(dict, key);
    if (v === undefined && dict[key] !== undefined) v = dict[key]; // dot-키 보정
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
      if (val !== undefined) el.textContent = val; // textContent 사용으로 XSS 방지
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

  function applyTo(root) {
    if (!root) return;
    translateScope(root);
    syncTitles();
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
        try { document.dispatchEvent(new CustomEvent('i18n:ready', { detail: { lang: current } })); } catch(_){}
        return;
      }
      return Promise.all(rest.map(function (ns) { return loadNamespace(ns, current); }))
        .then(function () {
          applyTo(root); // 2차 최종 적용
          try { document.dispatchEvent(new CustomEvent('i18n:ready', { detail: { lang: current } })); } catch(_){}
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
      // 병렬 로딩: 지금까지 사용된 ns만 재로딩
      p = Promise.all(loadedNamespaces.slice().map(function (ns) {
        return loadNamespace(ns, current);
      }));
    } else {
      // 아직 ns가 없다면 통합 파일 시도
      p = loadUnified(current);
    }

    return p.then(function () {
      apply();
      try {
        var sp = new URLSearchParams(location.search);
        sp.set('lang', lang);
        history.replaceState(null, '', location.pathname + '?' + sp);
      } catch (_) {}
      try { document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: lang } })); } catch(_){}
      return true;
    });
  }

  // ===== Ready (현재 언어의 pending만 기다리기) =====
  function ready() {
    if (_nsLoading.size === 0) return Promise.resolve();
    var prefix = current + ':';
    var pending = [];
    _nsLoading.forEach(function (p, k) {
      if (typeof k === 'string' && k.indexOf(prefix) === 0) pending.push(p);
    });
    if (pending.length === 0) return Promise.resolve();
    return Promise.all(pending).then(function(){ /* no-op */ });
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

  // --- v1.8 compat layer (old window.i18n API) ---
  // 기존 코드에서 window.i18n.* 을 기대하므로 브릿지 제공
  (function (global) {
    function compatApply(root) {
      try { global.I18N.applyTo(root || document); } catch (_) {}
    }

    function compatEnsure(namespaces) {
      var arr = Array.isArray(namespaces) ? namespaces : (namespaces ? [namespaces] : []);
      if (!arr.length) return Promise.resolve(true);
      return Promise.all(arr.map(function (ns) {
        return global.I18N.loadNamespace(ns, global.I18N.current);
      })).then(function () { return true; });
    }

    global.i18n = global.i18n || {};
    global.i18n.apply   = compatApply;         // window.i18n.apply()
    global.i18n.applyTo = global.I18N.applyTo; // window.i18n.applyTo()
    global.i18n.ensure  = compatEnsure;        // window.i18n.ensure()
    global.i18n.t       = global.I18N.t;
    global.i18n.exists  = global.I18N.exists;
    global.i18n.has     = global.I18N.has;
    global.i18n.ready   = global.I18N.ready;
    global.i18n.setLang = global.I18N.setLang;
    Object.defineProperty(global.i18n, 'current', {
      get: function(){ return global.I18N.current; }
    });
  })(window);

})(window);   // ← 최종 닫힘

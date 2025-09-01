// /js/i18n.js (v1.2 - namespace loader, dot-path, title/meta via data-i18n[-attr])
(function (global) {
  'use strict';

  // ===== State =====
  var dict = {};
  var current = 'ko';
  var supported = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'];
  var loadedNamespaces = [];
  var siteTitleSuffix = 'KingshotData';

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

  // ===== Loaders =====
  function loadNamespace(ns, lang) {
    var langToUse = lang || current;
    var urls = buildUrls(ns, langToUse);

    // 순차 시도
    var i = 0;
    function tryNext() {
      if (i >= urls.length) {
        console.warn('[i18n] not found ns:', ns, 'lang:', langToUse, 'tried:', urls);
        return Promise.resolve(false);
      }
      var url = urls[i++];
      return fetchJSON(url).then(function (obj) {
        dict = deepMerge(dict, obj);
        if (loadedNamespaces.indexOf(ns) === -1) loadedNamespaces.push(ns);
        console.info('[i18n] loaded:', url);
        return true;
      }).catch(function () {
        return tryNext();
      });
    }
    return tryNext();
  }

  function loadUnified(lang) {
    var langToUse = lang || current;
    var url = '/locales/' + langToUse + '.json?v=' + Date.now();
    return fetchJSON(url).then(function (obj) {
      dict = deepMerge(dict, obj);
      console.info('[i18n] unified loaded:', url);
      return true;
    });
  }

  // ===== Translate =====
  function t(key, fallback) {
    var v = getByPath(dict, key);
    if (v === undefined && dict[key] !== undefined) v = dict[key];
    return (v !== undefined) ? v : (fallback !== undefined ? fallback : key);
  }
  function translateScope(scope) {
    var root = scope || document;

    // 텍스트 치환
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = t(key, el.textContent || key);
      if (val !== undefined) el.textContent = val;
    });

    // 속성 치환: data-i18n-attr="placeholder:foo; aria-label:bar"
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

    // 호환: 개별 단축
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
    syncTitles(); // fallback 전용
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
    var pref = opts.lang || 'ko';
    current = supported.indexOf(pref) >= 0 ? pref : supported[0];

    try { localStorage.setItem('lang', current); } catch (_) {}

    // 사이트 타이틀 접미사(선택)
    try {
      var metaSite = document.querySelector('meta[name="site-title"]');
      if (metaSite && metaSite.content) siteTitleSuffix = metaSite.content;
    } catch (_) {}

    // 네임스페이스 결정: 옵션 > meta[name=i18n-ns] > ['common']
    var preload = Array.isArray(opts.namespaces) && opts.namespaces.length
      ? opts.namespaces
      : parseNsFromMeta();
    if (!preload.length) preload = ['common'];

    // 순차 로드
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
    dict = {};

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
    syncTitles(); // fallback
  }

  // ===== Title/Meta Fallback =====
  // 원칙: <title>과 <meta>도 data-i18n / data-i18n-attr로 치환된다.
  // 다만 일부 브라우저/마크업에서 누락될 때 보조로 한 번 더 시도.
  function syncTitles() {
    if (typeof document === 'undefined') return;

    // 1) <title data-i18n="...">가 있다면 이미 translateScope로 바뀜.
    //    만약 data-i18n이 없고, #page-title에 data-i18n이 있으면 그걸로 title 보조.
    var titleEl = document.querySelector('title');
    if (titleEl && !titleEl.getAttribute('data-i18n')) {
      var h1 = document.getElementById('page-title');
      var key = h1 && h1.getAttribute('data-i18n');
      if (key) {
        var txt = t(key, h1.textContent || key);
        if (txt) document.title = txt + ' | ' + siteTitleSuffix;
      }
    }

    // 2) <meta name="description" data-i18n-attr="content:...">는 translateScope가 처리함.
    //    별도 조치 필요 없음.
  }

  // ===== Export =====
  global.I18N = {
    init: init,
    setLang: setLang,
    t: t,
    applyTo: applyTo,
    loadNamespace: loadNamespace,
    loadUnified: loadUnified,
    get current() { return current; }
  };
})(window);

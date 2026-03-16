(function (global) {
  'use strict';

  // ===== Config =====
  var I18N_VERSION = (window.__V || '2025-09-17');
  var I18N_REQUEST_TIMEOUT_MS = 1200;

  // ===== State =====
  var dict = {};
  var current = 'en';
  var supported = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'];

  // 현재까지 실제 사용된 ns만 기록
  var loadedNamespaces = ['common'];

  var siteTitleSuffix = 'KingshotData';

  // key 형식: `${lang}:${ns}`
  var _nsCache = new Map();
  var _nsLoading = new Map();
  var _appliedNs = new Set();

  var optionalNS = new Set();
  var strictCurrentLang = false;

  // ===== Utils =====
  function fetchJSON(url) {
    var ac = new AbortController();
    var to = setTimeout(function(){ try{ ac.abort(); }catch(_){ } }, I18N_REQUEST_TIMEOUT_MS);

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
  function buildUrls(ns, lang) {
    var v = (window.__V || I18N_VERSION || 'now');
    return ['/i18n/' + lang + '/' + ns + '.json?v=' + v];
  }

  // ===== Internal merge helpers =====
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

    if (strictCurrentLang && langToUse !== current) {
      console.debug('[i18n] skip other-lang preload:', langToUse, '(current:', current + ')', 'ns:', ns);
      return Promise.resolve(true);
    }

    var key = langToUse + ':' + ns;

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

    var url = buildUrls(ns, langToUse)[0];

    var pCore = fetchJSON(url).then(function (obj) {
      _nsCache.set(key, obj);
      mergeNsIfCurrent(langToUse, ns, obj);
      console.info('[i18n] loaded:', url);
      return true;
    }).catch(function () {
      if (optionalNS.has(ns)) {
        console.debug('[i18n] optional ns missing (ok):', ns, 'lang:', langToUse);
        return true;
      } else {
        console.warn('[i18n] not found ns:', ns, 'lang:', langToUse, 'tried:', url);
        return false;
      }
    }).finally(function () {
      _nsLoading.delete(key);
    });

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
      console.debug('[i18n] unified missing or error (ok):', url, String(err && err.message || err));
      return false;
    }).finally(function () {
      _nsLoading.delete(key);
    });

    _nsLoading.set(key, pCore.then(function () { return _nsCache.get(key) || {}; }));
    return pCore;
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

    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = t(key, el.textContent || key);
      if (val !== undefined) el.textContent = val;
    });

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
  }

  function applyTo(root) {
    if (!root) return;
    translateScope(root);
    syncTitles();
  }

  function apply() {
    if (typeof document === 'undefined') return;
    translateScope(document);
    syncTitles();
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

    optionalNS = new Set(Array.isArray(opts.optional) ? opts.optional : []);
    strictCurrentLang = !!opts.strictCurrentLang;

    var pref = opts.lang;
    if (!pref) {
      try { pref = localStorage.getItem('lang') || 'en'; } catch (_) { pref = 'en'; }
    }

    current = supported.indexOf(pref) >= 0 ? pref : (supported.indexOf('en') >= 0 ? 'en' : supported[0]);
    try { localStorage.setItem('lang', current); } catch (_) {}

    try {
      var metaSite = document.querySelector('meta[name="site-title"]');
      if (metaSite && metaSite.content) siteTitleSuffix = metaSite.content;
    } catch (_) {}

    var preload = Array.isArray(opts.namespaces) && opts.namespaces.length
      ? opts.namespaces
      : parseNsFromMeta();

    if (!preload.length) preload = ['common'];

    var root = (function(){
      if (!opts || !opts.root) return document;
      if (typeof opts.root === 'string') return document.querySelector(opts.root) || document;
      return opts.root && opts.root.nodeType === 1 ? opts.root : document;
    })();

    var primary = (opts.primaryNs && preload.indexOf(opts.primaryNs) >= 0)
      ? opts.primaryNs
      : preload[0];

    return loadNamespace(primary, current).then(function () {
      applyTo(root);

      var rest = preload.filter(function(ns){ return ns !== primary; });
      if (!rest.length) {
        try { document.dispatchEvent(new CustomEvent('i18n:ready', { detail: { lang: current } })); } catch(_){}
        return;
      }

      return Promise.all(rest.map(function (ns) { return loadNamespace(ns, current); }))
        .then(function () {
          applyTo(root);
          try { document.dispatchEvent(new CustomEvent('i18n:ready', { detail: { lang: current } })); } catch(_){}
        });
    });
  }

  function setLang(lang) {
    if (supported.indexOf(lang) < 0) return Promise.resolve(false);

    current = lang;
    try { localStorage.setItem('lang', lang); } catch (_) {}

    dict = {};
    _appliedNs.clear();

    var p;
    if (loadedNamespaces.length) {
      var nsList = loadedNamespaces.slice();

      if (nsList.indexOf('common') === -1) nsList.push('common');

      try {
        var path = location.pathname.replace(/\/+$/, '');
        if (path === '' || path === '/' || path.indexOf('/home') === 0) {
          if (nsList.indexOf('home') === -1) nsList.push('home');
        }
      } catch (_) {}

      p = Promise.all(nsList.map(function (ns) {
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
        history.replaceState(null, '', location.pathname + '?' + sp.toString());
      } catch (_) {}
      try { document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: lang } })); } catch(_){}
      return true;
    });
  }

  // ===== Ready =====
  function ready() {
    if (_nsLoading.size === 0) return Promise.resolve();
    var prefix = current + ':';
    var pending = [];
    _nsLoading.forEach(function (p, k) {
      if (typeof k === 'string' && k.indexOf(prefix) === 0) pending.push(p);
    });
    if (pending.length === 0) return Promise.resolve();
    return Promise.all(pending).then(function(){});
  }

  // ===== Export =====
  global.I18N = {
    init: init,
    setLang: setLang,
    t: t,
    applyTo: applyTo,
    loadNamespace: loadNamespace,
    loadUnified: loadUnified,
    ready: ready,
    exists: exists,
    has: has,
    get current() { return current; }
  };

  // --- v1.8 compat layer ---
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
    global.i18n.apply   = compatApply;
    global.i18n.applyTo = global.I18N.applyTo;
    global.i18n.ensure  = compatEnsure;
    global.i18n.t       = global.I18N.t;
    global.i18n.exists  = global.I18N.exists;
    global.i18n.has     = global.I18N.has;
    global.i18n.ready   = global.I18N.ready;
    global.i18n.setLang = global.I18N.setLang;
    Object.defineProperty(global.i18n, 'current', {
      get: function(){ return global.I18N.current; }
    });
  })(window);

})(window);
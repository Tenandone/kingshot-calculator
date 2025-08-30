// /js/i18n.js (namespace loader + dot-path & flat-key support + title/meta sync)
// 개발 중: 캐시버스터 즉시반영(Date.now()), 운영 시: 버전 번호로 교체
(function (global) {
  'use strict';

  // state
  var dict = {};
  var current = 'ko';
  var supported = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'];
  var loadedNamespaces = [];

  // ---------- utils ----------
  async function fetchJSON(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('i18n load error: ' + url);
    return await res.json();
  }

  function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target || source;
    target = target && typeof target === 'object' ? target : {};
    for (const k of Object.keys(source)) {
      const sv = source[k];
      if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
        target[k] = deepMerge(target[k] || {}, sv);
      } else {
        target[k] = sv;
      }
    }
    return target;
  }

  function getByPath(obj, path) {
    if (!path) return undefined;
    return String(path).split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : undefined), obj);
  }

  function has(key) {
    return getByPath(dict, key) !== undefined || dict[key] !== undefined;
  }

  // ---------- loaders ----------
  async function loadNamespace(ns, lang) {
    const langToUse = lang || current;
    const url = `/i18n/${langToUse}/${ns}.json?v=now`;  // ✅ 즉시반영
    try {
      const obj = await fetchJSON(url);
      dict = deepMerge(dict, obj);
      if (loadedNamespaces.indexOf(ns) === -1) loadedNamespaces.push(ns);
      apply();
      return true;
    } catch (_) {
      return false;
    }
  }

  // ✅ 통합 파일 로더 (/locales/{lang}.json)
  async function loadUnified(lang) {
    const langToUse = lang || current;
    const url = `/locales/${langToUse}.json?v=now`;      // ✅ 즉시반영
    const obj = await fetchJSON(url);
    dict = deepMerge(dict, obj);
    apply();
    return true;
  }

  // ---------- translate ----------
  function translateScope(scope) {
    const root = scope || document;

    // 텍스트 노드 치환
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      let val = getByPath(dict, key);
      if (val === undefined && dict[key] !== undefined) val = dict[key];
      if (val !== undefined) el.textContent = val;
    });

    // 속성 치환: data-i18n-attr="placeholder:xxx; aria-label:yyy"
    root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      const pairs = el.getAttribute('data-i18n-attr')
        .split(';').map((s) => s.trim()).filter(Boolean);
      pairs.forEach((pair) => {
        const parts = pair.split(':');
        const attr = (parts[0] || '').trim();
        const key = (parts[1] || '').trim();
        if (!attr || !key) return;
        let val = getByPath(dict, key);
        if (val === undefined && dict[key] !== undefined) val = dict[key];
        if (val !== undefined) el.setAttribute(attr, val);
      });
    });

    // ✅ 호환: data-i18n-placeholder / data-i18n-aria-label (기존 마크업 그대로 지원)
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const val = t(key, el.getAttribute('placeholder') || '');
      el.setAttribute('placeholder', val);
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria-label');
      const val = t(key, el.getAttribute('aria-label') || '');
      el.setAttribute('aria-label', val);
    });
  }

  function apply() {
    if (typeof document !== 'undefined') {
      translateScope(document);
      syncTitles();
    }
  }

  // ---------- init / setLang ----------
  async function init(opts) {
    opts = opts || {};
    supported = opts.supported || supported;
    const pref = opts.lang || 'ko';
    current = supported.indexOf(pref) >= 0 ? pref : supported[0];
    try { localStorage.setItem('lang', current); } catch (_) {}

    const preload = Array.isArray(opts.namespaces) ? opts.namespaces : ['common'];
    if (preload.length === 0) {
      await loadUnified(current);
    } else {
      for (const ns of preload) { await loadNamespace(ns, current); }
    }
    apply();
  }

  async function setLang(lang) {
    if (supported.indexOf(lang) < 0) return;
    current = lang;
    try { localStorage.setItem('lang', lang); } catch (_) {}

    dict = {};
    if (loadedNamespaces.length > 0) {
      for (const ns of loadedNamespaces.slice()) {
        await loadNamespace(ns, current);
      }
    } else {
      await loadUnified(current);
    }
    apply();

    try {
      const sp = new URLSearchParams(location.search);
      sp.set('lang', lang);
      history.replaceState(null, '', `${location.pathname}?${sp}`);
    } catch (_) {}

    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang } }));
    }
  }

  function t(key, fallback) {
    let v = getByPath(dict, key);
    if (v === undefined && dict[key] !== undefined) v = dict[key];
    return v !== undefined ? v : (fallback !== undefined ? fallback : key);
  }

  function applyTo(root) {
    if (!root) return;
    translateScope(root);
    syncTitles();
  }

  // ---------- title/meta sync ----------
  function syncTitles() {
    if (typeof document === 'undefined') return;

    const h1 = document.getElementById('page-title');
    const metaTitleKey = document.querySelector('meta[name="db-title"]')?.content;
    const titleKey = metaTitleKey || (h1?.dataset?.i18n);
    if (titleKey && h1) {
      const txt = t(titleKey, h1.textContent || titleKey);
      h1.textContent = txt;
      document.title = `${txt} | DataKorea`;
    }

    const metaDescEl = document.querySelector('meta[name="description"]');
    if (metaDescEl?.content) {
      const descTxt = t(metaDescEl.content, metaDescEl.content);
      metaDescEl.setAttribute('content', descTxt);
    }
  }

  // ---------- export ----------
  global.I18N = {
    init,
    setLang,
    t,
    has,
    applyTo,
    loadNamespace,
    loadUnified,
    get current() { return current; }
  };

})(window);

// /js/guides-index.js
// Guides index page controller
// SPA innerHTML 마운트 환경에서도 수동 init 가능하게 구성
(function () {
  'use strict';

  var LANG_CHECK_INTERVAL = 500;
  var ROOT_SELECTOR = '[data-ks-guides-root="1"]';

  // 전역 중복 방지용 상태
  var initializedRoots = window.__KS_GUIDES_INITIALIZED_ROOTS__ || (window.__KS_GUIDES_INITIALIZED_ROOTS__ = []);
  var langWatcherStarted = !!window.__KS_GUIDES_LANG_WATCHER_STARTED__;
  var domObserverStarted = !!window.__KS_GUIDES_DOM_OBSERVER_STARTED__;
  var lastLang = window.__KS_GUIDES_LAST_LANG__ || '';

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $all(sel, root) {
    return (root || document).querySelectorAll(sel);
  }

  function hasRoot(root) {
    if (!root) return false;
    for (var i = 0; i < initializedRoots.length; i++) {
      if (initializedRoots[i] === root) return true;
    }
    return false;
  }

  function markRoot(root) {
    if (!root || hasRoot(root)) return;
    initializedRoots.push(root);
  }

  function cleanupDeadRoots() {
    var alive = [];
    for (var i = 0; i < initializedRoots.length; i++) {
      var root = initializedRoots[i];
      if (root && root.isConnected) alive.push(root);
    }
    initializedRoots.length = 0;
    for (var j = 0; j < alive.length; j++) {
      initializedRoots.push(alive[j]);
    }
  }

  function normalizeLang(raw) {
    var v = String(raw || '').replace(/_/g, '-').toLowerCase();
    if (!v) return 'en';
    if (v === 'ko' || v.indexOf('ko-') === 0) return 'ko';
    if (v === 'en' || v.indexOf('en-') === 0) return 'en';
    if (v === 'ja' || v.indexOf('ja-') === 0) return 'ja';
    if (v === 'zh-tw' || v === 'zh-hant' || v === 'tw') return 'zh-TW';
    return 'en';
  }

  function detectLang() {
    try {
      var sp = new URLSearchParams(location.search);
      var q = sp.get('lang');
      if (q) return normalizeLang(q);
    } catch (_) {}

    try {
      var path = String(location.pathname || '');
      if (/^\/ko(\/|$)/i.test(path)) return 'ko';
      if (/^\/en(\/|$)/i.test(path)) return 'en';
      if (/^\/ja(\/|$)/i.test(path)) return 'ja';
      if (/^\/zh-tw(\/|$)/i.test(path)) return 'zh-TW';
    } catch (_) {}

    try {
      if (window.I18N && (window.I18N.current || window.I18N.lang)) {
        return normalizeLang(window.I18N.current || window.I18N.lang);
      }
    } catch (_) {}

    try {
      var dl = document.documentElement.getAttribute('data-lang');
      if (dl) return normalizeLang(dl);
    } catch (_) {}

    try {
      var hl = document.documentElement.getAttribute('lang');
      if (hl) return normalizeLang(hl);
    } catch (_) {}

    try {
      var saved = localStorage.getItem('lang');
      if (saved) return normalizeLang(saved);
    } catch (_) {}

    try {
      var nav = (navigator.language || 'en').toLowerCase();
      if (nav.indexOf('ko') === 0) return 'ko';
      if (nav.indexOf('ja') === 0) return 'ja';
      if (nav.indexOf('zh') === 0 && (nav.indexOf('tw') !== -1 || nav.indexOf('hk') !== -1)) return 'zh-TW';
    } catch (_) {}

    return 'en';
  }

  function langToPath(lang) {
    return lang === 'zh-TW' ? 'zh-tw' : lang;
  }

  function syncHtmlLang(lang) {
    var html = document.documentElement;
    if (!html) return;

    if (lang === 'zh-TW') {
      html.setAttribute('lang', 'zh-Hant');
      html.setAttribute('data-lang', 'zh-TW');
    } else {
      html.setAttribute('lang', lang);
      html.setAttribute('data-lang', lang);
    }
  }

  function buildHref(lang, slug) {
    return '/' + langToPath(lang) + '/guides/' + slug + '.html';
  }

  function getTitle(card, lang) {
    var key = 'data-title-' + (lang === 'zh-TW' ? 'zh-tw' : lang);
    return (
      card.getAttribute(key) ||
      card.getAttribute('data-title-en') ||
      card.getAttribute('data-title-ko') ||
      ''
    );
  }

  function getAllSearchText(card) {
    return [
      card.getAttribute('data-title-ko') || '',
      card.getAttribute('data-title-en') || '',
      card.getAttribute('data-title-ja') || '',
      card.getAttribute('data-title-zh-tw') || '',
      card.getAttribute('data-slug') || '',
      card.getAttribute('data-guide') || ''
    ].join(' ').toLowerCase();
  }

  function setSearchPlaceholder(input, lang) {
    if (!input) return;

    if (lang === 'ko') input.placeholder = '가이드 검색...';
    else if (lang === 'ja') input.placeholder = 'ガイドを検索...';
    else if (lang === 'zh-TW') input.placeholder = '搜尋指南...';
    else input.placeholder = 'Search guides...';
  }

  function setCountText(countEl, shown, total, lang) {
    if (!countEl) return;

    if (lang === 'ko') countEl.textContent = shown + ' / ' + total + '개';
    else if (lang === 'ja') countEl.textContent = shown + ' / ' + total + '件';
    else if (lang === 'zh-TW') countEl.textContent = shown + ' / ' + total + ' 項';
    else countEl.textContent = shown + ' / ' + total;
  }

  function getSlugFromLink(link) {
    if (!link) return '';
    var slug = link.getAttribute('data-guide-slug');
    if (slug) return slug;

    var node = link;
    while (node && node !== document) {
      if (node.getAttribute && node.getAttribute('data-slug')) {
        return node.getAttribute('data-slug') || '';
      }
      node = node.parentNode;
    }
    return '';
  }

  function patchCards(root, lang) {
    var cards = $all('.g-block[data-slug]', root);
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var slug = card.getAttribute('data-slug');
      if (!slug) continue;

      var href = buildHref(lang, slug);
      card.setAttribute('data-href', href);

      var link = $('.g-link', card);
      if (link) {
        link.setAttribute('href', href);
        link.setAttribute('data-guide-slug', slug);
      }
    }
  }

  function buildToc(root, lang) {
    var toc = $('#guide-toc', root);
    if (!toc) return;

    var cards = $all('.g-block[data-toc="true"]', root);
    var html = '';

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var slug = card.getAttribute('data-slug') || '';
      var href = card.getAttribute('data-href') || buildHref(lang, slug);
      var title = getTitle(card, lang);

      html += '<a class="chip" data-router-ignore="true" href="' + href + '" data-guide-slug="' + slug + '">' + escapeHtml(title) + '</a>';
    }

    toc.innerHTML = html;
  }

  function buildReco(root, lang) {
    var recoWrap = $('#guide-reco', root);
    var recoEmpty = $('#guide-reco-empty', root);
    if (!recoWrap || !recoEmpty) return;

    var raw = {};
    try {
      raw = JSON.parse(localStorage.getItem('ks-guide-clicks') || '{}');
    } catch (_) {
      raw = {};
    }

    var arr = [];
    for (var key in raw) {
      if (Object.prototype.hasOwnProperty.call(raw, key)) {
        arr.push({ id: key, count: Number(raw[key] || 0) });
      }
    }

    arr.sort(function (a, b) {
      return b.count - a.count;
    });
    arr = arr.slice(0, 5);

    if (!arr.length) {
      recoWrap.innerHTML = '';
      recoEmpty.style.display = '';
      return;
    }

    recoEmpty.style.display = 'none';

    var html = '';
    for (var i = 0; i < arr.length; i++) {
      var card = findCardByGuideId(root, arr[i].id);
      if (!card) continue;

      var slug = card.getAttribute('data-slug') || '';
      var href = card.getAttribute('data-href') || buildHref(lang, slug);
      var title = getTitle(card, lang);

      html += ''
        + '<a class="guide-chip" data-router-ignore="true" href="' + href + '" data-guide-slug="' + slug + '">'
        +   '<span class="guide-chip-rank">' + (i + 1) + '</span>'
        +   '<span class="guide-chip-label">' + escapeHtml(title) + '</span>'
        + '</a>';
    }

    recoWrap.innerHTML = html;
  }

  function findCardByGuideId(root, guideId) {
    var cards = $all('.g-block[data-guide]', root);
    for (var i = 0; i < cards.length; i++) {
      if ((cards[i].getAttribute('data-guide') || '') === String(guideId || '')) {
        return cards[i];
      }
    }
    return null;
  }

  function patchChipLinks(root, lang) {
    var links = $all('#guide-toc a[data-guide-slug], #guide-reco a[data-guide-slug]', root);
    for (var i = 0; i < links.length; i++) {
      var slug = links[i].getAttribute('data-guide-slug');
      if (!slug) continue;
      links[i].setAttribute('href', buildHref(lang, slug));
    }
  }

  function bindCountClicks(root) {
    var cards = $all('.g-block[data-guide]', root);
    for (var i = 0; i < cards.length; i++) {
      (function (card) {
        var guideId = card.getAttribute('data-guide');
        var link = $('.g-link', card);
        if (!guideId || !link || link.__kdGuideCountBound) return;

        link.__kdGuideCountBound = true;
        link.addEventListener('click', function () {
          try {
            var raw = JSON.parse(localStorage.getItem('ks-guide-clicks') || '{}');
            raw[guideId] = Number(raw[guideId] || 0) + 1;
            localStorage.setItem('ks-guide-clicks', JSON.stringify(raw));
          } catch (_) {}
        });
      })(cards[i]);
    }
  }

  function bindSearch(root) {
    var input = $('#guide-search', root);
    var count = $('#guide-count', root);
    var list = $('#guide-list', root);

    if (!input || !count || !list || input.__kdGuideSearchBound) return;

    function update() {
      var q = String(input.value || '').toLowerCase().trim();
      var lang = detectLang();
      var cards = $all('.g-block', list);
      var shown = 0;

      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var haystack = getAllSearchText(card);
        var visible = !q || haystack.indexOf(q) !== -1;
        card.style.display = visible ? '' : 'none';
        if (visible) shown++;
      }

      setCountText(count, shown, cards.length, lang);
    }

    input.__kdGuideSearchBound = true;
    input.addEventListener('input', update);
    input.__kdGuideSearchUpdate = update;
    update();
  }

  function bindImageFallback(root) {
    var images = $all('.tile-icon img', root);
    for (var i = 0; i < images.length; i++) {
      if (images[i].__kdImgFallbackBound) continue;
      images[i].__kdImgFallbackBound = true;

      images[i].addEventListener('error', function () {
        var wrap = this && this.parentNode;
        if (!wrap) return;
        if ((' ' + wrap.className + ' ').indexOf(' is-fallback ') === -1) {
          wrap.className += ' is-fallback';
        }
      });

      if (images[i].complete && !images[i].naturalWidth) {
        var parent = images[i].parentNode;
        if (parent && (' ' + parent.className + ' ').indexOf(' is-fallback ') === -1) {
          parent.className += ' is-fallback';
        }
      }
    }
  }

  function bindGuideLinks(root) {
    var links = $all('.g-block[data-slug] a.g-link, #guide-toc a[data-guide-slug], #guide-reco a[data-guide-slug]', root);

    for (var i = 0; i < links.length; i++) {
      (function (link) {
        if (link.__guideFinalBound) return;
        link.__guideFinalBound = true;

        function refreshOnly() {
          var slug = getSlugFromLink(link);
          if (!slug) return;
          link.setAttribute('href', buildHref(detectLang(), slug));
        }

        link.addEventListener('pointerdown', refreshOnly, true);
        link.addEventListener('mousedown', refreshOnly, true);
        link.addEventListener('touchstart', refreshOnly, true);
        link.addEventListener('focus', refreshOnly, true);
      })(links[i]);
    }
  }

  function updateUiText(root, lang) {
    var input = $('#guide-search', root);
    var count = $('#guide-count', root);
    var list = $('#guide-list', root);
    setSearchPlaceholder(input, lang);

    if (count && list) {
      var cards = $all('.g-block', list);
      var shown = 0;
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].style.display !== 'none') shown++;
      }
      setCountText(count, shown, cards.length, lang);
    }
  }

  function renderRoot(root) {
    if (!root || !root.isConnected) return;
    var lang = detectLang();

    syncHtmlLang(lang);
    patchCards(root, lang);
    buildToc(root, lang);
    buildReco(root, lang);
    patchChipLinks(root, lang);
    bindCountClicks(root);
    bindSearch(root);
    bindImageFallback(root);
    bindGuideLinks(root);
    updateUiText(root, lang);
  }

  function reinforceGuideLangBeforeRender() {
    var lang = detectLang();

    try {
      if (window.I18N && typeof window.I18N.setLang === 'function') {
        window.I18N.setLang(lang);
      } else if (window.I18N && typeof window.I18N.init === 'function') {
        window.I18N.init({ lang: lang, namespaces: ['common', 'calc'] });
      }
    } catch (_) {}

    try {
      localStorage.setItem('lang', lang);
    } catch (_) {}

    syncHtmlLang(lang);
    return lang;
  }

  function initRoot(root) {
    if (!root || !root.isConnected || hasRoot(root)) return;
    markRoot(root);
    reinforceGuideLangBeforeRender();
    renderRoot(root);
  }

  function initAllRoots() {
    cleanupDeadRoots();
    var roots = $all(ROOT_SELECTOR, document);
    for (var i = 0; i < roots.length; i++) {
      initRoot(roots[i]);
    }
  }

  function rerenderAllRoots() {
    cleanupDeadRoots();
    var roots = $all(ROOT_SELECTOR, document);
    for (var i = 0; i < roots.length; i++) {
      renderRoot(roots[i]);
    }
  }

  function startLangWatcher() {
    if (langWatcherStarted) return;
    langWatcherStarted = true;
    window.__KS_GUIDES_LANG_WATCHER_STARTED__ = true;

    lastLang = detectLang();
    window.__KS_GUIDES_LAST_LANG__ = lastLang;

    setInterval(function () {
      var now = detectLang();
      if (now !== lastLang) {
        lastLang = now;
        window.__KS_GUIDES_LAST_LANG__ = lastLang;
        reinforceGuideLangBeforeRender();
        rerenderAllRoots();
      }
    }, LANG_CHECK_INTERVAL);

    document.addEventListener('i18n:changed', function () {
      lastLang = detectLang();
      window.__KS_GUIDES_LAST_LANG__ = lastLang;
      reinforceGuideLangBeforeRender();
      rerenderAllRoots();
    });
  }

  function startDomObserver() {
    if (domObserverStarted) return;
    domObserverStarted = true;
    window.__KS_GUIDES_DOM_OBSERVER_STARTED__ = true;

    var mo = new MutationObserver(function (mutations) {
      var shouldScan = false;

      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].addedNodes && mutations[i].addedNodes.length) {
          shouldScan = true;
          break;
        }
      }

      if (shouldScan) {
        initAllRoots();
        rerenderAllRoots();
      }
    });

    mo.observe(document.body, { childList: true, subtree: true });
    window.__KS_GUIDES_DOM_OBSERVER__ = mo;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function boot() {
    initAllRoots();
    rerenderAllRoots();
    startLangWatcher();
    startDomObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // SPA 라우터가 수동 호출할 수 있게 전역 노출
  window.KS_GUIDES_INDEX_INIT = boot;
})();
// /js/guide-engine.js
// Kingshot Data — Guide Engine
// 역할:
// 1) 현재 문서의 언어를 안정적으로 판별
// 2) fallback 된 guide 링크를 현재 언어 링크로 강제 교체
// 3) guide 카드 / toc / 추천칩 / data-guide-href 요소를 한 번에 보정
// 4) SPA 환경에서도 클릭 직전 다시 언어 링크로 재보정
(function (window, document) {
  'use strict';

  if (window.KD_GUIDE_ENGINE) return;

  var LANGS = {
    ko: 'ko',
    en: 'en',
    ja: 'ja',
    zhTW: 'zh-TW'
  };

  var PATH_LANG_RE = /^\/(ko|en|ja|zh-tw)(?:\/|$)/i;
  var GUIDE_FILE_RE = /\/(?:ko|en|ja|zh-tw)\/guides\/([^\/?#]+)\.html(?:[?#].*)?$/i;
  var BARE_GUIDE_FILE_RE = /\/guides\/([^\/?#]+)\.html(?:[?#].*)?$/i;

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return (root || document).querySelectorAll(sel);
  }

  function hasClass(el, name) {
    return !!el && (' ' + (el.className || '') + ' ').indexOf(' ' + name + ' ') > -1;
  }

  function addClass(el, name) {
    if (!el || hasClass(el, name)) return;
    el.className = (el.className ? el.className + ' ' : '') + name;
  }

  function normalizeLang(lang) {
    var v = String(lang || '').replace(/_/g, '-').trim().toLowerCase();
    if (!v) return '';

    if (v === 'zh-tw' || v === 'zh-hant') return LANGS.zhTW;
    if (v.indexOf('ko') === 0) return LANGS.ko;
    if (v.indexOf('en') === 0) return LANGS.en;
    if (v.indexOf('ja') === 0) return LANGS.ja;

    return '';
  }

  function sanitizeLang(lang) {
    var v = normalizeLang(lang);
    if (v === LANGS.ko || v === LANGS.en || v === LANGS.ja || v === LANGS.zhTW) return v;
    return '';
  }

  function langToPath(lang) {
    return lang === LANGS.zhTW ? 'zh-tw' : (lang || LANGS.en).toLowerCase();
  }

  function syncDocumentLang(lang) {
    var html = document.documentElement;
    if (!html) return;

    var safe = sanitizeLang(lang) || LANGS.en;

    if (safe === LANGS.zhTW) {
      html.setAttribute('lang', 'zh-Hant');
      html.setAttribute('data-lang', LANGS.zhTW);
      return;
    }

    html.setAttribute('lang', safe);
    html.setAttribute('data-lang', safe);
  }

  function getLangFromPath(pathname) {
    var path = String(pathname || window.location.pathname || '');
    var m = path.match(PATH_LANG_RE);
    return m ? sanitizeLang(m[1]) : '';
  }

  function getLangFromDom() {
    var html = document.documentElement;
    var body = document.body;
    var candidates = [
      html ? html.getAttribute('data-lang') : '',
      html ? html.getAttribute('lang') : '',
      body ? body.getAttribute('data-lang') : '',
      body ? body.getAttribute('lang') : ''
    ];

    var i, lang;
    for (i = 0; i < candidates.length; i++) {
      lang = sanitizeLang(candidates[i]);
      if (lang) return lang;
    }
    return '';
  }

  function getLangFromLinks() {
    var canonical = qs('link[rel="canonical"][href]');
    var og = qs('meta[property="og:url"][content]');
    var href = canonical ? canonical.getAttribute('href') : '';
    var ogUrl = og ? og.getAttribute('content') : '';
    return getLangFromPath(href) || getLangFromPath(ogUrl) || '';
  }

  function getCurrentLang() {
    return (
      getLangFromPath() ||
      getLangFromDom() ||
      getLangFromLinks() ||
      LANGS.en
    );
  }

  function getGuideSlugFromHref(href) {
    var value = String(href || '');
    var m = value.match(GUIDE_FILE_RE);
    if (m && m[1]) return m[1];

    m = value.match(BARE_GUIDE_FILE_RE);
    if (m && m[1]) return m[1];

    return '';
  }

  function getGuideSlug(el) {
    if (!el) return '';

    var slug = el.getAttribute && el.getAttribute('data-slug');
    if (slug) return slug;

    if (el.closest) {
      var card = el.closest('.g-block[data-slug]');
      if (card) {
        slug = card.getAttribute('data-slug');
        if (slug) return slug;
      }
    }

    if (el.getAttribute) {
      slug = el.getAttribute('data-guide-slug');
      if (slug) return slug;
    }

    if (el.href) {
      slug = getGuideSlugFromHref(el.getAttribute('href') || el.href);
      if (slug) return slug;
    }

    return '';
  }

  function buildGuideHref(slug, lang) {
    var safeSlug = String(slug || '').trim();
    var safeLang = sanitizeLang(lang) || getCurrentLang() || LANGS.en;
    if (!safeSlug) return '#';
    return '/' + langToPath(safeLang) + '/guides/' + safeSlug + '.html';
  }

  function setHref(el, href) {
    if (!el || !href) return;
    el.setAttribute('href', href);

    var slug = getGuideSlug(el);
    if (slug) {
      el.setAttribute('data-guide-href', href);
      el.setAttribute('data-guide-slug', slug);
    }

    if (el.closest) {
      var card = el.closest('.g-block[data-slug]');
      if (card) card.setAttribute('data-href', href);
    }
  }

  function patchGuideLink(link, forcedLang) {
    if (!link || !link.getAttribute) return '';

    var slug = getGuideSlug(link);
    if (!slug) return '';

    var href = buildGuideHref(slug, forcedLang || getCurrentLang());
    setHref(link, href);
    return href;
  }

  function patchGuideCard(card, forcedLang) {
    if (!card || !card.getAttribute) return '';

    var slug = card.getAttribute('data-slug');
    if (!slug) return '';

    var link = qs('a.g-link', card);
    var href = buildGuideHref(slug, forcedLang || getCurrentLang());

    card.setAttribute('data-href', href);
    if (link) setHref(link, href);

    return href;
  }

  function patchAllGuideCards(root, forcedLang) {
    var cards = qsa('.g-block[data-slug]', root);
    var i;
    for (i = 0; i < cards.length; i++) {
      patchGuideCard(cards[i], forcedLang);
    }
  }

  function patchLooseGuideLinks(root, forcedLang) {
    var links = qsa('a[data-guide-slug], a[data-guide-href]', root);
    var i;
    for (i = 0; i < links.length; i++) {
      patchGuideLink(links[i], forcedLang);
    }
  }

  function patchToc(root, forcedLang) {
    var tocLinks = qsa('#guide-toc a[href], nav[data-guide-toc] a[href]', root);
    var i;
    for (i = 0; i < tocLinks.length; i++) {
      patchGuideLink(tocLinks[i], forcedLang);
    }
  }

  function patchReco(root, forcedLang) {
    var recoLinks = qsa('#guide-reco a[href], [data-guide-reco] a[href]', root);
    var i;
    for (i = 0; i < recoLinks.length; i++) {
      patchGuideLink(recoLinks[i], forcedLang);
    }
  }

  function patchAll(root, forcedLang) {
    var lang = sanitizeLang(forcedLang) || getCurrentLang() || LANGS.en;

    syncDocumentLang(lang);
    patchAllGuideCards(root, lang);
    patchLooseGuideLinks(root, lang);
    patchToc(root, lang);
    patchReco(root, lang);

    return lang;
  }

  function bindClickGuards(root) {
    var links = qsa('.g-block[data-slug] a.g-link, a[data-guide-slug], a[data-guide-href]', root);
    var i;

    function guard(link) {
      if (!link || link.__kdGuideBound) return;
      link.__kdGuideBound = true;

      function repatch() {
        patchGuideLink(link);
      }

      link.addEventListener('mousedown', repatch);
      link.addEventListener('focus', repatch);
      link.addEventListener('mouseenter', repatch);
      link.addEventListener('touchstart', repatch, { passive: true });
      link.addEventListener('click', repatch);
    }

    for (i = 0; i < links.length; i++) {
      guard(links[i]);
    }
  }

  function bindImageFallback(root) {
    var images = qsa('.tile-icon img', root);
    var i;

    function onError() {
      var wrap = this && this.parentNode;
      if (!wrap) return;
      addClass(wrap, 'is-fallback');
    }

    for (i = 0; i < images.length; i++) {
      if (images[i].__kdImgBound) continue;
      images[i].__kdImgBound = true;
      images[i].addEventListener('error', onError);
      if (images[i].complete && !images[i].naturalWidth) onError.call(images[i]);
    }
  }

  function init(root, forcedLang) {
    patchAll(root, forcedLang);
    bindClickGuards(root);
    bindImageFallback(root);
  }

  function watch(root) {
    if (!window.MutationObserver) return null;

    var target = root || document.body || document.documentElement;
    if (!target) return null;

    var mo = new MutationObserver(function () {
      patchAll(root);
      bindClickGuards(root);
      bindImageFallback(root);
    });

    mo.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'data-slug', 'data-guide-slug', 'data-guide-href', 'lang', 'data-lang']
    });

    return mo;
  }

  window.KD_GUIDE_ENGINE = {
    version: '1.0.0',
    LANGS: LANGS,
    normalizeLang: normalizeLang,
    sanitizeLang: sanitizeLang,
    getLangFromPath: getLangFromPath,
    getLangFromDom: getLangFromDom,
    getLangFromLinks: getLangFromLinks,
    getCurrentLang: getCurrentLang,
    syncDocumentLang: syncDocumentLang,
    getGuideSlugFromHref: getGuideSlugFromHref,
    getGuideSlug: getGuideSlug,
    buildGuideHref: buildGuideHref,
    patchGuideLink: patchGuideLink,
    patchGuideCard: patchGuideCard,
    patchAllGuideCards: patchAllGuideCards,
    patchLooseGuideLinks: patchLooseGuideLinks,
    patchToc: patchToc,
    patchReco: patchReco,
    patchAll: patchAll,
    bindClickGuards: bindClickGuards,
    bindImageFallback: bindImageFallback,
    init: init,
    watch: watch
  };
})(window, document);
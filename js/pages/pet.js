// /js/pages/pet.js
(function () {
  'use strict';

  function normalizeLangCode(code) {
    var s = String(code || '').trim().toLowerCase();
    if (!s) return 'en';

    if (
      s === 'zh-tw' ||
      s === 'zh_tw' ||
      s === 'zhtw' ||
      s === 'tw' ||
      s === 'zh-hant' ||
      s.indexOf('zh-tw') === 0 ||
      s.indexOf('zh_hant') === 0 ||
      s.indexOf('zh-hant') === 0
    ) return 'zh-tw';

    if (s === 'ko' || s.indexOf('ko-') === 0) return 'ko';
    if (s === 'en' || s.indexOf('en-') === 0) return 'en';
    if (s === 'ja' || s.indexOf('ja-') === 0) return 'ja';

    return 'en';
  }

  function getPathInfo(pathname) {
    var clean = String(pathname || location.pathname).split('?')[0].split('#')[0];
    var segs = clean.split('/').filter(Boolean);

    var lang = normalizeLangCode(segs[0] || '');
    var isPet = segs[1] === 'pet';

    if (!isPet) {
      return { lang: lang, mode: 'other', slug: '' };
    }

    if (segs.length <= 2) {
      return { lang: lang, mode: 'list', slug: '' };
    }

    var slug = String(segs[2] || '').trim().toLowerCase().replace(/\.html$/i, '').replace(/\/+$/g, '');
    if (!slug || slug === 'index') {
      return { lang: lang, mode: 'list', slug: '' };
    }

    return { lang: lang, mode: 'detail', slug: slug };
  }

  function bindListLinks(root) {
    root = root || document;

    var anchors = root.querySelectorAll('#pet-page a[href]');
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      if (a.__PET_LINK_BOUND__) continue;
      a.__PET_LINK_BOUND__ = true;

      a.addEventListener('click', function () {
        // 목록은 정적 HTML/CSS 우선
        // SPA 라우터가 있다면 상위 공용 라우터가 처리하게 두고,
        // pet.js는 목록 DOM/CSS를 더 이상 건드리지 않음
      });
    }
  }

  function initPet() {
    var info = getPathInfo(location.pathname);

    if (info.mode === 'list') {
      bindListLinks(document);
      return;
    }

    if (info.mode === 'detail') {
      return;
    }
  }

  window.initPet = initPet;
})();
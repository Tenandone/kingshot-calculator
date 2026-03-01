// /js/pages/buildings.js — LIST ONLY (static detail via /{lang}/buildings/{slug}.html)
// ✅ FIX: 이미지 폴백 체인 유지
// ✅ FIX: 지휘부 slug 통일(command/command-center/commandcenter → commandcenter)
// ✅ FIX: 지휘부 링크를 언어별로 하드코딩(404/혼재 문제 완전 종결)
// ✅ FIX: 카드 제목에서 data-i18n 제거 → i18n 키 노출 100% 차단 (언어 변경 시 재렌더로 해결)
(function () {
  'use strict';

  // ---- i18n safe helpers ----
  function t(key, fallback) {
    if (window.I18N && typeof window.I18N.t === 'function') return window.I18N.t(key, fallback != null ? fallback : key);
    return (fallback != null ? fallback : key);
  }
  function applyI18N(root) {
    if (window.I18N && typeof window.I18N.applyTo === 'function') window.I18N.applyTo(root || document);
  }

  // ---- language folder (URL prefix) ----
  function getLangFolder() {
    var cur = (window.I18N && window.I18N.current) ? String(window.I18N.current) : '';
    cur = cur.replace('_', '-');
    var l = cur.toLowerCase();

    if (l.indexOf('ko') === 0) return 'ko';
    if (l.indexOf('en') === 0) return 'en';
    if (l.indexOf('ja') === 0) return 'ja';
    if (l === 'tw' || l.indexOf('zh-tw') === 0 || l.indexOf('zh-hant') === 0) return 'zh-tw';
    if (l.indexOf('zh') === 0) return 'en';

    var htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    if (htmlLang.indexOf('ko') === 0) return 'ko';
    if (htmlLang.indexOf('en') === 0) return 'en';
    if (htmlLang.indexOf('ja') === 0) return 'ja';
    if (htmlLang.indexOf('zh-tw') === 0) return 'zh-tw';
    return 'en';
  }

  // ---------- ROOT (assets) ----------
  var ROOT = (function () {
    var i = location.pathname.indexOf('/pages/');
    return (i >= 0) ? location.pathname.slice(0, i + 1) : '/';
  })();

  // ---------- data candidates ----------
  var DATA_CANDIDATES = [
    'data/buildings.json',
    ROOT + 'data/buildings.json',
    '/data/buildings.json',
    '../data/buildings.json',
    '../../data/buildings.json'
  ];

  // ---------- utils ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]);
    });
  }
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  function imgUrl(p) {
    if (!p) return ROOT + 'img/placeholder.webp';
    if (/^https?:\/\//i.test(p)) return p;
    if (p.charAt(0) === '/') return p;
    return ROOT + p.replace(/^\.?\//, '');
  }

  function uniq(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      if (!v) continue;
      if (out.indexOf(v) === -1) out.push(v);
    }
    return out;
  }

  // ✅ 이미지 폴백 체인
  function buildImageFallbacks(slug, rawImage) {
    var s = String(slug || '').trim().replace(/\.html$/i, '');
    var sLower = s.toLowerCase();
    var sNoHy = sLower.replace(/-/g, '');
    var list = [];

    if (rawImage) list.push(imgUrl(rawImage));

    list.push('/img/buildings/' + sLower + '.webp');
    list.push('/img/buildings/' + sLower + '-kingshot.webp');
    list.push('/img/buildings/' + sNoHy + '.webp');
    list.push('/img/buildings/' + sNoHy + '-kingshot.webp');

    list.push('/img/buildings/' + sLower + '.png');
    list.push('/img/buildings/' + sLower + '-kingshot.png');
    list.push('/img/buildings/' + sNoHy + '.png');
    list.push('/img/buildings/' + sNoHy + '-kingshot.png');

    list.push(ROOT + 'img/placeholder.webp');
    return uniq(list);
  }

  // ✅ onerror에서 다음 후보로 교체
  function onImgErrorAttr() {
    return "var f=this.getAttribute('data-fallbacks');"
      + "if(!f){return;}"
      + "var a=f.split('||');"
      + "var i=parseInt(this.getAttribute('data-fidx')||'0',10)+1;"
      + "if(i>=a.length){return;}"
      + "this.setAttribute('data-fidx',String(i));"
      + "this.onerror=null;"
      + "this.src=a[i];"
      + "this.onerror=function(){"
      + "var f2=this.getAttribute('data-fallbacks');"
      + "if(!f2){return;}"
      + "var a2=f2.split('||');"
      + "var j=parseInt(this.getAttribute('data-fidx')||'0',10)+1;"
      + "if(j>=a2.length){return;}"
      + "this.setAttribute('data-fidx',String(j));"
      + "this.src=a2[j];"
      + "};";
  }

  // ---------- slug alias (목록 카드용) ----------
  var SLUG_ALIAS = {
    'town-center': 'towncenter',

    // ✅ 지휘부: 뭐가 들어와도 commandcenter로 통일
    'command': 'commandcenter',
    'command-center': 'commandcenter',
    'commandcenter': 'commandcenter',

    'infantry': 'barracks',
    'cavalry': 'stable',
    'archer': 'range'
  };
  function resolveSlug(rawSlug) {
    var k = norm(rawSlug).replace(/\.html$/i, '');
    return SLUG_ALIAS[k] || k;
  }

  // ✅ detail href 생성 (지휘부만 하드코딩)
  function bldHref(slug) {
    var lang = getLangFolder();
    var s = String(slug || '').trim().replace(/\.html$/i, '');

    // ✅ 지휘부는 무조건 이 파일로 간다 (언어별 폴더만 다름)
    if (s === 'commandcenter' || s === 'command-center' || s === 'command') {
      return '/' + lang + '/buildings/commandcenter.html';
    }

    return '/' + lang + '/buildings/' + encodeURIComponent(s) + '.html';
  }

  // 원하는 고정 순서
  var ORDER = [
    'towncenter', 'embassy', 'barracks', 'stable', 'range', 'academy',
    'commandcenter', 'infirmary',
    'truegold-crucible', 'gold-smelter', 'guard-station', 'kitchen', 'storehouse'
  ];
  function orderScore(key) {
    var i = ORDER.indexOf(key);
    return (i < 0) ? 9999 : i;
  }

  // ---------- data cache ----------
  var cache = null;

  function fetchJsonWithFallback(urls) {
    var i = 0;
    function loop() {
      if (i >= urls.length) return Promise.reject(new Error('buildings.json 경로를 찾을 수 없습니다.'));
      var u = urls[i++];
      return fetch(u, { cache: 'no-store' })
        .then(function (r) {
          if (r && r.ok) return r.json();
          return loop();
        })
        .catch(function () { return loop(); });
    }
    return loop();
  }

  function loadData() {
    if (cache) return Promise.resolve(cache);
    return fetchJsonWithFallback(DATA_CANDIDATES).then(function (j) {
      cache = (j && Array.isArray(j.buildings)) ? j.buildings : [];
      return cache;
    });
  }

  // ---------- DOM helpers ----------
  function $grid() { return document.getElementById('buildings-grid'); }
  function $root() { return document.getElementById('building-root'); }

  function showListMode() {
    var g = $grid(), r = $root();
    if (g) g.style.display = 'grid';
    if (r) { r.style.display = 'none'; r.innerHTML = ''; }
  }

  // ✅ card-title에 data-i18n 절대 넣지 않는다 (키 노출 방지)
  function makeCardHTML(href, titleText, imgCandidates, altText) {
    var firstImg = (imgCandidates && imgCandidates.length) ? imgCandidates[0] : (ROOT + 'img/placeholder.webp');
    var fallbacks = (imgCandidates && imgCandidates.length) ? imgCandidates.join('||') : (ROOT + 'img/placeholder.webp');

    return ''
      + '<a class="card" href="' + esc(href) + '">'
      + '  <img src="' + esc(firstImg) + '" alt="' + esc(altText || titleText) + '"'
      + '       data-fallbacks="' + esc(fallbacks) + '" data-fidx="0"'
      + '       onerror="' + onImgErrorAttr() + '">'
      + '  <div class="card-text">'
      + '    <div class="card-title">' + esc(titleText) + '</div>'
      + '  </div>'
      + '</a>';
  }

  function buildCardVM(b) {
    if (!b || b.hidden) return null;

    var baseSlug = resolveSlug(b.slug);

    // 표시 이름
    var titleKey = 'buildings.card.' + norm(baseSlug) + '.title';
    var fallbackName = b.title || b.name || baseSlug;

    // 지휘부 fallback 강제
    if (baseSlug === 'commandcenter') fallbackName = (b.title || b.name || '지휘부');

    var titleText = t(titleKey, fallbackName);
    if (titleText && String(titleText).indexOf('buildings.card.') === 0) titleText = fallbackName;

    var imgCandidates = buildImageFallbacks(baseSlug, b.image);

    return {
      key: baseSlug,
      slug: baseSlug,
      title: titleText,
      imgCandidates: imgCandidates
    };
  }

  function renderBuildingsList() {
    var g = $grid();
    if (!g) return;

    showListMode();

    g.innerHTML = '<div class="loading" style="padding:12px;color:#666" data-i18n="common.loading">'
      + esc(t('common.loading', 'Loading…')) + '</div>';
    applyI18N(g);

    loadData().then(function (list) {
      var vms = [];
      for (var i = 0; i < list.length; i++) {
        var vm = buildCardVM(list[i]);
        if (vm) vms.push(vm);
      }

      vms.sort(function (a, b) {
        var d = orderScore(a.key) - orderScore(b.key);
        if (d) return d;
        return String(a.key).localeCompare(String(b.key));
      });

      g.innerHTML = vms.map(function (vm) {
        return makeCardHTML(
          bldHref(vm.slug),     // ✅ 지휘부만 하드코딩 링크 적용됨
          vm.title,
          vm.imgCandidates,
          vm.title
        );
      }).join('');
      g.style.display = 'grid';

      document.title = t('title.buildingsList', 'Buildings - KingshotData.KR');
      applyI18N(g);
      try { window.scrollTo({ top: 0 }); } catch (_e) {}
    }).catch(function (e) {
      g.innerHTML = ''
        + '<div class="error">'
        + '  <div data-i18n="buildings.listLoadFail">' + esc(t('buildings.listLoadFail', '목록 로드 실패')) + '</div>'
        + '  <div class="muted">' + esc(String(e && e.message ? e.message : e)) + '</div>'
        + '</div>';
      applyI18N(g);
    });
  }

  // ---------- init ----------
  window.initBuildings = function () { renderBuildingsList(); };

  document.addEventListener('i18n:changed', function () {
    renderBuildingsList();
  });

})();
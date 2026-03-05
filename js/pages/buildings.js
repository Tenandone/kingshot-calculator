// /js/pages/buildings.js — LIST ONLY (static detail via /{lang}/buildings/{slug}.html)
// ✅ FIX: 이미지 폴백 체인 유지
// ✅ FIX: 파일명(슬러그) 기준 통일 (town-center / commandcenter / truegold-crucible / war-academy ...)
// ✅ FIX: 카드 제목은 하드코딩 다국어 맵(건물 추가 거의 없음 → 유지보수 안정)
// ✅ FIX: i18n 키가 있어도 사용 가능, 없으면 하드코딩 맵으로 즉시 번역 반영
// ✅ FIX: i18n:changed 타이밍 이슈(새로고침해야 반영) → debounce + next-tick 렌더로 즉시 반영
// ✅ FIX: 언어 변경 시 “즉시” 카드 제목 반영(키 누락/데이터 고정이어도 확실히 바뀜)
console.log('[buildings.js] LOADED v=20260306');
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
    if (l.indexOf('zh') === 0) return 'en'; // cn류는 en fallback

    var htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    if (htmlLang.indexOf('ko') === 0) return 'ko';
    if (htmlLang.indexOf('en') === 0) return 'en';
    if (htmlLang.indexOf('ja') === 0) return 'ja';
    if (htmlLang.indexOf('zh-tw') === 0) return 'zh-tw';
    if (htmlLang.indexOf('tw') === 0) return 'zh-tw';
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

  // ---------- slug alias (데이터 슬러그 → 실제 파일명 슬러그) ----------
  // ✅ “파일명” 기준으로 통일:
  //   town-center.html / commandcenter.html / truegold-crucible.html / war-academy.html ...
  var SLUG_ALIAS = {
    // Town Center
    'towncenter': 'town-center',
    'town-center': 'town-center',

    // Command Center (지휘부)
    'command': 'commandcenter',
    'command-center': 'commandcenter',
    'commandcenter': 'commandcenter',

    // Troop buildings
    'infantry': 'barracks',
    'cavalry': 'stable',
    'archer': 'range',

    // Truegold naming legacy
    'truegoldcrucible': 'truegold-crucible',
    'truegold-crucible': 'truegold-crucible',
    'trugold-crucible': 'truegold-crucible',
    'trugoldcrucible': 'truegold-crucible'
  };

  function resolveSlug(rawSlug) {
    var k = norm(rawSlug).replace(/\.html$/i, '');
    return SLUG_ALIAS[k] || k;
  }

  // ✅ detail href 생성 (슬러그=파일명)
  function bldHref(slug) {
    var lang = getLangFolder();
    var s = String(slug || '').trim().replace(/\.html$/i, '');
    s = resolveSlug(s);
    return '/' + lang + '/buildings/' + encodeURIComponent(s) + '.html';
  }

  // ---------- TITLE HARD MAP (파일명 슬러그 기준) ----------
  var NAME_MAP = {
    'town-center':        { ko:'도시센터', en:'Town Center',        ja:'市庁',        'zh-tw':'市政廳' },
    'academy':            { ko:'아카데미', en:'Academy',            ja:'学院',        'zh-tw':'學院' },
    'embassy':            { ko:'대사관',   en:'Embassy',            ja:'大使館',      'zh-tw':'大使館' },
    'barracks':           { ko:'보병대',   en:'Barracks',           ja:'兵舎',        'zh-tw':'步兵營' },
    'range':              { ko:'궁병대',   en:'Range',              ja:'射撃場',      'zh-tw':'射擊場' },
    'stable':             { ko:'기병대',   en:'Stable',             ja:'馬厩',        'zh-tw':'馬廄' },
    'commandcenter':      { ko:'지휘부',   en:'Command Center',     ja:'指揮部',      'zh-tw':'指揮部' },
    'storehouse':         { ko:'창고',     en:'Storehouse',         ja:'倉庫',        'zh-tw':'倉庫' },
    'kitchen':            { ko:'주방',     en:'Kitchen',            ja:'台所',        'zh-tw':'廚房' },
    'guard-station':      { ko:'방위소',   en:'Guard Station',      ja:'衛兵所',      'zh-tw':'警備站' },
    'truegold-crucible':  { ko:'순금정련소', en:'Truegold Crucible', ja:'真金坩堝',   'zh-tw':'真金熔爐' },
    'war-academy':        { ko:'전쟁 아카데미', en:'War Academy',    ja:'戦争学院',   'zh-tw':'戰爭學院' },
    'infirmary':          { ko:'야전병원', en:'Infirmary',          ja:'野戦病院',    'zh-tw':'野戰醫院' }
  };

  function localizedName(slug, fallback) {
    var key = resolveSlug(slug);
    var lang = getLangFolder(); // 'ko' | 'en' | 'ja' | 'zh-tw'
    var row = NAME_MAP[key];
    if (row) {
      if (lang === 'zh-tw' && row['zh-tw']) return row['zh-tw'];
      if (lang === 'ko' && row.ko) return row.ko;
      if (lang === 'ja' && row.ja) return row.ja;
      if (lang === 'en' && row.en) return row.en;
      return row.en || row.ko || row.ja || row['zh-tw'] || (fallback || key);
    }
    return fallback || key;
  }

  // 원하는 고정 순서(파일명 기준)
  var ORDER = [
    'town-center',
    'academy',
    'embassy',
    'barracks',
    'range',
    'stable',
    'commandcenter',
    'storehouse',
    'kitchen',
    'guard-station',
    'truegold-crucible',
    'war-academy',
    'infirmary'
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

    var slug = resolveSlug(b.slug);
    var baseFallback = b.title || b.name || slug;

    // ✅ 언어별 즉시 변화하는 fallbackName
    var fallbackName = localizedName(slug, baseFallback);

    // ✅ i18n 키가 있으면 우선 사용(없으면 fallbackName)
    var titleKey = 'buildings.card.' + norm(slug) + '.title';
    var titleText = t(titleKey, fallbackName);
    if (titleText && String(titleText).indexOf('buildings.card.') === 0) titleText = fallbackName;

    return {
      key: slug,
      slug: slug,
      title: titleText,
      imgCandidates: buildImageFallbacks(slug, b.image)
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
          bldHref(vm.slug),
          vm.title,
          vm.imgCandidates,
          vm.title
        );
      }).join('');
      g.style.display = 'grid';

      document.title = t('title.buildingsList', 'Buildings - KingshotData');
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

  // =========================
  // ✅ i18n changed timing FIX
  // =========================
  var _t = null;
  function scheduleRender() {
    if (_t) clearTimeout(_t);
    _t = setTimeout(function () {
      try {
        requestAnimationFrame(function () {
          requestAnimationFrame(renderBuildingsList);
        });
      } catch (_e) {
        renderBuildingsList();
      }
    }, 80);
  }

  // ---------- init ----------
  window.initBuildings = function () { renderBuildingsList(); };

  document.addEventListener('i18n:changed', function () {
    scheduleRender();
  });

})();
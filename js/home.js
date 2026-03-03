// /js/pages/home.js — FULL FINAL (Lootbar-style Home)
// 역할:
//  - /home 라우트에서 #content 안에 "스토어형 홈" UI 렌더
//  - 검색(간단), 배너(슬라이드), 카테고리, 최근본항목, 추천섹션
//
// 사용 전제(권장):
//  1) routes.js에서 /home 또는 / 경로 진입 시 KD_HOME.render(document.getElementById('content')) 호출
//  2) CSS는 이 파일이 <style>로 주입(외부 CSS 추가 불필요)
//
// 전역 제공:
//   window.KD_HOME = { render, onRouteLeave }
//
// NOTE:
//  - i18n은 최소한으로 t()만 사용 (없으면 fallback)
//  - 검색 데이터는 우선 "핵심 메뉴"만 로컬로 제공 (나중에 buildings/heroes DB 붙이면 확장)

(function () {
  'use strict';

  // -----------------------------
  // i18n safe helper
  // -----------------------------
  function t(key, fallback) {
    try {
      if (window.I18N && typeof window.I18N.t === 'function') return window.I18N.t(key, fallback != null ? fallback : key);
    } catch (_) {}
    return (fallback != null ? fallback : key);
  }

  // -----------------------------
  // utils
  // -----------------------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizePath(p) {
    if (!p) return '/home';
    if (!p.startsWith('/')) p = '/' + p;
    return p;
  }

  function navTo(path) {
    // routes.js가 data-link로 SPA 네비게이션을 처리하므로
    // a[data-link] 클릭을 유도하거나, history.pushState + popstate 디스패치
    path = normalizePath(path);
    try {
      history.pushState(null, '', path + (location.search || ''));
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (_) {
      location.href = path;
    }
  }

  // -----------------------------
  // Recently Viewed (localStorage)
  // -----------------------------
  var RV_KEY = 'kd_recent_v1';
  function loadRecent() {
    try {
      var raw = localStorage.getItem(RV_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.slice(0, 12);
    } catch (_) { return []; }
  }
  function saveRecent(arr) {
    try { localStorage.setItem(RV_KEY, JSON.stringify(arr.slice(0, 12))); } catch (_) {}
  }

  // 외부 페이지(건물/영웅/가이드)에서 호출해도 되는 헬퍼
  // window.KD_HOME.addRecent({type,title,href,thumb})
  function addRecent(item) {
    try {
      if (!item || !item.href || !item.title) return;
      var arr = loadRecent();
      var href = normalizePath(item.href);
      arr = arr.filter(function (x) { return x && x.href !== href; });
      arr.unshift({
        type: item.type || 'item',
        title: String(item.title).slice(0, 80),
        href: href,
        thumb: item.thumb || ''
      });
      saveRecent(arr);
    } catch (_) {}
  }

  // -----------------------------
  // Home dataset (minimal)
  // 나중에 buildings/heroes JSON 붙이면 여기 확장
  // -----------------------------
  var QUICK = [
    { key:'buildings',  titleKey:'nav.buildings',  title:'Buildings',  desc:'Upgrade tables & unlocks', href:'/buildings',  icon:'🏗️' },
    { key:'heroes',     titleKey:'nav.heroes',     title:'Heroes',     desc:'Skills & tiers',          href:'/heroes',     icon:'🦸' },
    { key:'guides',     titleKey:'nav.guides',     title:'Guides',     desc:'Strategy hub',           href:'/guides',     icon:'📘' },
    { key:'calculator', titleKey:'nav.calculators',title:'Calculator', desc:'Materials & timers',     href:'/calculator', icon:'🧮' },
    { key:'database',   titleKey:'nav.database',   title:'Database',   desc:'Event data',             href:'/database',   icon:'🗂️' }
  ];

  var BANNERS = [
    { title:'Gift Code',   sub:'Latest update',  href:'/guides',      badge:'HOT' },
    { title:'Buildings',   sub:'Upgrade tables', href:'/buildings',   badge:'NEW' },
    { title:'Calculator',  sub:'Normal/TG',      href:'/calculator',  badge:''    },
  ];

  var FEATURED = [
    { title:'Town Center',   href:'/buildings/towncenter',   tag:'Building' },
    { title:'Guard Station', href:'/buildings/guardstation', tag:'Building' },
    { title:'Command Center',href:'/buildings/commandcenter',tag:'Building' },
    { title:'Beginner Tips', href:'/guides',                 tag:'Guide'    },
  ];

  // -----------------------------
  // Slider
  // -----------------------------
  var __sliderTimer = null;
  function startSlider(root) {
    stopSlider();
    if (!root) return;
    var track = root.querySelector('.kd-home__bannerTrack');
    var dots  = root.querySelectorAll('.kd-home__dot');
    if (!track || !dots.length) return;

    var idx = 0;

    function set(i) {
      idx = (i + dots.length) % dots.length;
      track.style.transform = 'translateX(' + (-idx * 100) + '%)';
      dots.forEach(function (d, di) {
        d.setAttribute('aria-current', di === idx ? 'true' : 'false');
      });
    }

    function next(){ set(idx + 1); }

    dots.forEach(function (d, di) {
      d.addEventListener('click', function(){ set(di); });
    });

    // auto
    __sliderTimer = setInterval(next, 4200);

    // pause on hover/touch
    var banner = root.querySelector('.kd-home__banner');
    if (banner) {
      banner.addEventListener('mouseenter', stopSlider);
      banner.addEventListener('mouseleave', function(){ __sliderTimer = setInterval(next, 4200); });
      banner.addEventListener('touchstart', stopSlider, {passive:true});
      banner.addEventListener('touchend', function(){ __sliderTimer = setInterval(next, 4200); }, {passive:true});
    }

    set(0);
  }

  function stopSlider() {
    if (__sliderTimer) { clearInterval(__sliderTimer); __sliderTimer = null; }
  }

  // -----------------------------
  // Search (minimal: QUICK + FEATURED)
  // -----------------------------
  function buildSearchIndex() {
    var items = [];
    QUICK.forEach(function (q) {
      items.push({ title: t(q.titleKey, q.title), href: q.href, kind: 'Category' });
    });
    FEATURED.forEach(function (f) {
      items.push({ title: f.title, href: f.href, kind: f.tag });
    });
    return items;
  }

  function filterSearch(idx, q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return [];
    return idx.filter(function (it) {
      return (it.title || '').toLowerCase().includes(q) || (it.kind || '').toLowerCase().includes(q);
    }).slice(0, 8);
  }

  // -----------------------------
  // Render
  // -----------------------------
  function render(root) {
    if (!root) return;

    var recent = loadRecent();
    var searchIndex = buildSearchIndex();

    root.innerHTML = [
      homeStyle(),
      '<section class="kd-home" aria-label="Home">',
        // Search
        '<div class="kd-home__search">',
          '<div class="kd-home__searchBox">',
            '<span class="kd-home__searchIcon" aria-hidden="true">🔎</span>',
            '<input id="kdHomeSearch" type="search" autocomplete="off" spellcheck="false"',
              ' placeholder="', esc(t('home.search.placeholder', 'Search buildings, heroes, guides, calculators')), '" />',
          '</div>',
          '<div id="kdHomeSuggest" class="kd-home__suggest" hidden></div>',
        '</div>',

        // Banner slider
        '<div class="kd-home__banner" role="region" aria-label="Highlights">',
          '<div class="kd-home__bannerViewport">',
            '<div class="kd-home__bannerTrack">',
              BANNERS.map(function (b) {
                return [
                  '<a class="kd-home__bannerCard" href="', esc(b.href), '" data-link>',
                    (b.badge ? '<span class="kd-home__badge">' + esc(b.badge) + '</span>' : ''),
                    '<div class="kd-home__bannerTitle">', esc(b.title), '</div>',
                    '<div class="kd-home__bannerSub">', esc(b.sub), '</div>',
                    '<div class="kd-home__bannerCta">', esc(t('home.banner.cta', 'Open')), ' →</div>',
                  '</a>'
                ].join('');
              }).join(''),
            '</div>',
          '</div>',
          '<div class="kd-home__dots" role="tablist" aria-label="Banner dots">',
            BANNERS.map(function (_, i) {
              return '<button type="button" class="kd-home__dot" aria-current="' + (i===0?'true':'false') + '" aria-label="Go to slide ' + (i+1) + '"></button>';
            }).join(''),
          '</div>',
        '</div>',

        // Recently viewed
        '<div class="kd-home__section">',
          '<div class="kd-home__sectionHead">',
            '<h2 class="kd-home__h2">', esc(t('home.recent.title', 'Recently Viewed')), '</h2>',
            '<button type="button" class="kd-home__linkBtn" id="kdHomeClearRecent">', esc(t('home.recent.clear', 'Clear')), '</button>',
          '</div>',
          (recent.length
            ? '<div class="kd-home__row">' + recent.slice(0,6).map(recentCard).join('') + '</div>'
            : '<div class="kd-home__empty">' + esc(t('home.recent.empty', 'No recent items yet.')) + '</div>'
          ),
        '</div>',

        // Categories
        '<div class="kd-home__section">',
          '<div class="kd-home__sectionHead">',
            '<h2 class="kd-home__h2">', esc(t('home.quick.title', 'Quick Actions')), '</h2>',
          '</div>',
          '<div class="kd-home__quick">',
            QUICK.map(function (q) {
              return [
                '<a class="kd-home__quickItem" href="', esc(q.href), '" data-link>',
                  '<div class="kd-home__quickIcon" aria-hidden="true">', esc(q.icon), '</div>',
                  '<div class="kd-home__quickText">',
                    '<div class="kd-home__quickTitle">', esc(t(q.titleKey, q.title)), '</div>',
                    '<div class="kd-home__quickDesc">', esc(q.desc), '</div>',
                  '</div>',
                '</a>'
              ].join('');
            }).join(''),
          '</div>',
        '</div>',

        // Featured
        '<div class="kd-home__section">',
          '<div class="kd-home__sectionHead">',
            '<h2 class="kd-home__h2">', esc(t('home.featured.title', 'Featured')), '</h2>',
          '</div>',
          '<div class="kd-home__grid">',
            FEATURED.map(function (f) {
              return [
                '<a class="kd-home__tile" href="', esc(f.href), '" data-link>',
                  '<div class="kd-home__tileTag">', esc(f.tag), '</div>',
                  '<div class="kd-home__tileTitle">', esc(f.title), '</div>',
                  '<div class="kd-home__tileCta">', esc(t('home.open', 'Open')), ' →</div>',
                '</a>'
              ].join('');
            }).join(''),
          '</div>',
        '</div>',

      '</section>'
    ].join('');

    bind(root, searchIndex);
    startSlider(root);
  }

  function recentCard(r) {
    var icon = '🧩';
    if (r.type === 'building') icon = '🏗️';
    if (r.type === 'hero') icon = '🦸';
    if (r.type === 'guide') icon = '📘';
    if (r.type === 'calc') icon = '🧮';

    return [
      '<a class="kd-home__recentCard" href="', esc(r.href), '" data-link>',
        '<div class="kd-home__recentIcon" aria-hidden="true">', esc(icon), '</div>',
        '<div class="kd-home__recentTitle">', esc(r.title), '</div>',
      '</a>'
    ].join('');
  }

  function bind(root, searchIndex) {
    var input = root.querySelector('#kdHomeSearch');
    var suggest = root.querySelector('#kdHomeSuggest');
    var btnClear = root.querySelector('#kdHomeClearRecent');

    function hideSuggest(){
      if (!suggest) return;
      suggest.hidden = true;
      suggest.innerHTML = '';
    }

    function showSuggest(items){
      if (!suggest) return;
      if (!items.length) return hideSuggest();
      suggest.hidden = false;
      suggest.innerHTML = items.map(function (it) {
        return [
          '<a class="kd-home__suggestItem" href="', esc(it.href), '" data-link>',
            '<span class="kd-home__suggestKind">', esc(it.kind), '</span>',
            '<span class="kd-home__suggestTitle">', esc(it.title), '</span>',
          '</a>'
        ].join('');
      }).join('');
    }

    if (input) {
      input.addEventListener('input', function () {
        var q = input.value;
        showSuggest(filterSearch(searchIndex, q));
      });
      input.addEventListener('focus', function () {
        showSuggest(filterSearch(searchIndex, input.value));
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          input.blur();
          hideSuggest();
        }
        if (e.key === 'Enter') {
          var items = filterSearch(searchIndex, input.value);
          if (items[0]) navTo(items[0].href);
        }
      });

      document.addEventListener('click', function (e) {
        if (!root.contains(e.target)) hideSuggest();
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', function () {
        saveRecent([]);
        render(root); // rerender
      });
    }

    // suggestion clicks should close box (optional)
    if (suggest) {
      suggest.addEventListener('click', function () {
        hideSuggest();
      });
    }
  }

  function homeStyle() {
    return [
      '<style>',
      '  .kd-home{ max-width:980px; margin:0 auto; padding:14px 0 30px; }',
      '  .kd-home__search{ position:relative; margin:6px 0 14px; }',
      '  .kd-home__searchBox{ display:flex; align-items:center; gap:10px; border:1px solid #e5e7eb; background:#fff; border-radius:14px; padding:12px 12px; }',
      '  .kd-home__searchIcon{ font-size:16px; opacity:.8; }',
      '  .kd-home__searchBox input{ border:0; outline:0; width:100%; font-size:14px; }',
      '  .kd-home__suggest{ position:absolute; left:0; right:0; top:54px; background:#fff; border:1px solid #e5e7eb; border-radius:14px; box-shadow:0 10px 30px rgba(0,0,0,.08); overflow:hidden; z-index:30; }',
      '  .kd-home__suggestItem{ display:flex; gap:10px; padding:10px 12px; text-decoration:none; color:#111827; border-top:1px solid #f1f5f9; }',
      '  .kd-home__suggestItem:first-child{ border-top:0; }',
      '  .kd-home__suggestItem:hover{ background:#f8fafc; }',
      '  .kd-home__suggestKind{ font-size:12px; color:#6b7280; min-width:72px; }',
      '  .kd-home__suggestTitle{ font-size:13px; font-weight:700; }',

      '  .kd-home__banner{ border-radius:18px; overflow:hidden; border:1px solid #e5e7eb; background:linear-gradient(135deg,#0b57d0 0%, #111827 70%); color:#fff; }',
      '  .kd-home__bannerViewport{ overflow:hidden; }',
      '  .kd-home__bannerTrack{ display:flex; width:100%; transform:translateX(0); transition:transform .35s ease; }',
      '  .kd-home__bannerCard{ position:relative; flex:0 0 100%; padding:18px 16px 16px; text-decoration:none; color:#fff; min-height:120px; }',
      '  .kd-home__badge{ position:absolute; top:12px; right:12px; background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.22); padding:6px 10px; border-radius:999px; font-size:12px; font-weight:900; }',
      '  .kd-home__bannerTitle{ font-size:18px; font-weight:950; letter-spacing:.2px; }',
      '  .kd-home__bannerSub{ margin-top:6px; font-size:13px; opacity:.9; }',
      '  .kd-home__bannerCta{ margin-top:14px; display:inline-block; font-size:13px; font-weight:900; opacity:.95; }',
      '  .kd-home__dots{ display:flex; justify-content:center; gap:8px; padding:10px 0 12px; background:rgba(0,0,0,.10); }',
      '  .kd-home__dot{ width:8px; height:8px; border-radius:999px; border:0; background:rgba(255,255,255,.35); cursor:pointer; }',
      '  .kd-home__dot[aria-current="true"]{ background:rgba(255,255,255,.92); }',

      '  .kd-home__section{ margin-top:18px; }',
      '  .kd-home__sectionHead{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin:0 2px 10px; }',
      '  .kd-home__h2{ font-size:14px; margin:0; color:#111827; letter-spacing:.1px; }',
      '  .kd-home__linkBtn{ border:0; background:none; color:#6b7280; cursor:pointer; font-size:12px; padding:6px 8px; }',
      '  .kd-home__linkBtn:hover{ color:#111827; }',

      '  .kd-home__row{ display:flex; gap:10px; overflow:auto; padding-bottom:4px; }',
      '  .kd-home__recentCard{ flex:0 0 auto; width:160px; border:1px solid #e5e7eb; background:#fff; border-radius:14px; padding:10px; text-decoration:none; color:#111827; }',
      '  .kd-home__recentCard:hover{ background:#f8fafc; }',
      '  .kd-home__recentIcon{ font-size:18px; }',
      '  .kd-home__recentTitle{ margin-top:8px; font-size:13px; font-weight:800; line-height:1.2; }',
      '  .kd-home__empty{ border:1px dashed #e5e7eb; border-radius:14px; padding:14px; color:#6b7280; font-size:13px; background:#fff; }',

      '  .kd-home__quick{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }',
      '  .kd-home__quickItem{ display:flex; gap:10px; align-items:center; border:1px solid #e5e7eb; background:#fff; border-radius:16px; padding:12px; text-decoration:none; color:#111827; }',
      '  .kd-home__quickItem:hover{ background:#f8fafc; }',
      '  .kd-home__quickIcon{ width:36px; height:36px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:#f1f5f9; font-size:18px; }',
      '  .kd-home__quickTitle{ font-size:13px; font-weight:950; }',
      '  .kd-home__quickDesc{ margin-top:3px; font-size:12px; color:#6b7280; }',

      '  .kd-home__grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }',
      '  .kd-home__tile{ border:1px solid #e5e7eb; background:#fff; border-radius:16px; padding:12px; text-decoration:none; color:#111827; }',
      '  .kd-home__tile:hover{ background:#f8fafc; }',
      '  .kd-home__tileTag{ display:inline-flex; align-items:center; padding:5px 8px; border-radius:999px; font-size:11px; font-weight:900; color:#6b7280; border:1px solid #e5e7eb; }',
      '  .kd-home__tileTitle{ margin-top:10px; font-size:14px; font-weight:950; }',
      '  .kd-home__tileCta{ margin-top:10px; font-size:12px; color:#0b57d0; font-weight:900; }',

      '  @media (min-width: 860px){',
      '    .kd-home__quick{ grid-template-columns:repeat(3,minmax(0,1fr)); }',
      '    .kd-home__grid{ grid-template-columns:repeat(4,minmax(0,1fr)); }',
      '  }',
      '</style>'
    ].join('');
  }

  // -----------------------------
  // Public API
  // -----------------------------
  window.KD_HOME = {
    render: render,
    onRouteLeave: function () {
      stopSlider();
    },
    addRecent: addRecent
  };
})();
// /js/building-detail.js — AUTO (Single + Dual tables + Timeline + Tabs)
// FULL FINAL + GUARD + ICON-AWARE COLUMNS + SAFE RE-RUN + SHADOWROOT SCOPE
// ✅ GUARD: prevents double auto-run (inline + external, or multiple loads)
// ✅ SAFE RE-RUN: window.KD_BUILDING_DETAIL_INIT(scope?) can be called repeatedly (SPA mount) without duplicate listeners
// ✅ SCOPE SUPPORT: works when building HTML is mounted inside Shadow DOM (root.shadowRoot)
// ✅ Better column detection: header text + header icon src (prevents “data missing”)
// ✅ Hard safety:
//    - Runs ONLY on building detail pages (req/tg/timeline table 존재 시에만)
//    - Adds html.js / observers ONLY on detail pages (다른 페이지 CSS/레이아웃 영향 방지)
// ✅ Sticky top selectors fallback (header.top/nav.section-tabs 없을 때도 동작)
// ✅ Keeps your current behavior otherwise (no breaking changes)
// ✅ Supports:
//    - Single table pages: req-table -> req-cards
//    - Dual table pages: req-table -> req-cards, tg-table -> tg-cards
//    - Timeline: timeline-table -> timeline-cards
//    - Tabs: tab-normal/tab-tg + panel-normal/panel-tg (optional)

(function () {
  'use strict';

  // ---------- GUARD ----------
  // Skip entirely if you set this before loading:
  // window.__KD_SKIP_BUILDING_DETAIL__ = true;
  if (window.__KD_SKIP_BUILDING_DETAIL__ === true) return;

  // -----------------------------
  // Scope helpers (ShadowRoot-safe)
  // -----------------------------
  function resolveScope(input) {
    if (!input) return document;
    // If a host element is passed, prefer its shadowRoot
    if (input.shadowRoot) return input.shadowRoot;
    return input; // could be document or ShadowRoot or Element
  }
  function q(scope, sel) {
    scope = resolveScope(scope);
    return scope.querySelector ? scope.querySelector(sel) : null;
  }
  function qa(scope, sel) {
    scope = resolveScope(scope);
    return scope.querySelectorAll ? Array.from(scope.querySelectorAll(sel)) : [];
  }
  function byId(scope, id) {
    return q(scope, '#' + id);
  }

  // ---------- Page guard (detail only) ----------
  function isDetailPage(scope) {
    return !!(byId(scope, 'req-table') || byId(scope, 'tg-table') || byId(scope, 'timeline-table'));
  }

  // If not detail page in document, do nothing (prevents css/layout side-effects in list/home pages)
  if (!isDetailPage(document)) {
    // Still expose callable init for SPA (ShadowRoot mount may happen after this file loads)
    window.KD_BUILDING_DETAIL_INIT = function (scope) {
      scope = resolveScope(scope);
      if (!isDetailPage(scope)) return;

      // mark JS mode globally (CSS toggles depend on html class)
      try { document.documentElement.classList.add('js'); } catch (_) {}
      try { init(scope); } catch (_) {}
    };
    return;
  }

  // Only now we mark JS mode
  document.documentElement.classList.add('js');

  // Keep media query
  var mqMobile = window.matchMedia('(max-width: 900px)');

  // -----------------------------
  // Sticky offsets
  // -----------------------------
  function setStickyTop() {
    // NOTE: header/tabs are outside shadow in SPA most of the time → always search in document
    var header = document.querySelector('header.top') || document.querySelector('.site-header') || document.querySelector('header');
    var tabs =
      document.querySelector('nav.section-tabs') ||
      document.querySelector('.variant-tabs') ||
      document.querySelector('nav.section-tabs, .section-tabs, nav[role="tablist"]');

    var isMobile = mqMobile.matches;

    var hh = (isMobile && header) ? header.getBoundingClientRect().height : 0;
    var th = (isMobile && tabs) ? tabs.getBoundingClientRect().height : 0;

    document.documentElement.style.setProperty('--header-h', Math.round(hh) + 'px');
    document.documentElement.style.setProperty('--tabs-h', Math.round(th) + 'px');
    document.documentElement.style.setProperty('--sticky-top', Math.round(hh + th) + 'px');
  }

  // -----------------------------
  // Helpers
  // -----------------------------
  function isDash(v) {
    if (v == null) return true;
    var t = String(v).trim();
    return t === '–' || t === '-' || t === '';
  }

  function parseNum(s) {
    var t = String(s || '').trim();
    if (isDash(t)) return null;
    // already formatted (1.2M / 5k / 1.8k)
    if (/[kmb]$/i.test(t)) return null;
    t = t.replace(/,/g, '');
    var n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  function fmtKMB(n) {
    if (n === null) return null;
    if (n < 1000) return String(n);

    var v, suf;
    if (n >= 1e9) { v = n / 1e9; suf = 'B'; }
    else if (n >= 1e6) { v = n / 1e6; suf = 'M'; }
    else { v = n / 1e3; suf = 'k'; }

    var out;
    if (v >= 100 || Number.isInteger(v)) out = v.toFixed(0);
    else out = (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '');

    return out + suf;
  }

  function getLangLabels() {
    var lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    if (lang.startsWith('ko')) return {
      lvl: '레벨', req: '요구 조건', tc: '도시센터', time: '시간',
      bread: '빵', wood: '나무', stone: '석재', iron: '철',
      truegold: '순금', tempered: '정련'
    };
    if (lang.startsWith('ja')) return {
      lvl: 'レベル', req: '要件', tc: '都市センター', time: '時間',
      bread: '食料', wood: '木材', stone: '石材', iron: '鉄',
      truegold: 'トゥルーゴールド', tempered: '鍛錬'
    };
    if (lang.includes('zh')) return {
      lvl: '等級', req: '需求', tc: '市政廳', time: '時間',
      bread: '食物', wood: '木材', stone: '石材', iron: '鐵',
      truegold: '真金', tempered: '鍛造'
    };
    return {
      lvl: 'Level', req: 'Requirements', tc: 'Town Center', time: 'Time',
      bread: 'Bread', wood: 'Wood', stone: 'Stone', iron: 'Iron',
      truegold: 'Truegold', tempered: 'Tempered'
    };
  }

  // -----------------------------
  // Icons (for header detection + card icons)
  // -----------------------------
  var ICON = {
    bread: '/img/bread.webp',
    wood: '/img/wood.webp',
    stone: '/img/stone.webp',
    iron: '/img/iron.webp',
    truegold: '/img/truegold.webp',
    tempered: '/img/tempered-truegold.webp'
  };

  // -----------------------------
  // Column detection (TEXT + ICON)
  // -----------------------------
  function findColIndexByHeader(table, keywords, iconHints) {
    var ths = Array.from(table.querySelectorAll('thead th'));
    for (var i = 0; i < ths.length; i++) {
      var th = ths[i];

      // 1) text match
      var t = (th.textContent || '').trim().toLowerCase();
      for (var k = 0; k < keywords.length; k++) {
        if (t.includes(keywords[k])) return i;
      }

      // 2) icon src match
      if (iconHints && iconHints.length) {
        var imgs = th.querySelectorAll('img');
        for (var m = 0; m < imgs.length; m++) {
          var src = (imgs[m].getAttribute('src') || '').toLowerCase();
          for (var h = 0; h < iconHints.length; h++) {
            if (src.includes(iconHints[h])) return i;
          }
        }
      }
    }
    return -1;
  }

  // Apply K/M/B formatting to numeric cells by column indices
  function formatColsKMB(table, colIdxs) {
    var rows = table.querySelectorAll('tbody tr');
    rows.forEach(function (tr) {
      var tds = tr.querySelectorAll('td');
      colIdxs.forEach(function (idx) {
        var td = tds[idx];
        if (!td) return;

        var raw = (td.textContent || '').trim();
        if (isDash(raw)) return;

        // preserve raw once
        if (!td.dataset.raw) td.dataset.raw = raw;

        var n = parseNum(raw);
        if (n === null) return;

        var shortVal = fmtKMB(n);
        if (shortVal) td.textContent = shortVal;
      });
    });
  }

  // -----------------------------
  // Card rendering helpers
  // -----------------------------
  function imgIcon(src) {
    return '<img class="icoimg" src="' + src + '" alt="" aria-hidden="true" width="18" height="18" loading="lazy" decoding="async">';
  }

  function makeResItem(src, label, value, rawTitle) {
    var titleAttr = rawTitle ? (' title="원본: ' + String(rawTitle).replace(/"/g, '&quot;') + '"') : '';
    return (
      '<div class="res-item"' + titleAttr + '>' +
        '<div class="res-left">' +
          imgIcon(src) +
          '<div class="res-label">' + label + '</div>' +
        '</div>' +
        '<div class="res-val">' + value + '</div>' +
      '</div>'
    );
  }

  function svgUse(id) {
    return '<svg aria-hidden="true" viewBox="0 0 24 24"><use href="#' + id + '"></use></svg>';
  }

  // -----------------------------
  // Timeline cards
  // -----------------------------
  function buildTimelineCards(scope) {
    var table = byId(scope, 'timeline-table');
    var target = byId(scope, 'timeline-cards');
    if (!table || !target) return 0;

    var rows = table.querySelectorAll('tbody tr');
    if (!rows.length) return 0;

    var html = '';
    var count = 0;

    rows.forEach(function (tr) {
      var tds = tr.querySelectorAll('td');
      if (tds.length < 3) return;

      var milestone = tds[0].innerHTML.trim();
      var age = tds[1].textContent.trim();
      var meaning = tds[2].innerHTML.trim();

      html += (
        '<article class="card">' +
          '<div class="card-head">' +
            '<h3 class="card-title">' + milestone + '</h3>' +
            '<div class="card-meta">' + (isDash(age) ? '' : ('Server Age<br><strong>' + age + '</strong>')) + '</div>' +
          '</div>' +
          '<div class="card-req" style="margin:0"><strong>What it means:</strong> ' + meaning + '</div>' +
        '</article>'
      );
      count++;
    });

    target.innerHTML = html;
    return count;
  }

  // -----------------------------
  // Requirements cards (Normal)
  // -----------------------------
  function buildReqCards(scope) {
    var L = getLangLabels();
    var table = byId(scope, 'req-table');
    var target = byId(scope, 'req-cards');
    if (!table || !target) return 0;

    var idxLevel = 0;

    var idxReq = findColIndexByHeader(table, ['requirements','요구','要件','需求'], []);
    if (idxReq < 0) idxReq = 1;

    var idxWood  = findColIndexByHeader(table, ['wood','나무','木材','木'], ['wood.webp','/wood.']);
    var idxBread = findColIndexByHeader(table, ['bread','빵','食物','食料'], ['bread.webp','/bread.']);
    var idxStone = findColIndexByHeader(table, ['stone','석재','石材','石'], ['stone.webp','/stone.']);
    var idxIron  = findColIndexByHeader(table, ['iron','철','鉄','鐵'], ['iron.webp','/iron.']);

    var idxTime  = findColIndexByHeader(table, ['time','시간','時間'], []);
    var idxPower = findColIndexByHeader(table, ['power','전투력','戰力'], []);
    var idxMaxHero = findColIndexByHeader(table, ['max hero','최대','最大','上限'], []);

    // fallback
    if (idxWood < 0)  idxWood = 2;
    if (idxBread < 0) idxBread = 3;
    if (idxStone < 0) idxStone = 4;
    if (idxIron < 0)  idxIron = 5;
    if (idxTime < 0)  idxTime = 6;

    formatColsKMB(table, [idxWood, idxBread, idxStone, idxIron]);

    var rows = table.querySelectorAll('tbody tr');
    if (!rows.length) return 0;

    var html = '';
    var count = 0;

    rows.forEach(function (tr) {
      var tds = tr.querySelectorAll('td');
      if (tds.length < Math.max(idxIron, idxTime) + 1) return;

      var level = (tds[idxLevel] && tds[idxLevel].textContent.trim()) || '';
      var reqHTML = (tds[idxReq] && tds[idxReq].innerHTML.trim()) || '';

      var wood  = (tds[idxWood] && tds[idxWood].textContent.trim()) || '–';
      var bread = (tds[idxBread] && tds[idxBread].textContent.trim()) || '–';
      var stone = (tds[idxStone] && tds[idxStone].textContent.trim()) || '–';
      var iron  = (tds[idxIron] && tds[idxIron].textContent.trim()) || '–';
      var time  = (tds[idxTime] && tds[idxTime].textContent.trim()) || '–';

      // raw titles (safe)
      var rawWood  = (tds[idxWood] && (tds[idxWood].dataset.raw || tds[idxWood].textContent.trim())) || '';
      var rawBread = (tds[idxBread] && (tds[idxBread].dataset.raw || tds[idxBread].textContent.trim())) || '';
      var rawStone = (tds[idxStone] && (tds[idxStone].dataset.raw || tds[idxStone].textContent.trim())) || '';
      var rawIron  = (tds[idxIron] && (tds[idxIron].dataset.raw || tds[idxIron].textContent.trim())) || '';

      var res = '';
      if (!isDash(wood))  res += makeResItem(ICON.wood,  L.wood,  wood,  rawWood);
      if (!isDash(bread)) res += makeResItem(ICON.bread, L.bread, bread, rawBread);
      if (!isDash(stone)) res += makeResItem(ICON.stone, L.stone, stone, rawStone);
      if (!isDash(iron))  res += makeResItem(ICON.iron,  L.iron,  iron,  rawIron);

      var foot = '';
      if (!isDash(time)) foot += '<span class="badge">' + svgUse('ico-time') + '<span>' + L.time + ': ' + time + '</span></span>';

      if (idxPower >= 0 && tds[idxPower] && !isDash(tds[idxPower].textContent)) {
        foot += '<span class="badge">' + svgUse('ico-power') + '<span>Power: ' + tds[idxPower].textContent.trim() + '</span></span>';
      }
      if (idxMaxHero >= 0 && tds[idxMaxHero] && !isDash(tds[idxMaxHero].textContent)) {
        foot += '<span class="badge"><span>Max Hero: ' + tds[idxMaxHero].textContent.trim() + '</span></span>';
      }

      html += (
        '<article class="card">' +
          '<div class="card-head">' +
            '<h3 class="card-title">' + L.lvl + ' ' + level + '</h3>' +
            '<div class="card-meta">' + (isDash(time) ? '' : (L.time + '<br><strong>' + time + '</strong>')) + '</div>' +
          '</div>' +
          (reqHTML ? ('<div class="card-req"><strong>' + L.req + ':</strong> ' + reqHTML + '</div>') : '') +
          (res ? ('<div class="res-grid" aria-label="Resources">' + res + '</div>') : '') +
          (foot ? ('<div class="card-foot">' + foot + '</div>') : '') +
        '</article>'
      );
      count++;
    });

    target.innerHTML = html;
    return count;
  }

  // -----------------------------
  // Truegold cards
  // -----------------------------
  function buildTGCards(scope) {
    var L = getLangLabels();
    var table = byId(scope, 'tg-table');
    var target = byId(scope, 'tg-cards');
    if (!table || !target) return 0;

    var idxLevel = 0;

    var idxReq = findColIndexByHeader(table, ['requirements','요구','要件','需求'], []);
    if (idxReq < 0) idxReq = 1;

    var idxTruegold = findColIndexByHeader(table, ['truegold','순금','真金','トゥルーゴールド'], ['truegold.webp','/truegold.']);
    var idxTempered = findColIndexByHeader(table, ['tempered','정련','鍛造','鍛錬'], ['tempered-truegold','tempered']);

    var idxWood  = findColIndexByHeader(table, ['wood','나무','木材','木'], ['wood.webp','/wood.']);
    var idxBread = findColIndexByHeader(table, ['bread','빵','食物','食料'], ['bread.webp','/bread.']);
    var idxStone = findColIndexByHeader(table, ['stone','석재','石材','石'], ['stone.webp','/stone.']);
    var idxIron  = findColIndexByHeader(table, ['iron','철','鉄','鐵'], ['iron.webp','/iron.']);

    var idxTime  = findColIndexByHeader(table, ['time','시간','時間'], []);
    var idxPower = findColIndexByHeader(table, ['power','전투력','戰力'], []);

    // fallback
    if (idxTruegold < 0) idxTruegold = 2;
    if (idxTempered < 0) idxTempered = 3;
    if (idxWood < 0) idxWood = 4;
    if (idxBread < 0) idxBread = 5;
    if (idxStone < 0) idxStone = 6;
    if (idxIron < 0) idxIron = 7;
    if (idxTime < 0) idxTime = 8;

    formatColsKMB(table, [idxTruegold, idxTempered, idxWood, idxBread, idxStone, idxIron]);

    var rows = table.querySelectorAll('tbody tr');
    if (!rows.length) return 0;

    var html = '';
    var count = 0;

    rows.forEach(function (tr) {
      var tds = tr.querySelectorAll('td');
      if (tds.length < Math.max(idxIron, idxTime) + 1) return;

      var lv = (tds[idxLevel] && tds[idxLevel].textContent.trim()) || '';
      var reqHTML = (tds[idxReq] && tds[idxReq].innerHTML.trim()) || '';

      var tg = (tds[idxTruegold] && tds[idxTruegold].textContent.trim()) || '–';
      var tp = (tds[idxTempered] && tds[idxTempered].textContent.trim()) || '–';
      var wood  = (tds[idxWood] && tds[idxWood].textContent.trim()) || '–';
      var bread = (tds[idxBread] && tds[idxBread].textContent.trim()) || '–';
      var stone = (tds[idxStone] && tds[idxStone].textContent.trim()) || '–';
      var iron  = (tds[idxIron] && tds[idxIron].textContent.trim()) || '–';
      var time  = (tds[idxTime] && tds[idxTime].textContent.trim()) || '–';

      // raw titles (safe)
      var rawTG    = (tds[idxTruegold] && (tds[idxTruegold].dataset.raw || tds[idxTruegold].textContent.trim())) || '';
      var rawTP    = (tds[idxTempered] && (tds[idxTempered].dataset.raw || tds[idxTempered].textContent.trim())) || '';
      var rawWood  = (tds[idxWood] && (tds[idxWood].dataset.raw || tds[idxWood].textContent.trim())) || '';
      var rawBread = (tds[idxBread] && (tds[idxBread].dataset.raw || tds[idxBread].textContent.trim())) || '';
      var rawStone = (tds[idxStone] && (tds[idxStone].dataset.raw || tds[idxStone].textContent.trim())) || '';
      var rawIron  = (tds[idxIron] && (tds[idxIron].dataset.raw || tds[idxIron].textContent.trim())) || '';

      var res = '';
      if (!isDash(tg))    res += makeResItem(ICON.truegold, L.truegold, tg, rawTG);
      if (!isDash(tp))    res += makeResItem(ICON.tempered, L.tempered, tp, rawTP);
      if (!isDash(wood))  res += makeResItem(ICON.wood, L.wood, wood, rawWood);
      if (!isDash(bread)) res += makeResItem(ICON.bread, L.bread, bread, rawBread);
      if (!isDash(stone)) res += makeResItem(ICON.stone, L.stone, stone, rawStone);
      if (!isDash(iron))  res += makeResItem(ICON.iron, L.iron, iron, rawIron);

      var foot = '';
      if (!isDash(time)) foot += '<span class="badge">' + svgUse('ico-time') + '<span>' + L.time + ': ' + time + '</span></span>';
      if (idxPower >= 0 && tds[idxPower] && !isDash(tds[idxPower].textContent)) {
        foot += '<span class="badge">' + svgUse('ico-power') + '<span>Power: ' + tds[idxPower].textContent.trim() + '</span></span>';
      }

      html += (
        '<article class="card">' +
          '<div class="card-head">' +
            '<h3 class="card-title">' + lv + '</h3>' +
            '<div class="card-meta">' + (isDash(time) ? '' : (L.time + '<br><strong>' + time + '</strong>')) + '</div>' +
          '</div>' +
          (reqHTML ? ('<div class="card-req"><strong>' + L.req + ':</strong> ' + reqHTML + '</div>') : '') +
          (res ? ('<div class="res-grid" aria-label="Resources">' + res + '</div>') : '') +
          (foot ? ('<div class="card-foot">' + foot + '</div>') : '') +
        '</article>'
      );
      count++;
    });

    target.innerHTML = html;
    return count;
  }

  // -----------------------------
  // Tabs (optional) — no duplicate listeners
  // -----------------------------
  function initTabs(scope) {
    var tabNormal = byId(scope, 'tab-normal');
    var tabTG = byId(scope, 'tab-tg');
    var panelNormal = byId(scope, 'panel-normal');
    var panelTG = byId(scope, 'panel-tg');
    if (!tabNormal || !tabTG || !panelNormal || !panelTG) return;

    // already wired
    if (tabNormal.dataset.kdWired === '1') return;
    tabNormal.dataset.kdWired = '1';

    function setActive(which, updateHash) {
      var isNormal = which === 'normal';

      tabNormal.setAttribute('aria-selected', isNormal ? 'true' : 'false');
      tabTG.setAttribute('aria-selected', isNormal ? 'false' : 'true');

      panelNormal.classList.toggle('is-active', isNormal);
      panelTG.classList.toggle('is-active', !isNormal);

      if (updateHash) {
        var id = isNormal ? 'requirements' : 'truegold';
        if (history && history.replaceState) history.replaceState(null, '', '#' + id);
        else location.hash = '#' + id;
      }
    }

    tabNormal.addEventListener('click', function () {
      setActive('normal', true);
      var el = byId(scope, 'requirements') || byId(scope, 'upgrade') || q(scope, '#requirements');
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    tabTG.addEventListener('click', function () {
      setActive('tg', true);
      var el = byId(scope, 'truegold') || q(scope, '#truegold');
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // NOTE: these anchors are usually in the mounted HTML (inside scope), but can also be outside.
    var aReq = q(scope, 'a[href="#requirements"]') || document.querySelector('a[href="#requirements"]');
    var aTg = q(scope, 'a[href="#truegold"]') || document.querySelector('a[href="#truegold"]');

    if (aReq && aReq.dataset.kdWired !== '1') {
      aReq.dataset.kdWired = '1';
      aReq.addEventListener('click', function (e) {
        if (document.documentElement.classList.contains('js')) {
          e.preventDefault();
          setActive('normal', true);
          var el2 = byId(scope, 'requirements') || q(scope, '#requirements');
          if (el2 && el2.scrollIntoView) el2.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
    if (aTg && aTg.dataset.kdWired !== '1') {
      aTg.dataset.kdWired = '1';
      aTg.addEventListener('click', function (e) {
        if (document.documentElement.classList.contains('js')) {
          e.preventDefault();
          setActive('tg', true);
          var el3 = byId(scope, 'truegold') || q(scope, '#truegold');
          if (el3 && el3.scrollIntoView) el3.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    var h = (location.hash || '').toLowerCase();
    if (h === '#truegold') setActive('tg', false);
    else setActive('normal', false);
  }

  // -----------------------------
  // Init
  // -----------------------------
  function initStickyObservers() {
    setStickyTop();
    requestAnimationFrame(setStickyTop);
    setTimeout(setStickyTop, 60);

    if (mqMobile && mqMobile.addEventListener) mqMobile.addEventListener('change', setStickyTop);
    else if (mqMobile && mqMobile.addListener) mqMobile.addListener(setStickyTop);

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { setStickyTop(); });
      var header = document.querySelector('header.top') || document.querySelector('.site-header') || document.querySelector('header');
      var tabs =
        document.querySelector('nav.section-tabs') ||
        document.querySelector('.variant-tabs') ||
        document.querySelector('nav.section-tabs, .section-tabs, nav[role="tablist"]');
      if (header) ro.observe(header);
      if (tabs) ro.observe(tabs);
    }

    window.addEventListener('load', setStickyTop);
    window.addEventListener('resize', setStickyTop);
  }

  function init(scope) {
    scope = resolveScope(scope);

    // Re-check (SPA에서 mount 타이밍 변동 대비)
    if (!isDetailPage(scope)) return;

    initStickyObservers();

    var c0 = buildTimelineCards(scope);
    var c1 = buildReqCards(scope);
    var c2 = buildTGCards(scope);

    if ((c0 + c1 + c2) > 0) {
      document.documentElement.classList.add('enhanced');
    }

    initTabs(scope);
  }

  // expose re-run hook for SPA router (scope-aware)
  window.KD_BUILDING_DETAIL_INIT = init;

  // auto-run only once per lifecycle (document scope)
  if (window.__KD_BUILDING_DETAIL_RAN__ !== true) {
    window.__KD_BUILDING_DETAIL_RAN__ = true;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { init(document); });
    } else {
      init(document);
    }
  }
})();
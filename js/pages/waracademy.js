// /js/pages/waracademy.js — FULL FINAL (MOBILE CARD MODE, PC TABLE MODE, SPA RE-ENTRY FIXED, I18N LIVE RERENDER)
(function () {
  'use strict';

  if (window.__WARACADEMY_SCRIPT_BOOTED__) return;
  window.__WARACADEMY_SCRIPT_BOOTED__ = true;

  function injectWarAcademyStyles() {
    if (document.getElementById('waracademy-ui-fix-style')) return;

    var style = document.createElement('style');
    style.id = 'waracademy-ui-fix-style';
    style.textContent = `
      [data-waracademy-root] .wa-grid{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
        gap:16px;
        align-items:stretch;
      }

      [data-waracademy-root] .wa-card{
  width:100%;
  display:flex;
  flex-direction:column;
  align-items:stretch;
  justify-content:flex-start;
  padding:0;
  border:1px solid rgba(15,23,42,.08);
  border-radius:18px;
  overflow:hidden;
  background:#ffffff;
  color:#111827;
  box-shadow:0 10px 24px rgba(15,23,42,.08);
  cursor:pointer;
  transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease;
  min-height:100%;
}

[data-waracademy-root] .wa-card:hover{
  transform:translateY(-2px);
  box-shadow:0 14px 28px rgba(15,23,42,.12);
  border-color:rgba(245,158,11,.35);
}

[data-waracademy-root] .wa-card.active{
  border-color:rgba(245,158,11,.55);
  box-shadow:0 0 0 1px rgba(245,158,11,.16), 0 14px 28px rgba(15,23,42,.12);
}

      [data-waracademy-root] .wa-thumb{
        width:100%;
        aspect-ratio:1 / 1;
        background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
        display:flex;
        align-items:center;
        justify-content:center;
        overflow:hidden;
        flex:0 0 auto;
      }

      [data-waracademy-root] .wa-thumb img{
        width:100%;
        height:100%;
        object-fit:contain;
        display:block;
        padding:14px;
      }

      [data-waracademy-root] .wa-info{
        display:flex;
        flex-direction:column;
        justify-content:flex-start;
        gap:8px;
        padding:14px 14px 16px;
        min-height:120px;
        text-align:left;
      }

      [data-waracademy-root] .wa-info h4{
        margin:0;
        font-size:16px;
        line-height:1.35;
        font-weight:700;
        word-break:keep-all;
      }

      [data-waracademy-root] .wa-info p{
        margin:0;
        font-size:13px;
        line-height:1.55;
        opacity:.88;
        display:-webkit-box;
        -webkit-line-clamp:3;
        -webkit-box-orient:vertical;
        overflow:hidden;
      }

      [data-waracademy-root] .tg-meta{
        margin:0 0 18px;
        padding:16px 18px;
        border-radius:16px;
        background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.08);
      }

      [data-waracademy-root] .tg-meta h3{
        margin:16px 0 10px;
      }

      [data-waracademy-root] .tg-meta ul{
        margin:0;
        padding-left:18px;
      }

      [data-waracademy-root] .tg-meta li{
        line-height:1.7;
      }

      [data-waracademy-root] .wa-detail-head{
        margin-bottom:14px;
      }

      [data-waracademy-root] .wa-detail-head h2{
        margin:0 0 8px;
      }

      [data-waracademy-root] .wa-detail-head p{
        margin:0;
        line-height:1.7;
        opacity:.92;
      }

      [data-waracademy-root] .wa-table-wrap{
        display:block;
      }

      [data-waracademy-root] .tg-table{
        width:100%;
        border-collapse:collapse;
        table-layout:fixed;
        margin-top:16px;
        font-size:14px;
      }

      [data-waracademy-root] .tg-table th,
      [data-waracademy-root] .tg-table td{
        border:1px solid rgba(255,255,255,.08);
        padding:10px 8px;
        vertical-align:top;
        word-break:break-word;
      }

      [data-waracademy-root] .tg-table th{
        background:rgba(255,255,255,.06);
        font-weight:700;
      }

      [data-waracademy-root] .tg-total{
        background:rgba(255,215,102,.08);
        font-weight:700;
      }

      [data-waracademy-root] .wa-mobile-list{
        display:none;
      }

      [data-waracademy-root] .wa-mobile-card{
        border:1px solid rgba(255,255,255,.08);
        background:rgba(255,255,255,.035);
        border-radius:16px;
        padding:14px;
        margin-top:12px;
        box-shadow:0 8px 20px rgba(0,0,0,.16);
      }

      [data-waracademy-root] .wa-mobile-card--total{
        border-color:rgba(255,215,102,.35);
        background:rgba(255,215,102,.07);
      }

      [data-waracademy-root] .wa-mobile-card__title{
        margin:0 0 10px;
        font-size:16px;
        line-height:1.35;
        font-weight:800;
      }

      [data-waracademy-root] .wa-mobile-card__grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px 10px;
      }

      [data-waracademy-root] .wa-mobile-row{
        min-width:0;
        padding:8px 10px;
        border-radius:12px;
        background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.06);
      }

      [data-waracademy-root] .wa-mobile-row--full{
        grid-column:1 / -1;
      }

      [data-waracademy-root] .wa-mobile-label{
        display:block;
        font-size:11px;
        line-height:1.3;
        opacity:.72;
        margin-bottom:4px;
      }

      [data-waracademy-root] .wa-mobile-value{
        display:block;
        font-size:13px;
        line-height:1.55;
        font-weight:600;
        word-break:break-word;
      }

      [data-waracademy-root] #infantry-detail,
      [data-waracademy-root] #archer-detail,
      [data-waracademy-root] #cavalry-detail{
        margin-top:18px;
      }

      [data-waracademy-root] details summary img{
        width:72px;
        height:72px;
        object-fit:contain;
        flex:0 0 72px;
      }

      @media (max-width: 900px){
        [data-waracademy-root] .wa-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:12px;
        }

        [data-waracademy-root] .wa-info{
          min-height:104px;
          padding:12px;
        }

        [data-waracademy-root] .wa-info h4{
          font-size:15px;
        }

        [data-waracademy-root] .wa-info p{
          font-size:12px;
          -webkit-line-clamp:2;
        }

        [data-waracademy-root] .tg-table{
          font-size:12px;
        }

        [data-waracademy-root] .tg-table th,
        [data-waracademy-root] .tg-table td{
          padding:8px 6px;
        }
      }

      @media (max-width: 768px){
        [data-waracademy-root] .wa-table-wrap{
          display:none;
        }

        [data-waracademy-root] .wa-mobile-list{
          display:block;
          margin-top:14px;
        }
      }

      @media (max-width: 560px){
        [data-waracademy-root] .wa-grid{
          grid-template-columns:1fr 1fr;
        }

        [data-waracademy-root] details summary{
          align-items:center;
        }

        [data-waracademy-root] details summary img{
          width:60px;
          height:60px;
          flex-basis:60px;
        }

        [data-waracademy-root] .wa-mobile-card{
          padding:12px;
          border-radius:14px;
        }

        [data-waracademy-root] .wa-mobile-card__grid{
          grid-template-columns:1fr 1fr;
          gap:8px;
        }

        [data-waracademy-root] .wa-mobile-row{
          padding:8px 9px;
        }

        [data-waracademy-root] .wa-mobile-label{
          font-size:10px;
        }

        [data-waracademy-root] .wa-mobile-value{
          font-size:12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeLang(raw) {
    var lang = String(raw || '').toLowerCase().replace('_', '-').trim();
    if (!lang) return '';
    if (lang === 'tw' || lang === 'zh-tw' || lang === 'zh_tw' || lang === 'zhtw' || lang.indexOf('hant') >= 0) return 'tw';
    if (lang.indexOf('ja') === 0) return 'ja';
    if (lang.indexOf('ko') === 0) return 'ko';
    if (lang.indexOf('en') === 0) return 'en';
    return '';
  }

  function detectLangAlias() {
    try {
      if (window.I18N && (window.I18N.current || window.I18N.lang)) {
        var cur = normalizeLang(window.I18N.current || window.I18N.lang);
        if (cur) return cur;
      }
    } catch (_) {}

    try {
      var qs = new URLSearchParams(location.search);
      var qLang = normalizeLang(qs.get('lang'));
      if (qLang) return qLang;
    } catch (_) {}

    try {
      var htmlLang = normalizeLang(document.documentElement.getAttribute('lang'));
      if (htmlLang) return htmlLang;
    } catch (_) {}

    try {
      var navLang = normalizeLang(navigator.language || navigator.userLanguage);
      if (navLang) return navLang;
    } catch (_) {}

    return 'en';
  }

  var __LANG__ = detectLangAlias();
  document.documentElement.lang = (__LANG__ === 'tw') ? 'zh-TW' : __LANG__;
  window.__WARACADEMY_BOOTSTRAP_DONE__ = window.__WARACADEMY_BOOTSTRAP_DONE__ || false;

  function getI18N() {
    return window.I18N || {};
  }

  function t(key, fallback) {
    var I18N = getI18N();
    if (I18N && typeof I18N.t === 'function') return I18N.t(key, fallback != null ? fallback : key);
    return fallback != null ? fallback : key;
  }

  function nfmt(n) {
    var I18N = getI18N();
    var v = Number(n ?? 0);
    if (Number.isNaN(v)) return '0';
    try {
      if (I18N && typeof I18N.nfmt === 'function') return I18N.nfmt(v);
    } catch (_) {}
    return v.toLocaleString();
  }

  var __SENTINEL__ = '__WARACADEMY_MISSING__';
  function tryT(key) {
    var v = t(key, __SENTINEL__);
    return v === __SENTINEL__ ? null : v;
  }

  function tt(primaryKey, fallback) {
    var keys = Array.prototype.slice.call(arguments, 0);
    var fb = keys.splice(1, 1)[0];
    var all = [primaryKey].concat(keys.slice(1));
    for (var i = 0; i < all.length; i++) {
      var k = all[i];
      if (!k) continue;
      var v = tryT(k);
      if (v != null && v !== k) return v;
    }
    return fb;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toKeyId(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function formatKMB(n) {
    var v = Number(n ?? 0);
    var abs = Math.abs(v);
    var SUFFIX = {
      k: t('waracademy.units.k', 'K'),
      m: t('waracademy.units.m', 'M'),
      b: t('waracademy.units.b', 'B')
    };
    function trim(s) { return String(s).replace(/\.?0+$/, ''); }
    if (abs >= 1e9) return trim((v / 1e9).toFixed(2)) + SUFFIX.b;
    if (abs >= 1e6) return trim((v / 1e6).toFixed(2)) + SUFFIX.m;
    if (abs >= 1e3) return trim((v / 1e3).toFixed(2)) + SUFFIX.k;
    return nfmt(v);
  }

  function parseTimeToSeconds(str) {
    if (!str) return 0;
    var s = String(str);
    var dMatch = s.match(/(\d+)\s*d/i);
    var days = dMatch ? parseInt(dMatch[1], 10) : 0;

    var tMatch = s.match(/(\d{1,3}):(\d{2}):(\d{2})/);
    var h = 0, m = 0, sec = 0;
    if (tMatch) {
      h = parseInt(tMatch[1], 10);
      m = parseInt(tMatch[2], 10);
      sec = parseInt(tMatch[3], 10);
    }
    return days * 86400 + h * 3600 + m * 60 + sec;
  }

  function secondsToRaw(secs) {
    secs = Math.max(0, Math.floor(Number(secs) || 0));
    var days = Math.floor(secs / 86400);
    secs -= days * 86400;
    var h = Math.floor(secs / 3600);
    secs -= h * 3600;
    var m = Math.floor(secs / 60);
    var s = secs - m * 60;
    function pad(n) { return String(n).padStart(2, '0'); }
    return days > 0 ? (days + 'd ' + pad(h) + ':' + pad(m) + ':' + pad(s)) : (pad(h) + ':' + pad(m) + ':' + pad(s));
  }

  function localizeTime(str) {
    if (!str) return t('waracademy.table.none', '-');
    var s = String(str);
    var dMatch = s.match(/(\d+)\s*d/i);
    var days = dMatch ? parseInt(dMatch[1], 10) : 0;

    var tMatch = s.match(/(\d{1,3}):(\d{2}):(\d{2})/);
    var h = 0, m = 0, sec = 0;
    if (tMatch) {
      h = parseInt(tMatch[1], 10);
      m = parseInt(tMatch[2], 10);
      sec = parseInt(tMatch[3], 10);
    }

    var parts = [];
    if (days > 0) parts.push(days + t('waracademy.units.day', 'd'));
    if (h > 0) parts.push(h + t('waracademy.units.hour', 'h'));
    if (m > 0) parts.push(m + t('waracademy.units.minute', 'm'));
    if (sec > 0) parts.push(sec + t('waracademy.units.second', 's'));

    return parts.length ? parts.join(' ') : t('waracademy.table.none', '-');
  }

  function trResearchTitle(r) {
    var title = r && r.title ? r.title : '';
    var k1 = 'waracademy.research.' + toKeyId(title) + '.title';
    var k2 = 'waracademy.research.' + title + '.title';
    return t(k1, t(k2, title));
  }

  function trResearchDesc(r) {
    var title = r && r.title ? r.title : '';
    var fallback = r && r.description ? r.description : '';
    var k1 = 'waracademy.research.' + toKeyId(title) + '.desc';
    var k2 = 'waracademy.research.' + title + '.desc';
    return t(k1, t(k2, fallback));
  }

  function localizeTokens(str) {
    if (str == null || str === '') return t('waracademy.table.none', '-');
    var out = String(str);

    var pairs = [
      ['Rally Squad Capacity', tt('waracademy.tokens.rally_squad_capacity', 'Rally Squad Capacity', 'waracademy.bonuses.rally_squad_capacity', 'waracademy.labels.rally_squad_capacity', 'waracademy.tokens.rally_capacity')],
      ['Squad Deployment Capacity', tt('waracademy.tokens.squad_deployment_capacity', 'Squad Deployment Capacity', 'waracademy.bonuses.squad_deployment_capacity', 'waracademy.labels.squad_deployment_capacity', 'waracademy.table.squad_deployment_capacity', 'waracademy.tokens.squad_capacity', 'waracademy.bonuses.squad_capacity')],
      ["Squads' Deployment Capacity", tt('waracademy.tokens.squad_deployment_capacity', "Squads' Deployment Capacity", 'waracademy.bonuses.squad_deployment_capacity', 'waracademy.labels.squad_deployment_capacity', 'waracademy.table.squad_deployment_capacity', 'waracademy.tokens.squad_capacity', 'waracademy.bonuses.squad_capacity')],
      ['Squads’ Deployment Capacity', tt('waracademy.tokens.squad_deployment_capacity', 'Squads’ Deployment Capacity', 'waracademy.bonuses.squad_deployment_capacity', 'waracademy.labels.squad_deployment_capacity', 'waracademy.table.squad_deployment_capacity', 'waracademy.tokens.squad_capacity', 'waracademy.bonuses.squad_capacity')],
      ['Rally Capacity', tt('waracademy.tokens.rally_capacity', 'Rally Capacity', 'waracademy.bonuses.rally_capacity', 'waracademy.labels.rally_capacity')],
      ['Squad Capacity', tt('waracademy.tokens.squad_capacity', 'Squad Capacity', 'waracademy.bonuses.squad_capacity', 'waracademy.labels.squad_capacity')],

      ['War Academy', t('waracademy.labels.waracademy', 'War Academy')],
      ['Town Center', t('waracademy.labels.towncenter', 'Town Center')],
      ['Training Time Down', t('waracademy.tokens.training_time_down', 'Training Time Down')],
      ['Training Speed Up', t('waracademy.tokens.training_speed_up', 'Training Speed Up')],
      ['Training Cost Down', t('waracademy.tokens.training_cost_down', 'Training Cost Down')],
      ['Healing Time Down', t('waracademy.tokens.healing_time_down', 'Healing Time Down')],
      ['Healing Cost Down', t('waracademy.tokens.healing_cost_down', 'Healing Cost Down')],
      ['Healing Cost Reduction', t('waracademy.tokens.healing_cost_reduction', 'Healing Cost Reduction')],
      ['Resource Cost Down', t('waracademy.tokens.resource_cost_down', 'Resource Cost Down')],
      ['Construction Time Down', t('waracademy.tokens.construction_time_down', 'Construction Time Down')],
      ['Upgrade Time Down', t('waracademy.tokens.upgrade_time_down', 'Upgrade Time Down')],
      ['Research Time Down', t('waracademy.tokens.research_time_down', 'Research Time Down')],
      ['Cost Reduction', t('waracademy.tokens.cost_reduction', 'Cost Reduction')],
      ['Time Down', t('waracademy.tokens.time_down', 'Time Down')],
      ['Cost Down', t('waracademy.tokens.cost_down', 'Cost Down')],
      ['Speed Up', t('waracademy.tokens.speed_up', 'Speed Up')],

      ['Truegold Infantry Training', t('waracademy.research.truegold_infantry_training.title', 'Truegold Infantry Training')],
      ['Truegold Infantry Aid', t('waracademy.research.truegold_infantry_aid.title', 'Truegold Infantry Aid')],
      ['Truegold Infantry Healing', t('waracademy.research.truegold_infantry_healing.title', 'Truegold Infantry Healing')],
      ['Truegold Infantry', t('waracademy.infantry.title', 'Truegold Infantry')],

      ['Truegold Archer Training', t('waracademy.research.truegold_archer_training.title', 'Truegold Archer Training')],
      ['Truegold Archer Aid', t('waracademy.research.truegold_archer_aid.title', 'Truegold Archer Aid')],
      ['Truegold Archer Healing', t('waracademy.research.truegold_archer_healing.title', 'Truegold Archer Healing')],
      ['Truegold Archers', t('waracademy.archer.title', 'Truegold Archers')],
      ['Truegold Archer', t('waracademy.archer.title', 'Truegold Archer')],
      ['Truegold Vests', t('waracademy.research.truegold_vests.title', 'Truegold Vests')],
      ['Truegold Arrows', t('waracademy.research.truegold_arrows.title', 'Truegold Arrows')],
      ['Truegold Bracers', t('waracademy.research.truegold_bracers.title', 'Truegold Bracers')],
      ['Truegold Bows', t('waracademy.research.truegold_bows.title', 'Truegold Bows')],
      ['Truegold Legionaries (Archer)', t('waracademy.research.truegold_legionaries_archer.title', 'Truegold Legionaries (Archer)')],
      ['Truegold Battalion (Archer)', t('waracademy.research.truegold_battalion_archer.title', 'Truegold Battalion (Archer)')],

      ['Truegold Cavalry Training', t('waracademy.research.truegold_cavalry_training.title', 'Truegold Cavalry Training')],
      ['Truegold Cavalry Aid', t('waracademy.research.truegold_cavalry_aid.title', 'Truegold Cavalry Aid')],
      ['Truegold Cavalry Healing', t('waracademy.research.truegold_cavalry_healing.title', 'Truegold Cavalry Healing')],
      ['Truegold Cavalry', t('waracademy.cavalry.title', 'Truegold Cavalry')],
      ['Truegold Platecraft', t('waracademy.research.truegold_platecraft.title', 'Truegold Platecraft')],
      ['Truegold Lances', t('waracademy.research.truegold_lances.title', 'Truegold Lances')],
      ['Truegold Charge', t('waracademy.research.truegold_charge.title', 'Truegold Charge')],
      ['Truegold Farriery', t('waracademy.research.truegold_farriery.title', 'Truegold Farriery')],
      ['Truegold Legionaries (Cavalry)', t('waracademy.research.truegold_legionaries_cavalry.title', 'Truegold Legionaries (Cavalry)')],
      ['Truegold Battalion (Cavalry)', t('waracademy.research.truegold_battalion_cavalry.title', 'Truegold Battalion (Cavalry)')],

      ['Truegold Blades', t('waracademy.research.truegold_blades.title', 'Truegold Blades')],
      ['Truegold Shields', t('waracademy.research.truegold_shields.title', 'Truegold Shields')],
      ['Truegold Mauls', t('waracademy.research.truegold_mauls.title', 'Truegold Mauls')],
      ['Truegold Plating', t('waracademy.research.truegold_plating.title', 'Truegold Plating')],
      ['Truegold Legionaries', t('waracademy.research.truegold_legionaries.title', 'Truegold Legionaries')],
      ['Truegold Battalion', t('waracademy.research.truegold_battalion.title', 'Truegold Battalion')],

      ['Attack', t('waracademy.attrs.attack', 'Attack')],
      ['Defense', t('waracademy.attrs.defense', 'Defense')],
      ['Health', t('waracademy.attrs.health', 'Health')],
      ['Lethality', t('waracademy.attrs.lethality', 'Lethality')],
      ['Power', t('waracademy.attrs.power', 'Power')],
      ['Bonus', t('waracademy.attrs.bonus', 'Bonus')],

      ['Archers', t('waracademy.labels.archers', 'Archers')],
      ['Archer', t('waracademy.labels.archer', 'Archer')],
      ['Infantry', t('waracademy.labels.infantry', 'Infantry')],
      ['Cavalry', t('waracademy.labels.cavalry', 'Cavalry')],

      ['Bread', t('waracademy.meta.bread', 'Bread')],
      ['Wood', t('waracademy.meta.wood', 'Wood')],
      ['Stone', t('waracademy.meta.stone', 'Stone')],
      ['Iron', t('waracademy.meta.iron', 'Iron')],
      ['Gold', t('waracademy.meta.gold', 'Gold')],
      ['Dust', t('waracademy.meta.dust', 'Dust')],
      ['bread', t('waracademy.meta.bread', 'Bread')],
      ['wood', t('waracademy.meta.wood', 'Wood')],
      ['stone', t('waracademy.meta.stone', 'Stone')],
      ['iron', t('waracademy.meta.iron', 'Iron')],
      ['gold', t('waracademy.meta.gold', 'Gold')],
      ['dust', t('waracademy.meta.dust', 'Dust')],

      ['Lv.', t('waracademy.table.level_short', 'Lv.')],
      ['Lv', t('waracademy.table.level_short', 'Lv.')],
      ['Level', t('waracademy.table.level', 'Level')]
    ].sort(function (a, b) { return b[0].length - a[0].length; });

    for (var i = 0; i < pairs.length; i++) {
      var src = pairs[i][0];
      var dst = pairs[i][1];
      var re = new RegExp(src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      out = out.replace(re, dst);
    }

    out = out.replace(/\bUnlock\s+([IVXLCDM]+)\s+/g, function (_m, roman) {
      return t('waracademy.tokens.unlock', 'Unlock') + ' ' + roman + ' ';
    });

    return out;
  }

  function renderMeta(data, id) {
    var b = document.getElementById(id);
    if (!b || !data || !data.requirements) return;

    var r = data.requirements;
    var bo = data.bonuses || {};

    b.innerHTML =
      '<div class="tg-meta">' +
        '<ul>' +
          '<li><b>' + t('waracademy.meta.buildings', '건물 요구사항') + ':</b> ' +
            t('waracademy.meta.towncenter', '도시센터') + ' ' + (r.building && r.building.towncenter != null ? r.building.towncenter : '-') + ', ' +
            t('waracademy.meta.waracademy', '전쟁아카데미') + ' ' + (r.building && r.building.waracademy != null ? r.building.waracademy : '-') +
          '</li>' +
          '<li><b>' + t('waracademy.meta.total_time', '총 연구 시간') + ':</b> ' + (r.research_time_days != null ? r.research_time_days : '-') + ' ' + t('waracademy.units.day', '일') + '</li>' +
          '<li><b>' + t('waracademy.meta.dust', '순금 가루') + ':</b> ' + nfmt(r.dust) + '</li>' +
          '<li><b>' + t('waracademy.meta.bread', '빵') + ':</b> ' + formatKMB(r.bread) + '</li>' +
          '<li><b>' + t('waracademy.meta.wood', '나무') + ':</b> ' + formatKMB(r.wood) + '</li>' +
          '<li><b>' + t('waracademy.meta.stone', '석재') + ':</b> ' + formatKMB(r.stone) + '</li>' +
          '<li><b>' + t('waracademy.meta.iron', '철') + ':</b> ' + formatKMB(r.iron) + '</li>' +
          '<li><b>' + t('waracademy.meta.gold', '금화') + ':</b> ' + nfmt(r.gold) + '</li>' +
        '</ul>' +
        '<h3>' + t('waracademy.meta.bonus_title', '보너스 효과') + '</h3>' +
        '<ul>' +
          '<li>' + t('waracademy.bonuses.squad_capacity', '부대 수용량') + ': ' + (bo.squad_capacity ?? '-') + '</li>' +
          '<li>' + t('waracademy.bonuses.health', '체력') + ': ' + (bo.health ?? '-') + '</li>' +
          '<li>' + t('waracademy.bonuses.lethality', '파괴력') + ': ' + (bo.lethality ?? '-') + '</li>' +
          '<li>' + t('waracademy.bonuses.attack', '공격력') + ': ' + (bo.attack ?? '-') + '</li>' +
          '<li>' + t('waracademy.bonuses.defense', '방어력') + ': ' + (bo.defense ?? '-') + '</li>' +
          '<li>' + t('waracademy.bonuses.rally_capacity', '집결 수용량') + ': ' + (bo.rally_capacity ?? '-') + '</li>' +
        '</ul>' +
      '</div>';
  }

  function renderResearchGrid(data, gridId, detailId) {
    var grid = document.getElementById(gridId);
    if (!grid) return;

    grid.classList.add('wa-grid');

    grid.innerHTML = (data.researches || []).map(function (r, i) {
      var title = trResearchTitle(r);
      var desc = trResearchDesc(r);
      var img = r.image || '';

      return (
        '<button type="button" class="wa-card" data-index="' + i + '">' +
          '<div class="wa-thumb">' +
            '<img src="' + img + '" alt="' + esc(title) + '" loading="lazy">' +
          '</div>' +
          '<div class="wa-info">' +
            '<h4>' + esc(title) + '</h4>' +
            '<p>' + esc(desc) + '</p>' +
          '</div>' +
        '</button>'
      );
    }).join('');

    var cards = grid.querySelectorAll('.wa-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        var idx = parseInt(card.dataset.index, 10);
        renderResearchDetail(data.researches[idx], detailId);

        cards.forEach(function (x) { x.classList.remove('active'); });
        card.classList.add('active');

        setTimeout(function () {
          var container = document.getElementById(detailId);
          if (container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      });
    });

    if (data.researches && data.researches.length) {
      var first = grid.querySelector('.wa-card');
      if (first) first.click();
    }
  }

  function mobileField(label, value, full) {
    return (
      '<div class="wa-mobile-row' + (full ? ' wa-mobile-row--full' : '') + '">' +
        '<span class="wa-mobile-label">' + esc(label) + '</span>' +
        '<span class="wa-mobile-value">' + esc(value) + '</span>' +
      '</div>'
    );
  }

  function renderResearchDetail(research, detailId) {
    var d = document.getElementById(detailId);
    if (!d || !research) return;

    var headHtml =
      '<div class="wa-detail-head">' +
        '<h2>' + esc(trResearchTitle(research)) + '</h2>' +
        '<p>' + esc(trResearchDesc(research)) + '</p>' +
      '</div>';

    d.innerHTML = headHtml;

    if (!(research.levels && research.levels.length)) return;

    var sumBread = 0, sumWood = 0, sumStone = 0, sumIron = 0, sumGold = 0, sumDust = 0, sumSecs = 0;

    var bodyRows = '';
    var mobileCards = '';

    research.levels.forEach(function (l) {
      var reqText = t('waracademy.table.none', '-');

      if (Array.isArray(l.requirements_parsed) && l.requirements_parsed.length > 0) {
        var lvShort = t('waracademy.table.level_short', 'Lv.');
        reqText = l.requirements_parsed.map(function (r) {
          var name = localizeTokens(r.name);
          var lv = r.level ? (lvShort + ' ' + r.level) : '';
          return lv ? (name + ' ' + lv) : name;
        }).join(', ');
      } else if (l.requirements) {
        reqText = localizeTokens(l.requirements);
      }

      var b = Number(l.bread || 0);
      var w = Number(l.wood || 0);
      var s = Number(l.stone || 0);
      var i = Number(l.iron || 0);
      var g = Number(l.gold || 0);
      var d2 = Number(l.dust || 0);
      var secs = parseTimeToSeconds(l.time);

      var breadText = formatKMB(b);
      var woodText = formatKMB(w);
      var stoneText = formatKMB(s);
      var ironText = formatKMB(i);
      var goldText = nfmt(g);
      var dustText = nfmt(d2);
      var timeText = localizeTime(l.time);
      var powerText = nfmt(l.power);
      var bonusText = localizeTokens(l.bonus ?? t('waracademy.table.none', '-'));

      sumBread += b;
      sumWood += w;
      sumStone += s;
      sumIron += i;
      sumGold += g;
      sumDust += d2;
      sumSecs += secs;

      bodyRows += (
        '<tr>' +
          '<td>' + esc(l.level ?? '-') + '</td>' +
          '<td>' + esc(reqText) + '</td>' +
          '<td>' + esc(breadText) + '</td>' +
          '<td>' + esc(woodText) + '</td>' +
          '<td>' + esc(stoneText) + '</td>' +
          '<td>' + esc(ironText) + '</td>' +
          '<td>' + esc(goldText) + '</td>' +
          '<td>' + esc(dustText) + '</td>' +
          '<td>' + esc(timeText) + '</td>' +
          '<td>' + esc(powerText) + '</td>' +
          '<td>' + esc(bonusText) + '</td>' +
        '</tr>'
      );

      mobileCards += (
        '<article class="wa-mobile-card">' +
          '<h3 class="wa-mobile-card__title">' + esc(t('waracademy.table.level_short', 'Lv') + ' ' + (l.level ?? '-')) + '</h3>' +
          '<div class="wa-mobile-card__grid">' +
            mobileField(t('waracademy.table.requirements', 'Requirements'), reqText, true) +
            mobileField(t('waracademy.table.bread', 'Bread'), breadText, false) +
            mobileField(t('waracademy.table.wood', 'Wood'), woodText, false) +
            mobileField(t('waracademy.table.stone', 'Stone'), stoneText, false) +
            mobileField(t('waracademy.table.iron', 'Iron'), ironText, false) +
            mobileField(t('waracademy.table.gold', 'Gold'), goldText, false) +
            mobileField(t('waracademy.table.dust', 'Dust'), dustText, false) +
            mobileField(t('waracademy.table.time', 'Time'), timeText, false) +
            mobileField(t('waracademy.table.power', 'Power'), powerText, false) +
            mobileField(t('waracademy.table.bonus', 'Bonus'), bonusText, true) +
          '</div>' +
        '</article>'
      );
    });

    var totalBreadText = formatKMB(sumBread);
    var totalWoodText = formatKMB(sumWood);
    var totalStoneText = formatKMB(sumStone);
    var totalIronText = formatKMB(sumIron);
    var totalGoldText = nfmt(sumGold);
    var totalDustText = nfmt(sumDust);
    var totalTimeText = localizeTime(secondsToRaw(sumSecs));

    var totalRow =
      '<tr class="tg-total">' +
        '<td>' + esc(t('waracademy.table.total_sign', 'Σ')) + '</td>' +
        '<td>' + esc(t('waracademy.table.totals', 'Totals')) + '</td>' +
        '<td>' + esc(totalBreadText) + '</td>' +
        '<td>' + esc(totalWoodText) + '</td>' +
        '<td>' + esc(totalStoneText) + '</td>' +
        '<td>' + esc(totalIronText) + '</td>' +
        '<td>' + esc(totalGoldText) + '</td>' +
        '<td>' + esc(totalDustText) + '</td>' +
        '<td>' + esc(totalTimeText) + '</td>' +
        '<td>—</td>' +
        '<td>—</td>' +
      '</tr>';

    var totalMobileCard =
      '<article class="wa-mobile-card wa-mobile-card--total">' +
        '<h3 class="wa-mobile-card__title">' + esc(t('waracademy.table.totals', 'Totals')) + '</h3>' +
        '<div class="wa-mobile-card__grid">' +
          mobileField(t('waracademy.table.bread', 'Bread'), totalBreadText, false) +
          mobileField(t('waracademy.table.wood', 'Wood'), totalWoodText, false) +
          mobileField(t('waracademy.table.stone', 'Stone'), totalStoneText, false) +
          mobileField(t('waracademy.table.iron', 'Iron'), totalIronText, false) +
          mobileField(t('waracademy.table.gold', 'Gold'), totalGoldText, false) +
          mobileField(t('waracademy.table.dust', 'Dust'), totalDustText, false) +
          mobileField(t('waracademy.table.time', 'Time'), totalTimeText, true) +
        '</div>' +
      '</article>';

    d.insertAdjacentHTML(
      'beforeend',
      '<div class="wa-table-wrap">' +
        '<table class="tg-table">' +
          '<thead>' +
            '<tr>' +
              '<th>' + esc(t('waracademy.table.lv', 'Lv')) + '</th>' +
              '<th>' + esc(t('waracademy.table.requirements', 'Requirements')) + '</th>' +
              '<th>' + esc(t('waracademy.table.bread', 'Bread')) + '</th>' +
              '<th>' + esc(t('waracademy.table.wood', 'Wood')) + '</th>' +
              '<th>' + esc(t('waracademy.table.stone', 'Stone')) + '</th>' +
              '<th>' + esc(t('waracademy.table.iron', 'Iron')) + '</th>' +
              '<th>' + esc(t('waracademy.table.gold', 'Gold')) + '</th>' +
              '<th>' + esc(t('waracademy.table.dust', 'Dust')) + '</th>' +
              '<th>' + esc(t('waracademy.table.time', 'Time')) + '</th>' +
              '<th>' + esc(t('waracademy.table.power', 'Power')) + '</th>' +
              '<th>' + esc(t('waracademy.table.bonus', 'Bonus')) + '</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + bodyRows + totalRow + '</tbody>' +
        '</table>' +
      '</div>' +
      '<div class="wa-mobile-list">' +
        mobileCards +
        totalMobileCard +
      '</div>'
    );
  }

  var cache = Object.create(null);

  function loadData(url, metaId, gridId, detailId, sectionKey) {
    var absUrl = new URL(url, location.origin).href;

    if (cache[absUrl]) {
      renderMeta(cache[absUrl], metaId);
      renderResearchGrid(cache[absUrl], gridId, detailId);
      return;
    }

    fetch(absUrl, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        cache[absUrl] = j;
        renderMeta(j, metaId);
        renderResearchGrid(j, gridId, detailId);
      })
      .catch(function (e) {
        console.error('[WarAcademy] load fail', e, sectionKey || '');
        var g = document.getElementById(gridId);
        if (g) g.innerHTML = '<p style="color:red;">⚠️ ' + esc(t('waracademy.load_failed', 'Failed to load data')) + ' (' + esc(absUrl) + ')</p>';
      });
  }

  function rerenderOpenSections(pageRoot) {
    var openDetails = pageRoot.querySelectorAll('details[open]');

    openDetails.forEach(function (d) {
      if (d.querySelector('#infantry-section')) {
        loadData('/data/waracademy-infantry.json', 'infantry-meta', 'infantry-grid', 'infantry-detail', 'infantry');
      } else if (d.querySelector('#archer-section')) {
        loadData('/data/waracademy-archer.json', 'archer-meta', 'archer-grid', 'archer-detail', 'archer');
      } else if (d.querySelector('#cavalry-section')) {
        loadData('/data/waracademy-cavalry.json', 'cavalry-meta', 'cavalry-grid', 'cavalry-detail', 'cavalry');
      }
    });
  }

  function localizeStaticHeadings(root) {
    try {
      document.title = t('waracademy.page_title', t('waracademy.title', 'War Academy (Truegold Troops)'));

      var h1 = root.querySelector('h1[data-i18n="waracademy.title"]');
      if (h1) h1.textContent = t('waracademy.title', 'War Academy (Truegold Troops)');

      var intro = root.querySelector('[data-i18n="waracademy.intro"]');
      if (intro) intro.textContent = t('waracademy.intro', intro.textContent);

      root.querySelectorAll('details summary').forEach(function (sum) {
        var h3 = sum.querySelector('h2, h3');
        var p = sum.querySelector('p');
        var img = sum.querySelector('img[alt]');

        if (h3) {
          var txt = h3.textContent.trim();
          if (/Infantry|보병|歩兵|步兵/i.test(txt)) h3.textContent = t('waracademy.infantry.title', 'Truegold Infantry');
          else if (/Archer|궁병|弓兵|弓箭手/i.test(txt)) h3.textContent = t('waracademy.archer.title', 'Truegold Archer');
          else if (/Cavalry|기병|騎兵|骑兵/i.test(txt)) h3.textContent = t('waracademy.cavalry.title', 'Truegold Cavalry');
        }

        if (p) {
          if (h3 && /Infantry|보병|歩兵|步兵/i.test(h3.textContent)) {
            p.textContent = t('waracademy.infantry.desc', 'Training requirements, costs, and bonuses.');
          } else if (h3 && /Archer|궁병|弓兵|弓箭手/i.test(h3.textContent)) {
            p.textContent = t('waracademy.archer.desc', 'Training requirements, costs, and bonuses.');
          } else if (h3 && /Cavalry|기병|騎兵|骑兵/i.test(h3.textContent)) {
            p.textContent = t('waracademy.cavalry.desc', 'Training requirements, costs, and bonuses.');
          } else {
            p.textContent = t('waracademy.section.hint', 'Training requirements, costs, and bonuses.');
          }
        }

        if (img && h3) img.alt = h3.textContent.trim();
      });
    } catch (_) {}
  }

  function bindDetailsAndLoad(pageRoot) {
    pageRoot.querySelectorAll('details').forEach(function (d) {
      if (!d.__waracademyToggleBound) {
        d.__waracademyToggleBound = true;

        d.addEventListener('toggle', function () {
          if (!d.open) return;

          if (d.querySelector('#infantry-section')) {
            loadData('/data/waracademy-infantry.json', 'infantry-meta', 'infantry-grid', 'infantry-detail', 'infantry');
          } else if (d.querySelector('#archer-section')) {
            loadData('/data/waracademy-archer.json', 'archer-meta', 'archer-grid', 'archer-detail', 'archer');
          } else if (d.querySelector('#cavalry-section')) {
            loadData('/data/waracademy-cavalry.json', 'cavalry-meta', 'cavalry-grid', 'cavalry-detail', 'cavalry');
          }
        });
      }

      if (d.open) {
        if (d.querySelector('#infantry-section')) {
          loadData('/data/waracademy-infantry.json', 'infantry-meta', 'infantry-grid', 'infantry-detail', 'infantry');
        } else if (d.querySelector('#archer-section')) {
          loadData('/data/waracademy-archer.json', 'archer-meta', 'archer-grid', 'archer-detail', 'archer');
        } else if (d.querySelector('#cavalry-section')) {
          loadData('/data/waracademy-cavalry.json', 'cavalry-meta', 'cavalry-grid', 'cavalry-detail', 'cavalry');
        }
      }
    });
  }

  window.initWarAcademy = function () {
    var pageRoot = document.querySelector('[data-waracademy-root]') || document;

    requestAnimationFrame(function () {
      injectWarAcademyStyles();
      localizeStaticHeadings(pageRoot);
      bindDetailsAndLoad(pageRoot);
      rerenderOpenSections(pageRoot);
    });
  };

  function bootstrapWarAcademy() {
    if (window.__WARACADEMY_BOOTSTRAP_DONE__) {
      window.initWarAcademy();
      return;
    }
    window.__WARACADEMY_BOOTSTRAP_DONE__ = true;

    var I18N = getI18N();
    var initPromise = Promise.resolve();

    try {
      if (I18N && typeof I18N.loadNamespace === 'function') {
        initPromise = I18N.loadNamespace('waracademy');
      } else if (I18N && typeof I18N.loadNamespaces === 'function') {
        initPromise = I18N.loadNamespaces(['waracademy']);
      } else if (I18N && typeof I18N.init === 'function') {
        initPromise = I18N.init({
          lang: __LANG__,
          namespaces: ['waracademy'],
          path: '/locales/{lang}/{ns}.json'
        }).then(function () {
          if (typeof I18N.setLang === 'function') I18N.setLang(__LANG__);
        });
      }
    } catch (_) {}

    initPromise
      .then(function () {
        try {
          if (I18N && typeof I18N.applyTo === 'function') I18N.applyTo(document.body);
        } catch (_) {}
        window.initWarAcademy();
      })
      .catch(function (e) {
        console.error('[WarAcademy] i18n bootstrap failed:', e);
        window.initWarAcademy();
      });
  }

  if (!document.__waracademyI18nChangedBound) {
    document.__waracademyI18nChangedBound = true;
    document.addEventListener('i18n:changed', function () {
      try {
        var I18N = getI18N();
        var p = Promise.resolve();

        if (I18N && typeof I18N.loadNamespace === 'function') {
          p = I18N.loadNamespace('waracademy');
        } else if (I18N && typeof I18N.loadNamespaces === 'function') {
          p = I18N.loadNamespaces(['waracademy']);
        }

        p.finally(function () {
          window.initWarAcademy();
        });
      } catch (_) {
        try { window.initWarAcademy(); } catch (_) {}
      }
    });
  }

  bootstrapWarAcademy();
})();
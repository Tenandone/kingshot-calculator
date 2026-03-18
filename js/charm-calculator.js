(function () {
  'use strict';

  // ===== i18n =====
  const T = (k, fb) => {
    try {
      if (window.I18N && typeof window.I18N.t === 'function') {
        return window.I18N.t(k, fb != null ? fb : k);
      }
    } catch (_) {}
    return fb != null ? fb : k;
  };

  // ===== format =====
  const fmt = (n) => (n || 0).toLocaleString();

  function fmtCompact(n) {
    const num = +n || 0;
    const abs = Math.abs(num);

    if (abs >= 1000000000) {
      return (Math.round((num / 1000000000) * 10) / 10).toString().replace(/\.0$/, '') + 'B';
    }
    if (abs >= 1000000) {
      return (Math.round((num / 1000000) * 10) / 10).toString().replace(/\.0$/, '') + 'M';
    }
    if (abs >= 1000) {
      return (Math.round((num / 1000) * 10) / 10).toString().replace(/\.0$/, '') + 'K';
    }
    return String(num);
  }

  function fmtPercent(n) {
    const num = +n || 0;
    if (Math.floor(num) === num) return String(num);
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  // ===== dom helper =====
  function h(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);

    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k === 'dataset' && v && typeof v === 'object') {
        Object.entries(v).forEach(([dk, dv]) => { el.dataset[dk] = dv; });
      } else if (k === 'checked') {
        if (v) el.checked = true;
      } else if (k === 'disabled') {
        if (v) el.disabled = true;
      } else {
        el.setAttribute(k, v);
      }
    });

    (Array.isArray(children) ? children : [children]).forEach((ch) => {
      if (ch == null) return;
      el.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch);
    });

    return el;
  }

  const stepKeys = (steps) => Object.keys(steps || {});

  // ===== icon =====
  const ICON_BASE = '/img/icons/';
  const ICON_VER = encodeURIComponent(window.__V || Date.now());

  function iconPath(filename) {
    return ICON_BASE + filename + '?v=' + ICON_VER;
  }

  // ===== gem meta =====
  // 순서: 보병 > 기병 > 궁병
  const GEM_META = {
    infantry: {
      key: 'infantry',
      gemNameKey: 'calcCharm.charms.infantry',
      gemFallback: '예리한 보석',
      classLabelKey: 'calcCharm.classes.infantry',
      classFallback: '보병',
      img: iconPath('infantry.png'),
      emoji: '⚔️',
      badgeClass: 'gc-class-inf'
    },
    cavalry: {
      key: 'cavalry',
      gemNameKey: 'calcCharm.charms.cavalry',
      gemFallback: '수호 보석',
      classLabelKey: 'calcCharm.classes.cavalry',
      classFallback: '기병',
      img: iconPath('cavalry.png'),
      emoji: '🛡️',
      badgeClass: 'gc-class-cav'
    },
    archer: {
      key: 'archer',
      gemNameKey: 'calcCharm.charms.archer',
      gemFallback: '호크아이 보석',
      classLabelKey: 'calcCharm.classes.archer',
      classFallback: '궁병',
      img: iconPath('archer.png'),
      emoji: '🏹',
      badgeClass: 'gc-class-rng'
    }
  };

  const RESOURCE_META = {
    manual: {
      labelKey: 'calcCharm.result.manual',
      fallback: '보석 매뉴얼',
      img: iconPath('manual.png'),
      emoji: '📘'
    },
    design: {
      labelKey: 'calcCharm.result.design',
      fallback: '보석 도면',
      img: iconPath('design.png'),
      emoji: '📜'
    },
    attr: {
      labelKey: 'calcCharm.result.attribute',
      fallback: '목표 레벨 속성',
      img: iconPath('score.png'),
      emoji: '✨'
    }
  };

  function getGemName(key) {
    const meta = GEM_META[key];
    if (!meta) return key;
    return T(meta.gemNameKey, meta.gemFallback);
  }

  function getClassLabel(key) {
    const meta = GEM_META[key];
    if (!meta) return key;
    return T(meta.classLabelKey, meta.classFallback);
  }

  function getResourceLabel(key) {
    const meta = RESOURCE_META[key];
    if (!meta) return key;
    return T(meta.labelKey, meta.fallback);
  }

  function makeImageBox(src, alt, fallbackText, boxClass) {
    const wrap = h('div', { class: boxClass });
    const img = h('img', {
      src: src,
      alt: alt || '',
      loading: 'lazy',
      decoding: 'async'
    });

    img.addEventListener('error', function () {
      wrap.classList.add('is-fallback');
      wrap.innerHTML = '';
      wrap.appendChild(h('span', { class: 'cc-fallback-emoji', text: fallbackText || '•' }));
    });

    wrap.appendChild(img);
    return wrap;
  }

  // ===== calc helpers =====
  function readAttrValue(step) {
    if (!step) return 0;
    if (step.attr != null) return +step.attr || 0;
    if (step.attribute != null) return +step.attribute || 0;
    if (step.attrPercent != null) return +step.attrPercent || 0;
    if (step.attributePercent != null) return +step.attributePercent || 0;
    if (step.score != null) return +step.score || 0;
    return 0;
  }

  function sumUpgrade(steps, keys, fromIdx, toIdx) {
    let manual = 0;
    let design = 0;

    for (let i = fromIdx + 1; i <= toIdx; i++) {
      const s = steps[keys[i]] || {};
      manual += +s.manual || 0;
      design += +s.design || +s.blueprint || 0;
    }

    return { manual: manual, design: design };
  }

  function getAttrFinal(steps, keys, toIdx) {
    const toStep = steps[keys[toIdx]] || {};
    return readAttrValue(toStep);
  }

  function clampGemCount(v) {
    const n = parseInt(v, 10) || 0;
    return Math.max(0, Math.min(6, n));
  }

  function S_els(id) {
    return document.getElementById(id);
  }

  function createMetricDef(key, value, alwaysShow) {
    return {
      key: key,
      value: +value || 0,
      alwaysShow: !!alwaysShow
    };
  }

  function getVisibleMetricDefs(infValue, cavValue, arcValue) {
    const defs = [
      createMetricDef('manual', null, true),
      createMetricDef('design', null, true),
      createMetricDef('infantryAttr', infValue, false),
      createMetricDef('cavalryAttr', cavValue, false),
      createMetricDef('archerAttr', arcValue, false)
    ];

    return defs.filter(function (item) {
      return item.alwaysShow || item.value > 0;
    });
  }

  function getMetricLabel(key) {
    if (key === 'manual') return getResourceLabel('manual');
    if (key === 'design') return getResourceLabel('design');
    if (key === 'infantryAttr') return T('calcCharm.result.infantryAttr', '보병 속성');
    if (key === 'cavalryAttr') return T('calcCharm.result.cavalryAttr', '기병 속성');
    if (key === 'archerAttr') return T('calcCharm.result.archerAttr', '궁병 속성');
    return key;
  }

  function getMetricImg(key) {
    if (key === 'manual') return RESOURCE_META.manual.img;
    if (key === 'design') return RESOURCE_META.design.img;
    if (key === 'infantryAttr') return GEM_META.infantry.img;
    if (key === 'cavalryAttr') return GEM_META.cavalry.img;
    if (key === 'archerAttr') return GEM_META.archer.img;
    return '';
  }

  function formatMetricValue(key, value) {
    if (key === 'manual' || key === 'design') return fmt(value);
    return fmtPercent(value) + '%';
  }

  const STATE = {
    root: null,
    charm: null,
    els: {},
    last: null
  };

  async function initCharmCalculator(opt) {
    const {
      mount,
      jsonUrl,
      data
    } = opt || {};

    const root = document.querySelector(mount);
    if (!root) {
      console.error('[charm] mount not found:', mount);
      return;
    }

    let charm;
    try {
      if (data) {
        charm = data;
      } else {
        const res = await fetch(jsonUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error('fetch ' + res.status);
        charm = await res.json();
      }
    } catch (e) {
      root.textContent = T('calcCharm.error.load', '데이터를 불러오지 못했습니다.');
      console.error(e);
      return;
    }

    if (!document.getElementById('charm-calc-style')) {
      const st = document.createElement('style');
      st.id = 'charm-calc-style';
      st.textContent = `
        .charm-calc-wrap{
          font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Pretendard,Arial,sans-serif;
          color:#111827;
          overflow-x:hidden;
        }

        .charm-card{
          border:1px solid #e5e7eb;
          border-radius:24px;
          padding:18px;
          background:#ffffff;
          box-shadow:0 8px 24px rgba(17,24,39,.05);
          max-width:980px;
          margin:0 auto;
          overflow:hidden;
        }

        .cc-section + .cc-section{
          margin-top:16px;
        }

        .cc-section-title{
          margin:0 0 10px;
          font-size:15px;
          font-weight:800;
          color:#111827;
        }

        .cc-unit-grid{
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:12px;
          margin:0;
        }

        .cc-unit-card{
          display:flex;
          align-items:center;
          gap:12px;
          min-height:96px;
          padding:14px;
          border:1px solid #e5e7eb;
          border-radius:18px;
          background:linear-gradient(180deg,#ffffff 0%,#fafbfc 100%);
          min-width:0;
        }

        .cc-unit-thumb{
          width:50px;
          height:50px;
          border-radius:14px;
          background:#f3f4f6;
          border:1px solid #e5e7eb;
          display:flex;
          align-items:center;
          justify-content:center;
          overflow:hidden;
          flex:0 0 auto;
        }

        .cc-unit-thumb img{
          width:100%;
          height:100%;
          object-fit:contain;
          display:block;
        }

        .cc-unit-thumb.is-fallback{
          background:#eef2ff;
        }

        .cc-fallback-emoji{
          font-size:22px;
          line-height:1;
        }

        .cc-unit-text{
          min-width:0;
          flex:1 1 auto;
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items:flex-start;
        }

        .cc-unit-name{
          display:block;
          min-height:20px;
          font-size:16px;
          font-weight:800;
          color:#111827;
          line-height:1.2;
          word-break:keep-all;
        }

        .cc-unit-count{
          margin-top:8px;
          width:100%;
          height:42px;
          padding:0 12px;
          border:1px solid #d1d5db;
          border-radius:12px;
          background:#fff;
          font-size:15px;
          font-weight:700;
          color:#111827;
          outline:none;
          min-width:0;
        }

        .cc-unit-count:focus,
        .cc-select:focus{
          border-color:#2563eb;
          box-shadow:0 0 0 3px rgba(37,99,235,.12);
        }

        .cc-unit-badge{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          margin-top:6px;
          padding:4px 8px;
          min-height:24px;
          border-radius:999px;
          font-size:12px;
          font-weight:700;
          line-height:1;
          border:1px solid transparent;
          width:fit-content;
          max-width:100%;
          word-break:keep-all;
        }

        .gc-class-cav{
          color:#1d4ed8;
          background:#dbeafe;
          border-color:#bfdbfe;
        }

        .gc-class-inf{
          color:#047857;
          background:#d1fae5;
          border-color:#a7f3d0;
        }

        .gc-class-rng{
          color:#b45309;
          background:#fef3c7;
          border-color:#fde68a;
        }

        .cc-form-grid{
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:12px;
        }

        .cc-field{
          display:flex;
          flex-direction:column;
          gap:8px;
          min-width:0;
        }

        .cc-label{
          font-size:14px;
          font-weight:800;
          color:#111827;
          min-height:20px;
          display:flex;
          align-items:center;
        }

        .cc-select{
          height:52px;
          padding:0 14px;
          border:1px solid #d1d5db;
          border-radius:14px;
          background:#fff;
          font-size:15px;
          font-weight:700;
          color:#111827;
          outline:none;
          width:100%;
          min-width:0;
        }

        .cc-actions-grid{
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:10px;
          margin-top:12px;
        }

        .cc-btn{
          width:100%;
          min-height:52px;
          border:1px solid #dbe3ef;
          border-radius:16px;
          background:#fff;
          color:#111827;
          font-size:15px;
          font-weight:800;
          cursor:pointer;
          padding:10px 12px;
          line-height:1.2;
          white-space:normal;
          word-break:keep-all;
          transition:all .2s ease;
          min-width:0;
        }

        .cc-btn:hover{
          background:#f8fafc;
        }

        .cc-btn-primary{
          background:#136ad6;
          color:#fff;
          border-color:#136ad6;
        }

        .cc-btn-primary:hover{
          opacity:.96;
        }

        .cc-grid{
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:12px;
        }

        .cc-grid-attr{
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:12px;
          margin-top:12px;
        }

        .cc-kpi{
          display:flex;
          align-items:center;
          gap:12px;
          min-height:92px;
          padding:14px;
          border:1px solid #e5e7eb;
          border-radius:18px;
          background:#fff;
          min-width:0;
        }

        .cc-kpi.is-hidden{
          display:none !important;
        }

        .cc-kpi-thumb{
          width:48px;
          height:48px;
          border-radius:14px;
          border:1px solid #e5e7eb;
          background:#f3f4f6;
          display:flex;
          align-items:center;
          justify-content:center;
          overflow:hidden;
          flex:0 0 auto;
        }

        .cc-kpi-thumb img{
          width:100%;
          height:100%;
          object-fit:contain;
          display:block;
        }

        .cc-kpi-thumb.is-fallback{
          background:#f8fafc;
        }

        .cc-kpi-text{
          min-width:0;
          flex:1 1 auto;
          min-height:50px;
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items:flex-start;
        }

        .cc-kpi .num{
          font-size:28px;
          line-height:1.05;
          font-weight:900;
          color:#111827;
          min-height:30px;
          letter-spacing:-.02em;
          white-space:nowrap;
          text-align:left;
        }

        .cc-kpi-label{
          margin-top:4px;
          font-size:14px;
          font-weight:700;
          color:#374151;
          min-height:20px;
          display:flex;
          align-items:center;
          word-break:keep-all;
          line-height:1.2;
          text-align:left;
        }

        .cc-details{
          margin-top:14px;
          font-size:13px;
          background:#fff;
          border:1px solid #e5e7eb;
          border-radius:18px;
          overflow:hidden;
        }

        .cc-details table{
          border-collapse:collapse;
          width:100%;
          table-layout:fixed;
        }

        .cc-details th,
        .cc-details td{
          border-bottom:1px solid #eef2f7;
          padding:10px 8px;
          text-align:center;
          white-space:normal;
          word-break:keep-all;
          vertical-align:middle;
          line-height:1.35;
          font-size:13px;
        }

        .cc-details th{
          background:#f8fafc;
          font-weight:800;
          color:#111827;
        }

        .cc-details th:first-child,
        .cc-details td:first-child{
          width:76px;
        }

        .cc-total-row td{
          font-weight:800;
          background:#eff6ff;
        }

        .cc-detail-inline{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:6px;
          flex-wrap:wrap;
        }

        .cc-detail-icon{
          width:18px;
          height:18px;
          border-radius:6px;
          overflow:hidden;
          border:1px solid #e5e7eb;
          background:#f8fafc;
          flex:0 0 auto;
        }

        .cc-detail-icon img{
          width:100%;
          height:100%;
          object-fit:contain;
          display:block;
        }

        .cc-mobile-details{
          display:none;
          margin-top:14px;
          gap:10px;
        }

        .cc-mobile-row{
          border:1px solid #e5e7eb;
          border-radius:16px;
          background:#fff;
          padding:12px;
          min-width:0;
        }

        .cc-mobile-head{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          margin-bottom:10px;
        }

        .cc-mobile-level{
          font-size:15px;
          font-weight:900;
          color:#111827;
          line-height:1.2;
        }

        .cc-mobile-grid{
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:8px;
        }

        .cc-mobile-metric{
          border:1px solid #eef2f7;
          border-radius:12px;
          padding:10px;
          background:#fafcff;
          min-height:68px;
          min-width:0;
        }

        .cc-mobile-metric-top{
          display:flex;
          align-items:center;
          gap:6px;
        }

        .cc-mobile-metric-icon{
          width:18px;
          height:18px;
          border-radius:6px;
          overflow:hidden;
          border:1px solid #e5e7eb;
          background:#fff;
          flex:0 0 auto;
        }

        .cc-mobile-metric-icon img{
          width:100%;
          height:100%;
          object-fit:contain;
          display:block;
        }

        .cc-mobile-metric-label{
          font-size:12px;
          font-weight:700;
          color:#6b7280;
          line-height:1.2;
          min-width:0;
          word-break:keep-all;
          text-align:left;
        }

        .cc-mobile-metric-num{
          margin-top:8px;
          font-size:16px;
          font-weight:900;
          color:#111827;
          line-height:1.1;
          white-space:nowrap;
          text-align:left;
        }

        .cc-mobile-total{
          border-color:#bfdbfe;
          background:#eff6ff;
        }

        @media (max-width: 980px){
          .cc-unit-grid{
            grid-template-columns:repeat(3,minmax(0,1fr));
          }

          .cc-grid,
          .cc-grid-attr{
            grid-template-columns:repeat(3,minmax(0,1fr));
          }

          .cc-details th,
          .cc-details td{
            padding:9px 6px;
            font-size:12px;
          }

          .cc-details th:first-child,
          .cc-details td:first-child{
            width:70px;
          }

          .cc-detail-inline{
            gap:4px;
          }

          .cc-detail-icon{
            width:16px;
            height:16px;
          }
        }

        @media (max-width: 767px){
          .cc-details{
            display:none;
          }

          .cc-mobile-details{
            display:grid;
          }
        }

        @media (max-width: 640px){
          .charm-card{
            padding:14px;
            border-radius:20px;
          }

          .cc-unit-grid{
            grid-template-columns:repeat(3,minmax(0,1fr));
            gap:8px;
          }

          .cc-unit-card{
            min-height:auto;
            padding:10px;
            gap:8px;
            flex-direction:column;
            align-items:center;
            justify-content:flex-start;
            text-align:center;
          }

          .cc-unit-thumb{
            width:38px;
            height:38px;
            border-radius:10px;
          }

          .cc-unit-text{
            width:100%;
            align-items:center;
          }

          .cc-unit-name{
            font-size:13px;
            min-height:32px;
            display:flex;
            align-items:center;
            justify-content:center;
            text-align:center;
          }

          .cc-unit-badge{
            font-size:10px;
            min-height:20px;
            padding:3px 7px;
            margin-top:4px;
          }

          .cc-unit-count{
            height:36px;
            font-size:14px;
            margin-top:6px;
            padding:0 10px;
            text-align:center;
          }

          .cc-form-grid{
            grid-template-columns:1fr;
          }

          .cc-select{
            height:48px;
            font-size:14px;
          }

          .cc-actions-grid{
            grid-template-columns:repeat(2,minmax(0,1fr));
          }

          .cc-btn{
            min-height:46px;
            border-radius:14px;
            font-size:14px;
            padding:8px 10px;
          }

          .cc-grid,
          .cc-grid-attr{
            grid-template-columns:repeat(3,minmax(0,1fr));
            gap:8px;
          }

          .cc-kpi{
            min-height:110px;
            padding:10px 8px;
            gap:8px;
            flex-direction:column;
            align-items:center;
            justify-content:flex-start;
            text-align:center;
          }

          .cc-kpi-thumb{
            width:34px;
            height:34px;
            border-radius:10px;
          }

          .cc-kpi-text{
            width:100%;
            align-items:center;
            justify-content:flex-start;
          }

          .cc-kpi .num{
            font-size:14px;
            min-height:auto;
            line-height:1.1;
            text-align:center;
          }

          .cc-kpi-label{
            font-size:11px;
            min-height:28px;
            line-height:1.2;
            justify-content:center;
            text-align:center;
          }

          .cc-mobile-grid{
            grid-template-columns:1fr;
          }
        }

        @media (max-width: 420px){
          .cc-unit-grid{
            grid-template-columns:repeat(3,minmax(0,1fr));
          }

          .cc-grid,
          .cc-grid-attr{
            grid-template-columns:repeat(3,minmax(0,1fr));
          }
        }
      `;
      document.head.appendChild(st);
    }

    root.innerHTML = '';
    root.classList.add('charm-calc-wrap');

    const card = h('div', { class: 'charm-card' });

    // ===== gem count =====
    const troopSection = h('section', { class: 'cc-section' });
    const troopTitle = h('h3', {
      class: 'cc-section-title',
      id: 'cc-unit-title',
      text: T('calcCharm.form.counts.title', '보석 개수')
    });

    const infThumb = makeImageBox(GEM_META.infantry.img, getGemName('infantry'), GEM_META.infantry.emoji, 'cc-unit-thumb');
    const cavThumb = makeImageBox(GEM_META.cavalry.img, getGemName('cavalry'), GEM_META.cavalry.emoji, 'cc-unit-thumb');
    const arcThumb = makeImageBox(GEM_META.archer.img, getGemName('archer'), GEM_META.archer.emoji, 'cc-unit-thumb');

    const infInp = h('input', {
      type: 'number',
      min: '0',
      max: '6',
      value: '0',
      class: 'cc-unit-count',
      inputmode: 'numeric'
    });
    const cavInp = h('input', {
      type: 'number',
      min: '0',
      max: '6',
      value: '0',
      class: 'cc-unit-count',
      inputmode: 'numeric'
    });
    const arcInp = h('input', {
      type: 'number',
      min: '0',
      max: '6',
      value: '0',
      class: 'cc-unit-count',
      inputmode: 'numeric'
    });

    const infName = h('span', { class: 'cc-unit-name', id: 'cc-lab-inf', text: getGemName('infantry') });
    const cavName = h('span', { class: 'cc-unit-name', id: 'cc-lab-cav', text: getGemName('cavalry') });
    const arcName = h('span', { class: 'cc-unit-name', id: 'cc-lab-arc', text: getGemName('archer') });

    const infBadge = h('span', { class: 'cc-unit-badge gc-class-inf', id: 'cc-badge-inf', text: getClassLabel('infantry') });
    const cavBadge = h('span', { class: 'cc-unit-badge gc-class-cav', id: 'cc-badge-cav', text: getClassLabel('cavalry') });
    const arcBadge = h('span', { class: 'cc-unit-badge gc-class-rng', id: 'cc-badge-arc', text: getClassLabel('archer') });

    const troopGrid = h('div', { class: 'cc-unit-grid' }, [
      h('div', { class: 'cc-unit-card' }, [
        infThumb,
        h('div', { class: 'cc-unit-text' }, [infName, infBadge, infInp])
      ]),
      h('div', { class: 'cc-unit-card' }, [
        cavThumb,
        h('div', { class: 'cc-unit-text' }, [cavName, cavBadge, cavInp])
      ]),
      h('div', { class: 'cc-unit-card' }, [
        arcThumb,
        h('div', { class: 'cc-unit-text' }, [arcName, arcBadge, arcInp])
      ])
    ]);

    troopSection.appendChild(troopTitle);
    troopSection.appendChild(troopGrid);

    // ===== level =====
    const levelSection = h('section', { class: 'cc-section' });
    const levelGrid = h('div', { class: 'cc-form-grid' });

    const fromSel = h('select', { class: 'cc-select' });
    const toSel = h('select', { class: 'cc-select' });

    const fromLabel = h('label', {
      class: 'cc-label',
      id: 'cc-lab-from',
      text: T('calcCharm.form.currentLevel.label', '현재 레벨')
    });

    const toLabel = h('label', {
      class: 'cc-label',
      id: 'cc-lab-to',
      text: T('calcCharm.form.targetLevel.label', '목표 레벨')
    });

    levelGrid.appendChild(h('div', { class: 'cc-field' }, [fromLabel, fromSel]));
    levelGrid.appendChild(h('div', { class: 'cc-field' }, [toLabel, toSel]));
    levelSection.appendChild(levelGrid);

    // ===== actions =====
    const actionsSection = h('section', { class: 'cc-section' });

    const fill18Btn = h('button', {
      class: 'cc-btn cc-btn-primary',
      id: 'cc-fill18',
      type: 'button',
      text: T('calcCharm.form.actions.fill18', '기본 6·6·6')
    });

    const clearBtn = h('button', {
      class: 'cc-btn',
      id: 'cc-clear',
      type: 'button',
      text: T('calcCharm.form.actions.clear', '초기화')
    });

    const actionGrid = h('div', { class: 'cc-actions-grid' }, [fill18Btn, clearBtn]);
    actionsSection.appendChild(actionGrid);

    // ===== result =====
    const resultSection = h('section', { class: 'cc-section' });

    function buildKpiCard(resourceKey, numId, labId, imgOverride, labelOverride, extraClass) {
      const meta = RESOURCE_META[resourceKey];
      const thumb = makeImageBox(imgOverride || meta.img, labelOverride || getResourceLabel(resourceKey), meta.emoji, 'cc-kpi-thumb');

      return h('div', {
        class: 'cc-kpi' + (extraClass ? ' ' + extraClass : '')
      }, [
        thumb,
        h('div', { class: 'cc-kpi-text' }, [
          h('div', { class: 'num', id: numId, text: resourceKey === 'attr' ? '0%' : '0' }),
          h('div', { class: 'cc-kpi-label', id: labId, text: labelOverride || getResourceLabel(resourceKey) })
        ])
      ]);
    }

    const materialGrid = h('div', { class: 'cc-grid' }, [
      buildKpiCard('manual', 'cc-manual', 'cc-kpi-manual-lab'),
      buildKpiCard('design', 'cc-design', 'cc-kpi-design-lab'),
      buildKpiCard('attr', 'cc-attr-total', 'cc-kpi-attr-total-lab')
    ]);

    const attrGrid = h('div', { class: 'cc-grid-attr' }, [
      buildKpiCard('attr', 'cc-inf-attr', 'cc-kpi-inf-attr-lab', GEM_META.infantry.img, T('calcCharm.result.infantryAttr', '보병 속성'), 'cc-kpi-inf'),
      buildKpiCard('attr', 'cc-cav-attr', 'cc-kpi-cav-attr-lab', GEM_META.cavalry.img, T('calcCharm.result.cavalryAttr', '기병 속성'), 'cc-kpi-cav'),
      buildKpiCard('attr', 'cc-arc-attr', 'cc-kpi-arc-attr-lab', GEM_META.archer.img, T('calcCharm.result.archerAttr', '궁병 속성'), 'cc-kpi-arc')
    ]);

    const detailWrap = h('div', { class: 'cc-details', style: 'display:none' });

    function buildDetailHeadHTML(metricKey) {
      return (
        '<span class="cc-detail-inline">' +
          '<span class="cc-detail-icon"><img src="' + getMetricImg(metricKey) + '" alt="' + getMetricLabel(metricKey) + '"></span>' +
          '<span>' + getMetricLabel(metricKey) + '</span>' +
        '</span>'
      );
    }

    const detailTable = h('table', {}, [
      h('thead', {}, h('tr', { id: 'cc-head-row' })),
      h('tbody', { id: 'cc-tbody' })
    ]);

    detailWrap.appendChild(detailTable);

    const mobileDetailWrap = h('div', {
      class: 'cc-mobile-details',
      id: 'cc-mobile-details',
      style: 'display:none'
    });

    resultSection.appendChild(materialGrid);
    resultSection.appendChild(attrGrid);
    resultSection.appendChild(detailWrap);
    resultSection.appendChild(mobileDetailWrap);

    card.appendChild(troopSection);
    card.appendChild(levelSection);
    card.appendChild(actionsSection);
    card.appendChild(resultSection);
    root.appendChild(card);

    const keys = stepKeys(charm.steps || {});
    keys.forEach(function (label, idx) {
      fromSel.appendChild(h('option', { value: String(idx), text: label }));
      toSel.appendChild(h('option', { value: String(idx), text: label }));
    });
    fromSel.value = '0';
    toSel.value = String(Math.max(0, keys.length - 1));

    function clampInputs() {
      infInp.value = String(clampGemCount(infInp.value));
      cavInp.value = String(clampGemCount(cavInp.value));
      arcInp.value = String(clampGemCount(arcInp.value));
    }

    function updateKpiVisibility(infantryAttr, cavalryAttr, archerAttr) {
      const infCard = S_els('cc-inf-attr').closest('.cc-kpi');
      const cavCard = S_els('cc-cav-attr').closest('.cc-kpi');
      const arcCard = S_els('cc-arc-attr').closest('.cc-kpi');

      if (infantryAttr <= 0) infCard.classList.add('is-hidden');
      else infCard.classList.remove('is-hidden');

      if (cavalryAttr <= 0) cavCard.classList.add('is-hidden');
      else cavCard.classList.remove('is-hidden');

      if (archerAttr <= 0) arcCard.classList.add('is-hidden');
      else arcCard.classList.remove('is-hidden');
    }

    function renderDetailHeader(metricDefs) {
      const headRow = S_els('cc-head-row');
      headRow.innerHTML = '';
      headRow.appendChild(h('th', { text: T('calcCharm.table.level', '레벨') }));

      metricDefs.forEach(function (metric) {
        headRow.appendChild(h('th', { html: buildDetailHeadHTML(metric.key) }));
      });
    }

    function renderDesktopRow(tbody, levelText, metricDefs, rowValues, isTotal) {
      const tr = h('tr', isTotal ? { class: 'cc-total-row' } : {});
      tr.appendChild(h('td', { text: levelText }));

      metricDefs.forEach(function (metric) {
        tr.appendChild(h('td', { text: formatMetricValue(metric.key, rowValues[metric.key] || 0) }));
      });

      tbody.appendChild(tr);
    }

    function renderMobileRow(container, levelText, metricDefs, rowValues, isTotal) {
      const row = h('div', { class: 'cc-mobile-row' + (isTotal ? ' cc-mobile-total' : '') }, [
        h('div', { class: 'cc-mobile-head' }, [
          h('div', { class: 'cc-mobile-level', text: levelText })
        ])
      ]);

      const grid = h('div', { class: 'cc-mobile-grid' });

      metricDefs.forEach(function (metric) {
        grid.appendChild(h('div', { class: 'cc-mobile-metric' + (isTotal ? ' cc-mobile-total' : '') }, [
          h('div', { class: 'cc-mobile-metric-top' }, [
            h('div', { class: 'cc-mobile-metric-icon' }, [
              h('img', {
                src: getMetricImg(metric.key),
                alt: getMetricLabel(metric.key),
                loading: 'lazy',
                decoding: 'async'
              })
            ]),
            h('div', { class: 'cc-mobile-metric-label', text: getMetricLabel(metric.key) })
          ]),
          h('div', {
            class: 'cc-mobile-metric-num',
            text: formatMetricValue(metric.key, rowValues[metric.key] || 0)
          })
        ]));
      });

      row.appendChild(grid);
      container.appendChild(row);
    }

    function updateLabels() {
      troopTitle.textContent = T('calcCharm.form.counts.title', '보석 개수');

      fromLabel.textContent = T('calcCharm.form.currentLevel.label', '현재 레벨');
      toLabel.textContent = T('calcCharm.form.targetLevel.label', '목표 레벨');

      infName.textContent = getGemName('infantry');
      cavName.textContent = getGemName('cavalry');
      arcName.textContent = getGemName('archer');

      infBadge.textContent = getClassLabel('infantry');
      cavBadge.textContent = getClassLabel('cavalry');
      arcBadge.textContent = getClassLabel('archer');

      infInp.setAttribute('placeholder', getGemName('infantry'));
      cavInp.setAttribute('placeholder', getGemName('cavalry'));
      arcInp.setAttribute('placeholder', getGemName('archer'));

      infInp.setAttribute('aria-label', getGemName('infantry'));
      cavInp.setAttribute('aria-label', getGemName('cavalry'));
      arcInp.setAttribute('aria-label', getGemName('archer'));

      fromSel.setAttribute('aria-label', T('calcCharm.form.currentLevel.label', '현재 레벨'));
      toSel.setAttribute('aria-label', T('calcCharm.form.targetLevel.label', '목표 레벨'));

      fill18Btn.textContent = T('calcCharm.form.actions.fill18', '기본 6·6·6');
      clearBtn.textContent = T('calcCharm.form.actions.clear', '초기화');

      S_els('cc-kpi-manual-lab').textContent = getResourceLabel('manual');
      S_els('cc-kpi-design-lab').textContent = getResourceLabel('design');
      S_els('cc-kpi-attr-total-lab').textContent = getResourceLabel('attr');
      S_els('cc-kpi-inf-attr-lab').textContent = T('calcCharm.result.infantryAttr', '보병 속성');
      S_els('cc-kpi-cav-attr-lab').textContent = T('calcCharm.result.cavalryAttr', '기병 속성');
      S_els('cc-kpi-arc-attr-lab').textContent = T('calcCharm.result.archerAttr', '궁병 속성');
    }

    function resetOutputs() {
      S_els('cc-manual').textContent = '0';
      S_els('cc-design').textContent = '0';
      S_els('cc-attr-total').textContent = '0%';
      S_els('cc-inf-attr').textContent = '0%';
      S_els('cc-cav-attr').textContent = '0%';
      S_els('cc-arc-attr').textContent = '0%';

      updateKpiVisibility(0, 0, 0);

      S_els('cc-head-row').innerHTML = '';
      S_els('cc-tbody').innerHTML = '';
      mobileDetailWrap.innerHTML = '';
      detailWrap.style.display = 'none';
      mobileDetailWrap.style.display = 'none';
      STATE.last = null;
    }

    function doCalc() {
      clampInputs();

      const fromIdx = parseInt(fromSel.value, 10);
      const toIdx = parseInt(toSel.value, 10);

      const inf = clampGemCount(infInp.value);
      const cav = clampGemCount(cavInp.value);
      const arc = clampGemCount(arcInp.value);

      const totalCount = inf + cav + arc;

      if (toIdx <= fromIdx || totalCount <= 0) {
        resetOutputs();
        return;
      }

      const cost = sumUpgrade(charm.steps, keys, fromIdx, toIdx);
      const attrFinalEach = getAttrFinal(charm.steps, keys, toIdx);

      const totalManual = cost.manual * totalCount;
      const totalDesign = cost.design * totalCount;

      const infantryAttr = attrFinalEach * inf;
      const cavalryAttr = attrFinalEach * cav;
      const archerAttr = attrFinalEach * arc;

      S_els('cc-manual').textContent = fmtCompact(totalManual);
      S_els('cc-design').textContent = fmtCompact(totalDesign);
      S_els('cc-attr-total').textContent = fmtPercent(attrFinalEach) + '%';
      S_els('cc-inf-attr').textContent = fmtPercent(infantryAttr) + '%';
      S_els('cc-cav-attr').textContent = fmtPercent(cavalryAttr) + '%';
      S_els('cc-arc-attr').textContent = fmtPercent(archerAttr) + '%';

      updateKpiVisibility(infantryAttr, cavalryAttr, archerAttr);

      const visibleMetricDefs = getVisibleMetricDefs(infantryAttr, cavalryAttr, archerAttr);
      renderDetailHeader(visibleMetricDefs);

      const tb = S_els('cc-tbody');
      tb.innerHTML = '';
      mobileDetailWrap.innerHTML = '';

      for (let i = fromIdx + 1; i <= toIdx; i++) {
        const k = keys[i];
        const s = charm.steps[k] || {};
        const stepManual = +s.manual || 0;
        const stepDesign = +s.design || +s.blueprint || 0;
        const stepAttrFinal = readAttrValue(s);

        const rowValues = {
          manual: stepManual,
          design: stepDesign,
          infantryAttr: stepAttrFinal * inf,
          cavalryAttr: stepAttrFinal * cav,
          archerAttr: stepAttrFinal * arc
        };

        renderDesktopRow(tb, k, visibleMetricDefs, rowValues, false);
        renderMobileRow(mobileDetailWrap, k, visibleMetricDefs, rowValues, false);
      }

      const totalMetricDefs = visibleMetricDefs.filter(function (metric) {
  return metric.key === 'manual' || metric.key === 'design';
});

const totalRowValues = {
  manual: totalManual,
  design: totalDesign
};

renderDesktopRow(tb, T('calcCharm.table.total', '합계'), totalMetricDefs, totalRowValues, true);
renderMobileRow(mobileDetailWrap, T('calcCharm.table.total', '합계'), totalMetricDefs, totalRowValues, true);

      detailWrap.style.display = '';
      mobileDetailWrap.style.display = '';

      STATE.last = {
        fromIdx: fromIdx,
        toIdx: toIdx,
        inf: inf,
        cav: cav,
        arc: arc
      };
    }

    fill18Btn.addEventListener('click', function () {
      infInp.value = 6;
      cavInp.value = 6;
      arcInp.value = 6;
      doCalc();
    });

    clearBtn.addEventListener('click', function () {
      infInp.value = 0;
      cavInp.value = 0;
      arcInp.value = 0;
      doCalc();
    });

    [fromSel, toSel, infInp, cavInp, arcInp].forEach(function (el) {
      el.addEventListener('change', doCalc);
      el.addEventListener('input', doCalc);
    });

    STATE.root = root;
    STATE.charm = charm;
    STATE.els = {
      fromSel: fromSel,
      toSel: toSel,
      infInp: infInp,
      cavInp: cavInp,
      arcInp: arcInp,
      fill18Btn: fill18Btn,
      clearBtn: clearBtn,
      troopTitle: troopTitle,
      fromLabel: fromLabel,
      toLabel: toLabel,
      infName: infName,
      cavName: cavName,
      arcName: arcName,
      infBadge: infBadge,
      cavBadge: cavBadge,
      arcBadge: arcBadge,
      kpiManualLab: S_els('cc-kpi-manual-lab'),
      kpiDesignLab: S_els('cc-kpi-design-lab'),
      kpiAttrTotalLab: S_els('cc-kpi-attr-total-lab'),
      kpiInfAttrLab: S_els('cc-kpi-inf-attr-lab'),
      kpiCavAttrLab: S_els('cc-kpi-cav-attr-lab'),
      kpiArcAttrLab: S_els('cc-kpi-arc-attr-lab'),
      detailWrap: detailWrap,
      mobileDetailWrap: mobileDetailWrap
    };

    window.__charmCalcReset = resetOutputs;

    if (!window.__charm_i18n_bound__) {
      document.addEventListener('i18n:changed', function () {
        try { window.reapplyCharmCalculatorI18N(); } catch (_) {}
      }, false);
      window.__charm_i18n_bound__ = true;
    }

    updateLabels();
    doCalc();
  }

  window.reapplyCharmCalculatorI18N = function reapplyCharmCalculatorI18N() {
    const S = STATE;
    if (!S.root || !S.charm || !S.els) return;

    S.els.troopTitle.textContent = T('calcCharm.form.counts.title', '보석 개수');
    S.els.fromLabel.textContent = T('calcCharm.form.currentLevel.label', '현재 레벨');
    S.els.toLabel.textContent = T('calcCharm.form.targetLevel.label', '목표 레벨');

    S.els.infName.textContent = getGemName('infantry');
    S.els.cavName.textContent = getGemName('cavalry');
    S.els.arcName.textContent = getGemName('archer');

    S.els.infBadge.textContent = getClassLabel('infantry');
    S.els.cavBadge.textContent = getClassLabel('cavalry');
    S.els.arcBadge.textContent = getClassLabel('archer');

    S.els.infInp.setAttribute('placeholder', getGemName('infantry'));
    S.els.cavInp.setAttribute('placeholder', getGemName('cavalry'));
    S.els.arcInp.setAttribute('placeholder', getGemName('archer'));

    S.els.infInp.setAttribute('aria-label', getGemName('infantry'));
    S.els.cavInp.setAttribute('aria-label', getGemName('cavalry'));
    S.els.arcInp.setAttribute('aria-label', getGemName('archer'));

    S.els.fromSel.setAttribute('aria-label', T('calcCharm.form.currentLevel.label', '현재 레벨'));
    S.els.toSel.setAttribute('aria-label', T('calcCharm.form.targetLevel.label', '목표 레벨'));

    S.els.fill18Btn.textContent = T('calcCharm.form.actions.fill18', '기본 6·6·6');
    S.els.clearBtn.textContent = T('calcCharm.form.actions.clear', '초기화');

    S.els.kpiManualLab.textContent = getResourceLabel('manual');
    S.els.kpiDesignLab.textContent = getResourceLabel('design');
    S.els.kpiAttrTotalLab.textContent = getResourceLabel('attr');
    S.els.kpiInfAttrLab.textContent = T('calcCharm.result.infantryAttr', '보병 속성');
    S.els.kpiCavAttrLab.textContent = T('calcCharm.result.cavalryAttr', '기병 속성');
    S.els.kpiArcAttrLab.textContent = T('calcCharm.result.archerAttr', '궁병 속성');

    if (S.last) {
      S.els.fromSel.value = String(S.last.fromIdx);
      S.els.toSel.value = String(S.last.toIdx);
      S.els.infInp.value = String(S.last.inf);
      S.els.cavInp.value = String(S.last.cav);
      S.els.arcInp.value = String(S.last.arc);
      const evt = document.createEvent('Event');
      evt.initEvent('change', true, true);
      S.els.fromSel.dispatchEvent(evt);
    } else {
      document.getElementById('cc-manual').textContent = '0';
      document.getElementById('cc-design').textContent = '0';
      document.getElementById('cc-attr-total').textContent = '0%';
      document.getElementById('cc-inf-attr').textContent = '0%';
      document.getElementById('cc-cav-attr').textContent = '0%';
      document.getElementById('cc-arc-attr').textContent = '0%';
      updateKpiVisibility(0, 0, 0);
      S_els('cc-head-row').innerHTML = '';
      S.els.detailWrap.style.display = 'none';
      S.els.mobileDetailWrap.style.display = 'none';
    }
  };

  window.initCharmCalculator = initCharmCalculator;
})();
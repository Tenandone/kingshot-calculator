(function () {
  'use strict';

  const T = (k, fb) => {
    try {
      if (window.I18N && typeof window.I18N.t === 'function') {
        return window.I18N.t(k, fb != null ? fb : k);
      }
    } catch (_) {}
    return fb != null ? fb : k;
  };

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
  const slug = (s) => String(s).replace(/\s+/g, '-').toLowerCase();

  function normLabel(s) {
    return String(s || '')
      .replace(/\s+/g, ' ')
      .replace(/\s*\(\s*/g, ' (')
      .replace(/\s*\)\s*/g, ')')
      .trim();
  }

  const ICON_BASE = '/img/icons/';
  const ICON_VER = encodeURIComponent(window.__V || Date.now());

  function iconPath(filename) {
    return ICON_BASE + filename + '?v=' + ICON_VER;
  }

  const SLOT_META = {
    hat: {
      key: 'hat',
      ko: '모자',
      cls: 'cav',
      img: iconPath('hat.png'),
      fallback: '🪖'
    },
    necklace: {
      key: 'necklace',
      ko: '목걸이',
      cls: 'cav',
      img: iconPath('necklace.png'),
      fallback: '📿'
    },
    armor: {
      key: 'armor',
      ko: '상의',
      cls: 'inf',
      img: iconPath('armor.png'),
      fallback: '🛡️'
    },
    pants: {
      key: 'pants',
      ko: '하의',
      cls: 'inf',
      img: iconPath('pants.png'),
      fallback: '👖'
    },
    ring: {
      key: 'ring',
      ko: '반지',
      cls: 'rng',
      img: iconPath('ring.png'),
      fallback: '💍'
    },
    staff: {
      key: 'staff',
      ko: '지팡이',
      cls: 'rng',
      img: iconPath('staff.png'),
      fallback: '🪄'
    }
  };

  const RESOURCE_META = {
    satin: {
      labelKey: 'calcGear.kpi.satin',
      fallback: '비단',
      img: iconPath('silk.png'),
      emoji: '🧵'
    },
    thread: {
      labelKey: 'calcGear.kpi.thread',
      fallback: '금사',
      img: iconPath('threads.png'),
      emoji: '🪙'
    },
    sketch: {
      labelKey: 'calcGear.kpi.sketch',
      fallback: '설계 스케치',
      img: iconPath('sketch.png'),
      emoji: '📜'
    },
    score: {
      labelKey: 'calcGear.kpi.score',
      fallback: '장비 평점',
      img: iconPath('score.png'),
      emoji: '⭐'
    }
  };

  function getClassLabel(clsCode) {
    if (clsCode === 'cav') return T('calcGear.classes.cavalry', '기병');
    if (clsCode === 'inf') return T('calcGear.classes.infantry', '보병');
    return T('calcGear.classes.archer', '궁병');
  }

  function getSlotLabel(slotKey) {
    const meta = SLOT_META[slotKey];
    if (!meta) return slotKey;
    return T('calcGear.slots.' + slotKey, meta.ko);
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
      wrap.appendChild(h('span', { class: 'gc-fallback-emoji', text: fallbackText || '•' }));
    });

    wrap.appendChild(img);
    return wrap;
  }

  function buildTierKeyMapKO() {
    const map = {};

    function add(base, code, stars) {
      map[base] = 'calcGear.tiers.' + code;
      for (let i = 1; i <= stars; i++) {
        map[base + ' (★' + i + ')'] = 'calcGear.tiers.' + code + '_' + i;
      }
    }

    add('고급', 'basic', 1);
    add('레어', 'rare', 3);
    add('에픽', 'epic', 3);
    add('에픽 T1', 'epicT1', 3);

    // 레전드 = mythic 키, T1~T3
    add('레전드', 'mythic', 3);
    add('레전드 T1', 'mythicT1', 3);
    add('레전드 T2', 'mythicT2', 3);
    add('레전드 T3', 'mythicT3', 3);

    // 신화 = legendary 키, T1~T6
    add('신화', 'legendary', 3);
    add('신화 T1', 'legendaryT1', 3);
    add('신화 T2', 'legendaryT2', 3);
    add('신화 T3', 'legendaryT3', 3);
    add('신화 T4', 'legendaryT4', 3);
    add('신화 T5', 'legendaryT5', 3);
    add('신화 T6', 'legendaryT6', 3);

    // 호환용
    add('레전더리', 'legendary', 3);
    add('레전더리 T1', 'legendaryT1', 3);
    add('레전더리 T2', 'legendaryT2', 3);
    add('레전더리 T3', 'legendaryT3', 3);
    add('레전더리 T4', 'legendaryT4', 3);
    add('레전더리 T5', 'legendaryT5', 3);
    add('레전더리 T6', 'legendaryT6', 3);

    return map;
  }

  window.TIER_KEY_MAP_KO = window.TIER_KEY_MAP_KO || buildTierKeyMapKO();

  function localizeTierLabel(raw) {
    let txt = String(raw || '').trim();
    if (!txt) return txt;

    if (txt.indexOf('calcGear.tiers.') === 0) {
      txt = T(txt, txt);
    }

    return txt;
  }

  function sumRange(steps, keys, fromIdx, toIdx) {
    if (fromIdx >= toIdx) {
      return { satin: 0, thread: 0, sketch: 0, score: 0, invalid: true };
    }

    let s = 0;
    let t = 0;
    let sk = 0;
    let sc = 0;

    for (let i = fromIdx + 1; i <= toIdx; i++) {
      const k = keys[i];
      const c = steps[k] || {};
      s += +c.satin || 0;
      t += +c.thread || 0;
      sk += +c.sketch || 0;
      sc += +c.score || 0;
    }

    return { satin: s, thread: t, sketch: sk, score: sc, invalid: false };
  }

  const STATE = {
    root: null,
    gear: null,
    opts: null,
    els: {},
    last: null
  };

  async function initGearCalculator(opt) {
    const {
      mount,
      jsonUrl,
      data,
      slots = null,
      stepsMap = null,
      tierKeyMap: tierKeyMapExternal
    } = opt || {};

    const tierMap = Object.assign({}, window.TIER_KEY_MAP_KO || buildTierKeyMapKO(), tierKeyMapExternal || {});
    const root = document.querySelector(mount);

    if (!root) {
      console.error('[gear-calc] mount element not found:', mount);
      return;
    }

    let gear;
    try {
      if (data) {
        gear = data;
      } else if (jsonUrl) {
        const res = await fetch(jsonUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error('JSON fetch failed: ' + res.status);
        gear = await res.json();
      } else {
        throw new Error('Either jsonUrl or data must be provided.');
      }
    } catch (e) {
      console.error('[gear-calc] failed to load data:', e);
      root.textContent = T('calcGear.alerts.loadFail', '데이터를 불러오지 못했습니다.');
      return;
    }

    const defaultSlotKeys = ['armor', 'pants', 'hat', 'necklace', 'ring', 'staff'];
    const slotKeys = Array.isArray(slots) && slots.length
      ? slots.map((v) => String(v))
      : defaultSlotKeys.slice();

    if (!document.getElementById('gear-calc-style')) {
      const style = document.createElement('style');
      style.id = 'gear-calc-style';
      style.textContent = `
        .gear-calc-wrap{
          font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Pretendard,Arial,sans-serif;
          color:#111827;
        }

        .gear-card{
          border:1px solid #e5e7eb;
          border-radius:24px;
          padding:18px;
          background:#ffffff;
          box-shadow:0 8px 24px rgba(17,24,39,.05);
          max-width:840px;
          margin:0 auto;
        }

        .gc-section + .gc-section{
          margin-top:16px;
        }

        .gc-section-title{
          margin:0 0 10px;
          font-size:15px;
          font-weight:800;
          color:#111827;
        }

        .gc-quick{
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:10px;
        }

        .gc-chip{
          min-height:48px;
          border:1px solid #d8e0ea;
          border-radius:14px;
          background:#fff;
          color:#111827;
          font-size:15px;
          font-weight:800;
          line-height:1.2;
          padding:10px 12px;
          cursor:pointer;
          display:flex;
          align-items:center;
          justify-content:center;
          text-align:center;
          transition:border-color .2s ease, box-shadow .2s ease, background .2s ease;
        }

        .gc-chip:hover{
          border-color:#93c5fd;
          background:#f8fbff;
        }

        .gc-chip.is-active{
          border-color:#2563eb;
          background:#eff6ff;
          box-shadow:0 0 0 3px rgba(37,99,235,.10);
        }

        .gc-selected-status{
          display:none;
        }

        .slot-list{
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:12px;
          margin:0;
        }

        .slot-item{
          position:relative;
          display:block;
          cursor:pointer;
        }

        .slot-item input{
          position:absolute;
          opacity:0;
          pointer-events:none;
        }

        .slot-card{
          position:relative;
          display:flex;
          align-items:center;
          gap:12px;
          min-height:86px;
          padding:14px;
          border:1px solid #e5e7eb;
          border-radius:18px;
          background:#fff;
          transition:border-color .2s ease, box-shadow .2s ease, transform .2s ease, background .2s ease;
        }

        .slot-item input:checked + .slot-card{
          border-color:#2563eb;
          background:#eff6ff;
          box-shadow:0 0 0 3px rgba(37,99,235,.12);
          transform:translateY(-1px);
        }

        .gc-slot-check{
          position:absolute;
          top:10px;
          right:10px;
          width:22px;
          height:22px;
          border-radius:999px;
          border:1.5px solid #cbd5e1;
          background:#fff;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:12px;
          color:transparent;
          transition:all .2s ease;
        }

        .slot-item input:checked + .slot-card .gc-slot-check{
          border-color:#2563eb;
          background:#2563eb;
          color:#fff;
        }

        .gc-slot-thumb{
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

        .gc-slot-thumb img{
          width:100%;
          height:100%;
          object-fit:contain;
          display:block;
        }

        .gc-slot-thumb.is-fallback{
          background:#eef2ff;
        }

        .gc-fallback-emoji{
          font-size:22px;
          line-height:1;
        }

        .gc-slot-text{
          min-width:0;
          flex:1 1 auto;
          display:flex;
          flex-direction:column;
          justify-content:center;
        }

        .gc-slot-name{
          display:block;
          min-height:20px;
          font-size:16px;
          font-weight:800;
          color:#111827;
          line-height:1.2;
          word-break:keep-all;
        }

        .gc-slot-class{
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

        .gc-form-grid{
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:12px;
        }

        .gc-field{
          display:flex;
          flex-direction:column;
          gap:8px;
        }

        .gc-label{
          font-size:14px;
          font-weight:800;
          color:#111827;
          min-height:20px;
          display:flex;
          align-items:center;
        }

        .gc-select{
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
        }

        .gc-select:focus{
          border-color:#2563eb;
          box-shadow:0 0 0 3px rgba(37,99,235,.12);
        }

        .gc-actions-grid{
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:10px;
          margin-top:12px;
        }

        .gc-sub-btn{
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
        }

        .gc-sub-btn:hover{
          background:#f8fafc;
        }

        .gc-sub-btn[disabled]{
          opacity:.55;
          cursor:not-allowed;
        }

        .gear-grid{
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:12px;
        }

        .gear-kpi{
          display:flex;
          align-items:center;
          gap:12px;
          min-height:92px;
          padding:14px;
          border:1px solid #e5e7eb;
          border-radius:18px;
          background:#fff;
        }

        .gc-kpi-thumb{
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

        .gc-kpi-thumb img{
          width:100%;
          height:100%;
          object-fit:contain;
          display:block;
        }

        .gc-kpi-thumb.is-fallback{
          background:#f8fafc;
        }

        .gc-kpi-text{
          min-width:0;
          flex:1 1 auto;
          min-height:50px;
          display:flex;
          flex-direction:column;
          justify-content:center;
        }

        .gear-kpi .num{
          font-size:28px;
          line-height:1.05;
          font-weight:900;
          color:#111827;
          min-height:30px;
          letter-spacing:-.02em;
        }

        .gc-kpi-label{
          margin-top:4px;
          font-size:14px;
          font-weight:700;
          color:#374151;
          min-height:20px;
          display:flex;
          align-items:center;
          word-break:keep-all;
          line-height:1.2;
        }

        .gear-details{
          margin-top:14px;
          font-size:13px;
          background:#fff;
          border:1px solid #e5e7eb;
          border-radius:18px;
          overflow:auto;
        }

        .gear-details table{
          border-collapse:collapse;
          width:100%;
          min-width:720px;
        }

        .gear-details th,
        .gear-details td{
          border-bottom:1px solid #eef2f7;
          padding:10px 12px;
          text-align:left;
          white-space:nowrap;
          vertical-align:middle;
        }

        .gear-details th{
          background:#f8fafc;
          font-weight:800;
          color:#111827;
        }

        .gc-detail-slot-cell{
          display:flex;
          align-items:center;
          gap:10px;
        }

        .gc-detail-slot-icon{
          width:28px;
          height:28px;
          border-radius:8px;
          overflow:hidden;
          border:1px solid #e5e7eb;
          background:#f3f4f6;
          flex:0 0 auto;
        }

        .gc-detail-slot-icon img{
          width:100%;
          height:100%;
          object-fit:contain;
          display:block;
        }

        .gc-detail-inline{
          display:inline-flex;
          align-items:center;
          gap:6px;
        }

        .gc-detail-res-icon{
          width:20px;
          height:20px;
          border-radius:6px;
          overflow:hidden;
          border:1px solid #e5e7eb;
          background:#f8fafc;
          flex:0 0 auto;
        }

        .gc-detail-res-icon img{
          width:100%;
          height:100%;
          object-fit:contain;
          display:block;
        }

        .gc-total-row td{
          font-weight:800;
          background:#eff6ff;
        }

        .gear-mobile-details{
          display:none;
          margin-top:14px;
          gap:10px;
        }

        .gc-mobile-row{
          border:1px solid #e5e7eb;
          border-radius:16px;
          background:#fff;
          padding:12px;
        }

        .gc-mobile-head{
          display:flex;
          align-items:center;
          gap:10px;
          margin-bottom:10px;
        }

        .gc-mobile-slot-icon{
          width:36px;
          height:36px;
          border-radius:10px;
          overflow:hidden;
          border:1px solid #e5e7eb;
          background:#f3f4f6;
          flex:0 0 auto;
        }

        .gc-mobile-slot-icon img{
          width:100%;
          height:100%;
          object-fit:contain;
          display:block;
        }

        .gc-mobile-head-text{
          min-width:0;
          flex:1 1 auto;
        }

        .gc-mobile-slot{
          font-size:15px;
          font-weight:900;
          color:#111827;
          line-height:1.2;
        }

        .gc-mobile-class{
          margin-top:4px;
          display:inline-flex;
          font-size:12px;
          font-weight:800;
          color:#4b5563;
          background:#f3f4f6;
          border-radius:999px;
          padding:5px 8px;
          line-height:1;
          white-space:nowrap;
        }

        .gc-mobile-grid{
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:8px;
        }

        .gc-mobile-metric{
          border:1px solid #eef2f7;
          border-radius:12px;
          padding:10px;
          background:#fafcff;
          min-height:68px;
        }

        .gc-mobile-metric-top{
          display:flex;
          align-items:center;
          gap:6px;
        }

        .gc-mobile-metric-icon{
          width:18px;
          height:18px;
          border-radius:6px;
          overflow:hidden;
          border:1px solid #e5e7eb;
          background:#fff;
          flex:0 0 auto;
        }

        .gc-mobile-metric-icon img{
          width:100%;
          height:100%;
          object-fit:contain;
          display:block;
        }

        .gc-mobile-metric-label{
          font-size:12px;
          font-weight:700;
          color:#6b7280;
          line-height:1.2;
          min-width:0;
          word-break:keep-all;
        }

        .gc-mobile-metric-num{
          margin-top:8px;
          font-size:16px;
          font-weight:900;
          color:#111827;
          line-height:1.1;
        }

        .gc-mobile-total{
          border-color:#bfdbfe;
          background:#eff6ff;
        }

        @media (max-width: 980px){
          .slot-list{
            grid-template-columns:repeat(2,minmax(0,1fr));
          }

          .gear-grid{
            grid-template-columns:repeat(2,minmax(0,1fr));
          }
        }

        @media (max-width: 767px){
          .gear-details{
            display:none;
          }

          .gear-mobile-details{
            display:grid;
          }
        }

        @media (max-width: 640px){
          .gear-card{
            padding:14px;
            border-radius:20px;
          }

          .slot-list{
            grid-template-columns:repeat(2,minmax(0,1fr));
            gap:10px;
          }

          .slot-card{
            min-height:82px;
            padding:12px;
            gap:10px;
          }

          .gc-slot-thumb{
            width:44px;
            height:44px;
            border-radius:12px;
          }

          .gc-slot-name{
            font-size:15px;
          }

          .gc-slot-class{
            font-size:11px;
            min-height:22px;
          }

          .gc-form-grid{
            grid-template-columns:1fr;
          }

          .gc-select{
            height:48px;
            font-size:14px;
          }

          .gc-actions-grid{
            grid-template-columns:repeat(2,minmax(0,1fr));
          }

          .gc-sub-btn{
            min-height:48px;
            border-radius:14px;
            font-size:14px;
          }

          .gear-grid{
            grid-template-columns:repeat(2,minmax(0,1fr));
            gap:10px;
          }

          .gear-kpi{
            min-height:84px;
            padding:12px;
            gap:10px;
          }

          .gc-kpi-thumb{
            width:40px;
            height:40px;
            border-radius:12px;
          }

          .gear-kpi .num{
            font-size:22px;
            min-height:24px;
          }

          .gc-kpi-label{
            font-size:12px;
          }
        }

        @media (max-width: 420px){
          .gc-quick{
            grid-template-columns:1fr 1fr;
            gap:8px;
          }

          .slot-list{
            grid-template-columns:repeat(2,minmax(0,1fr));
          }

          .gc-mobile-grid{
            grid-template-columns:1fr;
          }
        }
      `;
      document.head.appendChild(style);
    }

    root.innerHTML = '';
    root.classList.add('gear-calc-wrap');

    const card = h('div', { class: 'gear-card' });

    const quickSection = h('section', { class: 'gc-section' });
    const quickTitle = h('h3', {
      class: 'gc-section-title',
      id: 'gc-quick-title',
      text: T('calcGear.quick.title', '빠른 선택')
    });

    const quickWrap = h('div', { class: 'gc-quick' });

    const btnSelectAll = h('button', {
      type: 'button',
      class: 'gc-chip',
      id: 'gc-quick-all',
      text: T('calcGear.quick.all', '전체 선택')
    });

    const btnClearAll = h('button', {
      type: 'button',
      class: 'gc-chip',
      id: 'gc-quick-clear',
      text: T('calcGear.quick.clear', '전체 해제')
    });

    quickWrap.appendChild(btnSelectAll);
    quickWrap.appendChild(btnClearAll);

    const selectedStatus = h('div', {
      class: 'gc-selected-status',
      id: 'gc-selected-status',
      text: ''
    });

    quickSection.appendChild(quickTitle);
    quickSection.appendChild(quickWrap);
    quickSection.appendChild(selectedStatus);

    const slotSection = h('section', { class: 'gc-section' });
    const slotTitle = h('h3', {
      class: 'gc-section-title',
      id: 'gc-slot-title',
      text: T('calcGear.cols.slot', '장비 슬롯')
    });

    const slotList = h('div', {
      class: 'slot-list',
      role: 'group',
      'aria-label': T('calcGear.cols.slot', '장비 슬롯')
    });

    const slotCardRefs = [];

    slotKeys.forEach((slotKey) => {
      const meta = SLOT_META[slotKey] || {
        key: slotKey,
        ko: slotKey,
        cls: 'rng',
        img: '',
        fallback: '🎒'
      };

      const id = 'slot-' + slug(slotKey);
      const input = h('input', {
        type: 'checkbox',
        id: id,
        name: 'slot',
        value: slotKey,
        dataset: { slotkey: slotKey, cls: meta.cls }
      });

      const thumb = makeImageBox(meta.img, getSlotLabel(slotKey), meta.fallback, 'gc-slot-thumb');

      const nameSpan = h('span', {
        class: 'gc-slot-name',
        text: getSlotLabel(slotKey),
        dataset: { slotkey: slotKey }
      });

      const clsBadge = h('span', {
        class: 'gc-slot-class gc-class-' + meta.cls,
        text: getClassLabel(meta.cls),
        dataset: { cls: meta.cls }
      });

      const textWrap = h('div', { class: 'gc-slot-text' }, [nameSpan, clsBadge]);
      const check = h('span', { class: 'gc-slot-check', text: '✓' });
      const visual = h('span', { class: 'slot-card' }, [check, thumb, textWrap]);
      const label = h('label', { class: 'slot-item', for: id }, [input, visual]);

      slotList.appendChild(label);
      slotCardRefs.push({ slotKey: slotKey, nameSpan: nameSpan, clsBadge: clsBadge });
    });

    slotSection.appendChild(slotTitle);
    slotSection.appendChild(slotList);

    const formSection = h('section', { class: 'gc-section' });
    const formGrid = h('div', { class: 'gc-form-grid' });

    const fromSel = h('select', {
      class: 'gc-select',
      'aria-label': T('calcGear.cols.current', '현재 단계')
    });

    const toSel = h('select', {
      class: 'gc-select',
      'aria-label': T('calcGear.cols.target', '목표 단계')
    });

    const currentLabel = h('label', {
      class: 'gc-label',
      id: 'gc-lab-current',
      text: T('calcGear.cols.current', '현재 단계')
    });

    const targetLabel = h('label', {
      class: 'gc-label',
      id: 'gc-lab-target',
      text: T('calcGear.cols.target', '목표 단계')
    });

    const currentField = h('div', { class: 'gc-field' }, [currentLabel, fromSel]);
    const targetField = h('div', { class: 'gc-field' }, [targetLabel, toSel]);

    formGrid.appendChild(currentField);
    formGrid.appendChild(targetField);

    const resetBtn = h('button', {
      class: 'gc-sub-btn',
      id: 'gc-reset',
      type: 'button',
      text: T('calcGear.actions.reset', '초기화')
    });

    const copyBtn = h('button', {
      class: 'gc-sub-btn',
      id: 'gc-copy',
      type: 'button',
      text: T('calcGear.actions.copy', '결과 복사'),
      disabled: true
    });

    const actionsGrid = h('div', { class: 'gc-actions-grid' }, [resetBtn, copyBtn]);

    formSection.appendChild(formGrid);
    formSection.appendChild(actionsGrid);

    const resultSection = h('section', { class: 'gc-section' });

    function buildKpiCard(resourceKey) {
      const meta = RESOURCE_META[resourceKey];
      const thumb = makeImageBox(meta.img, getResourceLabel(resourceKey), meta.emoji, 'gc-kpi-thumb');

      const numId =
        resourceKey === 'thread' ? 'gc-thr' :
        resourceKey === 'satin' ? 'gc-sat' :
        resourceKey === 'sketch' ? 'gc-sk' :
        'gc-score';

      const labId =
        resourceKey === 'thread' ? 'gc-kpi-thr-lab' :
        resourceKey === 'satin' ? 'gc-kpi-sat-lab' :
        resourceKey === 'sketch' ? 'gc-kpi-sk-lab' :
        'gc-kpi-score-lab';

      return h('div', { class: 'gear-kpi' }, [
        thumb,
        h('div', { class: 'gc-kpi-text' }, [
          h('div', { class: 'num', id: numId, text: '0' }),
          h('div', { class: 'gc-kpi-label', id: labId, text: getResourceLabel(resourceKey) })
        ])
      ]);
    }

    const grid = h('div', { class: 'gear-grid' }, [
      buildKpiCard('thread'),
      buildKpiCard('satin'),
      buildKpiCard('sketch'),
      buildKpiCard('score')
    ]);

    const detailWrap = h('div', { class: 'gear-details', style: 'display:none' });

    function buildDetailHeadHTML(resourceKey) {
      const meta = RESOURCE_META[resourceKey];
      return (
        '<span class="gc-detail-inline">' +
          '<span class="gc-detail-res-icon"><img src="' + meta.img + '" alt="' + getResourceLabel(resourceKey) + '"></span>' +
          '<span>' + getResourceLabel(resourceKey) + '</span>' +
        '</span>'
      );
    }

    const thSlot = h('th', { id: 'gc-th-slot', text: T('calcGear.cols.slot', '슬롯') });
    const thClass = h('th', { id: 'gc-th-class', text: T('calcGear.cols.class', '병종') });
    const thSatin = h('th', { id: 'gc-th-satin', html: buildDetailHeadHTML('satin') });
    const thThread = h('th', { id: 'gc-th-thread', html: buildDetailHeadHTML('thread') });
    const thSketch = h('th', { id: 'gc-th-sketch', html: buildDetailHeadHTML('sketch') });
    const thScore = h('th', { id: 'gc-th-score', html: buildDetailHeadHTML('score') });

    const detailTable = h('table', {}, [
      h('thead', {}, h('tr', {}, [thSlot, thClass, thSatin, thThread, thSketch, thScore])),
      h('tbody', { id: 'gc-tbody' })
    ]);

    detailWrap.appendChild(detailTable);

    const mobileDetailWrap = h('div', {
      class: 'gear-mobile-details',
      id: 'gc-mobile-details',
      style: 'display:none'
    });

    resultSection.appendChild(grid);
    resultSection.appendChild(detailWrap);
    resultSection.appendChild(mobileDetailWrap);

    card.appendChild(quickSection);
    card.appendChild(slotSection);
    card.appendChild(formSection);
    card.appendChild(resultSection);
    root.appendChild(card);

    function buildDetailSlotHTML(slotKey) {
      const meta = SLOT_META[slotKey] || {};
      return (
        '<div class="gc-detail-slot-cell">' +
          '<span class="gc-detail-slot-icon"><img src="' + (meta.img || '') + '" alt="' + getSlotLabel(slotKey) + '"></span>' +
          '<span>' + getSlotLabel(slotKey) + '</span>' +
        '</div>'
      );
    }

    function getTierLabelByIndex(keys, idx) {
      const k = keys[idx];
      const node = (gear.steps || {})[k];
      const code = node && (node.code || node.tierCode);

      if (code) {
        return localizeTierLabel(T('calcGear.tiers.' + code, 'calcGear.tiers.' + code));
      }

      const rawLabel = normLabel(k);

      if (rawLabel.indexOf('calcGear.tiers.') === 0) {
        return localizeTierLabel(T(rawLabel, rawLabel));
      }

      const i18nKey = tierMap[rawLabel];
      return localizeTierLabel(i18nKey ? T(i18nKey, rawLabel) : rawLabel);
    }

    function getStepsForSlot(slotName) {
      if (stepsMap && stepsMap[slotName]) return stepsMap[slotName];
      return gear.steps || {};
    }

    function populateSelects() {
      const keys = stepKeys(gear.steps || {});
      fromSel.innerHTML = '';
      toSel.innerHTML = '';

      keys.forEach((_, idx) => {
        const label = getTierLabelByIndex(keys, idx);
        fromSel.appendChild(h('option', { value: String(idx), text: label }));
        toSel.appendChild(h('option', { value: String(idx), text: label }));
      });

      fromSel.value = '0';
      toSel.value = String(Math.max(0, keys.length - 1));
    }

    function getCheckedInputs() {
      return Array.from(root.querySelectorAll('input[name="slot"]:checked'));
    }

    function syncQuickButtons() {
      const checkedCount = getCheckedInputs().length;
      btnSelectAll.classList.toggle('is-active', checkedCount === slotKeys.length && slotKeys.length > 0);
      btnClearAll.classList.toggle('is-active', checkedCount === 0);
    }

    function resetOutputs() {
      const sat = document.getElementById('gc-sat');
      const thr = document.getElementById('gc-thr');
      const sk = document.getElementById('gc-sk');
      const sc = document.getElementById('gc-score');
      const tbody = document.getElementById('gc-tbody');

      if (sat) sat.textContent = '0';
      if (thr) thr.textContent = '0';
      if (sk) sk.textContent = '0';
      if (sc) sc.textContent = '0';
      if (tbody) tbody.innerHTML = '';

      mobileDetailWrap.innerHTML = '';
      detailWrap.style.display = 'none';
      mobileDetailWrap.style.display = 'none';
      copyBtn.disabled = true;
      STATE.last = null;
    }

    function updateCompactKPI(total) {
      document.getElementById('gc-thr').textContent = fmtCompact(total.thread);
      document.getElementById('gc-sat').textContent = fmtCompact(total.satin);
      document.getElementById('gc-sk').textContent = fmtCompact(total.sketch);
      document.getElementById('gc-score').textContent = fmtCompact(total.score);
    }

    function runAuto() {
      const checked = getCheckedInputs().map((i) => i.value);
      const fromIdx = parseInt(fromSel.value, 10);
      const toIdx = parseInt(toSel.value, 10);

      if (!checked.length || fromIdx >= toIdx) {
        resetOutputs();
        return;
      }

      let total = { satin: 0, thread: 0, sketch: 0, score: 0 };
      const tbody = document.getElementById('gc-tbody');
      tbody.innerHTML = '';
      mobileDetailWrap.innerHTML = '';

      checked.forEach((slotKey) => {
        const steps = getStepsForSlot(slotKey);
        const keys = stepKeys(steps);
        const r = sumRange(steps, keys, fromIdx, toIdx);
        const meta = SLOT_META[slotKey] || { cls: 'rng' };

        total.satin += r.satin;
        total.thread += r.thread;
        total.sketch += r.sketch;
        total.score += r.score;

        tbody.appendChild(h('tr', {}, [
          h('td', { html: buildDetailSlotHTML(slotKey) }),
          h('td', { text: getClassLabel(meta.cls) }),
          h('td', { text: fmt(r.satin) }),
          h('td', { text: fmt(r.thread) }),
          h('td', { text: fmt(r.sketch) }),
          h('td', { text: fmt(r.score) })
        ]));

        mobileDetailWrap.appendChild(h('div', { class: 'gc-mobile-row' }, [
          h('div', { class: 'gc-mobile-head' }, [
            h('div', { class: 'gc-mobile-slot-icon' }, [
              h('img', { src: meta.img || '', alt: getSlotLabel(slotKey), loading: 'lazy', decoding: 'async' })
            ]),
            h('div', { class: 'gc-mobile-head-text' }, [
              h('div', { class: 'gc-mobile-slot', text: getSlotLabel(slotKey) }),
              h('div', { class: 'gc-mobile-class', text: getClassLabel(meta.cls) })
            ])
          ]),
          h('div', { class: 'gc-mobile-grid' }, [
            h('div', { class: 'gc-mobile-metric' }, [
              h('div', { class: 'gc-mobile-metric-top' }, [
                h('div', { class: 'gc-mobile-metric-icon' }, [
                  h('img', { src: RESOURCE_META.thread.img, alt: getResourceLabel('thread'), loading: 'lazy', decoding: 'async' })
                ]),
                h('div', { class: 'gc-mobile-metric-label', text: getResourceLabel('thread') })
              ]),
              h('div', { class: 'gc-mobile-metric-num', text: fmt(r.thread) })
            ]),
            h('div', { class: 'gc-mobile-metric' }, [
              h('div', { class: 'gc-mobile-metric-top' }, [
                h('div', { class: 'gc-mobile-metric-icon' }, [
                  h('img', { src: RESOURCE_META.satin.img, alt: getResourceLabel('satin'), loading: 'lazy', decoding: 'async' })
                ]),
                h('div', { class: 'gc-mobile-metric-label', text: getResourceLabel('satin') })
              ]),
              h('div', { class: 'gc-mobile-metric-num', text: fmt(r.satin) })
            ]),
            h('div', { class: 'gc-mobile-metric' }, [
              h('div', { class: 'gc-mobile-metric-top' }, [
                h('div', { class: 'gc-mobile-metric-icon' }, [
                  h('img', { src: RESOURCE_META.sketch.img, alt: getResourceLabel('sketch'), loading: 'lazy', decoding: 'async' })
                ]),
                h('div', { class: 'gc-mobile-metric-label', text: getResourceLabel('sketch') })
              ]),
              h('div', { class: 'gc-mobile-metric-num', text: fmt(r.sketch) })
            ]),
            h('div', { class: 'gc-mobile-metric' }, [
              h('div', { class: 'gc-mobile-metric-top' }, [
                h('div', { class: 'gc-mobile-metric-icon' }, [
                  h('img', { src: RESOURCE_META.score.img, alt: getResourceLabel('score'), loading: 'lazy', decoding: 'async' })
                ]),
                h('div', { class: 'gc-mobile-metric-label', text: getResourceLabel('score') })
              ]),
              h('div', { class: 'gc-mobile-metric-num', text: fmt(r.score) })
            ])
          ])
        ]));
      });

      tbody.appendChild(h('tr', { class: 'gc-total-row' }, [
        h('td', { text: T('calcGear.cols.total', '합계') }),
        h('td', { text: T('calcGear.cols.selected', '{n}개 선택').replace('{n}', String(checked.length)) }),
        h('td', { text: fmt(total.satin) }),
        h('td', { text: fmt(total.thread) }),
        h('td', { text: fmt(total.sketch) }),
        h('td', { text: fmt(total.score) })
      ]));

      mobileDetailWrap.appendChild(h('div', { class: 'gc-mobile-row gc-mobile-total' }, [
        h('div', { class: 'gc-mobile-head' }, [
          h('div', { class: 'gc-mobile-head-text' }, [
            h('div', { class: 'gc-mobile-slot', text: T('calcGear.cols.total', '합계') }),
            h('div', { class: 'gc-mobile-class', text: T('calcGear.cols.selected', '{n}개 선택').replace('{n}', String(checked.length)) })
          ])
        ]),
        h('div', { class: 'gc-mobile-grid' }, [
          h('div', { class: 'gc-mobile-metric gc-mobile-total' }, [
            h('div', { class: 'gc-mobile-metric-top' }, [
              h('div', { class: 'gc-mobile-metric-icon' }, [
                h('img', { src: RESOURCE_META.thread.img, alt: getResourceLabel('thread'), loading: 'lazy', decoding: 'async' })
              ]),
              h('div', { class: 'gc-mobile-metric-label', text: getResourceLabel('thread') })
            ]),
            h('div', { class: 'gc-mobile-metric-num', text: fmt(total.thread) })
          ]),
          h('div', { class: 'gc-mobile-metric gc-mobile-total' }, [
            h('div', { class: 'gc-mobile-metric-top' }, [
              h('div', { class: 'gc-mobile-metric-icon' }, [
                h('img', { src: RESOURCE_META.satin.img, alt: getResourceLabel('satin'), loading: 'lazy', decoding: 'async' })
              ]),
              h('div', { class: 'gc-mobile-metric-label', text: getResourceLabel('satin') })
            ]),
            h('div', { class: 'gc-mobile-metric-num', text: fmt(total.satin) })
          ]),
          h('div', { class: 'gc-mobile-metric gc-mobile-total' }, [
            h('div', { class: 'gc-mobile-metric-top' }, [
              h('div', { class: 'gc-mobile-metric-icon' }, [
                h('img', { src: RESOURCE_META.sketch.img, alt: getResourceLabel('sketch'), loading: 'lazy', decoding: 'async' })
              ]),
              h('div', { class: 'gc-mobile-metric-label', text: getResourceLabel('sketch') })
            ]),
            h('div', { class: 'gc-mobile-metric-num', text: fmt(total.sketch) })
          ]),
          h('div', { class: 'gc-mobile-metric gc-mobile-total' }, [
            h('div', { class: 'gc-mobile-metric-top' }, [
              h('div', { class: 'gc-mobile-metric-icon' }, [
                h('img', { src: RESOURCE_META.score.img, alt: getResourceLabel('score'), loading: 'lazy', decoding: 'async' })
              ]),
              h('div', { class: 'gc-mobile-metric-label', text: getResourceLabel('score') })
            ]),
            h('div', { class: 'gc-mobile-metric-num', text: fmt(total.score) })
          ])
        ])
      ]));

      updateCompactKPI(total);

      detailWrap.style.display = '';
      mobileDetailWrap.style.display = '';
      copyBtn.disabled = false;

      STATE.last = {
        checkedKeys: Array.from(root.querySelectorAll('input[name="slot"]:checked')).map((i) => i.dataset.slotkey || i.value),
        fromIdx: parseInt(fromSel.value, 10),
        toIdx: parseInt(toSel.value, 10),
        total: total
      };
    }

    function resetAll() {
      root.querySelectorAll('input[name="slot"]').forEach((i) => { i.checked = false; });
      const keys = stepKeys(gear.steps || {});
      fromSel.value = '0';
      toSel.value = String(Math.max(0, keys.length - 1));
      syncQuickButtons();
      resetOutputs();
    }

    function getCurrentTierLabel() {
      const keys = stepKeys(gear.steps || {});
      return getTierLabelByIndex(keys, parseInt(fromSel.value, 10));
    }

    function getTargetTierLabel() {
      const keys = stepKeys(gear.steps || {});
      return getTierLabelByIndex(keys, parseInt(toSel.value, 10));
    }

    async function copyResult() {
      if (copyBtn.disabled || !STATE.last) return;

      const checkedKeys = STATE.last.checkedKeys || [];
      const slotNames = checkedKeys.map(getSlotLabel).join(', ');
      const text =
        T('calcGear.cols.slot', '슬롯') + ': ' + slotNames + '\n' +
        T('calcGear.cols.current', '현재 단계') + ': ' + getCurrentTierLabel() + '\n' +
        T('calcGear.cols.target', '목표 단계') + ': ' + getTargetTierLabel() + '\n\n' +
        getResourceLabel('thread') + ': ' + fmt(STATE.last.total.thread) + '\n' +
        getResourceLabel('satin') + ': ' + fmt(STATE.last.total.satin) + '\n' +
        getResourceLabel('sketch') + ': ' + fmt(STATE.last.total.sketch) + '\n' +
        getResourceLabel('score') + ': ' + fmt(STATE.last.total.score);

      try {
        await navigator.clipboard.writeText(text);
        const old = copyBtn.textContent;
        copyBtn.textContent = T('calcGear.actions.copied', '복사 완료');
        setTimeout(function () {
          copyBtn.textContent = old;
        }, 1400);
      } catch (_) {
        try {
          const ta = h('textarea', { style: 'position:fixed;left:-9999px;top:-9999px;' });
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          const old = copyBtn.textContent;
          copyBtn.textContent = T('calcGear.actions.copied', '복사 완료');
          setTimeout(function () {
            copyBtn.textContent = old;
          }, 1400);
        } catch (e) {}
      }
    }

    function setCheckedAll(on) {
      root.querySelectorAll('input[name="slot"]').forEach((i) => { i.checked = !!on; });
      syncQuickButtons();
      runAuto();
    }

    btnSelectAll.addEventListener('click', function () { setCheckedAll(true); });
    btnClearAll.addEventListener('click', function () { setCheckedAll(false); });

    root.querySelectorAll('input[name="slot"]').forEach(function (input) {
      input.addEventListener('change', function () {
        syncQuickButtons();
        runAuto();
      });
    });

    fromSel.addEventListener('change', runAuto);
    toSel.addEventListener('change', runAuto);

    resetBtn.addEventListener('click', resetAll);
    copyBtn.addEventListener('click', copyResult);

    populateSelects();
    syncQuickButtons();
    resetOutputs();

    STATE.root = root;
    STATE.gear = gear;
    STATE.opts = {
      slotKeys: slotKeys,
      slotCardRefs: slotCardRefs,
      tierKeyMap: tierMap
    };
    STATE.els = {
      fromSel: fromSel,
      toSel: toSel,
      detailWrap: detailWrap,
      mobileDetailWrap: mobileDetailWrap,
      slotTitle: slotTitle,
      quickTitle: quickTitle,
      quickBtns: {
        all: btnSelectAll,
        clear: btnClearAll
      },
      resetBtn: resetBtn,
      copyBtn: copyBtn,
      kpiLabs: {
        sat: document.getElementById('gc-kpi-sat-lab'),
        thr: document.getElementById('gc-kpi-thr-lab'),
        sk: document.getElementById('gc-kpi-sk-lab'),
        sc: document.getElementById('gc-kpi-score-lab')
      },
      hdrs: {
        slot: thSlot,
        cls: thClass,
        sat: thSatin,
        thr: thThread,
        sk: thSketch,
        sc: thScore
      },
      rowLabs: {
        current: currentLabel,
        target: targetLabel
      }
    };

    window.__gearCalcReset = resetOutputs;

    if (!window.__gear_i18n_bound__) {
      document.addEventListener('i18n:changed', function () {
        try { window.reapplyGearCalculatorI18N(); } catch (_) {}
      }, false);
      window.__gear_i18n_bound__ = true;
    }
  }

  window.reapplyGearCalculatorI18N = function reapplyGearCalculatorI18N() {
    const S = STATE;
    if (!S.root || !S.gear || !S.opts || !S.els) return;

    const slotCardRefs = S.opts.slotCardRefs;
    const tierKeyMap = S.opts.tierKeyMap;
    const fromSel = S.els.fromSel;
    const toSel = S.els.toSel;
    const detailWrap = S.els.detailWrap;
    const mobileDetailWrap = S.els.mobileDetailWrap;
    const slotTitle = S.els.slotTitle;
    const quickTitle = S.els.quickTitle;
    const quickBtns = S.els.quickBtns;
    const resetBtn = S.els.resetBtn;
    const copyBtn = S.els.copyBtn;
    const kpiLabs = S.els.kpiLabs;
    const hdrs = S.els.hdrs;
    const rowLabs = S.els.rowLabs;

    quickTitle.textContent = T('calcGear.quick.title', '빠른 선택');
    slotTitle.textContent = T('calcGear.cols.slot', '장비 슬롯');

    quickBtns.all.textContent = T('calcGear.quick.all', '전체 선택');
    quickBtns.clear.textContent = T('calcGear.quick.clear', '전체 해제');

    rowLabs.current.textContent = T('calcGear.cols.current', '현재 단계');
    rowLabs.target.textContent = T('calcGear.cols.target', '목표 단계');

    resetBtn.textContent = T('calcGear.actions.reset', '초기화');
    copyBtn.textContent = copyBtn.disabled ? T('calcGear.actions.copy', '결과 복사') : copyBtn.textContent;

    kpiLabs.sat.textContent = getResourceLabel('satin');
    kpiLabs.thr.textContent = getResourceLabel('thread');
    kpiLabs.sk.textContent = getResourceLabel('sketch');
    kpiLabs.sc.textContent = getResourceLabel('score');

    hdrs.slot.textContent = T('calcGear.cols.slot', '슬롯');
    hdrs.cls.textContent = T('calcGear.cols.class', '병종');
    hdrs.sat.innerHTML = '<span class="gc-detail-inline"><span class="gc-detail-res-icon"><img src="' + RESOURCE_META.satin.img + '" alt="' + getResourceLabel('satin') + '"></span><span>' + getResourceLabel('satin') + '</span></span>';
    hdrs.thr.innerHTML = '<span class="gc-detail-inline"><span class="gc-detail-res-icon"><img src="' + RESOURCE_META.thread.img + '" alt="' + getResourceLabel('thread') + '"></span><span>' + getResourceLabel('thread') + '</span></span>';
    hdrs.sk.innerHTML = '<span class="gc-detail-inline"><span class="gc-detail-res-icon"><img src="' + RESOURCE_META.sketch.img + '" alt="' + getResourceLabel('sketch') + '"></span><span>' + getResourceLabel('sketch') + '</span></span>';
    hdrs.sc.innerHTML = '<span class="gc-detail-inline"><span class="gc-detail-res-icon"><img src="' + RESOURCE_META.score.img + '" alt="' + getResourceLabel('score') + '"></span><span>' + getResourceLabel('score') + '</span></span>';

    slotCardRefs.forEach(function (ref) {
      const meta = SLOT_META[ref.slotKey] || { cls: 'rng' };
      ref.nameSpan.textContent = getSlotLabel(ref.slotKey);
      ref.clsBadge.textContent = getClassLabel(meta.cls);
    });

    const keys = stepKeys(S.gear.steps || {});
    const keepFrom = parseInt(fromSel.value || '0', 10);
    const keepTo = parseInt(toSel.value || String(Math.max(0, keys.length - 1)), 10);

    function getTierLabelByIndex(ks, idx) {
      const k = ks[idx];
      const node = (S.gear.steps || {})[k];
      const code = node && (node.code || node.tierCode);

      if (code) {
        return localizeTierLabel(T('calcGear.tiers.' + code, 'calcGear.tiers.' + code));
      }

      const raw = normLabel(k);

      if (raw.indexOf('calcGear.tiers.') === 0) {
        return localizeTierLabel(T(raw, raw));
      }

      const i18nKey = (tierKeyMap || {})[raw];
      return localizeTierLabel(i18nKey ? T(i18nKey, raw) : raw);
    }

    fromSel.innerHTML = '';
    toSel.innerHTML = '';

    keys.forEach(function (_, idx) {
      const lbl = getTierLabelByIndex(keys, idx);
      fromSel.appendChild(h('option', { value: String(idx), text: lbl }));
      toSel.appendChild(h('option', { value: String(idx), text: lbl }));
    });

    fromSel.value = String(Math.max(0, Math.min(keepFrom, Math.max(0, keys.length - 1))));
    toSel.value = String(Math.max(0, Math.min(keepTo, Math.max(0, keys.length - 1))));

    if (S.last) {
      const want = new Set(S.last.checkedKeys);

      S.root.querySelectorAll('input[name="slot"]').forEach(function (i) {
        const key = i.dataset.slotkey || i.value;
        i.checked = want.has(key);
      });

      fromSel.value = String(Math.max(0, Math.min(S.last.fromIdx, Math.max(0, keys.length - 1))));
      toSel.value = String(Math.max(0, Math.min(S.last.toIdx, Math.max(0, keys.length - 1))));

      const evt = document.createEvent('Event');
      evt.initEvent('change', true, true);
      fromSel.dispatchEvent(evt);
    } else {
      S.root.querySelectorAll('input[name="slot"]').forEach(function (i) {
        i.checked = false;
      });
      document.getElementById('gc-sat').textContent = '0';
      document.getElementById('gc-thr').textContent = '0';
      document.getElementById('gc-sk').textContent = '0';
      document.getElementById('gc-score').textContent = '0';
      detailWrap.style.display = 'none';
      mobileDetailWrap.style.display = 'none';
      copyBtn.disabled = true;
    }
  };

  window.initGearCalculator = initGearCalculator;
})(); 
(function () {
  'use strict';

  // ========= 전역 초기화 가드(중복 로드 방지) =========
  if (window.__calculatorScriptLoaded__) {
    console.info('[calc] calculator.js already loaded — skipping duplicate definition');
    return;
  }
  window.__calculatorScriptLoaded__ = true;

  // ---------- i18n helpers ----------
  const t = (k, fb) => {
    try {
      if (window.I18N && typeof window.I18N.t === 'function') {
        const v = window.I18N.t(k, (fb !== undefined ? fb : k));
        return (v === undefined || v === null) ? (fb !== undefined ? fb : k) : v;
      }
    } catch (_) {}
    return (fb !== undefined ? fb : k);
  };

  // JSON slug 그대로 사용
  const BUILDING_I18N_KEY = {
    towncenter: 'calc.form.building.option.towncenter',
    embassy: 'calc.form.building.option.embassy',
    academy: 'calc.form.building.option.academy',
    waracademy: 'calc.form.building.option.war-academy',
    commandcenter: 'calc.form.building.option.command',
    barracks: 'calc.form.building.option.barracks',
    stable: 'calc.form.building.option.stable',
    range: 'calc.form.building.option.range',
    infirmary: 'calc.form.building.option.infirmary'
  };
  const getBuildingLabel = (key) => t(BUILDING_I18N_KEY[key] || key, key);

  // ---------- 리소스 아이콘 ----------
  const ICON_BASE = 'img/icons/';
  const RES_ICON = {
    bread: ICON_BASE + 'bread.webp',
    wood: ICON_BASE + 'wood.webp',
    stone: ICON_BASE + 'stone.webp',
    iron: ICON_BASE + 'iron.webp',
    truegold: ICON_BASE + 'truegold.webp',
    tempered_truegold: ICON_BASE + 'tempered-truegold.webp'
  };

  function iconHtml(src, alt, size) {
    const px = size || 16;
    return '<img src="' + src + '" alt="' + alt + '" style="width:' + px + 'px;height:' + px + 'px;object-fit:contain;display:inline-block;vertical-align:middle;">';
  }

  function resourceLabelHtml(type, text, size) {
    if (!RES_ICON[type]) return text;
    return '<span style="display:inline-flex;align-items:center;justify-content:center;gap:6px;">' + iconHtml(RES_ICON[type], text, size) + '<span>' + text + '</span></span>';
  }

  // ------------------------ 상태 ------------------------
  const allBuildingData = {};
  let prereqMap = {};
  let _loaded = false;
  let _loadingPromise = null;

  // ===== 선행 제한 & 최소 레벨 =====
  const ALLOWED_PREREQ = new Set([
    'towncenter',
    'academy',
    'barracks',
    'range',
    'stable',
    'embassy'
  ]);
  const PREREQ_MIN_LV = 3;
  const DISPLAY_ORDER_PREREQ = ['towncenter', 'academy', 'barracks', 'range', 'stable', 'embassy'];

  // ===== 최대 레벨 =====
  const MAX_LV = 80;

  // ------------------------ 스타일 주입 ------------------------
  function injectCalculatorStyles() {
    if (document.getElementById('ks-calc-runtime-style')) return;

    const style = document.createElement('style');
    style.id = 'ks-calc-runtime-style';
    style.textContent = [
      '.ks-calc-shell{max-width:1180px;margin:0 auto;padding:0 16px;}',
      '.ks-calc-card{background:linear-gradient(180deg,#e7f1ff 0%,#d9e9ff 100%);border:1px solid rgba(0,74,153,.14);border-radius:22px;box-shadow:0 14px 36px rgba(22,63,117,.10);}',
      '.ks-calc-summary-card{padding:22px 22px;color:#004a99;}',
      '.ks-calc-summary-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;}',
      '.ks-calc-summary-title{font-size:24px;line-height:1.25;font-weight:900;margin:0;color:#0d2f57;}',
      '.ks-calc-summary-sub{font-size:14px;opacity:.92;margin-top:6px;color:#36587f;}',
      '.ks-calc-summary-time{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.72);border:1px solid rgba(0,74,153,.08);border-radius:14px;padding:12px 14px;font-weight:800;color:#0d3e77;box-shadow:inset 0 1px 0 rgba(255,255,255,.7);}',
      '.ks-calc-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-top:18px;}',
      '.ks-calc-stat{background:linear-gradient(180deg,rgba(255,255,255,.92) 0%,rgba(247,251,255,.92) 100%);border:1px solid rgba(0,74,153,.08);border-radius:18px;padding:14px 14px;min-height:102px;display:flex;flex-direction:column;justify-content:center;box-shadow:0 6px 16px rgba(31,53,81,.05);}',
      '.ks-calc-stat-label{font-size:13px;font-weight:800;opacity:.95;margin-bottom:8px;color:#36587f;}',
      '.ks-calc-stat-value{font-size:34px;font-weight:900;line-height:1.05;color:#003f84;letter-spacing:-0.02em;word-break:break-word;}',
      '.ks-calc-stat-sub{font-size:12px;opacity:.88;margin-top:6px;color:#5b7291;}',
      '.ks-calc-section{max-width:1180px;margin:14px auto 0;}',
      '.ks-calc-section-title{font-size:18px;font-weight:800;margin:0 0 10px;color:#1b2d42;}',
      '.ks-calc-prereq-card{padding:16px 18px;background:#fff;border:1px solid #e5edf7;border-radius:16px;box-shadow:0 6px 20px rgba(31,53,81,.05);}',
      '.ks-calc-prereq-title{text-align:center;}',
      '.ks-calc-prereq-list{margin:0;padding:0;line-height:1.85;list-style:none;text-align:center;}',
      '.ks-calc-prereq-list li{display:block;}',
      '.ks-calc-prereq-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:10px;}',
      '.ks-calc-prereq-chip{background:#f5f9ff;border:1px solid #dbe8f7;border-radius:12px;padding:10px 12px;text-align:center;}',
      '.ks-calc-prereq-chip a{color:#004a99;text-decoration:none;font-weight:800;}',
      '.ks-calc-prereq-chip a:hover{text-decoration:underline;}',
      '.ks-calc-levelhint{display:inline-flex;align-items:center;gap:6px;margin-left:8px;font-size:12px;font-weight:800;color:#4f6f93;background:#eef5ff;border:1px solid #dbe7f5;border-radius:999px;padding:4px 10px;vertical-align:middle;white-space:nowrap;}',
      '.ks-calc-levelhint.is-empty{color:#7a8da5;background:#f6f9fc;}',
      '.ks-calc-table-wrap{max-width:1180px;margin:14px auto 0;background:#fff;border:1px solid #e5edf7;border-radius:18px;box-shadow:0 8px 26px rgba(31,53,81,.06);overflow:hidden;}',
      '.ks-calc-table-head{padding:16px 18px 0 18px;}',
      '.ks-calc-table-scroll{padding:12px 12px 14px 12px;overflow-x:visible;}',
      '.ks-calc-table{border-collapse:separate;border-spacing:0;width:100%;table-layout:fixed;text-align:center;font-size:11px;}',
      '.ks-calc-table th{background:#eef4fb;color:#1b2d42;font-weight:800;padding:10px 4px;border-bottom:1px solid #d9e5f2;border-top:1px solid #d9e5f2;word-break:keep-all;vertical-align:middle;}',
      '.ks-calc-table td{padding:9px 4px;border-bottom:1px solid #edf2f7;font-weight:700;color:#24364b;background:#fff;word-break:break-word;vertical-align:middle;}',
      '.ks-calc-table thead th span{justify-content:center;}',
      '.ks-calc-table tbody tr:nth-child(even) td{background:#fbfdff;}',
      '.ks-calc-table tbody tr:hover td{background:#f4f9ff;}',
      '.ks-calc-building-link{color:#004a99;text-decoration:none;font-weight:800;}',
      '.ks-calc-building-link:hover{text-decoration:underline;}',
      '.ks-calc-sticky-note{font-size:12px;color:#6a7b91;margin-top:6px;text-align:center;}',
      '.ks-calc-mobile-cards{display:none;}',
      '.ks-calc-mobile-group{margin-top:12px;}',
      '.ks-calc-mobile-group-title{font-size:16px;font-weight:900;color:#163455;margin:0 0 8px 0;padding:0 4px;}',
      '.ks-calc-mobile-card{background:#fff;border:1px solid #e4edf7;border-radius:16px;padding:14px 14px;margin-bottom:10px;box-shadow:0 6px 18px rgba(31,53,81,.05);}',
      '.ks-calc-mobile-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}',
      '.ks-calc-mobile-building{font-size:14px;font-weight:900;color:#163455;}',
      '.ks-calc-mobile-level{font-size:13px;font-weight:900;color:#004a99;background:#eef5ff;padding:6px 10px;border-radius:999px;white-space:nowrap;}',
      '.ks-calc-mobile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}',
      '.ks-calc-mobile-item{background:#f8fbff;border:1px solid #e5eef8;border-radius:12px;padding:10px 10px;text-align:left;}',
      '.ks-calc-mobile-item-label{font-size:11px;font-weight:800;color:#59708d;margin-bottom:4px;}',
      '.ks-calc-mobile-item-value{font-size:15px;font-weight:900;color:#17385f;line-height:1.15;word-break:break-word;}',
      '@media (max-width:768px){',
      '  .ks-calc-shell{padding:0 12px;}',
      '  .ks-calc-summary-card{padding:16px 14px;}',
      '  .ks-calc-summary-title{font-size:20px;}',
      '  .ks-calc-stat-value{font-size:28px;}',
      '  .ks-calc-table-wrap{display:none;}',
      '  .ks-calc-mobile-cards{display:block;max-width:1180px;margin:14px auto 0;}',
      '  .ks-calc-levelhint{display:inline-flex;margin-top:6px;margin-left:0;}',
      '}'
    ].join('');
    document.head.appendChild(style);
  }

  // ------------------------ 유틸 ------------------------
  function parseRes(v) {
    if (v == null) return 0;
    const s = String(v).trim().toLowerCase().replace(/,/g, '');
    if (!s || s === '-' || s === '–') return 0;

    const m = s.match(/^(-?\d+(?:\.\d+)?)([kmb])?$/i);
    if (m) {
      let n = parseFloat(m[1]);
      const u = (m[2] || '').toLowerCase();
      if (u === 'k') n *= 1e3;
      else if (u === 'm') n *= 1e6;
      else if (u === 'b') n *= 1e9;
      return n;
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function labelToLevelNumber(x) {
    if (typeof x === 'number') return x;

    const raw = String(x).trim();
    if (!raw) return 0;

    const s = raw.toUpperCase().replace(/\s+/g, '');

    if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : 0;
    }

    if (/^TC\d+$/.test(s)) {
      const n = parseInt(s.slice(2), 10);
      return Number.isFinite(n) ? n : 0;
    }

    if (/^30-\d+$/.test(s)) {
      const sub = parseInt(s.split('-')[1], 10);
      return 30 + sub;
    }

    if (/^TG\d+$/.test(s)) {
      const n = parseInt(s.slice(2), 10);
      return 30 + (n * 5);
    }

    if (/^TG\d+-\d+$/.test(s)) {
      const parts = s.split('-');
      const tg = parseInt(parts[0].slice(2), 10);
      const sub = parseInt(parts[1], 10);
      return 30 + (tg * 5) + sub;
    }

    return 0;
  }

  function formatLevelLabel(n) {
    n = Number(n || 0);
    if (!Number.isFinite(n) || n <= 0) return '';

    if (n <= 30) return 'TC' + n;
    if (n >= 31 && n <= 34) return '30-' + (n - 30);

    if ((n - 30) % 5 === 0) {
      return 'TG' + ((n - 30) / 5);
    }

    var tg = Math.floor((n - 30) / 5);
    var rem = (n - 30) % 5;
    return 'TG' + tg + '-' + rem;
  }

  function parseTimeToSec(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return Math.max(0, Math.round(v * 60));

    let s = String(v).trim().toLowerCase();

    if (/^\d+(\.\d+)?$/.test(s)) {
      return Math.max(0, Math.round(parseFloat(s) * 60));
    }

    let d = 0, h = 0, m = 0, sec = 0;

    s.replace(/(\d+)\s*d/g, function (_, n) { d = +n; return _; });
    s.replace(/(\d+)\s*h/g, function (_, n) { h = +n; return _; });
    s.replace(/(\d+)\s*m/g, function (_, n) { m = +n; return _; });
    s.replace(/(\d+)\s*s/g, function (_, n) { sec = +n; return _; });

    s.replace(/(\d+)\s*일/g, function (_, n) { d = +n; return _; });
    s.replace(/(\d+)\s*시(?:간)?/g, function (_, n) { h = +n; return _; });
    s.replace(/(\d+)\s*분/g, function (_, n) { m = +n; return _; });
    s.replace(/(\d+)\s*초/g, function (_, n) { sec = +n; return _; });

    if (d + h + m + sec > 0) return d * 86400 + h * 3600 + m * 60 + sec;

    const n = Number(s.replace(/,/g, ''));
    if (Number.isFinite(n)) {
      return n >= 100000 ? Math.round(n) : Math.round(n * 60);
    }

    return 0;
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));

    const d = Math.floor(sec / 86400);
    sec %= 86400;
    const h = Math.floor(sec / 3600);
    sec %= 3600;
    const m = Math.floor(sec / 60);
    const s = sec % 60;

    const out = [];
    if (d) out.push(d + t('calc.time.daySuffix', '일'));
    if (h) out.push(h + t('calc.time.hourSuffix', '시간'));
    if (m) out.push(m + t('calc.time.minSuffix', '분'));
    if (s) out.push(s + t('calc.time.secSuffix', '초'));

    return out.join(' ') || ('0' + t('calc.time.secSuffix', '초'));
  }

  function formatTimeNoMinutes(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);

    const out = [];
    if (d) out.push(d + t('calc.time.daySuffix', '일'));
    if (h) out.push(h + t('calc.time.hourSuffix', '시간'));

    return out.join(' ') || '-';
  }

  function roundDisplayNumber(v) {
    return Math.round(+v || 0);
  }

  function formatCompactNumber(v) {
    const n = Math.round(+v || 0);
    const abs = Math.abs(n);

    if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toLocaleString();
  }

  function displayValue(v, compact) {
    const n = Math.round(+v || 0);
    if (n === 0) return '-';
    return compact ? formatCompactNumber(n) : n.toLocaleString();
  }

  function intText(v) {
    const n = Math.round(+v || 0);
    return n === 0 ? '-' : n.toLocaleString();
  }

  function buildInternalLink(buildingKey) {
    const map = {
      towncenter: '/buildings/towncenter',
      embassy: '/buildings/embassy',
      academy: '/buildings/academy',
      waracademy: '/buildings/war-academy',
      commandcenter: '/buildings/command-center',
      barracks: '/buildings/barracks',
      stable: '/buildings/stable',
      range: '/buildings/range',
      infirmary: '/buildings/infirmary'
    };
    return map[buildingKey] || '#';
  }

  function buildingLinkHtml(buildingKey, label) {
    const href = buildInternalLink(buildingKey);
    if (!href || href === '#') return label;
    return '<a class="ks-calc-building-link" href="' + href + '" data-ks-building-link="' + buildingKey + '">' + label + '</a>';
  }

  function guessBasePath() {
    const baseTag = document.querySelector('base[href]');
    if (baseTag) {
      try {
        return new URL(baseTag.getAttribute('href'), location.origin).pathname || '/';
      } catch (_) {}
    }

    const seg = location.pathname.split('/').filter(Boolean);
    if (seg.length > 0 && !seg[0].includes('.')) return '/' + seg[0] + '/';
    return '/';
  }

  async function fetchJsonSafe(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);

    const ct = (r.headers.get('content-type') || '').toLowerCase();
    const text = await r.text();
    const looksJson = /application\/json|text\/json/.test(ct) || /^\s*[{[]/.test(text);

    if (!looksJson) {
      const head = text.slice(0, 120).replace(/\s+/g, ' ');
      throw new Error('Not JSON from ' + url + ' (got HTML/text): "' + head + '..."');
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('JSON parse failed at ' + url + ': ' + e.message);
    }
  }

  async function loadBuildingsJson() {
    const ts = Date.now();
    const base = guessBasePath();

    const candidates = [
      '/data/buildings-calc.json?v=' + ts,
      base + 'data/buildings-calc.json?v=' + ts,
      'data/buildings-calc.json?v=' + ts,
      '../data/buildings-calc.json?v=' + ts,
      '../../data/buildings-calc.json?v=' + ts
    ];

    const errors = [];

    for (const u of candidates) {
      try {
        const j = await fetchJsonSafe(u);
        const arr = Array.isArray(j.buildings) ? j.buildings : [];
        console.info('[calc] buildings JSON loaded from:', u, '(count:', arr.length, ')');
        return arr;
      } catch (e) {
        errors.push(u + ' → ' + e.message);
      }
    }

    console.error('[calc] Failed to load buildings JSON:\n' + errors.join('\n'));
    throw new Error('buildings-calc.json 로드 실패');
  }

  function findHeaderIndex(header, patterns) {
    for (let i = 0; i < header.length; i++) {
      const h = String(header[i] || '');
      for (const p of patterns) {
        if (p instanceof RegExp) {
          if (p.test(h)) return i;
        } else {
          if (h.indexOf(String(p)) > -1) return i;
        }
      }
    }
    return -1;
  }

  function tableToRows(table) {
    if (!Array.isArray(table) || !table.length) return [];

    const header = table[0].map(String);
    const body = table.slice(1);

    const idx = {
      level: findHeaderIndex(header, ['레벨', /level/i, /stage/i, /단계/i]),
      bread: findHeaderIndex(header, ['빵', /bread/i, /food/i]),
      wood: findHeaderIndex(header, ['나무', /wood/i]),
      stone: findHeaderIndex(header, ['석재', '돌', /stone/i]),
      iron: findHeaderIndex(header, ['철', /iron/i]),
      truegold: findHeaderIndex(header, ['트루골드', '순금', /truegold/i, /true\s*gold/i, /\btg\b/i]),
      tempered: findHeaderIndex(header, ['담금질 된 순금', '담금질순금', '담금질', /tempered/i]),
      time: (function () {
        let i = findHeaderIndex(header, ['건설', /build/i]);
        if (i < 0) i = findHeaderIndex(header, ['시간', /(min|minute)/i, /\(분\)/]);
        return i;
      })(),
      req: findHeaderIndex(header, ['요구 건물', '요구사항', '요구', /require/i])
    };

    const get = (row, i) => (i >= 0 && i < row.length) ? row[i] : 0;

    return body.map(function (row) {
      const level = labelToLevelNumber(get(row, idx.level));
      const stageLabel = formatLevelLabel(level);

      const bread = parseRes(get(row, idx.bread));
      const wood = parseRes(get(row, idx.wood));
      const stone = parseRes(get(row, idx.stone));
      const iron = parseRes(get(row, idx.iron));
      const truegold = parseRes(get(row, idx.truegold));
      const tempered_truegold = parseRes(get(row, idx.tempered));
      const time = parseTimeToSec(get(row, idx.time));
      const reqStr = idx.req >= 0 ? String(get(row, idx.req) || '') : '';

      return {
        level,
        stageLabel,
        bread,
        wood,
        stone,
        iron,
        truegold,
        tempered_truegold,
        time,
        _req: reqStr
      };
    }).filter(function (r) {
      return r.level > 0 && r.level <= MAX_LV;
    });
  }

  function parseReqList(reqStr) {
    if (!reqStr) return [];

    return reqStr
      .split(',')
      .map(function (s) { return s.trim(); })
      .filter(Boolean)
      .map(function (token) {
        var raw = String(token || '').trim();
        if (!raw || raw === '-') return null;

        var map = {
          '도시센터': 'towncenter',
          '대사관': 'embassy',
          '아카데미': 'academy',
          '지휘부': 'commandcenter',
          '보병대': 'barracks',
          '기병대': 'stable',
          '궁병대': 'range',
          '야전병원': 'infirmary',
          '전쟁아카데미': 'waracademy'
        };

        var buildingName = '';
        var levelText = '';

        var m1 = raw.match(/^(.*?)(?:\s*Lv\.?\s*)(TG\d+(?:-\d+)?|TC\d+|\d+(?:-\d+)?)$/i);
        if (m1) {
          buildingName = (m1[1] || '').trim();
          levelText = (m1[2] || '').trim();
        } else {
          var m2 = raw.match(/^(.*?)[\s]+(TG\d+(?:-\d+)?|TC\d+|\d+(?:-\d+)?)$/i);
          if (m2) {
            buildingName = (m2[1] || '').trim();
            levelText = (m2[2] || '').trim();
          }
        }

        if (!buildingName || !levelText) return null;

        var key = map[buildingName] || null;
        if (!key) return null;

        var to = labelToLevelNumber(levelText);
        if (!to || !Number.isFinite(to)) return null;

        return { building: key, to: to };
      })
      .filter(Boolean)
      .filter(function (r) { return ALLOWED_PREREQ.has(r.building); });
  }

  async function ensureDataLoaded() {
    if (_loaded) return;
    if (_loadingPromise) return _loadingPromise;

    _loadingPromise = (async function () {
      const list = await loadBuildingsJson();
      prereqMap = {};

      for (const b of list) {
        const slug = String(b.slug || '').toLowerCase();
        if (!slug) continue;
        if (Array.isArray(b.table) && b.table.length) {
          allBuildingData[slug] = tableToRows(b.table);
        }
      }

      const putReq = function (bKey, lvl, reqs) {
        const filtered = (reqs || []).filter(function (r) {
          return r && ALLOWED_PREREQ.has(r.building);
        });
        if (!filtered.length) return;

        if (!prereqMap[bKey]) prereqMap[bKey] = {};
        if (!prereqMap[bKey][lvl]) prereqMap[bKey][lvl] = [];
        prereqMap[bKey][lvl].push.apply(prereqMap[bKey][lvl], filtered);
      };

      for (const b of list) {
        const slug = String(b.slug || '').toLowerCase();
        if (!Array.isArray(b.table) || !b.table.length) continue;

        const rows = tableToRows(b.table);
        for (const r of rows) {
          const reqs = parseReqList(r._req);
          if (reqs.length) putReq(slug, r.level, reqs);
        }
      }

      for (const bKey of Object.keys(prereqMap)) {
        const levels = prereqMap[bKey];
        for (const lv of Object.keys(levels)) {
          levels[lv] = (levels[lv] || []).filter(function (r) {
            return r && ALLOWED_PREREQ.has(r.building);
          });
          if (!levels[lv].length) delete levels[lv];
        }
        if (!Object.keys(levels).length) delete prereqMap[bKey];
      }

      _loaded = true;
    })();

    return _loadingPromise;
  }

  function sumSegment(bKey, fromLevel, toLevel) {
    const rows = allBuildingData[bKey] || [];
    let bread = 0;
    let wood = 0;
    let stone = 0;
    let iron = 0;
    let truegold = 0;
    let tempered_truegold = 0;
    let time = 0;

    for (let lv = Math.max(1, fromLevel) + 1; lv <= toLevel; lv++) {
      const r = rows.find(function (x) { return x.level === lv; });
      if (!r) continue;

      bread += r.bread || 0;
      wood += r.wood || 0;
      stone += r.stone || 0;
      iron += r.iron || 0;
      truegold += r.truegold || 0;
      tempered_truegold += r.tempered_truegold || 0;
      time += r.time || 0;
    }

    return { bread, wood, stone, iron, truegold, tempered_truegold, time };
  }

  function computeTimeFactor(buffs) {
    const speed =
      (Number(buffs.speedBonus) || 0) +
      (Number(buffs.wolfBonus) || 0) +
      (Number(buffs.positionBonus) || 0);

    const law = buffs.doubleTime ? 0.8 : 1.0;
    return law / (1 + speed / 100);
  }

  function applySaulDiscountTotals(res, saulPct) {
    const rate = Math.max(0, 1 - (Number(saulPct) || 0) / 100);

    return {
      bread: Math.round((res.bread || 0) * rate),
      wood: Math.round((res.wood || 0) * rate),
      stone: Math.round((res.stone || 0) * rate),
      iron: Math.round((res.iron || 0) * rate),
      truegold: Math.round(res.truegold || 0),
      tempered_truegold: Math.round(res.tempered_truegold || 0),
      timeSec: res.timeSec | 0
    };
  }

  function applySaulDiscountRow(r, saulPct) {
    const rate = Math.max(0, 1 - (Number(saulPct) || 0) / 100);

    return {
      bread: Math.round((r.bread || 0) * rate),
      wood: Math.round((r.wood || 0) * rate),
      stone: Math.round((r.stone || 0) * rate),
      iron: Math.round((r.iron || 0) * rate),
      truegold: Math.round(r.truegold || 0),
      tempered_truegold: Math.round(r.tempered_truegold || 0),
      time: r.time || 0
    };
  }

  function getNeedMap(buildingKey, startLevel, targetLevel) {
    const need = {};

    for (let lv = startLevel + 1; lv <= targetLevel; lv++) {
      const reqs = (prereqMap[buildingKey] && prereqMap[buildingKey][lv]) || [];
      for (const r of reqs) {
        if (!r || !r.building || !Number.isFinite(r.to)) continue;
        if (!ALLOWED_PREREQ.has(r.building)) continue;

        const toLv = Math.max(PREREQ_MIN_LV, r.to);
        need[r.building] = Math.max(need[r.building] || 0, toLv);
      }
    }

    return need;
  }

  function calculateWithPrereq(mainKey, startLevel, targetLevel, buffs, preLevels) {
    let total = { bread: 0, wood: 0, stone: 0, iron: 0, truegold: 0, tempered_truegold: 0, time: 0 };
    const current = { ...(preLevels || {}) };
    current[mainKey] = startLevel;

    const lines = [];
    const visiting = new Set();
    const done = new Set();

    const pushLine = function (bKey, lvl, row) {
      if (!row) return;
      lines.push({
        bKey,
        levelTo: lvl,
        from: lvl - 1,
        to: lvl,
        bread: row.bread || 0,
        wood: row.wood || 0,
        stone: row.stone || 0,
        iron: row.iron || 0,
        truegold: row.truegold || 0,
        tempered_truegold: row.tempered_truegold || 0,
        time: row.time || 0
      });
    };

    const ensure = function (bKey, toLevel) {
      if (!ALLOWED_PREREQ.has(bKey)) return;

      toLevel = Math.max(PREREQ_MIN_LV, Number(toLevel) || 0);
      const currBase = Math.max(PREREQ_MIN_LV, Number(current[bKey] != null ? current[bKey] : 1));
      if (toLevel <= currBase) return;

      for (let lv = currBase + 1; lv <= toLevel; lv++) {
        const nodeKey = bKey + '#' + lv;

        if (done.has(nodeKey)) {
          current[bKey] = Math.max(current[bKey] || 1, lv);
          continue;
        }

        if (visiting.has(nodeKey)) {
          console.warn('[calc] circular prereq detected: ' + nodeKey + ' (main=' + mainKey + ')');
          return;
        }

        visiting.add(nodeKey);

        const reqs = (prereqMap[bKey] && prereqMap[bKey][lv]) || [];
        for (const r of reqs) {
          if (!r || !r.building || !Number.isFinite(r.to)) continue;
          if (!ALLOWED_PREREQ.has(r.building)) continue;
          ensure(r.building, r.to);
        }

        if (done.has(nodeKey)) {
          visiting.delete(nodeKey);
          current[bKey] = Math.max(current[bKey] || 1, lv);
          continue;
        }

        const row = (allBuildingData[bKey] || []).find(function (x) { return x.level === lv; });
        if (row) {
          total.bread += row.bread || 0;
          total.wood += row.wood || 0;
          total.stone += row.stone || 0;
          total.iron += row.iron || 0;
          total.truegold += row.truegold || 0;
          total.tempered_truegold += row.tempered_truegold || 0;
          total.time += row.time || 0;
          pushLine(bKey, lv, row);
        }

        done.add(nodeKey);
        visiting.delete(nodeKey);
        current[bKey] = lv;
      }
    };

    for (let lv = startLevel + 1; lv <= targetLevel; lv++) {
      const reqs = (prereqMap[mainKey] && prereqMap[mainKey][lv]) || [];
      for (const r of reqs) {
        if (!r || !ALLOWED_PREREQ.has(r.building)) continue;
        ensure(r.building, r.to);
      }

      const row = (allBuildingData[mainKey] || []).find(function (x) { return x.level === lv; });
      if (row) {
        total.bread += row.bread || 0;
        total.wood += row.wood || 0;
        total.stone += row.stone || 0;
        total.iron += row.iron || 0;
        total.truegold += row.truegold || 0;
        total.tempered_truegold += row.tempered_truegold || 0;
        total.time += row.time || 0;
        pushLine(mainKey, lv, row);
      }
    }

    const tf = computeTimeFactor(buffs);

    return {
      bread: total.bread,
      wood: total.wood,
      stone: total.stone,
      iron: total.iron,
      truegold: total.truegold,
      tempered_truegold: total.tempered_truegold,
      timeSec: Math.round(Math.max(0, total.time * tf)),
      lines,
      tf
    };
  }

  function buildMainOnlyResult(dataKey, startLevel, targetLevel, buffs) {
    const seg = sumSegment(dataKey, startLevel, targetLevel);
    const tf = computeTimeFactor(buffs);
    const rows = allBuildingData[dataKey] || [];
    const lines = [];

    for (let lv = startLevel + 1; lv <= targetLevel; lv++) {
      const row = rows.find(function (x) { return x.level === lv; });
      if (!row) continue;

      lines.push({
        bKey: dataKey,
        levelTo: lv,
        from: lv - 1,
        to: lv,
        bread: row.bread || 0,
        wood: row.wood || 0,
        stone: row.stone || 0,
        iron: row.iron || 0,
        truegold: row.truegold || 0,
        tempered_truegold: row.tempered_truegold || 0,
        time: row.time || 0
      });
    }

    return {
      bread: seg.bread,
      wood: seg.wood,
      stone: seg.stone,
      iron: seg.iron,
      truegold: seg.truegold,
      tempered_truegold: seg.tempered_truegold,
      timeSec: Math.round(Math.max(0, seg.time * tf)),
      lines,
      tf
    };
  }

  function setTextIfExists(id, key, fb) {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key, fb);
  }

  function ensureLevelHint(id, inputEl) {
    if (!inputEl) return null;
    let el = document.getElementById(id);
    if (el) return el;

    el = document.createElement('span');
    el.id = id;
    el.className = 'ks-calc-levelhint is-empty';
    el.textContent = 'TC1';

    if (inputEl.parentNode) {
      if (inputEl.nextSibling) {
        inputEl.parentNode.insertBefore(el, inputEl.nextSibling);
      } else {
        inputEl.parentNode.appendChild(el);
      }
    }
    return el;
  }

  function updateLevelHint(inputId, hintId) {
    const inputEl = document.getElementById(inputId);
    const hintEl = ensureLevelHint(hintId, inputEl);
    if (!inputEl || !hintEl) return;

    const lv = labelToLevelNumber(inputEl.value);
    const label = formatLevelLabel(lv || 1) || 'TC1';
    hintEl.textContent = label;

    if (lv > 0) hintEl.classList.remove('is-empty');
    else hintEl.classList.add('is-empty');
  }

  function updateAllLevelHints() {
    updateLevelHint('startLevel', 'startLevelHint');
    updateLevelHint('targetLevel', 'targetLevelHint');
  }

  function applyI18NLabels() {
    setTextIfExists('calc-title', 'calc.title', '건물 계산기');

    const desc = document.querySelector('.calc-desc');
    if (desc) desc.textContent = t('calc.desc', '업그레이드에 필요한 자원과 소요 시간을 확인하세요.');

    setTextIfExists('label-building', 'calc.form.building.label', '건물 선택');
    setTextIfExists('label-start', 'calc.form.startLevel.label', '현재 레벨');
    setTextIfExists('label-target', 'calc.form.targetLevel.label', '목표 레벨');
    setTextIfExists('label-speed', 'calc.form.speedBonus.label', '건설 속도 보너스 (%)');
    setTextIfExists('label-saul', 'calc.form.saulBonus.label', '살로 스킬 보너스 (%) — 건설 비용 적용');
    setTextIfExists('label-wolf', 'calc.form.wolfBonus.label', '늑대 스킬 보너스 (%)');
    setTextIfExists('label-position', 'calc.form.positionBonus.label', '국왕/관직 보너스 (%)');
    setTextIfExists('label-double', 'calc.form.doubleTime.label', '건설 법령 적용(시간 20% 감소)');
    setTextIfExists('label-include', 'calc.form.includePrereq.label', '선행 건물 포함');
    setTextIfExists('prereq-title', 'calc.prereqBox.title', '선행 조건');

    const prereqTitleEl = document.getElementById('prereq-title');
    if (prereqTitleEl) prereqTitleEl.classList.add('ks-calc-prereq-title');

    const sel = document.getElementById('building');
    if (sel && sel.options && sel.options.length) {
      for (const opt of sel.options) {
        const k = BUILDING_I18N_KEY[opt.value] || opt.value;
        opt.textContent = t(k, opt.textContent || opt.value);
      }
      sel.setAttribute('aria-label', t('calc.form.building.label', '건물 선택'));
    }

    const startEl = document.getElementById('startLevel');
    if (startEl) {
      startEl.setAttribute('placeholder', t('calc.form.startLevel.placeholder', '현재 레벨 입력'));
      startEl.setAttribute('aria-label', t('calc.form.startLevel.label', '현재 레벨'));
      ensureLevelHint('startLevelHint', startEl);
    }

    const targetEl = document.getElementById('targetLevel');
    if (targetEl) {
      targetEl.setAttribute('placeholder', t('calc.form.targetLevel.placeholder', '목표 레벨 입력'));
      targetEl.setAttribute('aria-label', t('calc.form.targetLevel.label', '목표 레벨'));
      ensureLevelHint('targetLevelHint', targetEl);
    }

    const speedEl = document.getElementById('speedBonus');
    if (speedEl) {
      speedEl.setAttribute('placeholder', t('calc.common.percentZero', '0'));
      speedEl.setAttribute('aria-label', t('calc.form.speedBonus.label', '건설 속도 보너스 (%)'));
    }

    const saulEl = document.getElementById('saulBonus');
    if (saulEl) {
      saulEl.setAttribute('placeholder', t('calc.common.percentZero', '0'));
      saulEl.setAttribute('aria-label', t('calc.form.saulBonus.label', '살로 스킬 보너스 (%) — 건설 비용 적용'));
    }

    const wolfEl = document.getElementById('wolfBonus');
    if (wolfEl) {
      wolfEl.setAttribute('placeholder', t('calc.common.percentZero', '0'));
      wolfEl.setAttribute('aria-label', t('calc.form.wolfBonus.label', '늑대 스킬 보너스 (%)'));
    }

    const posEl = document.getElementById('positionBonus');
    if (posEl) {
      posEl.setAttribute('placeholder', t('calc.common.percentZero', '0'));
      posEl.setAttribute('aria-label', t('calc.form.positionBonus.label', '국왕/관직 보너스 (%)'));
    }

    const calcBtn = document.getElementById('calcBtn');
    if (calcBtn) calcBtn.textContent = t('calc.form.actions.calculate', '업그레이드 계산하기');

    const clearBtn = document.getElementById('clearPlanBtn');
    if (clearBtn) clearBtn.textContent = t('calc.form.actions.clear', '업그레이드 초기화');

    updateAllLevelHints();
  }

  window.reapplyCalculatorI18N = function reapplyCalculatorI18N() {
    applyI18NLabels();
    try { window.__calcRefreshPrereqUI && window.__calcRefreshPrereqUI(); } catch (_) {}
  };

  function renderPrereqBox(buildingKey, startLevel, targetLevel) {
    const ul = document.getElementById('prereq-list');
    if (!ul) return;

    const need = getNeedMap(buildingKey, startLevel, targetLevel);
    const keys = DISPLAY_ORDER_PREREQ.filter(function (k) { return need[k] != null; });

    if (!keys.length) {
      ul.innerHTML = '<li>' + t('calc.prereqBox.empty', '선행조건 없음') + '</li>';
      return;
    }

    const lvLabel = t('calc.common.lv', 'Lv.');
    ul.className = 'ks-calc-prereq-list';
    ul.innerHTML = keys.map(function (k) {
      return '<li>' + buildingLinkHtml(k, getBuildingLabel(k)) + ' ' + lvLabel + formatLevelLabel(need[k]) + '</li>';
    }).join('');
  }

  function readUserPrereqLevelsRaw() {
    const g = function (id) {
      const el = document.getElementById(id);
      if (!el) return 0;
      return labelToLevelNumber(el.value);
    };

    return {
      academy: g('prereqAcademy'),
      range: g('prereqRange'),
      stable: g('prereqStable'),
      barracks: g('prereqBarracks'),
      embassy: g('prereqEmbassy')
    };
  }

  function readUserPrereqLevels() {
    const raw = readUserPrereqLevelsRaw();
    const out = {};

    for (const k of Object.keys(raw)) {
      const v = raw[k] | 0;
      if (v > 0) out[k] = Math.max(PREREQ_MIN_LV, v);
    }

    return out;
  }

  function syncPrereqDetailsVisibility(shouldOpen) {
    const details = document.getElementById('prereq-details');
    if (!details) return;

    if (shouldOpen) {
      details.hidden = false;
      details.open = true;
    } else {
      details.open = false;
      details.hidden = true;
    }
  }

  function clampPrereqInputs(targetLevel) {
    const maxLv = Math.max(PREREQ_MIN_LV, Math.max(1, Number(targetLevel) || 1) - 1);
    const ids = ['prereqAcademy', 'prereqRange', 'prereqStable', 'prereqBarracks', 'prereqEmbassy'];

    ids.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;

      try { el.setAttribute('max', String(maxLv)); } catch (_) {}

      const raw = labelToLevelNumber(el.value);
      if (raw > maxLv) {
        el.value = String(maxLv);
      }
    });
  }

  function sortLines(lines, dataKey) {
    const order = [dataKey].concat(DISPLAY_ORDER_PREREQ);

    const idxOf = function (k) {
      const i = order.indexOf(k);
      return i === -1 ? order.length + 1 : i;
    };

    return [].concat(lines || []).sort(function (a, b) {
      const ai = idxOf(a.bKey);
      const bi = idxOf(b.bKey);
      if (ai !== bi) return ai - bi;
      return a.levelTo - b.levelTo;
    });
  }

  function getMobileGroupTitle(level) {
    level = Number(level || 0);

    if (level >= 2 && level <= 30) return 'TC2 - TC30';
    if (level >= 31 && level <= 39) return '30-1 ~ TG1';
    if (level >= 40 && level <= 44) return 'TG2';
    if (level >= 45 && level <= 49) return 'TG3';
    if (level >= 50 && level <= 54) return 'TG4';
    if (level >= 55 && level <= 59) return 'TG5';
    if (level >= 60 && level <= 64) return 'TG6';
    if (level >= 65 && level <= 69) return 'TG7';
    if (level >= 70 && level <= 74) return 'TG8';
    if (level >= 75 && level <= 79) return 'TG9';
    if (level === 80) return 'TG10';

    return '기타';
  }

  function buildMobileCards(sortedLines, dataKey, uiKey, saulPct, tf, showTruegold, showTempered) {
    const groups = {};
    const order = ['TC2 - TC30', '30-1 ~ TG1', 'TG2', 'TG3', 'TG4', 'TG5', 'TG6', 'TG7', 'TG8', 'TG9', 'TG10', '기타'];

    sortedLines.forEach(function (ln) {
      const title = getMobileGroupTitle(ln.to);
      if (!groups[title]) groups[title] = [];
      groups[title].push(ln);
    });

    let html = '<div class="ks-calc-mobile-cards">';

    order.forEach(function (groupTitle) {
      const list = groups[groupTitle];
      if (!list || !list.length) return;

      html += '<section class="ks-calc-mobile-group">';
      html += '<h3 class="ks-calc-mobile-group-title">' + groupTitle + '</h3>';

      list.forEach(function (ln) {
        const discounted = applySaulDiscountRow({
          bread: ln.bread,
          wood: ln.wood,
          stone: ln.stone,
          iron: ln.iron,
          truegold: ln.truegold,
          tempered_truegold: ln.tempered_truegold,
          time: ln.time
        }, saulPct);

        const timeAdj = Math.round((ln.time || 0) * (tf || 1));
        const rowBuildingLabel = (ln.bKey === dataKey) ? getBuildingLabel(uiKey) : getBuildingLabel(ln.bKey);

        html += '<article class="ks-calc-mobile-card">';
        html +=   '<div class="ks-calc-mobile-card-head">';
        html +=     '<div class="ks-calc-mobile-building">' + buildingLinkHtml(ln.bKey, rowBuildingLabel) + '</div>';
        html +=     '<div class="ks-calc-mobile-level">' + formatLevelLabel(ln.to) + '</div>';
        html +=   '</div>';
        html +=   '<div class="ks-calc-mobile-grid">';
        html +=     '<div class="ks-calc-mobile-item"><div class="ks-calc-mobile-item-label">' + t('calc.table.col.bread','빵') + '</div><div class="ks-calc-mobile-item-value">' + intText(discounted.bread || 0) + '</div></div>';
        html +=     '<div class="ks-calc-mobile-item"><div class="ks-calc-mobile-item-label">' + t('calc.table.col.wood','나무') + '</div><div class="ks-calc-mobile-item-value">' + intText(discounted.wood || 0) + '</div></div>';
        html +=     '<div class="ks-calc-mobile-item"><div class="ks-calc-mobile-item-label">' + t('calc.table.col.stone','석재') + '</div><div class="ks-calc-mobile-item-value">' + intText(discounted.stone || 0) + '</div></div>';
        html +=     '<div class="ks-calc-mobile-item"><div class="ks-calc-mobile-item-label">' + t('calc.table.col.iron','철') + '</div><div class="ks-calc-mobile-item-value">' + intText(discounted.iron || 0) + '</div></div>';
        if (showTruegold) {
          html +=   '<div class="ks-calc-mobile-item"><div class="ks-calc-mobile-item-label">' + t('calc.table.col.truegold','순금') + '</div><div class="ks-calc-mobile-item-value">' + intText(ln.truegold || 0) + '</div></div>';
        }
        if (showTempered) {
          html +=   '<div class="ks-calc-mobile-item"><div class="ks-calc-mobile-item-label">' + t('calc.table.col.tempered_truegold','담금질 된 순금') + '</div><div class="ks-calc-mobile-item-value">' + intText(ln.tempered_truegold || 0) + '</div></div>';
        }
        html +=     '<div class="ks-calc-mobile-item"><div class="ks-calc-mobile-item-label">' + t('calc.table.col.time','건설 시간') + '</div><div class="ks-calc-mobile-item-value">' + formatTimeNoMinutes(timeAdj) + '</div></div>';
        html +=   '</div>';
        html += '</article>';
      });

      html += '</section>';
    });

    html += '</div>';
    return html;
  }

  function displaySummaryAndTable(dataKey, uiKey, startLevel, targetLevel, result, saulPct, needMap, preRaw) {
    const resultDiv = document.getElementById('result');
    if (!resultDiv) {
      console.warn('[calc] #result not found');
      return;
    }

    const title = getBuildingLabel(uiKey) || uiKey || dataKey;
    const lvLabel = t('calc.common.lv', 'Lv.');
    const sortedLines = sortLines(result.lines || [], dataKey);

    const showTruegold = sortedLines.some(function (r) { return Math.round(r.truegold || 0) > 0; }) || Math.round(result.truegold || 0) > 0;
    const showTempered = sortedLines.some(function (r) { return Math.round(r.tempered_truegold || 0) > 0; }) || Math.round(result.tempered_truegold || 0) > 0;

    const summaryStats = [
      { type: 'bread', label: t('calc.table.col.bread', '빵'), value: result.bread },
      { type: 'wood', label: t('calc.table.col.wood', '나무'), value: result.wood },
      { type: 'stone', label: t('calc.table.col.stone', '석재'), value: result.stone },
      { type: 'iron', label: t('calc.table.col.iron', '철'), value: result.iron }
    ];

    if (showTruegold) {
      summaryStats.push({ type: 'truegold', label: t('calc.table.col.truegold', '순금'), value: result.truegold || 0 });
    }
    if (showTempered) {
      summaryStats.push({ type: 'tempered_truegold', label: t('calc.table.col.tempered_truegold', '담금질 된 순금'), value: result.tempered_truegold || 0 });
    }

    const summaryTop =
      '<div class="ks-calc-shell">' +
        '<div class="ks-calc-card ks-calc-summary-card">' +
          '<div class="ks-calc-summary-head">' +
            '<div>' +
              '<h2 class="ks-calc-summary-title">' + t('calc.result.upgrade','업그레이드') + ': ' + title + ' ' + lvLabel + formatLevelLabel(startLevel) + ' → ' + lvLabel + formatLevelLabel(targetLevel) + '</h2>' +
              '<div class="ks-calc-summary-sub">' + t('calc.result.totalWithSaul','총 자원 소모량(살로 적용)') + '</div>' +
            '</div>' +
            '<div class="ks-calc-summary-time">⏱ <span>' + t('calc.result.time','건설 시간') + ': ' + formatTime(result.timeSec) + '</span></div>' +
          '</div>' +
          '<div class="ks-calc-summary-grid">' +
            summaryStats.map(function (item) {
              const rounded = roundDisplayNumber(item.value);
              return '' +
                '<div class="ks-calc-stat">' +
                  '<div class="ks-calc-stat-label">' + resourceLabelHtml(item.type, item.label, 18) + '</div>' +
                  '<div class="ks-calc-stat-value">' + displayValue(rounded, true) + '</div>' +
                  '<div class="ks-calc-stat-sub">' + (rounded ? rounded.toLocaleString() : '-') + '</div>' +
                '</div>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</div>';

    const prereqItems = DISPLAY_ORDER_PREREQ
      .filter(function (k) { return needMap[k] != null && ((preRaw[k] | 0) > 0); })
      .map(function (k) {
        const needLv = needMap[k] | 0;
        const curLv = preRaw[k] | 0;
        const label = getBuildingLabel(k);
        return '' +
          '<div class="ks-calc-prereq-chip">' +
            '<div><strong>' + buildingLinkHtml(k, label) + '</strong></div>' +
            '<div>' + t('calc.prereqSummary.current','현재') + ' ' + lvLabel + formatLevelLabel(curLv) + '</div>' +
            '<div>' + t('calc.prereqSummary.required','요구') + ' ' + lvLabel + formatLevelLabel(needLv) + '</div>' +
          '</div>';
      });

    const prereqSummary = prereqItems.length
      ? '<section class="ks-calc-section">' +
          '<h3 class="ks-calc-section-title ks-calc-prereq-title">' + t('calc.prereqSummary.title','선행 건물 요약') + '</h3>' +
          '<div class="ks-calc-prereq-summary">' + prereqItems.join('') + '</div>' +
        '</section>'
      : '';

    let body = '';

    for (const ln of sortedLines) {
      const discounted = applySaulDiscountRow({
        bread: ln.bread,
        wood: ln.wood,
        stone: ln.stone,
        iron: ln.iron,
        truegold: ln.truegold,
        tempered_truegold: ln.tempered_truegold,
        time: ln.time
      }, saulPct);

      const timeAdj = Math.round((ln.time || 0) * (result.tf || 1));
      const rowBuildingLabel = (ln.bKey === dataKey) ? getBuildingLabel(uiKey) : getBuildingLabel(ln.bKey);

      body +=
        '<tr>' +
          '<td>' + buildingLinkHtml(ln.bKey, rowBuildingLabel) + '</td>' +
          '<td>' + formatLevelLabel(ln.to) + '</td>' +
          '<td>' + intText(discounted.bread || 0) + '</td>' +
          '<td>' + intText(discounted.wood || 0) + '</td>' +
          '<td>' + intText(discounted.stone || 0) + '</td>' +
          '<td>' + intText(discounted.iron || 0) + '</td>' +
          (showTruegold ? '<td>' + intText(ln.truegold || 0) + '</td>' : '') +
          (showTempered ? '<td>' + intText(ln.tempered_truegold || 0) + '</td>' : '') +
          '<td>' + formatTimeNoMinutes(timeAdj) + '</td>' +
        '</tr>';
    }

    const thead =
      '<tr>' +
        '<th style="width:14%;">' + t('calc.table.col.building','건물') + '</th>' +
        '<th style="width:8%;">' + t('calc.table.col.level','레벨') + '</th>' +
        '<th style="width:11%;">' + resourceLabelHtml('bread', t('calc.table.col.bread','빵'), 16) + '</th>' +
        '<th style="width:11%;">' + resourceLabelHtml('wood', t('calc.table.col.wood','나무'), 16) + '</th>' +
        '<th style="width:11%;">' + resourceLabelHtml('stone', t('calc.table.col.stone','석재'), 16) + '</th>' +
        '<th style="width:11%;">' + resourceLabelHtml('iron', t('calc.table.col.iron','철'), 16) + '</th>' +
        (showTruegold ? '<th style="width:11%;">' + resourceLabelHtml('truegold', t('calc.table.col.truegold','순금'), 16) + '</th>' : '') +
        (showTempered ? '<th style="width:13%;">' + resourceLabelHtml('tempered_truegold', t('calc.table.col.tempered_truegold','담금질 된 순금'), 16) + '</th>' : '') +
        '<th style="width:10%;">' + t('calc.table.col.time','건설 시간') + '</th>' +
      '</tr>';

    const tableTitle = sortedLines.length
      ? t('calc.table.titleWithPrereq', '상세 내역 (선행 포함)')
      : t('calc.table.title', '상세 내역');

    const table =
      '<div class="ks-calc-table-wrap">' +
        '<div class="ks-calc-table-head">' +
          '<h3 class="ks-calc-section-title" style="margin-bottom:4px;text-align:center;">' + tableTitle + '</h3>' +
          '<div class="ks-calc-sticky-note">' + t('calc.table.levelNote', '레벨 표기는 TC1부터 TG10까지 기준입니다.') + '</div>' +
          '<div class="ks-calc-sticky-note">' + t('calc.table.timeMinuteRemoved', '건설시간 분단위는 제거하였습니다.') + '</div>' +
        '</div>' +
        '<div class="ks-calc-table-scroll">' +
          '<table class="ks-calc-table">' +
            '<thead>' + thead + '</thead>' +
            '<tbody>' + body + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';

    const mobileCards = buildMobileCards(sortedLines, dataKey, uiKey, saulPct, result.tf, showTruegold, showTempered);

    resultDiv.innerHTML =
      '<div class="ks-calc-shell">' +
        summaryTop.replace('<div class="ks-calc-shell">', '').replace(/<\/div>$/, '') +
        prereqSummary +
        table +
        mobileCards +
      '</div>';
  }

  function bindOnce(el, type, handler) {
    if (!el) return;
    if (!el.__bound__) el.__bound__ = {};
    if (el.__bound__[type]) return;
    el.addEventListener(type, handler);
    el.__bound__[type] = true;
  }

  function resetFormToDefaults() {
    const buildingEl = document.getElementById('building');
    if (buildingEl) buildingEl.selectedIndex = 0;

    const setVal = function (id, val) {
      const el = document.getElementById(id);
      if (el) el.value = String(val);
    };

    setVal('startLevel', 1);
    setVal('targetLevel', 1);
    setVal('speedBonus', 0);
    setVal('saulBonus', 0);
    setVal('wolfBonus', 0);
    setVal('positionBonus', 0);

    const uncheck = function (id) {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    };

    uncheck('doubleTime');
    uncheck('includePrereq');

    ['prereqAcademy', 'prereqRange', 'prereqStable', 'prereqBarracks', 'prereqEmbassy'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.value = '';
      if (el) el.removeAttribute('max');
    });

    const resultDiv = document.getElementById('result');
    if (resultDiv) resultDiv.innerHTML = '';

    const pl = document.getElementById('prereq-list');
    if (pl) pl.innerHTML = '';

    const details = document.getElementById('prereq-details');
    if (details) {
      details.open = false;
      details.hidden = true;
    }

    updateAllLevelHints();
  }

  async function initCalculator() {
    injectCalculatorStyles();

    try { resetFormToDefaults(); } catch (_) {}

    try {
      await ensureDataLoaded();
    } catch (e) {
      const el = document.getElementById('result');
      if (el) {
        el.innerHTML = '<div style="color:#b00020;font-weight:700">' +
          t('calc.error.load','데이터 로드 실패') + ': ' + e.message +
          '</div>';
      }
      return;
    }

    applyI18NLabels();

    const buildingEl = document.getElementById('building');
    const startEl = document.getElementById('startLevel');
    const targetEl = document.getElementById('targetLevel');
    const incEl = document.getElementById('includePrereq');
    const calcBtn = document.getElementById('calcBtn');
    const clearBtn = document.getElementById('clearPlanBtn');

    if (!buildingEl || !startEl || !targetEl) {
      console.warn('[calc] Required inputs not found (#building, #startLevel, #targetLevel)');
      return;
    }

    function clampLv(n) {
      n = parseInt(n, 10);
      if (!Number.isFinite(n)) return 1;
      return Math.max(1, Math.min(MAX_LV, n));
    }

    function normalizeUiKey(v) {
      if (v === 'command') return 'commandcenter';
      if (v === 'war-academy') return 'waracademy';
      return v;
    }

    function refreshPrereqUI() {
      const uiKey = normalizeUiKey(buildingEl.value);

      const start = clampLv(startEl.value || 1);
      const to = clampLv(targetEl.value || 1);
      startEl.value = String(start);
      targetEl.value = String(to);

      updateAllLevelHints();
      clampPrereqInputs(to);

      const dataKey = uiKey;

      if (to > start) {
        renderPrereqBox(dataKey, start, to);
      } else {
        const ul = document.getElementById('prereq-list');
        if (ul) ul.innerHTML = '';
      }

      const inc = incEl ? incEl.checked : false;
      syncPrereqDetailsVisibility(Boolean(inc && to > start));
    }

    window.__calcRefreshPrereqUI = refreshPrereqUI;

    bindOnce(buildingEl, 'input', refreshPrereqUI);
    bindOnce(buildingEl, 'change', refreshPrereqUI);
    bindOnce(startEl, 'input', refreshPrereqUI);
    bindOnce(startEl, 'change', refreshPrereqUI);
    bindOnce(targetEl, 'input', refreshPrereqUI);
    bindOnce(targetEl, 'change', refreshPrereqUI);
    if (incEl) bindOnce(incEl, 'change', refreshPrereqUI);

    ['prereqAcademy', 'prereqRange', 'prereqStable', 'prereqBarracks', 'prereqEmbassy'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;

      bindOnce(el, 'input', function () {
        const target = clampLv(targetEl.value || 1);
        const maxLv = Math.max(PREREQ_MIN_LV, target - 1);
        const raw = labelToLevelNumber(el.value);
        if (raw > maxLv) el.value = String(maxLv);
      });

      bindOnce(el, 'change', function () {
        const target = clampLv(targetEl.value || 1);
        const maxLv = Math.max(PREREQ_MIN_LV, target - 1);
        const raw = labelToLevelNumber(el.value);
        if (raw > maxLv) el.value = String(maxLv);
      });
    });

    if (calcBtn) bindOnce(calcBtn, 'click', function () {
      const uiKey = normalizeUiKey(buildingEl.value);

      const start = clampLv(startEl.value);
      const to = clampLv(targetEl.value);

      startEl.value = String(start);
      targetEl.value = String(to);

      updateAllLevelHints();
      clampPrereqInputs(to);

      if (start >= to) {
        alert(t('calc.alert.targetGtStart', '목표 레벨은 시작 레벨보다 커야 합니다.'));
        return;
      }

      const getNum = function (id) {
        const el = document.getElementById(id);
        const v = el ? parseFloat(el.value) : 0;
        return Number.isFinite(v) ? v : 0;
      };

      const buffs = {
        speedBonus: getNum('speedBonus'),
        saulBonus: getNum('saulBonus'),
        wolfBonus: getNum('wolfBonus'),
        positionBonus: getNum('positionBonus'),
        doubleTime: !!(document.getElementById('doubleTime') && document.getElementById('doubleTime').checked)
      };

      const includePrereq = !!(incEl && incEl.checked);
      const dataKey = uiKey;

      if (!allBuildingData[dataKey]) {
        alert(t('calc.alert.noData', '데이터가 없습니다') + ': ' + getBuildingLabel(uiKey));
        return;
      }

      if (includePrereq) {
        const preRawCheck = readUserPrereqLevelsRaw();
        const maxAllowed = Math.max(PREREQ_MIN_LV, to - 1);
        const keys = Object.keys(preRawCheck);
        for (let i = 0; i < keys.length; i++) {
          if ((preRawCheck[keys[i]] | 0) > maxAllowed) {
            alert(t('calc.alert.prereqTooHigh', '선행 건물 레벨은 목표 레벨 이상으로 입력할 수 없습니다.'));
            clampPrereqInputs(to);
            return;
          }
        }
      }

      let result;
      if (includePrereq) {
        const preLevels = readUserPrereqLevels();
        result = calculateWithPrereq(dataKey, start, to, { ...buffs, includePrereq: true }, preLevels);
      } else {
        result = buildMainOnlyResult(dataKey, start, to, buffs);
      }

      const totalsAfterSaul = applySaulDiscountTotals({
        bread: result.bread,
        wood: result.wood,
        stone: result.stone,
        iron: result.iron,
        truegold: result.truegold,
        tempered_truegold: result.tempered_truegold,
        timeSec: result.timeSec
      }, buffs.saulBonus);

      const needMap = getNeedMap(dataKey, start, to);
      const preRaw = readUserPrereqLevelsRaw();

      displaySummaryAndTable(
        dataKey,
        uiKey,
        start,
        to,
        { ...result, ...totalsAfterSaul },
        buffs.saulBonus,
        needMap,
        preRaw
      );

      renderPrereqBox(dataKey, start, to);
    });

    if (clearBtn) bindOnce(clearBtn, 'click', function () {
      resetFormToDefaults();
      applyI18NLabels();
      clampPrereqInputs(clampLv(targetEl && targetEl.value ? targetEl.value : 1));
      updateAllLevelHints();
    });

    refreshPrereqUI();
    updateAllLevelHints();
    window.__calculatorInited__ = true;
    console.info('[calc] init complete');
  }

  // 외부에서 호출
  window.initCalculator = initCalculator;
  window._calcDebug = { allBuildingData, prereqMap };

  // 전역 reset API
  window.KSD = window.KSD || {};
  window.KSD.buildingUI = window.KSD.buildingUI || {};
  window.KSD.buildingUI.reset = resetFormToDefaults;
})();
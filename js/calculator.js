(function () {
  'use strict';

  // ========= 전역 초기화 가드(중복 로드 방지) =========
  if (window.__calculatorScriptLoaded__) {
    console.info('[calc] calculator.js already loaded — skipping duplicate definition');
    return;
  }
  window.__calculatorScriptLoaded__ = true;

  // ---------- i18n helpers ----------
  const t = (k, fb) => (window.I18N && typeof I18N.t === 'function')
    ? I18N.t(k, (fb !== undefined ? fb : k))
    : (fb !== undefined ? fb : k);

  // 동적 표시용 빌딩명 키 매핑 (라벨은 calc.json에 넣음)
  const BUILDING_I18N_KEY = {
    towncenter: 'calc.form.building.option.towncenter',
    embassy:    'calc.form.building.option.embassy',
    academy:    'calc.form.building.option.academy',
    command:    'calc.form.building.option.command',
    barracks:   'calc.form.building.option.barracks',
    stable:     'calc.form.building.option.stable',
    range:      'calc.form.building.option.range',
    infirmary:  'calc.form.building.option.infirmary',
    'camp:common': 'calc.form.building.option.barracks', // 공용 캠프는 보병대 라벨로 폴백
    'war-academy': 'calc.form.building.option.war-academy'
  };
  const getBuildingLabel = (key) => t(BUILDING_I18N_KEY[key] || key, key);

  // ------------------------ 상태 ------------------------
  const allBuildingData = {};
  let prereqMap = {};
  let _loaded = false;
  let _loadingPromise = null;

  // ===== 선행 제한 & 최소 레벨 =====
  const ALLOWED_PREREQ = new Set(['towncenter', 'academy', 'barracks', 'range', 'stable', 'embassy']);
  const PREREQ_MIN_LV = 3;
  const DISPLAY_ORDER_PREREQ = ['towncenter', 'academy', 'barracks', 'range', 'stable', 'embassy'];

  // ===== 최대 레벨 (1~70) =====
  const MAX_LV = 70;

  // ------------------------ 유틸 ------------------------
  function parseRes(v) {
    if (v == null) return 0;
    const s = String(v).trim().toLowerCase().replace(/,/g, '');
    if (!s || s === '-' || s === '–') return 0;
    const m = s.match(/^(-?\d+(?:\.\d+)?)([kmb])?$/i);
    if (m) {
      let n = parseFloat(m[1]);
      const u = (m[2] || '').toLowerCase();
      if (u === 'k') n *= 1e3; else if (u === 'm') n *= 1e6; else if (u === 'b') n *= 1e9;
      return n;
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function labelToLevelNumber(x) {
    if (typeof x === 'number') return x;
    const s = String(x).trim().toUpperCase();

    // "34-35" 같은 표기면 합쳐서 비교 가능하게(레거시)
    if (/^\d+-\d+$/.test(s)) {
      const ab = s.split('-').map(Number);
      return (ab[0] || 0) + (ab[1] || 0);
    }

    // TGn => 30 + n*5 (TG1=35, TG8=70)
    if (/^TG\d+$/.test(s)) {
      const n = +s.slice(2);
      return 30 + n * 5;
    }

    // TGn-x => 30 + n*5 + x
    if (/^TG\d+-\d+$/.test(s)) {
      const parts = s.split('-');
      const tg = parts[0];
      const sub = parts[1];
      const n = +tg.slice(2);
      return 30 + n * 5 + (+sub);
    }

    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function parseTimeToSec(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return Math.max(0, Math.round(v * 60)); // 분 단위 숫자 방어
    let s = String(v).trim().toLowerCase();
    if (/^\d+(\.\d+)?$/.test(s)) return Math.max(0, Math.round(parseFloat(s) * 60));

    let d = 0, h = 0, m = 0, sec = 0;
    s.replace(/(\d+)\s*d/g, (_, n) => { d = +n; });
    s.replace(/(\d+)\s*h/g, (_, n) => { h = +n; });
    s.replace(/(\d+)\s*m/g, (_, n) => { m = +n; });
    s.replace(/(\d+)\s*s/g, (_, n) => { sec = +n; });

    s.replace(/(\d+)\s*일/g, (_, n) => { d = +n; });
    s.replace(/(\d+)\s*시(?:간)?/g, (_, n) => { h = +n; });
    s.replace(/(\d+)\s*분/g, (_, n) => { m = +n; });
    s.replace(/(\d+)\s*초/g, (_, n) => { sec = +n; });

    if (d + h + m + sec > 0) return d * 86400 + h * 3600 + m * 60 + sec;

    const n = Number(s.replace(/,/g, ''));
    if (Number.isFinite(n)) return n >= 100000 ? Math.round(n) : Math.round(n * 60);
    return 0;
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const d = Math.floor(sec / 86400); sec %= 86400;
    const h = Math.floor(sec / 3600); sec %= 3600;
    const m = Math.floor(sec / 60);
    const s = sec % 60;

    const out = [];
    if (d) out.push(d + t('calc.time.daySuffix', '일'));
    if (h) out.push(h + t('calc.time.hourSuffix', '시간'));
    if (m) out.push(m + t('calc.time.minSuffix', '분'));
    if (s) out.push(s + t('calc.time.secSuffix', '초'));
    return out.join(' ') || ('0' + t('calc.time.secSuffix', '초'));
  }

  function formatNumber(v) {
    const n = +v || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2).replace(/\.00$/, '') + 'K';
    return n.toLocaleString();
  }

  // ------------------------ 안전한 JSON 로더 ------------------------
  function guessBasePath() {
    const baseTag = document.querySelector('base[href]');
    if (baseTag) {
      try { return new URL(baseTag.getAttribute('href'), location.origin).pathname || '/'; }
      catch (_) {}
    }
    const seg = location.pathname.split('/').filter(Boolean);
    if (seg.length > 0 && !seg[0].includes('.')) return '/' + seg[0] + '/';
    return '/';
  }

  async function fetchJsonSafe(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    const text = await r.text();
    const looksJson = /application\/json|text\/json/.test(ct) || /^\s*[{[]/.test(text);
    if (!looksJson) {
      const head = text.slice(0, 120).replace(/\s+/g, ' ');
      throw new Error(`Not JSON from ${url} (got HTML/text): "${head}..."`);
    }
    try { return JSON.parse(text); }
    catch (e) { throw new Error(`JSON parse failed at ${url}: ${e.message}`); }
  }

  // buildings-calc.json 우선
  async function loadBuildingsJson() {
    const ts = Date.now();
    const base = guessBasePath();
    const candidates = [
      `/data/buildings-calc.json?v=${ts}`,
      `${base}data/buildings-calc.json?v=${ts}`,
      `data/buildings-calc.json?v=${ts}`,
      `../data/buildings-calc.json?v=${ts}`,
      `../../data/buildings-calc.json?v=${ts}`,

      // 레거시 폴백
      `/data/buildings-clac.json?v=${ts}`,
      `${base}data/buildings-clac.json?v=${ts}`,
      `data/buildings-clac.json?v=${ts}`,
      `../data/buildings-clac.json?v=${ts}`,
      `../../data/buildings-clac.json?v=${ts}`,
    ];

    const errors = [];
    for (const u of candidates) {
      try {
        const j = await fetchJsonSafe(u);
        const arr = Array.isArray(j.buildings) ? j.buildings : [];
        console.info('[calc] buildings JSON loaded from:', u, '(count:', arr.length, ')');
        return arr;
      } catch (e) {
        errors.push(`${u} → ${e.message}`);
      }
    }
    console.error('[calc] Failed to load buildings JSON:\n' + errors.join('\n'));
    throw new Error('buildings-calc.json(또는 레거시 clac) 로드 실패');
  }

  // ------------------------ 표 파서 (✅ 정련순금 추가) ------------------------
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
      level: findHeaderIndex(header, ['레벨', /level/i]),
      bread: findHeaderIndex(header, ['빵', /bread/i]),
      wood:  findHeaderIndex(header, ['나무', /wood/i]),
      stone: findHeaderIndex(header, ['석재', '돌', /stone/i]),
      iron:  findHeaderIndex(header, ['철', /iron/i]),

      // ✅ 순금(기존)
      truegold: findHeaderIndex(header, ['순금', '크리스탈', '트루골드', /truegold/i, /true\s*gold/i, /crystal/i]),

      // ✅ 정련순금(신규)
      tempered: findHeaderIndex(header, ['정련', '정련순금', '정련 순금', /tempered/i, /refined/i, /tempered\s*true/i]),

      time: (function () {
        let i = findHeaderIndex(header, ['건설', /build/i]);
        if (i < 0) i = findHeaderIndex(header, ['시간', /(min|minute)/i, /\(분\)/]);
        return i;
      })(),

      req: findHeaderIndex(header, ['요구 건물', '요구사항', '요구', /require/i]),
      tcreq: findHeaderIndex(header, [/도시센터.*요구/, /요구.*도시센터/])
    };

    const get = (row, i) => (i >= 0 && i < row.length) ? row[i] : 0;

    return body.map(row => {
      const level = labelToLevelNumber(get(row, idx.level));

      const bread = parseRes(get(row, idx.bread));
      const wood  = parseRes(get(row, idx.wood));
      const stone = parseRes(get(row, idx.stone));
      const iron  = parseRes(get(row, idx.iron));

      const truegold = parseRes(get(row, idx.truegold));
      const tempered_truegold = parseRes(get(row, idx.tempered));

      const time = parseTimeToSec(get(row, idx.time));

      const reqStr = idx.req >= 0 ? String(get(row, idx.req) || '') : '';
      const tcNeed = idx.tcreq >= 0 ? parseRes(get(row, idx.tcreq)) : 0;

      return {
        level,
        bread, wood, stone, iron,
        truegold,
        tempered_truegold,
        time,
        _req: reqStr,
        _tc: tcNeed
      };
    }).filter(r => r.level > 0 && r.level <= MAX_LV);
  }

  function parseReqList(reqStr) {
    if (!reqStr) return [];
    return reqStr.split(',').map(s => s.trim()).filter(Boolean).map(token => {
      const hasTG = /TG/i.test(token);
      const tkn = token.replace(/\bTG\b/ig, '').replace(/\s+/g, ' ').trim();
      const m = tkn.match(/^(.*?)(?:\s*(?:Lv\.?|레벨)?\s*(\d+))?$/i);
      if (!m) return null;
      const name = (m[1] || '').trim();
      const rawL = m[2] ? parseInt(m[2], 10) : 1;
      const map = {
        '도시센터': 'towncenter',
        '대사관': 'embassy',
        '아카데미': 'academy',
        '지휘부': 'command',
        '보병대': 'barracks',
        '기병대': 'stable',
        '궁병대': 'range'
      };
      const key = map[name] || name;
      const to = hasTG ? (30 + rawL * 5) : rawL;
      return { building: key, to };
    }).filter(Boolean)
      .filter(r => ALLOWED_PREREQ.has(r.building));
  }

  const SLUG_ALIASES = { towncenter: ['town-center'], command: ['commandcenter'] };

  function findKey(obj, wants) {
    const keys = Object.keys(obj);
    for (const w of wants) if (obj[w]) return w;
    for (const w of wants) {
      const al = SLUG_ALIASES[w] || [];
      for (const a of al) if (obj[a]) return a;
    }
    for (const w of wants) {
      const hit = keys.find(k => k.startsWith(w));
      if (hit) return hit;
    }
    for (const w of wants) {
      const hit = keys.find(k => k.includes(w));
      if (hit) return hit;
    }
    return null;
  }

  // ------------------------ 데이터 적재 ------------------------
  async function ensureDataLoaded() {
    if (_loaded) return;
    if (_loadingPromise) return _loadingPromise;

    _loadingPromise = (async () => {
      const list = await loadBuildingsJson();
      prereqMap = {};
      const temp = {};

      // 테이블 수집
      for (const b of list) {
        const slug = String(b.slug || '').toLowerCase();
        if (!slug) continue;

        if (Array.isArray(b.table) && b.table.length) temp[slug] = tableToRows(b.table);
        if (Array.isArray(b.variants)) {
          for (const v of b.variants) {
            const key = `${slug}:${String(v.key || '').toLowerCase()}`;
            if (Array.isArray(v.table) && v.table.length) temp[key] = tableToRows(v.table);
          }
        }
      }

      const pick = (calcKey, candidates) => {
        const k = findKey(temp, candidates);
        if (k) allBuildingData[calcKey] = temp[k];
      };

      pick('towncenter', ['towncenter']);
      pick('embassy', ['embassy']);
      pick('academy', ['academy']);
      pick('command', ['command']);
      pick('war-academy', ['war-academy']);
      allBuildingData.commandcenter = allBuildingData.command;

      const campKey = findKey(temp, ['camp', 'camp:infantry', 'camp:cavalry', 'camp:archer']);
      if (campKey) {
        const campBase = temp[campKey];
        allBuildingData['camp:common'] = campBase;

        allBuildingData.barracks = campBase;
        allBuildingData.stable = campBase;
        allBuildingData.range = campBase;

        if (!allBuildingData.infirmary) {
          const infKey = findKey(temp, ['infirmary', 'field-hospital', 'camp:hospital']);
          allBuildingData.infirmary = infKey ? temp[infKey] : campBase;
        }
      } else {
        const infKey = findKey(temp, ['infirmary', 'field-hospital']);
        if (infKey) allBuildingData.infirmary = temp[infKey];
      }

      // 내부 헬퍼
      const putReq = (bKey, lvl, reqs) => {
        const filtered = (reqs || []).filter(r => r && ALLOWED_PREREQ.has(r.building));
        if (!filtered.length) return;
        if (!prereqMap[bKey]) prereqMap[bKey] = {};
        if (!prereqMap[bKey][lvl]) prereqMap[bKey][lvl] = [];
        prereqMap[bKey][lvl].push(...filtered);
      };

      // 선행조건 맵 구성
      for (const b of list) {
        const slug = String(b.slug || '').toLowerCase();
        if (Array.isArray(b.table) && b.table.length) {
          const rows = tableToRows(b.table);
          for (const r of rows) {
            const reqs = parseReqList(r._req);
            if (reqs.length) putReq(slug, r.level, reqs);
          }
        }
        if (Array.isArray(b.variants)) {
          for (const v of b.variants) {
            if (!Array.isArray(v.table) || !v.table.length) continue;
            const key = `${slug}:${String(v.key || '').toLowerCase()}`;
            const rows = tableToRows(v.table);
            for (const r of rows) {
              const reqs = parseReqList(r._req);
              if (reqs.length) putReq(key, r.level, reqs);
            }
          }
        }
      }

      // camp 공용키 선행조건 동기화
      const campPrereqSource = findKey(prereqMap, ['camp', 'camp:infantry', 'camp:cavalry', 'camp:archer']);
      if (campPrereqSource && prereqMap[campPrereqSource]) {
        prereqMap['camp:common'] = prereqMap[campPrereqSource];
      }

      // 안전망: 비허용 키 제거
      for (const bKey of Object.keys(prereqMap)) {
        const levels = prereqMap[bKey];
        for (const lv of Object.keys(levels)) {
          levels[lv] = (levels[lv] || []).filter(r => r && ALLOWED_PREREQ.has(r.building));
          if (!levels[lv].length) delete levels[lv];
        }
        if (!Object.keys(levels).length) delete prereqMap[bKey];
      }

      _loaded = true;
    })();

    return _loadingPromise;
  }

  // ------------------------ 합산/계산 (✅ 정련순금 포함) ------------------------
  function sumSegment(bKey, fromLevel, toLevel) {
    const rows = allBuildingData[bKey] || [];
    let bread = 0, wood = 0, stone = 0, iron = 0, truegold = 0, tempered_truegold = 0, time = 0;

    for (let lv = Math.max(1, fromLevel) + 1; lv <= toLevel; lv++) {
      const r = rows.find(x => x.level === lv);
      if (!r) continue;

      bread += r.bread || 0;
      wood  += r.wood || 0;
      stone += r.stone || 0;
      iron  += r.iron || 0;

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

  // ✅ 살로 할인은 “기본 자원(빵/나무/석재/철)”만 적용. 순금/정련순금은 보통 할인 대상이 아니라 그대로 둠.
  function applySaulDiscountTotals(res, saulPct) {
    const rate = Math.max(0, 1 - (Number(saulPct) || 0) / 100);
    return {
      bread: Math.round((res.bread || 0) * rate),
      wood:  Math.round((res.wood || 0) * rate),
      stone: Math.round((res.stone || 0) * rate),
      iron:  Math.round((res.iron || 0) * rate),

      truegold: Math.round(res.truegold || 0),
      tempered_truegold: Math.round(res.tempered_truegold || 0),

      timeSec: res.timeSec | 0
    };
  }

  function applySaulDiscountRow(r, saulPct) {
    const rate = Math.max(0, 1 - (Number(saulPct) || 0) / 100);
    return {
      ...r,
      bread: Math.round((r.bread || 0) * rate),
      wood:  Math.round((r.wood || 0) * rate),
      stone: Math.round((r.stone || 0) * rate),
      iron:  Math.round((r.iron || 0) * rate)
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

    const pushLine = (bKey, lvl, row) => {
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

    const visiting = new Set();
    const done = new Set();

    const ensure = (bKey, toLevel) => {
      if (!ALLOWED_PREREQ.has(bKey)) return;

      toLevel = Math.max(PREREQ_MIN_LV, Number(toLevel) || 0);
      const currBase = Math.max(PREREQ_MIN_LV, Number(current[bKey] ?? 1));
      if (toLevel <= currBase) return;

      for (let lv = currBase + 1; lv <= toLevel; lv++) {
        const nodeKey = `${bKey}#${lv}`;

        if (done.has(nodeKey)) {
          current[bKey] = Math.max(current[bKey] || 1, lv);
          continue;
        }

        if (visiting.has(nodeKey)) {
          console.warn(`[calc] circular prereq detected: ${nodeKey} (main=${mainKey})`);
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

        const row = (allBuildingData[bKey] || []).find(x => x.level === lv);
        if (row) {
          total.bread += row.bread || 0;
          total.wood  += row.wood || 0;
          total.stone += row.stone || 0;
          total.iron  += row.iron || 0;
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

      const row = (allBuildingData[mainKey] || []).find(x => x.level === lv);
      if (row) {
        total.bread += row.bread || 0;
        total.wood  += row.wood || 0;
        total.stone += row.stone || 0;
        total.iron  += row.iron || 0;
        total.truegold += row.truegold || 0;
        total.tempered_truegold += row.tempered_truegold || 0;
        total.time += row.time || 0;
        pushLine(mainKey, lv, row);
      }
    }

    const tf = computeTimeFactor(buffs);
    return {
      bread: total.bread, wood: total.wood, stone: total.stone, iron: total.iron,
      truegold: total.truegold,
      tempered_truegold: total.tempered_truegold,
      timeSec: Math.round(Math.max(0, total.time * tf)),
      lines, tf
    };
  }

  function buildMainOnlyResult(dataKey, startLevel, targetLevel, buffs) {
    const seg = sumSegment(dataKey, startLevel, targetLevel);
    const tf = computeTimeFactor(buffs);
    const rows = allBuildingData[dataKey] || [];
    const lines = [];

    for (let lv = startLevel + 1; lv <= targetLevel; lv++) {
      const row = rows.find(x => x.level === lv);
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
      bread: seg.bread, wood: seg.wood, stone: seg.stone, iron: seg.iron,
      truegold: seg.truegold,
      tempered_truegold: seg.tempered_truegold,
      timeSec: Math.round(Math.max(0, seg.time * tf)),
      lines, tf
    };
  }

  // ------------------------ i18n 라벨 재적용 ------------------------
  function applyI18NLabels() {
    const title = document.getElementById('calc-title');
    if (title) title.textContent = t('calc.title', '건물 계산기');

    const desc = document.querySelector('.calc-desc');
    if (desc) desc.textContent = t('calc.desc', '업그레이드에 필요한 자원과 소요 시간을 확인하세요.');

    const sel = document.getElementById('building');
    if (sel && sel.options && sel.options.length) {
      for (const opt of sel.options) {
        const k = BUILDING_I18N_KEY[opt.value] || opt.value;
        opt.textContent = t(k, opt.textContent || opt.value);
      }
      sel.setAttribute('aria-label', t('calc.form.building.label', '건물 선택'));
    }
  }

  window.reapplyCalculatorI18N = function reapplyCalculatorI18N() {
    applyI18NLabels();
    try { window.__calcRefreshPrereqUI && window.__calcRefreshPrereqUI(); } catch (_) {}
  };

  // ------------------------ UI ------------------------
  function renderPrereqBox(buildingKey, startLevel, targetLevel) {
    const ul = document.getElementById('prereq-list');
    if (!ul) return;

    const need = getNeedMap(buildingKey, startLevel, targetLevel);
    const keys = Object.keys(need);

    if (!keys.length) {
      ul.innerHTML = `<li>${t('calc.prereqBox.empty', '선행조건 없음')}</li>`;
      return;
    }

    const lvLabel = t('calc.common.lv', 'Lv.');
    ul.innerHTML = keys
      .map(k => `<li>${getBuildingLabel(k)} ${lvLabel}${need[k]}</li>`)
      .join('');
  }

  function readUserPrereqLevelsRaw() {
    const g = (id) => {
      const el = document.getElementById(id);
      if (!el) return 0;
      const v = parseInt(el.value, 10);
      return Number.isFinite(v) ? Math.max(0, v) : 0;
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
    if (shouldOpen) { details.hidden = false; details.open = true; }
    else { details.open = false; details.hidden = true; }
  }

  function sortLines(lines, dataKey) {
    const order = [dataKey, ...DISPLAY_ORDER_PREREQ];
    const idxOf = (k) => {
      const i = order.indexOf(k);
      return i === -1 ? order.length + 1 : i;
    };
    return [...lines].sort((a, b) => {
      const ai = idxOf(a.bKey), bi = idxOf(b.bKey);
      if (ai !== bi) return ai - bi;
      return a.levelTo - b.levelTo;
    });
  }

  function displaySummaryAndTable(dataKey, uiKey, startLevel, targetLevel, result, saulPct, needMap, preRaw) {
    const resultDiv = document.getElementById('result');
    if (!resultDiv) { console.warn('[calc] #result not found'); return; }

    const title = getBuildingLabel(uiKey) || uiKey || dataKey;
    const lvLabel = t('calc.common.lv', 'Lv.');

    const sortedLines = sortLines(result.lines || [], dataKey);

    const showTruegold = sortedLines.some(r => (r.truegold || 0) > 0) || (result.truegold || 0) > 0;
    const showTempered = sortedLines.some(r => (r.tempered_truegold || 0) > 0) || (result.tempered_truegold || 0) > 0;

    const summaryTop = `
      <div style="background:#d7e8fc;padding:10px 15px;border-radius:14px;max-width:900px;margin:0 auto 10px;color:#004a99;font-weight:600;line-height:1.2;">
        <p><strong>${t('calc.result.upgrade','업그레이드:')}</strong> ${title} ${lvLabel}${startLevel} → ${lvLabel}${targetLevel}</p>
        <p><strong>${t('calc.result.time','건설 시간:')}</strong> ${formatTime(result.timeSec)}</p>
        <p><strong>${t('calc.result.totalWithSaul','총 자원 소모량(살로 적용)')}</strong></p>

        <p>🍞 ${t('calc.table.col.bread','빵')}: ${result.bread.toLocaleString()} (${formatNumber(result.bread)})</p>
        <p>🌲 ${t('calc.table.col.wood','나무')}: ${result.wood.toLocaleString()} (${formatNumber(result.wood)})</p>
        <p>🗿 ${t('calc.table.col.stone','석재')}: ${result.stone.toLocaleString()} (${formatNumber(result.stone)})</p>
        <p>⛏️ ${t('calc.table.col.iron','철')}: ${result.iron.toLocaleString()} (${formatNumber(result.iron)})</p>

        ${showTruegold ? `<p>🥇 ${t('calc.table.col.truegold','순금')}: ${(result.truegold || 0).toLocaleString()}</p>` : ''}
        ${showTempered ? `<p>🏅 ${t('calc.table.col.tempered_truegold','정련 순금')}: ${(result.tempered_truegold || 0).toLocaleString()}</p>` : ''}
      </div>
    `;

    const prereqItems = DISPLAY_ORDER_PREREQ
      .filter(k => needMap[k] != null && ((preRaw[k] | 0) > 0))
      .map(k => {
        const needLv = needMap[k] | 0;
        const curLv = preRaw[k] | 0;
        const label = getBuildingLabel(k);
        return `<li>${label}: ${t('calc.prereqSummary.current','현재')} ${lvLabel}${curLv} (${t('calc.prereqSummary.required','요구')} ${lvLabel}${needLv})</li>`;
      });

    const prereqSummary = prereqItems.length
      ? `<section style="max-width:900px;margin:0 auto 10px;">
           <h3 class="calc-title" style="font-size:16px;margin:0 0 6px">${t('calc.prereqSummary.title','선행 건물 요약')}</h3>
           <ul style="padding-left:18px;line-height:1.6">${prereqItems.join('')}</ul>
         </section>`
      : '';

    let body = '';
    let idx = 0;

    for (const ln of sortedLines) {
      idx++;

      const discounted = applySaulDiscountRow(
        {
          bread: ln.bread, wood: ln.wood, stone: ln.stone, iron: ln.iron,
          truegold: ln.truegold, tempered_truegold: ln.tempered_truegold,
          time: ln.time
        },
        saulPct
      );

      const timeAdj = Math.round((ln.time || 0) * (result.tf || 1));

      body += `
        <tr>
          <td>${idx}</td>
          <td>${(ln.bKey === dataKey) ? getBuildingLabel(uiKey) : getBuildingLabel(ln.bKey)}</td>
          <td>${ln.from} → ${ln.to}</td>

          <td>${formatNumber(discounted.bread || 0)}</td>
          <td>${formatNumber(discounted.wood || 0)}</td>
          <td>${formatNumber(discounted.stone || 0)}</td>
          <td>${formatNumber(discounted.iron || 0)}</td>

          ${showTruegold ? `<td>${(ln.truegold || 0).toLocaleString()}</td>` : ''}
          ${showTempered ? `<td>${(ln.tempered_truegold || 0).toLocaleString()}</td>` : ''}

          <td>${formatTime(timeAdj)}</td>
        </tr>`;
    }

    const thead = `
      <tr>
        <th>#</th>
        <th>${t('calc.table.col.building','건물')}</th>
        <th>${t('calc.table.col.level','레벨')}</th>
        <th>${t('calc.table.col.bread','빵')}</th>
        <th>${t('calc.table.col.wood','나무')}</th>
        <th>${t('calc.table.col.stone','석재')}</th>
        <th>${t('calc.table.col.iron','철')}</th>
        ${showTruegold ? `<th>${t('calc.table.col.truegold','순금')}</th>` : ''}
        ${showTempered ? `<th>${t('calc.table.col.tempered_truegold','정련 순금')}</th>` : ''}
        <th>${t('calc.table.col.time','건설 시간')}</th>
      </tr>`;

    const tableTitle = sortedLines.length
      ? t('calc.table.titleWithPrereq', '상세 내역 (선행 포함)')
      : t('calc.table.title', '상세 내역');

    const table = `
      <h3 class="calc-title" style="font-size:16px;margin:10px auto;max-width:900px;">${tableTitle}</h3>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;max-width:900px;margin:0 auto;text-align:center;font-size:13px;">
        <thead style="background:#e9f0fa;font-weight:700">${thead}</thead>
        <tbody>${body}</tbody>
      </table>`;

    resultDiv.innerHTML = summaryTop + prereqSummary + table;
  }

  // ------------------------ 이벤트 바인더 (중복 방지) ------------------------
  function bindOnce(el, type, handler) {
    if (!el) return;
    if (!el.__bound__) el.__bound__ = {};
    if (el.__bound__[type]) return;
    el.addEventListener(type, handler);
    el.__bound__[type] = true;
  }

  // ------------------------ 폼 초기화 ------------------------
  function resetFormToDefaults() {
    const buildingEl = document.getElementById('building');
    if (buildingEl) buildingEl.selectedIndex = 0;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = String(val); };
    setVal('startLevel', 1);
    setVal('targetLevel', 1);
    setVal('speedBonus', 0);
    setVal('saulBonus', 0);
    setVal('wolfBonus', 0);
    setVal('positionBonus', 0);

    const uncheck = (id) => { const el = document.getElementById(id); if (el) el.checked = false; };
    uncheck('doubleTime');
    uncheck('includePrereq');

    ['prereqAcademy','prereqRange','prereqStable','prereqBarracks','prereqEmbassy'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    const resultDiv = document.getElementById('result');
    if (resultDiv) resultDiv.innerHTML = '';

    const pl = document.getElementById('prereq-list');
    if (pl) pl.innerHTML = '';

    const details = document.getElementById('prereq-details');
    if (details) { details.open = false; details.hidden = true; }
  }

  // ------------------------ init ------------------------
  async function initCalculator() {
    try { resetFormToDefaults(); } catch (_) {}

    try { await ensureDataLoaded(); }
    catch (e) {
      const el = document.getElementById('result');
      if (el) el.innerHTML = `<div style="color:#b00020;font-weight:700">${t('calc.error.load','데이터 로드 실패')}: ${e.message}</div>`;
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

    function refreshPrereqUI() {
      const uiKey = buildingEl.value;

      const start = clampLv(startEl.value || 1);
      const to = clampLv(targetEl.value || 1);
      startEl.value = String(start);
      targetEl.value = String(to);

      const map = {
        towncenter: { slug: 'towncenter' },
        embassy: { slug: 'embassy' },
        academy: { slug: 'academy' },
        command: { slug: 'command' },
        barracks: { slug: 'camp', variant: 'common' },
        stable: { slug: 'camp', variant: 'common' },
        range: { slug: 'camp', variant: 'common' },
        infirmary: { slug: 'infirmary' },
        'war-academy': { slug: 'war-academy' }
      };

      const cfg = map[uiKey] || {};
      let dataKey = cfg.variant ? `${cfg.slug}:${cfg.variant}` : (cfg.slug || uiKey);
      if (uiKey === 'infirmary' && !allBuildingData[dataKey]) dataKey = 'camp:common';

      if (to > start) renderPrereqBox(dataKey, start, to);
      else { const ul = document.getElementById('prereq-list'); if (ul) ul.innerHTML = ''; }

      const inc = incEl ? incEl.checked : false;
      syncPrereqDetailsVisibility(Boolean(inc && to > start));
    }
    window.__calcRefreshPrereqUI = refreshPrereqUI;

    bindOnce(buildingEl, 'input', refreshPrereqUI);
    bindOnce(startEl, 'input', refreshPrereqUI);
    bindOnce(targetEl, 'input', refreshPrereqUI);
    if (incEl) bindOnce(incEl, 'change', refreshPrereqUI);

    if (calcBtn) bindOnce(calcBtn, 'click', () => {
      const uiKey = buildingEl.value;

      const start = clampLv(startEl.value);
      const to = clampLv(targetEl.value);

      startEl.value = String(start);
      targetEl.value = String(to);

      if (start >= to) { alert(t('calc.alert.targetGtStart', '목표 레벨은 시작 레벨보다 커야 합니다.')); return; }

      const getNum = (id) => {
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

      const map = {
        towncenter: { slug: 'towncenter' },
        embassy: { slug: 'embassy' },
        academy: { slug: 'academy' },
        command: { slug: 'command' },
        barracks: { slug: 'camp', variant: 'common' },
        stable: { slug: 'camp', variant: 'common' },
        range: { slug: 'camp', variant: 'common' },
        infirmary: { slug: 'infirmary' },
        'war-academy': { slug: 'war-academy' }
      };

      const cfg = map[uiKey] || {};
      let dataKey = cfg.variant ? `${cfg.slug}:${cfg.variant}` : (cfg.slug || uiKey);
      if (uiKey === 'infirmary' && !allBuildingData[dataKey]) dataKey = 'camp:common';

      if (!allBuildingData[dataKey]) { alert(t('calc.alert.noData', '데이터가 없습니다') + `: ${getBuildingLabel(uiKey)}`); return; }

      let result;
      if (includePrereq) {
        const preLevels = readUserPrereqLevels();
        result = calculateWithPrereq(dataKey, start, to, { ...buffs, includePrereq }, preLevels);
      } else {
        result = buildMainOnlyResult(dataKey, start, to, buffs);
      }

      const totalsAfterSaul = applySaulDiscountTotals(
        {
          bread: result.bread, wood: result.wood, stone: result.stone, iron: result.iron,
          truegold: result.truegold,
          tempered_truegold: result.tempered_truegold,
          timeSec: result.timeSec
        },
        buffs.saulBonus
      );

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

    if (clearBtn) bindOnce(clearBtn, 'click', () => {
      resetFormToDefaults();
    });

    refreshPrereqUI();
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

(function () {
  'use strict';

  // ========= 전역 초기화 가드(중복 로드 방지) =========
  if (window.__calculatorScriptLoaded__) {
    console.info('[calc] calculator.js already loaded — skipping duplicate definition');
    return;
  }
  window.__calculatorScriptLoaded__ = true;

  // ---------- i18n helpers ----------
  const t = (k, fb) => (window.I18N && typeof I18N.t === 'function') ? I18N.t(k, fb ?? k) : (fb ?? k);

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
    "war-academy": "calc.form.building.option.war-academy"
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
    if (/^\d+-\d+$/.test(s)) { const [a, b] = s.split('-').map(Number); return a + b; }
    if (/^TG\d+$/.test(s)) { const n = +s.slice(2); return 30 + n * 5; }
    if (/^TG\d+-\d+$/.test(s)) { const [tg, sub] = s.split('-'); const n = +tg.slice(2); return 30 + n * 5 + (+sub); }
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
    const m = Math.floor(sec / 60); const s = sec % 60;

    const out = [];
    if (d) out.push(d + t('calc.time.daySuffix', '일'));   // ✅ 숫자 + 접미사
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

  // === [PATCH] buildings-calc.json을 1순위로, clac는 레거시 폴백으로 ===
  async function loadBuildingsJson() {
    const ts = Date.now(); // 캐시 버스터
    const base = guessBasePath();
    const candidates = [
      // ✅ 정식 경로들
      `/data/buildings-calc.json?v=${ts}`,
      `${base}data/buildings-calc.json?v=${ts}`,
      `data/buildings-calc.json?v=${ts}`,
      `../data/buildings-calc.json?v=${ts}`,
      `../../data/buildings-calc.json?v=${ts}`,
      // 🔁 레거시 파일명 폴백 (남아있을 경우 대비)
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

  // ------------------------ 표 파서 ------------------------
  function tableToRows(table) {
    if (!Array.isArray(table) || !table.length) return [];
    const header = table[0].map(String);
    const body = table.slice(1);

    const idx = {
      level: header.findIndex(h => String(h).includes('레벨')),
      meat: header.indexOf('빵'),
      wood: header.indexOf('나무'),
      coal: header.indexOf('석재'),
      iron: header.indexOf('철'),
      gold: (() => { let i = header.indexOf('순금'); if (i < 0) i = header.indexOf('크리스탈'); if (i < 0) i = header.indexOf('트루골드'); return i; })(),
      time: (() => {
        let i = header.findIndex(h => String(h).includes('건설'));
        if (i < 0) i = header.findIndex(h => String(h) === '시간' || String(h).includes('시간'));
        if (i < 0) i = header.findIndex(h => String(h).includes('(분)'));
        return i;
      })(),
      req: header.findIndex(h => String(h).includes('요구 건물') || String(h).includes('요구사항') || String(h).includes('요구')),
      tcreq: header.findIndex(h => /도시센터.*요구|요구.*도시센터/.test(String(h)))
    };

    return body.map(row => {
      const get = (i) => (i >= 0 && i < row.length) ? row[i] : 0;
      const level = labelToLevelNumber(get(idx.level));
      const meat = parseRes(get(idx.meat));
      const wood = parseRes(get(idx.wood));
      const coal = parseRes(get(idx.coal));
      const iron = parseRes(get(idx.iron));
      const crystals = parseRes(get(idx.gold));
      const time = parseTimeToSec(get(idx.time));
      const reqStr = idx.req >= 0 ? String(get(idx.req) || '') : '';
      const tcNeed = idx.tcreq >= 0 ? parseRes(get(idx.tcreq)) : 0;
      return { level, meat, wood, coal, iron, crystals, time, _req: reqStr, _tc: tcNeed };
    }).filter(r => r.level > 0);
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
        '도시센터':'towncenter','대사관':'embassy','아카데미':'academy','지휘부':'command',
        '보병대':'barracks','기병대':'stable','궁병대':'range'
      };
      const key = map[name] || name;
      const to = hasTG ? (30 + rawL * 5) : rawL;
      return { building: key, to };
    }).filter(Boolean)
      .filter(r => ALLOWED_PREREQ.has(r.building));
  }

  const SLUG_ALIASES = { towncenter: ['town-center'], command: ['command-center'] };

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

  // ------------------------ 합산/계산 ------------------------
  function sumSegment(bKey, fromLevel, toLevel) {
    const rows = allBuildingData[bKey] || [];
    let meat = 0, wood = 0, coal = 0, iron = 0, crystals = 0, time = 0;
    for (let lv = Math.max(1, fromLevel) + 1; lv <= toLevel; lv++) {
      const r = rows.find(x => x.level === lv);
      if (!r) continue;
      meat += r.meat || 0; wood += r.wood || 0; coal += r.coal || 0; iron += r.iron || 0;
      crystals += r.crystals || 0; time += r.time || 0;
    }
    return { meat, wood, coal, iron, crystals, time };
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
      meat: Math.round((res.meat || 0) * rate),
      wood: Math.round((res.wood || 0) * rate),
      coal: Math.round((res.coal || 0) * rate),
      iron: Math.round((res.iron || 0) * rate),
      crystals: Math.round(res.crystals || 0),
      timeSec: res.timeSec | 0
    };
  }
  function applySaulDiscountRow(r, saulPct) {
    const rate = Math.max(0, 1 - (Number(saulPct) || 0) / 100);
    return {
      ...r,
      meat: Math.round((r.meat || 0) * rate),
      wood: Math.round((r.wood || 0) * rate),
      coal: Math.round((r.coal || 0) * rate),
      iron: Math.round((r.iron || 0) * rate)
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
  let total = { meat: 0, wood: 0, coal: 0, iron: 0, crystals: 0, time: 0 };
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
      meat: row.meat || 0,
      wood: row.wood || 0,
      coal: row.coal || 0,
      iron: row.iron || 0,
      crystals: row.crystals || 0,
      time: row.time || 0
    });
  };

  // [FIX] 순환/중복 방지 장치
  // - visiting: 현재 재귀 스택에 올라 있는 (building, level)
  // - done: 한 번 완전히 처리(선행 보장 + 자원 합산)된 (building, level)
  const visiting = new Set();
  const done = new Set();

  const ensure = (bKey, toLevel) => {
    // 허용된 선행 빌딩만 처리
    if (!ALLOWED_PREREQ.has(bKey)) return;

    // 요구 레벨/현재 레벨 정규화
    toLevel = Math.max(PREREQ_MIN_LV, Number(toLevel) || 0);
    const currBase = Math.max(PREREQ_MIN_LV, Number(current[bKey] ?? 1));

    // 이미 충족된 경우 스킵
    if (toLevel <= currBase) return;

    // currBase+1 ~ toLevel 까지 한 레벨씩 보장
    for (let lv = currBase + 1; lv <= toLevel; lv++) {
      const nodeKey = `${bKey}#${lv}`;

      // 이미 완전히 처리된 노드면 현재 레벨만 동기화 후 스킵
      if (done.has(nodeKey)) {
        current[bKey] = Math.max(current[bKey] || 1, lv);
        continue;
      }

      // [FIX] 순환 탐지: 같은 (building, level)을 처리 중이라면 경고 후 빠져나와 무한 재귀 차단
      if (visiting.has(nodeKey)) {
        console.warn(`[calc] circular prereq detected: ${nodeKey} (main=${mainKey})`);
        return; // 현재 프레임 종료(상위 호출이 계속 진행하도록 함)
      }

      // 처리 중으로 마킹
      visiting.add(nodeKey);

      // 이 레벨의 선행 조건을 먼저 보장
      const reqs = (prereqMap[bKey] && prereqMap[bKey][lv]) || [];
      for (const r of reqs) {
        if (!r || !r.building || !Number.isFinite(r.to)) continue;
        if (!ALLOWED_PREREQ.has(r.building)) continue;
        ensure(r.building, r.to);
      }

      // 동시 경로에서 선행 처리/합산이 끝났다면 재합산 방지
      if (done.has(nodeKey)) {
        visiting.delete(nodeKey);
        current[bKey] = Math.max(current[bKey] || 1, lv);
        continue;
      }

      // 실제 자원/시간 합산 및 라인 추가
      const row = (allBuildingData[bKey] || []).find(x => x.level === lv);
      if (row) {
        total.meat += row.meat || 0;
        total.wood += row.wood || 0;
        total.coal += row.coal || 0;
        total.iron += row.iron || 0;
        total.crystals += row.crystals || 0;
        total.time += row.time || 0;
        pushLine(bKey, lv, row);
      }

      // 처리 완료 마킹 및 상태 업데이트
      done.add(nodeKey);
      visiting.delete(nodeKey);
      current[bKey] = lv;
    }
  };

  // 메인 빌딩을 목표 레벨까지 올리면서 각 레벨별 선행을 먼저 충족
  for (let lv = startLevel + 1; lv <= targetLevel; lv++) {
    const reqs = (prereqMap[mainKey] && prereqMap[mainKey][lv]) || [];
    for (const r of reqs) {
      if (!r || !ALLOWED_PREREQ.has(r.building)) continue;
      ensure(r.building, r.to);
    }

    const row = (allBuildingData[mainKey] || []).find(x => x.level === lv);
    if (row) {
      total.meat += row.meat || 0;
      total.wood += row.wood || 0;
      total.coal += row.coal || 0;
      total.iron += row.iron || 0;
      total.crystals += row.crystals || 0;
      total.time += row.time || 0;
      pushLine(mainKey, lv, row);
    }
  }

  const tf = computeTimeFactor(buffs);
  return {
    meat: total.meat, wood: total.wood, coal: total.coal, iron: total.iron,
    crystals: total.crystals, timeSec: Math.round(Math.max(0, total.time * tf)),
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
        meat: row.meat || 0,
        wood: row.wood || 0,
        coal: row.coal || 0,
        iron: row.iron || 0,
        crystals: row.crystals || 0,
        time: row.time || 0
      });
    }
    return {
      meat: seg.meat, wood: seg.wood, coal: seg.coal, iron: seg.iron,
      crystals: seg.crystals, timeSec: Math.round(Math.max(0, seg.time * tf)),
      lines, tf
    };
  }

  // ------------------------ i18n 라벨 재적용 ------------------------
  function applyI18NLabels() {
    // 폼 라벨들
    const LABEL_MAP = [
      ['label-building', 'calc.form.building.label', '건물 선택'],
      ['label-start',    'calc.form.startLevel',     '시작 레벨'],
      ['label-target',   'calc.form.targetLevel',    '목표 레벨'],
      ['label-speed',    'calc.form.speedBonus',     '건설 속도(%)'],
      ['label-saul',     'calc.form.saulBonus',      '살로 할인(%)'],
      ['label-wolf',     'calc.form.wolfBonus',      '늑대 버프(%)'],
      ['label-position', 'calc.form.positionBonus',  '직책/타이틀(%)'],
      ['label-double',   'calc.form.doubleTime',     '이중법령(시간 20% 감소)'],
      ['label-include',  'calc.form.includePrereq',  '선행 건물 포함'],
    ];
    for (const [id, key, fb] of LABEL_MAP) {
      const el = document.getElementById(id);
      if (el) el.textContent = t(key, fb);
    }

    // 타이틀/설명/선행박스 타이틀
    const title = document.getElementById('calc-title');
    if (title) title.textContent = t('calc.title', '건물 계산기');
    const desc = document.querySelector('.calc-desc');
    if (desc) desc.textContent = t('calc.desc', '업그레이드에 필요한 자원과 소요 시간을 확인하세요.');
    const preTitle = document.getElementById('prereq-title');
    if (preTitle) preTitle.textContent = t('calc.prereqBox.title', '선행 건물 요구사항');

    // placeholder + aria-label
    const placeholders = {
      startLevel:   ['calc.form.placeholder.start',    '현재 레벨'],
      targetLevel:  ['calc.form.placeholder.target',   '목표 레벨'],
      speedBonus:   ['calc.form.placeholder.speed',    '0'],
      saulBonus:    ['calc.form.placeholder.saul',     '0'],
      wolfBonus:    ['calc.form.placeholder.wolf',     '0'],
      positionBonus:['calc.form.placeholder.position', '0'],
    };
    for (const id of Object.keys(placeholders)) {
      const el = document.getElementById(id);
      if (!el) continue;
      const [key, fb] = placeholders[id];
      const label = t(key, fb);
      el.setAttribute('placeholder', label);
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', label);
    }

    // 셀렉트 옵션 텍스트
    const sel = document.getElementById('building');
    if (sel && sel.options && sel.options.length) {
      for (const opt of sel.options) {
        const k = BUILDING_I18N_KEY[opt.value] || opt.value;
        opt.textContent = t(k, opt.textContent || opt.value);
      }
      sel.setAttribute('aria-label', t('calc.form.building.label', '건물 선택'));
    }
  }

  // 전역: 언어 전환 시 호출
  window.reapplyCalculatorI18N = function reapplyCalculatorI18N() {
    applyI18NLabels();
    try { window.__calcRefreshPrereqUI && window.__calcRefreshPrereqUI(); } catch(_) {}
  };

  // ------------------------ UI ------------------------
  function renderPrereqBox(buildingKey, startLevel, targetLevel) {
    const ul = document.getElementById('prereq-list');
    if (!ul) return;
    const need = getNeedMap(buildingKey, startLevel, targetLevel);
    const keys = Object.keys(need);
    if (!keys.length) { ul.innerHTML = `<li>${t('calc.prereqBox.empty','선행조건 없음')}</li>`; return; }

    const lvLabel = t('calc.common.lv', 'Lv.');
    ul.innerHTML = keys
      .map(k => `<li>${getBuildingLabel(k)} ${lvLabel}${need[k]}</li>`)
      .join('');
  }

  // 입력 읽기
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

  function getDisplayNameForLine(lineBKey, uiKey, dataKey) {
    if (lineBKey === dataKey) return getBuildingLabel(uiKey);
    return getBuildingLabel(lineBKey);
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
    const showGold = sortedLines.some(r => (r.crystals || 0) > 0);

    const summaryTop = `
      <div style="background:#d7e8fc;padding:10px 15px;border-radius:14px;max-width:900px;margin:0 auto 10px;color:#004a99;font-weight:600;line-height:1.2;">
        <p><strong>${t('calc.result.upgrade','업그레이드:')}</strong> ${title} ${lvLabel}${startLevel} → ${lvLabel}${targetLevel}</p>
        <p><strong>${t('calc.result.time','건설 시간:')}</strong> ${formatTime(result.timeSec)}</p>
        <p><strong>${t('calc.result.totalWithSaul','총 자원 소모량(살로 적용)')}</strong></p>
        <p>🍞 ${t('calc.table.col.bread','빵')}: ${result.meat.toLocaleString()} (${formatNumber(result.meat)})</p>
        <p>🌲 ${t('calc.table.col.wood','나무')}: ${result.wood.toLocaleString()} (${formatNumber(result.wood)})</p>
        <p>🗿 ${t('calc.table.col.stone','석재')}: ${result.coal.toLocaleString()} (${formatNumber(result.coal)})</p>
        <p>⛏️ ${t('calc.table.col.iron','철')}: ${result.iron.toLocaleString()} (${formatNumber(result.iron)})</p>
        ${showGold ? `<p>🥇 ${t('calc.table.col.truegold','순금')}: ${result.crystals.toLocaleString()}</p>` : ''}
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
      const dispName = getDisplayNameForLine(ln.bKey, uiKey, dataKey);
      const discounted = applySaulDiscountRow(
        { meat: ln.meat, wood: ln.wood, coal: ln.coal, iron: ln.iron, crystals: ln.crystals, time: ln.time },
        saulPct
      );
      const timeAdj = Math.round((ln.time || 0) * (result.tf || 1));
      body += `
        <tr>
          <td>${idx}</td>
          <td>${dispName}</td>
          <td>${ln.from} → ${ln.to}</td>
          <td>${formatNumber(discounted.meat || 0)}</td>
          <td>${formatNumber(discounted.wood || 0)}</td>
          <td>${formatNumber(discounted.coal || 0)}</td>
          <td>${formatNumber(discounted.iron || 0)}</td>
          ${showGold ? `<td>${(ln.crystals || 0).toLocaleString()}</td>` : ''}
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
        ${showGold ? `<th>${t('calc.table.col.truegold','순금')}</th>` : ''}
        <th>${t('calc.table.col.time','건설 시간')}</th>
      </tr>`;

    const tableTitle = sortedLines.length
      ? t('calc.table.titleWithPrereq','상세 내역 (선행 포함)')
      : t('calc.table.title','상세 내역');

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

    // 이미 바인딩된 것으로 표시돼도 실제 리스너가 없으면 다시 바인딩 (DevTools 전용 함수가 있을 때만 검사)
    const alreadyBound = el.__bound__[type];
    let hasListener = false;

    if (alreadyBound && typeof getEventListeners === 'function') {
      const listeners = getEventListeners(el)[type] || [];
      hasListener = listeners.length > 0;
    }

    if (!alreadyBound || !hasListener) {
      el.addEventListener(type, handler);
      el.__bound__[type] = true;
    }
  }

  // ------------------------ 폼 초기화: resetFormToDefaults() ------------------------
  function resetFormToDefaults() {
    // 셀렉트
    const buildingEl = document.getElementById('building');
    if (buildingEl) buildingEl.selectedIndex = 0;

    // 숫자 입력 기본값
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = String(val); };
    setVal('startLevel', 1);
    setVal('targetLevel', 1);
    setVal('speedBonus', 0);
    setVal('saulBonus', 0);
    setVal('wolfBonus', 0);
    setVal('positionBonus', 0);

    // 체크박스 해제
    const uncheck = (id) => { const el = document.getElementById(id); if (el) el.checked = false; };
    uncheck('doubleTime');
    uncheck('includePrereq');

    // 선행 입력칸 비우기
    ['prereqAcademy','prereqRange','prereqStable','prereqBarracks','prereqEmbassy'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // 결과/선행 박스 초기화 및 숨김
    const resultDiv = document.getElementById('result');
    if (resultDiv) resultDiv.innerHTML = '';

    const pl = document.getElementById('prereq-list');
    if (pl) pl.innerHTML = '';

    const details = document.getElementById('prereq-details');
    if (details) { details.open = false; details.hidden = true; }
  }

  // ------------------------ init ------------------------
  async function initCalculator() {
    // ✅ 재진입 시에도 항상 폼 초기화 보장
    try { resetFormToDefaults(); } catch (_) {}

    // 데이터 로드 (idempotent)
    try { await ensureDataLoaded(); }
    catch (e) {
      const el = document.getElementById('result');
      if (el) el.innerHTML = `<div style="color:#b00020;font-weight:700">${t('calc.error.load','데이터 로드 실패')}: ${e.message}</div>`;
      return;
    }

    // i18n 라벨/버튼/placeholder 적용 (idempotent)
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

    function refreshPrereqUI() {
      const uiKey = buildingEl.value;
      const start = parseInt(startEl.value || 1, 10);
      const to = parseInt(targetEl.value || 1, 10);
      const map = { towncenter:{slug:'towncenter'}, embassy:{slug:'embassy'}, academy:{slug:'academy'}, command:{slug:'command'},
        barracks:{slug:'camp',variant:'common'}, stable:{slug:'camp',variant:'common'}, range:{slug:'camp',variant:'common'}, infirmary:{slug:'infirmary'},'war-academy': {slug:'war-academy'} };
      let dataKey = (map[uiKey]?.variant) ? `${map[uiKey].slug}:${map[uiKey].variant}` : (map[uiKey]?.slug || uiKey);
      if (uiKey === 'infirmary' && !allBuildingData[dataKey]) dataKey = 'camp:common';

      if (to > start) renderPrereqBox(dataKey, start, to);
      else { const ul = document.getElementById('prereq-list'); if (ul) ul.innerHTML = ''; }

      const inc = incEl?.checked;
      syncPrereqDetailsVisibility(Boolean(inc && to > start));
    }
    window.__calcRefreshPrereqUI = refreshPrereqUI;

    // 이벤트 바인딩 (idempotent)
    bindOnce(buildingEl, 'input', refreshPrereqUI);
    bindOnce(startEl, 'input', refreshPrereqUI);
    bindOnce(targetEl, 'input', refreshPrereqUI);
    if (incEl) bindOnce(incEl, 'change', refreshPrereqUI);

    if (calcBtn) bindOnce(calcBtn, 'click', () => {
      const uiKey = buildingEl.value;
      const start = parseInt(startEl.value, 10);
      const to = parseInt(targetEl.value, 10);
      if (!Number.isFinite(start) || !Number.isFinite(to)) { alert(t('calc.alert.invalidLevel','레벨 입력이 올바르지 않습니다.')); return; }
      if (start >= to) { alert(t('calc.alert.targetGtStart','목표 레벨은 시작 레벨보다 커야 합니다.')); return; }

      const buffs = {
        speedBonus: parseFloat(document.getElementById('speedBonus')?.value) || 0,
        saulBonus: parseFloat(document.getElementById('saulBonus')?.value) || 0,
        wolfBonus: parseFloat(document.getElementById('wolfBonus')?.value) || 0,
        positionBonus: parseFloat(document.getElementById('positionBonus')?.value) || 0,
        doubleTime: !!document.getElementById('doubleTime')?.checked,
      };
      const includePrereq = !!incEl?.checked;

      const map = { towncenter:{slug:'towncenter'}, embassy:{slug:'embassy'}, academy:{slug:'academy'}, command:{slug:'command'},
        barracks:{slug:'camp',variant:'common'}, stable:{slug:'camp',variant:'common'}, range:{slug:'camp',variant:'common'}, infirmary:{slug:'infirmary'},'war-academy': {slug:'war-academy'} };
      let dataKey = (map[uiKey]?.variant) ? `${map[uiKey].slug}:${map[uiKey].variant}` : (map[uiKey]?.slug || uiKey);
      if (uiKey === 'infirmary' && !allBuildingData[dataKey]) dataKey = 'camp:common';
      if (!allBuildingData[dataKey]) { alert(t('calc.alert.noData','데이터가 없습니다') + `: ${getBuildingLabel(uiKey)}`); return; }

      let result;
      if (includePrereq) {
        const preLevels = readUserPrereqLevels();
        result = calculateWithPrereq(dataKey, start, to, { ...buffs, includePrereq }, preLevels);
      } else {
        result = buildMainOnlyResult(dataKey, start, to, buffs);
      }

      const totalsAfterSaul = applySaulDiscountTotals(
        { meat: result.meat, wood: result.wood, coal: result.coal, iron: result.iron, crystals: result.crystals, timeSec: result.timeSec },
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

    // ✅ 초기화 버튼은 공용 초기화 함수 호출
    if (clearBtn) bindOnce(clearBtn, 'click', () => {
      resetFormToDefaults();
    });

    // 초기 1회 UI 동기화
    refreshPrereqUI();
    window.__calculatorInited__ = true;
    console.info('[calc] init complete');
  }

  // 외부에서 호출
  window.initCalculator = initCalculator;
  window._calcDebug = { allBuildingData, prereqMap };

  // ✅ 전역 API로 reset 노출 (라우팅 진입 시 언제든 호출 가능)
  window.KSD = window.KSD || {};
  window.KSD.buildingUI = window.KSD.buildingUI || {};
  window.KSD.buildingUI.reset = resetFormToDefaults;
})();

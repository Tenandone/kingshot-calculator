// calculator.js — pages/calculator.html 최적화본 대응 (final, robust JSON loader + SPA-safe init guards)
//
// 보강 포인트:
// - SPA 라우팅에서 스크립트가 중복 로드되어도 안전(초기화 가드 + 이벤트 바인딩 중복 방지)
// - DOM 요소 미존재 시 우아한 무시(에러 대신 경고)
// - JSON 로더: 절대경로 우선 + Content-Type/본문 검사로 HTML 오인 파싱 차단
// - 어느 경로를 실제 사용했는지 콘솔에 기록

(function () {
  'use strict';

  // ========= 전역 초기화 가드(중복 로드 방지) =========
  if (window.__calculatorScriptLoaded__) {
    console.info('[calc] calculator.js already loaded — skipping duplicate definition');
    return;
  }
  window.__calculatorScriptLoaded__ = true;

  // ------------------------ 상태 ------------------------
  const allBuildingData = {};
  let prereqMap = {};
  let _loaded = false;
  let _loadingPromise = null;

  // ===== 선행 제한 & 최소 레벨 =====
  const ALLOWED_PREREQ = new Set(['academy', 'barracks', 'range', 'stable', 'embassy']);
  const PREREQ_MIN_LV = 3;
  const DISPLAY_ORDER_PREREQ = ['academy', 'barracks', 'range', 'stable', 'embassy'];

  // ------------------------ 빌딩 키/표시명 ------------------------
  const buildingNameMap = {
    towncenter: '도시센터',
    'town-center': '도시센터',
    embassy: '대사관',
    academy: '아카데미',
    command: '지휘부',
    'command-center': '지휘부',
    barracks: '보병대',
    stable: '기병대',
    range: '궁병대',
    infirmary: '야전병원',
    'camp:common': '캠프'
  };

  const nameToKey = {
    '도시센터': 'towncenter',
    '대사관': 'embassy',
    '아카데미': 'academy',
    '지휘부': 'command',
    '보병대': 'barracks',
    '기병대': 'stable',
    '궁병대': 'range',
    '야전병원': 'infirmary',
    '황금용광로': 'truegold-crucible',
    '민가': 'house',
    '벌목장': 'lumbermill',
    '석재공장': 'stonework',
    '제철공장': 'ironworks',
    '방앗간': 'mill',
    '영웅의 홀': 'hero-hall'
  };

  const CALC_BUILDING_MAP = {
    towncenter: { slug: 'towncenter' },
    embassy: { slug: 'embassy' },
    academy: { slug: 'academy' },
    command: { slug: 'command' },
    barracks: { slug: 'camp', variant: 'common' },
    stable: { slug: 'camp', variant: 'common' },
    range: { slug: 'camp', variant: 'common' },
    infirmary: { slug: 'infirmary' }
  };

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
    if (d) out.push(d + '일'); if (h) out.push(h + '시간'); if (m) out.push(m + '분'); if (s) out.push(s + '초');
    return out.join(' ') || '0초';
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

  async function loadBuildingsJson() {
    const ts = Date.now(); // 캐시 버스터
    const base = guessBasePath();
    const candidates = [
      `/data/buildings.json?v=${ts}`,
      `${base}data/buildings.json?v=${ts}`,
      `data/buildings.json?v=${ts}`,
      `../data/buildings.json?v=${ts}`,
      `../../data/buildings.json?v=${ts}`
    ];

    const errors = [];
    for (const u of candidates) {
      try {
        const j = await fetchJsonSafe(u);
        const arr = Array.isArray(j.buildings) ? j.buildings : [];
        console.info('[calc] buildings.json loaded from:', u, '(count:', arr.length, ')');
        return arr;
      } catch (e) {
        errors.push(`${u} → ${e.message}`);
      }
    }
    console.error('[calc] Failed to load buildings.json:\n' + errors.join('\n'));
    throw new Error('buildings.json을 불러올 수 없습니다.');
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
      const t = token.replace(/\bTG\b/ig, '').replace(/\s+/g, ' ').trim();
      const m = t.match(/^(.*?)(?:\s*(?:Lv\.?|레벨)?\s*(\d+))?$/i);
      if (!m) return null;
      const name = (m[1] || '').trim();
      const rawL = m[2] ? parseInt(m[2], 10) : 1;
      const key = nameToKey[name] || name;
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

    const ensure = (bKey, toLevel) => {
      if (!ALLOWED_PREREQ.has(bKey)) return;
      toLevel = Math.max(PREREQ_MIN_LV, toLevel);
      const curr = Math.max(PREREQ_MIN_LV, current[bKey] ?? 1);
      if (toLevel <= curr) return;

      for (let lv = curr + 1; lv <= toLevel; lv++) {
        const reqs = (prereqMap[bKey] && prereqMap[bKey][lv]) || [];
        for (const r of reqs) {
          if (!r || !r.building || !Number.isFinite(r.to)) continue;
          if (!ALLOWED_PREREQ.has(r.building)) continue;
          ensure(r.building, r.to);
        }
        const row = (allBuildingData[bKey] || []).find(x => x.level === lv);
        if (row) {
          total.meat += row.meat || 0; total.wood += row.wood || 0; total.coal += row.coal || 0;
          total.iron += row.iron || 0; total.crystals += row.crystals || 0; total.time += row.time || 0;
          pushLine(bKey, lv, row);
        }
      }
      current[bKey] = toLevel;
    };

    for (let lv = startLevel + 1; lv <= targetLevel; lv++) {
      const reqs = (prereqMap[mainKey] && prereqMap[mainKey][lv]) || [];
      for (const r of reqs) {
        if (!r || !ALLOWED_PREREQ.has(r.building)) continue;
        ensure(r.building, r.to);
      }
      const row = (allBuildingData[mainKey] || []).find(x => x.level === lv);
      if (row) {
        total.meat += row.meat || 0; total.wood += row.wood || 0; total.coal += row.coal || 0;
        total.iron += row.iron || 0; total.crystals += row.crystals || 0; total.time += row.time || 0;
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

  // ------------------------ UI ------------------------
  function renderPrereqBox(buildingKey, startLevel, targetLevel) {
    const ul = document.getElementById('prereq-list');
    if (!ul) return;
    const need = getNeedMap(buildingKey, startLevel, targetLevel);
    const keys = Object.keys(need);
    if (!keys.length) { ul.innerHTML = '<li>선행조건 없음</li>'; return; }
    ul.innerHTML = keys.map(k => `<li>${buildingNameMap[k] || k} Lv.${need[k]}</li>`).join('');
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
    if (lineBKey === dataKey) return buildingNameMap[uiKey] || uiKey;
    return buildingNameMap[lineBKey] || lineBKey;
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

    const title = buildingNameMap[uiKey] || buildingNameMap[dataKey] || uiKey || dataKey;

    const summaryTop = `
      <div style="background:#d7e8fc;padding:10px 15px;border-radius:14px;max-width:900px;margin:0 auto 10px;color:#004a99;font-weight:600;line-height:1.2;">
        <p><strong>업그레이드:</strong> ${title} Lv.${startLevel} → Lv.${targetLevel}</p>
        <p><strong>건설 시간:</strong> ${formatTime(result.timeSec)}</p>
        <p><strong>총 자원 소모량(살로 적용)</strong></p>
        <p>🍞 빵: ${result.meat.toLocaleString()} (${formatNumber(result.meat)})</p>
        <p>🌲 나무: ${result.wood.toLocaleString()} (${formatNumber(result.wood)})</p>
        <p>🗿 석재: ${result.coal.toLocaleString()} (${formatNumber(result.coal)})</p>
        <p>⛏️ 철: ${result.iron.toLocaleString()} (${formatNumber(result.iron)})</p>
        <p>🥇 순금: ${result.crystals.toLocaleString()}</p>
      </div>
    `;

    // 선행 요약(현재 레벨이 0이면 숨김)
    const prereqItems = DISPLAY_ORDER_PREREQ
      .filter(k => needMap[k] != null && ((preRaw[k] | 0) > 0))
      .map(k => {
        const needLv = needMap[k] | 0;
        const curLv = preRaw[k] | 0;
        const label = buildingNameMap[k] || k;
        return `<li>${label}: 현재 Lv.${curLv} (요구 Lv.${needLv})</li>`;
      });
    const prereqSummary = prereqItems.length
      ? `<section style="max-width:900px;margin:0 auto 10px;">
           <h3 class="calc-title" style="font-size:16px;margin:0 0 6px">선행 건물 요약</h3>
           <ul style="padding-left:18px;line-height:1.6">${prereqItems.join('')}</ul>
         </section>`
      : '';

    const sortedLines = sortLines(result.lines || [], dataKey);
    const showGold = sortedLines.some(r => (r.crystals || 0) > 0);
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
        <th>#</th><th>건물</th><th>레벨</th>
        <th>빵</th><th>나무</th><th>석재</th><th>철</th>
        ${showGold ? '<th>순금</th>' : ''}<th>건설 시간</th>
      </tr>`;

    const table = `
      <h3 class="calc-title" style="font-size:16px;margin:10px auto;max-width:900px;">상세 내역 ${sortedLines.length ? '(선행 포함)' : ''}</h3>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;max-width:900px;margin:0 auto;text-align:center;font-size:13px;">
        <thead style="background:#e9f0fa;font-weight:700">${thead}</thead>
        <tbody>${body}</tbody>
      </table>`;

    resultDiv.innerHTML = summaryTop + prereqSummary + table;
  }

  // ------------------------ 초기화 ------------------------
  // 이벤트 중복 바인딩 방지 헬퍼
  function bindOnce(el, type, handler) {
    if (!el) return;
    if (!el.__bound__) el.__bound__ = {};
    if (el.__bound__[type]) return;
    el.addEventListener(type, handler);
    el.__bound__[type] = true;
  }

  async function initCalculator() {
    // 한 페이지에서 여러 번 호출되어도 한 번만 초기화
    if (window.__calculatorInited__) {
      // 데이터가 이미 로드되어 있다면 UI만 재동기화
      try { refreshPrereqUI(); } catch (_) {}
      return;
    }

    try { await ensureDataLoaded(); }
    catch (e) {
      const el = document.getElementById('result');
      if (el) el.innerHTML = `<div style="color:#b00020;font-weight:700">데이터 로드 실패: ${e.message}</div>`;
      return;
    }

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
      const map = CALC_BUILDING_MAP[uiKey] || { slug: uiKey };
      let dataKey = map.variant ? `${map.slug}:${map.variant}` : map.slug;
      if (uiKey === 'infirmary' && !allBuildingData[dataKey]) dataKey = 'camp:common';

      if (to > start) {
        renderPrereqBox(dataKey, start, to);
      } else {
        const ul = document.getElementById('prereq-list');
        if (ul) ul.innerHTML = '';
      }

      const inc = incEl?.checked;
      syncPrereqDetailsVisibility(Boolean(inc && to > start));
    }

    // 바인딩(중복 방지)
    bindOnce(buildingEl, 'input', refreshPrereqUI);
    bindOnce(startEl, 'input', refreshPrereqUI);
    bindOnce(targetEl, 'input', refreshPrereqUI);
    if (incEl) bindOnce(incEl, 'change', refreshPrereqUI);

    if (calcBtn) bindOnce(calcBtn, 'click', () => {
      const uiKey = buildingEl.value;
      const start = parseInt(startEl.value, 10);
      const to = parseInt(targetEl.value, 10);
      if (!Number.isFinite(start) || !Number.isFinite(to)) { alert('레벨 입력이 올바르지 않습니다.'); return; }
      if (start >= to) { alert('목표 레벨은 시작 레벨보다 커야 합니다.'); return; }

      const buffs = {
        speedBonus: parseFloat(document.getElementById('speedBonus')?.value) || 0,
        saulBonus: parseFloat(document.getElementById('saulBonus')?.value) || 0,
        wolfBonus: parseFloat(document.getElementById('wolfBonus')?.value) || 0,
        positionBonus: parseFloat(document.getElementById('positionBonus')?.value) || 0,
        doubleTime: !!document.getElementById('doubleTime')?.checked,
      };
      const includePrereq = !!incEl?.checked;

      const map = CALC_BUILDING_MAP[uiKey] || { slug: uiKey };
      let dataKey = map.variant ? `${map.slug}:${map.variant}` : map.slug;
      if (uiKey === 'infirmary' && !allBuildingData[dataKey]) dataKey = 'camp:common';
      if (!allBuildingData[dataKey]) { alert(`데이터가 없습니다: ${buildingNameMap[uiKey] || uiKey}`); return; }

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

    if (clearBtn) bindOnce(clearBtn, 'click', () => {
      if (buildingEl) buildingEl.selectedIndex = 0;
      if (startEl) startEl.value = 1;
      if (targetEl) targetEl.value = 1;

      ['speedBonus','saulBonus','wolfBonus','positionBonus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 0;
      });

      const dt = document.getElementById('doubleTime'); if (dt) dt.checked = false;
      if (incEl) incEl.checked = false;

      ['prereqAcademy','prereqRange','prereqStable','prereqBarracks','prereqEmbassy'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });

      syncPrereqDetailsVisibility(false);

      const r = document.getElementById('result'); if (r) r.innerHTML = '';
      const pl = document.getElementById('prereq-list'); if (pl) pl.innerHTML = '';
    });

    // 초기 1회 UI 동기화
    refreshPrereqUI();
    window.__calculatorInited__ = true;
    console.info('[calc] init complete');
  }

  // 외부에서 호출
  window.initCalculator = initCalculator;
  window._calcDebug = { allBuildingData, prereqMap };
})();

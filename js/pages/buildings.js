// /js/pages/buildings.js — history-mode ready (calculator-free, i18n-ready, req-building auto-translate)
(function () {
  'use strict';

  // 표준키 → i18n 라벨 매핑 (헤더 패치용)
  window.KEY_TO_I18N = {
    level: 'buildings.col.level',
    reqBuilding: 'buildings.col.reqBuilding',
    bread: 'buildings.col.bread',
    wood: 'buildings.col.wood',
    stone: 'buildings.col.stone',
    iron: 'buildings.col.iron',
    truegold: 'buildings.col.gold',
    buildTimeMin: 'buildings.col.buildTimeMin',
    power: 'buildings.col.power'
  };

  /* =============================
   * 렌더 후 테이블 헤더 번역 치환
   * ============================= */
  (function setupHeaderI18NBridge(){
    function i18nHeaderText(raw){
      const key = (window.KEY_TO_I18N && window.KEY_TO_I18N[raw]) || raw;
      if (window.I18N && typeof I18N.t === 'function') return I18N.t(key, raw);
      return raw;
    }
    function patchTableHeaders(root){
      const scope = root || document;
      const ths = scope.querySelectorAll('table th, .table th, thead th');
      ths.forEach(th => {
        const raw = (th.textContent || '').trim();
        if (!raw) return;
        if (window.KEY_TO_I18N && Object.prototype.hasOwnProperty.call(window.KEY_TO_I18N, raw)) {
          th.textContent = i18nHeaderText(raw);
        }
      });
    }
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => patchTableHeaders(), 0));
    document.addEventListener('i18n:changed', () => setTimeout(() => patchTableHeaders(), 0));
    window.addEventListener('hashchange', () => setTimeout(() => patchTableHeaders(), 0));
    window.addEventListener('popstate',  () => setTimeout(() => patchTableHeaders(), 0));
    window.__patchKsHeaders = patchTableHeaders;
  })();

  // ---- i18n helpers (안전 폴백) ----
  const t = (key, fallback) =>
    (window.I18N && typeof I18N.t === 'function') ? I18N.t(key, fallback ?? key) : (fallback ?? key);
  const applyI18N = (root) => { if (window.I18N && typeof I18N.applyTo === 'function') I18N.applyTo(root || document); };

  // ---------- ROOT ----------
  const ROOT = (() => {
    const i = location.pathname.indexOf('/pages/');
    return (i >= 0) ? location.pathname.slice(0, i + 1) : '/';
  })();

  // 데이터 경로 폴백
  const DATA_CANDIDATES = [
    'data/buildings.json',
    ROOT + 'data/buildings.json',
    '/data/buildings.json',
    '../data/buildings.json',
    '../../data/buildings.json'
  ];

  // ---------- utils ----------
  const esc  = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm = (s) => String(s ?? '').trim().toLowerCase();
  const looksLikeKey = (s) => (typeof s === 'string' && /^[a-z0-9_.-]+$/i.test(s));

  // TG 라벨 적용 대상
  const TG_LABEL_SLUGS = new Set(['towncenter', 'command-center', 'command', 'embassy', 'infantry','cavalry','archer','range']);

  function imgUrl(p){
    if(!p) return ROOT + 'img/placeholder.webp';
    if(/^https?:\/\//i.test(p)) return p;
    if(p.startsWith('/')) return p;
    return ROOT + p.replace(/^\.?\//,'');
  }

  // 숫자 약어: k / m / b (언어화)
  function fmtAbbrev(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v ?? '');
    const x = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    const k = t('num.k', 'k');
    const m = t('num.m', 'm');
    const b = t('num.b', 'b');
    const fix1 = (y) => (y % 1 === 0 ? String(y) : y.toFixed(1).replace(/\.0$/,''));
    if (x >= 1e9)  return sign + fix1(x / 1e9) + b;
    if (x >= 1e6)  return sign + fix1(x / 1e6) + m;
    if (x >= 1e3)  return sign + fix1(x / 1e3) + k;
    return String(n);
  }

  // 시간 포맷(d h m) — 큰 값(>=100000)은 초로 간주, 아니면 분 (언어화)
  function fmtTime(v) {
    const n = Number(v);
    const D = t('time.d', 'd'), H = t('time.h', 'h'), M = t('time.m', 'm');
    if (!Number.isFinite(n) || n <= 0) return `0${M}`;
    const secs = n >= 100000 ? n : n * 60;
    let s = Math.floor(secs);
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600);  s -= h * 3600;
    const m = Math.floor(s / 60);
    const out = [];
    if (d) out.push(d + D);
    if (h) out.push(h + H);
    if (m || (!d && !h)) out.push(m + M);
    return out.join(' ');
  }

  // ---------- Level 라벨 ----------
  function levelToLabel(n) {
    const lv = Number(n);
    if (!Number.isFinite(lv)) return String(n);
    if (lv <= 30) return String(lv);
    if (lv <= 34) return `30-${lv - 30}`;
    const offset = lv - 35;                // 0..20
    const tg = Math.floor(offset / 5) + 1; // 1..5
    const pos = offset % 5;                // 0..4
    return pos === 0 ? `TG${tg}` : `TG${tg}-${pos}`;
  }

  // ---------- slug/variant alias ----------
  const SLUG_ALIAS = {
    'barracks':       { slug: 'barracks' },
    'stable':         { slug: 'stable' },
    'range':          { slug: 'range' },
    'town-center':    { slug: 'towncenter' },
    'command-center': { slug: 'command' } // 구링크 보정
  };

  function resolveSlugVariant(rawSlug, rawVariant){
    const key = norm(rawSlug);
    const hit = SLUG_ALIAS[key] || null;
    return {
      slug:    norm(hit && hit.slug ? hit.slug : key),
      variant: norm(hit && hit.variant ? hit.variant : (rawVariant || ''))
    };
  }

  /* =============================
   * 요구 건물 자동 번역 유틸
   * ============================= */
  const BUILDING_I18N = {
    "대사관":   { ko:"대사관", en:"Embassy",        ja:"大使館",   "zh-CN":"大使馆",   "zh-TW":"大使館" },
    "야전병원": { ko:"야전병원", en:"Infirmary",      ja:"野戦病院", "zh-CN":"野战医院", "zh-TW":"野戰醫院" },
    "궁병대":   { ko:"궁병대", en:"Archer Camp",     ja:"弓兵隊",   "zh-CN":"弓兵营",   "zh-TW":"弓兵營" },
    "아카데미": { ko:"아카데미", en:"Academy",        ja:"アカデミー","zh-CN":"学院",    "zh-TW":"學院" },
    "기병대":   { ko:"기병대", en:"Cavalry Camp",    ja:"騎兵隊",   "zh-CN":"骑兵营",   "zh-TW":"騎兵營" },
    "보병대":   { ko:"보병대", en:"Infantry Camp",   ja:"歩兵隊",   "zh-CN":"步兵营",   "zh-TW":"步兵營" },
    "석재공장": { ko:"석재공장", en:"Stoneworks",     ja:"石材工場", "zh-CN":"石材工坊", "zh-TW":"石材工坊" },
    "제철공장": { ko:"제철공장", en:"Foundry",        ja:"製鉄工場", "zh-CN":"铸造所",   "zh-TW":"鑄造所" },
    "방앗간":   { ko:"방앗간", en:"Mill",            ja:"粉挽き小屋","zh-CN":"磨坊",    "zh-TW":"磨坊" },
    "민가":     { ko:"민가",   en:"House",           ja:"民家",     "zh-CN":"民居",     "zh-TW":"民居" },
    "벌목장":   { ko:"벌목장", en:"Lumber Mill",     ja:"伐採場",   "zh-CN":"伐木场",   "zh-TW":"伐木場" },
    "영웅의 홀": { ko:"영웅의 홀", en:"Hall of Heroes", ja:"英雄の間", "zh-CN":"英雄殿堂", "zh-TW":"英雄殿堂" },
    "지휘부":   { ko:"지휘부", en:"Command Center",  ja:"指揮部",   "zh-CN":"指挥部",   "zh-TW":"指揮部" }
  };
  const UI_I18N = {
    ko:{Lv:"Lv.", TG:"TG", comma:", "},
    en:{Lv:"Lv.", TG:"TG", comma:", "},
    ja:{Lv:"Lv.", TG:"TG", comma:", "},
    "zh-CN":{Lv:"Lv.", TG:"TG", comma:"，"},
    "zh-TW":{Lv:"Lv.", TG:"TG", comma:"，"}
  };
  function translateReqLabel(labelKo, lang) {
    const ui = UI_I18N[lang] || UI_I18N.en;
    return String(labelKo || '')
      .split(',')
      .map(s => s.trim())
      .map(part => {
        const m = part.match(/^([가-힣\s·'의]+?)\s*(TG)?\s*(Lv\.\s*\d+)?$/);
        if (!m) {
          let fb = part;
          for (const koName of Object.keys(BUILDING_I18N)) {
            const local = BUILDING_I18N[koName][lang] || koName;
            fb = fb.replaceAll(koName, local);
          }
          return fb;
        }
        const [, nameKo, tg, lv] = m;
        const local = (BUILDING_I18N[nameKo] && BUILDING_I18N[nameKo][lang]) || nameKo;
        const tgOut = tg ? ` ${ui.TG}` : '';
const lvOut = lv ? ` ${lv.replace("Lv.", ui.Lv)}` : '';
return `${local}${tgOut}${lvOut}`.trim();
      })
      .join(ui.comma);
  }

  // ---------- data (cache) ----------
  let cache = null;

  async function fetchJsonWithFallback(urls){
    for (const u of urls) {
      try {
        const r = await fetch(u, { cache: 'no-store' });
        if (r.ok) return await r.json();
      } catch (_) {}
    }
    throw new Error('buildings.json 경로를 찾을 수 없습니다.');
  }

  async function loadData(){
    if (cache) return cache;
    const j = await fetchJsonWithFallback(DATA_CANDIDATES);
    cache = Array.isArray(j.buildings) ? j.buildings : [];
    return cache;
  }

  // ---------- DOM helpers ----------
  const $grid = () => document.getElementById('buildings-grid');
  const $root = () => document.getElementById('building-root');

  function showListMode(){ const g=$grid(), r=$root(); if(g) g.style.display='grid'; if(r){ r.style.display='none'; r.innerHTML=''; } }
  function showDetailMode(){ const g=$grid(), r=$root(); if(g) g.style.display='none'; if(r) r.style.display='block'; }

  // ---- header/column finder ----
  const LEVEL_KEYS = ['레벨','lv','level','等级','等級'];
  const TIME_I18N_KEYS = [
    'buildings.col.buildtime',
    'buildings.col.buildtimemin',
    'buildings.col.buildTimeMin',
    'buildings.col.buildTime'
  ];
  const TIME_STRICT_RE = /^(?:건설\s*시간|건축\s*시간|build(?:ing)?\s*time|construction\s*time|建造時間|建設時間|施工時間)$/i;
  const TIME_LOOSE_NEEDLES = ['건설','건축','build','construction','建設','建造','施工','time','시간'];

  const findIndexContains = (arr, needles) =>
    arr.findIndex(h => needles.some(n => String(h).toLowerCase().includes(n)));

  const findHeader = (arr, names) => {
    const lower = arr.map(x => String(x).toLowerCase());
    for (const name of names) {
      const idx = lower.indexOf(String(name).toLowerCase());
      if (idx >= 0) return idx;
    }
    return -1;
  };

  /* =============================
   * 표 렌더 (크리스탈/트루골드→순금 통합 + TG 라벨 + 약어/시간 포맷 + 순금 자동 숨김 + 요구건물 번역)
   * ============================= */
  function buildTable(rows, ctx = {}) {
    if (!rows || !rows.length) return '';

    const slug = String(ctx.slug || '').toLowerCase();
    const useTGLabels = TG_LABEL_SLUGS.has(slug);

    // 헤더/바디
    let header = Array.isArray(rows[0]) ? rows[0].slice() : [];
    let body   = rows.slice(1).map(r => Array.isArray(r) ? r.slice() : []);

    // 레벨/시간 인덱스
    let idxLevel = findIndexContains(header, LEVEL_KEYS);
    if (idxLevel < 0) idxLevel = findHeader(header, ['buildings.col.level']);

    let idxTime = findHeader(header, TIME_I18N_KEYS);
    if (idxTime < 0) idxTime = header.findIndex(h => TIME_STRICT_RE.test(String(h).trim()));
    if (idxTime < 0) idxTime = findIndexContains(header, TIME_LOOSE_NEEDLES);

    // 자원/순금 컬럼 (alias 포함)
    let idxGold  = findHeader(header, ['순금','gold','buildings.col.gold','buildings.col.truegold']);
    let idxCrys  = findHeader(header, ['크리스탈','crystal','水晶','クリスタル']);
    let idxTG    = findHeader(header, ['트루골드','true gold','truegold','tg']);

    // (A) '크리스탈' → '순금'
    if (idxCrys >= 0 && idxGold < 0) {
      header[idxCrys] = t('buildings.col.gold', '순금');
      idxGold = idxCrys;
      idxCrys = -1;
    } else if (idxCrys >= 0 && idxGold >= 0) {
      body.forEach(r => {
        const g = r[idxGold];
        const c = r[idxCrys];
        const isEmpty = (v) => {
          if (v === undefined || v === null) return true;
          const s = String(v).trim();
          return (s === '' || s === '-' || s === '–' || s === '0');
        };
        if (isEmpty(g) && !isEmpty(c)) r[idxGold] = c;
      });
      header.splice(idxCrys, 1);
      body.forEach(r => { if (idxCrys < r.length) r.splice(idxCrys, 1); });
      if (idxTime  > idxCrys) idxTime--;
      if (idxLevel > idxCrys) idxLevel--;
      idxCrys = -1;
    }

    // (B) '트루골드' → '순금'
    if (idxTG >= 0 && idxGold < 0) {
      header[idxTG] = t('buildings.col.gold', '순금');
      idxGold = idxTG;
      idxTG = -1;
    } else if (idxTG >= 0 && idxGold >= 0) {
      body.forEach(r => {
        const g = r[idxGold];
        const tg = r[idxTG];
        const isEmpty = (v) => {
          if (v === undefined || v === null) return true;
          const s = String(v).trim();
          return (s === '' || s === '–' || s === '-' || s === '0');
        };
        if (isEmpty(g) && !isEmpty(tg)) r[idxGold] = tg;
      });
      header.splice(idxTG, 1);
      body.forEach(r => { if (idxTG < r.length) r.splice(idxTG, 1); });
      if (idxTime  > idxTG) idxTime--;
      if (idxLevel > idxTG) idxLevel--;
      idxTG = -1;
    }

    // (C) 순금 열이 없으면 삽입(0으로)
    if (findHeader(header, [t('buildings.col.gold','순금'), '순금','gold','buildings.col.gold','buildings.col.truegold']) < 0) {
      const pos = idxTime >= 0 ? idxTime : header.length;
      header.splice(pos, 0, t('buildings.col.gold', '순금'));
      body.forEach(r => r.splice(pos, 0, 0));
      if (idxTime >= 0) idxTime++;
      idxGold = pos;
    } else {
      idxGold = findHeader(header, [t('buildings.col.gold','순금'), '순금','gold','buildings.col.gold','buildings.col.truegold']);
    }

    // (D) 순금이 전 행에서 비어있으면 컬럼 제거
    (function maybeHideGold() {
      if (idxGold < 0) return;
      const isEmptyGold = (v) => {
        if (v === undefined || v === null) return true;
        const s = String(v).trim().toLowerCase().replace(/[, ]/g, '');
        if (s === '' || s === '-' || s === '–' || s === 'null' || s === 'undefined') return true;
        const num = Number(s.replace(/k$/,'000').replace(/m$/,'000000').replace(/b$/,'000000000'));
        if (Number.isFinite(num)) return num <= 0;
        return false;
      };
      const hasAny = body.some(r => !isEmptyGold(r[idxGold]));
      if (!hasAny) {
        header.splice(idxGold, 1);
        body.forEach(r => { if (idxGold < r.length) r.splice(idxGold, 1); });
        if (idxTime  > idxGold) idxTime--;
        if (idxLevel > idxGold) idxLevel--;
        idxGold = -1;
      }
    })();

    // === 요구 건물 열 자동 번역 ===
    let idxReq = findHeader(header, [
      'buildings.col.reqBuilding', 'buildings.col.reqbuilding',
      '요구 건물','required buildings','必要建物','所需建筑','所需建築'
    ]);
    if (idxReq >= 0) {
      const lang = (window.I18N && I18N.current) ? I18N.current : 'ko';
      body.forEach(r => {
        if (typeof r[idxReq] === 'string' && r[idxReq]) {
          r[idxReq] = translateReqLabel(r[idxReq], lang);
        }
      });
    }

    // 자원 약어 포맷 열 찾기
    const RESOURCE_NAMES = ['빵','bread','나무','wood','석재','stone','철','iron', t('buildings.col.gold','순금').toLowerCase(), 'gold'];
    const resourceKeyRe = /^buildings\.col\.(bread|wood|stone|iron|gold|truegold)$/i;

    const resourceIdxs = header.reduce((acc, h, i) => {
      const str = String(h);
      const name = str.toLowerCase();
      if (RESOURCE_NAMES.includes(name) || resourceKeyRe.test(str)) acc.push(i);
      return acc;
    }, []);

    // 헤더 출력 (i18n 키면 data-i18n 부여)
    const ths = header.map((h) => {
      const key = String(h);
      const label = t(key, key);
      const isKey = /^[a-z0-9_.-]+$/i.test(key);
      return `<th${isKey ? ` data-i18n="${esc(key)}"` : ''}>${esc(label)}</th>`;
    }).join('');

    // 바디 출력
    const trs = body.map((r) => {
      const tds = r.map((c, i) => {
        if (useTGLabels && i === idxLevel) return `<td>${esc(levelToLabel(c))}</td>`;
        if (i === idxTime && idxTime !== idxLevel) return `<td>${esc(fmtTime(c))}</td>`;
        if (resourceIdxs.includes(i)) return `<td>${esc(fmtAbbrev(c))}</td>`;
        return `<td>${esc(c)}</td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    }).join('');

    return `<div class="table-wrap">
      <table>
        <thead><tr>${ths}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>`;
  }

  // ---------- 카드/탭 라벨 i18n ----------
  const keySlug = s => String(s || '').trim().toLowerCase();
  const keyVar  = v => String(v || '').trim().toLowerCase();
  const cardTitle = (slug, variantKey, fb) => {
    const s = keySlug(slug);
    const v = keyVar(variantKey);
    const k = v ? `buildings.card.${s}.${v}.title` : `buildings.card.${s}.title`;
    return t(k, fb);
  };
  const cardSubtitle = (slug, fb) => null;


  // ---------- 카드 렌더 ----------
  function makeCardHTML({ href, title, img, subtitle, i18nTitleKey, i18nSubtitleKey, i18nAltKey }) {
    const fallback = esc(ROOT + 'img/placeholder.webp');
    const safeImg = imgUrl(img || 'img/placeholder.webp');
    return `
      <a class="card" href="${esc(href)}">
        <img src="${esc(safeImg)}" alt="${esc(title)}"
             ${i18nAltKey ? `data-i18n-attr="alt:${esc(i18nAltKey)}"` : ''}
             onerror="this.onerror=null;this.src='${fallback}'">
        <div class="card-text">
          <div class="card-title" ${i18nTitleKey ? `data-i18n="${esc(i18nTitleKey)}"` : ''}>${esc(title)}</div>
          ${subtitle ? `<div class="card-sub" ${i18nSubtitleKey ? `data-i18n="${esc(i18nSubtitleKey)}"` : ''}>${esc(subtitle)}</div>` : ''}
        </div>
      </a>`;
  }

  // 원하는 고정 순서
  const ORDER = [
  'towncenter','embassy','barracks','stable','range','academy','war-academy','command','infirmary',
  'truegold-crucible','gold-smelter','guard-station','kitchen','storehouse'
];
  function orderScore(key){
    const i = ORDER.indexOf(key);
    return i < 0 ? 9999 : i;
  }

  // item → 카드 항목들(variants 포함)
  function buildCardItems(b){
    if (b.hidden) return [];
    const mapped = resolveSlugVariant(b.slug);
    const baseSlug = String(mapped.slug);
    const sKey = keySlug(baseSlug);

    if (Array.isArray(b.variants) && b.variants.length){
      const subtitle = cardSubtitle(sKey, b.title || b.name || baseSlug);
      return b.variants.map(v => {
        const vKeyRaw = String(v.key || '');
        const vKey = keyVar(vKeyRaw);
        return {
          key: `${baseSlug}:${vKeyRaw}`,
          html: makeCardHTML({
            href: `/buildings/${baseSlug}/${vKeyRaw}`, // ← 히스토리 모드 링크
            title: cardTitle(sKey, vKeyRaw, v.title || vKeyRaw),
            img: v.image,
            subtitle,
            i18nTitleKey:   `buildings.card.${sKey}.${vKey}.title`,
            i18nSubtitleKey:`buildings.card.${sKey}.subtitle`,
            i18nAltKey:     `buildings.card.${sKey}.${vKey}.title`
          })
        };
      });
    }

    return [{
      key: baseSlug,
      html: makeCardHTML({
        href: `/buildings/${baseSlug}`, // ← 히스토리 모드 링크
        title: cardTitle(sKey, '', b.title || b.name || baseSlug),
        img: b.image,
        subtitle: cardSubtitle(sKey, b.subtitle || ''),
        i18nTitleKey:   `buildings.card.${sKey}.title`,
        i18nSubtitleKey:`buildings.card.${sKey}.subtitle`,
        i18nAltKey:     `buildings.card.${sKey}.title`
      })
    }];
  }

  // ---------- 목록 ----------
  async function renderBuildingsList(){
    const g=$grid(), r=$root(); if(!g) return;
    if (r){ r.innerHTML=''; r.style.display='none'; }
    g.innerHTML = `<div class="loading" style="padding:12px;color:#666" data-i18n="common.loading">${esc(t('common.loading','Loading…'))}</div>`;
    applyI18N(g);

    try{
      const list = await loadData();
      const items = list.flatMap(buildCardItems);

      items.sort((a,b) => {
        const d = orderScore(a.key) - orderScore(b.key);
        if (d) return d;
        return a.key.localeCompare(b.key);
      });

      g.innerHTML = items.map(x => x.html).join('');
      g.style.display='grid';
      document.title = t('title.buildingsList', '건물 목록 - KingshotData.KR');
      applyI18N(g);
      window.scrollTo({ top: 0 });
    }catch(e){
      g.innerHTML = `<div class="error">
        <div data-i18n="buildings.listLoadFail">${esc(t('buildings.listLoadFail','목록 로드 실패'))}</div>
        <div class="muted">${esc(String(e))}</div>
      </div>`;
      applyI18N(g);
    }
  }

  // ---------- variants 탭 ----------
  function buildVariantTabs(slug, variants, currentKey){
    if (!variants || !variants.length) return '';
    const sKey = keySlug(slug);
    const items = variants.map(v=>{
      const keyRaw = String(v.key || '');
      const key = esc(keyRaw);
      const vKey = keyVar(keyRaw);
      const isOn = (norm(currentKey)===norm(keyRaw));
      const href = `/buildings/${slug}/${keyRaw}`; // ← 히스토리 모드 링크
      const kPath = `buildings.card.${sKey}.${vKey}.title`;
      const label = t(kPath, v.title || keyRaw);
      return `<a href="${href}" class="tab${isOn?' on':''}" data-variant="${key}" style="display:inline-block;padding:6px 10px;border:1px solid #ddd;border-radius:16px;margin-right:6px;text-decoration:none;color:${isOn?'#fff':'#333'};background:${isOn?'#333':'#fff'}">
                <span data-i18n="${esc(kPath)}">${esc(label)}</span>
              </a>`;
    }).join('');
    return `<nav class="variant-tabs" style="margin:8px 0 12px">${items}</nav>`;
  }

  // 언락 제목 커스텀 맵 (JSON 키는 그대로 unlocks 사용)
  const UNLOCK_TITLE_BY_SLUG = { 'kitchen': 'buildings.kitchenSchedule' };

  // ---------- 상세 ----------
  async function renderBuildingDetail(slugRaw, variantRaw){
    const g=$grid(), r=$root(); if(!r) return;
    showDetailMode();
    r.innerHTML = `<div class="loading" style="padding:12px;color:#666" data-i18n="common.loading">${esc(t('common.loading','Loading…'))}</div>`;
    applyI18N(r);

    try{
      const mapped  = resolveSlugVariant(slugRaw, variantRaw);
      const slug    = mapped.slug || norm(slugRaw);
      const variant = mapped.variant || norm(variantRaw);

      const data = await loadData();
      const item = data.find(x => norm(x.slug) === slug);

      if (!item){
        r.innerHTML = `
          <div class="not-found" style="padding:12px">
            <h2 style="margin:0 0 6px" data-i18n="buildings.notFound.title">${esc(t('buildings.notFound.title','Not Found'))}</h2>
            <p data-i18n="buildings.notFound.desc">${esc(t('buildings.notFound.desc','요청한 건물을 찾을 수 없습니다.'))}</p>
            <p style="margin-top:10px">
              <a href="/buildings" data-i18n="buildings.backToList">← ${esc(t('buildings.backToList','건물 목록으로'))}</a>
            </p>
          </div>`;
        document.title = t('title.notFound', 'Not Found - KingshotData.KR');
        applyI18N(r);
        window.scrollTo({ top: 0 });
        return;
      }

      const variants = Array.isArray(item.variants) ? item.variants : [];
      const currentVar = variants.length
        ? (variants.find(v=>norm(v.key)===norm(variant)) || variants[0])
        : null;

      // 제목/alt/타이틀 i18n 키 계산
      const sKey = keySlug(item.slug);
      const vKey = currentVar ? keyVar(currentVar.key) : '';
      const titleKey = vKey ? `buildings.card.${sKey}.${vKey}.title` : `buildings.card.${sKey}.title`;
      const titleFallback = currentVar ? (currentVar.title || currentVar.key) : (item.title || item.name || item.slug);
      const titleText = t(titleKey, titleFallback);

      const img = imgUrl((currentVar && currentVar.image) || item.image || 'img/placeholder.webp');
      const fallback = esc(ROOT+'img/placeholder.webp');

            // 표 렌더
      const rowsRaw = (currentVar && currentVar.table) || item.table || [];
      const tableHtml = buildTable(rowsRaw, { slug: item.slug });
      const tabs = buildVariantTabs(item.slug, variants, currentVar ? currentVar.key : '');

      const unlocksSrc =
        (currentVar && Array.isArray(currentVar.unlocks) && currentVar.unlocks.length)
          ? currentVar.unlocks
          : (Array.isArray(item.unlocks) ? item.unlocks : []);

      const unlocksList = unlocksSrc
        .map(u => {
          const label = looksLikeKey(u) ? t(u, u) : u;
          return `<li${looksLikeKey(u) ? ` data-i18n="${esc(u)}"` : ''}>${esc(label)}</li>`;
        })
        .join('');
      const unlockTitleKey = UNLOCK_TITLE_BY_SLUG[norm(item.slug)] || 'buildings.unlocks';
      const unlockTitleText = t(
        unlockTitleKey,
        UNLOCK_TITLE_BY_SLUG[norm(item.slug)] ? t('buildings.kitchenSchedule','주방 일정') : t('buildings.unlocks','해금')
      );

      const descKey = looksLikeKey(item.description) ? item.description : `buildings.detail.${sKey}.desc`;
      const descText = t(descKey, item.description || '');

      const unlocksHtml = unlocksList ? `
        <section class="detail-unlocks" style="margin-top:16px">
          <h3 style="margin:0 0 6px" data-i18n="${esc(unlockTitleKey)}">${esc(unlockTitleText)}</h3>
          <ul>${unlocksList}</ul>
        </section>` : '';

      // ✅ 표 위 이미지
      const topImgHtml = item.imagesTop ? `
        <section class="detail-image-top" style="margin:16px 0; text-align:center">
          <img src="${esc(imgUrl(item.imagesTop))}" style="max-width:100%;border:1px solid #ccc;border-radius:6px">
        </section>` : '';

      // ✅ 표 아래 여러 장 이미지
      const imagesHtml = (Array.isArray(item.images) && item.images.length) ? `
  <section class="detail-images" style="margin-top:16px;">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;justify-items:center;">
      ${item.images.map(src => `
        <img src="${esc(imgUrl(src))}" style="width:100%;max-width:300px;border:1px solid #ccc;border-radius:6px">
      `).join('')}
    </div>
  </section>` : '';


      // 상세 HTML
r.innerHTML = `
  <div style="margin-bottom:16px; text-align:right">
    <a href="/buildings"
       style="display:inline-block;padding:8px 12px;border:1px solid #ccc;border-radius:6px;text-decoration:none;background:#fff;color:#333"
       aria-label="${esc(t('buildings.backToList','건물 목록으로'))}">
      ←
    </a>
  </div>

  ${tabs}

  <section class="detail-grid">
    <div>
      <img src="${esc(img)}" alt="${esc(titleText)}" class="detail-img"
           data-i18n-attr="alt:${esc(titleKey)}"
           onerror="this.onerror=null;this.src='${fallback}'">
    </div>
    <div>
      <h1 style="margin:0 0 8px" data-i18n="${esc(titleKey)}">${esc(titleText)}</h1>
      ${descText ? `<p class="detail-desc"${looksLikeKey(descKey) ? ` data-i18n="${esc(descKey)}"` : ''}>${esc(descText)}</p>` : ''}
    </div>
  </section>

  <section class="detail-table" style="margin-top:16px">
    ${topImgHtml}   <!-- ✅ 표 위 이미지 -->
    ${tableHtml}
  </section>

  ${imagesHtml}     <!-- ✅ 표 아래 여러 장 이미지 -->
  ${unlocksHtml}
`;

      document.title = `${t(titleKey, titleFallback)} - KingshotData.KR`;
      applyI18N(r);
      window.scrollTo({ top: 0 });
    }catch(e){
      r.innerHTML = `<div class="error">
        <div data-i18n="buildings.detailLoadFail">${esc(t('buildings.detailLoadFail','상세 로드 실패'))}</div>
        <div class="muted">${esc(String(e))}</div>
      </div>`;
      applyI18N(r);
    }
  }

  // ---------- i18n namespace 보장 ----------
  async function ensureBuildingsNS(){
    if (window.I18N && typeof I18N.loadNamespace === 'function') {
      await I18N.loadNamespace('buildings');
    }
  }

  // ---------- routing ----------
  function parseRoute() {
    // History API 경로 우선
    const m = location.pathname.match(/^\/buildings(?:\/([^\/?#]+))?(?:\/([^\/?#]+))?$/);
    if (m) {
      const slug    = m[1] ? decodeURIComponent(m[1]) : '';
      const variant = m[2] ? decodeURIComponent(m[2]) : '';
      if (slug) return ['building', slug, variant];
      return ['buildings', '', ''];
    }
    // 레거시 해시도 지원
    const hash = (location.hash || '#buildings').slice(1);
    const [page='', s='', v=''] = hash.split('/');
    return [page, s, v];
  }

  async function handleRoute(){
    await ensureBuildingsNS();
    const [page, slug, variant] = parseRoute();
    if (page === 'building' && slug){ renderBuildingDetail(slug, variant); return; }
    renderBuildingsList();
  }

  // 인덱스(SPA)에서 한 번만 바인딩
  if (!window.__buildingsBound){
    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('popstate',  handleRoute); // 히스토리 뒤/앞으로 가기
    window.__buildingsBound = true;
  }
  window.initBuildings = function(){ handleRoute(); };

  // 단독 페이지로 열려도 동작
  window.addEventListener('DOMContentLoaded', handleRoute);

  // 언어 변경 시: 본문 재적용 + 현재 화면 재렌더
  document.addEventListener('i18n:changed', async () => {
    await ensureBuildingsNS();
    const [page, slug, variant] = parseRoute();
    const gridEl = document.getElementById('buildings-grid') || document;
    const rootEl = document.getElementById('building-root') || document;
    applyI18N(gridEl);
    applyI18N(rootEl);
    if (page === 'building' && slug) {
      await renderBuildingDetail(slug, variant);
    } else {
      document.title = t('title.buildingsList', '건물 목록 - KingshotData.KR');
    }
  });

  // 탭 즉시 반응 (히스토리 모드 링크)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.variant-tabs a[href^="/buildings/"]');
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href');
    if (window.navigate) window.navigate(href);
    else { history.pushState(null, '', href); handleRoute(); }
  });

})();

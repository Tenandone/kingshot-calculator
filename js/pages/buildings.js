// js/pages/buildings.js (final)
(function () {
  'use strict';

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

  // TG 라벨 적용 대상
  const TG_LABEL_SLUGS = new Set(['towncenter', 'command-center', 'command', 'embassy', 'camp']);

  function imgUrl(p){
    if(!p) return ROOT + 'img/placeholder.webp';
    if(/^https?:\/\//i.test(p)) return p;
    if(p.startsWith('/')) return p;
    return ROOT + p.replace(/^\.?\//,'');
  }

  // 숫자 약어: k / m / b
  function fmtAbbrev(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v ?? '');
    const x = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    const fix1 = (y) => (y % 1 === 0 ? String(y) : y.toFixed(1).replace(/\.0$/,''));
    if (x >= 1e9)  return sign + fix1(x / 1e9) + 'b';
    if (x >= 1e6)  return sign + fix1(x / 1e6) + 'm';
    if (x >= 1e3)  return sign + fix1(x / 1e3) + 'k';
    return String(n);
  }

  // 시간 포맷(d h m) — 큰 값(>=100000)은 초로 간주, 아니면 분
  function fmtTime(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return '0m';
    const secs = n >= 100000 ? n : n * 60;
    let s = Math.floor(secs);
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600);  s -= h * 3600;
    const m = Math.floor(s / 60);
    const out = [];
    if (d) out.push(d + 'd');
    if (h) out.push(h + 'h');
    if (m || (!d && !h)) out.push(m + 'm');
    return out.join(' ');
  }

  // ---------- Level 라벨 ----------
  // 31→30-1, 32→30-2, 33→30-3, 34→30-4
  // 35→TG1, 36~39→TG1-1..4
  // 40→TG2, 41~44→TG2-1..4
  // 45→TG3, 46~49→TG3-1..4
  // 50→TG4, 51~54→TG4-1..4
  // 55→TG5
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
    'barracks':       { slug: 'camp', variant: 'infantry' },
    'stable':         { slug: 'camp', variant: 'cavalry'  },
    'range':          { slug: 'camp', variant: 'archer'   },
    'town-center':    { slug: 'towncenter' },
    'command-center': { slug: 'command' } // 구링크 보정
  };

  function resolveSlugVariant(rawSlug, rawVariant){
    const key = norm(rawSlug);
    const hit = SLUG_ALIAS[key];
    return {
      slug:     norm(hit && hit.slug ? hit.slug : key),
      variant:  norm(hit && hit.variant ? hit.variant : (rawVariant || ''))
    };
  }

  // ---------- data (cache) ----------
  let cache = null;

  async function fetchJsonWithFallback(urls){
    for (const u of urls) {
      try {
        const r = await fetch(u, { cache: 'no-store' });
        if (r.ok) return await r.json();
      } catch (_) { /* next */ }
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

  // === 표 렌더 (크리스탈/트루골드→순금 통합 + TG 라벨 + 약어/시간 포맷 + 순금 자동 숨김) ===
  function buildTable(rows, ctx = {}) {
    if (!rows || !rows.length) return '';

    const slug = String(ctx.slug || '').toLowerCase();
    const useTGLabels = TG_LABEL_SLUGS.has(slug);

    // 헤더/바디
    let header = Array.isArray(rows[0]) ? rows[0].slice() : [];
    let body   = rows.slice(1).map(r => Array.isArray(r) ? r.slice() : []);

    // 인덱스 찾기
    let idxLevel = header.findIndex(h => String(h).includes('레벨'));
    let idxTime  = header.findIndex(h => String(h).includes('건설'));
    let idxGold  = header.indexOf('순금');
    let idxCrys  = header.indexOf('크리스탈');
    let idxTG    = header.indexOf('트루골드');

    // (A) '크리스탈' → '순금'으로 통합
    if (idxCrys >= 0 && idxGold < 0) {
      header[idxCrys] = '순금';
      idxGold = idxCrys;
      idxCrys = -1;
    } else if (idxCrys >= 0 && idxGold >= 0) {
      body.forEach(r => {
        const g = r[idxGold];
        const t = r[idxCrys];
        const isEmpty = (v) => {
          if (v === undefined || v === null) return true;
          const s = String(v).trim();
          if (s === '' || s === '-' || s === '–' || s === '0') return true;
          return false;
        };
        if (isEmpty(g) && !isEmpty(t)) r[idxGold] = t;
      });
      header.splice(idxCrys, 1);
      body.forEach(r => { if (idxCrys < r.length) r.splice(idxCrys, 1); });
      if (idxTime  > idxCrys) idxTime--;
      if (idxLevel > idxCrys) idxLevel--;
      idxCrys = -1;
    }

    // (B) '트루골드' → '순금'으로 통합
    if (idxTG >= 0 && idxGold < 0) {
      header[idxTG] = '순금';
      idxGold = idxTG;
      idxTG = -1;
    } else if (idxTG >= 0 && idxGold >= 0) {
      body.forEach(r => {
        const g = r[idxGold];
        const t = r[idxTG];
        const isEmpty = (v) => {
          if (v === undefined || v === null) return true;
          const s = String(v).trim();
          if (s === '' || s === '-' || s === '–' || s === '0') return true;
          return false;
        };
        if (isEmpty(g) && !isEmpty(t)) r[idxGold] = t;
      });
      header.splice(idxTG, 1);
      body.forEach(r => { if (idxTG < r.length) r.splice(idxTG, 1); });
      if (idxTime  > idxTG) idxTime--;
      if (idxLevel > idxTG) idxLevel--;
      idxTG = -1;
    }

    // (C) 순금 열이 아예 없으면 삽입(0으로)
    if (header.indexOf('순금') < 0) {
      const pos = idxTime >= 0 ? idxTime : header.length;
      header.splice(pos, 0, '순금');
      body.forEach(r => r.splice(pos, 0, 0));
      if (idxTime >= 0) idxTime++;
      idxGold = pos;
    } else {
      idxGold = header.indexOf('순금');
    }

    // (D) 순금이 모든 행에서 비어있으면 컬럼 제거(표시만 숨김)
    (function maybeHideGold() {
      if (idxGold < 0) return;
      const isEmptyGold = (v) => {
        if (v === undefined || v === null) return true;
        const s = String(v).trim().toLowerCase().replace(/[, ]/g, '');
        if (s === '' || s === '-' || s === '–' || s === 'null' || s === 'undefined') return true;
        // 약어 수치 파싱
        const num = Number(s.replace(/k$/,'000').replace(/m$/,'000000').replace(/b$/,'000000000'));
        if (Number.isFinite(num)) return num <= 0;
        // 숫자 아닌 텍스트가 들어오면 보수적으로 표시 유지
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

    // 자원 약어 포맷 대상 (최종 헤더 기준)
    const RESOURCE_HEADERS = new Set(['빵','나무','석재','철','순금']);
    const resourceIdxs = header.reduce((acc, h, i) => {
      if (RESOURCE_HEADERS.has(String(h))) acc.push(i);
      return acc;
    }, []);

    const ths = header.map(h => `<th>${esc(h)}</th>`).join('');

    const trs = body.map((r) => {
      const tds = r.map((c, i) => {
        if (useTGLabels && i === idxLevel) return `<td>${esc(levelToLabel(c))}</td>`;
        if (i === idxTime)  return `<td>${esc(fmtTime(c))}</td>`;
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

  // ---------- 카드 렌더 ----------
  function makeCardHTML({ href, title, img, subtitle }) {
    const fallback = esc(ROOT + 'img/placeholder.webp');
    const safeImg = imgUrl(img || 'img/placeholder.webp');
    return `
      <a class="card" href="${esc(href)}">
        <img src="${esc(safeImg)}" alt="${esc(title)}"
             onerror="this.onerror=null;this.src='${fallback}'">
        <div class="card-text">
          <div class="card-title">${esc(title)}</div>
          ${subtitle ? `<div class="card-sub">${esc(subtitle)}</div>` : ''}
        </div>
      </a>`;
  }

  // 원하는 고정 순서
  const ORDER = [
    'towncenter',
    'embassy',
    'camp:infantry',
    'camp:cavalry',
    'camp:archer',
    'academy',
    'command',                 // 지휘부 (alias: command-center → command)
    'infirmary',
    'truegold-crucible',       // 황금용광로(프로젝트 내 슬러그에 맞춰 필요시 변경)
    'gold-smelter',            // 혹시 다른 슬러그일 경우도 커버
    'guard-station',           // 방위소
    'kitchen',                 // 주방
    'storehouse'               // 창고
  ];

  function orderScore(key){
    const i = ORDER.indexOf(key);
    return i < 0 ? 9999 : i;
  }

  // item → 카드 항목들(variants 포함)
  function buildCardItems(b){
    if (b.hidden) return [];
    const baseSlug = String(b.slug);
    if (Array.isArray(b.variants) && b.variants.length){
      const subtitle = b.title || b.name || baseSlug;
      return b.variants.map(v => ({
        key: `${baseSlug}:${String(v.key)}`,
        html: makeCardHTML({
          href: `#building/${baseSlug}/${v.key}`,
          title: v.title || v.key,
          img: v.image,
          subtitle
        })
      }));
    }
    return [{
      key: baseSlug,
      html: makeCardHTML({
        href: `#building/${baseSlug}`,
        title: b.title || b.name || baseSlug,
        img: b.image,
        subtitle: b.subtitle || ''
      })
    }];
  }

  // ---------- 목록 ----------
  async function renderBuildingsList(){
    const g=$grid(), r=$root(); if(!g) return;
    if (r){ r.innerHTML=''; r.style.display='none'; }
    g.innerHTML = '<div class="loading" style="padding:12px;color:#666">Loading…</div>';
    try{
      const list = await loadData();
      const items = list.flatMap(buildCardItems);

      // 고정 순서 정렬 → 그 외는 key 보조 정렬
      items.sort((a,b) => {
        const d = orderScore(a.key) - orderScore(b.key);
        if (d) return d;
        return a.key.localeCompare(b.key);
      });

      g.innerHTML = items.map(x => x.html).join('');
      g.style.display='grid';
      document.title = '건물 목록 - KingshotData.KR';
      window.scrollTo({ top: 0 });
    }catch(e){
      g.innerHTML = `<div class="error">목록 로드 실패<br>${esc(String(e))}</div>`;
    }
  }

  // ---------- variants 탭 ----------
  function buildVariantTabs(slug, variants, currentKey){
    if (!variants || !variants.length) return '';
    const items = variants.map(v=>{
      const key = esc(v.key);
      const isOn = (norm(currentKey)===norm(v.key));
      const href = `#building/${slug}/${key}`;
      return `<a href="${href}" class="tab${isOn?' on':''}" data-variant="${key}" style="display:inline-block;padding:6px 10px;border:1px solid #ddd;border-radius:16px;margin-right:6px;text-decoration:none;color:${isOn?'#fff':'#333'};background:${isOn?'#333':'#fff'}">${esc(v.title||key)}</a>`;
    }).join('');
    return `<nav class="variant-tabs" style="margin:8px 0 12px">${items}</nav>`;
  }

  // 언락 제목 커스텀 맵 (JSON 키는 그대로 unlocks 사용)
  const UNLOCK_TITLE_BY_SLUG = {
    'kitchen': '주방일정'
  };

  // ---------- 상세 ----------
  async function renderBuildingDetail(slugRaw, variantRaw){
    const g=$grid(), r=$root(); if(!r) return;
    showDetailMode();
    r.innerHTML = '<div class="loading" style="padding:12px;color:#666">Loading…</div>';

    try{
      const mapped  = resolveSlugVariant(slugRaw, variantRaw);
      const slug    = mapped.slug || norm(slugRaw);
      const variant = mapped.variant || norm(variantRaw);

      const data = await loadData();
      const item = data.find(x => norm(x.slug) === slug);

      if (!item){
        r.innerHTML = `
          <div class="not-found" style="padding:12px">
            <h2 style="margin:0 0 6px">Not Found</h2>
            <p>요청한 건물을 찾을 수 없습니다: <code>${esc(slugRaw)}</code></p>
            <p style="margin-top:10px"><a href="#buildings">← 건물 목록으로</a></p>
          </div>`;
        document.title = 'Not Found - KingshotData.KR';
        window.scrollTo({ top: 0 });
        return;
      }

      const variants = Array.isArray(item.variants) ? item.variants : [];
      const currentVar = variants.length
        ? (variants.find(v=>norm(v.key)===norm(variant)) || variants[0])
        : null;

      const titleBase = esc(item.title || item.name || item.slug);
      const title = currentVar ? `${titleBase} – ${esc(currentVar.title||currentVar.key)}` : titleBase;

      const img = imgUrl((currentVar && currentVar.image) || item.image || 'img/placeholder.webp');
      const fallback = esc(ROOT+'img/placeholder.webp');
      const desc = esc(item.description || '');

      const rows = (currentVar && currentVar.table) || item.table || [];
      const table = buildTable(rows, { slug: item.slug });
      const tabs = buildVariantTabs(item.slug, variants, currentVar ? currentVar.key : '');

      const unlocksSrc =
        (currentVar && Array.isArray(currentVar.unlocks) && currentVar.unlocks.length)
          ? currentVar.unlocks
          : (Array.isArray(item.unlocks) ? item.unlocks : []);

      const unlocksList = unlocksSrc.map(esc).map(u=>`<li>${u}</li>`).join('');
      const unlockTitle = UNLOCK_TITLE_BY_SLUG[norm(item.slug)] || '언락';
      const unlocksHtml = unlocksList ? `
        <section class="detail-unlocks" style="margin-top:16px">
          <h3 style="margin:0 0 6px">${esc(unlockTitle)}</h3>
          <ul>${unlocksList}</ul>
        </section>` : '';

      r.innerHTML = `
        <div style="margin-bottom:16px">
          <a href="#buildings" style="display:inline-block;padding:8px 12px;border:1px solid #ccc;border-radius:6px;text-decoration:none;background:#fff;color:#333">← 건물 목록으로</a>
        </div>

        ${tabs}

        <section class="detail-grid">
          <div>
            <img src="${esc(img)}" alt="${title}" class="detail-img"
                 onerror="this.onerror=null;this.src='${fallback}'">
          </div>
          <div>
            <h1 style="margin:0 0 8px">${title}</h1>
            ${desc ? `<p class="detail-desc">${desc}</p>` : ''}
          </div>
        </section>

        <section class="detail-table" style="margin-top:16px">${table}</section>

        ${unlocksHtml}
      `;
      document.title = `${title} - KingshotData.KR`;
      window.scrollTo({ top: 0 });
    }catch(e){
      r.innerHTML = `<div class="error">상세 로드 실패<br>${esc(String(e))}</div>`;
    }
  }

  // ---------- routing ----------
  function handleRoute(){
    const hash = (location.hash || '#buildings').slice(1);
    const [page, slug, variant] = hash.split('/');
    if (page === 'building' && slug){ renderBuildingDetail(slug, variant); return; }
    renderBuildingsList();
  }

  // 인덱스(SPA)에서 한 번만 바인딩
  if (!window.__buildingsBound){
    window.addEventListener('hashchange', handleRoute);
    window.__buildingsBound = true;
  }
  window.initBuildings = function(){ handleRoute(); };

  // 단독 페이지로 열려도 동작
  window.addEventListener('DOMContentLoaded', handleRoute);

  // 탭 즉시 반응
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.variant-tabs a[href^="#building/"]');
    if (tab){
      e.preventDefault();
      location.hash = tab.getAttribute('href');
      handleRoute();
    }
  });
})();

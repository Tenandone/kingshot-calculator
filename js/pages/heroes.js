// /js/pages/heroes.js — i18n-safe & robust (FULL)
// ✅ 목표:
// - 카드 이름 i18n 키 지원 + 누락 방지(초기 I18N 지연 로드 포함)
// - i18n:changed 리스너 중복 등록 방지(1회만 바인딩)
// - nameKey 우선순위 개선: (1) h.title/key (2) h.nameKey (3) heroes.card.${slug}.title (4) heroes.card.${slug}.name
// - 키처럼 보이는 문자열만 i18n key로 취급(일반 텍스트를 key로 착각 방지)
// - 기존 기능(정렬/배지/유닛아이콘/compact 그리드) 유지
(function(){
  'use strict';

  /* ========= i18n helpers ========= */
  const hasI18N = () => (window.I18N && typeof window.I18N.t === 'function');
  const t = (key, fallback) => hasI18N() ? window.I18N.t(key, fallback ?? key) : (fallback ?? key);
  const applyI18N = (root) => {
    if (hasI18N() && typeof window.I18N.applyTo === 'function') window.I18N.applyTo(root || document);
  };

  // "키처럼 보이는 문자열"만 i18n key로 인정 (ex: heroes.xxx.yyy)
  function isKeyLike(v){
    const s = String(v || '').trim();
    if (!s) return false;
    // 공백이 있으면 일반 문장일 확률 높음
    if (/\s/.test(s)) return false;
    // 점(.)이 1개 이상 있고, 너무 짧지 않으며
    if (!s.includes('.')) return false;
    // heroes.* 또는 pets.* 등 프로젝트 키 패턴을 넓게 허용
    if (/^[a-z0-9_]+\.[a-z0-9_.-]+$/i.test(s)) return true;
    return false;
  }

  // data-i18n-key 가진 요소 텍스트를 즉시 갱신
  function refreshI18N(root){
    if (!root || !hasI18N()) return;
    root.querySelectorAll('[data-i18n-key]').forEach(el => {
      const key = el.getAttribute('data-i18n-key') || '';
      const fb  = el.getAttribute('data-i18n-fallback') || '';
      if (key) el.textContent = t(key, fb);
    });
  }

  // ✅ I18N이 늦게 로드돼도 적용되도록: (1) i18n:changed 1회 바인딩 (2) 폴링으로 준비되면 자동 적용
  function installI18N(root){
    if (!root) return;

    // 중복 바인딩 방지
    if (root.__heroesI18NInstalled) {
      // 이미 설치되어도, 지금 시점에 I18N 있으면 즉시 갱신
      applyI18N(root);
      refreshI18N(root);
      return;
    }
    root.__heroesI18NInstalled = true;

    // 언어 변경 이벤트는 I18N이 없어도 미리 걸어둬도 됨
    const onChanged = () => {
      applyI18N(root);
      refreshI18N(root);
    };
    document.addEventListener('i18n:changed', onChanged);

    // 초기 1회 시도
    applyI18N(root);
    refreshI18N(root);

    // I18N이 나중에 로드되는 경우 대비: 짧게 폴링
    let tries = 0;
    const maxTries = 40;     // 40 * 100ms = 4초
    const timer = setInterval(() => {
      tries++;
      if (hasI18N()) {
        applyI18N(root);
        refreshI18N(root);
        clearInterval(timer);
        return;
      }
      if (tries >= maxTries) clearInterval(timer);
    }, 100);
  }

  /* ========= Entry ========= */
  window.initHeroes = async function initHeroes(){
    const ROOT = document.getElementById('heroes-root');
    if (!ROOT) return;

    ROOT.innerHTML = '<div style="padding:12px;text-align:center;">Loading heroes…</div>';

    ensureRarityStyles();   // 등급 배지
    ensureCardStyles();     // 썸네일 배경/오버레이(이미지 톤 유지)
    ensureUnitStyles();     // 이름 왼쪽 병종 아이콘
    ensureCompactStyles();  // ✅ 전 섹션 공통 compact 그리드

    try {
      const res = await fetch('/data/heroes.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load /data/heroes.json');
      const raw = await res.json();

      const list = (Array.isArray(raw) ? raw : [])
        .map(it => {
          const slug = String(it.slug || it.name || it.nameEn || '').trim().toLowerCase();
          return { ...it, slug };
        })
        .sort((a,b)=>
          (a.groupOrder ?? 9) - (b.groupOrder ?? 9) ||
          (b.generation ?? 0) - (a.generation ?? 0) ||
          rarityRank(b.rarity) - rarityRank(a.rarity) ||
          String(a.rarity || '').localeCompare(String(b.rarity || ''))
        );

      renderPlanned(ROOT, list);

      // ✅ 렌더 끝나고 "한 번만" 설치 (중복 리스너/중복 apply 방지)
      installI18N(ROOT);

    } catch (e) {
      console.warn(e);
      ROOT.innerHTML = '<div style="padding:12px;text-align:center;color:#d00;">영웅 데이터를 불러오지 못했습니다.</div>';
    }
  };

  /* ========= Plan: order & limits ========= */
  const PLAN = [
    { type:'gen', value:'6',  label:'Gen6', limit:3 },
    { type:'gen', value:'5',  label:'Gen5', limit:3 },
    { type:'gen', value:'4',  label:'Gen4', limit:3 },
    { type:'gen', value:'3',  label:'Gen3', limit:3 },
    { type:'gen', value:'2',  label:'Gen2', limit:3 },
    { type:'gen', value:'1',  label:'Gen1', limit:4 },
    { type:'rar', value:'SR', label:'SR'    },
    { type:'rar', value:'R',  label:'R'     },
  ];

  /* ========= Normalizers ========= */
  function rarityRank(v){
    const k = String(v || '').trim().toUpperCase();
    return ({ UR:4, SSR:3, SR:2, R:1 }[k]) ?? 0;
  }
  function normRarity(v){
    if (!v) return '';
    const s = String(v).trim().toUpperCase();
    if (s.startsWith('UR'))  return 'UR';
    if (s.startsWith('SSR')) return 'SSR';
    if (s.startsWith('SR'))  return 'SR';
    if (s.startsWith('R'))   return 'R';
    return s;
  }
  function normGen(v){
    if (v == null) return '';
    let s = String(v).toLowerCase().replace(/[^0-9a-z]/g,'');
    const num = s.replace(/[^0-9]/g,'');
    if (num) return num;
    if (/gen?iii|^iii$/.test(s)) return '3';
    if (/gen?ii(?!i)|^ii$/.test(s)) return '2';
    if (/gen?i(?!i)|^i$/.test(s)) return '1';
    if (/third|3rd/.test(s))  return '3';
    if (/second|2nd/.test(s)) return '2';
    if (/first|1st/.test(s))  return '1';
    return '';
  }
  function matchSection(h, p){
    const gen = normGen(h.generation ?? h.gen ?? h.Generation);
    const rar = normRarity(h.rarity    ?? h.grade ?? h.Rarity);
    if (p.type === 'gen') return gen === p.value;
    if (p.type === 'rar') return rar === p.value;
    return false;
  }

  /* ========= Unit (보/기/궁) ========= */
  function normUnit(v, stats){
    // 1) v가 일반 문자열일 때 우선 판정
    const raw = String(v||'').trim();
    const s = raw.toLowerCase();
    let code = '';
    if (s){
      if (/(궁|활|arch|bow)/.test(s)) code = 'ARC';
      else if (/(보|검|방패|infan|sword|shield)/.test(s)) code = 'INF';
      else if (/(기|말|cav|horse|rider)/.test(s)) code = 'CAV';
    }

    // 2) i18n 키라면 번역 결과로 재판정
    if (!code && isKeyLike(raw) && hasI18N()){
      const resolved = String(t(raw, '') || '').toLowerCase();
      if (/arch|bow|궁|활/.test(resolved)) code = 'ARC';
      else if (/infan|sword|shield|보|검|방패/.test(resolved)) code = 'INF';
      else if (/cav|horse|rider|기|말/.test(resolved)) code = 'CAV';
    }

    // 3) expedition.stats 라벨에서 보조 추론
    if (!code && Array.isArray(stats) && stats.length){
      const joined = stats.map(x => String(x.label||'').toLowerCase()).join(' ');
      if (/archer/.test(joined)) code = 'ARC';
      else if (/infantry/.test(joined)) code = 'INF';
      else if (/cavalry/.test(joined)) code = 'CAV';
    }

    return code;
  }
  function unitLabel(code){ return ({ARC:'궁병', INF:'보병', CAV:'기병'}[code] || ''); }
  function unitEmoji(code){ return ({ARC:'🏹', INF:'🛡️', CAV:'🐎'}[code] || '❔'); }
  function unitAsset(code){
    const map = {
      ARC: '/img/icons/archer-icon.webp',
      INF: '/img/icons/infantry-icon.webp',
      CAV: '/img/icons/cavalry-icon.webp'
    };
    return map[code] || '';
  }

  /* ========= Image helpers ========= */
  function folderCandidatesFrom(str){
    const raw = String(str || '').trim().toLowerCase();
    if (!raw) return [];
    const tokens = raw.split(/[-_\s]+/).filter(Boolean);
    const Title = t => t ? t[0].toUpperCase() + t.slice(1) : t;
    return Array.from(new Set([
      tokens.map(Title).join(''),
      tokens.map(Title).join('-'),
      tokens.map(Title).join(' '),
      tokens.join(''),
      tokens.join('-'),
      tokens.join(' ')
    ]));
  }
  function folderCandidatesFromHero(h){
    const set = new Set();
    [h.slug, h.name, h.nameEn, h.engName, h.enName].forEach(v=>{
      folderCandidatesFrom(v).forEach(x=>set.add(x));
    });
    return Array.from(set).filter(Boolean);
  }
  function placeholderCandidates(){
    const list = [
      '/img/placeholder.webp','/img/placeholder.png','/img/placeholder.jpg',
      '/img/common/placeholder.webp','/img/ui/placeholder.webp'
    ];
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="640">
         <rect width="100%" height="100%" fill="#0b1120"/>
         <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
               font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif"
               font-size="24" fill="#94a3b8">No Image</text>
       </svg>`
    );
    list.push(`data:image/svg+xml,${svg}`);
    return list;
  }
  function imageCandidatesForHero(h){
    const out = [];
    if (h.image) out.push(h.image);
    const folders = folderCandidatesFromHero(h);
    const bases = ['img_001','img-001','1','01','001','main','thumb','portrait'];
    const exts  = ['webp','png','jpg','jpeg'];
    for (const f of folders){
      for (const base of bases){
        for (const ext of exts){
          out.push(`/img/heroes/${f}/${base}.${ext}`);
        }
      }
    }
    out.push(...placeholderCandidates());
    return out;
  }

  /* ========= Rendering ========= */
  function renderPlanned(ROOT, heroes){
    ROOT.innerHTML = '';
    const used = new Set();
    let rendered = 0;

    for (const p of PLAN){
      const bucket = heroes.filter(h => {
        const key = h.slug || h.name || h.nameEn || '';
        return !used.has(key) && matchSection(h, p);
      });
      if (!bucket.length) continue;

      const items = p.limit ? bucket.slice(0, p.limit) : bucket;

      const section = document.createElement('section');
      section.className = 'section';
      section.innerHTML = `
        <h2 class="section-title">${escapeHtml(p.label)}</h2>
        <div class="heroes-grid compact"></div>
      `;
      const grid = section.querySelector('.heroes-grid');

      items.forEach(h => {
        used.add(h.slug || h.name || h.nameEn || '');
        grid.appendChild(cardEl(h));
        rendered++;
      });

      ROOT.appendChild(section);
    }

    if (rendered === 0) {
      console.warn('[heroes] No items matched PLAN. Falling back to auto grouping.');
      renderAuto(ROOT, heroes);
    }
  }

  // Auto grouping fallback (세대들 → 등급들 → 기타)
  function collectGenerations(list){
    const set = new Set();
    for (const h of list){
      const g = normGen(h.generation ?? h.gen ?? h.Generation);
      if (g) set.add(g);
    }
    return Array.from(set).sort((a,b)=> Number(b) - Number(a));
  }
  function collectRarities(list){
    const set = new Set();
    for (const h of list){
      const r = normRarity(h.rarity ?? h.grade ?? h.Rarity);
      if (r) set.add(r);
    }
    return Array.from(set).sort((a,b)=> rarityRank(b) - rarityRank(a));
  }
  function renderAuto(ROOT, heroes){
    ROOT.innerHTML = '';
    const gens = collectGenerations(heroes);
    const rars = collectRarities(heroes);
    const ORDER = [
      ...gens.map(g => ({ type:'gen', value:g, label:`${g}세대` })),
      ...rars.map(r => ({ type:'rar', value:r, label:r }))
    ];
    const used = new Set();

    for (const o of ORDER){
      const items = heroes.filter(h => {
        const ok = matchSection(h, o);
        if (ok) used.add(h);
        return ok;
      });
      if (!items.length) continue;

      const section = document.createElement('section');
      section.className = 'section';
      section.innerHTML = `
        <h2 class="section-title">${escapeHtml(o.label)}</h2>
        <div class="heroes-grid compact"></div>
      `;
      const grid = section.querySelector('.heroes-grid');

      items.forEach(h => grid.appendChild(cardEl(h)));
      ROOT.appendChild(section);
    }

    const leftovers = heroes.filter(h => !used.has(h));
    if (leftovers.length){
      const section = document.createElement('section');
      section.className = 'section';
      section.innerHTML = `
        <h2 class="section-title">기타</h2>
        <div class="heroes-grid compact"></div>
      `;
      const grid = section.querySelector('.heroes-grid');
      leftovers.forEach(h => grid.appendChild(cardEl(h)));
      ROOT.appendChild(section);
    }
  }

  /* ========= Card ========= */
  function cardEl(h){
    const slug = String(h.slug || '').trim();

    // ✅ 카드 이름 i18n 키 우선순위 + 키 판별
    const candidates = [];
    if (isKeyLike(h.title)) candidates.push(String(h.title).trim());
    if (isKeyLike(h.nameKey)) candidates.push(String(h.nameKey).trim());
    if (slug) {
      candidates.push(`heroes.card.${slug}.title`);
      candidates.push(`heroes.card.${slug}.name`);
    }
    const nameKey = candidates[0] || '';

    // 폴백 텍스트
    const fallbackName = String(h.nameKo || h.name || h.nameEn || '이름없음');
    const displayName  = nameKey ? t(nameKey, fallbackName) : fallbackName;

    const rarity = normRarity(h.rarity ?? h.grade ?? h.Rarity);
    const unit   = normUnit(h.unit || h.class || h.role || h.type, h.expedition?.stats);

    const el = document.createElement('a');
    el.className = 'card';
    el.href = slug ? `#/hero/${encodeURIComponent(slug)}` : '#';

    // 이미지 폴백
    const candidatesImg = imageCandidatesForHero(h);
    const img = document.createElement('img');
    img.alt = displayName;
    img.loading = 'lazy';
    img.decoding = 'async';
    let i = 0;
    function next(){ img.src = candidatesImg[i++] || candidatesImg[candidatesImg.length-1]; }
    img.onerror = () => { if (i < candidatesImg.length) next(); else img.onerror = null; };
    next();

    // 등급 배지
    const rarityBadge = rarity ? `<span class="rarity-badge rarity-${escapeHtml(rarity)}">${escapeHtml(rarity)}</span>` : '';

    // 이름 옆 병종 아이콘(아이콘 없으면 이모지 폴백)
    let unitInline = '';
    if (unit) {
      const label = unitLabel(unit);
      const src   = unitAsset(unit);
      const emoji = unitEmoji(unit);
      unitInline = src
        ? `<img class="unit-inline" src="${escapeHtml(src)}" alt="${escapeHtml(label)}"
                onerror="this.outerHTML='<span class=&quot;unit-inline&quot;>${emoji}</span>';">`
        : `<span class="unit-inline" aria-label="${escapeHtml(label)}">${emoji}</span>`;
    }

    // label span에 i18n 키/폴백 저장
    const i18nAttrs = nameKey
      ? ` data-i18n-key="${escapeHtml(nameKey)}" data-i18n-fallback="${escapeHtml(fallbackName)}"`
      : '';

    el.innerHTML = `
      ${rarityBadge}
      <div class="thumb"></div>
      <div class="name">
        ${unitInline || ''}
        <span class="label"${i18nAttrs}>${escapeHtml(displayName)}</span>
      </div>
    `;
    el.querySelector('.thumb').appendChild(img);

    return el;
  }

  /* ========= Misc ========= */
  function escapeHtml(s){
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // 등급 배지 스타일
  function ensureRarityStyles(){
    if (document.getElementById('rarity-badge-styles')) return;
    const css = `
      .heroes-grid .card{ position:relative; }
      .rarity-badge{
        position:absolute; top:8px; left:8px;
        padding:2px 8px; border-radius:999px;
        font-size:12px; font-weight:700; line-height:1.6; letter-spacing:.02em;
        background: rgba(0,0,0,.6); color:#fff; backdrop-filter:saturate(1.2) blur(2px);
        box-shadow:0 2px 8px rgba(0,0,0,.25);
      }
      .rarity-UR  { background: linear-gradient(90deg,#f59e0b,#ef4444); }
      .rarity-SSR { background: #9333ea; }
      .rarity-SR  { background: #7c3aed; }
      .rarity-R   { background: #2563eb; }
      .theme-default .rarity-badge{ box-shadow:0 2px 10px rgba(0,0,0,.35); }
    `;
    const style = document.createElement('style');
    style.id = 'rarity-badge-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // 카드 썸네일: 어두운 배경(이미지 톤 유지), 호버시만 살짝 오버레이
  function ensureCardStyles(){
    if (document.getElementById('heroes-card-styles')) return;
    const css = `
      .heroes-grid .card .thumb{
        position:relative;
        background:#0b1120;
        border-radius:0; overflow:hidden;
      }
      .heroes-grid .card .thumb img{
        width:100%;
        aspect-ratio:3/4;
        object-fit:cover;
        display:block;
        background:#0b1120;
      }
      .heroes-grid .card .thumb::after{
        content:""; position:absolute; inset:0;
        background: transparent;
        transition:background .15s ease;
      }
      .heroes-grid .card:hover .thumb::after{ background: rgba(0,0,0,.06); }
    `;
    const style = document.createElement('style');
    style.id = 'heroes-card-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // 이름 라벨 + 인라인 병종 아이콘 스타일
  function ensureUnitStyles(){
    if (document.getElementById('unit-inline-styles')) return;
    const css = `
      .heroes-grid .card .name{
        display:flex; align-items:center; justify-content:center;
        gap:6px; padding:10px 12px;
        font-weight:600; text-align:center; font-size:14px;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .heroes-grid.compact .card .name{ font-size:13px; padding:8px 10px; }

      .heroes-grid .card .unit-inline{
        width:18px; height:18px; line-height:18px;
        display:inline-flex; align-items:center; justify-content:center;
        flex:0 0 auto;
        filter: drop-shadow(0 1px 1px rgba(0,0,0,.25));
      }
      .heroes-grid.compact .card .unit-inline{ width:16px; height:16px; }

      .heroes-grid .card img.unit-inline{
        object-fit:contain; background:transparent;
      }
    `;
    const style = document.createElement('style');
    style.id = 'unit-inline-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ✅ 전 섹션 공통 compact 그리드 스타일 (자동 주입)
  function ensureCompactStyles(){
    if (document.getElementById('heroes-compact-styles')) return;
    const css = `
      .heroes-grid.compact{
        gap:12px;
        grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
      }
      @media (min-width: 768px){
        .heroes-grid.compact{ grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); }
      }
      @media (min-width: 1280px){
        .heroes-grid.compact{ grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
      }
    `;
    const style = document.createElement('style');
    style.id = 'heroes-compact-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }
})();

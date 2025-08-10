// === Database bootstrap (외부 모듈) ===
function initDatabase(){
  const grid = document.getElementById('db-grid');
  if (!grid || grid.dataset.rendered) return;
  grid.dataset.rendered = '1';
  grid.innerHTML = '';

  const TARGET_COUNT = 8;
  const ver = Date.now();

  const curated = [
    { name:'영웅 전용 무기',       preferFileBase:'widget-helgas-exclusive-gear-300x296', keys:['영웅','전용','무기'] },
    { name:'타임라인(서버나이)',   preferFileBase:'state-age-kingshot-300x291',            keys:['일정','타임라인','state','age','서버','나이'] },
    { name:'영웅 장비',            preferFileBase:'forgehammer-icon',                       keys:['영웅','장비'] },
    { name:'영웅 성급',            preferFileBase:'mythic-hero-shard-300x264',             keys:['영웅','성급','샤드','조각'] },
    { name:'영주 장비',            preferFileBase:'governor-gear-icon-296x300',            keys:['영주','장비'] },
    { name:'영주 보석',            preferFileBase:'governor-charms-300x282',               keys:['영주','보석','charms'] },
    { name:'영웅 부속품 조각',     preferFileBase:'purple-enhancement-xp-parts-295x300',   keys:['영웅','부속품','조각','accessory','액세서리','악세사리'] },
  ];

  const clean = p => (p||'').replace(/^\//,'');
  const fileName = p => clean(p).split('/').pop() || '';
  const baseName = f => f.toLowerCase().replace(/\.(webp|png|jpe?g|gif|svg)$/,'');
  const lower = s => (s||'').toLowerCase();
  const makeSrc = p => '/' + clean(p);

  (async () => {
    let posts = [];
    try{
      // JSON은 pages/database 폴더로 이동됨(절대경로)
      const r = await fetch('/pages/database/database_normalized.json?v=' + Date.now(), { cache:'no-store' });
      if (r.ok){
        const d = await r.json();
        posts = Array.isArray(d.posts) ? d.posts : [];
      }
    }catch{}

    const byBase = new Map();
    for (const p of posts){
      for (const src of (p.images||[])){
        const bn = baseName(fileName(src));
        if (bn && !byBase.has(bn)) byBase.set(bn, { src: clean(src), slug: p.slug });
      }
    }

    function findByKeys(keys){
      if (!keys?.length) return null;
      for (const p of posts){ const t = lower(p.title); if (keys.every(k=>t.includes(lower(k)))) return p; }
      for (const p of posts){ const t = lower(p.title); if (keys.some(k=>t.includes(lower(k)))) return p; }
      return null;
    }
    function pickImage(p, preferBase){
      if (!p?.images?.length) return null;
      if (preferBase){
        const hit = p.images.find(x => baseName(fileName(x)) === preferBase.toLowerCase());
        if (hit) return clean(hit);
      }
      return clean(p.images[0]);
    }

    const usedSlugs = new Set();
    const usedHrefs = new Set();
    const cardObjs = [];

    // 고정 7개
    for (const item of curated){
      let slug=null, img=null;
      if (item.preferFileBase && byBase.has(item.preferFileBase.toLowerCase())){
        const hit = byBase.get(item.preferFileBase.toLowerCase());
        slug = hit.slug; img = hit.src;
      }else{
        const match = findByKeys(item.keys);
        if (match){ slug = match.slug; img = pickImage(match, item.preferFileBase); }
      }
      const href = slug ? ('#db/' + slug) : '';
      if (slug) usedSlugs.add(slug);
      if (href) usedHrefs.add(href);
      cardObjs.push({
        href, slug,
        html: `
          <div class="card">
            <a ${href ? `href="${href}"` : ''}>
              ${img ? `<img src="${makeSrc(img)}?v=${ver}" alt="${item.name}" loading="lazy" decoding="async">`
                     : `<div style="height:160px;display:flex;align-items:center;justify-content:center;color:#888;border:1px dashed #ddd;border-radius:8px;">이미지 없음</div>`}
              <div class="card-name">${item.name}</div>
              ${href ? '' : '<div class="meta" style="font-size:12px;color:#888;margin-top:6px;">링크 준비중</div>'}
            </a>
          </div>`
      });
    }

    // 남는 1칸 보충
    for (const p of posts){
      if (cardObjs.length >= TARGET_COUNT) break;
      if (usedSlugs.has(p.slug)) continue;
      const href = '#db/' + p.slug;
      if (usedHrefs.has(href)) continue;
      const cover = p.images?.[0] ? clean(p.images[0]) : '';
      cardObjs.push({
        href, slug:p.slug,
        html: `
          <div class="card">
            <a href="${href}">
              ${cover ? `<img src="${makeSrc(cover)}?v=${ver}" alt="${p.title}" loading="lazy" decoding="async">` : ''}
              <div class="card-name">${p.title || 'Untitled'}</div>
            </a>
          </div>`
      });
      usedSlugs.add(p.slug);
      usedHrefs.add(href);
    }

    const unique = [];
    const seen = new Set();
    for (const c of cardObjs){
      const key = c.href || c.slug || c.html;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(c.html);
      if (unique.length >= TARGET_COUNT) break;
    }
    grid.innerHTML = unique.join('');

    // 텍스트 정규화
    const walker = document.createTreeWalker(grid, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes){
      const before = n.nodeValue;
      const after = before
        .replace(/맥스\s*레벨s?/gi, '최대레벨')
        .replace(/max\s*levels?/gi, '최대레벨');
      if (after !== before) n.nodeValue = after;
    }
  })();
}

async function renderDbDetail(slug){
  const main = document.getElementById('content');
  try{
    const url = `pages/database/${slug}/index.html?v=${Date.now()}`;
    const res = await fetch(url, { cache:'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    const html = await res.text();

    const doc = new DOMParser().parseFromString(html, 'text/html');

    // 1) 이전 상세에서 주입한 스타일 제거
    document.head.querySelectorAll('[data-db-style]').forEach(n => n.remove());

    // 2) 상세 문서의 <head> 스타일/스타일시트도 현재 문서에 주입
    doc.querySelectorAll('head style').forEach((el, i) => {
      const clone = el.cloneNode(true);
      clone.setAttribute('data-db-style', `db-style-${slug}-${i}`);
      document.head.appendChild(clone);
    });
    doc.querySelectorAll('head link[rel="stylesheet"]').forEach((el, i) => {
      const href = el.getAttribute('href');
      if (!href) return;
      const abs = new URL(href, url).toString(); // 상대경로 → 절대경로
      if (!document.querySelector(`head link[rel="stylesheet"][href="${abs}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = abs;
        link.setAttribute('data-db-style', `db-style-${slug}-${i}`);
        document.head.appendChild(link);
      }
    });

    const body = doc.querySelector('.wrap') || doc.querySelector('main') || doc.body;

    // 3) "데이터베이스 목록" 버튼 — 중앙 정렬 + 깔끔한 스타일
    const ROOT = location.pathname.includes('/pages/')
      ? location.pathname.split('/pages/')[0] + '/'
      : '/';
    const backHref = ROOT + '#database';

    const backStyles = `
      <style data-db-style="db-back">
        .db-detail .backbar{display:flex;justify-content:center;margin:8px 0 20px;}
        .db-detail .backbtn{
          display:inline-flex;align-items:center;gap:8px;
          padding:10px 14px;border-radius:10px;
          border:1px solid #e5e7eb;background:#fafafa;color:#111;
          text-decoration:none;font-weight:600;
          box-shadow:0 1px 2px rgba(0,0,0,.04);
          transition:transform .12s ease, box-shadow .12s ease, background-color .12s ease;
        }
        .db-detail .backbtn:hover{background:#f3f4f6;box-shadow:0 4px 10px rgba(0,0,0,.08);transform:translateY(-1px);}
        .db-detail .backbtn:focus-visible{outline:2px solid #1a73e8;outline-offset:2px;}
        .db-detail .backbtn .icon{width:16px;height:16px;display:inline-block;line-height:0;}
      </style>
    `;
    const back = `
  <nav class="backbar" aria-label="breadcrumb">
    <a class="backbtn" href="${backHref}" data-goto="database">
      목록으로 돌아가기
    </a>
  </nav>
`;

    // 4) 본문 주입
    const articleHTML = `<article class="db-detail">${backStyles}${back}${body.outerHTML || body.innerHTML}</article>`;
    main.innerHTML = articleHTML;

    // 5) 타이틀/GA/스크롤
    const title = (doc.querySelector('h1')?.textContent || slug).trim();
    document.title = `${title} - KingshotData.KR`;
    if (window.gtag) {
      gtag('event', 'page_view', {
        page_location: location.href,
        page_path: location.pathname + `#db/${slug}`,
        page_title: document.title
      });
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (err) {
    console.error(err);
    main.innerHTML = `
      <div style="padding:24px;border:1px solid #ddd;border-radius:8px;background:#fff;">
        <h2 style="margin-top:0;">로드 오류</h2>
        <p><code>pages/database/${slug}/index.html</code></p>
        <pre style="white-space:pre-wrap">${err.message}</pre>
      </div>`;
  }
}

// 상세 화면 빠져나올 때, 주입 스타일 정리 (index 수정 없이 처리)
if (!window.__dbStyleCleanupBound){
  window.addEventListener('hashchange', () => {
    const h = location.hash || '';
    if (!h.startsWith('#db/')) {
      document.head.querySelectorAll('[data-db-style]').forEach(n => n.remove());
    }
  });
  window.__dbStyleCleanupBound = true;
}

// ★ 전역 연결: 기존 index의 호출부가 window.* 를 찾도록 보조
window.initDatabase = window.initDatabase || initDatabase;
window.renderDbDetail = window.renderDbDetail || renderDbDetail;

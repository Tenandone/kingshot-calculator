// js/pages/database.js — DB 카드 SPA (목록 + 상세, '목록으로' 버튼, 중복 타이틀 방지)
(function () {
  'use strict';

  // ===== 기본 경로/헬퍼 =====
  const DB_BASE = '/pages/database/';

  const buildUrl = (folder, file) =>
    DB_BASE + encodeURIComponent(folder) + '/' + file;

  function resolveAsset(folder, src) {
    if (!src) return '';
    const s = String(src);
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('/')) return s;
    return buildUrl(folder, s.replace(/^\.?\//, ''));
  }

  // ===== 섹션 목록 =====
  const ITEMS = [
    { folder: 'governor-gear',               category: '영주장비' },
    { folder: 'governor-charm',              category: '영주보석' },
    { folder: 'server-timeline-(state-age)', category: '타임라인(서버나이)' },
    { folder: 'hero-gear-enhancement-chart', category: '영웅부속품' },
    { folder: 'max-levels',                  category: '최대레벨' },
    { folder: 'widgets',                     category: '영웅전용무기' },
    { folder: 'mastery-forging',             category: '제작망치' },
    { folder: 'hero-shards',                 category: '영웅성급' }
  ];

  // 폴더 안에서 시도할 파일명
  const CANDIDATES = ['index.html', 'main.html', 'guide.html', 'list.html', 'README.html'];

  // ===== 유틸 =====
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));

  const pickText = (doc, sels) => {
    for (const sel of sels) {
      const n = doc.querySelector(sel);
      if (n && n.textContent.trim()) return n.textContent.trim();
    }
    return '';
  };

  const pickAttr = (doc, sels, attr) => {
    for (const sel of sels) {
      const n = doc.querySelector(sel);
      const v = n && n.getAttribute(attr);
      if (v) return v;
    }
    return '';
  };

  function extractMeta(doc, fallbackUrl) {
    const title = (doc.querySelector('meta[name="db-title"]')?.content)
      || pickText(doc, ['.page h1', '.building-page h1', 'h1', 'title']);
    const summary = (doc.querySelector('meta[name="description"]')?.content)
      || pickText(doc, ['.page p', '.building-page p', 'p']);
    const image = (doc.querySelector('meta[property="og:image"]')?.content)
      || pickAttr(doc, ['.page img', '.building-page img', 'img'], 'src');
    return { title: title || '(제목 없음)', summary: summary || '', image: image || '', url: fallbackUrl };
  }

  // ===== 카드 렌더러 =====
  function card(it) {
    const img = it.image
      ? `<div class="card__media"><img src="${esc(it.image)}" alt="" loading="lazy" decoding="async"></div>`
      : `<div class="card__media"></div>`;

    const href = `#/db/${encodeURIComponent(it.folder)}`;

    return `
      <a class="card card--db" href="${href}" data-folder="${esc(it.folder)}" aria-label="${esc(it.title)}">
        ${img}
        <div class="card__body">
          <div class="card__title">${esc(it.title)}</div>
        </div>
      </a>
    `;
  }

  // ===== 리스트 =====
  function getGrid() {
    const grid = document.getElementById('db-grid');
    if (grid) grid.classList.add('grid', 'category-grid');
    return grid;
  }

  function render(list) {
    const grid = getGrid();
    if (!grid) return;
    grid.innerHTML = list.map(card).join('');
  }

  // ===== 상세 로더 (중복 타이틀/이미지 방지) =====
  async function openDbFolder(folder) {
    const main = document.getElementById('content') || document.body;
    const parser = new DOMParser();

    for (const file of CANDIDATES) {
      const url = buildUrl(folder, file);
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;

        const html = await res.text();
        const doc  = parser.parseFromString(html, 'text/html');

        const meta = extractMeta(doc, url);
        const heroResolved = meta.image ? resolveAsset(folder, meta.image) : '';

        // 본문 루트
        const bodyNode =
          doc.querySelector('.page, .building-page, main, article') || doc.body;

        // 본문에 이미 타이틀이 있는가?
        const hasTitleInBody = !!bodyNode.querySelector('h1');

        // 본문 첫 이미지 (상대경로 → 절대/폴더 기준으로 보정)
        const firstImg = bodyNode.querySelector('img');
        const firstImgResolved = firstImg ? resolveAsset(folder, firstImg.getAttribute('src') || '') : '';

        // 히어로를 주입해야 하는가? (본문 첫 이미지와 같으면 주입 안 함)
        const shouldInjectHero = !!(heroResolved && heroResolved !== firstImgResolved);

        // 본문 HTML
        const bodyHTML = bodyNode ? bodyNode.innerHTML : html;

        // 상단 '목록으로' 버튼 (항상 주입)
        const backNavHTML = `
          <nav class="db-detail__back" aria-label="데이터베이스 탐색">
            <a href="#/db" class="back-button back-button--pill" aria-label="목록으로">← 데이터베이스 목록으로</a>
          </nav>
        `;

        // 공통 헤더(타이틀/요약/히어로): 본문에 h1이 없을 때만 주입
        const headerHTML = !hasTitleInBody ? `
          <header class="db-detail__header">
            <h1 class="db-detail__title">${esc(meta.title)}</h1>
            ${meta.summary ? `<p class="db-detail__summary">${esc(meta.summary)}</p>` : ''}
            ${shouldInjectHero ? `
              <div class="db-detail__hero" aria-hidden="true">
                <img src="${esc(heroResolved)}" alt="" loading="lazy" decoding="async">
              </div>` : ''}
            <hr class="db-detail__divider">
          </header>
        ` : '';

        const wrapped = `
          <div class="container">
            <div class="panel panel--db-detail">
              ${backNavHTML}
              ${headerHTML}
              <section class="db-detail__content">${bodyHTML}</section>
            </div>
          </div>
        `;
        main.innerHTML = wrapped;

        try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (_) { window.scrollTo(0, 0); }
        return;
      } catch (_) {}
      
    }

    main.innerHTML = `<div class="container"><div class="panel"><p>해당 폴더를 열 수 없습니다: ${esc(folder)}</p></div></div>`;
  }
  window.openDbFolder = openDbFolder;

  // ===== 데이터 로딩/초기 렌더 =====
  let _once = false, _cache = [];
  async function loadListOnceAndRender() {
    if (_once) { render(_cache); return; }
    _once = true;

    const parser = new DOMParser();
    const results = [];

    for (const it of ITEMS) {
      let loaded = false;
      for (const file of CANDIDATES) {
        const url = buildUrl(it.folder, file);
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) continue;
          const text = await res.text();
          const doc = parser.parseFromString(text, 'text/html');
          const meta = extractMeta(doc, url);
          const fixedImage = meta.image ? resolveAsset(it.folder, meta.image) : '';
          results.push({ ...it, ...meta, image: fixedImage });
          loaded = true;
          break;
        } catch (_) {}
      }
      if (!loaded) {
        results.push({
          ...it,
          title: `(로드 실패) ${it.category}`,
          summary: '파일을 찾을 수 없습니다.',
          image: '',
          url: buildUrl(it.folder, 'index.html')
        });
      }
    }

    _cache = results;
    render(_cache);
  }

  // database.html에서 호출
  async function initDatabase() {
    const m = (location.hash || '').match(/^#\/db\/([^\/?#]+)/);
    if (m) {
      await loadListOnceAndRender();   // 목록 메타 캐시
      const folder = decodeURIComponent(m[1]);
      return openDbFolder(folder);
    }
    return loadListOnceAndRender();
  }
  window.initDatabase = initDatabase;

  // ===== 라우터 =====
  async function handleHashRoute() {
    const hash = location.hash || '';
    const m = hash.match(/^#\/db\/([^\/?#]+)/);
    if (m) {
      const folder = decodeURIComponent(m[1]);
      return openDbFolder(folder);
    }
    if (hash === '#/db' || hash === '#/db/') {
      render(_cache);
    }
  }
  window.addEventListener('hashchange', handleHashRoute);

})();

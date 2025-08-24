// js/pages/database.js — DB 카드 SPA (목록 + 상세, '목록으로' 버튼, 중복 타이틀 방지 + 성능개선)
(function () {
  'use strict';

  // =========================
  // 0) 네트워크 최적화 헬퍼
  //    - 같은 URL은 한 번만 fetch (메모이제이션)
  //    - 정적 사이트 특성상 cache:'force-cache'로 브라우저 캐시 적극 활용
  //    - 라우트 이동 시에도 캐시가 유지되도록 전역 Map 사용
  // =========================
  const MEMO = (window.__KSD_MEMO__ = window.__KSD_MEMO__ || new Map());

  const getText = (url) => {
    if (MEMO.has(url)) return MEMO.get(url);
    const p = fetch(url, { cache: 'force-cache' }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} @ ${url}`);
      return r.text();
    });
    MEMO.set(url, p);
    return p;
  };

  // 동시 요청 제한 풀 (한 번에 limit개만 네트워크 날림 → 초기 로드 체감 개선)
  async function withPool(items, worker, limit = 6) {
    const q = items.map((v, i) => ({ v, i }));
    const running = [];
    const out = new Array(items.length);

    const runOne = () => {
      if (!q.length) return;
      const { v, i } = q.shift();
      const job = worker(v, i)
        .then((res) => (out[i] = res))
        .catch(() => (out[i] = null))
        .finally(() => {
          running.splice(running.indexOf(job), 1);
          runOne();
        });
      running.push(job);
    };

    while (running.length < limit && q.length) runOne();
    while (running.length) await Promise.race(running);
    return out;
  }

  // ===== 기본 경로/헬퍼 =====
  const DB_BASE = '/pages/database/';

  const buildUrl = (folder, file) =>
    DB_BASE + encodeURIComponent(folder) + '/' + file;

  function resolveAsset(folder, src) {
    if (!src) return '';
    const s = String(src);
    // 절대 URL/data URL/루트 절대경로는 그대로(공백만 인코딩)
    if (/^(https?:|data:)/i.test(s)) return s.replace(/\s/g, '%20');
    if (s.startsWith('/')) return s.replace(/\s/g, '%20');
    // 상대경로 → 해당 폴더 기준으로 보정
    return buildUrl(folder, s.replace(/^\.?\//, '')).replace(/\s/g, '%20');
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
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

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
    const title =
      doc.querySelector('meta[name="db-title"]')?.content ||
      pickText(doc, ['.page h1', '.building-page h1', 'h1', 'title']);

    const summary =
      doc.querySelector('meta[name="description"]')?.content ||
      pickText(doc, ['.page p', '.building-page p', 'p']);

    const image =
      doc.querySelector('meta[property="og:image"]')?.content ||
      pickAttr(doc, ['.page img', '.building-page img', 'img'], 'src');

    return {
      title: title || '(제목 없음)',
      summary: summary || '',
      image: image || '',
      url: fallbackUrl
    };
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

  // ===== 리스트 영역 =====
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
        const html = await getText(url); // 메모이제이션 + 캐시
        const doc  = parser.parseFromString(html, 'text/html');

        const meta = extractMeta(doc, url);
        const heroResolved = meta.image ? resolveAsset(folder, meta.image) : '';

        // 본문 루트
        const bodyNode = doc.querySelector('.page, .building-page, main, article') || doc.body;

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
        const headerHTML = !hasTitleInBody
          ? `
          <header class="db-detail__header">
            <h1 class="db-detail__title">${esc(meta.title)}</h1>
            ${meta.summary ? `<p class="db-detail__summary">${esc(meta.summary)}</p>` : ''}
            ${shouldInjectHero ? `
              <div class="db-detail__hero" aria-hidden="true">
                <img src="${esc(heroResolved)}" alt="" loading="lazy" decoding="async">
              </div>` : ''}
            <hr class="db-detail__divider">
          </header>
        `
          : '';

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

        try {
          window.scrollTo({ top: 0, behavior: 'auto' });
        } catch (_) {
          window.scrollTo(0, 0);
        }
        return;
      } catch (_) {
        // 다음 후보 파일로 계속
      }
    }

    main.innerHTML = `<div class="container"><div class="panel"><p>해당 폴더를 열 수 없습니다: ${esc(folder)}</p></div></div>`;
  }
  window.openDbFolder = openDbFolder;

  // ===== 데이터 로딩/초기 렌더 =====
  let _once = false,
    _cache = [];

  async function loadListOnceAndRender() {
    if (_once) {
      render(_cache);
      return;
    }
    _once = true;

    const parser = new DOMParser();

    // 각 항목별로 "후보 파일들"을 순차 시도하는 워커
    const worker = async (it) => {
      for (const file of CANDIDATES) {
        const url = buildUrl(it.folder, file);
        try {
          const text = await getText(url); // 메모이제이션 + 캐시
          const doc = parser.parseFromString(text, 'text/html');
          const meta = extractMeta(doc, url);
          const fixedImage = meta.image ? resolveAsset(it.folder, meta.image) : '';
          return { ...it, ...meta, image: fixedImage };
        } catch (_) {
          // 다음 후보 파일 시도
        }
      }
      // 모든 후보 실패 시
      return {
        ...it,
        title: `(로드 실패) ${it.category}`,
        summary: '파일을 찾을 수 없습니다.',
        image: '',
        url: buildUrl(it.folder, 'index.html')
      };
    };

    // 동시 6개 제한으로 병렬 수집 → 네트워크 폭주 방지 + 체감 개선
    const results = await withPool(ITEMS, worker, 6);

    _cache = results.filter(Boolean);
    render(_cache);
  }

  // database.html에서 호출
  async function initDatabase() {
    const m = (location.hash || '').match(/^#\/db\/([^\/?#]+)/);
    if (m) {
      await loadListOnceAndRender(); // 목록 메타 캐시
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

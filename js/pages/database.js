// js/pages/database.js — 최소패치 완성본 (hero-exclusive-gear → widgets 리맵만 적용)
(function () {
  'use strict';

  // =========================
  // 0) 네트워크 최적화 & 캐시 무효화
  // =========================
  const V = (window.__V || 'now');
  const MEMO = (window.__KSD_MEMO__ = window.__KSD_MEMO__ || new Map());

  const getText = (url) => {
    const finalUrl = appendVersion(url);
    if (MEMO.has(finalUrl)) return MEMO.get(finalUrl);
    const p = fetch(finalUrl, { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} @ ${finalUrl}`);
      return r.text();
    });
    MEMO.set(finalUrl, p);
    return p;
  };

  function appendVersion(u) {
    try {
      if (/^(https?:|data:)/i.test(u)) return u;
      if (/\bv=([0-9]+|now)\b/.test(u)) return u;
      return u + (u.includes('?') ? `&v=${V}` : `?v=${V}`);
    } catch {
      return u;
    }
  }

  // =========================
  // 1) i18n helpers (기존 그대로)
  // =========================
  const T = (s, fb) => (window.I18N?.t ? I18N.t(s, fb ?? s) : (fb ?? s));
  async function ensureDbNamespace() {
    if (window.I18N?.init) {
      try { await I18N.init({ namespaces: ['db'] }); } catch (e) { console.debug('[db] i18n init skipped', e); }
    }
  }

  // =========================
  // 2) 병렬 풀 실행 헬퍼 (기존 그대로)
  // =========================
  async function withPool(items, worker, limit = 6) {
    const q = items.map((v, i) => ({ v, i }));
    const running = [];
    const out = new Array(items.length);
    const runOne = () => {
      if (!q.length) return;
      const { v, i } = q.shift();
      const job = worker(v, i)
        .then((res) => (out[i] = res))
        .catch((err) => { console.warn('[db] worker error', v, err); out[i] = null; })
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

  // =========================
  // 3) 경로/에셋
  // =========================
  const DB_BASE = '/pages/database/';
  const buildUrl = (folder, file) => appendVersion(DB_BASE + encodeURIComponent(folder) + '/' + file);

  function resolveAsset(folder, src) {
    if (!src) return '';
    const s = String(src);
    if (/^(https?:|data:)/i.test(s)) return s.replace(/\s/g, '%20');
    if (s.startsWith('/')) return appendVersion(s.replace(/\s/g, '%20'));
    const rel = s.replace(/^\.?\//, '').replace(/\s/g, '%20');
    return buildUrl(folder, rel);
  }

  // ✅ 전용무기 → 위젯 리맵 (표시/링크/로드 경로만 바꿈)
  function mapFolder(folder) {
    return folder === 'hero-exclusive-gear' ? 'widgets' : folder;
  }

  // =========================
  // 4) 카드 목록 소스 (기존 그대로)
  // =========================
  const ITEMS = [
    { folder: 'governor-gear',               category: 'db.governorGear.title' },
    { folder: 'governor-charm',              category: 'db.governorCharm.title' },
    { folder: 'server-timeline-(state-age)', category: 'db.serverTimeline.title' },
    { folder: 'hero-gear-enhancement-chart', category: 'db.heroGearEnhance.title' },
    { folder: 'max-levels',                  category: 'db.maxLevels.title' },
    { folder: 'widgets',                     category: 'db.widgets.title' },
    { folder: 'mastery-forging',             category: 'db.masteryForging.title' },
    { folder: 'hero-shards',                 category: 'db.heroShards.title' }
  ];
  const CANDIDATES = ['index.html', 'main.html', 'guide.html', 'list.html', 'README.html'];

  // =========================
  // 5) DOM 유틸 (기존 그대로)
  // =========================
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const pickText = (doc, sels) => {
    for (const sel of sels) {
      const n = doc.querySelector(sel);
      if (n && n.textContent && n.textContent.trim()) return n.textContent.trim();
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
    return { title: title || '(제목 없음)', summary: summary || '', image: image || '', url: fallbackUrl };
  }

  // =========================
  // 6) 카드 템플릿 (리맵 적용)
  // =========================
  function card(it) {
    const img = it.image
      ? `<div class="card__media"><img src="${esc(it.image)}" alt="" loading="lazy" decoding="async"></div>`
      : `<div class="card__media"></div>`;

    // ✅ 링크는 리맵된 폴더로
    const href = `#/db/${encodeURIComponent(mapFolder(it.folder))}`;

    // "a.b" 꼴이면 i18n 키로 간주
    const isKey = typeof it.title === 'string' && /[A-Za-z0-9_.-]+\.[A-Za-z0-9_.-]+/.test(it.title);
    const titleText = T(it.title, it.title);

    return `
      <a class="card card--db" href="${href}" data-folder="${esc(it.folder)}" aria-label="${esc(titleText)}">
        ${img}
        <div class="card__body">
          <div class="card__title"${isKey ? ` data-i18n="${esc(it.title)}"` : ''}>${esc(titleText)}</div>
        </div>
      </a>
    `;
  }

  function getGrid() {
    const grid = document.getElementById('db-grid');
    if (grid) grid.classList.add('grid', 'category-grid');
    return grid;
  }

  function render(list) {
    const grid = getGrid();
    if (!grid) return;
    grid.innerHTML = list.map(card).join('');
    if (window.I18N?.applyTo) I18N.applyTo(grid);
  }

  // =========================
  // 7) 목록 로드 (리맵 적용)
  // =========================
  let _once = false, _cache = [];
  async function loadListOnceAndRender() {
    if (_once) { render(_cache); return; }
    _once = true;

    await ensureDbNamespace();

    const parser = new DOMParser();
    const keyRe = /[A-Za-z0-9_.-]+\.[A-Za-z0-9_.-]+/;

    const worker = async (it) => {
      const folderToLoad = mapFolder(it.folder);          // ✅ 리맵된 폴더 기준으로 파일 로드
      for (const file of CANDIDATES) {
        const url = buildUrl(folderToLoad, file);
        try {
          const text = await getText(url);
          const doc = parser.parseFromString(text, 'text/html');
          const meta = extractMeta(doc, url);
          const fixedImage = meta.image ? resolveAsset(folderToLoad, meta.image) : '';

          // ✅ 전용무기는 제목 i18n 키를 widgets로 강제
          const title =
            it.folder === 'hero-exclusive-gear'
              ? 'db.widgets.title'
              : (keyRe.test(it.category) ? it.category : (meta.title || it.category));

          return { ...it, ...meta, title, image: fixedImage };
        } catch (e) {
          console.debug('[db] fetch fail', url, e);
        }
      }
      // 실패 시에도 i18n 키 유지 + 링크는 리맵 폴더로
      return {
        ...it,
        title: it.folder === 'hero-exclusive-gear' ? 'db.widgets.title' : it.category,
        summary: '파일을 찾을 수 없습니다.',
        image: '',
        url: buildUrl(folderToLoad, 'index.html')
      };
    };

    const results = await withPool(ITEMS, worker, 6);
    _cache = results.filter(Boolean);
    render(_cache);
  }

  // =========================
  // 8) 초기화 + 언어 변경 시 재치환 (기존 그대로)
  // =========================
  let _i18nBound = false;
  async function initDatabase() {
    if (!_i18nBound) {
      document.addEventListener('i18n:changed', () => {
        const grid = getGrid();
        if (grid && window.I18N?.applyTo) I18N.applyTo(grid);
      });
      _i18nBound = true;
    }
    return loadListOnceAndRender();
  }
  window.initDatabase = initDatabase;

  // ⛔ 상세 페이지 렌더는 routes.js의 '/db' 라우트에서 처리
})();

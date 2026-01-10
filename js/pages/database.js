// js/pages/database.js — history 모드 + hero-exclusive-gear → widgets 리맵 + 즉시 패치(자동 갱신)
(function () {
  'use strict';

  // =========================
  // 0) 네트워크 최적화 & 캐시 무효화
  // =========================

  /**
   * ✅ TTL(ms): "업로드 후 얼마나 빨리 자동 반영할지"
   * - 5~10초: 거의 즉시 반영(트래픽↑)
   * - 30~60초: 트래픽 절약(반영 느림)
   */
  const TTL_MS = 10 * 1000;

  // ✅ 빌드 버전(없으면 now). 이 값이 바뀌면 사실상 즉시 새 URL로 요청됨
  function getV() {
    return (window.__V || 'now');
  }

  /**
   * ✅ v 파라미터를 "항상 최신으로 set/교체" (기존 v=가 있어도 무조건 교체)
   * - relative/absolute 모두 처리
   */
  function appendVersion(u) {
    const V = getV();
    try {
      const url = new URL(String(u), location.origin);

      // data: 는 건드리지 않음
      if (url.protocol === 'data:') return url.href;

      // ✅ 핵심: 무조건 v를 최신으로 set (있으면 교체, 없으면 추가)
      url.searchParams.set('v', V);

      // 같은 origin이면 상대형으로 반환(깔끔)
      if (url.origin === location.origin) {
        return url.pathname + url.search + url.hash;
      }
      return url.href;
    } catch {
      // URL 파싱 실패 시(희귀): 문자열 방식 보정
      const raw = String(u);
      const [base, hashPart] = raw.split('#');
      const [path, qs] = base.split('?');
      const params = new URLSearchParams(qs || '');
      params.set('v', V);
      return path + '?' + params.toString() + (hashPart ? `#${hashPart}` : '');
    }
  }

  /**
   * ✅ MEMO 캐시 구조:
   * - key: finalUrl
   * - value: { ts, v, p }
   * - TTL 지나면 같은 URL이어도 새로 fetch
   */
  const MEMO = (window.__KSD_MEMO__ = window.__KSD_MEMO__ || new Map());

  function memoGet(key) {
    const hit = MEMO.get(key);
    if (!hit) return null;
    // v가 바뀐 경우는 즉시 무효 처리
    if (hit.v !== getV()) return null;
    // TTL 지나면 무효 처리
    if ((Date.now() - hit.ts) > TTL_MS) return null;
    return hit.p;
  }

  function memoSet(key, promise) {
    MEMO.set(key, { ts: Date.now(), v: getV(), p: promise });
    return promise;
  }

  const getText = (url, { force = false } = {}) => {
    const finalUrl = appendVersion(url);

    if (!force) {
      const cached = memoGet(finalUrl);
      if (cached) return cached;
    }

    const p = fetch(finalUrl, {
      cache: 'no-store',
      headers: {
        'cache-control': 'no-cache',
        'pragma': 'no-cache'
      }
    }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} @ ${finalUrl}`);
      return r.text();
    });

    return memoSet(finalUrl, p);
  };

  // =========================
  // 1) i18n helpers
  // =========================
  const T = (s, fb) => (window.I18N?.t ? I18N.t(s, fb ?? s) : (fb ?? s));

  async function ensureDbNamespace() {
    try {
      if (window.I18N?.init) {
        await I18N.init({ namespaces: ['db'] });
      }
      if (window.I18N?.loadNamespace) {
        await I18N.loadNamespace('db');
      } else if (window.I18N?.loadNamespaces) {
        await I18N.loadNamespaces(['db']);
      }
    } catch (e) {
      console.debug('[db] i18n ensure namespace skipped', e);
    }
  }

  // =========================
  // 2) 병렬 풀 실행 헬퍼
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
        .catch((err) => {
          console.warn('[db] worker error', v, err);
          out[i] = null;
        })
        .finally(() => {
          const idx = running.indexOf(job);
          if (idx >= 0) running.splice(idx, 1);
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
  const buildUrl = (folder, file) =>
    appendVersion(DB_BASE + encodeURIComponent(folder) + '/' + file);

  function resolveAsset(folder, src) {
    if (!src) return '';
    const s = String(src);
    if (/^(https?:|data:)/i.test(s)) return appendVersion(s).replace(/\s/g, '%20');
    if (s.startsWith('/')) return appendVersion(s).replace(/\s/g, '%20');
    const rel = s.replace(/^\.?\//, '').replace(/\s/g, '%20');
    return buildUrl(folder, rel);
  }

  // ✅ 전용무기 → 위젯 리맵
  function mapFolder(folder) {
    return folder === 'hero-exclusive-gear' ? 'widgets' : folder;
  }

  // =========================
  // 4) 카드 목록 소스
  // =========================

  /**
   * ✅ 선택사항(강추):
   * /pages/database/index.json 를 만들면,
   * "새 폴더 업로드"도 자동으로 카드에 뜸.
   *
   * 예시:
   * [
   *   { "folder": "governor-gear", "category": "db.governorGear.title" },
   *   { "folder": "widgets", "category": "db.widgets.title" }
   * ]
   */
  const INDEX_JSON = DB_BASE + 'index.json';

  // fallback( index.json 없을 때 )
  const ITEMS_FALLBACK = [
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

  async function loadItems({ force = false } = {}) {
    // index.json이 있으면 그걸 우선 사용(자동 확장)
    try {
      const text = await getText(INDEX_JSON, { force });
      const j = JSON.parse(text);
      if (Array.isArray(j) && j.length) {
        return j
          .map(x => ({
            folder: String(x.folder || '').trim(),
            category: String(x.category || '').trim() || 'db.widgets.title'
          }))
          .filter(x => x.folder);
      }
    } catch (_) {
      // index.json 없으면 fallback
    }
    return ITEMS_FALLBACK.slice();
  }

  // =========================
  // 5) DOM 유틸
  // =========================
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
    );

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
  // 6) 카드 템플릿
  // =========================
  const TITLE_FALLBACKS = {
    'db.heroGearEnhance.title': 'EXP'
  };

  function card(it) {
    const img = it.image
      ? `<div class="card__media"><img src="${esc(it.image)}" alt="" loading="lazy" decoding="async"></div>`
      : `<div class="card__media"></div>`;

    const href = `/db/${encodeURIComponent(mapFolder(it.folder))}`;

    const isKey =
      typeof it.title === 'string' &&
      /[A-Za-z0-9_.-]+\.[A-Za-z0-9_.-]+/.test(it.title);

    const titleText = T(it.title, TITLE_FALLBACKS[it.title] ?? it.title);

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
  // 7) 목록 로드 (TTL 자동 갱신)
  // =========================
  let _cache = [];
  let _lastRenderAt = 0;
  let _loading = null;

  function ttlExpired() {
    return (Date.now() - _lastRenderAt) > TTL_MS;
  }

  async function loadListAndRender({ force = false } = {}) {
    // 동시 호출 방지(라우팅/이벤트 중복 실행)
    if (_loading) return _loading;

    // TTL 안 지났고 force 아니면 캐시 사용
    if (!force && _cache.length && !ttlExpired()) {
      render(_cache);
      return;
    }

    _loading = (async () => {
      await ensureDbNamespace();

      const items = await loadItems({ force });

      const parser = new DOMParser();
      const keyRe = /[A-Za-z0-9_.-]+\.[A-Za-z0-9_.-]+/;

      const worker = async (it) => {
        const folderToLoad = mapFolder(it.folder);

        for (const file of CANDIDATES) {
          const url = buildUrl(folderToLoad, file);
          try {
            // ✅ TTL 만료/force 시에도 새로 읽히게 force 전달
            const text = await getText(url, { force: force || ttlExpired() });
            const doc = parser.parseFromString(text, 'text/html');
            const meta = extractMeta(doc, url);
            const fixedImage = meta.image ? resolveAsset(folderToLoad, meta.image) : '';

            const title =
              it.folder === 'hero-exclusive-gear'
                ? 'db.widgets.title'
                : keyRe.test(it.category)
                  ? it.category
                  : meta.title || it.category;

            return { ...it, ...meta, title, image: fixedImage };
          } catch (e) {
            console.debug('[db] fetch fail', url, e);
          }
        }

        return {
          ...it,
          title: it.folder === 'hero-exclusive-gear' ? 'db.widgets.title' : it.category,
          summary: '파일을 찾을 수 없습니다.',
          image: '',
          url: buildUrl(folderToLoad, 'index.html')
        };
      };

      const results = await withPool(items, worker, 6);
      _cache = results.filter(Boolean);
      _lastRenderAt = Date.now();
      render(_cache);
    })().finally(() => {
      _loading = null;
    });

    return _loading;
  }

  // =========================
  // 8) 초기화 + 이벤트 바인딩
  // =========================
  let _bound = false;

  async function initDatabase(opts = {}) {
    if (!_bound) {
      // 언어 변경: DOM 치환만 다시 적용
      document.addEventListener('i18n:changed', () => {
        const grid = getGrid();
        if (grid && window.I18N?.applyTo) I18N.applyTo(grid);
      });

      // 라우팅으로 돌아올 때: TTL 체크 후 필요하면 갱신
      window.addEventListener('popstate', () => initDatabase());
      window.addEventListener('hashchange', () => initDatabase());

      // 탭 다시 활성화되면: 즉시 TTL 체크 후 갱신
      window.addEventListener('focus', () => initDatabase());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') initDatabase();
      });

      // 개발/운영용: 콘솔에서 즉시 강제 갱신
      // window.__dbRefresh(true)
      window.__dbRefresh = (force = true) => initDatabase({ force });

      _bound = true;
    }

    return loadListAndRender(opts);
  }

  window.initDatabase = initDatabase;

  // ⛔ 상세 페이지는 routes.js의 '/db' 라우트에서 처리
})();

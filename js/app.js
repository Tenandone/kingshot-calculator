// js/app.js — SPA Router for KingshotData.kr
// final: route-scoped CSS, H1 dedupe, no nested panel, race-safe & preflighted script loader
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const CALC_CSS_HREF = '/css/calculator.css';

  // ---- header utils ----
  const yearEl = $('#y');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const nav = $('#primaryNav');
  const toggle = $('#menuToggle');
  if (nav && toggle) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // ---- dynamic <script> loader (once, race-safe, preflight to avoid MIME errors) ----
  const loadedScripts = new Map();

  async function loadScriptOnce(src) {
    if (!src) return;
    if (loadedScripts.has(src)) return loadedScripts.get(src); // in-flight/completed promise

    const p = (async () => {
      // 1) Preflight: 존재/타입 확인 (HTML을 JS로 실행하려다 나는 MIME 에러 방지)
      let r;
      try {
        r = await fetch(src, { cache: 'no-store' });
      } catch (e) {
        throw new Error(`Fetch failed @ ${src}: ${e.message}`);
      }
      if (!r.ok) throw new Error(`HTTP ${r.status} @ ${src}`);

      const ct = (r.headers.get('content-type') || '').toLowerCase();
      const looksJs = /\.js($|\?)/.test(src) || /javascript|ecmascript/.test(ct);
      if (!looksJs) {
        // HTML/텍스트라면 주입하지 않고 실패 처리 (콘솔 MIME 경고 차단)
        throw new Error(`Not JS: ${ct || 'unknown content-type'} @ ${src}`);
      }

      // 2) Script 태그 주입
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.defer = true;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Failed to load ' + src));
        document.head.appendChild(s);
      });
    })();

    loadedScripts.set(src, p);
    try {
      await p;
    } catch (e) {
      loadedScripts.delete(src); // 실패 시 캐시 제거 (다음 후보 시도)
      throw e;
    }
    return p;
  }

  // ---- dynamic <link rel=stylesheet> (by id) ----
  function ensureCSS(id, href) {
    return new Promise((resolve) => {
      const had = document.getElementById(id);
      if (had) return resolve(had);
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => resolve(link);
      link.onerror = () => resolve(link);
      document.head.appendChild(link);
    });
  }
  function removeCSS(id) { document.getElementById(id)?.remove(); }

  async function loadHTML(candidates) {
    for (const path of candidates) {
      try {
        const r = await fetch(path, { cache: 'no-store' });
        if (r.ok) return await r.text();
      } catch (_) {}
    }
    return null;
  }

  const iconImg = (alt, src) =>
    `<img src="${src}" alt="${alt}" class="cat-icon__img" loading="lazy" decoding="async">`;

  function catCard(href, iconHTML, title, subtitle) {
    return [
      '<a class="card card--category" href="', href, '">',
        '<div class="card__media" aria-hidden="true">', iconHTML || '', '</div>',
        '<div class="card__body">',
          '<div class="card__title">', title, '</div>',
          subtitle ? '<div class="card__subtitle">' + subtitle + '</div>' : '',
        '</div>',
      '</a>'
    ].join('');
  }

  // ---------- DB 상세 렌더러 ----------
  function rewriteRelativeUrls(doc, base) {
    const fix = (el, attr) => {
      const v = el.getAttribute(attr);
      if (!v) return;
      if (/^https?:\/\//i.test(v) || v.startsWith('data:') || v.startsWith('#') || v.startsWith('/')) return;
      el.setAttribute(attr, base + v.replace(/^\.?\//,''));
    };
    doc.querySelectorAll('img[src]').forEach(el => fix(el, 'src'));
    doc.querySelectorAll('link[href]').forEach(el => fix(el, 'href'));
    doc.querySelectorAll('script[src]').forEach(el => el.remove());
    doc.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      if (/^https?:\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('#') || href.startsWith('/')) return;
      a.setAttribute('data-db-internal', href.replace(/^\.?\//,''));
      a.setAttribute('href', '#'); // CSP 친화적으로 변경
    });
    return doc;
  }

  async function renderDbDetail(el, folder, file) {
    const base = `pages/database/${encodeURIComponent(folder)}/`;
    const candidates = file
      ? [ base + file ]
      : [ base + 'index.html', base + 'main.html', base + 'guide.html', base + 'list.html', base + 'README.html' ];

    const html = await loadHTML(candidates);
    if (!html) {
      el.innerHTML = `
        <div class="placeholder">
          <h2>데이터베이스</h2>
          <p class="muted">해당 문서를 찾을 수 없습니다.</p>
          <p><a class="btn" href="#/database">← 목록으로</a></p>
        </div>`;
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const fixed = rewriteRelativeUrls(doc, base);

    const metaTitle = fixed.querySelector('meta[name="db-title"]')?.content
                   || fixed.querySelector('title')?.textContent
                   || fixed.querySelector('h1')?.textContent
                   || '데이터베이스';

    // 본문 h1 중복 제거
    const bodyNode = fixed.body ? fixed.body.cloneNode(true) : null;
    if (bodyNode) {
      const firstH1 = bodyNode.querySelector('h1');
      if (firstH1) firstH1.remove();
    }
    const bodyHTML = bodyNode ? bodyNode.innerHTML : (fixed.body ? fixed.body.innerHTML : html);

    // ⛔ 중첩 .panel 제거: #content가 이미 panel이므로 여기서 panel로 감싸지 않음
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h1 style="margin:0;font-size:20px;">${metaTitle}</h1>
        <a class="btn" href="#/database">목록으로</a>
      </div>
      <div class="db-detail">${bodyHTML}</div>
    `;

    el.querySelectorAll('[data-db-internal]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const next = a.getAttribute('data-db-internal');
        location.hash = `#/db/${encodeURIComponent(folder)}/${encodeURIComponent(next)}`;
      });
    });
  }
  // ------------------------------------

  // ---------- 라우트 생성(외부 routes.js에서 주입) ----------
  // ⚠️ index.html에서 반드시 routes.js를 app.js보다 먼저 로드할 것.
  // <script defer src="/js/routes.js"></script>
  // <script defer src="/js/app.js"></script>
  const routes = window.buildRoutes({
    loadHTML,
    loadScriptOnce,
    renderDbDetail,
    iconImg,
    catCard
  });
  // -----------------------------

  // --- 상단 내비게이션 활성화 표시 ---
  function setActive(path) {
    const tab = path === '/db' ? '/database'
             : path === '/hero' ? '/heroes'
             : path;
    document.querySelectorAll('[data-nav]').forEach(a => {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + tab);
    });
  }

  let navVer = 0;

  async function navigate(path) {
    const myVer = ++navVer;
    const el = document.getElementById('content');
    const route = routes[path] || routes['/home'];

    document.title = route.title;
    setActive(path);

    // route-scoped CSS: calculator만 calculator.css 적용
    if (path === '/calculator') {
      await ensureCSS('calc-css', CALC_CSS_HREF);
    } else {
      removeCSS('calc-css');
    }

    const rest = location.hash.replace('#' + path, '').replace(/^#?\/?/, '');
    await route.render(el, rest);

    if (myVer !== navVer) return;

    if (nav && toggle) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  }

  function parseHash() {
    let raw = (location.hash || '#/home').slice(1);
    raw = raw.replace(/^\/+/, '');

    if (raw.startsWith('building/')) return ['/buildings', raw];
    if (raw === 'buildings') return ['/buildings', ''];

    const parts = raw.split('/');
    const path  = '/' + (parts[0] || 'home');
    const rest  = parts.slice(1).join('/');
    return [path, rest];
  }

  window.addEventListener('hashchange', () => {
    const [path] = parseHash();
    navigate(path);
  });

  window.addEventListener('DOMContentLoaded', () => {
    const [path] = parseHash();
    navigate(path);
  });
})();

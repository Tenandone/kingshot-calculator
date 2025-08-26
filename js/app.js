// js/app.js — SPA Router for KingshotData.kr
// final: route-scoped CSS, H1 dedupe, no nested panel, race-safe & preflighted script loader
//        + AutoAds ping + asset versioning (+ DB img/srcset 버전 보강)
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  // ===== Asset version (캐시 무효화) =====
  const ASSET_VER = '202508261423';
  function v(url){
    if (!url) return url;
    if (/^(data:|blob:|#)/i.test(url)) return url; // data:/blob:/# 은 제외
    return url + (url.includes('?') ? '&' : '?') + 'v=' + ASSET_VER;
  }

  // ✅ CSS 경로
  const CALC_CSS_HREF = '/css/calculator.css';
  const COMPONENTS_CSS_HREF = '/css/components.css'; // 공통 카드/썸네일 스타일(옵션)

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
    if (loadedScripts.has(src)) return loadedScripts.get(src);

    const p = (async () => {
      let r;
      try {
        r = await fetch(src, { cache: 'no-store' });
      } catch (e) {
        throw new Error(`Fetch failed @ ${src}: ${e.message}`);
      }
      if (!r.ok) throw new Error(`HTTP ${r.status} @ ${src}`);

      const ct = (r.headers.get('content-type') || '').toLowerCase();
      const looksJs = /\.js($|\?)/.test(src) || /javascript|ecmascript/.test(ct);
      if (!looksJs) throw new Error(`Not JS: ${ct || 'unknown content-type'} @ ${src}`);

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
    try { await p; } catch (e) { loadedScripts.delete(src); throw e; }
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

  // ---- 이미지 아이콘: 자동 버전 파라미터 부착 ----
  const iconImg = (alt, src) =>
    `<img src="${v(src)}" alt="${alt}" class="cat-icon__img" loading="lazy" decoding="async">`;

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
    const isAbs = (u) => /^https?:\/\//i.test(u) || u.startsWith('data:') || u.startsWith('#') || u.startsWith('/');
    const joinBase = (u) => base + u.replace(/^\.?\//,'');

    const fixUrl = (u) => isAbs(u) ? u : joinBase(u);

    // <img src>: 상대 → 절대화 + 버전
    doc.querySelectorAll('img[src]').forEach(el => {
      const cur = el.getAttribute('src');
      if (!cur) return;
      el.setAttribute('src', v(fixUrl(cur)));
    });

    // <img/srcset> & <source/srcset>: 각 URL 절대화 + 버전
    doc.querySelectorAll('img[srcset], source[srcset]').forEach(el => {
      const cur = el.getAttribute('srcset');
      if (!cur) return;
      const out = cur.split(',').map(part => {
        const [u, d] = part.trim().split(/\s+/, 2);
        if (!u) return part;
        const fixed = v(fixUrl(u));
        return d ? `${fixed} ${d}` : fixed;
      }).join(', ');
      el.setAttribute('srcset', out);
    });

    // <link> href: 상대경로만 절대화
    doc.querySelectorAll('link[href]').forEach(el => {
      const cur = el.getAttribute('href');
      if (!cur) return;
      if (!isAbs(cur)) el.setAttribute('href', joinBase(cur));
    });

    // 외부 스크립트 제거(보안/충돌 방지)
    doc.querySelectorAll('script[src]').forEach(el => el.remove());

    // 내부 링크는 SPA 경로로 바꾸기
    doc.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      if (isAbs(href) || href.startsWith('mailto:')) return;
      a.setAttribute('data-db-internal', href.replace(/^\.?\//,''));
      a.setAttribute('href', '#');
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

    const bodyNode = fixed.body ? fixed.body.cloneNode(true) : null;
    if (bodyNode) {
      const firstH1 = bodyNode.querySelector('h1');
      if (firstH1) firstH1.remove();
    }
    const bodyHTML = bodyNode ? bodyNode.innerHTML : (fixed.body ? fixed.body.innerHTML : html);

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h1 style="margin:0;font-size:20px;">${metaTitle}</h1>
        <a class="btn" href="#/database">목록으로</a>
      </div>
      <div class="db-detail">${bodyHTML}</div>
    `;

    // ✅ 보강: 렌더된 노드에서도 img/srcset에 버전 재확인(동적/엣지 케이스 커버)
    el.querySelectorAll('.db-detail img[src]').forEach(img => {
      img.setAttribute('src', v(img.getAttribute('src')));
    });
    el.querySelectorAll('.db-detail img[srcset], .db-detail source[srcset]').forEach(node => {
      const cur = node.getAttribute('srcset');
      if (!cur) return;
      const out = cur.split(',').map(part => {
        const [u, d] = part.trim().split(/\s+/, 2);
        if (!u) return part;
        const hasQuery = /\?/.test(u);
        const fixed = v(u); // 여기서는 이미 절대/상대 상관없이 v()만 적용(상대도 동작)
        return d ? `${fixed} ${d}` : fixed;
      }).join(', ');
      node.setAttribute('srcset', out);
    });

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
  const routes = window.buildRoutes({
    loadHTML,
    loadScriptOnce,
    renderDbDetail,
    iconImg,
    catCard
  });

  // --- 상단 내비게이션 활성화 표시 ---
  function setActive(path) {
    const tab = path === '/db' ? '/database'
             : path === '/hero' ? '/heroes'
             : path;
    document.querySelectorAll('[data-nav]').forEach(a => {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + tab);
    });
  }

  // ---- Auto Ads: SPA 라우팅 시 재호출(디바운스) ----
  const pingAutoAds = (() => {
    let t;
    return () => {
      clearTimeout(t);
      t = setTimeout(() => {
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
      }, 150);
    };
  })();

  let navVer = 0;

  async function navigate(path) {
    const myVer = ++navVer;
    const el = document.getElementById('content');
    const route = routes[path] || routes['/home'];

    document.title = route.title;
    setActive(path);

    // ✅ 계산기 허브 + 상세 모두 calculator.css 적용 (버전 부착)
    if (path === '/calculator' || path.startsWith('/calc-')) {
      await ensureCSS('calc-css', v(CALC_CSS_HREF));
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

    // 🔔 라우트 렌더 완료 후 자동광고 트리거
    pingAutoAds();
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
    pingAutoAds(); // 보강
  });

  // ✅ 공통 카드/썸네일 CSS는 초기 1회 로드 (버전 부착)
  window.addEventListener('DOMContentLoaded', async () => {
    await ensureCSS('components-css', v(COMPONENTS_CSS_HREF));
    const [path] = parseHash();
    await navigate(path);
    pingAutoAds();
  });

  // (디버그) 로드 확인
  // console.log('app.js loaded:', ASSET_VER);
})();

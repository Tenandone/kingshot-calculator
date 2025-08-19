// js/app.js — SPA Router for KingshotData.kr
// final: route-scoped CSS, H1 dedupe, no nested panel, race-safe script loader
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

  // ---- dynamic <script> loader (once, race-safe) ----
  const loadedScripts = new Map();
  function loadScriptOnce(src) {
    if (!src) return Promise.resolve();
    if (loadedScripts.has(src)) return loadedScripts.get(src); // 이미 로딩 중/완료된 프라미스 재사용

    const p = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => { loadedScripts.delete(src); reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });

    loadedScripts.set(src, p);
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

  // ---------- 라우트 정의 ----------
  const routes = {
    '/home': {
      title: '홈 - KingshotData.kr',
      render: (el) => {
        el.innerHTML = [
          '<section class="hero">',
            '<div class="hero__copy">',
              '<h1 class="hero__title">KingshotDataKorea</h1>',              
            '</div>',
            '<div class="hero__art" aria-hidden="true">KD</div>',
          '</section>',
          '<section class="home-categories">',
            '<h2 class="section-title">카테고리</h2>',
            '<div class="grid category-grid">',

              catCard('#/buildings', iconImg('건물', '/img/saulchar.png'), '건물', '업그레이드 표'),
              catCard('#/heroes',    iconImg('영웅', '/img/helgachar.png'), '영웅', '영웅스킬/특성'),
              catCard('#/database',  iconImg('최대레벨', '/img/database.png'), '데이터베이스', '킹샷데이터'),
              catCard('#/guides',    iconImg('가이드', '/img/guides.png'), '가이드', '공략모음'),
              catCard('#/calculator',iconImg('계산기', '/img/calculator.png'), '계산기', '업그레이드 자원계산'),
              catCard('#/about',     iconImg('소개', '/img/about.png'), '소개', '문의하기'),

            '</div>',
          '</section>'
        ].join('');
        window.scrollTo({ top: 0 });
      }
    },

    '/buildings': {
      title: '건물 - KingshotData.kr',
      render: async (el) => {
        el.innerHTML = [
          '<div id="buildings-grid" class="grid"></div>',
          '<div id="building-root"></div>'
        ].join('');

        const candidates = ['js/pages/buildings.js','/js/pages/buildings.js'];
        let ok = false, lastErr;
        for (const src of candidates) {
          try { await loadScriptOnce(src); ok = true; break; }
          catch (e) { lastErr = e; }
        }
        if (!ok) {
          el.innerHTML = '<div class="placeholder"><h2>로딩 실패</h2><p class="muted">buildings.js 경로를 확인하세요.</p></div>';
          if (lastErr) console.error(lastErr);
          return;
        }

        if (typeof window.initBuildings !== 'function') {
          el.innerHTML = '<div class="placeholder"><h2>초기화 실패</h2><p class="muted">window.initBuildings()가 없습니다.</p></div>';
          return;
        }

        try { window.initBuildings(); } catch (e) { console.error(e); }
        window.scrollTo({ top: 0 });
      }
    },

    '/heroes': {
      title: '영웅 - KingshotData.kr',
      render: async (el) => {
        el.innerHTML = '<div class="loading">Loading…</div>';

        const html = await loadHTML(['pages/heroes.html','/pages/heroes.html','heroes.html','/heroes.html']);
        if (!html) {
          el.innerHTML = '<div class="placeholder"><h2>영웅</h2><p class="muted">heroes.html을 찾을 수 없습니다.</p></div>';
          return;
        }

        const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        el.innerHTML = m ? m[1] : html;

        const jsCands = ['js/pages/heroes.js','/js/pages/heroes.js'];
        let loadedAny = false;
        for (const src of jsCands) {
          try { await loadScriptOnce(src); loadedAny = true; break; } catch(_) {}
        }
        if (!loadedAny) {
          el.insertAdjacentHTML('beforeend','<div class="error">heroes.js 로드 실패</div>');
          return;
        }

        if (typeof window.initHeroes === 'function') {
          try { window.initHeroes(); } catch (e) { console.error(e); }
        } else {
          el.insertAdjacentHTML('beforeend','<div class="error">initHeroes()가 없습니다.</div>');
        }

        window.scrollTo({ top: 0 });
      }
    },

    '/hero': {
      title: '영웅 상세 - KingshotData.kr',
      render: async (el, rest) => {
        const slug = decodeURIComponent((rest || '').split('/').filter(Boolean)[0] || '');

        el.innerHTML = `
          <section class="container">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
              <h1 class="page-title" id="hero-title">영웅 상세</h1>
              <a class="btn" href="#/heroes">← 목록으로</a>
            </div>
            <div id="hero-root" class="hero-detail"></div>
          </section>
          <style>
            .hero-detail{ display:grid; gap:16px; grid-template-columns: 1fr; }
            @media (min-width: 900px){
              .hero-detail{ grid-template-columns: 320px 1fr; align-items:start; }
            }
            .hero-card{ background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,.06); }
            .hero-card img{ width:100%; aspect-ratio:3/4; object-fit:cover; display:block; background:#eee; }
            .hero-card .meta{ padding:12px; font-size:14px; color:#333; }
            .hero-section{ background:#fff; border-radius:14px; box-shadow:0 2px 10px rgba(0,0,0,.06); padding:14px; }
            .hero-section h2{ margin:0 0 8px; font-size:16px; }
            .kv{ display:grid; grid-template-columns: 110px 1fr; gap:6px 10px; font-size:14px; }
            .kv dt{ color:#666; }
            .pill{ display:inline-block; padding:2px 8px; border-radius:999px; background:#eef2ff; color:#273; font-size:12px; margin-right:6px; }
            .muted{ color:#666; }

            /* ✅ 스킬 이미지 중앙정렬(전역 영향 무시) */
            .hero-section .skill img{ display:block; margin-inline:auto; float:none; }
            .hero-section .skills-row{ display:flex; justify-content:center; gap:12px; flex-wrap:wrap; }
            .hero-section .skills-grid{ display:grid; place-items:center; gap:12px; }
          </style>
        `;

        const jsCands = ['js/pages/hero.js','/js/pages/hero.js'];
        let ok=false;
        for (const src of jsCands){
          try { await loadScriptOnce(src); ok=true; break; } catch(_){}
        }
        if (!ok){ el.insertAdjacentHTML('beforeend','<div class="error">hero.js 로드 실패</div>'); return; }

        if (typeof window.initHero === 'function'){
          try { window.initHero(slug); } catch(e){ console.error(e); }
        } else {
          el.insertAdjacentHTML('beforeend','<div class="error">initHero()가 없습니다.</div>');
        }

        window.scrollTo({ top: 0 });
      }
    },

    '/guides': {
      title: '가이드 - KingshotData.kr',
      render: (el) => {
        el.innerHTML = '<div class="placeholder"><h2>가이드</h2><p class="muted">준비 중입니다.</p></div>';
        window.scrollTo({ top: 0 });
      }
    },

    '/database': {
      title: '데이터베이스 - KingshotData.kr',
      render: async (el) => {
        el.innerHTML = '<div class="loading">Loading…</div>';

        const html = await loadHTML(['pages/database.html','/pages/database.html','database.html','/database.html']);
        if (!html) {
          el.innerHTML = '<div class="placeholder"><h2>데이터베이스</h2><p class="muted">database.html을 찾을 수 없습니다.</p></div>';
          return;
        }

        const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        el.innerHTML = m ? m[1] : html;

        const jsCands = ['js/pages/database.js','/js/pages/database.js'];
        let loadedAny = false;
        for (const src of jsCands) {
          try { await loadScriptOnce(src); loadedAny = true; break; } catch(_) {}
        }
        if (!loadedAny) {
          el.insertAdjacentHTML('beforeend','<div class="error">database.js 로드 실패</div>');
          return;
        }

        if (typeof window.initDatabase === 'function') {
          try { window.initDatabase(); } catch (e) { console.error(e); }
        } else {
          el.insertAdjacentHTML('beforeend','<div class="error">initDatabase()가 없습니다.</div>');
        }

        window.scrollTo({ top: 0 });
      }
    },

    '/db': {
      title: '데이터베이스 - KingshotData.kr',
      render: async (el, rest) => {
        const parts = (rest || '').split('/').filter(Boolean);
        const folder = parts[0] ? decodeURIComponent(parts[0]) : '';
        const file   = parts[1] ? decodeURIComponent(parts.slice(1).join('/')) : '';
        if (!folder) { location.hash = '#/database'; return; }
        await renderDbDetail(el, folder, file);
        window.scrollTo({ top: 0 });
      }
    },

    '/calculator': {
      title: '계산기 - KingshotData.kr',
      render: async (el) => {
        el.innerHTML = '<div class="loading">Loading…</div>';

        const html = await loadHTML(['pages/calculator.html','/pages/calculator.html','calculator.html','/calculator.html']);
        if (!html) {
          el.innerHTML = '<div class="placeholder"><h2>계산기</h2><p class="muted">calculator.html을 찾을 수 없습니다.</p></div>';
          return;
        }

        const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        el.innerHTML = m ? m[1] : html;

        const jsCands = [
          'js/pages/calculator.js','/js/pages/calculator.js',
          'js/tools/calculator.js','/js/tools/calculator.js',
          'js/calculator.js','/js/calculator.js',
          'calculator.js','/calculator.js'
        ];
        let loadedAny = false;
        for (const src of jsCands) {
          try { await loadScriptOnce(src); loadedAny = true; break; } catch(_) {}
        }
        if (!loadedAny) {
          el.insertAdjacentHTML('beforeend','<div class="error">calculator.js 로드 실패</div>');
          return;
        }

        if (typeof window.initCalculator === 'function') {
          try { window.initCalculator(); } catch(e) { console.error(e); }
        } else {
          el.insertAdjacentHTML('beforeend','<div class="error">initCalculator()가 없습니다.</div>');
        }

        window.scrollTo({ top: 0 });
      }
    },

    '/about': {
      title: '소개 - KingshotData.kr',
      render: async (el) => {
        el.innerHTML = '<div class="loading">Loading…</div>';
        const html = await loadHTML(['pages/about.html','/pages/about.html','about.html','/about.html']);
        if (html) {
          const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          el.innerHTML = m ? m[1] : html;
        } else {
          el.innerHTML = '<div class="placeholder"><h2>소개</h2><p class="muted">about.html을 찾을 수 없습니다.</p></div>';
        }
        window.scrollTo({ top: 0 });
      }
    }
  };
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

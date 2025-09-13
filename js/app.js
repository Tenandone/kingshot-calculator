// js/app.js — SPA Router for KingshotData.kr
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  // ===== Asset version (캐시 무효화) =====
  const ASSET_VER = window.__V || 'now';   // index.html에서 <script>window.__V=…</script> 세팅됨
  function v(url){
    if (!url) return url;
    if (/^(data:|blob:|#)/i.test(url)) return url;
    return url + (url.includes('?') ? '&' : '?') + 'v=' + ASSET_VER;
  }

  // ✅ CSS 경로 (버전 붙일 땐 v() 사용)
  const CALC_CSS_HREF = '/css/calculator.css';
  const COMPONENTS_CSS_HREF = '/css/components.css';

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

  // ---- dynamic <script> loader ----
  const loadedScripts = new Map();
  async function loadScriptOnce(src) {
    if (!src) return;
    if (loadedScripts.has(src)) return loadedScripts.get(src);

    const p = (async () => {
      let r;
      try { r = await fetch(src, { cache: 'no-store' }); }
      catch (e) { throw new Error(`Fetch failed @ ${src}: ${e.message}`); }
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
      link.href = v(href);
      link.onload = () => resolve(link);
      link.onerror = () => resolve(link);
      document.head.appendChild(link);
    });
  }
  function removeCSS(id) { document.getElementById(id)?.remove(); }

  // ---- HTML fetch with fallbacks ----
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

    doc.querySelectorAll('img[src]').forEach(el => {
      const cur = el.getAttribute('src'); if (!cur) return;
      el.setAttribute('src', v(fixUrl(cur)));
    });
    doc.querySelectorAll('img[srcset], source[srcset]').forEach(el => {
      const cur = el.getAttribute('srcset'); if (!cur) return;
      const out = cur.split(',').map(part => {
        const [u, d] = part.trim().split(/\s+/, 2);
        if (!u) return part;
        const fixed = v(fixUrl(u));
        return d ? `${fixed} ${d}` : fixed;
      }).join(', ');
      el.setAttribute('srcset', out);
    });
    doc.querySelectorAll('link[href]').forEach(el => {
      const cur = el.getAttribute('href'); if (!cur) return;
      if (!isAbs(cur)) el.setAttribute('href', joinBase(cur));
    });
    doc.querySelectorAll('script[src]').forEach(el => el.remove());
    doc.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href'); if (!href) return;
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
      </div>
      <div class="db-detail">${bodyHTML}</div>
    `;

    el.querySelectorAll('.db-detail img[src]').forEach(img => {
      img.setAttribute('src', v(img.getAttribute('src')));
    });
    el.querySelectorAll('.db-detail img[srcset], .db-detail source[srcset]').forEach(node => {
      const cur = node.getAttribute('srcset'); if (!cur) return;
      const out = cur.split(',').map(part => {
        const [u, d] = part.trim().split(/\s+/, 2);
        if (!u) return part;
        const fixed = v(u);
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

  // ---------- 라우트 생성 ----------
  const routes = window.buildRoutes({
    loadHTML,
    loadScriptOnce,
    renderDbDetail,
    iconImg,
    catCard
  });

  function setActive(path) {
    const tab = path === '/db' ? '/database'
             : path === '/hero' ? '/heroes'
             : path === '/building' ? '/buildings'
             : path;
    document.querySelectorAll('[data-nav]').forEach(a => {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + tab);
    });
  }

  const pingAutoAds = (() => {
    let t;
    return () => {
      clearTimeout(t);
      t = setTimeout(() => {
        try {
          const fresh = document.querySelectorAll('ins.adsbygoogle:not([data-adsbygoogle-status])');
          if (!fresh.length) return;
          fresh.forEach(() => (window.adsbygoogle = window.adsbygoogle || []).push({}));
        } catch (_) {}
      }, 150);
    };
  })();

  let navVer = 0;

  // ===== i18n helpers =====
  async function ensureI18N() {
    if (!window.I18N) return;
    const saved = localStorage.getItem('lang');
    const urlLang = new URLSearchParams(location.search).get('lang');
    const fallback = (navigator.language || 'ko').replace('_','-');
    const lang = urlLang || saved || fallback;

    if (window.__APP_LANG && window.__APP_LANG !== lang) {
      location.reload();
      return;
    }

    if (!I18N.current || typeof I18N.t !== 'function') {
      await I18N.init({ lang, namespaces: ['common'] });
    }
    window.__APP_LANG = lang;
  }

  // ===== Router =====
  async function navigate(path) {
    const myVer = ++navVer;
    const el = document.getElementById('content');
    const route = routes[path] || routes['/home'];

    document.title = route.title;
    setActive(path);

    const isCalc = (path === '/calculator' || path.startsWith('/calc-'));
    if (isCalc) {
      await ensureCSS('calc-css', CALC_CSS_HREF);
    } else {
      removeCSS('calc-css');
    }

    if (window.I18N) {
      try {
        await ensureI18N();
        if (isCalc) {
          if (typeof I18N.loadNamespace === 'function') {
            await I18N.loadNamespace('calc');
          } else if (typeof I18N.loadNS === 'function') {
            await I18N.loadNS(['common', 'calc']);
          }
        }
      } catch (_) {}
    }

    const rest = location.hash.replace('#' + path, '').replace(/^#?\/?/, '');
    await route.render(el, rest);

    if (isCalc) {
      try {
        if (typeof window.initCalculator !== 'function') {
          await loadScriptOnce(v('/js/calculator.js'));
        }
        if (!window.KSD?.buildingUI?.boot) {
          await loadScriptOnce(v('/js/building-calculator.js'));
        }
        await window.KSD?.buildingUI?.boot?.(el);
      } catch (e) {
        console.warn('[calc] bootstrap failed:', e);
      }
    }

    if (myVer !== navVer) return;

    if (nav && toggle) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    if (window.I18N) {
      try {
        if (isCalc) {
          const metaTitle = I18N.t('calc.meta.title', '건물 계산기 | KingshotData KR');
          document.title = metaTitle;
        }
        I18N.applyTo(el);
      } catch (_) {}
    }

    pingAutoAds();
  }

  function parseHash() {
    let raw = (location.hash || '#/home').slice(1);
    raw = raw.replace(/^\/+/, '');
    if (raw.startsWith('building/')) {
      return ['/buildings', raw.replace(/^building\//, '')];
    }
    if (raw === 'building') return ['/buildings', ''];
    const parts = raw.split('/');
    const path  = '/' + (parts[0] || 'home');
    const rest  = parts.slice(1).join('/');
    return [path, rest];
  }

  window.addEventListener('hashchange', () => {
    const [path] = parseHash();
    navigate(path);
    pingAutoAds();
  });

  window.addEventListener('ksd:lang-changed', () => {
    location.reload();
  });

  window.addEventListener('DOMContentLoaded', async () => {
    await ensureCSS('components-css', COMPONENTS_CSS_HREF);
    if (window.I18N) {
      try {
        await ensureI18N();
      } catch (_) {}
    }

    const calcCard = document.querySelector('#calc-card');
    if (calcCard) {
      ['mouseenter', 'touchstart'].forEach(ev => {
        calcCard.addEventListener(ev, async () => {
          if (window.I18N && !window.I18N.has('calc')) {
            try {
              await I18N.preload(['calc', 'calcGear']);
            } catch (e) {
              console.warn('[i18n] preload failed', e);
            }
          }
        }, { once: true });
      });
    }

    const [path] = parseHash();
    await navigate(path);
    pingAutoAds();
  });

})();

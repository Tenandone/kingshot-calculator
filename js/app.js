// js/app.js — SPA Router for KingshotData.kr
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  // ===== Asset version (캐시 무효화) =====
  const ASSET_VER = 'now';
  function v(url){
    if (!url) return url;
    if (/^(data:|blob:|#)/i.test(url)) return url;
    return url + (url.includes('?') ? '&' : '?') + 'v=' + ASSET_VER;
  }

  // ✅ CSS 경로
  const CALC_CSS_HREF = '/css/calculator.css?v=now';
  const COMPONENTS_CSS_HREF = '/css/components.css?v=now';

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
      link.href = href;
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
             : path === '/building' ? '/buildings'
             : path;
    document.querySelectorAll('[data-nav]').forEach(a => {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + tab);
    });
  }

  // ---- AdSense: 새로 삽입된 슬롯만 초기화 ----
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
  // NOTE: 언어 변경 감지 → 전체 초기화(페이지 리로드) 전략
  async function ensureI18N() {
    if (!window.I18N) return;
    const saved = localStorage.getItem('lang');
    const urlLang = new URLSearchParams(location.search).get('lang');
    const fallback = (navigator.language || 'ko').replace('_','-');
    const lang = urlLang || saved || fallback;

    // 이미 초기화되어 있고, 언어가 바뀌었다면 전체 리로드
    if (window.__APP_LANG && window.__APP_LANG !== lang) {
      // 선택: 필요하면 여기에서 계산기/임시 상태 localStorage 정리도 가능
      // localStorage.removeItem('KSD_CALC_STATE'); 등…
      location.reload();           // ← 전체 초기화 원샷
      return;
    }

    if (!I18N.current || typeof I18N.t !== 'function') {
      await I18N.init({ lang, namespaces: ['common'] });
    }
    window.__APP_LANG = lang;      // 현재 사용 언어 기록
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
      await ensureCSS('calc-css', v(CALC_CSS_HREF));
    } else {
      removeCSS('calc-css');
    }

    
    // i18n: 렌더 전
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

    // 계산기 부트
    if (isCalc) {
      try {
        if (typeof window.initCalculator !== 'function') {
          await loadScriptOnce('/js/calculator.js?v=now');           // core
        }
        if (!window.KSD?.buildingUI?.boot) {
          await loadScriptOnce('/js/building-calculator.js?v=now');  // UI
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

    // i18n: 렌더 후
    if (window.I18N) {
      try {
        if (isCalc) {
          const metaTitle = I18N.t('calc.meta.title', '건물 계산기 | KingshotData KR');
          document.title = metaTitle;
        }
        I18N.applyTo(el);
      } catch (_) {}
    }

    // 광고 트리거
    pingAutoAds();
  }

  function parseHash() {
    let raw = (location.hash || '#/home').slice(1);
    raw = raw.replace(/^\/+/, '');
    // 건물 카드 전용 라우팅: /buildings 네임스페이스로 연결
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

  // 언어 변경(동일 탭 내) 트리거를 위한 헬퍼:
  // 네가 언어 스위치 버튼에서 localStorage.setItem('lang', nextLang) 하고 아래 이벤트를 디스패치하면
  // ensureI18N에서 감지 → 전체 리로드됨.
  window.addEventListener('ksd:lang-changed', () => {
    // 강제 리로드 (동일 탭 내에서도 확실히 초기화)
    location.reload();
  });

  // 초기 부트
  window.addEventListener('DOMContentLoaded', async () => {
    await ensureCSS('components-css', v(COMPONENTS_CSS_HREF));
    if (window.I18N) { try { await ensureI18N(); } catch (_) {} }
    const [path] = parseHash();
    await navigate(path);
    pingAutoAds();
  });
})();

// ---- dynamic loader utils (중복 로드 방지) ----
(function () {
  const seenCSS = new Set();
  const seenJS  = new Set();

  const ASSET_VER = window.__V || 'now';
  function v(url) {
    if (!url) return url;
    if (/^(data:|blob:|#)/i.test(url)) return url;
    return url + (url.includes('?') ? '&' : '?') + 'v=' + ASSET_VER;
  }
  window.v = window.v || v;

  window.ensureCSS = window.ensureCSS || function (href) {
    const base = href.split('?')[0];
    if (seenCSS.has(base) || document.querySelector(`link[rel="stylesheet"][href^="${base}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = v(href);
    document.head.appendChild(l);
    seenCSS.add(base);
  };

  window.ensureScript = window.ensureScript || function (src) {
    const base = src.split('?')[0];
    if (seenJS.has(base) || document.querySelector(`script[src^="${base}"]`)) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = v(src);
      s.defer = true;
      s.onload = () => { seenJS.add(base); res(); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
  };
})();

// js/routes.js (코어 라우트 + 계산기 라우트 lazy-load 프록시)
(function () {
  'use strict';

  window.buildRoutes = function ({ loadHTML, loadScriptOnce, renderDbDetail, iconImg /*, catCard*/ }) {

    // ---------- i18n helpers ----------
    const apply = (root) => window.I18N?.applyTo?.(root || document);
    const t = (key, fb) => (window.I18N?.t ? I18N.t(key, fb ?? key) : (fb ?? key));
    const setTitle = (key, fb) => { document.title = t(key, fb); };

    // 언어 감지 + i18n 준비(계산기 라우트에서 사용)
    function detectLang() {
      const raw = (localStorage.getItem('lang') || navigator.language || 'ko')
        .replace('_','-').toLowerCase();
      if (raw.startsWith('ko')) return 'ko';
      if (raw.startsWith('en')) return 'en';
      if (raw.startsWith('ja')) return 'ja';
      if (raw.startsWith('zh-tw')) return 'zh-TW';
      if (raw.startsWith('zh')) return 'zh-CN';
      return 'ko';
    }
    async function ensureI18NReady() {
      const lang = detectLang();
      if (!window.I18N?.t || I18N.current !== lang) {
        await I18N.init({ lang });
      }
    }

    // 기어 계산기 티어 라벨 i18n 키 매핑 (KO 라벨 → i18n key)
const TIER_KEY_MAP_KO = {
  // 고급
  '고급': 'calcGear.tiers.basic',
  '고급 (1성)': 'calcGear.tiers.basic_1',

  // 레어
  '레어': 'calcGear.tiers.rare',
  '레어 (1성)': 'calcGear.tiers.rare_1',
  '레어 (2성)': 'calcGear.tiers.rare_2',
  '레어 (3성)': 'calcGear.tiers.rare_3',

  // 에픽
  '에픽': 'calcGear.tiers.epic',
  '에픽 (1성)': 'calcGear.tiers.epic_1',
  '에픽 (2성)': 'calcGear.tiers.epic_2',
  '에픽 (3성)': 'calcGear.tiers.epic_3',

  // 에픽 T1
  '에픽 T1': 'calcGear.tiers.epicT1',
  '에픽 T1 (1성)': 'calcGear.tiers.epicT1_1',
  '에픽 T1 (2성)': 'calcGear.tiers.epicT1_2',
  '에픽 T1 (3성)': 'calcGear.tiers.epicT1_3',

  // 레전드
  '레전드': 'calcGear.tiers.legendary',
  '레전드 (1성)': 'calcGear.tiers.legendary_1',
  '레전드 (2성)': 'calcGear.tiers.legendary_2',
  '레전드 (3성)': 'calcGear.tiers.legendary_3',

  // 레전드 T1
  '레전드 T1': 'calcGear.tiers.legendT1',
  '레전드 T1 (1성)': 'calcGear.tiers.legendT1_1',
  '레전드 T1 (2성)': 'calcGear.tiers.legendT1_2',
  '레전드 T1 (3성)': 'calcGear.tiers.legendT1_3',

  // 레전드 T2
  '레전드 T2': 'calcGear.tiers.legendT2',
  '레전드 T2 (1성)': 'calcGear.tiers.legendT2_1',
  '레전드 T2 (2성)': 'calcGear.tiers.legendT2_2',
  '레전드 T2 (3성)': 'calcGear.tiers.legendT2_3',

  // 레전드 T3
  '레전드 T3': 'calcGear.tiers.legendT3',
  '레전드 T3 (1성)': 'calcGear.tiers.legendT3_1',
  '레전드 T3 (2성)': 'calcGear.tiers.legendT3_2',
  '레전드 T3 (3성)': 'calcGear.tiers.legendT3_3',

  // 신화
  '신화': 'calcGear.tiers.mythic',
  '신화 (1성)': 'calcGear.tiers.mythic_1',
  '신화 (2성)': 'calcGear.tiers.mythic_2',
  '신화 (3성)': 'calcGear.tiers.mythic_3',

  // 신화 T1
  '신화 T1': 'calcGear.tiers.mythicT1',
  '신화 T1 (1성)': 'calcGear.tiers.mythicT1_1',
  '신화 T1 (2성)': 'calcGear.tiers.mythicT1_2',
  '신화 T1 (3성)': 'calcGear.tiers.mythicT1_3',

  // 신화 T2
  '신화 T2': 'calcGear.tiers.mythicT2',
  '신화 T2 (1성)': 'calcGear.tiers.mythicT2_1',
  '신화 T2 (2성)': 'calcGear.tiers.mythicT2_2',
  '신화 T2 (3성)': 'calcGear.tiers.mythicT2_3',

  // 신화 T3
  '신화 T3': 'calcGear.tiers.mythicT3',
  '신화 T3 (1성)': 'calcGear.tiers.mythicT3_1',
  '신화 T3 (2성)': 'calcGear.tiers.mythicT3_2',
  '신화 T3 (3성)': 'calcGear.tiers.mythicT3_3',

  // 신화 T4
  '신화 T4': 'calcGear.tiers.mythicT4',
  '신화 T4 (1성)': 'calcGear.tiers.mythicT4_1',
  '신화 T4 (2성)': 'calcGear.tiers.mythicT4_2',
  '신화 T4 (3성)': 'calcGear.tiers.mythicT4_3'
};


    // 홈 카드: 언어 변경 시 즉시 갱신 (1회 바인딩)
    if (!window.__i18nHomeBound) {
      document.addEventListener('i18n:changed', () => {
        if (!location.hash || location.hash.startsWith('#/home')) {
          const content = document.getElementById('content');
          if (content) apply(content);
          setTitle('title.home', '홈 - KingshotData.kr');
        }
      });
      window.__i18nHomeBound = true;
    }

    // 화살표(뒤로가기) 공통 처리
    if (!window.__smartBackBound) {
      document.addEventListener('click', (e) => {
        const a = e.target.closest('a[data-smart-back]');
        if (!a) return;
        e.preventDefault();
        if (history.length > 1) history.back();
        else location.hash = a.getAttribute('data-smart-back') || '#/';
      });
      window.__smartBackBound = true;
    }

    function removeLegacyDbBack(el){
      ['a.btn-back','[data-i18n-key="database.detail.back"]','a[href="/database"]']
        .forEach(sel => el.querySelectorAll(sel).forEach(a => { if (!a.hasAttribute('data-smart-back')) a.remove(); }));
    }

    function setTitleFromPage(el){
      const metaKey = el.querySelector('meta[name="db-title"]')?.content?.trim();
      if (metaKey) { setTitle(metaKey, (window.I18N?.t?.(metaKey)) || document.title); return; }
      const h1 = el.querySelector('h1[data-i18n]');
      if (h1) {
        const k = h1.getAttribute('data-i18n');
        setTitle(k, (window.I18N?.t?.(k)) || h1.textContent || 'KingshotData.kr');
      }
    }

    // ===== 코어 라우트 정의 =====
    const routes = {
      '/home': {
        title: '홈 - KingshotData.kr',
        render: async (el) => {
          const cards = [
            { href:'#/buildings',  img:'/img/home/saulchar.png',   t:'home.card.buildings.title',   d:'home.card.buildings.desc' },
            { href:'#/heroes',     img:'/img/home/helgachar.png',  t:'home.card.heroes.title',      d:'home.card.heroes.desc' },
            { href:'#/database',   img:'/img/home/database.png',   t:'home.card.database.title',    d:'home.card.database.desc' },
            { href:'#/guides',     img:'/img/home/guides.png',     t:'home.card.guides.title',      d:'home.card.guides.desc' },
            { href:'#/calculator', img:'/img/home/calculator.png', t:'home.card.calculators.title', d:'home.card.calculators.desc' },
            { href:'#/about',      img:'/img/home/about.png',      t:'nav.about',                   d:'home.card.about.desc' }
          ];
          el.innerHTML = `
            <div class="home-container">
              <section class="home-categories">
                <h2 class="section-title" data-i18n="home.categoriesTitle">${t('home.categoriesTitle','카테고리')}</h2>
                <div class="grid category-grid">
                  ${cards.map(c => `
                    <a class="card card--category" href="${c.href}">
                      <div class="card__media" aria-hidden="true">
                        ${iconImg(t(c.t), c.img)}
                      </div>
                      <div class="card__body">
                        <div class="card__title" data-i18n="${c.t}">${t(c.t)}</div>
                        <div class="card__subtitle" data-i18n="${c.d}">${t(c.d)}</div>
                      </div>
                    </a>
                  `).join('')}
                </div>
              </section>
            </div>
          `;
          apply(el);
          setTitle('title.home', '홈 - KingshotData.kr');
          window.scrollTo({ top: 0 });
        }
      },

      '/buildings': {
        title: '건물 - KingshotData.kr',
        render: async (el) => {
          try { await window.I18N?.loadNamespace?.('buildings'); } catch(_) {}
          el.innerHTML = [
            '<div id="buildings-grid" class="grid"></div>',
            '<div id="building-root"></div>'
          ].join('');
          const candidates = [ v('js/pages/buildings.js'), v('/js/pages/buildings.js') ];
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
          setTitle('title.buildings', '건물 - KingshotData.kr');
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

          const jsCands = [ v('js/pages/heroes.js'), v('/js/pages/heroes.js') ];
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
          setTitle('title.heroes', '영웅 - KingshotData.kr');
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
                <h1 class="page-title" id="hero-title"
                    data-i18n-key="heroes.detail.title"
                    data-i18n-fallback="영웅 상세"></h1>
                <a class="btn btn-icon" href="/heroes"
                   data-smart-back="#/heroes" aria-label="Back" title="Back">←</a>
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
              .hero-section .skill img{ display:block; margin-inline:auto; float:none; }
              .hero-section .skills-row{ display:flex; justify-content:center; gap:12px; flex-wrap:wrap; }
              .hero-section .skills-grid{ display:grid; place-items:center; gap:12px; }
            </style>
          `;
          apply(el);

          const jsCands = [ v('js/pages/hero.js'), v('/js/pages/hero.js') ];
          let ok=false;
          for (const src of jsCands){
            try { await loadScriptOnce(src); ok=true; break; } catch(_){}
          }
          if (!ok){
            el.insertAdjacentHTML('beforeend','<div class="error">hero.js 로드 실패</div>');
            return;
          }
          if (typeof window.initHero === 'function'){
            try { await window.initHero(slug); } catch(e){ console.error(e); }
          } else {
            el.insertAdjacentHTML('beforeend','<div class="error">initHero()가 없습니다。</div>');
          }
          apply(el);

          if (!window.__heroI18NReapplyBound) {
            document.addEventListener('i18n:changed', () => apply(el));
            window.__heroI18NReapplyBound = true;
          }
          const setHeroTitle = () => setTitle('heroes.detail.pageTitle','영웅 상세 - KingshotData.kr');
          setHeroTitle();
          if (!window.__heroTitleBound) {
            document.addEventListener('i18n:changed', setHeroTitle);
            window.__heroTitleBound = true;
          }
          window.scrollTo({ top: 0 });
        }
      },

      '/guides': {
        title: '가이드 - KingshotData.kr',
        render: async (el) => {
          el.innerHTML = '<div class="loading">Loading…</div>';
          if (window.I18N?.loadNamespace) {
            try { await I18N.loadNamespace('guides'); } catch (_) {}
          }
          const html = await loadHTML(['pages/guides.html', '/pages/guides.html', '/pages/guide.html']);
          const bodyOnly = html ? (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html) : null;
          el.innerHTML = bodyOnly || '<div class="placeholder"><h2>가이드</h2><p class="muted">guides.html을 찾을 수 없습니다.</p></div>';

          await ensureCSS('/css/guides.css');
          await ensureScript('/js/guides.js');

          if (window.I18N?.applyTo) I18N.applyTo(el);
          if (window.GUIDES_apply) await window.GUIDES_apply(el);
          setTitle('guides.title', '가이드 - KingshotData.kr');
          window.scrollTo({ top: 0 });
        }
      },

     '/database': {
  title: '데이터베이스 - KingshotData.kr',
  render: async (el) => {
    el.innerHTML = '<div class="loading">Loading…</div>';

    const html = await loadHTML([
      'pages/database.html',
      '/pages/database.html',
      'database.html',
      '/database.html'
    ]);

    if (!html) {
      el.innerHTML = '<div class="placeholder"><h2>데이터베이스</h2><p class="muted">database.html을 찾을 수 없습니다.</p></div>';
      return;
    }

    const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    el.innerHTML = m ? m[1] : html;

    const jsCands = [ v('js/pages/database.js'), v('/js/pages/database.js') ];
    let loadedAny = false;
    for (const src of jsCands) {
      try { await loadScriptOnce(src); loadedAny = true; break; } catch (_) {}
    }
    if (!loadedAny) {
      el.insertAdjacentHTML('beforeend','<div class="error">database.js 로드 실패</div>');
      return;
    }

    if (typeof window.initDatabase === 'function') {
      try { await window.initDatabase(); } catch (e) { console.error(e); }
    } else {
      el.insertAdjacentHTML('beforeend','<div class="error">initDatabase()가 없습니다。</div>');
    }

    setTitle('title.database', '데이터베이스 - KingshotData.kr');
    if (window.I18N?.applyTo) I18N.applyTo(el);
    window.scrollTo({ top: 0 });
  }
},

'/db': {
  title: 'KingshotData.kr',
  render: async (el, rest) => {
    const parts  = (rest || '').split('/').filter(Boolean);
    const folderRaw = parts[0] ? decodeURIComponent(parts[0]) : '';
    const file   = parts[1] ? decodeURIComponent(parts.slice(1).join('/')) : '';
    if (!folderRaw) { location.hash = '#/database'; return; }

    // ✅ 전용무기 상세는 widgets로 리맵해서 로드 (URL은 그대로 두고 내부 로딩만 변경)
    const folder = (folderRaw === 'hero-exclusive-gear') ? 'widgets' : folderRaw;

    // 네임스페이스 로드 확실히 대기 (기존 로직 유지)
    if (window.I18N?.init) {
      try { await I18N.init({ namespaces: ['db'] }); } catch (e) { console.debug('[i18n] init skipped', e); }
    } else {
      try { await window.I18N?.loadNamespaces?.(['db']); } catch (e) { console.debug('[i18n] loadNamespaces skipped', e); }
    }

    await renderDbDetail(el, folder, file);
    removeLegacyDbBack(el);

    el.insertAdjacentHTML('afterbegin', `
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
        <a class="btn btn-icon" href="/database"
           data-smart-back="#/database" aria-label="Back" title="Back">←</a>
      </div>
    `);

    el.querySelectorAll('h1[data-i18n="title.database"]').forEach(n => n.remove());

    if (window.I18N?.applyTo) I18N.applyTo(el);
    setTitleFromPage(el);
    window.scrollTo({ top: 0 });
  }
},



      '/privacy': {
        title: '개인정보처리방침 - KingshotData.kr',
        render: async (el) => {
          el.innerHTML = '<div class="loading">Loading…</div>';
          const html = await loadHTML(['pages/privacy.html','/pages/privacy.html','privacy.html','/privacy.html']);
          el.innerHTML = html
            ? (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html)
            : '<div class="placeholder"><h2>개인정보처리방침</h2><p class="muted">privacy.html을 찾을 수 없습니다.</p></div>';
          setTitle('title.privacy', '개인정보처리방침 - KingshotData.kr');
          window.scrollTo({ top: 0 });
        }
      },

      '/about': {
        title: '소개 - KingshotData.kr',
        render: async (el) => {
          el.innerHTML = '<div class="loading">Loading…</div>';
          const html = await loadHTML(['pages/about.html','/pages/about.html','about.html','/about.html']);
          el.innerHTML = html
            ? (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html)
            : '<div class="placeholder"><h2>소개</h2><p class="muted">about.html을 찾을 수 없습니다.</p></div>';
          setTitle('title.about', '소개 - KingshotData.kr');
          window.scrollTo({ top: 0 });
        }
      }
    };

     // ===== 계산기 라우트 지연 로딩 설정 =====
    let calcLoadPromise = null;

    async function ensureCalcRoutes() {
      if (routes.__calcMerged) return;

      if (!calcLoadPromise) {
        calcLoadPromise = (async () => {
          try {
  await ensureScript('/js/routes.calculators.js'); // v()가 내부에서 자동으로 ?v=__V 붙임
} catch (e) {
  console.error('[calc routes] load failed:', e);
  return;
}

          // buildCalculatorRoutes가 정의될 때까지 대기 (최대 2초)
          let waited = 0;
          while (typeof window.buildCalculatorRoutes !== 'function' && waited < 2000) {
            await new Promise(r => setTimeout(r, 50));
            waited += 50;
          }

          if (typeof window.buildCalculatorRoutes !== 'function') {
            console.error('buildCalculatorRoutes not defined after load');
            return;
          }

          const more = window.buildCalculatorRoutes({
            loadHTML, loadScriptOnce, iconImg,
            apply, t, setTitle,
            ensureI18NReady, TIER_KEY_MAP_KO
          });
          Object.assign(routes, more);
          routes.__calcMerged = true;
        })();
      }
      return calcLoadPromise;
    }

    function lazyCalcRoute(name, fallbackTitle){
      return {
        title: fallbackTitle || '계산기 - KingshotData.kr',
        render: async (el, rest) => {
          await ensureCalcRoutes();
          const real = routes[name];
          if (!real?.render) {
            el.innerHTML = '<div class="placeholder"><h2>로딩 실패</h2><p class="muted">계산기 모듈을 불러오지 못했습니다.</p></div>';
            return;
          }
          return real.render(el, rest);
        }
      };
    }

    // 프록시 라우트 등록
    routes['/calculator']     = lazyCalcRoute('/calculator', '계산기 - KingshotData.kr');
    routes['/calc-building']  = lazyCalcRoute('/calc-building', '건물계산기 - KingshotData.kr');
    routes['/calc-gear']      = lazyCalcRoute('/calc-gear', '영주장비계산기 - KingshotData.kr');
    routes['/calc-charm']     = lazyCalcRoute('/calc-charm', '영주보석계산기 - KingshotData.kr');
    routes['/calc-training']  = lazyCalcRoute('/calc-training', '병력 훈련/승급 계산기 - KingshotData.kr');
    routes['/calc-vip']       = lazyCalcRoute('/calc-vip', 'VIP 포인트 계산기 - KingshotData.kr');

    return routes;
  };
})();

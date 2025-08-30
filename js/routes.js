// ---- dynamic loader utils (중복 로드 방지) ----
(function () {
  const seenCSS = new Set();
  const seenJS  = new Set();

  window.ensureCSS = window.ensureCSS || function (href) {
    const base = href.split('?')[0];
    if (seenCSS.has(base) || document.querySelector(`link[rel="stylesheet"][href^="${base}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
    seenCSS.add(base);
  };

  window.ensureScript = window.ensureScript || function (src) {
    const base = src.split('?')[0];
    if (seenJS.has(base) || document.querySelector(`script[src^="${base}"]`)) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src + (src.includes('?') ? '' : `?v=now`);
      s.defer = true;
      s.onload = () => { seenJS.add(base); res(); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
  };
})();

// js/routes.js
(function () {
  'use strict';

  window.buildRoutes = function ({ loadHTML, loadScriptOnce, renderDbDetail, iconImg /*, catCard*/ }) {

    // ---------- i18n helpers ----------
    const apply = (root) => window.I18N?.applyTo?.(root || document);
    const t = (key, fb) => (window.I18N?.t ? I18N.t(key, fb ?? key) : (fb ?? key));
    const setTitle = (key, fb) => { document.title = t(key, fb); };

    /* ✅ 추가: 한국어 라벨 → i18n 키 매핑 (데이터 라벨이 ko일 때 공통 사용) */
const TIER_KEY_MAP_KO = {
  '고급': 'calcGear.tiers.basic',
  '희귀': 'calcGear.tiers.rare',
  '영웅': 'calcGear.tiers.epic',
  '전설': 'calcGear.tiers.legendary',
  '신화': 'calcGear.tiers.mythic',
  '신화 T1 (1성)': 'calcGear.tiers.mythicT1_1',
  '신화 T1 (2성)': 'calcGear.tiers.mythicT1_2',
  '신화 T1 (3성)': 'calcGear.tiers.mythicT1_3',
  '신화 T2 (1성)': 'calcGear.tiers.mythicT2_1',
  '신화 T2 (2성)': 'calcGear.tiers.mythicT2_2',
  '신화 T2 (3성)': 'calcGear.tiers.mythicT2_3',
  '신화 T3 (1성)': 'calcGear.tiers.mythicT3_1',
  '신화 T3 (2성)': 'calcGear.tiers.mythicT3_2',
  '신화 T3 (3성)': 'calcGear.tiers.mythicT3_3',
  '신화 T4 (1성)': 'calcGear.tiers.mythicT4_1',
  '신화 T4 (2성)': 'calcGear.tiers.mythicT4_2',
  '신화 T4 (3성)': 'calcGear.tiers.mythicT4_3'
};


/* ✅ 추가: 언어 감지 + i18n 준비 */
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
  if (!window.I18N?.t || window.__i18nLang !== lang) {
    await window.I18N?.init?.({ lang });
    window.__i18nLang = lang;
  }
}// 홈 카드: 언어 변경 시 즉시 갱신 (1회 바인딩)
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
      ['a.btn-back','[data-i18n-key="database.detail.back"]','a[href="#/database"]']
        .forEach(sel => el.querySelectorAll(sel).forEach(a => { if (!a.hasAttribute('data-smart-back')) a.remove(); }));
    }

    function setTitleFromPage(el){
      const metaKey = el.querySelector('meta[name="db-title"]')?.content?.trim();
      if (metaKey) { setTitle(metaKey, (window.I18N?.t?.(metaKey)) || document.title); return; }
      const h1 = el.querySelector('h1[data-i18n]');
      if (h1) { const k = h1.getAttribute('data-i18n'); setTitle(k, (window.I18N?.t?.(k)) || h1.textContent || 'KingshotData.kr'); }
    }

    return {
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

          const candidates = ['js/pages/buildings.js?v=now','/js/pages/buildings.js?v=now'];
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

          const jsCands = ['js/pages/heroes.js?v=now','/js/pages/heroes.js?v=now'];
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
                <a class="btn btn-icon" href="#/heroes"
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

          const jsCands = ['js/pages/hero.js?v=now','/js/pages/hero.js?v=now'];
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

          // 1) i18n 네임스페이스 보장
          if (window.I18N?.loadNamespace) {
            try { await I18N.loadNamespace('guides'); } catch (_) {}
          }

          // 2) guides.html 로드 (구 경로 호환 포함)
          const html = await loadHTML(['pages/guides.html', '/pages/guides.html', '/pages/guide.html']);

          // 3) body만 추출/주입
          const bodyOnly = html ? (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html) : null;
          el.innerHTML = bodyOnly || '<div class="placeholder"><h2>가이드</h2><p class="muted">guides.html을 찾을 수 없습니다.</p></div>';

          // 4) 전용 CSS/JS 보장
          await ensureCSS('/css/guides.css?v=now');
          await ensureScript('/js/guides.js?v=now');

          // 5) 번역 적용 + include/TOC/검색 재실행
          if (window.I18N?.applyTo) I18N.applyTo(el);
          if (window.GUIDES_apply) await window.GUIDES_apply(el);

          setTitle('guides.title', '가이드 - KingshotData.kr');
          window.scrollTo({ top: 0 });
        }
      },

      // ================= Database (목록/상세) =================
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

          const jsCands = ['js/pages/database.js?v=now','/js/pages/database.js?v=now'];
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
            el.insertAdjacentHTML('beforeend','<div class="error">initDatabase()가 없습니다。</div>');
          }

          setTitle('title.database', '데이터베이스 - KingshotData.kr');
          apply(el);
          window.scrollTo({ top: 0 });
        }
      },

      '/db': {
        title: 'KingshotData.kr',
        render: async (el, rest) => {
          const parts = (rest || '').split('/').filter(Boolean);
          const folder = parts[0] ? decodeURIComponent(parts[0]) : '';
          const file   = parts[1] ? decodeURIComponent(parts.slice(1).join('/')) : '';
          if (!folder) { location.hash = '#/database'; return; }

          try { await window.I18N?.loadNamespace?.('db'); } catch(_) {}

          await renderDbDetail(el, folder, file);
          removeLegacyDbBack(el);

          el.insertAdjacentHTML('afterbegin', `
            <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
              <a class="btn btn-icon" href="#/database"
                 data-smart-back="#/database" aria-label="Back" title="Back">←</a>
            </div>
          `);

          el.querySelectorAll('h1[data-i18n="title.database"]').forEach(n => n.remove());

          apply(el);
          setTitleFromPage(el);
          window.scrollTo({ top: 0 });
        }
      },

      // ====== 계산기들 ======
      '/calculator': {
        title: '계산기 - KingshotData.kr',
        render: async (el) => {
          el.innerHTML = '<div class="loading">Loading…</div>';
          const html = await loadHTML(['pages/calculator.html','/pages/calculator.html','calculator.html','/calculator.html']);
          el.innerHTML = html
            ? (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html)
            : '<div class="placeholder"><h2>계산기</h2><p class="muted">calculator.html을 찾을 수 없습니다.</p></div>';

          setTitle('title.calculators', '계산기 - KingshotData.kr');
          window.scrollTo({ top: 0 });
        }
      },

      '/calc-building': {
        title: '건물계산기 - KingshotData.kr',
        render: async (el) => {
          const html = await loadHTML(['/pages/calculators/building.html','pages/calculators/building.html']);
          el.innerHTML = html
            ? (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html)
            : '<div class="placeholder"><h2>건물계산기</h2><p class="muted">building.html을 찾을 수 없습니다.</p></div>';

          const jsCands = ['/js/calculator.js?v=now','js/calculator.js?v=now'];
          for (const src of jsCands) { try { await loadScriptOnce(src); break; } catch(_) {} }
          if (typeof window.initCalculator === 'function') { try { window.initCalculator(); } catch(e){ console.error(e); } }

          setTitle('title.calcBuilding', '건물계산기 - KingshotData.kr');
          window.scrollTo({ top: 0 });
        }
      },

      '/calc-gear': {
  title: '영주장비계산기 - KingshotData.kr',
  render: async (el) => {
    const html = await loadHTML(['/pages/calculators/gear.html','pages/calculators/gear.html']);
    el.innerHTML = html
      ? (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html)
      : '<div class="placeholder"><h2>영주장비계산기</h2><p class="muted">gear.html을 찾을 수 없습니다.</p></div>';

    /* ✅ i18n 초기화가 반드시 먼저 */
    await ensureI18NReady();
    /* ✅ calcGear 네임스페이스 로드(언어팩이 분리된 경우 대비) */
    try { await I18N.loadNamespace?.('calcGear'); } catch (_) {}
    /* ✅ 정적 라벨 전역 적용 (stale el 방지) */
    apply(document);

    // ▼▼▼ 언어 전환 핸들러(1회 바인딩) ▼▼▼
    if (!window.__gearLangBound) {
      window.__gearLangBound = true;
      document.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-lang]');
        if (!btn) return;
        const raw = btn.getAttribute('data-lang'); // 'ko' | 'en' | 'ja' | 'cn' | 'tw'
        const newLang = raw === 'cn' ? 'zh-CN' : raw === 'tw' ? 'zh-TW' : raw;

        await I18N.init(newLang);      // 1) 언어팩 로드 완료까지 대기
        try { await I18N.loadNamespace?.('calcGear'); } catch (_) {}
        apply(document);                // 2) data-i18n 전역 갱신
        window.reapplyGearCalculatorI18N?.(); // 3) 동적 라벨/옵션/결과 재적용(+자동 재계산)
      });
    }
    // ▲▲▲ 여기까지 ▲▲▲

    await loadScriptOnce('/js/gear-calculator.js?v=now');
    if (!window.initGearCalculator) {
      el.insertAdjacentHTML('beforeend','<div class="error">gear-calculator.js 로드 실패</div>');
      return;
    }

    /* ✅ 티어 라벨 i18n 키 매핑 전달 (calcGear.*로 통일) */
    window.initGearCalculator({
      mount: '#gear-calc',
      jsonUrl: '/data/governor-gear.json',
      tierKeyMap: TIER_KEY_MAP_KO
    });

    setTitle('title.calcGear', '영주장비계산기 - KingshotData.kr');
    window.scrollTo({ top: 0 });
  }
},



      '/calc-charm': {
        title: '영주보석계산기 - KingshotData.kr',
        render: async (el) => {
          const html = await loadHTML(['/pages/calculators/charm.html','pages/calculators/charm.html']);
          el.innerHTML = html
            ? (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html)
            : '<div class="placeholder"><h2>영주보석계산기</h2><p class="muted">charm.html을 찾을 수 없습니다.</p></div>';

          await loadScriptOnce('/js/charm-calculator.js?v=now');
          if (window.initCharmCalculator) {
            window.initCharmCalculator({ mount: '#charm-calc', jsonUrl: '/data/governor-charm.json' });
          }

          setTitle('title.calcCharm', '영주보석계산기 - KingshotData.kr');
          window.scrollTo({ top: 0 });
        }
      },

      '/calc-training': {
        title: '병력 훈련/승급 계산기 - KingshotData.kr',
        render: async (el) => {
          if (!document.querySelector('link[rel="stylesheet"][href="/css/kingshot_calc.css?v=now"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/kingshot_calc.css?v=now';
            document.head.appendChild(link);
          }

          const html = await loadHTML(['/pages/calculators/training.html']);
          el.innerHTML = html
            ? (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html)
            : '<div class="placeholder"><h2>훈련/승급 계산기</h2><p class="muted">training.html을 찾을 수 없습니다.</p></div>';

          await loadScriptOnce('/js/training-calculator.js?v=now');
          if (window.initTrainingCalculator) {
            window.initTrainingCalculator({ mount: '#training-calc', jsonUrl: '/data/ks_training_promotion_per_troop.json' });
          }

          setTitle('title.calcTraining', '병력 훈련/승급 계산기 - KingshotData.kr');
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
  };
})();

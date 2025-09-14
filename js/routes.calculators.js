// /public/js/routes.calculators.js
// 계산기 전용 라우트 번들 (lazy-load)
// routes.js → ensureScript('/js/routes.calculators.js') 로 불러옴
// 전역(window)에 buildCalculatorRoutes 반드시 노출

(function () {
  'use strict';

  // ---- 안전 더미 정의 ----
  if (typeof window.buildCalculatorRoutes !== 'function') {
    window.buildCalculatorRoutes = function () {
      console.warn('[routes.calculators] 더미 buildCalculatorRoutes 실행');
      return {};
    };
  }

  console.log('[routes.calculators] 로드됨');

  // ==== 경로 & 버전 도우미 ====
  const BASE = (window.APP_BASE || document.querySelector('base')?.getAttribute('href') || '/')
    .replace(/\/+$/, '/');
  const j = (p) => (p.startsWith('/') ? (BASE + p.slice(1)) : (BASE + p));
  const ver = (p) => (window.v ? window.v(p) : p);

  async function loadOnce(src, loadScriptOnce) {
    return loadScriptOnce(ver(j(src)));
  }

  // ==== 실제 라우트 정의 ====
  window.buildCalculatorRoutes = function ({
    loadHTML, loadScriptOnce,
    apply, t, setTitle,
    ensureI18NReady, TIER_KEY_MAP_KO
  }) {
    console.log('[routes.calculators] buildCalculatorRoutes 실행');

    const routes = {};

    // ---------------------------
    // 계산기 허브
    routes['/calculator'] = {
      title: '계산기 - KingshotData.kr',
      render: async (el) => {
        el.innerHTML = '<div class="loading">Loading…</div>';
        const html = await loadHTML([ j('pages/calculator.html') ]);
        el.innerHTML = html
          ? (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html)
          : '<div class="placeholder"><h2>계산기</h2><p class="muted">calculator.html을 찾을 수 없습니다.</p></div>';
        setTitle('title.calculators', '계산기 - KingshotData.kr');
        window.scrollTo({ top: 0 });
        apply(el);
      }
    };

    // ---------------------------
    // 건물 계산기
    routes['/calc-building'] = {
      title: '건물계산기 - KingshotData.kr',
      render: async (el) => {
        const html = await loadHTML([ j('pages/calculators/building.html') ]);
        el.innerHTML = html
          ? (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html)
          : '<div class="placeholder"><h2>건물계산기</h2><p class="muted">building.html을 찾을 수 없습니다.</p></div>';

        await loadOnce('js/calculator.js', loadScriptOnce);
        if (typeof window.initCalculator === 'function') {
          window.initCalculator();
        } else {
          el.insertAdjacentHTML('beforeend', '<div class="error">initCalculator()가 없습니다.</div>');
        }

        setTitle('title.calcBuilding', '건물계산기 - KingshotData.kr');
        window.scrollTo({ top: 0 });
        apply(el);
      }
    };

    // ---------------------------
    // 장비 계산기 (각 언어 calcGear.json 강제 로드)
    routes['/calc-gear'] = {
      title: '영주장비계산기 - KingshotData.kr',
      render: async (el) => {
        // 1) HTML 주입
        const html = await loadHTML([ j('pages/calculators/gear.html') ]);
        el.innerHTML = html
          ? (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html)
          : '<div class="placeholder"><h2>영주장비계산기</h2><p class="muted">gear.html을 찾을 수 없습니다.</p></div>';

        // 2) i18n 준비 + calcGear 네임스페이스 로드(각 언어 파일 강제)
        try {
          await ensureI18NReady();

          if (window.I18N?.loadNamespaces) {
            await I18N.loadNamespaces(['calcGear']);
          } else if (window.I18N?.loadNamespace) {
            await I18N.loadNamespace('calcGear');
          }

          // <html lang> 동기화 (간/번체 축약 보정)
          let curr = I18N.current || document.documentElement.getAttribute('lang') || 'ko';
          if (curr === 'cn') curr = 'zh-CN';
          if (curr === 'tw') curr = 'zh-TW';
          document.documentElement.setAttribute('lang', curr);

          // (디버그) 키 확인
          console.log('[i18n] calcGear.title =', I18N?.t?.('calcGear.title'));
        } catch (e) {
          console.debug('[calc-gear] i18n 네임스페이스 로드 경고:', e);
        }

        // 3) 현재 화면 영역만 우선 적용
        apply(el);

        // 4) 계산기 스크립트 로드 + 초기화
        await loadOnce('js/gear-calculator.js', loadScriptOnce);
        if (typeof window.initGearCalculator === 'function') {
          window.initGearCalculator({
            mount: '#gear-calc',
            jsonUrl: j('data/governor-gear.json'),
            tierKeyMap: TIER_KEY_MAP_KO
          });
        } else {
          el.insertAdjacentHTML('beforeend', '<div class="error">initGearCalculator()가 없습니다.</div>');
        }

        // 5) 타이틀/스크롤/i18n 재적용
        setTitle('title.calcGear', '영주장비계산기 - KingshotData.kr');
        window.scrollTo({ top: 0 });
        apply(el);

        // 6) 언어 변경 시 이 화면만 재적용(1회 바인딩)
        if (!window.__calcGearReapplyBound) {
          document.addEventListener('i18n:changed', () => apply(el));
          window.__calcGearReapplyBound = true;
        }
      }
    };

    // ---------------------------
    // 보석 계산기
    routes['/calc-charm'] = {
      title: '영주보석계산기 - KingshotData.kr',
      render: async (el) => {
        const html = await loadHTML([ j('pages/calculators/charm.html') ]);
        el.innerHTML = html
          ? (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html)
          : '<div class="placeholder"><h2>영주보석계산기</h2><p class="muted">charm.html을 찾을 수 없습니다.</p></div>';

        await loadOnce('js/charm-calculator.js', loadScriptOnce);
        if (typeof window.initCharmCalculator === 'function') {
          window.initCharmCalculator({
            mount: '#charm-calc',
            jsonUrl: j('data/governor-charm.json')
          });
        } else {
          el.insertAdjacentHTML('beforeend', '<div class="error">initCharmCalculator()가 없습니다.</div>');
        }

        setTitle('title.calcCharm', '영주보석계산기 - KingshotData.kr');
        window.scrollTo({ top: 0 });
        apply(el);
      }
    };

    // ---------------------------
    // 훈련 계산기
    routes['/calc-training'] = {
      title: '병력 훈련/승급 계산기 - KingshotData.kr',
      render: async (el) => {
        window.ensureCSS?.( j('css/kingshot_calc.css') );
        const html = await loadHTML([ j('pages/calculators/training.html') ]);
        el.innerHTML = html
          ? (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html)
          : '<div class="placeholder"><h2>훈련/승급 계산기</h2><p class="muted">training.html을 찾을 수 없습니다.</p></div>';

        await loadOnce('js/training-calculator.js', loadScriptOnce);
        if (typeof window.initTrainingCalculator === 'function') {
          window.initTrainingCalculator({
            mount: '#training-calc',
            jsonUrl: j('data/ks_training_promotion_per_troop.json')
          });
        } else {
          el.insertAdjacentHTML('beforeend', '<div class="error">initTrainingCalculator()가 없습니다.</div>');
        }

        setTitle('title.calcTraining', '병력 훈련/승급 계산기 - KingshotData.kr');
        window.scrollTo({ top: 0 });
        apply(el);
      }
    };
    // ---------------------------
    // VIP 계산기 (HTML에는 cache-buster 금지, lang만 안전하게 부여)
    routes['/calc-vip'] = {
      title: 'VIP 포인트 계산기 - KingshotData.kr',
      render: async (el) => {
        window.ensureCSS?.( j('css/kingshot_calc.css') );

        // 현재 SPA 언어 확보 + 간/번체 축약 보정
        let currLang = document.documentElement.getAttribute('lang') || 'ko';
        if (currLang === 'cn') currLang = 'zh-CN';
        if (currLang === 'tw') currLang = 'zh-TW';

        // HTML 경로엔 ver() 절대 사용하지 않음. URL 객체로 lang만 합치기
        const url = new URL(j('pages/calculators/vip.html'), location.origin);
        url.searchParams.set('lang', currLang);

        el.innerHTML = `
          <div class="calc-embed-wrap">
            <iframe
              class="calc-embed-frame"
              style="width:100%; min-height:1100px; border:0; background:transparent; display:block"
              src="${url.pathname + '?' + url.searchParams.toString()}"
              loading="lazy"
              referrerpolicy="no-referrer"
              title="VIP 포인트 계산기"
            ></iframe>
          </div>
        `;

        setTitle('calcVip.meta.title', 'VIP 포인트 계산기 - KingshotData.kr');
        window.scrollTo({ top: 0 });

        const frame = el.querySelector('.calc-embed-frame');
        window.addEventListener('message', function (e) {
          if (!e?.data || e.data.type !== 'KSD_CALC_RESIZE') return;
          frame.style.minHeight = Math.max(900, e.data.height) + 'px';
        }, { passive: true });

        apply(el);
      }
    };

    return routes;
  };
})();

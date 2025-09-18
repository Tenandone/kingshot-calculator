// ---- dynamic loader utils (중복 로드 방지 + Promise화 + 안전성 강화) ----
(function () {
  // 이미 로드된 자원 기록 (중복 삽입 방지)
  const seenCSS = new Set();
  const seenJS  = new Set();

  // 동시에 같은 파일을 여러 곳에서 로드하려는 경우를 합치는 in-flight 테이블
  const inflight = new Map(); // key: "css|js:" + absKey, val: Promise

  // 캐시 버스터용 버전 파라미터
  const ASSET_VER = window.__V || 'now';

  // 절대 URL 표준화(쿼리의 v 파라미터 제외) — 중복 로드 방지의 기준 키
  function canonical(url) {
    try {
      const u = new URL(url, location.href);
      u.searchParams.delete('v'); // 내부 캐시버스터 제거
      return u.href;              // 항상 절대 URL
    } catch (e) {
      return String(url);
    }
  }

  // 문자열 기반 결합은 해시/쿼리 충돌 → URL API로 안전 처리
  function v(url) {
    if (!url) return url;
    if (/^(data:|blob:|#)/i.test(url)) return url; // data/blob/hash는 그대로
    try {
      const u = new URL(url, location.href);
      u.searchParams.set('v', ASSET_VER);
      // 크로스 오리진은 전체 href 유지, same-origin은 경로만
      return (u.origin !== location.origin)
        ? u.href
        : (u.pathname + u.search + u.hash);
    } catch (e) {
      // 상대경로 등에서 URL 생성 실패 시 기존 로직 폴백
      return url + (String(url).includes('?') ? '&' : '?') + 'v=' + ASSET_VER;
    }
  }
  if (!window.v) window.v = v;

  // 안전한 attribute selector 생성을 위한 유틸 (CSS.escape가 없는 브라우저 폴백)
  function escAttr(val) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(val);
    // 매우 보수적 폴백: 공백/따옴표/대괄호 등 특수문자 제거
    return String(val).replace(/["'\\\[\]\(\)\s]/g, '');
  }

  // CSS 로더: 실제 onload까지 대기 가능한 Promise 반환
  window.ensureCSS = window.ensureCSS || function (href) {
    // 상대/절대/쿼리 변형 모두 하나로 취급하도록 절대 URL 키 사용 + data-ensured 마커
    const absKey = canonical(href);
    const selEnsured = 'link[rel="stylesheet"][data-ensured="' + escAttr(absKey) + '"]';
    if (seenCSS.has(absKey) || document.querySelector(selEnsured)) return Promise.resolve();

    const inflightKey = 'css:' + absKey;
    if (inflight.has(inflightKey)) return inflight.get(inflightKey);

    const p = new Promise(function (res, rej) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = v(href);
      l.setAttribute('data-ensured', absKey);
      l.onload  = function(){ seenCSS.add(absKey); res(); };
      l.onerror = function(){ rej(new Error('CSS load failed: ' + href)); };
      document.head.appendChild(l);
    }).finally(function(){ inflight.delete(inflightKey); });

    inflight.set(inflightKey, p);
    return p;
  };

  // JS 로더: 동적 <script> — async 로 비동기 로드, 의존성은 await 체인으로 보장
  window.ensureScript = window.ensureScript || function (src, opt) {
    opt = opt || {};
    // dedupe 개선(절대 URL 기준) + data-ensured 마커로 DOM 조회 안정화
    const absKey = canonical(src);
    const selEnsured = 'script[data-ensured="' + escAttr(absKey) + '"]';
    if (seenJS.has(absKey) || document.querySelector(selEnsured)) return Promise.resolve();

    const inflightKey = 'js:' + absKey;
    if (inflight.has(inflightKey)) return inflight.get(inflightKey);

    const p = new Promise(function (res, rej) {
      const s = document.createElement('script');
      s.src = v(src);
      if (opt.type === 'module') {
        s.type = 'module'; // 모듈은 기본적으로 defer 성격
      } else {
        s.async = true;
        if (opt.type) s.type = opt.type;
      }
      if (opt.integrity) {
        s.integrity = opt.integrity;
        s.crossOrigin = opt.crossOrigin || 'anonymous';
      }
      s.setAttribute('data-ensured', absKey);
      s.onload  = function(){ seenJS.add(absKey); res(); };
      s.onerror = function(){ rej(new Error('Script load failed: ' + src)); };
      document.head.appendChild(s);
    }).finally(function(){ inflight.delete(inflightKey); });

    inflight.set(inflightKey, p);
    return p;
  };
})();


// ---- js/routes.js (코어 라우트만; 계산기 관련 라우트/프리패치 제거) ----
(function () {
  'use strict';

  // 라우트 렌더 레이스 방지 토큰
  var __renderToken = 0;
  function newRenderToken() { return ++__renderToken; }
  function isStale(token)   { return token !== __renderToken; }

  // 페이지 전환 시 최상단으로: 브라우저 기본 복원 끄기
  try { history.scrollRestoration = 'manual'; } catch (e) {}

  // HTML에서 <body>만 안전하게 추출 (정규식 대신 DOMParser 사용)
  function htmlBodyOnly(html) {
    if (!html) return html;
    try {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      return doc && doc.body ? doc.body.innerHTML : html;
    } catch (e) {
      return html;
    }
  }

  // 접근성: 렌더 완료 후 주요 heading 포커스
  function focusMain(el) {
    var h1 = el.querySelector('h1, [role="heading"]');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      try { h1.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  // requestIdleCallback 폴백
  var ric = window.requestIdleCallback || function (cb) { return setTimeout(cb, 1); };

  // buildRoutes 본체
  window.buildRoutes = function (deps) {
    deps = deps || {};
    var loadHTML = deps.loadHTML;
    var loadScriptOnce = deps.loadScriptOnce;
    var renderDbDetail = deps.renderDbDetail;
    var iconImg = deps.iconImg;

    // loadScriptOnce 미주입 환경 폴백: ensureScript 재사용
    var _loadScriptOnce = (typeof loadScriptOnce === 'function') ? loadScriptOnce : function (src, opt) { return window.ensureScript(src, opt); };

    // ---------- i18n helpers ----------
    function apply(root) {
      if (window.I18N && typeof window.I18N.applyTo === 'function') {
        return window.I18N.applyTo(root || document);
      }
    }
    function t(key, fb) {
      var fallback = (typeof fb !== 'undefined') ? fb : key;
      if (window.I18N && typeof window.I18N.t === 'function') {
        return window.I18N.t(key, fallback);
      }
      return fallback;
    }
    function setTitle(key, fb) { document.title = t(key, fb); }

    // 공용 내비게이션: pushState 후 popstate 트리거
    function goto(path) {
      var url = String(path || '/');
      if (window.navigation && typeof window.navigation.navigate === 'function') {
        try { window.navigation.navigate(url); return; } catch (e) {}
      }
      history.pushState(null, '', url);
      try {
        window.dispatchEvent(new PopStateEvent('popstate'));
      } catch (e) {
        var ev = (document.createEvent && document.createEvent('Event')) || null;
        if (ev && ev.initEvent) { ev.initEvent('popstate', true, true); window.dispatchEvent(ev); }
      }
    }

    // HTML 로드 결과 메모리 캐시 (간단 LRU)
    var __htmlCache = new Map(); // key: candidates.join('|'), val: html string
    function cacheGet(k){ return __htmlCache.get(k); }
    function cacheSet(k, v){
      __htmlCache.set(k, v);
      if (__htmlCache.size > 20) __htmlCache.delete(__htmlCache.keys().next().value);
    }
    async function loadHTMLCached(cands) {
      var key = cands.join('|');
      var hit = cacheGet(key);
      if (hit) return hit;
      var html = await loadHTML(cands);
      if (html) cacheSet(key, html);
      return html;
    }

    // ===== 코어 라우트 정의 =====
    var routes = {
      '/home': {
        title: '홈 - KingshotData.kr',
        render: async function (el) {
          var token = newRenderToken();
          var cards = [
            { href:'/buildings',  img:'/img/home/saulchar.png',   t:'home.card.buildings.title',   d:'home.card.buildings.desc' },
            { href:'/heroes',     img:'/img/home/helgachar.png',  t:'home.card.heroes.title',      d:'home.card.heroes.desc' },
            { href:'/database',   img:'/img/home/database.png',   t:'home.card.database.title',    d:'home.card.database.desc' },
            { href:'/guides',     img:'/img/home/guides.png',     t:'home.card.guides.title',      d:'home.card.guides.desc' },
            { href:'/calculator', img:'/img/home/calculator.png', t:'home.card.calculators.title', d:'home.card.calculators.desc' },

            { href:'/about',      img:'/img/home/about.png',      t:'nav.about',                   d:'home.card.about.desc' }
          ];
          el.innerHTML =
            '<div class="home-container">' +
              '<section class="home-categories">' +
                '<h2 class="section-title" data-i18n="home.categoriesTitle">' + t('home.categoriesTitle','카테고리') + '</h2>' +
                '<div class="grid category-grid">' +
                  cards.map(function(c){
                    return '' +
                    '<a class="card card--category" href="' + c.href + '">' +
                      '<div class="card__media" aria-hidden="true">' +
                        iconImg(t(c.t), c.img) +
                      '</div>' +
                      '<div class="card__body">' +
                        '<div class="card__title" data-i18n="' + c.t + '">' + t(c.t) + '</div>' +
                        '<div class="card__subtitle" data-i18n="' + c.d + '">' + t(c.d) + '</div>' +
                      '</div>' +
                    '</a>';
                  }).join('') +
                '</div>' +
              '</section>' +
            '</div>';
          if (isStale(token)) return;
          apply(el);
          setTitle('title.home', '홈 - KingshotData.kr');
          window.scrollTo({ top: 0 });
          focusMain(el);
        }
      },

     // --- Buildings ---
'/buildings': {
  title: '건물 - KingshotData.kr',
  render: async function (el) {
    var token = newRenderToken();
    try {
      if (window.I18N && window.I18N.loadNamespace) {
        await window.I18N.loadNamespace('buildings');
      }
    } catch(e) {}
    if (isStale(token)) return;

    el.innerHTML = [
      '<div id="buildings-grid" class="grid"></div>',
      '<div id="building-root"></div>'
    ].join('');

    // ✅ 절대 경로를 먼저 두고, 상대 경로는 fallback
    var candidates = [ v('/js/pages/buildings.js'), v('js/pages/buildings.js') ];
    var ok = false, lastErr;
    for (var i=0;i<candidates.length;i++) {
      var src = candidates[i];
      try { 
        await _loadScriptOnce(src); 
        ok = true; 
        break; 
      } catch (e) { 
        lastErr = e; 
      }
    }
    if (isStale(token)) return;
    if (!ok) {
      el.innerHTML =
        '<div class="placeholder">' +
          '<h2 data-i18n="common.loadFail">로딩 실패</h2>' +
          '<p class="muted" data-i18n="buildings.loadFailHint">/js/pages/buildings.js 경로를 확인하세요.</p>' +
        '</div>';
      if (lastErr) console.error(lastErr);
      return;
    }

    if (typeof window.initBuildings !== 'function') {
      el.innerHTML =
        '<div class="placeholder">' +
          '<h2 data-i18n="common.initFail">초기화 실패</h2>' +
          '<p class="muted" data-i18n="buildings.noInit">window.initBuildings()가 없습니다.</p>' +
        '</div>';
      return;
    }

    // 옛 해시 링크 → 클린 경로로 변환
    el.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#/building/"]');
      if (a) {
        e.preventDefault();
        var tail = a.getAttribute('href').replace(/^#\/building\/?/, ''); // 예: towncenter/30
        return goto('/buildings/' + tail);
      }
      a = e.target.closest && e.target.closest('a[href^="#/buildings"]');
      if (a) {
        e.preventDefault();
        return goto('/buildings');
      }
    });

    try { window.initBuildings(); } catch (e) { console.error(e); }

    setTitle('title.buildings', '건물 - KingshotData.kr');
    window.scrollTo({ top: 0 });
    focusMain(el);
  }
},


      // --- Heroes (list) ---
      '/heroes': {
        title: '영웅 - KingshotData.kr',
        render: async function (el) {
          var token = newRenderToken();
          if (window.performance && performance.mark) performance.mark('route:heroes:start');

          el.innerHTML = '<div class="loading" data-i18n="common.loading">Loading…</div>';
          var html = await loadHTMLCached(['pages/heroes.html','/pages/heroes.html','heroes.html','/heroes.html']);
          if (isStale(token)) return;
          if (!html) {
            el.innerHTML = '<div class="placeholder"><h2 data-i18n="heroes.title">영웅</h2><p class="muted" data-i18n="heroes.missing">heroes.html을 찾을 수 없습니다.</p></div>';
            return;
          }
          el.innerHTML = htmlBodyOnly(html);

          // 옛 링크 -> 클린 경로
          el.addEventListener('click', function (e) {
            var a = e.target.closest && e.target.closest('a[href^="#/hero/"]');
            if (a) {
              e.preventDefault();
              var slug = a.getAttribute('href').replace(/^#\/hero\/?/, '');
              return goto('/hero/' + slug);
            }
            a = e.target.closest && e.target.closest('a[href^="/heroes/"]');
            if (a) {
              e.preventDefault();
              var slug2 = a.getAttribute('href').replace(/^\/heroes\/?/, '');
              return goto('/hero/' + slug2);
            }
          });

          var jsCands = [ v('js/pages/heroes.js'), v('/js/pages/heroes.js') ];
          var loadedAny = false;
          for (var i=0;i<jsCands.length;i++) {
            var src = jsCands[i];
            try { await _loadScriptOnce(src); loadedAny = true; break; } catch(e){}
          }
          if (isStale(token)) return;
          if (!loadedAny) {
            el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="heroes.loadFail">heroes.js 로드 실패</div>');
            return;
          }
          if (typeof window.initHeroes === 'function') {
            try { window.initHeroes(); } catch (e) { console.error(e); }
          } else {
            el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="heroes.noInit">initHeroes()가 없습니다.</div>');
          }
          setTitle('title.heroes', '영웅 - KingshotData.kr');
          window.scrollTo({ top: 0 });
          focusMain(el);

          if (window.performance && performance.mark && performance.measure) {
            performance.mark('route:heroes:end');
            performance.measure('route:heroes', 'route:heroes:start', 'route:heroes:end');
          }
        }
      },

      // --- Hero detail ---
      '/hero': {
        title: '영웅 상세 - KingshotData.kr',
        render: async function (el, rest) {
          var token = newRenderToken();
          var slug = decodeURIComponent((rest || '').split('/').filter(Boolean)[0] || '');
          el.innerHTML =
            '<section class="container">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">' +
                '<h1 class="page-title" id="hero-title" data-i18n="heroes.detail.title">-</h1>' +
                '<a class="btn btn-icon" href="/heroes" data-smart-back="/heroes" aria-label="Back" title="Back">←</a>' +
              '</div>' +
              '<div id="hero-root" class="hero-detail"></div>' +
            '</section>' +
            '<style>' +
              '.hero-detail{ display:grid; gap:16px; grid-template-columns: 1fr; }' +
              '@media (min-width: 900px){ .hero-detail{ grid-template-columns: 320px 1fr; align-items:start; } }' +
              '.hero-card{ background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,.06); }' +
              '.hero-card img{ width:100%; aspect-ratio:3/4; object-fit:cover; display:block; background:#eee; }' +
              '.hero-card .meta{ padding:12px; font-size:14px; color:#333; }' +
              '.hero-section{ background:#fff; border-radius:14px; box-shadow:0 2px 10px rgba(0,0,0,.06); padding:14px; }' +
              '.hero-section h2{ margin:0 0 8px; font-size:16px; }' +
              '.kv{ display:grid; grid-template-columns: 110px 1fr; gap:6px 10px; font-size:14px; }' +
              '.kv dt{ color:#666; }' +
              '.pill{ display:inline-block; padding:2px 8px; border-radius:999px; background:#eef2ff; color:#273; font-size:12px; margin-right:6px; }' +
              '.muted{ color:#666; }' +
              '.hero-section .skill img{ display:block; margin-inline:auto; float:none; }' +
              '.hero-section .skills-row{ display:flex; justify-content:center; gap:12px; flex-wrap:wrap; }' +
              '.hero-section .skills-grid{ display:grid; place-items:center; gap:12px; }' +
            '</style>';
          apply(el);

          var jsCands = [ v('js/pages/hero.js'), v('/js/pages/hero.js') ];
          var ok = false;
          for (var i=0;i<jsCands.length;i++){
            var src = jsCands[i];
            try { await _loadScriptOnce(src); ok = true; break; } catch(e){}
          }
          if (isStale(token)) return;
          if (!ok){
            el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="hero.loadFail">hero.js 로드 실패</div>');
            return;
          }
          if (typeof window.initHero === 'function'){
            try { await window.initHero(slug); } catch(e){ console.error(e); }
          } else {
            el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="hero.noInit">initHero()가 없습니다.</div>');
          }
          if (isStale(token)) return;

          apply(el);

          if (!window.__heroI18NReapplyBound) {
            document.addEventListener('i18n:changed', function(){ apply(el); });
            window.__heroI18NReapplyBound = true;
          }
          var setHeroTitle = function(){ setTitle('heroes.detail.pageTitle','영웅 상세 - KingshotData.kr'); };
          setHeroTitle();
          if (!window.__heroTitleBound) {
            document.addEventListener('i18n:changed', setHeroTitle);
            window.__heroTitleBound = true;
          }
          window.scrollTo({ top: 0 });
          focusMain(el);
        }
      },

      // --- Guides (list + detail) ---
      '/guides': {
        title: '가이드 - KingshotData.kr',
        render: async function (el, rest) {
          var token = newRenderToken();
          var trail = (rest || '').split('/').filter(Boolean).join('/'); // detail slug
          try { if (window.I18N && window.I18N.loadNamespace) { await window.I18N.loadNamespace('guides'); } } catch(e) {}

          // 내부 공통: guides 의존성 로더
          async function loadGuidesDeps() {
            var cssCands = ['/css/guides.css', 'css/guides.css'];
            for (var i=0;i<cssCands.length;i++){ try { await ensureCSS(cssCands[i]); break; } catch(e){} }
            // js 후보 경로
            var jsCands = ['js/guides.js','/js/guides.js','js/pages/guides.js','/js/pages/guides.js'];
            for (var j=0;j<jsCands.length;j++){ try { await _loadScriptOnce(jsCands[j]); break; } catch(e){} }
          }

          // detail 페이지: /guides/:slug
          if (trail) {
            el.innerHTML = '<div class="loading" data-i18n="common.loading">Loading…</div>';
            var slug = decodeURIComponent(trail);

            var html = await loadHTMLCached([
              'pages/guides/' + slug + '.html',
              '/pages/guides/' + slug + '.html',
              'pages/guides/' + slug + '/index.html',
              '/pages/guides/' + slug + '/index.html',
              'pages/guide/' + slug + '.html',
              '/pages/guide/' + slug + '.html'
            ]);
            if (isStale(token)) return;

            if (!html) {
              el.innerHTML =
                '<div class="placeholder">' +
                  '<div style="display:flex;justify-content:flex-end;margin-bottom:8px;">' +
                    '<a class="btn btn-icon" href="/guides" data-smart-back="/guides" aria-label="Back" title="Back">←</a>' +
                  '</div>' +
                  '<h2 data-i18n="guides.notFound">가이드를 찾을 수 없습니다.</h2>' +
                  '<p class="muted">/pages/guides/' + slug + '.html 경로를 확인하세요.</p>' +
                '</div>';
              setTitle('guides.title', '가이드 - KingshotData.kr');
              return;
            }

            el.innerHTML =
              '<section class="container">' +
                '<div style="display:flex;justify-content:flex-end;margin-bottom:8px;">' +
                  '<a class="btn btn-icon" href="/guides" data-smart-back="/guides" aria-label="Back" title="Back">←</a>' +
                '</div>' +
                htmlBodyOnly(html) +
              '</section>';

            await loadGuidesDeps();
            if (isStale(token)) return;

            if (window.I18N && window.I18N.applyTo) window.I18N.applyTo(el);
            if (window.GUIDES_apply) await window.GUIDES_apply(el);
            if (isStale(token)) return;

            setTitle('guides.title', '가이드 - KingshotData.kr');
            window.scrollTo({ top: 0 });
            focusMain(el);

            // 내부 링크 정규화
            el.addEventListener('click', function (e) {
              var a = e.target.closest && e.target.closest('a[href^="#/guide/"]');
              if (a) {
                e.preventDefault();
                var slug2 = a.getAttribute('href').replace(/^#\/guide\/?/, '');
                return goto('/guides/' + slug2);
              }
              a = e.target.closest && e.target.closest('a[href^="/guides/"]');
              if (a) {
                e.preventDefault();
                var slug3 = a.getAttribute('href').replace(/^\/guides\/?/, '');
                return goto('/guides/' + slug3);
              }
            });
            return;
          }

          // 리스트 페이지
          el.innerHTML = '<div class="loading" data-i18n="common.loading">Loading…</div>';
          var listHTML = await loadHTMLCached(['pages/guides.html', '/pages/guides.html', '/pages/guide.html']);
          if (isStale(token)) return;

          el.innerHTML = listHTML ? htmlBodyOnly(listHTML)
            : '<div class="placeholder"><h2 data-i18n="guides.title">가이드</h2><p class="muted" data-i18n="guides.missing">guides.html을 찾을 수 없습니다.</p></div>';

          await loadGuidesDeps();
          if (isStale(token)) return;

          if (window.I18N && window.I18N.applyTo) window.I18N.applyTo(el);
          if (window.GUIDES_apply) await window.GUIDES_apply(el);
          if (isStale(token)) return;

          // 해시/절대 경로 링크 → SPA 경로로 변환
          el.addEventListener('click', function (e) {
            var a = e.target.closest && e.target.closest('a[href^="#/guide/"]');
            if (a) {
              e.preventDefault();
              var slug = a.getAttribute('href').replace(/^#\/guide\/?/, '');
              return goto('/guides/' + slug);
            }
            a = e.target.closest && e.target.closest('a[href^="/guides/"]');
            if (a) {
              e.preventDefault();
              var slug2 = a.getAttribute('href').replace(/^\/guides\/?/, '');
              return goto('/guides/' + slug2);
            }
          });

          setTitle('guides.title', '가이드 - KingshotData.kr');
          window.scrollTo({ top: 0 });
          focusMain(el);
        }
      },

      // --- Database list ---
      '/database': {
        title: '데이터베이스 - KingshotData.kr',
        render: async function (el) {
          var token = newRenderToken();
          el.innerHTML = '<div class="loading" data-i18n="common.loading">Loading…</div>';

          var html = await loadHTMLCached([
            'pages/database.html',
            '/pages/database.html',
            'database.html',
            '/database.html'
          ]);
          if (isStale(token)) return;

          if (!html) {
            el.innerHTML = '<div class="placeholder"><h2 data-i18n="database.title">데이터베이스</h2><p class="muted" data-i18n="database.missing">database.html을 찾을 수 없습니다.</p></div>';
            return;
          }

          el.innerHTML = htmlBodyOnly(html);

          var jsCands = [ v('js/pages/database.js'), v('/js/pages/database.js') ];
          var loadedAny = false;
          for (var i=0;i<jsCands.length;i++) {
            var src = jsCands[i];
            try { await _loadScriptOnce(src); loadedAny = true; break; } catch (e) {}
          }
          if (isStale(token)) return;
          if (!loadedAny) {
            el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="database.loadFail">database.js 로드 실패</div>');
            return;
          }

          if (typeof window.initDatabase === 'function') {
            try { await window.initDatabase(); } catch (e) { console.error(e); }
          } else {
            el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="database.noInit">initDatabase()가 없습니다.</div>');
          }
          if (isStale(token)) return;

          setTitle('title.database', '데이터베이스 - KingshotData.kr');
          if (window.I18N && window.I18N.applyTo) window.I18N.applyTo(el);
          window.scrollTo({ top: 0 });
          focusMain(el);
        }
      },

      // --- Database detail proxy (/db/:folder/:file...) ---
      '/db': {
        title: 'KingshotData.kr',
        render: async function (el, rest) {
          var token = newRenderToken();
          var parts  = (rest || '').split('/').filter(Boolean);

          // 상위경로 탈출만 차단하고 유니코드/공백 허용
          function sanitizeSeg(s) {
            return String(s)
              .replace(/\\/g,'/')                     // 역슬래시 → 슬래시
              .replace(/(^|\/)\.\.(?=\/|$)/g,'')      // 상위 경로 제거
              .replace(/\/{2,}/g,'/')                 // 중복 슬래시 축소
              .replace(/^\//,'')                      // 선행 슬래시 제거
              .replace(/\0/g,'');                     // 널 바이트 제거
          }

          var folderRaw = parts[0] ? decodeURIComponent(parts[0]) : '';
          var fileRaw   = parts[1] ? decodeURIComponent(parts.slice(1).join('/')) : '';
          if (!folderRaw) { goto('/database'); return; }

          // 전용무기 상세는 widgets로 리맵해서 로드 (URL은 그대로)
          var folder = sanitizeSeg(folderRaw === 'hero-exclusive-gear' ? 'widgets' : folderRaw);
          var file   = sanitizeSeg(fileRaw);

          // i18n namespace 준비
          try {
            if (window.I18N && typeof window.I18N.init === 'function') {
              await window.I18N.init({ namespaces: ['db'] });
            } else if (window.I18N && typeof window.I18N.loadNamespaces === 'function') {
              await window.I18N.loadNamespaces(['db']);
            }
          } catch (e) { console.debug('[i18n] init/loadNamespaces skipped', e); }
          if (isStale(token)) return;

          await renderDbDetail(el, folder, file);
          if (isStale(token)) return;

          // 레거시 back UI 제거 + 스마트 백 버튼 삽입
          (function removeLegacyDbBack(el) {
            if (el.__legacyCleaned) return;
            ['a.btn-back','[data-i18n-key="database.detail.back"]','a[href="/database"]']
              .forEach(function (sel) {
                var list = el.querySelectorAll(sel);
                Array.prototype.forEach.call(list, function (a) {
                  if (!a.hasAttribute('data-smart-back')) a.remove();
                });
              });
            el.__legacyCleaned = true;
          })(el);

          el.insertAdjacentHTML('afterbegin',
            '<div style="display:flex;justify-content:flex-end;margin-bottom:8px;">' +
              '<a class="btn btn-icon" href="/database" data-smart-back="/database" aria-label="Back" title="Back">←</a>' +
            '</div>'
          );

          var heads = el.querySelectorAll('h1[data-i18n="title.database"]');
          Array.prototype.forEach.call(heads, function(n){ n.remove(); });

          if (window.I18N && window.I18N.applyTo) window.I18N.applyTo(el);

          // 페이지 타이틀을 동적으로 결정
          (function setTitleFromPage(el) {
            var metaEl = el.querySelector('meta[name="db-title"]');
            var metaKey = (metaEl && metaEl.content) ? metaEl.content.trim() : null;
            if (metaKey) { setTitle(metaKey, (window.I18N && window.I18N.t && window.I18N.t(metaKey)) || document.title); return; }
            var h1 = el.querySelector('h1[data-i18n], h1[data-i18n-key]');
            if (h1) {
              var k = h1.getAttribute('data-i18n') || h1.getAttribute('data-i18n-key');
              setTitle(k, (window.I18N && window.I18N.t && window.I18N.t(k)) || h1.textContent || 'KingshotData.kr');
            }
          })(el);

          window.scrollTo({ top: 0 });
          focusMain(el);
        }
      },

      // --- Privacy ---
      '/privacy': {
        title: '개인정보처리방침 - KingshotData.kr',
        render: async function (el) {
          var token = newRenderToken();
          el.innerHTML = '<div class="loading" data-i18n="common.loading">Loading…</div>';
          var html = await loadHTMLCached(['pages/privacy.html','/pages/privacy.html','privacy.html','/privacy.html']);
          if (isStale(token)) return;
          el.innerHTML = html
            ? htmlBodyOnly(html)
            : '<div class="placeholder"><h2 data-i18n="privacy.title">개인정보처리방침</h2><p class="muted" data-i18n="privacy.missing">privacy.html을 찾을 수 없습니다.</p></div>';
          setTitle('title.privacy', '개인정보처리방침 - KingshotData.kr');
          window.scrollTo({ top: 0 });
          focusMain(el);
        }
      },

      // --- About ---
      '/about': {
        title: '소개 - KingshotData.kr',
        render: async function (el) {
          var token = newRenderToken();
          el.innerHTML = '<div class="loading" data-i18n="common.loading">Loading…</div>';
          var html = await loadHTMLCached(['pages/about.html','/pages/about.html','about.html','/about.html']);
          if (isStale(token)) return;
          el.innerHTML = html
            ? htmlBodyOnly(html)
            : '<div class="placeholder"><h2 data-i18n="about.title">소개</h2><p class="muted" data-i18n="about.missing">about.html을 찾을 수 없습니다.</p></div>';
          setTitle('title.about', '소개 - KingshotData.kr');
          window.scrollTo({ top: 0 });
          focusMain(el);
        }
      }
    };

    // --- /guide 별칭(레거시 링크 호환) → /guides 로 위임
    routes['/guide'] = {
      title: '가이드 - KingshotData.kr',
      render: function (el, rest) { return routes['/guides'].render(el, rest); }
    };

    // ===== 프리패치(hover/idle)로 체감속도 향상 =====
    var PREFETCH_MAP = {
      '/buildings':  { js: ['js/pages/buildings.js'] },
      '/heroes':     { js: ['js/pages/heroes.js'], html: ['pages/heroes.html','/pages/heroes.html'] },
      '/database':   { js: ['js/pages/database.js'], html: ['pages/database.html','/pages/database.html'] },
      '/guides':     { js: ['js/guides.js','/js/guides.js'], css: ['/css/guides.css'], html: ['pages/guides.html','/pages/guides.html'] }
    };

    function prefetchFor(href) {
      try {
        var path = new URL(href, location.href).pathname;
        var cfg = PREFETCH_MAP[path];
        if (!cfg) return;
        if (cfg.css) cfg.css.forEach(function(h){ ensureCSS(h); });
        if (cfg.js)  cfg.js.forEach(function(s){ ensureScript(s); });
        if (cfg.html) cfg.html.forEach(async function(h){ try { await loadHTMLCached([h]); } catch(e){} });
      } catch (e) {}
    }

    // 카테고리 카드/메뉴 hover 시 프리패치
    document.addEventListener('mouseover', function (e) {
      var a = e.target.closest && e.target.closest('a.card--category, a[href="/buildings"], a[href="/heroes"], a[href="/database"], a[href="/guides"]');
      if (!a) return;
      prefetchFor(a.href);
    });

    

    return routes;
  };
})();

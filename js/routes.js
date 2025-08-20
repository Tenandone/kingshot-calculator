// js/routes.js
// exposes: window.buildRoutes(deps)
// deps: { loadHTML, loadScriptOnce, renderDbDetail, iconImg, catCard }
(function () {
  'use strict';

  window.buildRoutes = function ({ loadHTML, loadScriptOnce, renderDbDetail, iconImg, catCard }) {
    return {
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
  render: async (el) => {
    el.innerHTML = '<div class="loading">Loading…</div>';

    // pages/guide.html 파일을 불러와 본문만 주입
    const html = await loadHTML(['pages/guide.html','/pages/guide.html']);
    if (!html) {
      el.innerHTML = '<div class="placeholder"><h2>가이드</h2><p class="muted">guide.html을 찾을 수 없습니다.</p></div>';
      return;
    }
    const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    el.innerHTML = m ? m[1] : html;

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
            '/js/calculator.js',
            'js/calculator.js'
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
  };
})();

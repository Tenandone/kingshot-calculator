// =========================================================
// /js/routes.js — FULL FINAL (HOME BANNER + WARACADEMY ROUTE + /home -> / REDIRECT)
// REQUIREMENTS (load order in index.html):
//   1) /js/asset-loader.js   (provides v/ensureCSS/ensureScript)
//   2) /js/html-loader.js    (provides KD_HTML.mount / KD_HTML.loadAndMount)
//   3) /js/routes.js         (this file)
// =========================================================
(function () {
  'use strict';

  var __renderToken = 0;
  function newRenderToken() { return ++__renderToken; }
  function isStale(token)   { return token !== __renderToken; }

  try { history.scrollRestoration = 'manual'; } catch (e) {}

  function htmlBodyOnly(html) {
    if (!html) return html;
    try {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      return doc && doc.body ? doc.body.innerHTML : html;
    } catch (e) {
      return html;
    }
  }

  function focusMain(el) {
    if (!el) return;
    var h1 = el.querySelector && el.querySelector('h1, [role="heading"]');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      try { h1.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  function scopeCssToContent(cssText) {
    var css = String(cssText || '');
    css = css.replace(/:root\s*\{/g, '#content{');

    var keyframes = [];
    css = css.replace(/@(-webkit-)?keyframes[^{]*\{[\s\S]*?\}\s*\}/g, function (m) {
      var idx = keyframes.push(m) - 1;
      return '___KS_KEYFRAMES_' + idx + '___';
    });

    css = css.replace(/(^|})\s*([^{@}][^{]*)\{/g, function (m, brace, sel) {
      var s = (sel || '').trim();
      if (!s) return m;
      if (s.indexOf('#content') === 0) return brace + ' ' + sel + '{';

      var scoped = s.split(',').map(function (part) {
        part = (part || '').trim();
        if (!part) return part;

        part = part.replace(/^\s*html\b/, '#content').replace(/^\s*body\b/, '#content');
        if (part.indexOf('#content') === 0) return part;

        return '#content ' + part;
      }).join(', ');

      return brace + ' ' + scoped + '{';
    });

    css = css.replace(/___KS_KEYFRAMES_(\d+)___/g, function (_m, n) {
      return keyframes[parseInt(n, 10)] || '';
    });

    return css;
  }

  window.buildRoutes = function (deps) {
    deps = deps || {};
    var loadHTML = deps.loadHTML;
    var loadScriptOnce = deps.loadScriptOnce;
    var renderDbDetail = deps.renderDbDetail;
    var iconImg = deps.iconImg;

    var _loadScriptOnce = (typeof loadScriptOnce === 'function')
      ? loadScriptOnce
      : function (src, opt) {
          return (window.ensureScript
            ? window.ensureScript(src, opt)
            : Promise.reject(new Error('ensureScript missing')));
        };

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

    function goto(path, replaceMode) {
      var url = String(path || '/');
      if (replaceMode) {
        history.replaceState(null, '', url);
      } else {
        if (window.navigation && typeof window.navigation.navigate === 'function') {
          try { window.navigation.navigate(url); return; } catch (e) {}
        }
        history.pushState(null, '', url);
      }

      try {
        window.dispatchEvent(new PopStateEvent('popstate'));
      } catch (e) {
        try {
          var ev = document.createEvent('Event');
          ev.initEvent('popstate', true, true);
          window.dispatchEvent(ev);
        } catch(_) {}
      }
    }

    function safeSeg(input){
      var s = String(input || '');
      try { s = decodeURIComponent(s); } catch (e) {}
      s = s.replace(/\\/g,'/');
      s = s.replace(/(^|\/)\.\.(?=\/|$)/g,'');
      s = s.replace(/\/{2,}/g,'/');
      s = s.replace(/^\//,'');
      s = s.replace(/\0/g,'');
      s = s.split('?')[0].split('#')[0].trim();
      return s;
    }

    function setMetaTag(name, content){
      if(!content) return;
      var m = document.querySelector('meta[name="'+name+'"]');
      if(!m){
        m = document.createElement('meta');
        m.setAttribute('name', name);
        document.head.appendChild(m);
      }
      m.setAttribute('content', content);
    }

    function setCanonical(href){
      if(!href) return;
      var link = document.querySelector('link[rel="canonical"]');
      if(!link){
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = href;
    }

    function normLangCode(raw){
      var s = String(raw || '').trim();
      if (!s) return '';
      var low = s.toLowerCase();
      if (low === 'zh-tw' || low === 'zh_tw' || low === 'zhtw' || low === 'tw') return 'zh-tw';
      if (low === 'ko' || low === 'en' || low === 'ja') return low;
      return '';
    }

    function getCurrentLang(){
      try{
        var cur = (window.I18N && (window.I18N.current || window.I18N.lang)) || '';
        var n1 = normLangCode(cur);
        if (n1) return n1;
      }catch(_){}

      try{
        var hl = document.documentElement.getAttribute('lang') || '';
        var n2 = normLangCode(hl);
        if (n2) return n2;
      }catch(_){}

      try{
        var saved = localStorage.getItem('lang') || '';
        var n3 = normLangCode(saved);
        if (n3) return n3;
      }catch(_){}

      try{
        var u = new URL(location.href);
        var q = u.searchParams.get('lang') || '';
        var n4 = normLangCode(q);
        if (n4) return n4;
      }catch(_){}

      try{
        var p = location.pathname.split('/').filter(Boolean);
        var first = (p[0] || '').toLowerCase();
        var n5 = normLangCode(first);
        if (n5) return n5;
      }catch(_){}

      return 'ko';
    }

    function normalizeBuildingSlug(slug){
      slug = String(slug || '').trim();
      if(!slug) return slug;

      slug = slug.replace(/\.html$/i, '');
      if (slug === 'towncenter') slug = 'town-center';

      if (slug === 'command') slug = 'commandcenter';
      if (slug === 'command-center') slug = 'commandcenter';
      if (slug === 'commandcenter') slug = 'commandcenter';

      if (slug === 'waracademy') slug = 'war-academy';

      return slug;
    }

    var __htmlCache = new Map();
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

    async function mountHomeWaracademyBanner(root) {
      if (!root) return false;

      try {
        var html = await loadHTMLCached([
          '/tools/home-waracademy-banner.html',
          'tools/home-waracademy-banner.html'
        ]);

        if (!html) {
          root.innerHTML = '';
          root.hidden = true;
          return false;
        }

        root.hidden = false;
        root.innerHTML = htmlBodyOnly(html);
        apply(root);
        return true;
      } catch (e) {
        console.error('[home banner] load failed:', e);
        try {
          root.innerHTML = '';
          root.hidden = true;
        } catch (_) {}
        return false;
      }
    }

    function bindBuildingsListLinksOnce(el){
      if (el.__bldListBound) return;
      el.__bldListBound = true;

      el.addEventListener('click', function(e){
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a) return;

        var href = a.getAttribute('href') || '';
        if (!href) return;
        if (a.target === '_blank' || a.hasAttribute('download')) return;
        if (/^https?:\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')) return;

        if (href.indexOf('#building/') === 0 || href.indexOf('#/building/') === 0){
          e.preventDefault();
          var tail = href.replace(/^#\/?building\/?/, '');
          return goto('/buildings/' + normalizeBuildingSlug(safeSeg(tail)));
        }

        try{
          var u = new URL(href, location.href);
          var m = u.pathname.match(/^\/(en|ko|ja|tw|zh-tw|zh-TW)\/buildings\/([^\/]+)\.html$/);
          if (m){
            e.preventDefault();
            return goto('/buildings/' + normalizeBuildingSlug(m[2]));
          }
        }catch(_){}
      }, true);
    }

    function applyBuildingsIndexHead(doc){
      if (!doc || !doc.head) return;

      try {
        var links = doc.head.querySelectorAll('link[rel="stylesheet"][href]');
        for (var i=0;i<links.length;i++){
          var href = links[i].getAttribute('href');
          if (!href) continue;
          try { window.ensureCSS && window.ensureCSS(href); } catch(_){}
        }
      } catch(_){}

      try {
        var cssAll = '';
        var styles = doc.head.querySelectorAll('style');
        for (var j=0;j<styles.length;j++){
          var cssText = styles[j].textContent || '';
          if (!cssText.trim()) continue;
          cssAll += '\n' + scopeCssToContent(cssText);
        }

        var old = document.getElementById('bld-index-style');
        if (old && old.parentNode) old.parentNode.removeChild(old);

        if (cssAll.trim()){
          var st = document.createElement('style');
          st.id = 'bld-index-style';
          st.textContent = cssAll;
          document.head.appendChild(st);
        }
      } catch(_){}
    }

    async function mountBuildingStatic(root, html, pageURL){
      if (window.KD_HTML && typeof window.KD_HTML.mount === 'function') {
        await window.KD_HTML.mount(root, html, {
          pageURL: pageURL,
          preferWrap: true,
          scopeCSS: true,
          scopeSelector: '#content',
          ensureCommonCSS: '/css/building-detail.css',
          afterMount: async function(){
            try {
              var scope = (root && root.shadowRoot) ? root.shadowRoot : root;
              if (window.KD_BUILDING_DETAIL_INIT) window.KD_BUILDING_DETAIL_INIT(scope);
            } catch(_) {}
          }
        });
        return { doc: null };
      }

      root.innerHTML = htmlBodyOnly(html);
      try {
        if (window.KD_BUILDING_DETAIL_INIT) window.KD_BUILDING_DETAIL_INIT(root);
      } catch(_) {}
      return { doc: null };
    }

    async function renderStaticAssetPage(el, token, opts) {
      opts = opts || {};
      el.innerHTML = '<div class="loading" data-i18n="common.loading">Loading…</div>';

      var html = await loadHTMLCached(opts.html || []);
      if (isStale(token)) return false;

      if (!html) {
        el.innerHTML =
          '<div class="placeholder">' +
            '<h2>' + (opts.fallbackTitle || 'Not Found') + '</h2>' +
            '<p class="muted">' + (opts.fallbackText || 'Missing page file.') + '</p>' +
          '</div>';
        apply(el);
        return false;
      }

      el.innerHTML = htmlBodyOnly(html);

      var cssList = opts.css || [];
      for (var i = 0; i < cssList.length; i++) {
        try { if (window.ensureCSS) await window.ensureCSS(cssList[i]); } catch (e) { console.error(e); }
      }

      var jsList = opts.js || [];
      for (var j = 0; j < jsList.length; j++) {
        try { await _loadScriptOnce(jsList[j]); } catch (e2) { console.error(e2); }
      }

      if (isStale(token)) return false;

      if (opts.titleKey || opts.titleFallback) {
        setTitle(opts.titleKey || '', opts.titleFallback || document.title);
      }

      apply(el);
      window.scrollTo({ top: 0 });
      focusMain(el);
      return true;
    }

    var routes = {
      '/': {
        title: '홈 - KingshotData.kr',
        render: async function (el) {
          var token = newRenderToken();

          try {
            if (window.I18N && window.I18N.loadNamespace) {
              await window.I18N.loadNamespace('home');
            } else if (window.I18N && window.I18N.loadNamespaces) {
              await window.I18N.loadNamespaces(['home']);
            }
            if (window.I18N && window.I18N.ready) {
              await window.I18N.ready();
            }
          } catch (e) {}

          if (isStale(token)) return;

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
                        (iconImg ? iconImg(t(c.t), c.img) : '') +
                      '</div>' +
                      '<div class="card__body">' +
                        '<div class="card__title" data-i18n="' + c.t + '">' + t(c.t) + '</div>' +
                        '<div class="card__subtitle" data-i18n="' + c.d + '">' + t(c.d) + '</div>' +
                      '</div>' +
                    '</a>';
                  }).join('') +
                '</div>' +
                '<div id="home-waracademy-banner-mount" hidden></div>' +
              '</section>' +
            '</div>';

          if (isStale(token)) return;

          try {
            await mountHomeWaracademyBanner(el.querySelector('#home-waracademy-banner-mount'));
          } catch (e2) {
            console.error('[home] banner mount isolated error:', e2);
          }

          if (isStale(token)) return;

          apply(el);
          setTitle('title.home', '홈 - KingshotData.kr');
          window.scrollTo({ top: 0 });
          focusMain(el);

          if (!el.__kdHomeLangBound) {
            el.__kdHomeLangBound = true;

            var __homeLangTimer = null;
            document.addEventListener('i18n:changed', function () {
              try {
                var p = location.pathname.replace(/\/+$/, '');
                if (p !== '' && p !== '/') return;
              } catch (_) {}

              if (__homeLangTimer) clearTimeout(__homeLangTimer);
              __homeLangTimer = setTimeout(function () {
                try { routes['/'].render(el); } catch (_) {}
              }, 50);
            });
          }
        }
      },

      '/home': {
        title: '홈 - KingshotData.kr',
        render: async function () {
          goto('/', true);
        }
      },

      '/buildings': {
        title: 'Buildings - KingshotData.kr',
        render: async function (el) {
          var token = newRenderToken();

          try { if (window.I18N && window.I18N.loadNamespace) { await window.I18N.loadNamespace('buildings'); } } catch(e) {}

          var lang = getCurrentLang();
          el.innerHTML = '<div class="loading" data-i18n="common.loading">Loading…</div>';

          var cands = [
            '/' + lang + '/buildings/index.html',
            '/' + lang + '/buildings/',
            '/' + lang + '/buildings.html'
          ];

          if (lang === 'zh-tw') {
            cands.push('/zh-TW/buildings/index.html');
            cands.push('/zh-TW/buildings.html');
          }

          var html = await loadHTMLCached(cands);
          if (isStale(token)) return;

          if (!html) {
            el.innerHTML =
              '<div class="placeholder">' +
                '<h2>Not Found</h2>' +
                '<p class="muted">Missing: ' + cands.join(' , ') + '</p>' +
              '</div>';
            return;
          }

          try {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            applyBuildingsIndexHead(doc);

            var main = doc.querySelector('main') || doc.body;
            el.innerHTML = main ? main.innerHTML : htmlBodyOnly(html);

            var title = (doc.querySelector('title') && doc.querySelector('title').textContent) || '';
            if (title) document.title = title;

            var desc = doc.querySelector('meta[name="description"]');
            if (desc && desc.content) setMetaTag('description', desc.content);

            var can = doc.querySelector('link[rel="canonical"]');
            if (can && can.href) setCanonical(can.href);
          } catch(eDoc){
            el.innerHTML = htmlBodyOnly(html);
          }

          bindBuildingsListLinksOnce(el);

          apply(el);
          window.scrollTo({ top: 0 });
          focusMain(el);

          if (!el.__kdBuildingsLangBound) {
            el.__kdBuildingsLangBound = true;

            var __bldLangTimer = null;
            document.addEventListener('i18n:changed', function () {
              try {
                var p = location.pathname.replace(/\/+$/, '');
                if (p !== '/buildings') return;
              } catch (_) {}

              if (__bldLangTimer) clearTimeout(__bldLangTimer);
              __bldLangTimer = setTimeout(function () {
                try { routes['/buildings'].render(el); } catch (_) {}
              }, 80);
            });
          }
        }
      },

      '/building-static': {
        title: 'Building - KingshotData.kr',
        render: async function (el, rest, __forcedLang) {
          var token = newRenderToken();

          var slug = safeSeg((rest || '').split('/').filter(Boolean)[0] || '');
          slug = normalizeBuildingSlug(slug);
          if (!slug) { goto('/buildings'); return; }

          var lang = normLangCode(__forcedLang) || getCurrentLang();

          el.innerHTML = '<div class="loading" data-i18n="common.loading">Loading…</div>';

          var cands = [];

          if (slug === 'town-center') {
            cands.push('/' + lang + '/buildings/town-center.html');
            cands.push('/' + lang + '/building/town-center.html');
            cands.push('/' + lang + '/buildings/towncenter.html');
            cands.push('/' + lang + '/building/towncenter.html');
          } else {
            cands.push('/' + lang + '/buildings/' + slug + '.html');
            cands.push('/' + lang + '/building/'  + slug + '.html');
          }

          if (slug === 'truegold-crucible') {
            cands.push('/' + lang + '/buildings/trugold-crucible.html');
            cands.push('/' + lang + '/buildings/tru-gold-crucible.html');
            cands.push('/' + lang + '/building/trugold-crucible.html');
          }

          if (slug === 'commandcenter') {
            cands.push('/' + lang + '/buildings/command-center.html');
            cands.push('/' + lang + '/building/command-center.html');
            cands.push('/' + lang + '/buildings/command.html');
            cands.push('/' + lang + '/building/command.html');
          }

          var html = await loadHTMLCached(cands);
          if (isStale(token)) return;

          if (!html) {
            el.innerHTML =
              '<div class="placeholder">' +
                '<h2>Not Found</h2>' +
                '<p class="muted">Missing: ' + cands.map(function(x){return x;}).join(' , ') + '</p>' +
              '</div>';
            return;
          }

          var pageURL = '/' + lang + '/buildings/' + slug + '.html';
          if (slug === 'town-center') pageURL = '/' + lang + '/buildings/town-center.html';

          await mountBuildingStatic(el, html, pageURL);
          if (isStale(token)) return;

          try { apply(el); } catch(e){}

          window.scrollTo({ top: 0 });
          focusMain(el);
        }
      },

      '/waracademy': {
        title: 'War Academy - KingshotData.kr',
        render: async function (el) {
          var token = newRenderToken();

          var ok = await renderStaticAssetPage(el, token, {
            html: [
              'pages/waracademy.html',
              '/pages/waracademy.html'
            ],
            css: [
              '/css/waracademy.css'
            ],
            js: [
              (window.v ? window.v('/js/pages/waracademy.js') : '/js/pages/waracademy.js')
            ],
            titleKey: 'waracademy.page_title',
            titleFallback: 'War Academy - KingshotData.kr',
            fallbackTitle: 'War Academy',
            fallbackText: 'pages/waracademy.html을 찾을 수 없습니다.'
          });

          if (!ok || isStale(token)) return;

          try {
            if (typeof window.initWarAcademy === 'function') {
              setTimeout(function () {
                try { window.initWarAcademy(); } catch (e) { console.error(e); }
              }, 0);
            }
          } catch (e2) {
            console.error(e2);
          }

          if (!el.__waracademyLinkBound) {
            el.__waracademyLinkBound = true;

            el.addEventListener('click', function (e) {
              var a = e.target.closest && e.target.closest('a[href]');
              if (!a) return;

              var href = a.getAttribute('href') || '';
              if (!href) return;
              if (a.target === '_blank' || a.hasAttribute('download')) return;
              if (/^https?:\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')) return;

              if (href === '/waracademy' || href === '/war-academy' || href === 'pages/waracademy.html' || href === '/pages/waracademy.html') {
                e.preventDefault();
                goto('/waracademy');
              }
            }, true);
          }
        }
      },

      '/heroes': {
        title: '영웅 - KingshotData.kr',
        render: async function (el) {
          var token = newRenderToken();
          el.innerHTML = '<div class="loading" data-i18n="common.loading">Loading…</div>';

          var html = await loadHTMLCached(['pages/heroes.html','/pages/heroes.html','heroes.html','/heroes.html']);
          if (isStale(token)) return;

          if (!html) {
            el.innerHTML = '<div class="placeholder"><h2 data-i18n="heroes.title">영웅</h2><p class="muted" data-i18n="heroes.missing">heroes.html을 찾을 수 없습니다.</p></div>';
            return;
          }
          el.innerHTML = htmlBodyOnly(html);

          if (!el.__heroesLinkBound) {
            el.addEventListener('click', function (e) {
              var a = e.target.closest && e.target.closest('a[href^="#/hero/"]');
              if (a) { e.preventDefault(); return goto('/hero/' + a.getAttribute('href').replace(/^#\/hero\/?/, '')); }
              a = e.target.closest && e.target.closest('a[href^="/heroes/"]');
              if (a) { e.preventDefault(); return goto('/hero/' + a.getAttribute('href').replace(/^\/heroes\/?/, '')); }
            });
            el.__heroesLinkBound = true;
          }

          var jsCands = [ (window.v ? window.v('/js/pages/heroes.js') : '/js/pages/heroes.js') ];
          var loadedAny = false;
          for (var i=0;i<jsCands.length;i++){
            try { await _loadScriptOnce(jsCands[i]); loadedAny = true; break; } catch(e){}
          }
          if (isStale(token)) return;

          if (!loadedAny) {
            el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="heroes.loadFail">heroes.js 로드 실패</div>');
            return;
          }
          if (typeof window.initHeroes === 'function') {
            try { window.initHeroes(); } catch (e2) { console.error(e2); }
          } else {
            el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="heroes.noInit">initHeroes()가 없습니다.</div>');
          }

          setTitle('title.heroes', '영웅 - KingshotData.kr');
          apply(el);
          window.scrollTo({ top: 0 });
          focusMain(el);
        }
      },

      '/hero': {
        title: '영웅 상세 - KingshotData.kr',
        render: async function (el, rest) {
          var token = newRenderToken();
          var slug = decodeURIComponent((rest || '').split('/').filter(Boolean)[0] || '');
          el.innerHTML =
            '<section class="container">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">' +
                '<h1 class="page-title" id="hero-title" data-i18n="heroes.detail.title">^_^</h1>' +
                '<a class="btn btn-icon" href="/heroes" data-smart-back="/heroes" aria-label="Back" title="Back">←</a>' +
              '</div>' +
              '<div id="hero-root" class="hero-detail"></div>' +
            '</section>';

          apply(el);

          var jsCands = [ (window.v ? window.v('/js/pages/hero.js') : '/js/pages/hero.js') ];
          var ok = false;
          for (var i=0;i<jsCands.length;i++){
            try { await _loadScriptOnce(jsCands[i]); ok = true; break; } catch(e){}
          }
          if (isStale(token)) return;

          if (!ok) {
            el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="hero.loadFail">hero.js 로드 실패</div>');
            return;
          }

          if (typeof window.initHero === 'function') {
            try { await window.initHero(slug); } catch(e2){ console.error(e2); }
          } else {
            el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="hero.noInit">initHero()가 없습니다.</div>');
          }

          apply(el);
          setTitle('heroes.detail.pageTitle','영웅 상세 - KingshotData.kr');
          window.scrollTo({ top: 0 });
          focusMain(el);
        }
      },

      '/guides': {
        title: '가이드 - KingshotData.kr',
        render: async function (el, rest) {
          var token = newRenderToken();
          var trail = (rest || '').split('/').filter(Boolean).join('/');

          try { if (window.I18N && window.I18N.loadNamespace) { await window.I18N.loadNamespace('guides'); } } catch(e) {}

          async function loadGuidesDeps() {
            var cssCands = ['/css/guides.css', 'css/guides.css'];
            for (var i=0;i<cssCands.length;i++){ try { window.ensureCSS && await window.ensureCSS(cssCands[i]); break; } catch(e){} }
            var jsCands = [ '/js/pages/guides.js' ];
            for (var j=0;j<jsCands.length;j++){ try { await _loadScriptOnce(jsCands[j]); break; } catch(e){} }
          }

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
              apply(el);
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

            setTitle('guides.title', '가이드 - KingshotData.kr');
            window.scrollTo({ top: 0 });
            focusMain(el);
            return;
          }

          el.innerHTML = '<div class="loading" data-i18n="common.loading">Loading…</div>';
          var listHTML = await loadHTMLCached(['pages/guides.html', '/pages/guides.html', '/pages/guide.html']);
          if (isStale(token)) return;

          el.innerHTML = listHTML ? htmlBodyOnly(listHTML)
            : '<div class="placeholder"><h2 data-i18n="guides.title">가이드</h2><p class="muted" data-i18n="guides.missing">guides.html을 찾을 수 없습니다.</p></div>';

          await loadGuidesDeps();
          if (isStale(token)) return;

          if (window.I18N && window.I18N.applyTo) window.I18N.applyTo(el);
          if (window.GUIDES_apply) await window.GUIDES_apply(el);

          setTitle('guides.title', '가이드 - KingshotData.kr');
          window.scrollTo({ top: 0 });
          focusMain(el);
        }
      },

      '/database': {
        title: '데이터베이스 - KingshotData.kr',
        render: async function (el) {
          var token = newRenderToken();
          el.innerHTML = '<div class="loading" data-i18n="common.loading">Loading…</div>';

          var html = await loadHTMLCached(['pages/database.html','/pages/database.html','database.html','/database.html']);
          if (isStale(token)) return;

          if (!html) {
            el.innerHTML = '<div class="placeholder"><h2 data-i18n="database.title">데이터베이스</h2><p class="muted" data-i18n="database.missing">database.html을 찾을 수 없습니다.</p></div>';
            apply(el);
            return;
          }

          el.innerHTML = htmlBodyOnly(html);

          var jsCands = [ (window.v ? window.v('/js/pages/database.js') : '/js/pages/database.js') ];
          var loadedAny = false;
          for (var i=0;i<jsCands.length;i++){
            try { await _loadScriptOnce(jsCands[i]); loadedAny = true; break; } catch(e){}
          }
          if (isStale(token)) return;

          if (!loadedAny) {
            el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="database.loadFail">database.js 로드 실패</div>');
            apply(el);
            return;
          }

          if (typeof window.initDatabase === 'function') {
            try { await window.initDatabase(); } catch(e2){ console.error(e2); }
          } else {
            el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="database.noInit">initDatabase()가 없습니다.</div>');
          }

          setTitle('title.database', '데이터베이스 - KingshotData.kr');
          apply(el);
          window.scrollTo({ top: 0 });
          focusMain(el);
        }
      },

      '/db': {
        title: 'KingshotData.kr',
        render: async function (el, rest) {
          var token = newRenderToken();
          var parts  = (rest || '').split('/').filter(Boolean);

          function sanitizeSeg(s) {
            return String(s)
              .replace(/\\/g,'/')
              .replace(/(^|\/)\.\.(?=\/|$)/g,'')
              .replace(/\/{2,}/g,'/')
              .replace(/^\//,'')
              .replace(/\0/g,'');
          }

          var folderRaw = parts[0] ? decodeURIComponent(parts[0]) : '';
          var fileRaw   = parts[1] ? decodeURIComponent(parts.slice(1).join('/')) : '';
          if (!folderRaw) { goto('/database'); return; }

          var folder = sanitizeSeg(folderRaw === 'hero-exclusive-gear' ? 'widgets' : folderRaw);
          var file   = sanitizeSeg(fileRaw);

          try {
            if (window.I18N && typeof window.I18N.init === 'function') {
              await window.I18N.init({ namespaces: ['db'] });
            } else if (window.I18N && typeof window.I18N.loadNamespaces === 'function') {
              await window.I18N.loadNamespaces(['db']);
            }
          } catch (e) {}

          await renderDbDetail(el, folder, file);
          if (isStale(token)) return;

          el.insertAdjacentHTML('afterbegin',
            '<div style="display:flex;justify-content:flex-end;margin-bottom:8px;">' +
              '<a class="btn btn-icon" href="/database" data-smart-back="/database" aria-label="Back" title="Back">←</a>' +
            '</div>'
          );

          if (window.I18N && window.I18N.applyTo) window.I18N.applyTo(el);
          window.scrollTo({ top: 0 });
          focusMain(el);
        }
      },

      '/privacy': {
        title: '개인정보처리방침 - KingshotData.kr',
        render: async function (el) {
          var token = newRenderToken();
          el.innerHTML = '<div class="loading" data-i18n="common.loading">Loading…</div>';
          var html = await loadHTMLCached(['pages/privacy.html','/pages/privacy.html','privacy.html','/privacy.html']);
          if (isStale(token)) return;
          el.innerHTML = html ? htmlBodyOnly(html)
            : '<div class="placeholder"><h2 data-i18n="privacy.title">개인정보처리방침</h2><p class="muted" data-i18n="privacy.missing">privacy.html을 찾을 수 없습니다.</p></div>';
          setTitle('title.privacy', '개인정보처리방침 - KingshotData.kr');
          apply(el);
          window.scrollTo({ top: 0 });
          focusMain(el);
        }
      },

      '/about': {
        title: '소개 - KingshotData.kr',
        render: async function (el) {
          var token = newRenderToken();
          el.innerHTML = '<div class="loading" data-i18n="common.loading">Loading…</div>';
          var html = await loadHTMLCached(['pages/about.html','/pages/about.html','about.html','/about.html']);
          if (isStale(token)) return;
          el.innerHTML = html ? htmlBodyOnly(html)
            : '<div class="placeholder"><h2 data-i18n="about.title">소개</h2><p class="muted" data-i18n="about.missing">about.html을 찾을 수 없습니다.</p></div>';
          setTitle('title.about', '소개 - KingshotData.kr');
          apply(el);
          window.scrollTo({ top: 0 });
          focusMain(el);
        }
      }
    };

    routes['/guide'] = {
      title: '가이드 - KingshotData.kr',
      render: function (el, rest) { return routes['/guides'].render(el, rest); }
    };

    routes['/war-academy'] = {
      title: 'War Academy - KingshotData.kr',
      render: function (el, rest) { return routes['/waracademy'].render(el, rest); }
    };

    var PREFETCH_MAP = {
      '/':           { js: [], html: ['/tools/home-waracademy-banner.html', 'tools/home-waracademy-banner.html'] },
      '/heroes':     { js: ['/js/pages/heroes.js'], html: ['pages/heroes.html','/pages/heroes.html'] },
      '/database':   { js: ['/js/pages/database.js'], html: ['pages/database.html','/pages/database.html'] },
      '/guides':     { js: ['/js/pages/guides.js'], css: ['/css/guides.css'], html: ['pages/guides.html','/pages/guides.html'] },
      '/waracademy': { js: ['/js/pages/waracademy.js'], css: ['/css/waracademy.css'], html: ['pages/waracademy.html','/pages/waracademy.html'] }
    };

    function prefetchFor(href) {
      try {
        var path = new URL(href, location.href).pathname;
        if (path === '/home') path = '/';
        var cfg = PREFETCH_MAP[path];
        if (!cfg) return;
        if (cfg.css && window.ensureCSS) cfg.css.forEach(function(h){ window.ensureCSS(h); });
        if (cfg.js) cfg.js.forEach(function(s){ _loadScriptOnce(s); });
        if (cfg.html) cfg.html.forEach(function(h){ loadHTMLCached([h]); });
      } catch (e) {}
    }

    document.addEventListener('mouseover', function (e) {
      var a = e.target.closest && e.target.closest('a.card--category, a[href="/"], a[href="/buildings"], a[href="/heroes"], a[href="/database"], a[href="/guides"], a[href="/waracademy"], a[href="/war-academy"], a[href="/home"]');
      if (!a) return;
      prefetchFor(a.href);
    });

    return routes;
  };
})();
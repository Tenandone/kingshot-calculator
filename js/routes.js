(function () {
  const seenCSS = new Set();
  const seenJS  = new Set();
  const inflight = new Map();
  const ASSET_VER = window.__V || 'now';

  function canonical(url) {
    try {
      const u = new URL(url, location.href);
      u.searchParams.delete('v');
      return u.href;
    } catch (e) {
      return String(url);
    }
  }

  function v(url) {
    if (!url) return url;
    if (/^(data:|blob:|#)/i.test(url)) return url;
    try {
      const u = new URL(url, location.href);
      u.searchParams.set('v', ASSET_VER);
      return (u.origin !== location.origin) ? u.href : (u.pathname + u.search + u.hash);
    } catch (e) {
      return url + (String(url).includes('?') ? '&' : '?') + 'v=' + ASSET_VER;
    }
  }
  if (!window.v) window.v = v;

  function escAttr(val) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(val);
    return String(val).replace(/["'\\\[\]\(\)\s]/g, '');
  }

  window.ensureCSS = window.ensureCSS || function (href) {
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

  window.ensureScript = window.ensureScript || function (src, opt) {
    opt = opt || {};
    const absKey = canonical(src);
    const selEnsured = 'script[data-ensured="' + escAttr(absKey) + '"]';
    if (seenJS.has(absKey) || document.querySelector(selEnsured)) return Promise.resolve();

    const inflightKey = 'js:' + absKey;
    if (inflight.has(inflightKey)) return inflight.get(inflightKey);

    const p = new Promise(function (res, rej) {
      const s = document.createElement('script');
      s.src = v(src);
      if (opt.type === 'module') {
        s.type = 'module';
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
    var h1 = el.querySelector('h1, [role="heading"]');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      try { h1.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  window.buildRoutes = function (deps) {
    deps = deps || {};
    var loadHTML = deps.loadHTML;
    var loadScriptOnce = deps.loadScriptOnce;
    var renderDbDetail = deps.renderDbDetail;
    var iconImg = deps.iconImg;

    var _loadScriptOnce = (typeof loadScriptOnce === 'function')
      ? loadScriptOnce
      : function (src, opt) { return window.ensureScript(src, opt); };

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

    function goto(path) {
      var url = String(path || '/');
      if (window.navigation && typeof window.navigation.navigate === 'function') {
        try { window.navigation.navigate(url); return; } catch (e) {}
      }
      history.pushState(null, '', url);
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

    function isNonExecutableScriptType(typeStr){
      var t0 = String(typeStr || '').trim().toLowerCase();
      if (t0 === 'application/ld+json') return true;
      if (t0 === 'application/json') return true;
      if (t0 === 'application/schema+json') return true;
      if (t0 && t0.indexOf('application/') === 0) return true;
      return false;
    }

    async function mountBuildingMain(root, html, pageURL){
      var doc = null;
      try { doc = new DOMParser().parseFromString(html, 'text/html'); } catch (eDoc) {}

      if(!doc || !doc.body){
        root.innerHTML = htmlBodyOnly(html);
        return { doc: null };
      }

      var main = doc.querySelector('main');
      if(!main){
        root.innerHTML = htmlBodyOnly(html);
        return { doc: doc };
      }

      try {
        var title = (doc.querySelector('title') && doc.querySelector('title').textContent) || '';
        if (title) document.title = title;

        var desc = doc.querySelector('meta[name="description"]');
        if (desc && desc.content) setMetaTag('description', desc.content);

        var can = doc.querySelector('link[rel="canonical"]');
        if (can && can.href) setCanonical(can.href);
        else if (pageURL) {
          try { setCanonical(new URL(pageURL, location.href).href); } catch(eCan){}
        }
      } catch(eMeta){}

      try {
        var links = doc.head ? doc.head.querySelectorAll('link[rel="stylesheet"][href]') : [];
        for (var i=0;i<links.length;i++){
          var href = links[i].getAttribute('href');
          if(!href) continue;
          try { await ensureCSS(href); } catch(eCss){}
        }
      } catch(eL){}

      try {
        var styles = doc.head ? doc.head.querySelectorAll('style') : [];
        var scopedAll = '';
        for (var j=0;j<styles.length;j++){
          var cssText = styles[j].textContent || '';
          if(!cssText.trim()) continue;
          scopedAll += '\n' + scopeCssToContent(cssText);
        }

        var old = document.getElementById('bld-scoped-style');
        if (old && old.parentNode) old.parentNode.removeChild(old);

        if (scopedAll.trim()) {
          var st = document.createElement('style');
          st.id = 'bld-scoped-style';
          st.textContent = scopedAll;
          document.head.appendChild(st);
        }
      } catch(eS){}

      root.innerHTML = main.innerHTML;

      try {
        var scripts = Array.prototype.slice.call(doc.querySelectorAll('script')) || [];
        var LOADED = (window.__BLD_SCRIPT_LOADED__ = window.__BLD_SCRIPT_LOADED__ || new Set());

        for (var k=0;k<scripts.length;k++){
          var sc = scripts[k];
          var src = sc.getAttribute && sc.getAttribute('src');
          var typeAttr = (sc.getAttribute && sc.getAttribute('type')) ? sc.getAttribute('type') : '';
          var type = String(typeAttr || '').trim();
          var isModule = (type === 'module');
          var hasNoModule = sc.hasAttribute && sc.hasAttribute('nomodule');

          if (!isModule && isNonExecutableScriptType(type)) continue;

          if (src){
            var abs = '';
            try { abs = new URL(src, location.href).href; } catch(eU){ abs = src; }
            if (LOADED.has(abs)) continue;
            try { await ensureScript(src, { type: isModule ? 'module' : undefined }); } catch(eExt){}
            LOADED.add(abs);
            continue;
          }

          var code = (sc.textContent || '');
          if(!code.trim()) continue;

          var s = document.createElement('script');
          if(isModule){
            s.type = 'module';
            s.text = code + '\n//# sourceURL=building:inline-module:' + k;
            root.appendChild(s);
            continue;
          }

          s.text =
            '(function(window, document){\n' +
            code +
            '\n}).call(window, window, document);\n' +
            '//# sourceURL=building:inline:' + k;

          if(hasNoModule) s.noModule = true;
          root.appendChild(s);
        }
      } catch(eRun){}

      if (document.documentElement.classList.contains('enhanced')) {
        try { root.classList.add('enhanced'); } catch(_) {}
      }

      return { doc: doc };
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
        var cur = (window.I18N && (I18N.current || I18N.lang)) || '';
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
          try { ensureCSS(href); } catch(_){}
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

      try {
        var htmlCls = document.documentElement.classList;
        if (!htmlCls.__ksEnhancedPatched) {
          htmlCls.__ksEnhancedPatched = true;
          var _add = htmlCls.add.bind(htmlCls);
          htmlCls.add = function(){
            for (var i=0;i<arguments.length;i++){
              if (arguments[i] === 'enhanced') {
                try { document.getElementById('content')?.classList.add('enhanced'); } catch(_) {}
              }
            }
            return _add.apply(htmlCls, arguments);
          };
        }
      } catch(_){}
    }

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

          await mountBuildingMain(el, html, pageURL);
          if (isStale(token)) return;

          try { apply(el); } catch(e){}

          window.scrollTo({ top: 0 });
          focusMain(el);
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

          var jsCands = [ v('/js/pages/heroes.js') ];
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

          var jsCands = [ v('/js/pages/hero.js') ];
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
            for (var i=0;i<cssCands.length;i++){ try { await ensureCSS(cssCands[i]); break; } catch(e){} }
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

          var jsCands = [ v('/js/pages/database.js') ];
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

    var PREFETCH_MAP = {
      '/heroes':     { js: ['/js/pages/heroes.js'], html: ['pages/heroes.html','/pages/heroes.html'] },
      '/database':   { js: ['/js/pages/database.js'], html: ['pages/database.html','/pages/database.html'] },
      '/guides':     { js: ['/js/pages/guides.js'], css: ['/css/guides.css'], html: ['pages/guides.html','/pages/guides.html'] }
    };

    function prefetchFor(href) {
      try {
        var path = new URL(href, location.href).pathname;
        var cfg = PREFETCH_MAP[path];
        if (!cfg) return;
        if (cfg.css) cfg.css.forEach(function(h){ ensureCSS(h); });
        if (cfg.js)  cfg.js.forEach(function(s){ ensureScript(s); });
        if (cfg.html) cfg.html.forEach(function(h){ loadHTMLCached([h]); });
      } catch (e) {}
    }

    document.addEventListener('mouseover', function (e) {
      var a = e.target.closest && e.target.closest('a.card--category, a[href="/buildings"], a[href="/heroes"], a[href="/database"], a[href="/guides"]');
      if (!a) return;
      prefetchFor(a.href);
    });

    return routes;
  };
})();
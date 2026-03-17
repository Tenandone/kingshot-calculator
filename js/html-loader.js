// =========================================================
// /js/html-loader.js — FULL FINAL OPTIMIZED
// NO IFRAME / COMMON CSS WINS / SHADOWROOT-SAFE / PAGE INIT RE-RUN
//
// 목표:
//  - 정적 HTML을 SPA에 마운트
//  - 공통 CSS가 마지막에 우선 적용
//  - 정적 HTML의 inline <style>은 #content 기준으로 스코프
//  - Shadow DOM / 일반 DOM 모두 안전하게 동작
//  - 외부 script는 중복 로드 방지
//  - 하지만 이미 로드된 페이지 전용 JS의 init 함수는 마운트마다 다시 실행
//
// 포함:
//  - title/meta/canonical 반영
//  - 외부 stylesheet 로드
//  - inline style 스코프 처리
//  - #anchor 내부 링크 홈 튐 방지
//  - 모바일 카드 fallback
//  - script 순서 실행
//  - guides-index 재초기화 지원
//
// 제거:
//  - KD_GUIDE_ENGINE 관련 레거시 코드 전부 제거
// =========================================================
(function () {
  'use strict';

  if (!window.ensureCSS || !window.ensureScript) {
    console.warn('[html-loader] ensureCSS/ensureScript not found. Load /js/asset-loader.js first.');
  }

  // -------------------------------------------------------
  // small helpers
  // -------------------------------------------------------
  function getExecHost(root) {
    return (root && root.shadowRoot) ? root.shadowRoot : root;
  }

  function htmlBodyOnly(html) {
    if (!html) return html;
    try {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      return doc && doc.body ? doc.body.innerHTML : html;
    } catch (e) {
      return html;
    }
  }

  function setMetaTag(name, content) {
    if (!content) return;
    var m = document.querySelector('meta[name="' + name + '"]');
    if (!m) {
      m = document.createElement('meta');
      m.setAttribute('name', name);
      document.head.appendChild(m);
    }
    m.setAttribute('content', content);
  }

  function setCanonical(href) {
    if (!href) return;
    var link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = href;
  }

  function isNonExecutableScriptType(typeStr) {
    var t0 = String(typeStr || '').trim().toLowerCase();
    if (t0 === 'application/ld+json') return true;
    if (t0 === 'application/json') return true;
    if (t0 === 'application/schema+json') return true;
    if (t0 && t0.indexOf('application/') === 0) return true;
    return false;
  }

  // -------------------------------------------------------
  // inline CSS scope
  // html.js / html.enhanced selector safe
  // -------------------------------------------------------
  function scopeCssToContent(cssText, scopeSelector) {
    var css = String(cssText || '');
    var scope = scopeSelector || '#content';

    css = css.replace(/:root\s*\{/g, scope + '{');

    var keyframes = [];
    css = css.replace(/@(-webkit-)?keyframes[^{]*\{[\s\S]*?\}\s*\}/g, function (m) {
      var idx = keyframes.push(m) - 1;
      return '___KD_KEYFRAMES_' + idx + '___';
    });

    css = css.replace(/(^|})\s*([^{@}][^{]*)\{/g, function (m, brace, sel) {
      var s = (sel || '').trim();
      if (!s) return m;
      if (s.indexOf(scope) === 0) return brace + ' ' + sel + '{';

      var scoped = s.split(',').map(function (part) {
        part = (part || '').trim();
        if (!part) return part;

        if (part.indexOf('.js ') === 0 || part === '.js') {
          part = 'html.js' + part.slice(3);
        }
        if (part.indexOf('.enhanced ') === 0 || part === '.enhanced') {
          part = 'html.enhanced' + part.slice(9);
        }

        if (
          part.indexOf('html.') === 0 ||
          part.indexOf('html[') === 0 ||
          part.indexOf('html#') === 0 ||
          part === 'html'
        ) {
          var sp = part.indexOf(' ');
          if (sp === -1) return part + ' ' + scope;
          return part.slice(0, sp) + ' ' + scope + ' ' + part.slice(sp + 1);
        }

        part = part.replace(/^\s*html\b(?!\.)/, scope).replace(/^\s*body\b/, scope);

        if (part.indexOf(scope) === 0) return part;
        return scope + ' ' + part;
      }).join(', ');

      return brace + ' ' + scoped + '{';
    });

    css = css.replace(/___KD_KEYFRAMES_(\d+)___/g, function (_m, n) {
      return keyframes[parseInt(n, 10)] || '';
    });

    return css;
  }

  // -------------------------------------------------------
  // dedupe
  // -------------------------------------------------------
  var SEEN_INLINE_STYLE = window.__KD_SEEN_INLINE_STYLE || (window.__KD_SEEN_INLINE_STYLE = new Set());
  var LOADED_SCRIPT_ABS = window.__KD_LOADED_SCRIPT_ABS || (window.__KD_LOADED_SCRIPT_ABS = new Set());

  // -------------------------------------------------------
  // remove headers
  // -------------------------------------------------------
  function removeHeadersFrom(node, selectors) {
    if (!node || !node.querySelectorAll) return;

    var list = Array.isArray(selectors) && selectors.length ? selectors : [
      'header',
      '.header',
      '.site-header',
      '.global-header',
      '.topbar',
      '.top-bar',
      '.navbar',
      '.nav-bar',
      '.main-header',
      '#header',
      '#site-header',
      '[data-role="header"]',
      '[role="banner"]'
    ];

    try {
      for (var i = 0; i < list.length; i++) {
        var els = node.querySelectorAll(list[i]);
        for (var j = 0; j < els.length; j++) {
          if (els[j] && els[j].parentNode) els[j].parentNode.removeChild(els[j]);
        }
      }
    } catch (_) {}
  }

  // -------------------------------------------------------
  // #anchor click fix
  // -------------------------------------------------------
  function ensureAnchorFix(root) {
    var scopeRoot = getExecHost(root);
    if (!scopeRoot || scopeRoot.__kd_anchor_fix__) return;
    scopeRoot.__kd_anchor_fix__ = true;

    scopeRoot.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      var a = t.closest('a[href]');
      if (!a) return;

      var href = String(a.getAttribute('href') || '').trim();
      if (!href) return;
      if (href.charAt(0) !== '#') return;
      if (href === '#' || href.length < 2) return;

      var el = null;
      try { el = scopeRoot.querySelector(href); } catch (_) { el = null; }
      if (!el) return;

      e.preventDefault();
      e.stopPropagation();

      try {
        if (history && history.replaceState) history.replaceState(null, '', href);
        else location.hash = href;
      } catch (_) {}

      try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
    }, true);
  }

  // -------------------------------------------------------
  // building card fallback target
  // -------------------------------------------------------
  function isCardFixTarget(options) {
    try {
      var url = (options && options.pageURL) ? String(options.pageURL) : '';
      if (!url) return false;

      var m = url.match(/\/buildings\/([^\/?#]+)\.html(\?|#|$)/i);
      if (!m) return false;

      var slug = String(m[1] || '').toLowerCase();
      return (
        slug === 'town-center' ||
        slug === 'academy' ||
        slug === 'embassy' ||
        slug === 'commandcenter' ||
        slug === 'command-center'
      );
    } catch (_) {
      return false;
    }
  }

  // -------------------------------------------------------
  // mobile cards fallback
  // -------------------------------------------------------
  function forceMobileCardsIfEmpty(root, options) {
    try {
      if (!window.matchMedia || !window.matchMedia('(max-width: 900px)').matches) return;
      if (!isCardFixTarget(options)) return;

      var scopeRoot = getExecHost(root);
      if (!scopeRoot || !scopeRoot.querySelector) return;

      document.documentElement.classList.add('enhanced');

      var reqCards = scopeRoot.querySelector('#req-cards');
      var tgCards = scopeRoot.querySelector('#tg-cards');

      if (!reqCards && !tgCards) return;

      var hasReq = !!(reqCards && reqCards.children && reqCards.children.length);
      var hasTg = !!(tgCards && tgCards.children && tgCards.children.length);
      if (hasReq || hasTg) return;

      function isDash(v) {
        var t = String(v == null ? '' : v).trim();
        return t === '' || t === '–' || t === '-';
      }

      function img(src) {
        return '<img class="icoimg" src="' + src + '" alt="" aria-hidden="true" width="18" height="18" loading="lazy" decoding="async">';
      }

      function resItem(src, label, value) {
        return ''
          + '<div class="res-item">'
          +   '<div class="res-left">' + img(src) + '<div class="res-label">' + label + '</div></div>'
          +   '<div class="res-val">' + value + '</div>'
          + '</div>';
      }

      var ICON = {
        bread: '/img/bread.webp',
        wood: '/img/wood.webp',
        stone: '/img/stone.webp',
        iron: '/img/iron.webp',
        truegold: '/img/truegold.webp',
        tempered: '/img/tempered-truegold.webp'
      };

      function mapHeaderIdx(table) {
        var head = table ? table.querySelectorAll('thead th') : null;
        var idx = {
          bread: -1, wood: -1, stone: -1, iron: -1,
          truegold: -1, tempered: -1,
          time: -1, power: -1, maxhero: -1
        };

        if (!head || !head.length) return idx;

        for (var i = 0; i < head.length; i++) {
          var tx = String(head[i].textContent || '').toLowerCase();
          if (tx.indexOf('bread') !== -1) idx.bread = i;
          if (tx.indexOf('wood') !== -1) idx.wood = i;
          if (tx.indexOf('stone') !== -1) idx.stone = i;
          if (tx.indexOf('iron') !== -1) idx.iron = i;
          if (tx.indexOf('truegold') !== -1) idx.truegold = i;
          if (tx.indexOf('tempered') !== -1) idx.tempered = i;
          if (tx.indexOf('time') !== -1) idx.time = i;
          if (tx.indexOf('power') !== -1) idx.power = i;
          if (tx.indexOf('max hero') !== -1) idx.maxhero = i;
        }

        return idx;
      }

      var reqTable = scopeRoot.querySelector('#req-table');
      if (reqTable && reqCards) {
        var idx1 = mapHeaderIdx(reqTable);
        var rows = reqTable.querySelectorAll('tbody tr');
        var html = '';

        for (var r = 0; r < rows.length; r++) {
          var tds = rows[r].querySelectorAll('td');
          if (!tds || tds.length < 6) continue;

          var level = String(tds[0].textContent || '').trim();
          var reqHTML = (tds[1] ? tds[1].innerHTML : '').trim();

          function getReq(idx) {
            return (idx >= 0 && tds[idx]) ? String(tds[idx].textContent || '').trim() : '–';
          }

          var bread = getReq(idx1.bread);
          var wood = getReq(idx1.wood);
          var stone = getReq(idx1.stone);
          var iron = getReq(idx1.iron);
          var time = getReq(idx1.time);
          var power = getReq(idx1.power);
          var maxH = getReq(idx1.maxhero);

          var res = '';
          if (!isDash(bread)) res += resItem(ICON.bread, 'Bread', bread);
          if (!isDash(wood))  res += resItem(ICON.wood, 'Wood', wood);
          if (!isDash(stone)) res += resItem(ICON.stone, 'Stone', stone);
          if (!isDash(iron))  res += resItem(ICON.iron, 'Iron', iron);

          var foot = '';
          if (!isDash(time))  foot += '<span class="badge"><span>Time: ' + time + '</span></span>';
          if (!isDash(power)) foot += '<span class="badge"><span>Power: ' + power + '</span></span>';
          if (!isDash(maxH))  foot += '<span class="badge"><span>Max Hero: ' + maxH + '</span></span>';

          html += ''
            + '<article class="card">'
            +   '<div class="card-head">'
            +     '<h3 class="card-title">Level ' + level + '</h3>'
            +     '<div class="card-meta">' + (isDash(time) ? '' : ('Time<br><strong>' + time + '</strong>')) + '</div>'
            +   '</div>'
            +   '<div class="card-req"><strong>Requirements:</strong> ' + reqHTML + '</div>'
            +   (res ? '<div class="res-grid" aria-label="Resources">' + res + '</div>' : '')
            +   (foot ? '<div class="card-foot">' + foot + '</div>' : '')
            + '</article>';
        }

        if (html) reqCards.innerHTML = html;
      }

      var tgTable = scopeRoot.querySelector('#tg-table');
      if (tgTable && tgCards) {
        var idx2 = mapHeaderIdx(tgTable);
        var rows2 = tgTable.querySelectorAll('tbody tr');
        var html2 = '';

        for (var rr = 0; rr < rows2.length; rr++) {
          var td2 = rows2[rr].querySelectorAll('td');
          if (!td2 || td2.length < 6) continue;

          var lvl = String(td2[0].textContent || '').trim();
          var req2 = (td2[1] ? td2[1].innerHTML : '').trim();

          function getTg(idx) {
            return (idx >= 0 && td2[idx]) ? String(td2[idx].textContent || '').trim() : '–';
          }

          var tg = getTg(idx2.truegold);
          var tmp = getTg(idx2.tempered);
          var bread2 = getTg(idx2.bread);
          var wood2 = getTg(idx2.wood);
          var stone2 = getTg(idx2.stone);
          var iron2 = getTg(idx2.iron);
          var time2 = getTg(idx2.time);
          var pow2 = getTg(idx2.power);

          var res2 = '';
          if (!isDash(tg))     res2 += resItem(ICON.truegold, 'Truegold', tg);
          if (!isDash(tmp))    res2 += resItem(ICON.tempered, 'Tempered', tmp);
          if (!isDash(bread2)) res2 += resItem(ICON.bread, 'Bread', bread2);
          if (!isDash(wood2))  res2 += resItem(ICON.wood, 'Wood', wood2);
          if (!isDash(stone2)) res2 += resItem(ICON.stone, 'Stone', stone2);
          if (!isDash(iron2))  res2 += resItem(ICON.iron, 'Iron', iron2);

          var foot2 = '';
          if (!isDash(time2)) foot2 += '<span class="badge"><span>Time: ' + time2 + '</span></span>';
          if (!isDash(pow2))  foot2 += '<span class="badge"><span>Power: ' + pow2 + '</span></span>';

          html2 += ''
            + '<article class="card">'
            +   '<div class="card-head">'
            +     '<h3 class="card-title">' + lvl + '</h3>'
            +     '<div class="card-meta">' + (isDash(time2) ? '' : ('Time<br><strong>' + time2 + '</strong>')) + '</div>'
            +   '</div>'
            +   '<div class="card-req"><strong>Requirements:</strong> ' + req2 + '</div>'
            +   (res2 ? '<div class="res-grid" aria-label="Resources">' + res2 + '</div>' : '')
            +   (foot2 ? '<div class="card-foot">' + foot2 + '</div>' : '')
            + '</article>';
        }

        if (html2) tgCards.innerHTML = html2;
      }

      var okReq = !!(reqCards && reqCards.children && reqCards.children.length);
      var okTg = !!(tgCards && tgCards.children && tgCards.children.length);
      if (okReq || okTg) {
        document.documentElement.classList.add('enhanced');
      }
    } catch (_) {}
  }

  // -------------------------------------------------------
  // page init re-run
  // 외부 script는 한 번만 로드해도, SPA 마운트마다 init은 다시 필요
  // -------------------------------------------------------
  function runKnownPageInit(root, options) {
    try {
      var scopeRoot = getExecHost(root);
      var pageURL = (options && options.pageURL) ? String(options.pageURL) : '';

      var isGuidesIndex = !!(
        (scopeRoot && scopeRoot.querySelector && scopeRoot.querySelector('[data-ks-guides-root="1"]')) ||
        /\/guides\/index\.html(\?|#|$)/i.test(pageURL) ||
        /\/guides\/?(\?|#|$)/i.test(pageURL)
      );

      if (isGuidesIndex && typeof window.KS_GUIDES_INDEX_INIT === 'function') {
        try { window.KS_GUIDES_INDEX_INIT(); } catch (_) {}
      }
    } catch (_) {}
  }

  // -------------------------------------------------------
  // execute scripts in original document order
  // -------------------------------------------------------
  async function executeScripts(doc, root) {
    var execHost = getExecHost(root);

    try {
      var scripts = Array.prototype.slice.call(doc.querySelectorAll('script')) || [];

      for (var k = 0; k < scripts.length; k++) {
        var sc = scripts[k];
        var src = sc.getAttribute && sc.getAttribute('src');
        var typeAttr = (sc.getAttribute && sc.getAttribute('type')) ? sc.getAttribute('type') : '';
        var type = String(typeAttr || '').trim();
        var isModule = (type === 'module');

        if (!isModule && isNonExecutableScriptType(type)) continue;

        if (src) {
          var abs = '';
          try {
            abs = window.canonical
              ? window.canonical(new URL(src, location.href).href)
              : new URL(src, location.href).href;
          } catch (_) {
            abs = window.canonical ? window.canonical(src) : src;
          }

          if (LOADED_SCRIPT_ABS.has(abs)) continue;

          try {
            await ensureScript(src, { type: isModule ? 'module' : undefined });
          } catch (_) {}

          LOADED_SCRIPT_ABS.add(abs);
          continue;
        }

        var code = String(sc.textContent || '');
        if (!code.trim()) continue;

        var s = document.createElement('script');

        if (isModule) {
          s.type = 'module';
          s.text = code + '\n//# sourceURL=kd:inline-module:' + k;
          execHost.appendChild(s);
          try { if (s.parentNode) s.parentNode.removeChild(s); } catch (_) {}
          continue;
        }

        s.text =
          '(function(window, document){\n' +
          code +
          '\n}).call(window, window, document);\n' +
          '//# sourceURL=kd:inline:' + k;

        execHost.appendChild(s);
        try { if (s.parentNode) s.parentNode.removeChild(s); } catch (_) {}
      }
    } catch (eRun) {
      console.error('[html-loader] script exec error', eRun);
    }
  }

  // -------------------------------------------------------
  // mount(root, html, options)
  // -------------------------------------------------------
  async function mount(root, html, options) {
    options = options || {};

    var preferWrap = options.preferWrap !== false;
    var scopeSelector = options.scopeSelector || '#content';
    var ensureCommonCSS = options.ensureCommonCSS || '/css/building-detail.css';
    var runAfter = options.afterMount;
    var removeHeader = options.removeHeader !== false;
    var headerSelectors = options.headerSelectors;

    var doc = null;
    try {
      doc = new DOMParser().parseFromString(html, 'text/html');
    } catch (e) {
      doc = null;
    }

    if (!doc || !doc.body) {
      root.innerHTML = htmlBodyOnly(html);

      try { await ensureCSS(ensureCommonCSS); } catch (_) {}
      ensureAnchorFix(root);
      forceMobileCardsIfEmpty(root, options);
      runKnownPageInit(root, options);

      if (typeof runAfter === 'function') {
        try { await runAfter(root, null); } catch (_) {}
      }

      return { doc: null };
    }

    // 1) title/meta/canonical
    try {
      var title = (doc.querySelector('title') && doc.querySelector('title').textContent) || '';
      if (title) document.title = title;

      var desc = doc.querySelector('meta[name="description"]');
      if (desc && desc.content) setMetaTag('description', desc.content);

      var can = doc.querySelector('link[rel="canonical"]');
      if (can && can.href) {
        setCanonical(can.href);
      } else if (options.pageURL) {
        try { setCanonical(new URL(options.pageURL, location.href).href); } catch (_) {}
      }
    } catch (_) {}

    // 2) external CSS
    try {
      var links = doc.head ? doc.head.querySelectorAll('link[rel="stylesheet"][href]') : [];
      for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute('href');
        if (!href) continue;
        try { await ensureCSS(href); } catch (_) {}
      }
    } catch (_) {}

    // 3) inline style scoped
    try {
      var styles = doc.head ? doc.head.querySelectorAll('style') : [];
      var combined = '';

      for (var j = 0; j < styles.length; j++) {
        var cssText = styles[j].textContent || '';
        if (!cssText.trim()) continue;
        combined += '\n' + scopeCssToContent(cssText, scopeSelector);
      }

      if (combined.trim()) {
        var key = String(combined.length) + ':' + String(combined).slice(0, 200);

        if (!SEEN_INLINE_STYLE.has(key)) {
          SEEN_INLINE_STYLE.add(key);

          var old = document.getElementById('kd-scoped-inline-style');
          if (old && old.parentNode) old.parentNode.removeChild(old);

          var st = document.createElement('style');
          st.id = 'kd-scoped-inline-style';
          st.textContent = combined;
          document.head.appendChild(st);
        }
      }
    } catch (_) {}

    // 4) mount .wrap or body
    var wrap = preferWrap ? doc.querySelector('.wrap') : null;
    var mountEl = wrap || doc.body;
    var clone = mountEl.cloneNode(true);

    if (removeHeader) removeHeadersFrom(clone, headerSelectors);

    try {
      var deadScripts = clone.querySelectorAll('script');
      for (var ds = 0; ds < deadScripts.length; ds++) {
        if (deadScripts[ds].parentNode) deadScripts[ds].parentNode.removeChild(deadScripts[ds]);
      }
    } catch (_) {}

    if (wrap) root.innerHTML = clone.outerHTML;
    else root.innerHTML = clone.innerHTML;

    ensureAnchorFix(root);

    // 5) common css last
    try { await ensureCSS(ensureCommonCSS); } catch (_) {}

    // 6) execute scripts
    await executeScripts(doc, root);

    // 7) post script fallback
    forceMobileCardsIfEmpty(root, options);

    // 8) re-run known page init
    runKnownPageInit(root, options);

    // 9) afterMount
    if (typeof runAfter === 'function') {
      try { await runAfter(root, doc); } catch (_) {}
    }

    return { doc: doc };
  }

  // -------------------------------------------------------
  // loadAndMount(root, candidates, options)
  // -------------------------------------------------------
  async function loadAndMount(root, candidates, options) {
    options = options || {};
    var list = Array.isArray(candidates) ? candidates : [candidates];

    for (var i = 0; i < list.length; i++) {
      var url = list[i];

      try {
        var res = await fetch(window.v ? window.v(url) : url, { credentials: 'same-origin' });
        if (!res.ok) continue;

        var html = await res.text();
        return await mount(root, html, Object.assign({}, options, { pageURL: url }));
      } catch (_) {}
    }

    try {
      await ensureCSS((options && options.ensureCommonCSS) || '/css/building-detail.css');
    } catch (_) {}

    root.innerHTML = '<div class="placeholder"><h2>Not Found</h2></div>';
    return { doc: null };
  }

  // -------------------------------------------------------
  // public API
  // -------------------------------------------------------
  window.KD_HTML = window.KD_HTML || {};
  window.KD_HTML.mount = mount;
  window.KD_HTML.loadAndMount = loadAndMount;
})();
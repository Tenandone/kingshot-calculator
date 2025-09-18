/*!
 * /public/js/routes.calculators.js
 * 계산기 전용 라우트 번들 (lazy-load, 독립 라우트 전용)
 * ES5 호환 (화살표/옵셔널 체이닝/async-await 등 최신 문법 미사용)
 *
 * 전역(window)에 buildCalculatorRoutes 노출:
 *   window.buildCalculatorRoutes = function (opts) { ... return routes; }
 *
 * 포함 라우트:
 * - /calculator      → 계산기 허브
 * - /calc-building   → 건물 계산기
 * - /calc-gear       → 영주 장비 계산기 (외부 gear-calculator.js 로드)
 * - /calc-charm      → 영주 보석 계산기
 * - /calc-training   → 훈련/승급 계산기
 *
 * i18n 규칙:
 * - 각 render 마지막에 localI18nApply(el, { includeCalc:true })
 * - i18n:changed 시 includeCalc:true로 재적용
 *
 * VIP 관련 라우트/패턴은 전부 제거됨.
 */
(function () {
  'use strict';

  // ---- 안전 더미 정의(로드 순서 이슈 대비) ----
  if (typeof window.buildCalculatorRoutes !== 'function') {
    window.buildCalculatorRoutes = function () {
      try { console.warn('[routes.calculators] 더미 buildCalculatorRoutes 실행'); } catch (_e) {}
      return {};
    };
  }
  try { console.log('[routes.calculators] 로드됨'); } catch (_e) {}

  // =========================================================================
  // 공통 유틸
  // =========================================================================

  // ----- BASE / ver / join -----
  function getBaseHref() {
    try {
      var baseEl = document.querySelector('base');
      var href = baseEl ? baseEl.getAttribute('href') : null;
      var appBase = window.APP_BASE || null;
      var raw = String(appBase || href || '/');
      return raw.replace(/\/+$/, '/') || '/';
    } catch (e) { return '/'; }
  }
  var BASE = getBaseHref();

  function isAbs(p) { return /^(?:[a-z]+:)?\/\//i.test(p) || /^(?:data:|blob:)/i.test(p); }
  function j(p)     { if (isAbs(p)) return p; if (p && p.charAt(0)==='/') return BASE + p.slice(1); return BASE + (p||''); }
  function ver(p)   { return (typeof window.v === 'function') ? window.v(p) : p; }

  // ----- HTML <body>만 추출 -----
  function htmlBodyOnly(html) {
    if (!html) return html;
    try {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      return (doc && doc.body) ? doc.body.innerHTML : html;
    } catch(e){ return html; }
  }

  // ----- closest (ES5) -----
  function closest(el, selector) {
    if (!el) return null;
    if (el.closest) return el.closest(selector);
    var matches = el.matches || el.msMatchesSelector || el.webkitMatchesSelector;
    var node = el;
    while (node && node.nodeType === 1) {
      if (matches && matches.call(node, selector)) return node;
      node = node.parentElement || node.parentNode;
    }
    return null;
  }

  // ----- i18n 부분 적용(옵션: includeCalc) -----
  function localI18nApply(el, opts) {
    if (!(window.I18N && typeof window.I18N.t === 'function')) return;
    opts = opts || {};
    var includeCalc = !!opts.includeCalc;
    var SKIP = includeCalc ? '' : '#calc-ui, #gear-calc, #charm-calc, #training-calc';

    function isInAnySelector(node, selectorListCsv) {
      if (!selectorListCsv) return false;
      var parts = selectorListCsv.split(',');
      for (var i=0;i<parts.length;i++){
        var s = (parts[i] || '').trim();
        if (!s) continue;
        if (closest(node, s)) return true;
      }
      return false;
    }

    var targets = el.querySelectorAll('[data-i18n]');
    for (var i=0;i<targets.length;i++){
      var node = targets[i];
      if (!includeCalc && isInAnySelector(node, SKIP)) continue;
      var key = node.getAttribute('data-i18n');
      var val = window.I18N.t(key, node.textContent || key);
      if (typeof val !== 'undefined') node.textContent = val;
    }

    var attrTargets = el.querySelectorAll('[data-i18n-attr]');
    for (var j=0;j<attrTargets.length;j++){
      var n = attrTargets[j];
      if (!includeCalc && isInAnySelector(n, SKIP)) continue;
      var pairs = (n.getAttribute('data-i18n-attr') || '').split(';');
      for (var k=0;k<pairs.length;k++){
        var pair = (pairs[k] || '').trim(); if (!pair) continue;
        var sp = pair.split(':');
        var attr = (sp[0] || '').trim();
        var key2 = (sp[1] || '').trim();
        if (!attr || !key2) continue;
        var cur = n.getAttribute(attr) || key2;
        var val2 = window.I18N.t(key2, cur);
        if (typeof val2 !== 'undefined') n.setAttribute(attr, val2);
      }
    }
  }

  // ----- 스크립트/HTML 후보 순차 로더 -----
  function loadScriptCandidates(cands, loadScriptOnce) {
    return new Promise(function(resolve){
      var i = 0, lastErr = null;
      function next() {
        if (i >= cands.length) {
          if (lastErr) { try { console.error('[routes.calculators] script load failed all:', cands, lastErr); } catch(_e){} }
          return resolve({ ok:false, error:lastErr });
        }
        var s = cands[i++];
        loadScriptOnce(ver(j(s))).then(function(){
          resolve({ ok:true, src:s });
        }, function(e){
          lastErr = e;
          try { console.warn('[routes.calculators] script candidate fail:', s, (e && e.message) || e); } catch(_e){}
          next();
        });
      }
      next();
    });
  }

  function loadHTMLCandidates(loadHTML, list) {
    return new Promise(function(resolve){
      var i = 0, lastErr = null;
      function next() {
        if (i >= list.length) {
          if (lastErr) { try { console.error('[routes.calculators] html load failed all:', list, lastErr); } catch(_e){} }
          return resolve({ ok:false, html:'' });
        }
        var u = list[i++];
        loadHTML([u]).then(function(html){
          if (html) return resolve({ ok:true, html:html, url:u });
          next();
        }, function(e){
          lastErr = e;
          try { console.warn('[routes.calculators] html candidate fail:', u, (e && e.message) || e); } catch(_e){}
          next();
        });
      }
      next();
    });
  }

  // ----- History 보조/해시 보정 -----
  function pushAndPing(path){
    if (typeof window.navigate === 'function') return window.navigate(path);
    if ((location.pathname || '') === path) {
      try {
        if (typeof window.PopStateEvent === 'function') {
          window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
          var ev1 = document.createEvent('Event');
          ev1.initEvent('popstate', true, true);
          window.dispatchEvent(ev1);
        }
      } catch(_) {}
      return;
    }
    try { history.pushState(null, '', path); } catch(_e){}
    try {
      if (typeof window.PopStateEvent === 'function') {
        window.dispatchEvent(new PopStateEvent('popstate'));
      } else {
        var ev2 = document.createEvent('Event');
        ev2.initEvent('popstate', true, true);
        window.dispatchEvent(ev2);
      }
    } catch(_) {}
  }

  function replaceHashAndPing(newHash){
    var wanted = String(newHash || '');
    var curr = location.hash || '';
    if (curr !== wanted) {
      try { history.replaceState(null, '', (location.pathname||'') + (location.search||'') + wanted); } catch(_e){}
    }
    try {
      if (typeof window.HashChangeEvent === 'function') {
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } else if (typeof window.onhashchange === 'function') {
        window.onhashchange();
      }
    } catch (_e) {}
  }

  function normalizeWeirdHash(){
    try {
      var h = location.hash || '';
      var m = h.match(/^#\/?(calc-(?:building|gear|charm|training)|calculator)\b/i);
      if (m) {
        var fixed = '#/' + h.replace(/^#\/?/, '');
        replaceHashAndPing(fixed);
        var segments = fixed.replace(/^#\//, '');
        var head = segments.split(/[?#]/)[0];
        if (head && location.pathname !== '/' + head) pushAndPing('/' + head);
      }
    } catch (_e) {}
  }

  // ----- 옛 링크 정규화 + 클릭 인터셉트 -----
  function bindLegacyCalcLinks(el) {
    if (!el) return;

    // 마크업 href 보정
    var anchors = el.querySelectorAll('a[href]');
    for (var i=0;i<anchors.length;i++){
      var a = anchors[i];
      var h = a.getAttribute('href') || '';
      if (/^https?:\/\//i.test(h)) continue;
      var mid = h.indexOf('#/');
      if (mid > -1) {
        var tail = h.slice(mid + 2);
        if (/^calc-(building|gear|charm|training)\b/i.test(tail)) { a.setAttribute('href', '/' + tail); continue; }
        if (/^calculator\b/i.test(tail)) { a.setAttribute('href', '/calculator'); continue; }
      }
      if (/^#(calc-(building|gear|charm|training)\b.*)/i.test(h)) { a.setAttribute('href', '/' + h.replace(/^#/, '')); continue; }
      if (/^#calculator\b/i.test(h)) { a.setAttribute('href', '/calculator'); continue; }
      if (/^#gear\b/i.test(h)) { a.setAttribute('href', '/' + h.replace(/^#gear\b/i, 'calc-gear')); continue; }
    }

    // 클릭 인터셉트
    el.addEventListener('click', function(e){
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;

      var a = closest(e.target, 'a[href]');
      if (a) {
        var hh = a.getAttribute('href') || '';
        if (!/^https?:\/\//i.test(hh)) {
          var mid2 = hh.indexOf('#/');
          if (mid2 > -1 || /^#\//.test(hh)) {
            e.preventDefault();
            var tail = mid2 > -1 ? hh.slice(mid2 + 2) : hh.slice(2);
            return pushAndPing(/^calculator\b/i.test(tail) ? '/calculator' : '/' + tail);
          }
          if (/^#(calc-|calculator|gear)/i.test(hh)) {
            e.preventDefault();
            var t2 = hh.replace(/^#/, '');
            if (/^gear\b/i.test(t2)) t2 = t2.replace(/^gear\b/i, 'calc-gear');
            return pushAndPing('/' + t2);
          }
        }
      }

      var node = closest(e.target, '[data-href], [data-route]');
      if (!node) return;
      var raw = node.getAttribute('data-href') || node.getAttribute('data-route') || '';
      if (!raw) return;
      var mid3 = raw.indexOf('#/');
      var path = mid3 >= 0 ? '/' + raw.slice(mid3 + 2)
                           : (raw.charAt(0) === '#' ? '/' + raw.slice(1)
                              : (raw.charAt(0) === '/' ? raw : null));
      if (!path) return;
      e.preventDefault();
      return pushAndPing(path);
    }, false);
  }

  // ----- 렌더 레이스 가드 -----
  var __calcRenderSeq = 0;
  function createRenderGuard(el, validPaths) {
    var token = ++__calcRenderSeq;
    el.__calcRenderToken = token;
    function isAlive() {
      if (el.__calcRenderToken !== token) return false;
      var path = location.pathname || '';
      for (var i=0;i<validPaths.length;i++){
        var p = validPaths[i];
        if (path.indexOf(p) === 0) return true;
      }
      return false;
    }
    return { isAlive: isAlive };
  }

  // =========================================================================
  // 라우트 빌더
  // =========================================================================
  window.buildCalculatorRoutes = function (opts) {
    opts = opts || {};
    var loadHTML         = opts.loadHTML;          // 필수
    var loadScriptOnce   = opts.loadScriptOnce;    // 필수
    var apply            = opts.apply;             // 선택
    var setTitle         = opts.setTitle;          // 선택
    var ensureI18NReady  = opts.ensureI18NReady;   // 선택
    var TIER_KEY_MAP_KO  = opts.TIER_KEY_MAP_KO;   // 선택(gear-calculator.js가 지원할 때)

    function makeEnsureLangAndNamespaces(ensureFn) {
      return function (nsList) {
        nsList = Object.prototype.toString.call(nsList) === '[object Array]' ? nsList : [];
        var promise = Promise.resolve();
        if (typeof ensureFn === 'function') promise = promise.then(ensureFn);
        return promise.then(function(){
          if (nsList.length && window.I18N) {
            if (typeof window.I18N.loadNamespace === 'function') {
              var p = Promise.resolve();
              var i;
              for (i=0;i<nsList.length;i++){
                (function(ns){
                  p = p.then(function(){ return window.I18N.loadNamespace(ns, window.I18N.current); })
                       .catch(function(e){ console.warn('[i18n] loadNamespace fail:', ns, e); });
                })(nsList[i]);
              }
              return p;
            } else if (typeof window.I18N.loadNamespaces === 'function') {
              return window.I18N.loadNamespaces(nsList, window.I18N.current)
                .catch(function(e){ console.warn('[i18n] loadNamespaces fail:', nsList, e); });
            }
          }
        }).then(function(){
          var curr = (window.I18N && window.I18N.current) || document.documentElement.getAttribute('lang') || 'ko';
          if (curr === 'cn') curr = 'zh-CN';
          if (curr === 'tw') curr = 'zh-TW';
          document.documentElement.setAttribute('lang', curr);
        }).catch(function(e){
          console.warn('[i18n] ensureLangAndNamespaces fail:', nsList, e);
        });
      };
    }
    var ensureLangAndNamespaces = makeEnsureLangAndNamespaces(ensureI18NReady);

    var routes = {};

    // ---------------------------
    // /calculator (허브)
    routes['/calculator'] = {
      title: '계산기 - KingshotData.kr',
      render: function (el) {
        var guard = createRenderGuard(el, ['/calculator']);
        normalizeWeirdHash();
        return ensureLangAndNamespaces(['common','calc']).then(function(){
          if (!guard.isAlive()) return;
          return loadHTMLCandidates(loadHTML, [
            j('pages/calculator.html'),
            j('/pages/calculator.html'),
            j('pages/calculators/index.html'),
            j('/pages/calculators/index.html'),
            j('pages/calculators.html'),
            j('/pages/calculators.html'),
            j('calculator.html'),
            j('/calculator.html')
          ]);
        }).then(function(res){
          if (!guard.isAlive()) return;
          el.innerHTML = (res && res.ok) ? htmlBodyOnly(res.html)
            : '<div class="placeholder"><h2 data-i18n="calc.title">계산기</h2><p class="muted" data-i18n="calc.error.notFound">calculator.html을 찾을 수 없습니다.</p></div>';

          try {
            if (typeof apply === 'function') apply(el);
            localI18nApply(el, { includeCalc: true });
          } catch(_e){}

          bindLegacyCalcLinks(el);
          if (typeof setTitle === 'function') setTitle('calc.meta.title', '계산기 | KingshotData KR');
          try { window.scrollTo(0, 0); } catch(_){}

          if (!window.__calcHubReapplyBound) {
            document.addEventListener('i18n:changed', function () {
              if (location.pathname === '/calculator') {
                var content = document.getElementById('content');
                if (content) localI18nApply(content, { includeCalc: true });
              }
            }, false);
            window.__calcHubReapplyBound = true;
          }
        });
      }
    };

    // ---------------------------
    // /calc-building
    routes['/calc-building'] = {
      title: '건물계산기 - KingshotData.kr',
      render: function (el) {
        var guard = createRenderGuard(el, ['/calc-building']);
        normalizeWeirdHash();
        return ensureLangAndNamespaces(['calc']).then(function(){
          if (!guard.isAlive()) return;
          try { if (typeof window.ensureCSS === 'function') window.ensureCSS(j('css/kingshot_calc.css')); } catch(_e){}
          return loadHTMLCandidates(loadHTML, [
            j('pages/calculators/building.html'),
            j('/pages/calculators/building.html'),
            j('pages/calculator/building.html'),
            j('/pages/calculator/building.html')
          ]);
        }).then(function(res){
          if (!guard.isAlive()) return;
          el.innerHTML = (res && res.ok) ? htmlBodyOnly(res.html)
            : '<div class="placeholder"><h2 data-i18n="calc.building.title">건물계산기</h2><p class="muted" data-i18n="calc.error.notFound">building.html을 찾을 수 없습니다.</p></div>';

          return loadScriptCandidates([
            j('js/calculator.js'),'js/calculator.js','/js/calculator.js',
            j('public/js/calculator.js'),'public/js/calculator.js','/public/js/calculator.js'
          ], loadScriptOnce);
        }).then(function(s){
          if (!guard.isAlive()) return;
          if (s && s.ok && typeof window.initCalculator === 'function') {
            try {
              window.initCalculator({ mount:'#calc-ui', jsonUrl: j('data/buildings.json') });
            } catch (e2) {
              try { console.error('[calc-building] initCalculator error:', e2); } catch(_e){}
              el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="calc.error.initError">initCalculator() 실행 중 오류</div>');
            }
          } else {
            el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="calc.error.initMissing">initCalculator() 없음</div>');
          }

          try { localI18nApply(el, { includeCalc: true }); if (typeof apply === 'function') apply(el); } catch(_e){}
          bindLegacyCalcLinks(el);
          if (typeof setTitle === 'function') setTitle('calc.meta.title', '건물 계산기 | KingshotData KR');
          try { window.scrollTo(0, 0); } catch(_){}

          if (!window.__calcBuildingReapplyBound) {
            document.addEventListener('i18n:changed', function () {
              if (location.pathname.indexOf('/calc-building') === 0) {
                var content = document.getElementById('content');
                if (content) {
                  try { localI18nApply(content, { includeCalc: true }); } catch(_e){}
                  try {
                    if (typeof window.initCalculator === 'function') {
                      window.initCalculator({ mount:'#calc-ui', jsonUrl: j('data/buildings.json') });
                    }
                  } catch (re) { try { console.error('[calc-building] re-init on i18n change error:', re); } catch(_e){} }
                }
              }
            }, false);
            window.__calcBuildingReapplyBound = true;
          }
        });
      }
    };

    // ---------------------------
    // /calc-gear (외부 gear-calculator.js UI 적용)
    routes['/calc-gear'] = {
      title: '영주장비계산기 - KingshotData.kr',
      render: function (el) {
        normalizeWeirdHash();

        var guard = createRenderGuard(el, ['/calc-gear']);

        // 현재 경로에서 slug 추출 (/calc-gear/:slug)
        var slug = '';
        try {
          var p = location.pathname || '';
          if (p.indexOf('/calc-gear/') === 0) slug = p.replace('/calc-gear/', '').split('/')[0];
        } catch (_){}

        function setHashAndPing(prefix){
          var desired = '#' + prefix + (slug ? '/' + slug : '');
          replaceHashAndPing(desired);
        }

        return ensureLangAndNamespaces(['calcGear','calc']).then(function(){
          if (!guard.isAlive()) return;
          return loadHTMLCandidates(loadHTML, [
            j('pages/calculators/gear.html'),
            j('/pages/calculators/gear.html')
          ]);
        }).then(function(res){
          if (!guard.isAlive()) return;

          el.innerHTML = (res && res.ok)
            ? htmlBodyOnly(res.html)
            : '<div class="placeholder"><h2 data-i18n="calcGear.title">영주장비계산기</h2><p class="muted" data-i18n="calcGear.error.notFound">gear.html을 찾을 수 없습니다.</p></div>';

          if (!guard.isAlive()) return;

          // 내부 옛 링크 → /calc-gear/:slug 경로로 전환
          el.addEventListener('click', function(e){
            var a = closest(e.target, 'a[href^="#/calc-gear/"], a[href^="#/gear/"]');
            if (a) {
              e.preventDefault();
              var s = (a.getAttribute('href') || '').replace(/^#\/(?:calc-gear|gear)\/?/, '');
              if (s) pushAndPing('/calc-gear/' + s);
            }
          }, false);

          // slug가 있으면 해시 동기화
          if (slug) {
            setHashAndPing('/calc-gear');
            setTimeout(function(){
              if (!window.__GEAR_DETAIL_MOUNTED__) setHashAndPing('/gear');
            }, 50);
          }

          // 외부 스크립트 로드
          return loadScriptCandidates([
            j('js/gear-calculator.js'),'js/gear-calculator.js','/js/gear-calculator.js',
            j('public/js/gear-calculator.js'),'public/js/gear-calculator.js','/public/js/gear-calculator.js'
          ], loadScriptOnce);
        }).then(function(s){
          if (!guard.isAlive()) return;

          if (s && s.ok && typeof window.initGearCalculator === 'function') {
            try {
              var initCfg = {
                mount: '#gear-calc',
                jsonUrl: j('data/governor-gear.json')
              };
              if (TIER_KEY_MAP_KO) initCfg.tierKeyMap = TIER_KEY_MAP_KO;
              if (slug) initCfg.initialSlug = slug;
              window.initGearCalculator(initCfg);
            } catch (e) {
              console.error('[calc-gear] initGearCalculator error:', e);
              el.insertAdjacentHTML('beforeend', '<div class="error" data-i18n="calcGear.error.initError">initGearCalculator 실행 오류</div>');
            }
          } else {
            el.insertAdjacentHTML('beforeend', '<div class="error" data-i18n="calcGear.error.initMissing">initGearCalculator()가 없습니다.</div>');
          }

          // slug 내비게이션 폴백
          if (slug) {
            try {
              if (window.GEAR && typeof window.GEAR.navigateToSlug === 'function') {
                window.GEAR.navigateToSlug(slug);
                window.__GEAR_DETAIL_MOUNTED__ = true;
              } else {
                replaceHashAndPing('#/calc-gear/' + slug);
              }
            } catch (e3) {
              console.debug('[calc-gear] navigateToSlug fallback err:', e3);
            }
          }

          // i18n 적용 + 기타
          try { if (typeof apply === 'function') apply(el); } catch(_e){}
          localI18nApply(el, { includeCalc: true });
          bindLegacyCalcLinks(el);
          if (typeof setTitle === 'function') setTitle('calcGear.meta.title', '영주 장비 계산기 | KingshotData KR');
          try { window.scrollTo(0, 0); } catch(_){}

          // 언어 전환 시 재적용
          if (!window.__calcGearReapplyBound) {
            document.addEventListener('i18n:changed', function () {
              if (location.pathname.indexOf('/calc-gear') === 0) {
                try { if (typeof apply === 'function') apply(el); } catch(_e){}
                localI18nApply(el, { includeCalc: true });
                if (typeof window.reapplyGearCalculatorI18N === 'function') {
                  try { window.reapplyGearCalculatorI18N(); } catch(_) {}
                }
              }
            }, false);
            window.__calcGearReapplyBound = true;
          }
        });
      }
    };

    // ---------------------------
    // /calc-charm
    routes['/calc-charm'] = {
      title: '영주보석계산기 - KingshotData.kr',
      render: function (el) {
        var guard = createRenderGuard(el, ['/calc-charm']);
        normalizeWeirdHash();
        return ensureLangAndNamespaces(['calcCharm','calc']).then(function(){
          if (!guard.isAlive()) return;
          return loadHTMLCandidates(loadHTML, [
            j('pages/calculators/charm.html'),
            j('/pages/calculators/charm.html')
          ]);
        }).then(function(res){
          if (!guard.isAlive()) return;
          el.innerHTML = (res && res.ok)
            ? htmlBodyOnly(res.html)
            : '<div class="placeholder"><h2 data-i18n="calcCharm.title">영주보석계산기</h2><p class="muted" data-i18n="calcCharm.error.notFound">charm.html을 찾을 수 없습니다.</p></div>';

          if (!guard.isAlive()) return;

          return loadScriptCandidates([
            j('js/charm-calculator.js'),'js/charm-calculator.js','/js/charm-calculator.js',
            j('public/js/charm-calculator.js'),'public/js/charm-calculator.js','/public/js/charm-calculator.js'
          ], loadScriptOnce);
        }).then(function(s){
          if (!guard.isAlive()) return;
          if (s && s.ok && typeof window.initCharmCalculator === 'function') {
            try {
              window.initCharmCalculator({
                mount: '#charm-calc',
                jsonUrl: j('data/governor-charm.json')
              });
            } catch (e2) {
              console.error('[calc-charm] initCharmCalculator error:', e2);
              el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="calcCharm.error.initError">initCharmCalculator 오류</div>');
            }
          } else {
            el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="calcCharm.error.initMissing">initCharmCalculator 없음</div>');
          }

          bindLegacyCalcLinks(el);
          if (typeof setTitle === 'function') setTitle('calcCharm.meta.title', '영주 보석 계산기 | KingshotData KR');

          localI18nApply(el, { includeCalc: true });
          try { window.scrollTo(0, 0); } catch(_){}

          if (!window.__calcCharmReapplyBound) {
            document.addEventListener('i18n:changed', function () {
              if (location.pathname.indexOf('/calc-charm') === 0) {
                var content = document.getElementById('content');
                if (content) localI18nApply(content, { includeCalc: true });
              }
            }, false);
            window.__calcCharmReapplyBound = true;
          }
        });
      }
    };

    // ---------------------------
    // /calc-training
    routes['/calc-training'] = {
      title: '병력 훈련/승급 계산기 - KingshotData.kr',
      render: function (el) {
        var guard = createRenderGuard(el, ['/calc-training']);
        normalizeWeirdHash();
        return ensureLangAndNamespaces(['trainCalc','calc']).then(function(){
          if (!guard.isAlive()) return;
          var cssP = (window.ensureCSS ? window.ensureCSS(j('css/kingshot_calc.css')) : Promise.resolve());
          return cssP.catch(function(e){ console.warn('[trainCalc] CSS load fail:', e); });
        }).then(function(){
          if (!guard.isAlive()) return;
          return loadHTMLCandidates(loadHTML, [
            j('pages/calculators/training.html'),
            j('/pages/calculators/training.html')
          ]);
        }).then(function(res){
          if (!guard.isAlive()) return;
          el.innerHTML = (res && res.ok)
            ? htmlBodyOnly(res.html)
            : '<div class="placeholder"><h2 data-i18n="trainCalc.title">훈련/승급 계산기</h2><p class="muted" data-i18n="trainCalc.error.notFound">training.html을 찾을 수 없습니다.</p></div>';

          if (!guard.isAlive()) return;

          return loadScriptCandidates([
            j('js/training-calculator.js'),'js/training-calculator.js','/js/training-calculator.js',
            j('public/js/training-calculator.js'),'public/js/training-calculator.js','/public/js/training-calculator.js'
          ], loadScriptOnce);
        }).then(function(s){
          if (!guard.isAlive()) return;
          if (s && s.ok && typeof window.initTrainingCalculator === 'function') {
            try {
              window.initTrainingCalculator({
                mount: '#training-calc',
                jsonUrl: j('data/ks_training_promotion_per_troop.json')
              });
            } catch (e2) {
              console.error('[calc-training] initTrainingCalculator error:', e2);
              el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="trainCalc.error.initError">initTrainingCalculator 오류</div>');
            }
          } else {
            el.insertAdjacentHTML('beforeend','<div class="error" data-i18n="trainCalc.error.initMissing">initTrainingCalculator 없음</div>');
          }

          bindLegacyCalcLinks(el);
          if (typeof setTitle === 'function') setTitle('trainCalc.meta.title', '킹샷 훈련·승급 계산기 | KingshotData KR');

          localI18nApply(el, { includeCalc: true });
          try { window.scrollTo(0, 0); } catch(_){}

          if (!window.__calcTrainingReapplyBound) {
            document.addEventListener('i18n:changed', function () {
              if (location.pathname.indexOf('/calc-training') === 0) {
                var content = document.getElementById('content');
                if (content) localI18nApply(content, { includeCalc: true });
              }
            }, false);
            window.__calcTrainingReapplyBound = true;
          }
        });
      }
    };

    // 최종
    return routes;
  };
})();

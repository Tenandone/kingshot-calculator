// /js/pages/building-calculator.js
(function () {
  'use strict';

  // ========= 전역 네임스페이스 =========
  if (!window.KSD) window.KSD = {};

  // ========= 중복 로드 가드 =========
  if (window.__buildingCalculatorUILoaded__) {
    if (window.console && console.info) {
      console.info('[calc] building-calculator.js already loaded — skipping');
    }
    return;
  }
  window.__buildingCalculatorUILoaded__ = true;

  // ========= 기능 플래그(코어 전달용) =========
  // - TG 최대치: 10
  // - 담금질 된 순금 사용: true
  var KSD_CALC_FEATURES = {
    maxTG: 10,
    hasTemperedTruegold: true
  };
  window.__KSD_CALC_FEATURES__ = KSD_CALC_FEATURES;
  window.__KSD_MAX_TG__ = 10;
  window.__KSD_HAS_TEMPERED_TRUEGOLD__ = true;

  // ========= 선택자/키 상수 =========
  var ROOT_SELECTOR = '#calc-ui, #calc-root, [data-calc="buildings"], [data-calc-root]';

  // JSON slug 그대로 사용
  var BUILDING_OPTIONS = [
    { value: 'towncenter',    key: 'calc.form.building.option.towncenter' },
    { value: 'embassy',       key: 'calc.form.building.option.embassy' },
    { value: 'academy',       key: 'calc.form.building.option.academy' },
    { value: 'commandcenter', key: 'calc.form.building.option.command' },
    { value: 'barracks',      key: 'calc.form.building.option.barracks' },
    { value: 'stable',        key: 'calc.form.building.option.stable' },
    { value: 'range',         key: 'calc.form.building.option.range' },
    { value: 'infirmary',     key: 'calc.form.building.option.infirmary' },
    { value: 'waracademy',    key: 'calc.form.building.option.war-academy' }
  ];

  // ========= 간단 헬퍼 =========
  function byId(id) { return document.getElementById(id); }
  function hasFn(obj, fn) { return !!(obj && typeof obj[fn] === 'function'); }
  function i18n() { return window.I18N || null; }

  function getLang() {
    var I = i18n();
    var lng =
      (I && (I.language || I.current || I.lng || (I.options && I.options.lng))) ||
      document.documentElement.lang ||
      'en';
    return String(lng || 'en').toLowerCase();
  }
  function isKO() { return getLang().indexOf('ko') === 0; }

  function t(k, fb) {
    var I = i18n();
    try {
      if (I && typeof I.t === 'function') {
        if (typeof I.exists === 'function' && !I.exists(k)) return (fb != null ? fb : k);
        var txt = I.t(k);
        if ((txt === k || txt == null || txt === '') && fb != null) return fb;
        return txt;
      }
    } catch (e) {}
    return (fb != null ? fb : k);
  }

  var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
  var caf = window.cancelAnimationFrame || clearTimeout;
  function nowTime() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  // ========= i18n 준비 =========
  function ensureI18NReady(done) {
    try {
      var I = i18n();
      if (!I) { if (done) done(); return; }

      var isReady = !!(I.current || I.language || I.isInitialized || typeof I.t === 'function');

      function loadNS(next) {
        try {
          if (hasFn(I, 'loadNamespaces')) {
            I.loadNamespaces(['common', 'calc'], function () { if (next) next(); });
          } else if (hasFn(I, 'loadNamespace')) {
            I.loadNamespace('calc', function () { if (next) next(); });
          } else if (hasFn(I, 'loadNS')) {
            I.loadNS(['common', 'calc'], function () { if (next) next(); });
          } else if (hasFn(I, 'reloadResources')) {
            try { I.reloadResources(); } catch (e) {}
            if (next) next();
          } else {
            if (next) next();
          }
        } catch (e) {
          if (next) next();
        }
      }

      if (!isReady && hasFn(I, 'init')) {
        var saved = null;
        try { saved = window.localStorage ? localStorage.getItem('lang') : null; } catch (e) {}
        var urlLang = '';
        try { urlLang = (new URLSearchParams(window.location.search)).get('lang'); } catch (e) {}
        var navigatorLang = (navigator && (navigator.language || '') || 'ko').replace('_', '-');
        var lang = urlLang || saved || navigatorLang;

        try {
          I.init({ lng: lang, lang: lang, ns: ['common', 'calc'], namespaces: ['common', 'calc'] }, function () {
            loadNS(function () { if (done) done(); });
          });
          return;
        } catch (e) {
          try { I.init({ lng: lang, lang: lang }); } catch (e2) {}
          loadNS(function () { if (done) done(); });
          return;
        }
      }

      loadNS(function () { if (done) done(); });
    } catch (e) {
      if (done) done();
    }
  }

  // ========= core(calculator.js)의 init 대기 =========
  function waitForCore(timeoutMs, onOk, onFail) {
    var t0 = nowTime();
    (function tick() {
      if (typeof window.initCalculator === 'function') {
        if (onOk) onOk();
        return;
      }
      if (nowTime() - t0 > (timeoutMs || 8000)) {
        if (onFail) onFail(new Error('core (calculator.js) not ready'));
        return;
      }
      raf(tick);
    })();
  }

  // ========= SPA 렌더 이후 calc 루트 대기 =========
  function waitForRoot(scope, timeoutMs, onOk, onFail) {
    var sc = scope || document;
    var t0 = nowTime();

    function findRoot() {
      try { return sc.querySelector(ROOT_SELECTOR); } catch (e) { return null; }
    }

    var found = findRoot();
    if (found) { if (onOk) onOk(found); return; }

    (function tick() {
      var r = findRoot();
      if (r) { if (onOk) onOk(r); return; }
      if (nowTime() - t0 > (timeoutMs || 8000)) {
        if (onFail) onFail(new Error('calc root not found'));
        return;
      }
      raf(tick);
    })();
  }

  // ========= UI 라벨/ARIA/i18n =========
  function applyI18NLabels() {
    var title = byId('calc-title');
    if (title) title.textContent = t('calc.title', '건물 계산기');

    var desc = null;
    try { desc = document.querySelector('.calc-desc'); } catch (e) {}
    if (desc) desc.textContent = t('calc.desc', '업그레이드에 필요한 자원과 소요 시간을 확인하세요.');

    var labelMap = [
      ['label-building', 'calc.form.building.label',  '건물 선택'],
      ['label-start',    'calc.form.startLevel',      '시작 레벨'],
      ['label-target',   'calc.form.targetLevel',     '목표 레벨'],
      ['label-speed',    'calc.form.speedBonus',      '건설 속도(%)'],
      ['label-saul',     'calc.form.saulBonus',       '살로 할인(%)'],
      ['label-wolf',     'calc.form.wolfBonus',       '늑대 버프(%)'],
      ['label-position', 'calc.form.positionBonus',   '직책/타이틀(%)'],
      ['label-double',   'calc.form.doubleTime',      '이중법령(시간 20% 감소)'],
      ['label-include',  'calc.form.includePrereq',   '선행 건물 포함']
    ];

    for (var i = 0; i < labelMap.length; i++) {
      var el = byId(labelMap[i][0]);
      if (!el) continue;
      var key = labelMap[i][1];
      var fb = labelMap[i][2];
      var lbl = t(key, fb);
      el.textContent = lbl;
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', lbl);
    }

    var calcBtn = byId('calcBtn');
    if (calcBtn) {
      var fbCalc = isKO() ? '계산하기' : 'START';
      var txtCalc = t('calc.form.calculate', fbCalc);
      calcBtn.textContent = txtCalc;
      calcBtn.setAttribute('aria-label', txtCalc);
    }

    var clearBtn = byId('clearPlanBtn');
    if (clearBtn) {
      var fbClr = isKO() ? '초기화' : 'RESET';
      var txtClr = t('calc.form.clear', fbClr);
      clearBtn.textContent = txtClr;
      clearBtn.setAttribute('aria-label', txtClr);
    }

    var prereqTitle = byId('prereq-title');
    if (prereqTitle) prereqTitle.textContent = t('calc.prereqBox.title', '선행 건물 요구사항');

    var ph = {
      startLevel:    ['calc.form.placeholder.start',    '현재 레벨'],
      targetLevel:   ['calc.form.placeholder.target',   '목표 레벨'],
      speedBonus:    ['calc.form.placeholder.speed',    '0'],
      saulBonus:     ['calc.form.placeholder.saul',     '0'],
      wolfBonus:     ['calc.form.placeholder.wolf',     '0'],
      positionBonus: ['calc.form.placeholder.position', '0']
    };

    for (var id in ph) {
      if (!ph.hasOwnProperty(id)) continue;
      var input = byId(id);
      if (!input) continue;
      var meta = ph[id];
      var txt = t(meta[0], meta[1]);
      input.setAttribute('placeholder', txt);
      if (!input.getAttribute('aria-label')) input.setAttribute('aria-label', txt);
    }
  }

  // ========= 빌딩 옵션 주입 =========
  function ensureBuildingOptions() {
    var sel = byId('building');
    if (!sel) return;

    var existingValues = {};
    for (var i = 0; i < (sel.options ? sel.options.length : 0); i++) {
      var o = sel.options[i];
      if (o && typeof o.value === 'string') existingValues[o.value] = true;
    }

    var frag = document.createDocumentFragment();
    for (i = 0; i < BUILDING_OPTIONS.length; i++) {
      var opt = BUILDING_OPTIONS[i];
      if (existingValues[opt.value]) continue;
      var node = document.createElement('option');
      node.value = opt.value;
      node.textContent = t(opt.key, opt.value);
      frag.appendChild(node);
    }
    if (frag.childNodes && frag.childNodes.length) sel.appendChild(frag);

    var labelMapByValue = {};
    for (i = 0; i < BUILDING_OPTIONS.length; i++) {
      labelMapByValue[BUILDING_OPTIONS[i].value] = t(BUILDING_OPTIONS[i].key, BUILDING_OPTIONS[i].value);
    }

    for (i = 0; i < (sel.options ? sel.options.length : 0); i++) {
      o = sel.options[i];
      if (!o) continue;
      if (labelMapByValue.hasOwnProperty(o.value)) {
        o.textContent = labelMapByValue[o.value];
      }
    }

    sel.setAttribute('aria-label', t('calc.form.building.label', '건물 선택'));
  }

  // ========= 진입 시 폼 초기화 =========
  function resetFormToDefaults() {
    var form = byId('calc-form');
    try {
      if (form && typeof form.reset === 'function') form.reset();
    } catch (e) {}

    var buildingEl = byId('building');
    if (buildingEl && buildingEl.options && buildingEl.options.length) {
      buildingEl.selectedIndex = 0;
      try { buildingEl.setAttribute('aria-label', t('calc.form.building.label', '건물 선택')); } catch (e) {}
    }

    var idsOne = ['startLevel', 'targetLevel'];
    for (var i = 0; i < idsOne.length; i++) {
      var el1 = byId(idsOne[i]);
      if (el1) el1.value = 1;
    }

    var idsZero = ['speedBonus', 'saulBonus', 'wolfBonus', 'positionBonus'];
    for (i = 0; i < idsZero.length; i++) {
      var el0 = byId(idsZero[i]);
      if (el0) el0.value = 0;
    }

    var idsCheckFalse = ['doubleTime', 'includePrereq'];
    for (i = 0; i < idsCheckFalse.length; i++) {
      var chk = byId(idsCheckFalse[i]);
      if (chk) chk.checked = false;
    }

    var prereqIds = ['prereqAcademy', 'prereqRange', 'prereqStable', 'prereqBarracks', 'prereqEmbassy'];
    for (i = 0; i < prereqIds.length; i++) {
      var pre = byId(prereqIds[i]);
      if (pre) pre.value = '';
    }

    var r = byId('result');
    if (r) r.innerHTML = '';

    var pl = byId('prereq-list');
    if (pl) pl.innerHTML = '';

    var details = byId('prereq-details');
    if (details) {
      try { details.open = false; } catch (e) {}
      try { details.hidden = true; } catch (e) {}
      try { details.setAttribute('hidden', ''); } catch (e) {}
      try { details.removeAttribute('open'); } catch (e) {}
    }
  }

  // ========= 언어 재적용 =========
  var _reapplyRaf = null;
  function reapplyI18N() {
    if (_reapplyRaf) {
      try { caf(_reapplyRaf); } catch (e) {}
    }
    _reapplyRaf = raf(function () {
      applyI18NLabels();
      try { ensureBuildingOptions(); } catch (e) {}
      try {
        if (typeof window.reapplyCalculatorI18N === 'function') {
          window.reapplyCalculatorI18N();
        }
      } catch (e2) {}
    });
  }

  // ========= 코어에 기능 전달 =========
  function pushFeaturesToCoreIfPossible() {
    try {
      if (window.KSD && window.KSD.calc) {
        if (typeof window.KSD.calc.setMaxTG === 'function') window.KSD.calc.setMaxTG(10);
        if (typeof window.KSD.calc.setFeatures === 'function') {
          window.KSD.calc.setFeatures({
            maxTG: 10,
            hasTemperedTruegold: true
          });
        }
      }

      if (window.CALC_CONFIG && typeof window.CALC_CONFIG === 'object') {
        window.CALC_CONFIG.maxTG = 10;
        window.CALC_CONFIG.hasTemperedTruegold = true;
      }
    } catch (e) {}
  }

  // ========= 부트 =========
  var _bootedOnce = false;

  function boot(scope, opts) {
    if (opts == null) opts = {};
    var resetOnEntry = (opts.resetOnEntry === false) ? false : true;

    if (_bootedOnce) {
      if (resetOnEntry) resetFormToDefaults();
      pushFeaturesToCoreIfPossible();
      reapplyI18N();
      return;
    }

    waitForRoot(scope || document, 8000, function () {
      ensureI18NReady(function () {
        ensureBuildingOptions();
        applyI18NLabels();

        waitForCore(8000, function () {
          try {
            pushFeaturesToCoreIfPossible();

            if (typeof window.initCalculator === 'function') {
              window.initCalculator();
            }

            pushFeaturesToCoreIfPossible();
            reapplyI18N();
          } catch (e) {
            if (window.console && console.warn) {
              console.warn('[calc] initCalculator failed:', e && e.message ? e.message : e);
            }
          }

          if (resetOnEntry) resetFormToDefaults();

          try {
            var I = i18n();
            if (I && typeof I.on === 'function') {
              var prev = window.KSD.buildingUI && window.KSD.buildingUI._onLang;
              if (prev && typeof I.off === 'function') {
                try { I.off('languageChanged', prev); } catch (eOff) {}
              }
              var onLng = function () { reapplyI18N(); };
              I.on('languageChanged', onLng);
              if (!window.KSD.buildingUI) window.KSD.buildingUI = {};
              window.KSD.buildingUI._onLang = onLng;
            }
          } catch (e) {}

          _bootedOnce = true;
          if (window.console && console.info) console.info('[calc] building-calculator booted');
        }, function () {
          if (resetOnEntry) resetFormToDefaults();
          _bootedOnce = true;
          if (window.console && console.warn) {
            console.warn('[calc] core not ready — UI labels applied, form reset done');
          }
        });
      });
    }, function () {
      // 루트 없으면 조용히 패스
    });
  }

  // ========= 자동 부트 =========
  document.addEventListener('DOMContentLoaded', function () {
    boot(document, { resetOnEntry: true });
  });

  // ========= 전역 API =========
  window.KSD.buildingUI = window.KSD.buildingUI || {};
  window.KSD.buildingUI.boot = boot;
  window.KSD.buildingUI.reapplyI18N = reapplyI18N;
  window.KSD.buildingUI.reset = resetFormToDefaults;
})();
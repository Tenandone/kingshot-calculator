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

  // ========= 선택자/키 상수 =========
  // 기존/신규 페이지 마크업 모두 자동 부트되도록 루트 후보를 넓게 탐색
  var ROOT_SELECTOR = '#calc-ui, #calc-root, [data-calc="buildings"], [data-calc-root]';

  // UI 셀렉트에 주입할 빌딩 옵션 목록 (라벨은 i18n.calc.* 키로 치환)
  var BUILDING_OPTIONS = [
    { value: 'towncenter', key: 'calc.form.building.option.towncenter' },
    { value: 'embassy',    key: 'calc.form.building.option.embassy'    },
    { value: 'academy',    key: 'calc.form.building.option.academy'    },
    { value: 'command',    key: 'calc.form.building.option.command'    },
    { value: 'barracks',   key: 'calc.form.building.option.barracks'   },
    { value: 'stable',     key: 'calc.form.building.option.stable'     },
    { value: 'range',      key: 'calc.form.building.option.range'      },
    { value: 'infirmary',  key: 'calc.form.building.option.infirmary'  },
    { value: 'war-academy', key: 'calc.form.building.option.war-academy' }
  ];

  // ========= 간단 헬퍼 =========
  function byId(id) { return document.getElementById(id); }
  function hasFn(obj, fn) { return !!(obj && typeof obj[fn] === 'function'); }
  function i18n() { return window.I18N || null; }

  // 통일된 t() — 네임스페이스 키 미존재/실패 시 기본(fallback) 사용
  function t(k, fb) {
    var I = i18n();
    try {
      if (I && typeof I.t === 'function') {
        var txt = I.t(k);
        // 일부 구현체는 미해결 키도 원문을 반환하므로, fb가 있으면 보정
        return (txt === k && fb != null) ? fb : txt;
      }
    } catch (e) {}
    return fb != null ? fb : k;
  }

  // requestAnimationFrame 폴백
  var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
  var caf = window.cancelAnimationFrame || clearTimeout;
  function nowTime() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  // ========= i18n 준비(오류 무시) =========
  // 콜백 기반으로 안전하게 진행: 끝까지 기다리되, 구현체가 콜백/프로미스 둘 다 지원해도 무방
  function ensureI18NReady(done) {
    try {
      var I = i18n();
      if (!I) { if (done) done(); return; }

      var isReady = !!(I.current || I.language || I.isInitialized || typeof I.t === 'function');

      function loadNS(next) {
        try {
          // 다양한 구현체 시그니처 호환
          if (hasFn(I, 'loadNamespaces')) {
            I.loadNamespaces(['common', 'calc'], function () { if (next) next(); });
          } else if (hasFn(I, 'loadNamespace')) {
            I.loadNamespace('calc', function () { if (next) next(); });
          } else if (hasFn(I, 'loadNS')) {
            I.loadNS(['common', 'calc'], function () { if (next) next(); });
          } else if (hasFn(I, 'reloadResources')) {
            // 일부 구현체는 콜백 없음
            try { I.reloadResources(); } catch (e) {}
            if (next) next();
          } else {
            if (next) next();
          }
        } catch (e) {
          // i18n 오류는 무시
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

        // i18next 스타일: init(opts, cb)
        try {
          I.init({ lng: lang, lang: lang, ns: ['common', 'calc'], namespaces: ['common', 'calc'] }, function () {
            loadNS(function () { if (done) done(); });
          });
          return;
        } catch (e) {
          // 일부 구현체는 콜백 미지원 → 그냥 진행
          try { I.init({ lng: lang, lang: lang }); } catch (e2) {}
          loadNS(function () { if (done) done(); });
          return;
        }
      }

      // 이미 준비됨 → 네임스페이스만 보강
      loadNS(function () { if (done) done(); });
    } catch (e) {
      if (done) done(); // 모든 오류 무시 후 진행
    }
  }

  // ========= core(calculator.js)의 init 노출을 대기 =========
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

  // ========= SPA 렌더 이후 calc 루트를 기다림 =========
  function waitForRoot(scope, timeoutMs, onOk, onFail) {
    var sc = scope || document;
    var t0 = nowTime();
    function findRoot() {
      try {
        return sc.querySelector(ROOT_SELECTOR);
      } catch (e) { return null; }
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

  // ========= UI 라벨/ARIA/i18n 재적용(텍스트와 placeholder만) =========
  function applyI18NLabels() {
    // 제목/설명
    var title = byId('calc-title');
    if (title) { title.textContent = t('calc.title', '건물 계산기'); }

    var desc = null;
    try { desc = document.querySelector('.calc-desc'); } catch (e) {}
    if (desc) { desc.textContent = t('calc.desc', '업그레이드에 필요한 자원과 소요 시간을 확인하세요.'); }

    // 레이블/버튼
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
    var i, el, key, fb;
    for (i = 0; i < labelMap.length; i++) {
      el = byId(labelMap[i][0]); key = labelMap[i][1]; fb = labelMap[i][2];
      if (!el) continue;
      var lbl = t(key, fb);
      el.textContent = lbl;
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', lbl);
    }

    var calcBtn = byId('calcBtn');
    if (calcBtn) {
      var txtCalc = t('calc.form.calculate', '계산하기');
      calcBtn.textContent = txtCalc;
      calcBtn.setAttribute('aria-label', txtCalc);
    }

    var clearBtn = byId('clearPlanBtn');
    if (clearBtn) {
      var txtClr = t('calc.form.clear', '초기화');
      clearBtn.textContent = txtClr;
      clearBtn.setAttribute('aria-label', txtClr);
    }

    var prereqTitle = byId('prereq-title');
    if (prereqTitle) { prereqTitle.textContent = t('calc.prereqBox.title', '선행 건물 요구사항'); }

    // placeholder/aria
    var ph = {
      startLevel:   ['calc.form.placeholder.start',    '현재 레벨'],
      targetLevel:  ['calc.form.placeholder.target',   '목표 레벨'],
      speedBonus:   ['calc.form.placeholder.speed',    '0'],
      saulBonus:    ['calc.form.placeholder.saul',     '0'],
      wolfBonus:    ['calc.form.placeholder.wolf',     '0'],
      positionBonus:['calc.form.placeholder.position', '0']
    };
    var id, input, meta, txt;
    for (id in ph) {
      if (!ph.hasOwnProperty(id)) continue;
      input = byId(id);
      if (!input) continue;
      meta = ph[id];
      txt = t(meta[0], meta[1]);
      input.setAttribute('placeholder', txt);
      if (!input.getAttribute('aria-label')) input.setAttribute('aria-label', txt);
    }
  }

  // ========= 빌딩 옵션 주입 / 재라벨링(초기 1회) =========
  function ensureBuildingOptions() {
    var sel = byId('building');
    if (!sel) return;

    // 현재 옵션 값 스냅샷(중복 방지)
    var existingValues = {};
    var i, o;
    for (i = 0; i < (sel.options ? sel.options.length : 0); i++) {
      o = sel.options[i];
      if (o && typeof o.value === 'string') existingValues[o.value] = true;
    }

    // 1) 필요한 옵션이 없으면 추가(플레이스홀더 유지)
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

    // 2) 값 기반 라벨 재적용(플레이스홀더/추가 옵션은 보존)
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

    // ARIA
    sel.setAttribute('aria-label', t('calc.form.building.label', '건물 선택'));
  }

  // ========= “진입 시 폼 초기화” (요구 명세에 맞춰 완전 구현) =========
  function resetFormToDefaults() {
    // 0) form.reset()으로 기본값 회귀(브라우저 복원/오토필 방지)
    var form = byId('calc-form');
    try {
      if (form && typeof form.reset === 'function') {
        form.reset();
      }
    } catch (e) {}

    // 1) 명시적 기본값 강제(HTML 기본값과 동기화)
    var buildingEl = byId('building');
    if (buildingEl && buildingEl.options && buildingEl.options.length) {
      buildingEl.selectedIndex = 0; // 첫 옵션
      try { buildingEl.setAttribute('aria-label', t('calc.form.building.label', '건물 선택')); } catch (e) {}
    }

    var idsOne = ['startLevel', 'targetLevel'];
    var i;
    for (i = 0; i < idsOne.length; i++) {
      var el1 = byId(idsOne[i]);
      if (el1) el1.value = 1;
    }

    var idsZero = ['speedBonus','saulBonus','wolfBonus','positionBonus'];
    for (i = 0; i < idsZero.length; i++) {
      var el0 = byId(idsZero[i]);
      if (el0) el0.value = 0;
    }

    var idsCheckFalse = ['doubleTime','includePrereq'];
    for (i = 0; i < idsCheckFalse.length; i++) {
      var chk = byId(idsCheckFalse[i]);
      if (chk) chk.checked = false;
    }

    var prereqIds = ['prereqAcademy','prereqRange','prereqStable','prereqBarracks','prereqEmbassy'];
    for (i = 0; i < prereqIds.length; i++) {
      var pre = byId(prereqIds[i]);
      if (pre) pre.value = '';
    }

    var r = byId('result'); if (r) r.innerHTML = '';
    var pl = byId('prereq-list'); if (pl) pl.innerHTML = '';

    var details = byId('prereq-details');
    if (details) {
      // details 요소 속성 제어
      try { details.open = false; } catch (e) {}
      try { details.hidden = true; } catch (e) {}
      // 일부 브라우저 호환을 위해 속성도 조정
      try { details.setAttribute('hidden', ''); } catch (e) {}
      try { details.removeAttribute('open'); } catch (e) {}
    }
  }

  // ========= 언어 재적용(공개 API) — 라벨과 placeholder만 다시 적용 =========
  var _reapplyRaf = null;
  function reapplyI18N() {
    if (_reapplyRaf) { try { caf(_reapplyRaf); } catch (e) {} }
    _reapplyRaf = raf(function () {
      // 옵션 추가/변경은 부트 시 1회만 수행. 여기서는 라벨/placeholder만.
      applyI18NLabels();
    });
  }

  // ========= 부트(멱등 + 재진입시 폼 초기화 지원) =========
  var _bootedOnce = false;
  function boot(scope, opts) {
    if (opts == null) opts = {};
    var resetOnEntry = (opts.resetOnEntry === false) ? false : true;

    // 이미 부트된 세션에서도, 라우트 재진입 시 폼만 초기화할 수 있게 허용
    if (_bootedOnce) {
      if (resetOnEntry) {
        resetFormToDefaults();
      }
      return;
    }

    // 0) 루트 대기
    waitForRoot(scope || document, 8000, function () {
      // 1) i18n(calc) 준비 (오류 무시)
      ensureI18NReady(function () {
        // 2) UI 라벨/옵션 선반영(안전: 텍스트만)
        ensureBuildingOptions(); // 초기 1회만 옵션을 보강
        applyI18NLabels();

        // 3) core(calculator.js) 준비 후 초기화
        waitForCore(8000, function () {
          try {
            if (typeof window.initCalculator === 'function') {
              // core 초기화
              window.initCalculator();
            }
          } catch (e) {
            if (window.console && console.warn) console.warn('[calc] initCalculator failed:', e && e.message ? e.message : e);
          }

          // 3.5) ★ 진입 시 폼 초기화
          if (resetOnEntry) {
            resetFormToDefaults();
          }

          // 4) 언어 변경 이벤트에 라벨 재적용 연결(있을 때만)
          try {
            var I = i18n();
            if (I && typeof I.on === 'function') {
              // 기존 핸들러 제거
              var prev = window.KSD.buildingUI && window.KSD.buildingUI._onLang;
              if (prev && typeof I.off === 'function') {
                try { I.off('languageChanged', prev); } catch (eOff) {}
              }
              var onLng = function () { reapplyI18N(); };
              I.on('languageChanged', onLng);
              // 전역 보관(해제용)
              if (!window.KSD.buildingUI) window.KSD.buildingUI = {};
              window.KSD.buildingUI._onLang = onLng;
            }
          } catch (e) {}

          _bootedOnce = true;
          if (window.console && console.info) console.info('[calc] building-calculator booted');
        }, function () {
          // core 없이도 최소한 라벨/옵션은 적용된 상태를 유지
          if (resetOnEntry) {
            resetFormToDefaults();
          }
          _bootedOnce = true;
          if (window.console && console.warn) console.warn('[calc] core not ready — UI labels applied, form reset done');
        });
      });
    }, function () {
      // 루트가 없으면 이 페이지가 아님 — 조용히 패스
    });
  }

  // ========= 자동 부트(선택적) =========
  document.addEventListener('DOMContentLoaded', function () {
    var maybe = null;
    try { maybe = document.querySelector(ROOT_SELECTOR); } catch (e) {}
    if (maybe) boot(document, { resetOnEntry: true });
  });

  // ========= 전역 API 노출 =========
  window.KSD.buildingUI = window.KSD.buildingUI || {};
  window.KSD.buildingUI.boot = boot;
  window.KSD.buildingUI.reapplyI18N = reapplyI18N;
  window.KSD.buildingUI.reset = resetFormToDefaults; // 외부에서 수동 초기화 가능
})();

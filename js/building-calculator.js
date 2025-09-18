(function () {
  'use strict';

  // ========= 전역 네임스페이스 =========
  window.KSD = window.KSD || {};

  // ========= 중복 로드 가드 =========
  if (window.__buildingCalculatorUILoaded__) {
    console.info('[calc] building-calculator.js already loaded — skipping');
    return;
  }
  window.__buildingCalculatorUILoaded__ = true;

  // ========= 선택자/키 상수 =========
  const ROOT_SELECTOR = '#calc-root, [data-calc="buildings"], [data-calc-root]';

  // // 주석: UI 셀렉트에 주입할 빌딩 옵션 목록 (라벨은 i18n.calc.* 키로 치환)
  const BUILDING_OPTIONS = [
    { value: 'towncenter', key: 'calc.form.building.option.towncenter' },
    { value: 'embassy',    key: 'calc.form.building.option.embassy'    },
    { value: 'academy',    key: 'calc.form.building.option.academy'    },
    { value: 'command',    key: 'calc.form.building.option.command'    },
    { value: 'barracks',   key: 'calc.form.building.option.barracks'   },
    { value: 'stable',     key: 'calc.form.building.option.stable'     },
    { value: 'range',      key: 'calc.form.building.option.range'      },
    { value: 'infirmary',  key: 'calc.form.building.option.infirmary'  }
  ];

  // ========= 간단 헬퍼 =========
  const byId = (id) => document.getElementById(id);
  const t = (k, fb) => (window.I18N && typeof I18N.t === 'function') ? I18N.t(k, fb ?? k) : (fb ?? k);

  // // 주석: i18n 준비를 보장한다. calc 네임스페이스를 반드시 로드.
  async function ensureI18NReady() {
    if (!window.I18N) return; // i18n 미사용 환경도 기본 텍스트로 동작하게
    // 초기화 누락 시 기본 init
    if (!(I18N.current && typeof I18N.t === 'function')) {
      const saved = localStorage.getItem('lang');
      const urlLang = new URLSearchParams(location.search).get('lang');
      const fallback = (navigator.language || 'ko').replace('_', '-');
      const lang = urlLang || saved || fallback;
      try { await I18N.init?.({ lang, namespaces: ['common'] }); } catch (_) {}
    }
    // calc 네임스페이스 로드 (구현체에 따라 API 다름)
    try {
      if (typeof I18N.loadNamespace === 'function') {
        await I18N.loadNamespace('calc');
      } else if (typeof I18N.loadNS === 'function') {
        await I18N.loadNS(['common','calc']);
      }
    } catch (_) {}
  }

  // // 주석: core(calculator.js)의 init 노출을 대기
  function waitForCore(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const t0 = performance.now();
      (function tick(){
        if (typeof window.initCalculator === 'function') return resolve();
        if (performance.now() - t0 > timeoutMs) return reject(new Error('core (calculator.js) not ready'));
        requestAnimationFrame(tick);
      })();
    });
  }

  // // 주석: SPA 렌더 이후 calc 루트를 기다림
  function waitForRoot(scope = document, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const root = scope.querySelector(ROOT_SELECTOR);
      if (root) return resolve(root);
      const t0 = performance.now();
      (function tick(){
        const r = scope.querySelector(ROOT_SELECTOR);
        if (r) return resolve(r);
        if (performance.now() - t0 > timeoutMs) return reject(new Error('calc root not found'));
        requestAnimationFrame(tick);
      })();
    });
  }

  // ========= UI 라벨/ARIA/i18n 재적용 =========
  function applyI18NLabels() {
    // 제목/설명
    const title = byId('calc-title');
    if (title) title.textContent = t('calc.title', '건물 계산기');

    const desc = document.querySelector('.calc-desc');
    if (desc) desc.textContent = t('calc.desc', '업그레이드에 필요한 자원과 소요 시간을 확인하세요.');

    // 레이블/버튼
    const labelMap = [
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
    for (const [id, key, fb] of labelMap) {
      const el = byId(id); if (!el) continue;
      el.textContent = t(key, fb);
    }

    const calcBtn = byId('calcBtn');
    if (calcBtn) calcBtn.textContent = t('calc.form.calculate', '계산하기');

    const clearBtn = byId('clearPlanBtn');
    if (clearBtn) clearBtn.textContent = t('calc.form.clear', '초기화');

    const prereqTitle = byId('prereq-title');
    if (prereqTitle) prereqTitle.textContent = t('calc.prereqBox.title', '선행 건물 요구사항');

    // placeholder/aria
    const buildingSel = byId('building');
    if (buildingSel) buildingSel.setAttribute('aria-label', t('calc.form.building.label', '건물 선택'));

    const ph = {
      startLevel:   ['calc.form.placeholder.start',    '현재 레벨'],
      targetLevel:  ['calc.form.placeholder.target',   '목표 레벨'],
      speedBonus:   ['calc.form.placeholder.speed',    '0'],
      saulBonus:    ['calc.form.placeholder.saul',     '0'],
      wolfBonus:    ['calc.form.placeholder.wolf',     '0'],
      positionBonus:['calc.form.placeholder.position', '0']
    };
    Object.keys(ph).forEach(id => {
      const el = byId(id); if (!el) return;
      const [k, fb] = ph[id];
      const txt = t(k, fb);
      el.setAttribute('placeholder', txt);
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', txt);
    });
  }

  // ========= 빌딩 옵션 주입(초기 1회만) =========
  function ensureBuildingOptions() {
    const sel = byId('building');
    if (!sel) return;
    if (sel.options && sel.options.length > 0) return; // 재진입 방지

    const frag = document.createDocumentFragment();
    for (const opt of BUILDING_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = t(opt.key, opt.value);
      frag.appendChild(o);
    }
    sel.appendChild(frag);
  }

  // ========= 언어 재적용(공개 API) =========
  function reapplyI18N() {
    // 옵션 텍스트
    const sel = byId('building');
    if (sel && sel.options && sel.options.length === BUILDING_OPTIONS.length) {
      BUILDING_OPTIONS.forEach((opt, i) => {
        if (sel.options[i]) sel.options[i].textContent = t(opt.key, opt.value);
      });
    }
    // 라벨/버튼
    applyI18NLabels();

    // // 주석: core 프리뷰가 i18n 키를 사용한다면 가벼운 재렌더 트리거
    try { window.initCalculator?.('rerender'); } catch (_) {}
  }

  // ========= 부트(멱등) =========
  let _bootedOnce = false;
  async function boot(scope = document) {
    if (_bootedOnce) return; // 멱등 보장

    let root;
    try {
      root = await waitForRoot(scope, 4000);
    } catch {
      // 루트가 없으면 이 페이지가 아님
      return;
    }

    // 1) i18n(calc) 준비
    await ensureI18NReady();

    // 2) UI 라벨/옵션 선반영
    ensureBuildingOptions();
    applyI18NLabels();

    // 3) core(calculator.js) 준비 후 초기화
    try { await waitForCore(5000); } catch (e) {
      console.warn('[calc] core not ready:', e?.message || e);
      return;
    }
    try { await window.initCalculator?.(); } catch (_) {}

    // 4) 언어 변경 이벤트에 라벨 재적용 연결
    try {
      const onLng = () => reapplyI18N();
      I18N?.off?.('languageChanged', onLng); // 혹시 이전 바인딩 제거
      I18N?.on?.('languageChanged', onLng);
    } catch (_) {}

    _bootedOnce = true;

    // 최종 안전치환(페이지 안의 data-i18n 요소 일괄 적용)
    try { window.I18N?.applyTo?.(root); } catch (_) {}

    console.info('[calc] building-calculator booted');
  }

  // ========= 자동 부트(선택적) =========
  document.addEventListener('DOMContentLoaded', () => {
    const maybe = document.querySelector(ROOT_SELECTOR);
    if (maybe) boot(document);
  });

  // ========= 전역 API 노출 =========
  window.KSD.buildingUI = {
    boot,
    reapplyI18N
  };
})();

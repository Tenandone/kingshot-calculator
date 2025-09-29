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

  // 주석: UI 셀렉트에 주입할 빌딩 옵션 목록 (라벨은 i18n.calc.* 키로 치환)
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
  const hasFn = (obj, fn) => !!(obj && typeof obj[fn] === 'function');
  const i18n = () => (window.I18N || null);

  // 통일된 t() — 네임스페이스 키 미존재 시 fb 사용
  const t = (k, fb) => {
    const I = i18n();
    try {
      if (I && typeof I.t === 'function') {
        const txt = I.t(k);
        return (txt === k && fb != null) ? fb : txt;
      }
    } catch (_) {}
    return fb != null ? fb : k;
  };

  // i18n 준비(초기화 누락·네임스페이스 미로딩까지 케어)
  async function ensureI18NReady() {
    const I = i18n();
    if (!I) return; // i18n 미사용 환경도 기본 텍스트로 동작

    // 초기화 누락 시 기본 init 시도
    const isReady = !!(I.current || I.language || I.isInitialized || typeof I.t === 'function');
    if (!isReady && hasFn(I, 'init')) {
      const saved = localStorage.getItem('lang');
      const urlLang = new URLSearchParams(location.search).get('lang');
      const fallback = (navigator.language || 'ko').replace('_', '-');
      const lang = urlLang || saved || fallback;
      try {
        // 다양한 구현체 호환(lng/lang, ns/namespaces)
        await I.init({ lng: lang, lang, ns: ['common', 'calc'], namespaces: ['common', 'calc'] });
      } catch (_) {}
    }

    // calc 네임스페이스 로드
    try {
      if (hasFn(I, 'loadNamespace')) {
        await I.loadNamespace('calc');
      } else if (hasFn(I, 'loadNS')) {
        await I.loadNS(['common', 'calc']);
      } else if (hasFn(I, 'reloadResources')) {
        await I.reloadResources(); // 일부 구현체
      }
    } catch (_) {}
  }

  // core(calculator.js)의 init 노출을 대기
  function waitForCore(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const t0 = performance.now();
      (function tick() {
        if (typeof window.initCalculator === 'function') return resolve();
        if (performance.now() - t0 > timeoutMs) return reject(new Error('core (calculator.js) not ready'));
        requestAnimationFrame(tick);
      })();
    });
  }

  // SPA 렌더 이후 calc 루트를 기다림
  function waitForRoot(scope = document, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const root = scope.querySelector(ROOT_SELECTOR);
      if (root) return resolve(root);
      const t0 = performance.now();
      (function tick() {
        const r = scope.querySelector(ROOT_SELECTOR);
        if (r) return resolve(r);
        if (performance.now() - t0 > timeoutMs) return reject(new Error('calc root not found'));
        requestAnimationFrame(tick);
      })();
    });
  }

  // ========= UI 라벨/ARIA/i18n 재적용(안전하게 텍스트만 갱신) =========
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
      const el = byId(id);
      if (!el) continue;
      el.textContent = t(key, fb);
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', t(key, fb));
    }

    const calcBtn = byId('calcBtn');
    if (calcBtn) {
      const txt = t('calc.form.calculate', '계산하기');
      calcBtn.textContent = txt;
      calcBtn.setAttribute('aria-label', txt);
    }

    const clearBtn = byId('clearPlanBtn');
    if (clearBtn) {
      const txt = t('calc.form.clear', '초기화');
      clearBtn.textContent = txt;
      clearBtn.setAttribute('aria-label', txt);
    }

    const prereqTitle = byId('prereq-title');
    if (prereqTitle) prereqTitle.textContent = t('calc.prereqBox.title', '선행 건물 요구사항');

    // placeholder/aria
    const ph = {
      startLevel:   ['calc.form.placeholder.start',    '현재 레벨'],
      targetLevel:  ['calc.form.placeholder.target',   '목표 레벨'],
      speedBonus:   ['calc.form.placeholder.speed',    '0'],
      saulBonus:    ['calc.form.placeholder.saul',     '0'],
      wolfBonus:    ['calc.form.placeholder.wolf',     '0'],
      positionBonus:['calc.form.placeholder.position', '0']
    };
    Object.keys(ph).forEach(id => {
      const el = byId(id);
      if (!el) return;
      const [k, fb] = ph[id];
      const txt = t(k, fb);
      el.setAttribute('placeholder', txt);
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', txt);
    });
  }

  // ========= 빌딩 옵션 주입 / 재라벨링(안전) =========
  function ensureBuildingOptions() {
    const sel = byId('building');
    if (!sel) return;

    // 현재 옵션 스냅샷(중복 방지용)
    const existingValues = new Set(Array.from(sel.options || []).map(o => o.value));

    // 1) 필요한 옵션이 없으면 추가(플레이스홀더 유지)
    const frag = document.createDocumentFragment();
    for (const opt of BUILDING_OPTIONS) {
      if (existingValues.has(opt.value)) continue;
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = t(opt.key, opt.value);
      frag.appendChild(o);
    }
    if (frag.childNodes.length) sel.appendChild(frag);

    // 2) 값 기반 라벨 재적용(플레이스홀더/추가 옵션은 보존)
    const labelMapByValue = new Map(BUILDING_OPTIONS.map(o => [o.value, t(o.key, o.value)]));
    Array.from(sel.options || []).forEach(o => {
      if (!o) return;
      if (labelMapByValue.has(o.value)) o.textContent = labelMapByValue.get(o.value);
    });

    // ARIA
    sel.setAttribute('aria-label', t('calc.form.building.label', '건물 선택'));
  }

  // ========= 언어 재적용(공개 API) =========
  let _reapplyTimer = null;
  function reapplyI18N() {
    // 빠른 토글 시 디바운스
    if (_reapplyTimer) cancelAnimationFrame(_reapplyTimer);
    _reapplyTimer = requestAnimationFrame(() => {
      ensureBuildingOptions(); // 옵션 라벨/부족분 보강
      applyI18NLabels();       // 라벨·버튼·placeholder 재적용

      // core에게 가벼운 재렌더 힌트 전달 (존재하면)
      try { window.initCalculator?.('rerender'); } catch (_) {}
    });
  }

  // ========= 부트(멱등) =========
  let _bootedOnce = false;
  async function boot(scope = document, opts = { allowUnsafeApply: false }) {
    if (_bootedOnce) return; // 멱등 보장

    let root;
    try {
      root = await waitForRoot(scope, 8000);
    } catch {
      // 루트가 없으면 이 페이지가 아님
      return;
    }

    // 1) i18n(calc) 준비
    await ensureI18NReady();

    // 2) UI 라벨/옵션 선반영(안전: 텍스트만)
    ensureBuildingOptions();
    applyI18NLabels();

    // (선택) 매우 제한적으로 data-i18n를 안전 적용하고 싶다면,
    // opts.allowUnsafeApply=true 인 경우에만 실행하도록 기본 OFF
    if (opts && opts.allowUnsafeApply === true) {
      try {
        // 경고: 일부 구현체는 DOM을 재생성하여 이벤트를 끊습니다.
        // 반드시 안전성이 보장된 구현체에서만 허용하세요.
        i18n()?.applyTo?.(root);
      } catch (e) {
        console.warn('[calc] i18n.applyTo failed or is unsafe:', e?.message || e);
      }
    }

    // 3) core(calculator.js) 준비 후 초기화
    try { await waitForCore(8000); } catch (e) {
      console.warn('[calc] core not ready:', e?.message || e);
      return;
    }
    try { await window.initCalculator?.(); } catch (e) {
      console.warn('[calc] initCalculator failed:', e?.message || e);
    }

    // 4) 언어 변경 이벤트에 라벨 재적용 연결(안정 레퍼런스 관리)
    try {
      const I = i18n();
      const prev = window.KSD.buildingUI?._onLang;
      if (prev && I?.off) {
        try { I.off('languageChanged', prev); } catch (_) {}
      }
      const onLng = () => reapplyI18N();
      if (I?.on) I.on('languageChanged', onLng);
      // 전역 보관(해제용)
      window.KSD.buildingUI = window.KSD.buildingUI || {};
      window.KSD.buildingUI._onLang = onLng;
    } catch (_) {}

    _bootedOnce = true;

    console.info('[calc] building-calculator booted');
  }

  // ========= 자동 부트(선택적) =========
  document.addEventListener('DOMContentLoaded', () => {
    const maybe = document.querySelector(ROOT_SELECTOR);
    if (maybe) boot(document);
  });

  // ========= 전역 API 노출 =========
  window.KSD.buildingUI = {
    ...window.KSD.buildingUI,
    boot,
    reapplyI18N
  };
})();

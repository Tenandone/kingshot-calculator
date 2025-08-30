// building-calculator.js — 빌딩 계산기 전용 UI 바인딩 (Core 분리판)
//
// 이 파일은 "calculator.js (core)"가 이미 로드되어 있다는 전제에서 동작합니다.
// - 데이터 파싱/계산 로직: calculator.js (core)
// - 화면 요소(i18n 라벨/옵션 주입/이벤트 1회 바인딩): building-calculator.js (이 파일)
//
// 사용 방법
// 1) calculator.html에서 다음 순서로 포함하세요.
//    <script src="/js/calculator.js?v=now" defer></script>  // core
//    <script src="/js/building-calculator.js?v=now" defer></script>  // UI
// 2) 페이지가 로드되면 자동으로 window.initCalculator()를 호출합니다.
// 3) 언어를 바꾸면 window.reapplyBuildingI18N()을 호출하여 라벨을 재적용하세요.

(function(){
  'use strict';

  // ========= 중복 로드 가드 =========
  if (window.__buildingCalculatorUILoaded__) {
    console.info('[calc] building-calculator.js already loaded — skipping');
    return;
  }
  window.__buildingCalculatorUILoaded__ = true;

  // ========= 간단 헬퍼 =========
  const t = (k, fb) => (window.I18N && typeof I18N.t === 'function') ? I18N.t(k, fb ?? k) : (fb ?? k);
  const byId = (id) => document.getElementById(id);

  // ========= 빌딩 옵션 정의 (UI용 키 고정) =========
  // core 내부의 BUILDING_I18N_KEY와 동일한 i18n 키를 사용합니다.
  const BUILDING_OPTIONS = [
    { value: 'towncenter', key: 'calc.form.building.option.towncenter' },
    { value: 'embassy',    key: 'calc.form.building.option.embassy' },
    { value: 'academy',    key: 'calc.form.building.option.academy' },
    { value: 'command',    key: 'calc.form.building.option.command' },
    { value: 'barracks',   key: 'calc.form.building.option.barracks' },
    { value: 'stable',     key: 'calc.form.building.option.stable' },
    { value: 'range',      key: 'calc.form.building.option.range' },
    { value: 'infirmary',  key: 'calc.form.building.option.infirmary' }
  ];

  // ========= UI 라벨/ARIA/i18n 재적용 =========
  function applyI18NLabels(){
    // 제목/설명
    const title = byId('calc-title');
    if (title) title.textContent = t('calc.title', '건물 계산기');

    const desc = document.querySelector('.calc-desc');
    if (desc) desc.textContent = t('calc.desc', '업그레이드에 필요한 자원과 소요 시간을 확인하세요.');

    // 레이블들
    const labelMap = [
      ['label-building', 'calc.form.building.label', '건물 선택'],
      ['label-start',    'calc.form.startLevel',      '시작 레벨'],
      ['label-target',   'calc.form.targetLevel',     '목표 레벨'],
      ['label-speed',    'calc.form.speedBonus',      '건설 속도(%)'],
      ['label-saul',     'calc.form.saulBonus',       '살로 할인(%)'],
      ['label-wolf',     'calc.form.wolfBonus',       '늑대 버프(%)'],
      ['label-position', 'calc.form.positionBonus',   '직책/타이틀(%)'],
      ['label-double',   'calc.form.doubleTime',      '이중법령(시간 20% 감소)'],
      ['label-include',  'calc.form.includePrereq',   '선행 건물 포함']
    ];
    for (const [id, key, fb] of labelMap){
      const el = byId(id); if (!el) continue;
      // label 요소면 textContent, 버튼이면 value/텍스트 등으로 처리
      if (el.tagName === 'LABEL' || el.classList.contains('as-label')) el.textContent = t(key, fb);
      else if (el.tagName === 'BUTTON') el.textContent = t(key, fb);
      else el.textContent = t(key, fb);
    }

    // 버튼
    const calcBtn = byId('calcBtn');
    if (calcBtn) calcBtn.textContent = t('calc.form.calculate', '계산하기');

    const clearBtn = byId('clearPlanBtn');
    if (clearBtn) clearBtn.textContent = t('calc.form.clear', '초기화');

    // 선행박스 타이틀
    const prereqTitle = byId('prereq-title');
    if (prereqTitle) prereqTitle.textContent = t('calc.prereqBox.title', '선행 건물 요구사항');

    // 접근성/placeholder
    const buildingSel = byId('building');
    if (buildingSel) buildingSel.setAttribute('aria-label', t('calc.form.building.label', '건물 선택'));

    ['startLevel','targetLevel','speedBonus','saulBonus','wolfBonus','positionBonus'].forEach(id =>{
      const el = byId(id); if (!el) return;
      const key = {
        startLevel:'calc.form.placeholder.start',
        targetLevel:'calc.form.placeholder.target',
        speedBonus:'calc.form.placeholder.speed',
        saulBonus:'calc.form.placeholder.saul',
        wolfBonus:'calc.form.placeholder.wolf',
        positionBonus:'calc.form.placeholder.position'
      }[id];
      const fb = {
        startLevel:'현재 레벨',
        targetLevel:'목표 레벨',
        speedBonus:'0',
        saulBonus:'0',
        wolfBonus:'0',
        positionBonus:'0'
      }[id];
      el.setAttribute('placeholder', t(key, fb));
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', t(key, fb));
    });
  }

  // ========= 빌딩 옵션 주입 (초기 1회만) =========
  function ensureBuildingOptions(){
    const sel = byId('building');
    if (!sel) return;
    // 이미 옵션이 있다면 덮어쓰지 않음 (SPA 재진입 방지)
    if (sel.options && sel.options.length > 0) return;

    const frag = document.createDocumentFragment();
    for (const opt of BUILDING_OPTIONS){
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = t(opt.key, opt.value);
      frag.appendChild(o);
    }
    sel.appendChild(frag);
  }

  // ========= 언어 변경 시 라벨만 재적용할 수 있도록 공개 =========
  function reapplyBuildingI18N(){
    // 셀렉트 옵션 텍스트 새로고침
    const sel = byId('building');
    if (sel && sel.options && sel.options.length === BUILDING_OPTIONS.length){
      BUILDING_OPTIONS.forEach((opt, i) => {
        if (sel.options[i]) sel.options[i].textContent = t(opt.key, opt.value);
      });
    }
    applyI18NLabels();
    // core의 프리뷰 영역도 i18n 키를 사용하므로, 가벼운 재계산 유도
    try { if (typeof window.initCalculator === 'function') window.initCalculator(); } catch(_){}
  }

  // ========= 초기 진입 =========
  document.addEventListener('DOMContentLoaded', () => {
    // 라벨/옵션 주입 → 코어 초기화 순서로 호출
    ensureBuildingOptions();
    applyI18NLabels();

    // 코어 계산기 초기화 (데이터 로드 + 이벤트 바인딩)
    if (typeof window.initCalculator === 'function') {
      window.initCalculator();
    } else {
      console.warn('[calc] calculator.js (core) not found. Make sure it is loaded before building-calculator.js');
    }
  });

  // 전역 공개 함수 (언어 전환 시 호출)
  window.reapplyBuildingI18N = reapplyBuildingI18N;
})();

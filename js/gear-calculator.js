(function () {
  'use strict';

  // ===== i18n =====
  const T = (k) => (window.I18N?.t?.(k) ?? k);

  // ===== 숫자 포맷 =====
  const fmt = (n) => (n || 0).toLocaleString();

  // ===== DOM helper =====
  function h(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style') el.setAttribute('style', v);
      else el.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(ch => {
      if (ch == null) return;
      el.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch);
    });
    return el;
  }
  const stepKeys = (steps) => Object.keys(steps);
  const slug = (s) => String(s).replace(/\s+/g, '-');

  // ====== (중요) KO 단계라벨 → i18n 키 매핑 기본 제공 ======
  // 원본 JSON이 한국어 키를 쓰는 경우를 커버하기 위한 기본 매핑.
  // 외부(opt.tierKeyMap)로 들어오면 아래 기본값과 merge해서 사용함.
  function buildTierKeyMapKO() {
    const map = {};
    function add(base, code, stars) {
      map[base] = 'calcGear.tiers.' + code;
      for (let i = 1; i <= stars; i++) {
        map[`${base} (★${i})`] = `calcGear.tiers.${code}_${i}`;
      }
    }
    add('고급', 'basic', 1);

    add('레어', 'rare', 3);

    add('에픽', 'epic', 3);
    add('에픽 T1', 'epicT1', 3);

    add('레전드', 'legend', 3);
    add('레전드 T1', 'legendT1', 3);
    add('레전드 T2', 'legendT2', 3);
    add('레전드 T3', 'legendT3', 3);

    add('신화', 'mythic', 3);
    add('신화 T1', 'mythicT1', 3);
    add('신화 T2', 'mythicT2', 3);
    add('신화 T3', 'mythicT3', 3);
    add('신화 T4', 'mythicT4', 3);

    return map;
  }
  // 전역에서도 재사용 가능하도록 노출(부모 라우터가 전달해서 쓰고 싶다면 활용)
  window.TIER_KEY_MAP_KO = window.TIER_KEY_MAP_KO || buildTierKeyMapKO();

  // 단계 구간 합산 (현재 다음 단계부터 목표 단계 "포함"해서 합산)
  function sumRange(steps, keys, fromIdx, toIdx) {
    if (fromIdx >= toIdx) {
      return { satin: 0, thread: 0, sketch: 0, score: 0, invalid: true };
    }
    let s = 0, t = 0, sk = 0, sc = 0;
    for (let i = fromIdx + 1; i <= toIdx; i++) {
      const k = keys[i];
      const c = steps[k] || {};
      s  += +c.satin  || 0;
      t  += +c.thread || 0;
      sk += +c.sketch || 0;
      sc += +c.score  || 0;
    }
    return { satin: s, thread: t, sketch: sk, score: sc, invalid: false };
  }

  // 내부 상태(재적용/복원용)
  const STATE = {
    root: null,
    gear: null,
    opts: null,
    els: {},
    last: null
  };

  async function initGearCalculator(opt) {
    const {
      mount,
      jsonUrl,
      data,
      slots = [
        T('calcGear.slots.hat'),
        T('calcGear.slots.necklace'),
        T('calcGear.slots.armor'),
        T('calcGear.slots.pants'),
        T('calcGear.slots.ring'),
        T('calcGear.slots.staff')
      ],
      stepsMap = null,
      slotClasses: slotClassesInput,
      // 외부에서 tierKeyMap을 주면 기본(KO) 매핑과 병합하여 사용
      tierKeyMap: tierKeyMapExternal
    } = opt || {};

    // 외부 i18n-코드 매핑과 KO기본 매핑 merge
    const tierMap = Object.assign({}, window.TIER_KEY_MAP_KO || buildTierKeyMapKO(), tierKeyMapExternal || {});

    // 병종 라벨 (i18n)
    const CLASS = {
      cav: T('calcGear.classes.cavalry'),
      inf: T('calcGear.classes.infantry'),
      rng: T('calcGear.classes.archer')
    };

    const defaultSlotClasses = {
      [T('calcGear.slots.hat')]      : CLASS.cav,
      [T('calcGear.slots.necklace')] : CLASS.cav,
      [T('calcGear.slots.armor')]    : CLASS.inf,
      [T('calcGear.slots.pants')]    : CLASS.inf,
      [T('calcGear.slots.ring')]     : CLASS.rng,
      [T('calcGear.slots.staff')]    : CLASS.rng
    };
    const slotClasses = Object.assign({}, defaultSlotClasses, slotClassesInput || {});

    const root = document.querySelector(mount);
    if (!root) {
      console.error('[gear-calc] mount element not found:', mount);
      return;
    }

    // 데이터 로드
    let gear;
    try {
      if (data) {
        gear = data;
      } else if (jsonUrl) {
        const res = await fetch(jsonUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error('JSON fetch failed: ' + res.status);
        gear = await res.json();
      } else {
        throw new Error('Either jsonUrl or data must be provided.');
      }
    } catch (e) {
      console.error('[gear-calc] failed to load data:', e);
      root.textContent = T('calcGear.alerts.loadFail');
      return;
    }

    // ===== 스타일 (한 번만) =====
    if (!document.getElementById('gear-calc-style')) {
      const style = document.createElement('style');
      style.id = 'gear-calc-style';
      style.textContent = `
        .gear-calc-wrap{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial}
        .slot-list{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}
        .slot-item{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #ddd;border-radius:10px;background:#f5f5f7;cursor:pointer}
        .slot-item input{margin:0}
        .slot-item .pill{font-size:11px;line-height:1;padding:3px 8px;border-radius:999px;border:1px solid rgba(0,0,0,.08);background:#fff;color:#222}
        .pill-cav{box-shadow:inset 0 0 0 999px rgba(59,130,246,.12)}
        .pill-inf{box-shadow:inset 0 0 0 999px rgba(16,185,129,.14)}
        .pill-rng{box-shadow:inset 0 0 0 999px rgba(245,158,11,.16)}
        .gear-card{border:1px solid #e5e7eb;border-radius:14px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.05);max-width:860px;background:#fff}
        .gear-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:10px 0}
        .gear-row select,.gear-row button{padding:8px 10px;border:1px solid #ddd;border-radius:10px;background:#f8f9fb}
        .gear-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}
        .gear-kpi{border:1px solid #eee;border-radius:12px;padding:12px;text-align:center;background:#fafafa}
        .gear-kpi .num{font-size:18px;font-weight:700}
        .gear-muted{color:#666;font-size:12px;margin-top:8px}
        .gear-actions{display:flex;gap:8px;margin-top:8px}
        .gear-details{margin-top:12px;font-size:13px;background:#fff;border:1px solid #eee;border-radius:10px;max-height:260px;overflow:auto}
        .gear-details table{border-collapse:collapse;width:100%}
        .gear-details th,.gear-details td{border-bottom:1px solid #f0f0f0;padding:8px 10px;text-align:left}
        .gear-details th{background:#fafafa;font-weight:600}
        .gc-total-row td{font-weight:700;background:#fbfbfb}
      `;
      document.head.appendChild(style);
    }

    // ===== UI 조립 =====
    root.innerHTML = '';
    root.classList.add('gear-calc-wrap');
    const card = h('div', { class: 'gear-card' });

    // 슬롯 체크박스
    const slotList = h('div', { class: 'slot-list', role: 'group', 'aria-label': T('calcGear.cols.slot') });

    // 기본 슬롯 키(기본 슬롯 사용 시 언어 재적용에 활용)
    const BASE_SLOT_KEYS = ['hat','necklace','armor','pants','ring','staff'];
    const usingDefaultSlots = (opt.slots == null);

    const classToPill = (cls) => {
      if (cls === CLASS.cav) return 'pill pill-cav';
      if (cls === CLASS.inf) return 'pill pill-inf';
      return 'pill pill-rng';
    };

    const slotSpanRefs = []; // reapply에서 텍스트 교체용
    slots.forEach((name, idx) => {
      const id = 'slot-' + slug(name);
      const cls = slotClasses[name] || '';
      const pill = h('span', { class: classToPill(cls), text: cls });
      const input = h('input', { type: 'checkbox', id, name: 'slot', value: name });
      if (usingDefaultSlots) input.dataset.slotkey = BASE_SLOT_KEYS[idx] || '';
      const nameSpan = h('span', { text: name });
      if (usingDefaultSlots) nameSpan.dataset.slotkey = BASE_SLOT_KEYS[idx] || '';
      const label = h('label', { class: 'slot-item', for: id }, [input, nameSpan, pill]);
      slotList.appendChild(label);
      slotSpanRefs.push(nameSpan);
    });

    // 단계 선택 + 버튼
    const fromSel = h('select', { 'aria-label': T('calcGear.cols.current') });
    const toSel   = h('select', { 'aria-label': T('calcGear.cols.target') });
    const runBtn  = h('button', { text: T('calcGear.actions.calculate') });

    // KPI
    const kpiSat   = h('div', { class: 'gear-kpi' }, [h('div', { class: 'num', id: 'gc-sat', text: '0' }), h('div', { id:'gc-kpi-sat-lab', text: T('calcGear.kpi.satin') })]);
    const kpiThr   = h('div', { class: 'gear-kpi' }, [h('div', { class: 'num', id: 'gc-thr', text: '0' }), h('div', { id:'gc-kpi-thr-lab', text: T('calcGear.kpi.thread') })]);
    const kpiSk    = h('div', { class: 'gear-kpi' }, [h('div', { class: 'num', id: 'gc-sk',  text: '0' }), h('div', { id:'gc-kpi-sk-lab',  text: T('calcGear.kpi.sketch') })]);
    const kpiScore = h('div', { class: 'gear-kpi' }, [h('div', { class: 'num', id: 'gc-score',text: '0' }), h('div', { id:'gc-kpi-score-lab',text: T('calcGear.kpi.score') })]);
    const grid = h('div', { class: 'gear-grid' }, [kpiSat, kpiThr, kpiSk, kpiScore]);

    const row = h('div', { class: 'gear-row' }, [
      h('label', { id:'gc-lab-current', text: T('calcGear.cols.current') }), fromSel,
      h('label', { id:'gc-lab-target',  text: T('calcGear.cols.target')  }), toSel,
      runBtn
    ]);

    const hint = h('div', { class: 'gear-muted', id:'gc-hint', text: T('calcGear.misc.hint') });

    // 상세 테이블
    const detailWrap = h('div', { class: 'gear-details', style: 'display:none' });
    const thSlot   = h('th', { id:'gc-th-slot',   text: T('calcGear.cols.slot') });
    const thClass  = h('th', { id:'gc-th-class',  text: T('calcGear.cols.class') });
    const thSatin  = h('th', { id:'gc-th-satin',  text: T('calcGear.cols.satin') });
    const thThread = h('th', { id:'gc-th-thread', text: T('calcGear.cols.thread') });
    const thSketch = h('th', { id:'gc-th-sketch', text: T('calcGear.cols.sketch') });
    const thScore  = h('th', { id:'gc-th-score',  text: T('calcGear.cols.score') });

    const detailTable = h('table', {}, [
      h('thead', {}, h('tr', {}, [thSlot, thClass, thSatin, thThread, thSketch, thScore])),
      h('tbody', { id: 'gc-tbody' })
    ]);
    detailWrap.appendChild(detailTable);

    const actions = h('div', { class: 'gear-actions' });
    const toggleDetailBtn = h('button', { id:'gc-toggle', text: T('calcGear.actions.showDetail'), disabled: 'disabled' });
    actions.appendChild(toggleDetailBtn);

    card.appendChild(slotList);
    card.appendChild(row);
    card.appendChild(grid);
    card.appendChild(hint);
    card.appendChild(actions);
    card.appendChild(detailWrap);
    root.appendChild(card);

    // ---------- 티어 라벨 i18n ----------
    function getTierLabelByIndex(keys, idx) {
      const k = keys[idx];
      const node = gear.steps[k];
      // (1) 데이터에 code/tierCode가 있으면 최우선 사용
      const code = node && (node.code || node.tierCode);
      if (code) return T('calcGear.tiers.' + code);
      // (2) KO 원본 키 → i18n 키 매핑 사용
      const rawLabel = k;
      const i18nKey = tierMap[rawLabel];
      return i18nKey ? T(i18nKey) : rawLabel;
    }

    function getStepsForSlot(slotName) {
      if (stepsMap && stepsMap[slotName]) return stepsMap[slotName];
      return gear.steps;
    }

    // 단계 옵션 채우기
    function populateSelects() {
      const keys = stepKeys(gear.steps);
      fromSel.innerHTML = '';
      toSel.innerHTML   = '';
      keys.forEach((_, idx) => {
        const label = getTierLabelByIndex(keys, idx);
        fromSel.appendChild(h('option', { value: String(idx), text: label }));
        toSel.appendChild(h('option',   { value: String(idx), text: label }));
      });
      // 기본값: 현재 = 첫 단계, 목표 = 마지막 단계
      fromSel.value = '0';
      toSel.value   = String(keys.length - 1);
    }
    populateSelects();

    // 상세 토글
    toggleDetailBtn.addEventListener('click', () => {
      const open = detailWrap.style.display !== 'none';
      detailWrap.style.display = open ? 'none' : '';
      toggleDetailBtn.textContent = open ? T('calcGear.actions.showDetail') : T('calcGear.actions.hideDetail');
    });

    // 출력 리셋
    function resetOutputs() {
      document.getElementById('gc-sat').textContent = '0';
      document.getElementById('gc-thr').textContent = '0';
      document.getElementById('gc-sk').textContent  = '0';
      document.getElementById('gc-score').textContent = '0';
      detailWrap.style.display = 'none';
      document.getElementById('gc-tbody').innerHTML = '';
      toggleDetailBtn.disabled = true;
      toggleDetailBtn.textContent = T('calcGear.actions.showDetail');
    }

    // 계산
    const run = () => {
      const checked = [...root.querySelectorAll('input[name="slot"]:checked')].map(i => i.value);
      if (!checked.length) { alert(T('calcGear.alerts.needSlot')); return; }
      const fromIdx = parseInt(fromSel.value, 10);
      const toIdx   = parseInt(toSel.value, 10);
      if (fromIdx >= toIdx) { alert(T('calcGear.alerts.invalidRange')); return; }

      let total = { satin: 0, thread: 0, sketch: 0, score: 0 };
      const tbody = document.getElementById('gc-tbody');
      tbody.innerHTML = '';

      checked.forEach(slotName => {
        const steps = getStepsForSlot(slotName);
        const keys = stepKeys(steps);
        const r = sumRange(steps, keys, fromIdx, toIdx);
        total.satin  += r.satin;
        total.thread += r.thread;
        total.sketch += r.sketch;
        total.score  += r.score;

        const cls = slotClasses[slotName] || '';
        tbody.appendChild(h('tr', {}, [
          h('td', { text: slotName }),
          h('td', { text: cls }),
          h('td', { text: fmt(r.satin) }),
          h('td', { text: fmt(r.thread) }),
          h('td', { text: fmt(r.sketch) }),
          h('td', { text: fmt(r.score) })
        ]));
      });

      const trTotal = h('tr', { class: 'gc-total-row' }, [
        h('td', { text: T('calcGear.cols.total') }),
        h('td', { text: T('calcGear.cols.selected').replace('{n}', String(checked.length)) }),
        h('td', { text: fmt(total.satin) }),
        h('td', { text: fmt(total.thread) }),
        h('td', { text: fmt(total.sketch) }),
        h('td', { text: fmt(total.score) })
      ]);
      tbody.appendChild(trTotal);

      document.getElementById('gc-sat').textContent   = fmt(total.satin);
      document.getElementById('gc-thr').textContent   = fmt(total.thread);
      document.getElementById('gc-sk').textContent    = fmt(total.sketch);
      document.getElementById('gc-score').textContent = fmt(total.score);

      // 버튼/상세 갱신
      toggleDetailBtn.disabled = false;
      detailWrap.style.display = '';
      toggleDetailBtn.textContent = T('calcGear.actions.hideDetail');

      // 마지막 상태 저장 (언어 전환 후 복원용)
      STATE.last = {
        checkedKeys: [...root.querySelectorAll('input[name="slot"]:checked')]
          .map(i => i.dataset.slotkey || i.value),
        fromIdx: parseInt(fromSel.value, 10),
        toIdx:   parseInt(toSel.value, 10)
      };
    };
    runBtn.addEventListener('click', run);

    // ===== 재적용 핸들 저장 =====
    STATE.root = root;
    STATE.gear = gear;
    STATE.opts = { slots, usingDefaultSlots, BASE_SLOT_KEYS, slotSpanRefs, slotClasses, tierKeyMap: tierMap };
    STATE.els  = {
      fromSel, toSel, runBtn, toggleDetailBtn, detailWrap,
      kpiLabs: {
        sat: document.getElementById('gc-kpi-sat-lab'),
        thr: document.getElementById('gc-kpi-thr-lab'),
        sk : document.getElementById('gc-kpi-sk-lab'),
        sc : document.getElementById('gc-kpi-score-lab')
      },
      hdrs: {
        slot: thSlot, cls: thClass, sat: thSatin, thr: thThread, sk: thSketch, sc: thScore
      },
      rowLabs: {
        current: document.getElementById('gc-lab-current'),
        target:  document.getElementById('gc-lab-target'),
        hint
      }
    };

    // 외부에서 재초기화 접근 가능
    window.__gearCalcReset = resetOutputs;

    // 언어 변경 시 자동 재번역(1회 바인딩)
    if (!window.__gear_i18n_bound__) {
      document.addEventListener('i18n:changed', function () {
        try { window.reapplyGearCalculatorI18N(); } catch (_) {}
      }, false);
      window.__gear_i18n_bound__ = true;
    }
  }

  // ===== 언어 전환 재적용 =====
  window.reapplyGearCalculatorI18N = function reapplyGearCalculatorI18N() {
    const S = STATE;
    if (!S.root || !S.gear || !S.opts || !S.els) return;

    const { usingDefaultSlots, BASE_SLOT_KEYS, slotSpanRefs, tierKeyMap } = S.opts;
    const { fromSel, toSel, runBtn, toggleDetailBtn, kpiLabs, hdrs, rowLabs, detailWrap } = S.els;

    // 1) 정적 라벨
    rowLabs.current.textContent = T('calcGear.cols.current');
    rowLabs.target .textContent = T('calcGear.cols.target');
    rowLabs.hint.textContent    = T('calcGear.misc.hint');
    runBtn.textContent          = T('calcGear.actions.calculate');
    (detailWrap.style.display === 'none')
      ? (toggleDetailBtn.textContent = T('calcGear.actions.showDetail'))
      : (toggleDetailBtn.textContent = T('calcGear.actions.hideDetail'));

    // KPI 라벨
    kpiLabs.sat.textContent = T('calcGear.kpi.satin');
    kpiLabs.thr.textContent = T('calcGear.kpi.thread');
    kpiLabs.sk .textContent = T('calcGear.kpi.sketch');
    kpiLabs.sc .textContent = T('calcGear.kpi.score');

    // 테이블 헤더
    hdrs.slot.textContent = T('calcGear.cols.slot');
    hdrs.cls .textContent = T('calcGear.cols.class');
    hdrs.sat .textContent = T('calcGear.cols.satin');
    hdrs.thr .textContent = T('calcGear.cols.thread');
    hdrs.sk  .textContent = T('calcGear.cols.sketch');
    hdrs.sc  .textContent = T('calcGear.cols.score');

    // 2) 슬롯 이름 (기본 슬롯 사용 시에만 재번역)
    if (usingDefaultSlots) {
      slotSpanRefs.forEach((span, idx) => {
        const key = span.dataset.slotkey || BASE_SLOT_KEYS[idx];
        if (key) span.textContent = T('calcGear.slots.' + key);
      });
    }

    // 3) 티어 셀렉트 라벨 재생성(선택 인덱스 유지)
    const keys = stepKeys(S.gear.steps);
    const keepFrom = parseInt(fromSel.value || '0', 10);
    const keepTo   = parseInt(toSel.value   || String(keys.length - 1), 10);
    const getTierLabelByIndex = (ks, idx) => {
      const k = ks[idx];
      const node = S.gear.steps[k];
      const code = node && (node.code || node.tierCode);
      if (code) return T('calcGear.tiers.' + code);
      const raw = k;
      const i18nKey = (tierKeyMap || {})[raw];
      return i18nKey ? T(i18nKey) : raw;
    };
    fromSel.innerHTML = '';
    toSel.innerHTML   = '';
    keys.forEach((_, idx) => {
      const lbl = getTierLabelByIndex(keys, idx);
      fromSel.appendChild(h('option', { value: String(idx), text: lbl }));
      toSel.appendChild(h('option',   { value: String(idx), text: lbl }));
    });
    fromSel.value = String(Math.max(0, Math.min(keepFrom, keys.length - 1)));
    toSel.value   = String(Math.max(0, Math.min(keepTo,   keys.length - 1)));

    // 4) 마지막 선택 복원 + 자동 재계산
    if (S.last) {
      const want = new Set(S.last.checkedKeys);
      S.root.querySelectorAll('input[name="slot"]').forEach(i => {
        const key = i.dataset.slotkey || i.value;
        i.checked = want.has(key);
      });
      fromSel.value = String(Math.max(0, Math.min(S.last.fromIdx, keys.length - 1)));
      toSel.value   = String(Math.max(0, Math.min(S.last.toIdx,   keys.length - 1)));
      runBtn.click(); // 재계산 트리거
    }
  };

  // 전역 진입점
  window.initGearCalculator = initGearCalculator;
})();

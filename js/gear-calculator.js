/* js/gear-calculator.js  (v20250823-multi)
 * 영주 장비 계산기 – JSON을 불러와(UI 렌더+합산) 한 번에 동작
 *
 * 사용 방법:
 *  1) HTML에 <div id="gear-calc"></div> 컨테이너 준비
 *  2) 스크립트 로드 후:
 *       initGearCalculator({
 *         mount: '#gear-calc',
 *         jsonUrl: '/data/governor-gear.json',
 *         // slots 생략 시 기본 6슬롯(모자/목걸이/상의/하의/반지/지팡이)
 *         // slotClasses 생략 시 기본 매핑(모자/목걸이=기병, 상의/하의=보병, 반지/지팡이=궁병)
 *         // stepsMap: { '모자': stepsObj, ... }  // 부위별 비용 상이 시 오버라이드
 *       });
 */

(function () {
  'use strict';

  const fmt = (n) => (n || 0).toLocaleString();

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

  function sumRange(steps, keys, fromIdx, toIdx) {
    if (fromIdx >= toIdx) {
      return { satin: 0, thread: 0, sketch: 0, score: 0, invalid: true };
    }
    let s = 0, t = 0, sk = 0, sc = 0;
    for (let i = fromIdx; i < toIdx; i++) {
      const k = keys[i];
      const c = steps[k] || {};
      s  += +c.satin  || 0;
      t  += +c.thread || 0;
      sk += +c.sketch || 0;
      sc += +c.score  || 0;
    }
    return { satin: s, thread: t, sketch: sk, score: sc, invalid: false };
  }

  // 슬롯명을 id로 쓰기 위한 간단 슬러그
  const slug = (s) => s.replace(/\s+/g, '-');

  /**
   * @param {Object} opt
   * @param {string} opt.mount
   * @param {string} [opt.jsonUrl]
   * @param {Object} [opt.data]
   * @param {string[]} [opt.slots]
   * @param {Object<string,Object>} [opt.stepsMap]
   * @param {Object<string,string>} [opt.slotClasses]
   */
  async function initGearCalculator(opt) {
    const {
      mount,
      jsonUrl,
      data,
      slots = ['모자', '목걸이', '상의', '하의', '반지', '지팡이'],
      stepsMap = null,
      slotClasses: slotClassesInput
    } = opt || {};

    const defaultSlotClasses = {
      '모자': '기병', '목걸이': '기병',
      '상의': '보병', '하의': '보병',
      '반지': '궁병', '지팡이': '궁병'
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
      root.textContent = '데이터를 불러오지 못했습니다.';
      return;
    }

    const getStepsForSlot = (slotName) => {
      if (stepsMap && stepsMap[slotName]) return stepsMap[slotName];
      return gear.steps;
    };

    // 스타일 (중복 주입 방지)
    if (!document.getElementById('gear-calc-style')) {
      const style = document.createElement('style');
      style.id = 'gear-calc-style';
      style.textContent = `
        .gear-calc-wrap{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial}
        .slot-list{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}
        .slot-item{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #ddd;border-radius:10px;background:#f5f5f7;cursor:pointer}
        .slot-item input{margin:0}
        .slot-item .pill{font-size:11px;line-height:1;padding:3px 8px;border-radius:999px;border:1px solid rgba(0,0,0,.08);background:#fff;color:#222}
        .pill-cav{box-shadow:inset 0 0 0 999px rgba(59,130,246,.12)}  /* 기병 */
        .pill-inf{box-shadow:inset 0 0 0 999px rgba(16,185,129,.14)}  /* 보병 */
        .pill-arc{box-shadow:inset 0 0 0 999px rgba(245,158,11,.16)}  /* 궁병 */

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

    // UI
    root.innerHTML = '';
    root.classList.add('gear-calc-wrap');

    const card = h('div', { class: 'gear-card' });

    // 슬롯 멀티선택(체크박스)
    const slotList = h('div', { class: 'slot-list', role: 'group', 'aria-label': '장비 슬롯 선택' });
    const classToPill = (cls) =>
      cls === '기병' ? 'pill pill-cav' : cls === '보병' ? 'pill pill-inf' : 'pill pill-arc';
    slots.forEach(name => {
      const id = 'slot-' + slug(name);
      const cls = slotClasses[name] || '';
      const pill = h('span', { class: classToPill(cls), text: cls });
      const input = h('input', { type: 'checkbox', id, name: 'slot', value: name });
      const label = h('label', { class: 'slot-item', for: id }, [input, h('span', { text: name }), pill]);
      slotList.appendChild(label);
    });

    // 컨트롤 (공통 단계 from/to) + 계산 버튼
    const fromSel = h('select', { 'aria-label': '현재 단계 선택' });
    const toSel   = h('select', { 'aria-label': '목표 단계 선택' });
    const runBtn  = h('button', { text: '계산하기', 'aria-label': '계산하기' });

    // KPI
    const kpiSat   = h('div', { class: 'gear-kpi' }, [h('div', { class: 'num', id: 'gc-sat', text: '0' }), h('div', { text: '비단' })]);
    const kpiThr   = h('div', { class: 'gear-kpi' }, [h('div', { class: 'num', id: 'gc-thr', text: '0' }), h('div', { text: '금사' })]);
    const kpiSk    = h('div', { class: 'gear-kpi' }, [h('div', { class: 'num', id: 'gc-sk',  text: '0' }), h('div', { text: '설계 스케치' })]);
    const kpiScore = h('div', { class: 'gear-kpi' }, [h('div', { class: 'num', id: 'gc-score', text: '0' }), h('div', { text: '장비평점' })]);

    const grid = h('div', { class: 'gear-grid' }, [kpiSat, kpiThr, kpiSk, kpiScore]);

    const row = h('div', { class: 'gear-row' }, [
      h('label', { text: '현재 단계' }), fromSel,
      h('label', { text: '→ 목표 단계' }), toSel,
      runBtn
    ]);

    const hint = h('div', { class: 'gear-muted', text: '※ 선택한 여러 슬롯을 한 번에 합산합니다. 부위별 비용이 다르면 stepsMap으로 각 부위 steps를 주입하세요.' });

    // 상세 테이블(슬롯별 합계 + 총합)
    const detailWrap = h('div', { class: 'gear-details', style: 'display:none' });
    const detailTable = h('table', {}, [
      h('thead', {}, h('tr', {}, [
        h('th', { text: '슬롯' }),
        h('th', { text: '병종' }),
        h('th', { text: '비단' }),
        h('th', { text: '금사' }),
        h('th', { text: '스케치' }),
        h('th', { text: '평점' })
      ])),
      h('tbody', { id: 'gc-tbody' })
    ]);
    detailWrap.appendChild(detailTable);

    const actions = h('div', { class: 'gear-actions' });
    const toggleDetailBtn = h('button', { text: '상세 보기', disabled: 'disabled', title: '계산 후 활성화' });
    actions.appendChild(toggleDetailBtn);

    // 조립
    card.appendChild(slotList);
    card.appendChild(row);
    card.appendChild(grid);
    card.appendChild(hint);
    card.appendChild(actions);
    card.appendChild(detailWrap);
    root.appendChild(card);

    // 셀렉트 채우기 (공통 단계 목록은 기본 steps 기준)
    function populateSelects() {
      const keys = stepKeys(gear.steps);
      fromSel.innerHTML = '';
      toSel.innerHTML = '';
      keys.forEach((label, idx) => {
        fromSel.appendChild(h('option', { value: String(idx), text: label }));
        toSel.appendChild(h('option',   { value: String(idx), text: label }));
      });
      fromSel.value = '0';
      toSel.value   = String(keys.length - 1);
    }
    populateSelects();

    // 엔터키로도 계산
    [fromSel, toSel].forEach(sel => {
      sel.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') runBtn.click();
      });
    });

    // 상세 토글
    toggleDetailBtn.addEventListener('click', () => {
      const open = detailWrap.style.display !== 'none';
      detailWrap.style.display = open ? 'none' : '';
      toggleDetailBtn.textContent = open ? '상세 보기' : '상세 숨기기';
    });

    // 출력 리셋
    function resetOutputs() {
      document.getElementById('gc-sat').textContent   = '0';
      document.getElementById('gc-thr').textContent   = '0';
      document.getElementById('gc-sk').textContent    = '0';
      document.getElementById('gc-score').textContent = '0';
      detailWrap.style.display = 'none';
      document.getElementById('gc-tbody').innerHTML = '';
      toggleDetailBtn.disabled = true;
      toggleDetailBtn.textContent = '상세 보기';
    }

    // 계산
    runBtn.addEventListener('click', () => {
      const checked = [...root.querySelectorAll('input[name="slot"]:checked')].map(i => i.value);
      if (!checked.length) {
        alert('최소 1개 이상의 슬롯을 선택하세요.');
        return;
      }

      const fromIdx = parseInt(fromSel.value, 10);
      const toIdx   = parseInt(toSel.value, 10);
      if (fromIdx >= toIdx) {
        alert('현재 단계는 목표 단계보다 낮아야 합니다.');
        return;
      }

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
        const clsShort = cls; // 그대로 표기(기병/보병/궁병)
        tbody.appendChild(h('tr', {}, [
          h('td', { text: slotName }),
          h('td', { text: clsShort }),
          h('td', { text: fmt(r.satin) }),
          h('td', { text: fmt(r.thread) }),
          h('td', { text: fmt(r.sketch) }),
          h('td', { text: fmt(r.score) })
        ]));
      });

      // 총합 행
      const trTotal = h('tr', { class: 'gc-total-row' }, [
        h('td', { text: '합계' }),
        h('td', { text: `선택 ${checked.length}개` }),
        h('td', { text: fmt(total.satin) }),
        h('td', { text: fmt(total.thread) }),
        h('td', { text: fmt(total.sketch) }),
        h('td', { text: fmt(total.score) })
      ]);
      tbody.appendChild(trTotal);

      // KPI 출력
      document.getElementById('gc-sat').textContent   = fmt(total.satin);
      document.getElementById('gc-thr').textContent   = fmt(total.thread);
      document.getElementById('gc-sk').textContent    = fmt(total.sketch);
      document.getElementById('gc-score').textContent = fmt(total.score);

      toggleDetailBtn.disabled = false;
      detailWrap.style.display = '';  // 자동 펼침
      toggleDetailBtn.textContent = '상세 숨기기';
    });

    // 외부에서 재초기화 시 쓰라고 노출(선택)
    window.__gearCalcReset = resetOutputs;
  }

  window.initGearCalculator = initGearCalculator;
})();

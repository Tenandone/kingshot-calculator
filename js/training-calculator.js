// /js/training-calculator.js (v20250830-i18n, dynamic tiers from DATA)
window.initTrainingCalculator = function initTrainingCalculator(opts){
  const mountSel = opts?.mount || '#training-calc';
  const jsonUrl  = opts?.jsonUrl;
  const root = document.querySelector(mountSel);
  if (!root) return console.warn('[kscalc] mount not found:', mountSel);
  if (!jsonUrl) return console.warn('[kscalc] jsonUrl is required');
  if (root.dataset.kscalcBound === '1') return; // 중복 init 방지

  // i18n helper
  const T = (k) => (window.I18N?.t?.(k) ?? k);

  let DATA = null;

  // ---------- utils ----------
  const q  = (sel) => root.querySelector(sel);
  const qa = (sel) => root.querySelectorAll(sel);
  const fmt   = (n, d=0) => (n==null || isNaN(n)) ? "-" : Number(n).toLocaleString(undefined, { maximumFractionDigits:d, minimumFractionDigits:d });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const secToDHMS = (sec) => {
    if (sec==null || isNaN(sec)) return "-";
    sec = Math.round(sec);
    const d = Math.floor(sec/86400); sec%=86400;
    const h = Math.floor(sec/3600);  sec%=3600;
    const m = Math.floor(sec/60);
    const s = sec%60;
    const parts=[];
    if (d) parts.push(d + T('trainCalc.units.day'));
    if (h) parts.push(h + T('trainCalc.units.hour'));
    if (m) parts.push(m + T('trainCalc.units.min'));
    if (s || !parts.length) parts.push(s + T('trainCalc.units.sec'));
    return parts.join(' ');
  };

  // ---------- DOM refs ----------
  const modeSel    = q('#mode');
  const fromSel    = q('#fromTier');
  const toSel      = q('#toTier');
  const fromWrap   = q('#fromTierWrap');
  const trainSpeed = q('#trainSpeed');
  const speedDays  = q('#speedDays');
  const countEl    = q('#count');
  const calcBtn    = q('#calcBtn');
  const pillTime   = q('#modeTime');
  const pillTroops = q('#modeTroops');
  const inTime     = qa('.input-time');
  const inTroops   = qa('.input-troops');

  const selText = q('#selText');
  const warnEl  = q('#warn');
  const resultEl= q('#result');
  const tbody   = q('#tbody');

  // ---------- helpers ----------
  function fillSelect(el, arr){
    el.innerHTML = "";
    for (const v of arr){
      const opt = document.createElement('option');
      opt.value = v;
      const tpl = T('trainCalc.level'); // e.g., "Lv {n}"
      opt.textContent = (typeof tpl === 'string' && tpl.includes('{n}')) ? tpl.replace('{n}', v) : `Level ${v}`;
      el.appendChild(opt);
    }
  }

  // DATA에서 실제 사용 가능한 from/to 티어 수집
  function getAvailableTiers(mode){
    const recs = Array.isArray(DATA) ? DATA.filter(r => String(r.mode) === String(mode)) : [];
    const froms = new Set();
    const tos   = new Set();
    for (const r of recs){
      if (r.fromTier !== undefined && r.fromTier !== null && r.fromTier !== "")
        froms.add(Number(r.fromTier));
      if (r.toTier !== undefined && r.toTier !== null && r.toTier !== "")
        tos.add(Number(r.toTier));
    }
    return {
      from: [...froms].sort((a,b)=>a-b),
      to:   [...tos].sort((a,b)=>a-b)
    };
  }

  function refreshTierInputs(){
    const mode = modeSel.value;

    // 현재 선택값 보존 시도
    const prevFrom = fromSel?.value;
    const prevTo   = toSel?.value;

    if (mode === 'training'){
      fromWrap.style.display = 'none';
      const avail = getAvailableTiers('training');
      const toList = (avail.to.length ? avail.to : [1,2,3,4,5,6,7,8,9,10]);
      fillSelect(toSel, toList);

    } else {
      fromWrap.style.display = '';
      const avail = getAvailableTiers('promotion');
      const fromList = (avail.from.length ? avail.from : [1,2,3,4,5,6,7,8,9]);
      const toList   = (avail.to.length   ? avail.to   : [10]); // ← JSON에 9가 있으면 9가 자동으로 뜸
      fillSelect(fromSel, fromList);
      fillSelect(toSel, toList);
    }

    // 가능하면 이전 선택 복구
    if (prevFrom && fromSel && [...fromSel.options].some(o=>o.value===prevFrom)) fromSel.value = prevFrom;
    if (prevTo   && toSel   && [...toSel.options].some(o=>o.value===prevTo))     toSel.value   = prevTo;
  }

  function setInputMode(which){
    const toTime = (which === 'time');
    pillTime.classList.toggle('active', toTime);
    pillTroops.classList.toggle('active', !toTime);
    inTime.forEach(el=> el.style.display   = toTime ? '' : 'none');
    inTroops.forEach(el=> el.style.display = toTime ? 'none' : '');
    queueMicrotask(calc);
  }

  function findRecord(mode, fromTier, toTier){
    return DATA.find(r =>
      String(r.mode) === String(mode) &&
      String(r.fromTier ?? "") === String(fromTier ?? "") &&
      String(r.toTier) === String(toTier)
    );
  }

  function perTroopPower(rec){
    if (!rec) return null;
    if (rec.power_per_troop != null) return rec.power_per_troop;
    if (rec.power_increase != null && rec.amount) return rec.power_increase / rec.amount;
    return null;
  }
  function perTroopPoints(total, amount){
    if (total==null || !amount) return null;
    return total/amount;
  }
  function addRow(nameKey, per1, total){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${T(nameKey)}</td><td class="num">${per1}</td><td class="num">${total}</td>`;
    tbody.appendChild(tr);
  }

  // ---------- core calc ----------
  function calc(){
    if (!DATA) return;
    if (!modeSel || !toSel) return;
    const inputMode = pillTroops.classList.contains('active') ? 'troops' : 'time';

    const mode = modeSel.value;
    const fromTier = mode==='training' ? "" : Number(fromSel.value);
    const toTier   = Number(toSel.value);
    const speedPct = clamp(Number(trainSpeed.value||0), 0, 1000);

    selText.textContent = `mode=${mode}, from=${fromTier||'-'}, to=${toTier}, speed=${speedPct}%`;

    const rec = findRecord(mode, fromTier, toTier);
    if (!rec || rec.time_sec_per_troop==null){
      warnEl.style.display = '';
      resultEl.style.display = 'none';
      return;
    }
    warnEl.style.display = 'none';
    resultEl.style.display = '';
    tbody.innerHTML = "";

    const baseT = Number(rec.time_sec_per_troop); // 0% 기준
    const mult  = 1 + (speedPct/100);
    const t1    = baseT / mult;                   // 속도 적용 1명당 초

    const hog1 = rec.hog_points_per_troop ?? perTroopPoints(rec.hog_points_total, rec.amount);
    const kvk1 = rec.kvk_points_per_troop ?? perTroopPoints(rec.kvk_points_total, rec.amount);
    const gov1 = rec.governor_points_per_troop ?? perTroopPoints(rec.governor_points_total, rec.amount);
    const pow1 = perTroopPower(rec);

    if (inputMode === 'time'){
      const days = Math.max(0, Number(speedDays.value||0));
      const totalSec = days * 86400;
      const n = Math.floor(totalSec / t1);
      const tN = t1 * n;

      addRow('trainCalc.rows.possibleTroops', '-', fmt(n,0));
      addRow('trainCalc.rows.hogPoints',       fmt(hog1, 2), fmt(hog1==null? null : hog1*n, 0));
      addRow('trainCalc.rows.kvkPoints',       fmt(kvk1, 2), fmt(kvk1==null? null : kvk1*n, 0));
      addRow('trainCalc.rows.govPoints',       fmt(gov1, 2), fmt(gov1==null? null : gov1*n, 0));
      addRow('trainCalc.rows.powerInc',        fmt(pow1, 2), fmt(pow1==null? null : pow1*n, 0));
      addRow('trainCalc.rows.timePerOneApplied', secToDHMS(t1), secToDHMS(tN));

    } else {
      const n = Math.max(1, Number(countEl.value||1));
      const tN = t1 * n;

      addRow('trainCalc.rows.inputTroops',     '-', fmt(n,0));
      addRow('trainCalc.rows.hogPoints',       fmt(hog1, 2), fmt(hog1==null? null : hog1*n, 0));
      addRow('trainCalc.rows.kvkPoints',       fmt(kvk1, 2), fmt(kvk1==null? null : kvk1*n, 0));
      addRow('trainCalc.rows.govPoints',       fmt(gov1, 2), fmt(gov1==null? null : gov1*n, 0));
      addRow('trainCalc.rows.powerInc',        fmt(pow1, 2), fmt(pow1==null? null : pow1*n, 0));
      addRow('trainCalc.rows.timePerOneApplied', secToDHMS(t1), secToDHMS(tN));
      addRow('trainCalc.rows.needAccelTime',   '-', secToDHMS(tN));
    }
  }

  // ---------- wire events ----------
  function bind(){
    modeSel?.addEventListener('change', () => { refreshTierInputs(); calc(); });
    pillTime?.addEventListener('click', ()=> setInputMode('time'));
    pillTroops?.addEventListener('click', ()=> setInputMode('troops'));

    ['fromTier','toTier','trainSpeed','speedDays','count'].forEach(id=>{
      const el = q('#'+id);
      if (!el) return;
      el.addEventListener('change', calc);
      el.addEventListener('keyup', (e)=>{ if(e.key==='Enter') calc(); });
    });

    calcBtn?.addEventListener('click', calc);

    // 언어 전환 시 옵션 라벨 갱신
    document.addEventListener('i18n:changed', () => { refreshTierInputs(); calc(); }, { once:false });

    refreshTierInputs();     // 초기(데이터 로드 전) 기본 리스트 세팅
    setInputMode('time');
    calc();
    root.dataset.kscalcBound = '1'; // init 완료 표시
  }

  // ---------- boot ----------
  fetch(jsonUrl)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} url=${res.url}`);
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error('JSON 최상위 구조가 배열이 아님');
      return json;
    })
    .then(json => {
      DATA = json;
      bind();
      // DATA가 로드된 뒤 한 번 더 옵션을 실제 값으로 동기화
      refreshTierInputs();
      calc();
    })
    .catch(err => {
      console.error(err);
      if (warnEl){
        warnEl.textContent = 'JSON 로드 실패: ' + err;
        warnEl.style.display = '';
      }
    });
};

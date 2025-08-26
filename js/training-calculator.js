// /js/training-calculator.js
window.initTrainingCalculator = function initTrainingCalculator(opts){
  const mountSel = opts?.mount || '#training-calc';
  const jsonUrl  = opts?.jsonUrl;
  const root = document.querySelector(mountSel);
  if (!root) return console.warn('[kscalc] mount not found:', mountSel);
  if (!jsonUrl) return console.warn('[kscalc] jsonUrl is required');
  if (root.dataset.kscalcBound === '1') return; // 중복 init 방지

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
    const parts=[]; if(d)parts.push(d+'일'); if(h)parts.push(h+'시간'); if(m)parts.push(m+'분'); if(s||!parts.length)parts.push(s+'초');
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
      opt.textContent = "Level " + v;
      el.appendChild(opt);
    }
  }
  function refreshTierInputs(){
    const mode = modeSel.value;
    if (mode === 'training'){
      fromWrap.style.display = 'none';
      fillSelect(toSel, [1,2,3,4,5,6,7,8,9,10]);
    } else {
      fromWrap.style.display = '';
      fillSelect(fromSel, [1,2,3,4,5,6,7,8,9]);
      fillSelect(toSel, [10]);
    }
  }
  function setInputMode(which){
    const toTime = (which === 'time');
    pillTime.classList.toggle('active', toTime);
    pillTroops.classList.toggle('active', !toTime);
    inTime.forEach(el=> el.style.display   = toTime ? '' : 'none');
    inTroops.forEach(el=> el.style.display = toTime ? 'none' : '');
    queueMicrotask(calc); // 토글 후 계산 타이밍 안정화
  }
  function findRecord(mode, fromTier, toTier){
    return DATA.find(r =>
      r.mode === mode &&
      String(r.fromTier||"") === String(fromTier||"") &&
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
  function addRow(name, per1, total){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${name}</td><td class="num">${per1}</td><td class="num">${total}</td>`;
    tbody.appendChild(tr);
  }

  // ---------- core calc ----------
  function calc(){
    if (!DATA) return;
    if (!modeSel || !toSel) return; // DOM 안전장치
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
      const remain = totalSec - tN;

      addRow('가능 병력 수 (가속일수 기준)', '-', fmt(n,0));
      addRow('최강영주 점수', fmt(hog1, 2), fmt(hog1==null? null : hog1*n, 0));
      addRow('최강왕국(준비전) 점수', fmt(kvk1, 2), fmt(kvk1==null? null : kvk1*n, 0));
      addRow('지고의영주 점수', fmt(gov1, 2), fmt(gov1==null? null : gov1*n, 0));
      addRow('전투력 증가', fmt(pow1, 2), fmt(pow1==null? null : pow1*n, 0));
      addRow('1명당 소요 시간 (속도 적용)', secToDHMS(t1), secToDHMS(tN));
      
    } else {
      const n = Math.max(1, Number(countEl.value||1));
      const tN = t1 * n;
      const daysNeed = tN / 86400;

      addRow('입력 병력 수', '-', fmt(n,0));
      addRow('최강영주 점수', fmt(hog1, 2), fmt(hog1==null? null : hog1*n, 0));
      addRow('최강왕국(준비전) 점수', fmt(kvk1, 2), fmt(kvk1==null? null : kvk1*n, 0));
      addRow('지고의영주 점수', fmt(gov1, 2), fmt(gov1==null? null : gov1*n, 0));
      addRow('전투력 증가', fmt(pow1, 2), fmt(pow1==null? null : pow1*n, 0));
      addRow('1명당 소요 시간 (속도 적용)', secToDHMS(t1), secToDHMS(tN));
      addRow('필요 가속 시간', '-', secToDHMS(tN));
      
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
    refreshTierInputs();
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
    .then(json => { DATA = json; bind(); })
    .catch(err => {
      console.error(err);
      if (warnEl){
        warnEl.textContent = 'JSON 로드 실패: ' + err;
        warnEl.style.display = '';
      }
    });
};

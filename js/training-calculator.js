// /js/training-calculator.js
// v2026-03-19-clean-ui-days-only-final-fixed2

window.initTrainingCalculator = function initTrainingCalculator(opts) {
  'use strict';

  var mountSel = (opts && opts.mount) || '#training-calc';
  var jsonUrl = opts && opts.jsonUrl;
  var root = document.querySelector(mountSel);

  if (!root) return console.warn('[kscalc] mount not found:', mountSel);
  if (!jsonUrl) return console.warn('[kscalc] jsonUrl is required');
  if (root.dataset.kscalcBound === '1') return;

  function T(k, fb) {
    try {
      if (window.I18N && typeof window.I18N.t === 'function') {
        return window.I18N.t(k, fb != null ? fb : k);
      }
    } catch (_) {}
    return fb != null ? fb : k;
  }

  var DATA = null;

  function q(sel) { return root.querySelector(sel); }
  function fmt(n) {
    if (n == null || isNaN(n)) return '-';
    return Math.round(Number(n)).toLocaleString('ko-KR');
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function toNum(v, fallback) {
    var n = Number(v);
    return isNaN(n) ? (fallback != null ? fallback : 0) : n;
  }

  function secToDHMS(sec) {
    if (sec == null || isNaN(sec)) return '-';

    sec = Math.max(0, Math.round(sec));

    var d = Math.floor(sec / 86400);
    sec %= 86400;
    var h = Math.floor(sec / 3600);
    sec %= 3600;
    var m = Math.floor(sec / 60);
    var s = sec % 60;

    var parts = [];
    if (d) parts.push(d + T('trainCalc.units.day', '일'));
    if (h) parts.push(h + T('trainCalc.units.hour', '시간'));
    if (m) parts.push(m + T('trainCalc.units.min', '분'));
    if (s || !parts.length) parts.push(s + T('trainCalc.units.sec', '초'));
    return parts.join(' ');
  }

  function safeText(el, text) {
    if (el) el.textContent = text;
  }

  function escHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getArrayData(json) {
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json.rows)) return json.rows;
    if (json && Array.isArray(json.data)) return json.data;
    if (json && Array.isArray(json.items)) return json.items;
    return null;
  }

  function normalizeTierValue(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'string') {
      if (/^T\d+$/i.test(v)) return Number(String(v).replace(/[^\d]/g, ''));
      if (/^\d+$/.test(v)) return Number(v);
      return v;
    }
    return Number(v);
  }

  function fillSelect(el, arr) {
    if (!el) return;
    el.innerHTML = '';

    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      var opt = document.createElement('option');
      opt.value = String(v);

      var tierTpl = T('trainCalc.tier', 'T{n}');
      opt.textContent = (typeof tierTpl === 'string' && tierTpl.indexOf('{n}') > -1)
        ? tierTpl.replace('{n}', String(v))
        : ('T' + v);

      el.appendChild(opt);
    }
  }

  function hasOption(el, value) {
    if (!el) return false;
    var opts = el.options;
    for (var i = 0; i < opts.length; i++) {
      if (String(opts[i].value) === String(value)) return true;
    }
    return false;
  }

  function getAvailableTiers(mode) {
    var recs = Array.isArray(DATA) ? DATA.filter(function (r) {
      return String(r.mode) === String(mode);
    }) : [];

    var fromMap = {};
    var toMap = {};
    var fromArr = [];
    var toArr = [];

    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      var from = normalizeTierValue(r.fromTier);
      var to = normalizeTierValue(r.toTier);

      if (from !== '' && from != null && !isNaN(from) && !fromMap[from]) {
        fromMap[from] = true;
        fromArr.push(from);
      }
      if (to !== '' && to != null && !isNaN(to) && !toMap[to]) {
        toMap[to] = true;
        toArr.push(to);
      }
    }

    fromArr.sort(function (a, b) { return a - b; });
    toArr.sort(function (a, b) { return a - b; });

    return { from: fromArr, to: toArr };
  }

  function getPromotionTargets(fromTier) {
    var map = {};
    var arr = [];

    if (!Array.isArray(DATA)) return arr;

    for (var i = 0; i < DATA.length; i++) {
      var r = DATA[i];
      if (String(r.mode) !== 'promotion') continue;
      if (String(normalizeTierValue(r.fromTier)) !== String(normalizeTierValue(fromTier))) continue;

      var to = normalizeTierValue(r.toTier);
      if (to !== '' && to != null && !isNaN(to) && !map[to]) {
        map[to] = true;
        arr.push(to);
      }
    }

    arr.sort(function (a, b) { return a - b; });
    return arr;
  }

  function findRecord(mode, fromTier, toTier) {
    if (!Array.isArray(DATA)) return null;

    var normFrom = normalizeTierValue(fromTier);
    var normTo = normalizeTierValue(toTier);

    for (var i = 0; i < DATA.length; i++) {
      var r = DATA[i];
      if (String(r.mode) !== String(mode)) continue;

      var rFrom = normalizeTierValue(r.fromTier);
      var rTo = normalizeTierValue(r.toTier);

      if (mode === 'training') {
        if (rTo === normTo) return r;
      } else {
        if (rFrom === normFrom && rTo === normTo) return r;
      }
    }

    return null;
  }

  function perTroopPoints(total, amount) {
    if (total == null || !amount) return null;
    return Number(total) / Number(amount);
  }

  function perTroopPower(rec) {
    if (!rec) return null;
    if (rec.power_per_troop != null) return Number(rec.power_per_troop);
    if (rec.power_increase != null && rec.amount) return Number(rec.power_increase) / Number(rec.amount);
    return null;
  }

  function getMetricIcons() {
    return {
      troops: '/img/troops/t11.webp',
      hog: '/img/train/strongest.webp',
      prep: '/img/train/kingdom.webp',
      kvk: '/img/train/hall.webp',
      time: '/img/train/trainspeed.webp'
    };
  }

  function addRow(label, total, icon) {
    if (!tbody) return;
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><div class="kscalc-row-label">' +
        (icon ? '<img src="' + escHtml(icon) + '" alt="" class="kscalc-row-icon">' : '') +
        '<span>' + escHtml(label) + '</span>' +
      '</div></td>' +
      '<td class="num">' + escHtml(total) + '</td>';
    tbody.appendChild(tr);
  }

  function setWarn(msg) {
    if (!warnEl) return;
    warnEl.textContent = msg || '';
    warnEl.style.display = msg ? '' : 'none';
  }

  function setResultVisible(show) {
    if (!resultEl) return;
    resultEl.style.display = show ? '' : 'none';
  }

  function getRecordImage(rec, mode, toTier) {
    if (rec && rec.image) return rec.image;
    if (rec && rec.icon) return rec.icon;
    if (rec && rec.img) return rec.img;
    if (rec && rec.thumbnail) return rec.thumbnail;
    if (rec && rec.thumb) return rec.thumb;

    var tier = normalizeTierValue(toTier);
    if (mode === 'training' || mode === 'promotion') {
      return '/img/troops/t' + tier + '.webp';
    }
    return '/img/troops/t11.webp';
  }

  function injectStylesOnce() {
    if (document.getElementById('kscalc-style-final-v3')) return;

    var style = document.createElement('style');
    style.id = 'kscalc-style-final-v3';
    style.textContent = [
      '#training-calc{max-width:1180px;width:100%;margin:0 auto;}',
      '#training-calc .grid{display:grid !important;grid-template-columns:repeat(4,minmax(0,1fr)) !important;gap:12px !important;max-width:none !important;}',
      '#training-calc .col-3,#training-calc .col-12{min-width:0;}',
      '#training-calc select,#training-calc input,#training-calc button{width:100%;max-width:none;}',
      '#training-calc .input-troops{display:none !important;}',
      '#training-calc #modeTroops{display:none !important;}',
      '#training-calc #modeTime{display:none !important;}',
      '#training-calc .toggle{display:none !important;}',
      '#training-calc #calcBtn{display:block;width:100%;margin-top:0 !important;}',
      '#training-calc label{display:block;margin:0 0 6px;font-weight:700;color:#374151;}',
      '#training-calc .input-time{display:block !important;margin-top:0 !important;}',
      '#training-calc #fromTierWrap[style*="display: none"]{display:none !important;}',
      '#training-calc .row{grid-column:1 / -1;}',

      '.kscalc-summary-head{display:flex;align-items:center;gap:14px;padding:16px 18px;margin:0 0 14px;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;box-shadow:0 4px 14px rgba(0,0,0,.04);}',
      '.kscalc-summary-head .thumb{width:56px;height:56px;flex:0 0 56px;border-radius:12px;overflow:hidden;background:#f3f4f6;display:flex;align-items:center;justify-content:center;}',
      '.kscalc-summary-head .thumb img{width:100%;height:100%;object-fit:cover;display:block;}',
      '.kscalc-summary-head .meta{min-width:0;flex:1;}',
      '.kscalc-summary-head .title{font-size:18px;font-weight:800;color:#111827;margin:0;line-height:1.35;}',
      '.kscalc-summary-head .eyebrow,.kscalc-summary-head .desc{display:none !important;}',

      '.kscalc-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:0 0 16px;}',
      '.kscalc-card{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:14px;box-shadow:0 4px 14px rgba(0,0,0,.04);min-width:0;}',
      '.kscalc-card-top{display:flex;align-items:center;gap:8px;margin-bottom:8px;}',
      '.kscalc-card-icon{width:18px;height:18px;object-fit:contain;flex:0 0 18px;}',
      '.kscalc-card-label{font-size:12px;line-height:1.35;color:#6b7280;}',
      '.kscalc-card-value{font-size:18px;line-height:1.25;font-weight:800;color:#111827;word-break:break-word;}',
      '.kscalc-card-sub{font-size:12px;line-height:1.4;color:#9ca3af;margin-top:6px;}',

      '.kscalc-table-wrap{margin-top:14px;overflow-x:auto;-webkit-overflow-scrolling:touch;}',
      '.kscalc-result-table{width:100%;min-width:720px;table-layout:fixed;border-collapse:collapse;}',
      '.kscalc-result-table th,.kscalc-result-table td{padding:14px 12px;border-bottom:1px solid rgba(0,0,0,.08);vertical-align:middle;}',
      '.kscalc-result-table th:first-child,.kscalc-result-table td:first-child{width:68%;}',
      '.kscalc-result-table th.num,.kscalc-result-table td.num{text-align:right;}',
      '.kscalc-row-label{display:flex;align-items:center;gap:8px;}',
      '.kscalc-row-icon{width:18px;height:18px;object-fit:contain;flex:0 0 18px;}',

      '@media (max-width:1100px){.kscalc-cards{grid-template-columns:repeat(3,minmax(0,1fr));}}',
      '@media (max-width:860px){',
      '  #training-calc .grid{grid-template-columns:1fr 1fr !important;}',
      '  .kscalc-cards{grid-template-columns:repeat(2,minmax(0,1fr));}',
      '}',
      '@media (max-width:640px){',
      '  #training-calc .grid{grid-template-columns:1fr !important;}',
      '  .kscalc-cards{grid-template-columns:1fr;}',
      '  .kscalc-summary-head{align-items:flex-start;}',
      '}'
    ].join('');
    document.head.appendChild(style);
  }

  function normalizeResultTable() {
    var table = tbody && tbody.closest('table') ? tbody.closest('table') : null;
    if (!table) return;

    var thead = table.querySelector('thead');
    if (thead) {
      var tr = thead.querySelector('tr');
      if (tr) {
        tr.innerHTML =
          '<th>' + escHtml(T('trainCalc.table.metric', '지표')) + '</th>' +
          '<th class="num">' + escHtml(T('trainCalc.table.total', '총합')) + '</th>';
      }
    }

    if (!table.classList.contains('kscalc-result-table')) {
      table.classList.add('kscalc-result-table');
    }

    var tableWrap = table.parentNode;
    if (tableWrap && tableWrap.classList && !tableWrap.classList.contains('kscalc-table-wrap')) {
      tableWrap.classList.add('kscalc-table-wrap');
    }
  }

  function ensureEnhancementLayout() {
    injectStylesOnce();
    normalizeResultTable();

    var result = q('#result');
    if (!result) return;

    var resultHead = q('#kscalc-summary-head');
    if (!resultHead) {
      resultHead = document.createElement('div');
      resultHead.id = 'kscalc-summary-head';
      resultHead.className = 'kscalc-summary-head';
      result.insertBefore(resultHead, result.firstChild);
    }

    var cardGrid = q('#kscalc-cards');
    if (!cardGrid) {
      cardGrid = document.createElement('div');
      cardGrid.id = 'kscalc-cards';
      cardGrid.className = 'kscalc-cards';
      result.insertBefore(cardGrid, resultHead.nextSibling);
    }
  }

  function renderSummaryHead(rec, mode, fromTier, toTier) {
    var head = q('#kscalc-summary-head');
    if (!head) return;

    var modeLabel = mode === 'training'
      ? T('trainCalc.mode.training', '훈련')
      : T('trainCalc.mode.promotion', '승급');

    var title = mode === 'training'
      ? 'T' + toTier
      : modeLabel + ' · T' + fromTier + ' → T' + toTier;

    var img = getRecordImage(rec, mode, toTier);

    head.innerHTML =
      '<div class="thumb"><img src="' + escHtml(img) + '" alt="' + escHtml(title) + '" loading="lazy" decoding="async"></div>' +
      '<div class="meta">' +
        '<h3 class="title">' + escHtml(title) + '</h3>' +
      '</div>';
  }

  function renderResultCards(items) {
    var wrap = q('#kscalc-cards');
    if (!wrap) return;

    var html = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      html +=
        '<div class="kscalc-card">' +
          '<div class="kscalc-card-top">' +
            (item.icon ? '<img src="' + escHtml(item.icon) + '" alt="" class="kscalc-card-icon">' : '') +
            '<div class="kscalc-card-label">' + escHtml(item.label) + '</div>' +
          '</div>' +
          '<div class="kscalc-card-value">' + escHtml(item.value) + '</div>' +
          (item.sub ? '<div class="kscalc-card-sub">' + escHtml(item.sub) + '</div>' : '') +
        '</div>';
    }
    wrap.innerHTML = html;
  }

  var modeSel = q('#mode');
  var fromSel = q('#fromTier');
  var toSel = q('#toTier');
  var fromWrap = q('#fromTierWrap');

  var trainSpeed = q('#trainSpeed');
  var speedDays = q('#speedDays');
  var calcBtn = q('#calcBtn');

  var pillTime = q('#modeTime');
  var pillTroops = q('#modeTroops');

  var selText = q('#selText');
  var warnEl = q('#warn');
  var resultEl = q('#result');
  var tbody = q('#tbody');

  function refreshTierInputs() {
    if (!modeSel || !toSel) return;

    var mode = modeSel.value;
    var prevFrom = fromSel ? fromSel.value : '';
    var prevTo = toSel.value;

    if (mode === 'training') {
      if (fromWrap) fromWrap.style.display = 'none';

      var availTrain = getAvailableTiers('training');
      var trainToList = availTrain.to.length ? availTrain.to : [1,2,3,4,5,6,7,8,9,10,11];
      fillSelect(toSel, trainToList);

      if (prevTo && hasOption(toSel, prevTo)) {
        toSel.value = prevTo;
      } else if (hasOption(toSel, '11')) {
        toSel.value = '11';
      } else if (toSel.options.length) {
        toSel.selectedIndex = toSel.options.length - 1;
      }
    } else {
      if (fromWrap) fromWrap.style.display = '';

      var availPromo = getAvailableTiers('promotion');
      var fromList = availPromo.from.length ? availPromo.from : [1,2,3,4,5,6,7,8,9,10];
      fillSelect(fromSel, fromList);

      if (prevFrom && hasOption(fromSel, prevFrom)) {
        fromSel.value = prevFrom;
      } else if (hasOption(fromSel, '10')) {
        fromSel.value = '10';
      } else if (fromSel.options.length) {
        fromSel.selectedIndex = fromSel.options.length - 1;
      }

      var targetList = getPromotionTargets(fromSel.value);
      if (!targetList.length) targetList = availPromo.to.length ? availPromo.to : [11];
      fillSelect(toSel, targetList);

      if (prevTo && hasOption(toSel, prevTo)) {
        toSel.value = prevTo;
      } else {
        var fromNum = normalizeTierValue(fromSel.value);
        var autoNext = String(fromNum + 1);

        if (hasOption(toSel, autoNext)) {
          toSel.value = autoNext;
        } else if (hasOption(toSel, '11')) {
          toSel.value = '11';
        } else if (toSel.options.length) {
          toSel.selectedIndex = 0;
        }
      }
    }
  }

  function calc() {
    if (!DATA || !modeSel || !toSel) return;

    ensureEnhancementLayout();

    var mode = modeSel.value;
    var fromTier = mode === 'training' ? '' : normalizeTierValue(fromSel ? fromSel.value : '');
    var toTier = normalizeTierValue(toSel.value);
    var speedPct = clamp(toNum(trainSpeed ? trainSpeed.value : 0, 0), 0, 1000);

    if (trainSpeed) trainSpeed.value = String(speedPct);

    safeText(selText, '');

    var rec = findRecord(mode, fromTier, toTier);

    if (!rec || rec.time_sec_per_troop == null) {
      setWarn(T('trainCalc.errors.noData', '선택한 조건의 데이터가 없습니다.'));
      setResultVisible(false);
      renderResultCards([]);
      return;
    }

    setWarn('');
    setResultVisible(true);

    if (tbody) tbody.innerHTML = '';

    var baseT = Number(rec.time_sec_per_troop);
    var mult = 1 + (speedPct / 100);
    var t1 = baseT / mult;

    var hog1 = rec.hog_points_per_troop != null
      ? Number(rec.hog_points_per_troop)
      : perTroopPoints(rec.hog_points_total, rec.amount);

    var prep1 = rec.governor_points_per_troop != null
      ? Number(rec.governor_points_per_troop)
      : perTroopPoints(rec.governor_points_total, rec.amount);

    var kvk1 = rec.kvk_points_per_troop != null
      ? Number(rec.kvk_points_per_troop)
      : perTroopPoints(rec.kvk_points_total, rec.amount);

    var pow1 = perTroopPower(rec);

    var days = Math.max(0, toNum(speedDays ? speedDays.value : 0, 0));
    var totalSec = days * 86400;
    var n = t1 > 0 ? Math.floor(totalSec / t1) : 0;
    var tN = t1 * n;

    var icons = getMetricIcons();

    renderSummaryHead(rec, mode, fromTier, toTier);

    renderResultCards([
      {
        label: '가능 병력 수',
        value: fmt(n),
        sub: '입력 가속 기준',
        icon: icons.troops
      },
      {
        label: '최강영주 점수',
        value: fmt(hog1 == null ? null : hog1 * n),
        sub: '',
        icon: icons.hog
      },
      {
        label: '지고의영주 점수',
        value: fmt(kvk1 == null ? null : kvk1 * n),
        sub: '',
        icon: icons.kvk
      },
      {
        label: '최강왕국(준비전) 점수',
        value: fmt(prep1 == null ? null : prep1 * n),
        sub: '',
        icon: icons.prep
      },
      {
        label: '총 소요 시간',
        value: secToDHMS(tN),
        sub: '',
        icon: icons.time
      }
    ]);

    addRow('가능 병력 수', fmt(n), icons.troops);
    addRow('최강영주 점수', fmt(hog1 == null ? null : hog1 * n), icons.hog);
    addRow('지고의영주 점수', fmt(kvk1 == null ? null : kvk1 * n), icons.kvk);
    addRow('최강왕국(준비전) 점수', fmt(prep1 == null ? null : prep1 * n), icons.prep);
    addRow('총 소요 시간', secToDHMS(tN), icons.time);
    addRow('전투력 증가', fmt(pow1 == null ? null : pow1 * n), null);
  }

  function bind() {
    if (modeSel) {
      modeSel.addEventListener('change', function () {
        refreshTierInputs();
        calc();
      });
    }

    if (fromSel) {
      fromSel.addEventListener('change', function () {
        refreshTierInputs();
        calc();
      });
    }

    if (toSel) toSel.addEventListener('change', calc);
    if (trainSpeed) trainSpeed.addEventListener('input', calc);
    if (speedDays) speedDays.addEventListener('input', calc);
    if (calcBtn) calcBtn.addEventListener('click', calc);

    if (pillTime) pillTime.style.display = 'none';
    if (pillTroops) pillTroops.style.display = 'none';

    document.addEventListener('i18n:changed', function () {
      refreshTierInputs();
      calc();
    }, false);

    refreshTierInputs();
    calc();

    root.dataset.kscalcBound = '1';
  }

  fetch(jsonUrl)
    .then(function (res) {
      if (!res.ok) {
        throw new Error('HTTP ' + res.status + ' ' + res.statusText + ' url=' + res.url);
      }
      return res.json();
    })
    .then(function (json) {
      var arr = getArrayData(json);
      if (!Array.isArray(arr)) {
        throw new Error('JSON 최상위 구조가 배열이 아니고 rows/data/items도 없습니다.');
      }

      DATA = arr;
      ensureEnhancementLayout();
      bind();
      calc();
    })
    .catch(function (err) {
      console.error(err);
      setWarn('JSON 로드 실패: ' + err.message);
      setResultVisible(false);
    });
};
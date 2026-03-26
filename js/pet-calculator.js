(function () {
  'use strict';

  // ===== i18n =====
  const T = (k, fb) => {
    try {
      if (window.I18N && typeof window.I18N.t === 'function') {
        return window.I18N.t(k, fb != null ? fb : k);
      }
    } catch (_) {}
    return fb != null ? fb : k;
  };

  // ===== format =====
  function fmt(n) {
    return (+n || 0).toLocaleString();
  }

  // ===== dom helper =====
  function h(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);

    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k === 'dataset' && v && typeof v === 'object') {
        Object.entries(v).forEach(([dk, dv]) => { el.dataset[dk] = dv; });
      } else if (k === 'checked') {
        if (v) el.checked = true;
      } else if (k === 'disabled') {
        if (v) el.disabled = true;
      } else if (k === 'value') {
        el.value = v;
      } else {
        el.setAttribute(k, v);
      }
    });

    (Array.isArray(children) ? children : [children]).forEach((ch) => {
      if (ch == null) return;
      el.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch);
    });

    return el;
  }

  // ===== icon =====
  const ICON_BASE = '/img/pet/';
  const ICON_VER = encodeURIComponent(window.__V || Date.now());

  function iconPath(filename) {
    return ICON_BASE + filename + '?v=' + ICON_VER;
  }

  const RESOURCE_META = {
    food: {
      key: 'food',
      labelKey: 'calcPet.result.food',
      fallback: '펫먹이',
      img: iconPath('food.png'),
      emoji: '🍖'
    },
    notebook: {
      key: 'notebook',
      labelKey: 'calcPet.result.notebook',
      fallback: '육성수첩',
      img: iconPath('manual.png'),
      emoji: '📘'
    },
    supplement: {
      key: 'supplement',
      labelKey: 'calcPet.result.supplement',
      fallback: '영양제',
      img: iconPath('potion.png'),
      emoji: '🧪'
    },
    medal: {
      key: 'medal',
      labelKey: 'calcPet.result.medal',
      fallback: '승급메달',
      img: iconPath('medal.png'),
      emoji: '🏅'
    }
  };

  const PET_ICON_FILE = {
    graywolf: 'graywolf.webp',
    cheetah: 'cheetah.webp',
    bison: 'bison.webp',
    lynx: 'lynx.webp',
    'grizzly-bear': 'grizzly-bear.webp',
    lion: 'lion.webp',
    moose: 'giantmoose.webp',
    'great-moose': 'great-moose.webp',
    'mighty-bison': 'mighty-bison.webp',
    'giant-rhino': 'giant-rhino.webp',
    'ironclad-war-elephant': 'ironclad-war-elephant.webp',
    'regal-white-lion': 'regal-white-lion.webp',
    'alpha-black-panther': 'alpha-black-panther.webp',
    unknown: 'unknown.webp'
  };

  const DEFAULT_PAW_IMG = '';

  const STATE = {
    root: null,
    data: null,
    els: {},
    last: null
  };

  function getResourceLabel(key) {
    const meta = RESOURCE_META[key];
    if (!meta) return key;
    return T(meta.labelKey, meta.fallback);
  }

  function getRarityLabel(rarity) {
    const r = String(rarity || '');
    if (r === 'common') return T('calcPet.rarity.common', 'Common');
    if (r === 'Uncommon') return T('calcPet.rarity.uncommon', 'Uncommon');
    if (r === 'R') return T('calcPet.rarity.r', 'Rare');
    if (r === 'SR') return T('calcPet.rarity.sr', 'Epic');
    if (r === 'SSR') return T('calcPet.rarity.ssr', 'SSR');
    return r || T('calcPet.rarity.common', 'Common');
  }

  function rarityClassOf(rarity) {
    const rarityKey = String(rarity || '').toLowerCase();
    if (rarityKey === 'common') return 'pc-rarity-common';
    if (rarityKey === 'uncommon') return 'pc-rarity-uncommon';
    if (rarityKey === 'r') return 'pc-rarity-r';
    if (rarityKey === 'sr') return 'pc-rarity-sr';
    if (rarityKey === 'ssr') return 'pc-rarity-ssr';
    return 'pc-rarity-common';
  }

  function petImagePath(id) {
    const file = PET_ICON_FILE[id] || '';
    return file ? iconPath(file) : '';
  }

  function makeImageBox(src, alt, fallbackText, boxClass, fallbackImg) {
    const wrap = h('div', { class: boxClass });

    function setFallback() {
      wrap.classList.add('is-fallback');
      wrap.innerHTML = '';
      if (fallbackImg) {
        const fb = h('img', {
          src: fallbackImg,
          alt: alt || '',
          loading: 'lazy',
          decoding: 'async'
        });
        wrap.appendChild(fb);
      } else {
        wrap.appendChild(h('span', { class: 'pc-fallback-emoji', text: fallbackText || '•' }));
      }
    }

    if (!src) {
      setFallback();
      return wrap;
    }

    const img = h('img', {
      src: src,
      alt: alt || '',
      loading: 'lazy',
      decoding: 'async'
    });

    img.addEventListener('error', function () {
      setFallback();
    });

    wrap.appendChild(img);
    return wrap;
  }

  function toNum(v) {
    return +v || 0;
  }

  function S_els(id) {
    return document.getElementById(id);
  }

  function getPetById(data, petId) {
    const pets = Array.isArray(data.pets) ? data.pets : [];
    return pets.find(function (item) {
      return String(item.id) === String(petId);
    }) || null;
  }

  function getLevelArrayByPet(data, petId) {
    const pet = getPetById(data, petId);
    if (!pet) return [];

    const rarity = pet.rarity;
    const map = data.levelsByRarity || {};
    const rows = Array.isArray(map[rarity]) ? map[rarity].slice() : [];

    rows.sort(function (a, b) {
      const al = toNum(a.level);
      const bl = toNum(b.level);
      if (al !== bl) return al - bl;

      const at = a.type === 'breakthrough' ? 1 : 0;
      const bt = b.type === 'breakthrough' ? 1 : 0;
      return at - bt;
    });

    return rows;
  }

  function getDisplayLabel(row) {
    if (!row) return '';
    if (row.label) return row.label;

    const level = toNum(row.level);
    if (row.type === 'breakthrough') {
      return T('calcPet.form.level.prefix', 'Lv.') + ' ' + level + ' ↑';
    }
    return T('calcPet.form.level.prefix', 'Lv.') + ' ' + level;
  }

  function getCurrentLangFolder() {
    try {
      const path = String(location.pathname || '').toLowerCase();
      if (path.startsWith('/ko/')) return 'ko';
      if (path.startsWith('/en/')) return 'en';
      if (path.startsWith('/ja/')) return 'ja';
      if (path.startsWith('/zh-tw/')) return 'zh-tw';
    } catch (_) {}

    try {
      const cur = String((window.I18N && (window.I18N.current || window.I18N.lang)) || '').toLowerCase();
      if (cur === 'ko') return 'ko';
      if (cur === 'ja') return 'ja';
      if (cur === 'zh-tw' || cur === 'zh-hant' || cur === 'tw') return 'zh-tw';
      if (cur === 'en') return 'en';
    } catch (_) {}

    try {
      const htmlLang = String(document.documentElement.getAttribute('lang') || '').toLowerCase();
      if (htmlLang.indexOf('ko') === 0) return 'ko';
      if (htmlLang.indexOf('ja') === 0) return 'ja';
      if (htmlLang === 'zh-tw' || htmlLang === 'zh-hant' || htmlLang === 'tw') return 'zh-tw';
      if (htmlLang.indexOf('en') === 0) return 'en';
    } catch (_) {}

    try {
      const saved = String(localStorage.getItem('lang') || '').toLowerCase();
      if (saved === 'ko') return 'ko';
      if (saved === 'ja') return 'ja';
      if (saved === 'zh-tw' || saved === 'zh-hant' || saved === 'tw') return 'zh-tw';
      if (saved === 'en') return 'en';
    } catch (_) {}

    return 'en';
  }

  function getPetDetailHref(petId) {
    if (!petId || petId === 'unknown') return '#';
    return '/' + getCurrentLangFolder() + '/pet/' + petId;
  }

  function updatePetActiveState() {
    const petSel = STATE.els.petSel;
    const petGrid = STATE.els.petGrid;
    if (!petSel || !petGrid) return;

    const current = String(petSel.value || '');
    const buttons = petGrid.querySelectorAll('.pc-pet-btn');
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      btn.classList.toggle('is-active', String(btn.dataset.petId || '') === current);
    }
  }

  function renderSelectedPet() {
    const pet = getPetById(STATE.data, STATE.els.petSel && STATE.els.petSel.value);
    const thumbWrap = S_els('pc-selected-pet-thumb');
    const nameEl = S_els('pc-selected-pet-name');
    const rarityEl = S_els('pc-selected-pet-rarity');

    if (!thumbWrap || !nameEl || !rarityEl) return;

    thumbWrap.innerHTML = '';

    if (!pet) {
      thumbWrap.appendChild(
        makeImageBox('', T('calcPet.form.pet.placeholderTitle', '펫 선택 대기'), '🐾', 'pc-selected-pet-thumb', DEFAULT_PAW_IMG)
      );
      nameEl.textContent = T('calcPet.form.pet.placeholderTitle', '펫 사진을 눌러주세요');
      rarityEl.textContent = T('calcPet.form.pet.placeholderSub', '원하는 펫을 선택하면 계산이 시작됩니다.');
      rarityEl.className = 'pc-selected-pet-rarity pc-rarity-common';
      return;
    }

    thumbWrap.appendChild(
      makeImageBox(
        petImagePath(pet.id),
        pet.name || '',
        '🐾',
        'pc-selected-pet-thumb',
        DEFAULT_PAW_IMG
      )
    );

    nameEl.textContent = pet.name || pet.id || '';
    rarityEl.textContent = getRarityLabel(pet.rarity);
    rarityEl.className = 'pc-selected-pet-rarity ' + rarityClassOf(pet.rarity);
  }

  function rebuildLevelOptions() {
    const fromSel = STATE.els.fromSel;
    const toSel = STATE.els.toSel;
    const petSel = STATE.els.petSel;
    if (!fromSel || !toSel || !petSel) return;

    const rows = getLevelArrayByPet(STATE.data, petSel.value);
    const prevFrom = fromSel.value;
    const prevTo = toSel.value;

    fromSel.innerHTML = '';
    toSel.innerHTML = '';

    rows.forEach(function (row, idx) {
      const label = getDisplayLabel(row);
      fromSel.appendChild(h('option', { value: String(idx), text: label }));
      toSel.appendChild(h('option', { value: String(idx), text: label }));
    });

    if (!rows.length) {
      fromSel.value = '';
      toSel.value = '';
      return;
    }

    const fromIdx = Math.min(parseInt(prevFrom || '0', 10) || 0, rows.length - 1);
    const toIdx = Math.min(parseInt(prevTo || String(rows.length - 1), 10) || 0, rows.length - 1);

    fromSel.value = String(fromIdx);
    toSel.value = String(Math.max(fromIdx, toIdx));
  }

  function buildDetailHeadHTML(metricKey) {
    return (
      '<span class="pc-detail-inline">' +
        '<span class="pc-detail-icon"><img src="' + RESOURCE_META[metricKey].img + '" alt="' + getResourceLabel(metricKey) + '"></span>' +
        '<span>' + getResourceLabel(metricKey) + '</span>' +
      '</span>'
    );
  }

  function renderHeader() {
    const headRow = S_els('pc-head-row');
    headRow.innerHTML = '';
    headRow.appendChild(h('th', { text: T('calcPet.detail.level', '레벨') }));
    ['food', 'notebook', 'supplement', 'medal'].forEach(function (key) {
      headRow.appendChild(h('th', { html: buildDetailHeadHTML(key) }));
    });
  }

  function renderDesktopRow(tbody, levelText, rowValues, isTotal) {
    const tr = h('tr', isTotal ? { class: 'pc-total-row' } : {});
    tr.appendChild(h('td', { text: levelText }));
    tr.appendChild(h('td', { text: fmt(rowValues.food) }));
    tr.appendChild(h('td', { text: fmt(rowValues.notebook) }));
    tr.appendChild(h('td', { text: fmt(rowValues.supplement) }));
    tr.appendChild(h('td', { text: fmt(rowValues.medal) }));
    tbody.appendChild(tr);
  }

  function renderMobileRow(container, levelText, rowValues, isTotal) {
    const row = h('div', { class: 'pc-mobile-row' + (isTotal ? ' pc-mobile-total' : '') }, [
      h('div', { class: 'pc-mobile-head' }, [
        h('div', { class: 'pc-mobile-level', text: levelText })
      ])
    ]);

    const grid = h('div', { class: 'pc-mobile-grid' });

    ['food', 'notebook', 'supplement', 'medal'].forEach(function (key) {
      grid.appendChild(h('div', { class: 'pc-mobile-metric' + (isTotal ? ' pc-mobile-total' : '') }, [
        h('div', { class: 'pc-mobile-metric-top' }, [
          h('div', { class: 'pc-mobile-metric-icon' }, [
            h('img', {
              src: RESOURCE_META[key].img,
              alt: getResourceLabel(key),
              loading: 'lazy',
              decoding: 'async'
            })
          ]),
          h('div', { class: 'pc-mobile-metric-label', text: getResourceLabel(key) })
        ]),
        h('div', {
          class: 'pc-mobile-metric-num',
          text: fmt(rowValues[key])
        })
      ]));
    });

    row.appendChild(grid);
    container.appendChild(row);
  }

  function updateLabels() {
    const petTitle = STATE.els.petTitle;
    const formTitle = STATE.els.formTitle;
    const fromLabel = STATE.els.fromLabel;
    const toLabel = STATE.els.toLabel;
    const needTitle = STATE.els.needTitle;
    const linksTitle = STATE.els.linksTitle;
    const detailTitle = STATE.els.detailTitle;
    const note = STATE.els.note;

    if (petTitle) petTitle.textContent = T('calcPet.form.pet.title', '펫 선택');
    if (formTitle) formTitle.textContent = T('calcPet.form.title', '레벨');
    if (fromLabel) fromLabel.textContent = T('calcPet.form.currentLevel.label', '현재 레벨');
    if (toLabel) toLabel.textContent = T('calcPet.form.targetLevel.label', '목표 레벨');
    if (needTitle) needTitle.textContent = T('calcPet.result.needTitle', '총 필요 재료');
    if (linksTitle) linksTitle.textContent = T('calcPet.related.title', '펫 페이지 바로가기');
    if (detailTitle) detailTitle.textContent = T('calcPet.detail.title', '레벨 구간 상세');
    if (note) note.textContent = T('calcPet.note', '현재 레벨 다음 단계부터 목표 레벨까지의 누적 재료를 계산합니다.');

    S_els('pc-lab-need-food').textContent = getResourceLabel('food');
    S_els('pc-lab-need-notebook').textContent = getResourceLabel('notebook');
    S_els('pc-lab-need-supplement').textContent = getResourceLabel('supplement');
    S_els('pc-lab-need-medal').textContent = getResourceLabel('medal');

    const petGrid = STATE.els.petGrid;
    if (petGrid) {
      const buttons = petGrid.querySelectorAll('.pc-pet-btn');
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        const petId = String(btn.dataset.petId || '');
        const pet = getPetById(STATE.data, petId);
        if (!pet) continue;
        btn.setAttribute('title', pet.name || pet.id || '');
        btn.setAttribute('aria-label', pet.name || pet.id || '');
      }
    }

    const linksStrip = S_els('pc-link-strip');
    if (linksStrip) {
      const links = linksStrip.querySelectorAll('.pc-link-pet');
      for (let j = 0; j < links.length; j++) {
        const link = links[j];
        const petId2 = String(link.dataset.petId || '');
        const pet2 = getPetById(STATE.data, petId2);
        if (!pet2) continue;
        link.setAttribute('title', pet2.name || pet2.id || '');
        link.setAttribute('aria-label', pet2.name || pet2.id || '');
        link.setAttribute('href', getPetDetailHref(petId2));
      }
    }

    renderSelectedPet();
  }

  function resetOutputs() {
    S_els('pc-need-food').textContent = '0';
    S_els('pc-need-notebook').textContent = '0';
    S_els('pc-need-supplement').textContent = '0';
    S_els('pc-need-medal').textContent = '0';

    S_els('pc-head-row').innerHTML = '';
    S_els('pc-tbody').innerHTML = '';
    STATE.els.mobileDetailWrap.innerHTML = '';
    STATE.els.detailWrap.style.display = 'none';
    STATE.els.mobileDetailWrap.style.display = 'none';
    STATE.last = null;
  }

  function calcTotals(rows, fromIdx, toIdx) {
    const totals = { food: 0, notebook: 0, supplement: 0, medal: 0 };

    for (let i = fromIdx + 1; i <= toIdx; i++) {
      const row = rows[i] || {};
      totals.food += toNum(row.food);
      totals.notebook += toNum(row.notebook);
      totals.supplement += toNum(row.supplement);
      totals.medal += toNum(row.medal);
    }

    return totals;
  }

  function doCalc() {
    const rows = getLevelArrayByPet(STATE.data, STATE.els.petSel.value);
    if (!rows.length) {
      resetOutputs();
      return;
    }

    const fromIdx = parseInt(STATE.els.fromSel.value, 10);
    const toIdx = parseInt(STATE.els.toSel.value, 10);

    if (toIdx <= fromIdx) {
      resetOutputs();
      return;
    }

    const totals = calcTotals(rows, fromIdx, toIdx);

    S_els('pc-need-food').textContent = fmt(totals.food);
    S_els('pc-need-notebook').textContent = fmt(totals.notebook);
    S_els('pc-need-supplement').textContent = fmt(totals.supplement);
    S_els('pc-need-medal').textContent = fmt(totals.medal);

    renderHeader();

    const tb = S_els('pc-tbody');
    tb.innerHTML = '';
    STATE.els.mobileDetailWrap.innerHTML = '';

    for (let i = fromIdx + 1; i <= toIdx; i++) {
      const row = rows[i] || {};
      const rowValues = {
        food: toNum(row.food),
        notebook: toNum(row.notebook),
        supplement: toNum(row.supplement),
        medal: toNum(row.medal)
      };

      renderDesktopRow(tb, getDisplayLabel(row), rowValues, false);
      renderMobileRow(STATE.els.mobileDetailWrap, getDisplayLabel(row), rowValues, false);
    }

    renderDesktopRow(tb, T('calcPet.detail.total', '합계'), totals, true);
    renderMobileRow(STATE.els.mobileDetailWrap, T('calcPet.detail.total', '합계'), totals, true);

    STATE.els.detailWrap.style.display = '';
    STATE.els.mobileDetailWrap.style.display = '';

    STATE.last = {
      petId: STATE.els.petSel.value,
      fromIdx: fromIdx,
      toIdx: toIdx
    };
  }

  async function initPetCalculator(opt) {
    const {
      mount,
      jsonUrl,
      data,
      fetchOptions
    } = opt || {};

    const root = document.querySelector(mount);
    if (!root) {
      console.error('[pet-calc] mount not found:', mount);
      return;
    }

    let petData;
    try {
      if (data) {
        petData = data;
      } else {
        const res = await fetch(jsonUrl, Object.assign({ cache: 'no-store' }, fetchOptions || {}));
        if (!res.ok) throw new Error('fetch ' + res.status);
        petData = await res.json();
      }
    } catch (e) {
      root.textContent = T('calcPet.error.load', '데이터를 불러오지 못했습니다.');
      console.error(e);
      return;
    }

    if (!petData || !Array.isArray(petData.pets) || !petData.pets.length || !petData.levelsByRarity) {
      root.textContent = T('calcPet.error.invalid', '계산기 데이터 형식이 올바르지 않습니다.');
      return;
    }

    if (!document.getElementById('pet-calc-style')) {
      const st = document.createElement('style');
      st.id = 'pet-calc-style';
      st.textContent = `
    .pet-calc-wrap{
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Pretendard,Arial,sans-serif;
      color:#111827;
      overflow-x:hidden;
    }

    .pc-card{
      border:1px solid #e5e7eb;
      border-radius:24px;
      padding:18px;
      background:#ffffff;
      box-shadow:0 8px 24px rgba(17,24,39,.05);
      max-width:1120px;
      margin:0 auto;
      overflow:hidden;
    }

    .pc-section + .pc-section{
      margin-top:16px;
    }

    .pc-section-title{
      margin:0 0 10px;
      font-size:15px;
      font-weight:800;
      color:#111827;
    }

    .pc-pet-grid{
      display:grid;
      grid-template-columns:repeat(6,minmax(0,1fr));
      gap:12px;
    }

    .pc-pet-btn{
      display:flex;
      align-items:center;
      justify-content:center;
      width:100%;
      min-height:88px;
      padding:10px;
      border:1px solid #e5e7eb;
      border-radius:18px;
      background:#ffffff;
      box-shadow:none;
      cursor:pointer;
      transition:border-color .18s ease, box-shadow .18s ease, transform .18s ease;
      text-align:center;
    }

    .pc-pet-btn:hover{
      border-color:#d1d5db;
      background:#ffffff;
      box-shadow:0 4px 10px rgba(15,23,42,.04);
      transform:translateY(-1px);
    }

    .pc-pet-btn.is-active{
      border-color:#94a3b8;
      background:#ffffff;
      box-shadow:0 0 0 2px rgba(148,163,184,.12);
    }

    .pc-pet-thumb{
      width:64px;
      height:64px;
      border-radius:16px;
      border:1px solid #e5e7eb;
      background:#ffffff;
      display:flex;
      align-items:center;
      justify-content:center;
      overflow:hidden;
      flex:0 0 auto;
    }

    .pc-pet-thumb img{
      width:100%;
      height:100%;
      object-fit:cover;
      display:block;
    }

    .pc-pet-thumb.is-fallback{
      background:#f8fafc;
    }

    .pc-fallback-emoji{
      font-size:24px;
      line-height:1;
    }

    .pc-selected-pet{
      display:flex;
      align-items:center;
      gap:14px;
      padding:14px 16px;
      border:1px solid #e5e7eb;
      border-radius:18px;
      background:#ffffff;
    }

    .pc-selected-pet-thumb{
      width:72px;
      height:72px;
      border-radius:18px;
      border:1px solid #e5e7eb;
      background:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      overflow:hidden;
      flex:0 0 auto;
    }

    .pc-selected-pet-thumb img{
      width:100%;
      height:100%;
      object-fit:cover;
      display:block;
    }

    .pc-selected-pet-thumb.is-fallback{
      background:#f8fafc;
    }

    .pc-selected-pet-text{
      min-width:0;
      flex:1 1 auto;
    }

    .pc-selected-pet-name{
      font-size:22px;
      line-height:1.2;
      font-weight:900;
      color:#111827;
      word-break:keep-all;
    }

    .pc-selected-pet-rarity{
      margin-top:8px;
      display:inline-flex;
      align-items:center;
      min-height:26px;
      padding:5px 10px;
      border-radius:999px;
      font-size:12px;
      font-weight:800;
      line-height:1;
      border:1px solid transparent;
    }

    .pc-rarity-common{
      color:#475569;
      background:#f1f5f9;
      border-color:#cbd5e1;
    }

    .pc-rarity-uncommon{
      color:#047857;
      background:#d1fae5;
      border-color:#a7f3d0;
    }

    .pc-rarity-r{
      color:#0369a1;
      background:#e0f2fe;
      border-color:#bae6fd;
    }

    .pc-rarity-sr{
      color:#6d28d9;
      background:#ede9fe;
      border-color:#ddd6fe;
    }

    .pc-rarity-ssr{
      color:#b45309;
      background:#fef3c7;
      border-color:#fde68a;
    }

    .pc-form-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px;
    }

    .pc-field{
      display:flex;
      flex-direction:column;
      gap:8px;
      min-width:0;
    }

    .pc-label{
      font-size:14px;
      font-weight:800;
      color:#111827;
      min-height:20px;
      display:flex;
      align-items:center;
    }

    .pc-select{
      height:52px;
      padding:0 14px;
      border:1px solid #d1d5db;
      border-radius:14px;
      background:#fff;
      font-size:15px;
      font-weight:700;
      color:#111827;
      outline:none;
      width:100%;
      min-width:0;
    }

    .pc-select:focus{
      border-color:#2563eb;
      box-shadow:0 0 0 3px rgba(37,99,235,.12);
    }

    .pc-resource-grid{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:12px;
    }

    .pc-resource-card{
      display:flex;
      align-items:center;
      gap:12px;
      min-height:92px;
      padding:14px;
      border:1px solid #e5e7eb;
      border-radius:18px;
      background:#fff;
      min-width:0;
    }

    .pc-resource-thumb{
      width:48px;
      height:48px;
      border-radius:14px;
      border:1px solid #e5e7eb;
      background:#f3f4f6;
      display:flex;
      align-items:center;
      justify-content:center;
      overflow:hidden;
      flex:0 0 auto;
    }

    .pc-resource-thumb img{
      width:100%;
      height:100%;
      object-fit:contain;
      display:block;
    }

    .pc-resource-thumb.is-fallback{
      background:#f8fafc;
    }

    .pc-resource-text{
      min-width:0;
      flex:1 1 auto;
      display:flex;
      flex-direction:column;
      justify-content:center;
      align-items:flex-start;
    }

    .pc-resource-num{
      font-size:28px;
      line-height:1.05;
      font-weight:900;
      color:#111827;
      min-height:30px;
      letter-spacing:-.02em;
      white-space:nowrap;
      text-align:left;
    }

    .pc-resource-label{
      margin-top:4px;
      font-size:14px;
      font-weight:700;
      color:#374151;
      min-height:20px;
      display:flex;
      align-items:center;
      line-height:1.2;
      text-align:left;
      word-break:keep-all;
    }

    .pc-link-strip{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      align-items:center;
    }

    .pc-link-pet{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:52px;
      height:52px;
      border-radius:14px;
      border:1px solid #d1d5db;
      background:#fff;
      text-decoration:none;
      overflow:hidden;
      transition:all .16s ease;
    }

    .pc-link-pet:hover{
      border-color:#2563eb;
      box-shadow:0 6px 16px rgba(37,99,235,.12);
      transform:translateY(-1px);
    }

    .pc-link-pet img{
      width:100%;
      height:100%;
      object-fit:cover;
      display:block;
    }

    .pc-link-pet.is-fallback{
      background:#f8fafc;
    }

    .pc-detail{
      margin-top:14px;
      font-size:13px;
      background:#fff;
      border:1px solid #e5e7eb;
      border-radius:18px;
      overflow:hidden;
    }

    .pc-detail table{
      border-collapse:collapse;
      width:100%;
      table-layout:fixed;
    }

    .pc-detail th,
    .pc-detail td{
      border-bottom:1px solid #eef2f7;
      padding:10px 8px;
      text-align:center;
      white-space:normal;
      word-break:keep-all;
      vertical-align:middle;
      line-height:1.35;
      font-size:13px;
    }

    .pc-detail th{
      background:#f8fafc;
      font-weight:800;
      color:#111827;
    }

    .pc-detail th:first-child,
    .pc-detail td:first-child{
      width:90px;
    }

    .pc-total-row td{
      font-weight:800;
      background:#eff6ff;
    }

    .pc-detail-inline{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:6px;
      flex-wrap:wrap;
    }

    .pc-detail-icon{
      width:18px;
      height:18px;
      border-radius:6px;
      overflow:hidden;
      border:1px solid #e5e7eb;
      background:#f8fafc;
      flex:0 0 auto;
    }

    .pc-detail-icon img{
      width:100%;
      height:100%;
      object-fit:contain;
      display:block;
    }

    .pc-mobile-detail{
      display:none;
      margin-top:14px;
      gap:10px;
    }

    .pc-mobile-row{
      border:1px solid #e5e7eb;
      border-radius:16px;
      background:#fff;
      padding:12px;
      min-width:0;
    }

    .pc-mobile-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:10px;
    }

    .pc-mobile-level{
      font-size:15px;
      font-weight:900;
      color:#111827;
      line-height:1.2;
    }

    .pc-mobile-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:8px;
    }

    .pc-mobile-metric{
      border:1px solid #eef2f7;
      border-radius:12px;
      padding:10px;
      background:#fafcff;
      min-height:68px;
      min-width:0;
    }

    .pc-mobile-metric-top{
      display:flex;
      align-items:center;
      gap:6px;
    }

    .pc-mobile-metric-icon{
      width:18px;
      height:18px;
      border-radius:6px;
      overflow:hidden;
      border:1px solid #e5e7eb;
      background:#fff;
      flex:0 0 auto;
    }

    .pc-mobile-metric-icon img{
      width:100%;
      height:100%;
      object-fit:contain;
      display:block;
    }

    .pc-mobile-metric-label{
      font-size:12px;
      font-weight:700;
      color:#6b7280;
      line-height:1.2;
      min-width:0;
      text-align:left;
    }

    .pc-mobile-metric-num{
      margin-top:8px;
      font-size:16px;
      font-weight:900;
      color:#111827;
      line-height:1.1;
      white-space:nowrap;
      text-align:left;
    }

    .pc-mobile-total{
      border-color:#bfdbfe;
      background:#eff6ff;
    }

    .pc-note{
      margin-top:12px;
      font-size:13px;
      color:#6b7280;
      line-height:1.5;
    }

    @media (max-width: 900px){
      .pc-pet-grid{
        grid-template-columns:repeat(4,minmax(0,1fr));
      }
    }

    @media (max-width: 767px){
      .pc-detail{
        display:none;
      }
      .pc-mobile-detail{
        display:grid;
      }
    }

    @media (max-width: 640px){
      .pc-card{
        padding:14px;
        border-radius:20px;
      }

      .pc-pet-grid{
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .pc-pet-btn{
        min-height:76px;
        padding:8px;
      }

      .pc-pet-thumb{
        width:52px;
        height:52px;
        border-radius:14px;
      }

      .pc-selected-pet{
        padding:12px;
        gap:12px;
      }

      .pc-selected-pet-thumb{
        width:60px;
        height:60px;
        border-radius:16px;
      }

      .pc-selected-pet-name{
        font-size:18px;
      }

      .pc-form-grid{
        grid-template-columns:1fr;
      }

      .pc-resource-grid{
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;
      }

      .pc-resource-card{
        min-height:110px;
        padding:10px 8px;
        gap:8px;
        flex-direction:column;
        align-items:center;
        justify-content:flex-start;
        text-align:center;
      }

      .pc-resource-thumb{
        width:34px;
        height:34px;
        border-radius:10px;
      }

      .pc-resource-text{
        width:100%;
        align-items:center;
        justify-content:flex-start;
      }

      .pc-resource-num{
        font-size:18px;
        min-height:auto;
        text-align:center;
      }

      .pc-resource-label{
        font-size:12px;
        min-height:28px;
        justify-content:center;
        text-align:center;
      }

      .pc-link-strip{
        gap:6px;
      }

      .pc-link-pet{
        width:46px;
        height:46px;
        border-radius:12px;
      }

      .pc-mobile-grid{
        grid-template-columns:1fr;
      }
    }
  `;
      document.head.appendChild(st);
    }

    root.innerHTML = '';
    root.classList.add('pet-calc-wrap');

    const card = h('div', { class: 'pc-card' });
    const pets = Array.isArray(petData.pets) ? petData.pets : [];

    const petSection = h('section', { class: 'pc-section' });
    const petTitle = h('h3', {
      class: 'pc-section-title',
      id: 'pc-pet-title',
      text: T('calcPet.form.pet.title', '펫 선택')
    });

    const petSel = h('select', {
      class: 'pc-select',
      id: 'pc-pet',
      style: 'display:none'
    });

    const petGrid = h('div', { class: 'pc-pet-grid', id: 'pc-pet-grid' });

    pets.forEach(function (pet) {
      petSel.appendChild(h('option', {
        value: pet.id || '',
        text: pet.name || pet.id || ''
      }));

      const btn = h('button', {
        type: 'button',
        class: 'pc-pet-btn',
        dataset: { petId: pet.id || '' },
        title: pet.name || pet.id || '',
        'aria-label': pet.name || pet.id || ''
      }, [
        makeImageBox(
          petImagePath(pet.id),
          pet.name || '',
          '🐾',
          'pc-pet-thumb',
          DEFAULT_PAW_IMG
        )
      ]);

      btn.addEventListener('click', function () {
        petSel.value = String(pet.id || '');
        updatePetActiveState();
        renderSelectedPet();
        rebuildLevelOptions();
        doCalc();
      });

      petGrid.appendChild(btn);
    });

    petSection.appendChild(petTitle);
    petSection.appendChild(petGrid);
    petSection.appendChild(petSel);

    const selectedSection = h('section', { class: 'pc-section' });
    const selectedBox = h('div', { class: 'pc-selected-pet', id: 'pc-selected-pet' }, [
      h('div', { class: 'pc-selected-pet-thumb', id: 'pc-selected-pet-thumb' }),
      h('div', { class: 'pc-selected-pet-text' }, [
        h('div', { class: 'pc-selected-pet-name', id: 'pc-selected-pet-name', text: '-' }),
        h('div', { class: 'pc-selected-pet-rarity pc-rarity-common', id: 'pc-selected-pet-rarity', text: '-' })
      ])
    ]);
    selectedSection.appendChild(selectedBox);

    const formSection = h('section', { class: 'pc-section' });
    const formTitle = h('h3', {
      class: 'pc-section-title',
      id: 'pc-form-title',
      text: T('calcPet.form.title', '레벨')
    });

    const fromSel = h('select', { class: 'pc-select', id: 'pc-from' });
    const toSel = h('select', { class: 'pc-select', id: 'pc-to' });

    const fromLabel = h('label', {
      class: 'pc-label',
      id: 'pc-lab-from',
      text: T('calcPet.form.currentLevel.label', '현재 레벨')
    });

    const toLabel = h('label', {
      class: 'pc-label',
      id: 'pc-lab-to',
      text: T('calcPet.form.targetLevel.label', '목표 레벨')
    });

    const formGrid = h('div', { class: 'pc-form-grid' }, [
      h('div', { class: 'pc-field' }, [fromLabel, fromSel]),
      h('div', { class: 'pc-field' }, [toLabel, toSel])
    ]);

    formSection.appendChild(formTitle);
    formSection.appendChild(formGrid);

    const needSection = h('section', { class: 'pc-section' });
    const needTitle = h('h3', {
      class: 'pc-section-title',
      id: 'pc-need-title',
      text: T('calcPet.result.needTitle', '총 필요 재료')
    });

    function buildResourceCard(resourceKey, numId, labId) {
      const meta = RESOURCE_META[resourceKey];
      const thumb = makeImageBox(meta.img, getResourceLabel(resourceKey), meta.emoji, 'pc-resource-thumb');

      return h('div', { class: 'pc-resource-card' }, [
        thumb,
        h('div', { class: 'pc-resource-text' }, [
          h('div', { class: 'pc-resource-num', id: numId, text: '0' }),
          h('div', { class: 'pc-resource-label', id: labId, text: getResourceLabel(resourceKey) })
        ])
      ]);
    }

    const needGrid = h('div', { class: 'pc-resource-grid' }, [
      buildResourceCard('food', 'pc-need-food', 'pc-lab-need-food'),
      buildResourceCard('notebook', 'pc-need-notebook', 'pc-lab-need-notebook'),
      buildResourceCard('supplement', 'pc-need-supplement', 'pc-lab-need-supplement'),
      buildResourceCard('medal', 'pc-need-medal', 'pc-lab-need-medal')
    ]);

    needSection.appendChild(needTitle);
    needSection.appendChild(needGrid);

    const linksSection = h('section', { class: 'pc-section' });
    const linksTitle = h('h3', {
      class: 'pc-section-title',
      id: 'pc-links-title',
      text: T('calcPet.related.title', '펫 페이지 바로가기')
    });

    const linksStrip = h('div', { class: 'pc-link-strip', id: 'pc-link-strip' });

    pets.forEach(function (pet) {
      const href = getPetDetailHref(pet.id);
      const link = h('a', {
        class: 'pc-link-pet' + (!petImagePath(pet.id) ? ' is-fallback' : ''),
        href: href,
        title: pet.name || pet.id || '',
        'aria-label': pet.name || pet.id || '',
        dataset: { petId: pet.id || '' }
      });

      if (href === '#') {
        link.addEventListener('click', function (e) { e.preventDefault(); });
      }

      if (petImagePath(pet.id)) {
        link.appendChild(h('img', {
          src: petImagePath(pet.id),
          alt: pet.name || '',
          loading: 'lazy',
          decoding: 'async'
        }));
      } else {
        link.appendChild(h('span', {
          class: 'pc-fallback-emoji',
          text: '🐾'
        }));
      }

      linksStrip.appendChild(link);
    });

    linksSection.appendChild(linksTitle);
    linksSection.appendChild(linksStrip);

    const detailSection = h('section', { class: 'pc-section' });
    const detailTitle = h('h3', {
      class: 'pc-section-title',
      id: 'pc-detail-title',
      text: T('calcPet.detail.title', '레벨 구간 상세')
    });

    const detailWrap = h('div', { class: 'pc-detail', style: 'display:none' });
    const detailTable = h('table', {}, [
      h('thead', {}, h('tr', { id: 'pc-head-row' })),
      h('tbody', { id: 'pc-tbody' })
    ]);
    detailWrap.appendChild(detailTable);

    const mobileDetailWrap = h('div', {
      class: 'pc-mobile-detail',
      id: 'pc-mobile-detail',
      style: 'display:none'
    });

    const note = h('div', {
      class: 'pc-note',
      id: 'pc-note',
      text: T('calcPet.note', '현재 레벨 다음 단계부터 목표 레벨까지의 누적 재료를 계산합니다.')
    });

    detailSection.appendChild(detailTitle);
    detailSection.appendChild(detailWrap);
    detailSection.appendChild(mobileDetailWrap);
    detailSection.appendChild(note);

    card.appendChild(petSection);
    card.appendChild(selectedSection);
    card.appendChild(formSection);
    card.appendChild(needSection);
    card.appendChild(linksSection);
    card.appendChild(detailSection);
    root.appendChild(card);

    STATE.root = root;
    STATE.data = petData;
    STATE.els = {
      petSel: petSel,
      petGrid: petGrid,
      petTitle: petTitle,
      formTitle: formTitle,
      fromSel: fromSel,
      toSel: toSel,
      fromLabel: fromLabel,
      toLabel: toLabel,
      needTitle: needTitle,
      linksTitle: linksTitle,
      detailTitle: detailTitle,
      detailWrap: detailWrap,
      mobileDetailWrap: mobileDetailWrap,
      note: note
    };

    petSel.addEventListener('change', function () {
      updatePetActiveState();
      renderSelectedPet();
      rebuildLevelOptions();
      doCalc();
    });

    fromSel.addEventListener('change', doCalc);
    toSel.addEventListener('change', doCalc);

    window.__petCalcReset = resetOutputs;

    if (!window.__pet_i18n_bound__) {
      document.addEventListener('i18n:changed', function () {
        try { window.reapplyPetCalculatorI18N(); } catch (_) {}
      }, false);
      window.__pet_i18n_bound__ = true;
    }

    updateLabels();
    updatePetActiveState();
    renderSelectedPet();
    rebuildLevelOptions();
    doCalc();
  }

  window.reapplyPetCalculatorI18N = function reapplyPetCalculatorI18N() {
    const S = STATE;
    if (!S.root || !S.data || !S.els) return;

    updateLabels();

    if (S.last) {
      S.els.petSel.value = String(S.last.petId || '');
      updatePetActiveState();
      renderSelectedPet();
      rebuildLevelOptions();
      S.els.fromSel.value = String(S.last.fromIdx);
      S.els.toSel.value = String(S.last.toIdx);

      const evt = document.createEvent('Event');
      evt.initEvent('change', true, true);
      S.els.fromSel.dispatchEvent(evt);
    } else {
      renderSelectedPet();
      window.__petCalcReset();
    }
  };

  window.initPetCalculator = initPetCalculator;
})();
// /js/hero-gear-calculator.js
(function () {
  'use strict';

  var DATA_URL = '/data/hero-gear-data.json';
  var I18N_URL_TEMPLATE = '/i18n/{lang}/hero-gear-calculator.json';

  var DEFAULT_I18N = {
    meta: {
      title: '영웅 장비 계산기 | KingshotData',
      description: '킹샷 영웅 장비 계산기. 일반 강화, 단련, 마스터리 제작 구간별 필요 재료를 빠르게 계산해보세요.'
    },
    page: {
      title: '킹샷 영웅 장비 계산기',
      description: '영웅 장비 일반부터 신화 T6 3성까지 계산해보고, 계산된 수치를 공유해보세요.'
    },
    tabs: {
      normal: '일반 강화',
      temper: '단련',
      mastery: '마스터리 제작'
    },
    units: {
      infantry: '보병',
      lancer: '기병',
      marksman: '궁병'
    },
    form: {
      currentStage: '현재 단계',
      targetStage: '목표 단계',
      stageUnit: '단계'
    },
    result: {
      title: '계산 결과',
      detailTitle: '상세 내역',
      range: '구간',
      total: '총합',
      materialsSuffix: '재료'
    },
    messages: {
      emptyDefault: '장비와 단계를 선택하면 결과가 바로 표시됩니다.',
      selectItemFirst: '장비를 하나 이상 선택해줘.',
      invalidStage: '목표 단계는 현재 단계보다 높아야 해.',
      loading: '데이터 불러오는 중...',
      loadError: 'hero-gear-data.json 불러오기 실패. 경로를 확인해줘.',
      i18nLoadError: 'hero-gear-calculator.json 불러오기 실패. 기본 언어로 표시합니다.'
    },
    resources: {
      enhancementPart100: '강화 부품 100점',
      mithril: '미스릴',
      forgehammer: '제작망치',
      legendGear: '레전드 장비'
    },
    breadcrumbs: {
      home: '홈',
      calculators: '계산기',
      current: '영웅 장비 계산기'
    }
  };

  var DEFAULT_DATA = {
    heroGear: {
      upgradeTables: {
        enhancement: [],
        forge: [],
        mastery: []
      }
    }
  };

  var state = {
    lang: 'ko',
    messages: DEFAULT_I18N,
    data: DEFAULT_DATA,
    root: null
  };

  var TAB_ORDER = ['normal', 'temper', 'mastery'];

  function safeNumber(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function formatNumber(value) {
    return safeNumber(value).toLocaleString('ko-KR');
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getLangFromDom() {
    var raw =
      document.documentElement.getAttribute('lang') ||
      document.body.getAttribute('data-lang') ||
      window.__LANG ||
      'ko';

    raw = String(raw || '').trim().toLowerCase();

    if (
      raw === 'zh-tw' ||
      raw === 'zh_tw' ||
      raw === 'tw' ||
      raw === 'zhtw' ||
      raw === 'zh-hant' ||
      raw.indexOf('zh-tw') === 0 ||
      raw.indexOf('zh_hant') === 0 ||
      raw.indexOf('zh-hant') === 0
    ) return 'zh-tw';

    if (raw.indexOf('ja') === 0) return 'ja';
    if (raw.indexOf('en') === 0) return 'en';
    if (raw.indexOf('ko') === 0) return 'ko';

    return 'ko';
  }

  function deepMerge(base, extra) {
    var result = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    var key;

    extra = extra || {};

    for (key in extra) {
      if (!Object.prototype.hasOwnProperty.call(extra, key)) continue;

      if (
        extra[key] &&
        typeof extra[key] === 'object' &&
        !Array.isArray(extra[key]) &&
        base &&
        base[key] &&
        typeof base[key] === 'object' &&
        !Array.isArray(base[key])
      ) {
        result[key] = deepMerge(base[key], extra[key]);
      } else {
        result[key] = extra[key];
      }
    }

    return result;
  }

  function getMessage(path) {
    var parts = String(path || '').split('.');
    var cur = state.messages;
    var i;

    for (i = 0; i < parts.length; i += 1) {
      if (!cur || !Object.prototype.hasOwnProperty.call(cur, parts[i])) {
        cur = null;
        break;
      }
      cur = cur[parts[i]];
    }

    if (cur == null) {
      cur = DEFAULT_I18N;
      for (i = 0; i < parts.length; i += 1) {
        if (!cur || !Object.prototype.hasOwnProperty.call(cur, parts[i])) return path;
        cur = cur[parts[i]];
      }
    }

    return cur;
  }

  function buildTabMeta() {
    return {
      normal: { key: 'normal', label: getMessage('tabs.normal'), min: 0, max: 100 },
      temper: { key: 'temper', label: getMessage('tabs.temper'), min: 100, max: 200 },
      mastery: { key: 'mastery', label: getMessage('tabs.mastery'), min: 0, max: 20 }
    };
  }

  function buildSlotItems() {
    return [
      { id: 'infantry-helmet', typeKey: 'infantry', typeLabel: getMessage('units.infantry'), image: '/img/hero-gear/guardian-helmet.webp' },
      { id: 'infantry-gloves', typeKey: 'infantry', typeLabel: getMessage('units.infantry'), image: '/img/hero-gear/guardian-gloves.webp' },

      { id: 'lancer-helmet', typeKey: 'lancer', typeLabel: getMessage('units.lancer'), image: '/img/hero-gear/raider-helmet.webp' },
      { id: 'lancer-gloves', typeKey: 'lancer', typeLabel: getMessage('units.lancer'), image: '/img/hero-gear/raider-gloves.webp' },

      { id: 'marksman-helmet', typeKey: 'marksman', typeLabel: getMessage('units.marksman'), image: '/img/hero-gear/shooter-helmet.webp' },
      { id: 'marksman-gloves', typeKey: 'marksman', typeLabel: getMessage('units.marksman'), image: '/img/hero-gear/shooter-gloves.webp' },

      { id: 'infantry-armor', typeKey: 'infantry', typeLabel: getMessage('units.infantry'), image: '/img/hero-gear/guardian-armor.webp' },
      { id: 'infantry-boots', typeKey: 'infantry', typeLabel: getMessage('units.infantry'), image: '/img/hero-gear/guardian-boots.webp' },

      { id: 'lancer-armor', typeKey: 'lancer', typeLabel: getMessage('units.lancer'), image: '/img/hero-gear/raider-armor.webp' },
      { id: 'lancer-boots', typeKey: 'lancer', typeLabel: getMessage('units.lancer'), image: '/img/hero-gear/raider-boots.webp' },

      { id: 'marksman-armor', typeKey: 'marksman', typeLabel: getMessage('units.marksman'), image: '/img/hero-gear/shooter-armor.webp' },
      { id: 'marksman-boots', typeKey: 'marksman', typeLabel: getMessage('units.marksman'), image: '/img/hero-gear/shooter-boots.webp' }
    ];
  }

  function buildResourceMeta() {
    return {
      enhancementPart100: {
        label: getMessage('resources.enhancementPart100'),
        image: '/img/hero-gear/enhancement-part-100.webp',
        fallback: '100'
      },
      mithril: {
        label: getMessage('resources.mithril'),
        image: '/img/hero-gear/mithril.webp',
        fallback: 'MI'
      },
      forgehammer: {
        label: getMessage('resources.forgehammer'),
        image: '/img/hero-gear/forgehammer.webp',
        fallback: 'FH'
      },
      legendGear: {
        label: getMessage('resources.legendGear'),
        image: '/img/hero-gear/legend-gear.webp',
        fallback: 'LG'
      }
    };
  }

  function cloneTotals(keys) {
    var obj = {};
    (keys || []).forEach(function (key) {
      obj[key] = 0;
    });
    return obj;
  }

  function addValue(totals, key, value) {
    if (!Object.prototype.hasOwnProperty.call(totals, key)) totals[key] = 0;
    totals[key] += safeNumber(value);
  }

  function multiplyTotals(totals, multiplier) {
    var result = {};
    Object.keys(totals).forEach(function (key) {
      result[key] = safeNumber(totals[key]) * multiplier;
    });
    return result;
  }

  function getHeroGearRootData(data) {
    return (data && data.heroGear) ? data.heroGear : DEFAULT_DATA.heroGear;
  }

  function normalizeStage(value, min, max) {
    return Math.max(min, Math.min(max, Math.floor(safeNumber(value))));
  }

  function sumTableRange(table, startLevel, targetLevel, keys) {
    var totals = cloneTotals(keys);

    if (!Array.isArray(table) || !table.length) return totals;

    for (var i = 0; i < table.length; i += 1) {
      var row = table[i];
      var rowLevel = Math.floor(safeNumber(row && row.level));

      if (rowLevel <= startLevel) continue;
      if (rowLevel > targetLevel) continue;

      (keys || []).forEach(function (key) {
        addValue(totals, key, row[key]);
      });
    }

    return totals;
  }

  function buildDetailRows(table, startLevel, targetLevel, keyMap, selectedCount) {
    var rows = [];

    if (!Array.isArray(table) || !table.length) return rows;

    for (var i = 0; i < table.length; i += 1) {
      var row = table[i];
      var rowLevel = Math.floor(safeNumber(row && row.level));

      if (rowLevel <= startLevel) continue;
      if (rowLevel > targetLevel) continue;

      var detailRow = {
        fromLevel: rowLevel - 1,
        toLevel: rowLevel
      };

      keyMap.forEach(function (item) {
        detailRow[item.outputKey] = safeNumber(row[item.inputKey]) * selectedCount;
      });

      rows.push(detailRow);
    }

    return rows;
  }

  function getSelectedIds(root) {
    return Array.prototype.slice.call(root.querySelectorAll('.hg-slot-card.is-active')).map(function (el) {
      return el.getAttribute('data-slot-id');
    });
  }

  function getActiveTab(root) {
    var active = root.querySelector('.hg-top-tab.is-active');
    return active ? active.getAttribute('data-tab') : 'normal';
  }

  function getStageRangeByTab(tab) {
    var TAB_META = buildTabMeta();
    return TAB_META[tab] || TAB_META.normal;
  }

  function calculateNormal(form, data) {
    var heroGear = getHeroGearRootData(data);
    var enhancement = heroGear.upgradeTables.enhancement || [];
    var selectedCount = form.selectedIds.length;
    var keyMap = [{ inputKey: 'exp', outputKey: 'enhancementPart100' }];
    var base = sumTableRange(enhancement, form.startStage, form.targetStage, ['exp']);

    return {
      total: multiplyTotals({ enhancementPart100: base.exp }, selectedCount),
      details: buildDetailRows(enhancement, form.startStage, form.targetStage, keyMap, selectedCount)
    };
  }

  function calculateTemper(form, data) {
    var heroGear = getHeroGearRootData(data);
    var enhancement = heroGear.upgradeTables.enhancement || [];
    var selectedCount = form.selectedIds.length;
    var keyMap = [
      { inputKey: 'exp', outputKey: 'enhancementPart100' },
      { inputKey: 'mithril', outputKey: 'mithril' },
      { inputKey: 'mythicGear', outputKey: 'legendGear' }
    ];
    var base = sumTableRange(enhancement, form.startStage, form.targetStage, ['exp', 'mithril', 'mythicGear']);

    return {
      total: multiplyTotals({
        enhancementPart100: base.exp,
        mithril: base.mithril,
        legendGear: base.mythicGear
      }, selectedCount),
      details: buildDetailRows(enhancement, form.startStage, form.targetStage, keyMap, selectedCount)
    };
  }

  function calculateMastery(form, data) {
    var heroGear = getHeroGearRootData(data);
    var mastery = heroGear.upgradeTables.mastery || heroGear.upgradeTables.forge || [];
    var selectedCount = form.selectedIds.length;

    var masteryUsesLegacyKeys = Array.isArray(mastery) && mastery.some(function (row) {
      return row && (row.forgehammer != null || row.mythicGear != null);
    });

    var keyMap = masteryUsesLegacyKeys
      ? [
          { inputKey: 'forgehammer', outputKey: 'forgehammer' },
          { inputKey: 'mythicGear', outputKey: 'legendGear' }
        ]
      : [
          { inputKey: 'masteryStone', outputKey: 'forgehammer' },
          { inputKey: 'legendGear', outputKey: 'legendGear' }
        ];

    var inputKeys = masteryUsesLegacyKeys
      ? ['forgehammer', 'mythicGear']
      : ['masteryStone', 'legendGear'];

    var base = sumTableRange(mastery, form.startStage, form.targetStage, inputKeys);

    return {
      total: multiplyTotals({
        forgehammer: masteryUsesLegacyKeys ? base.forgehammer : base.masteryStone,
        legendGear: masteryUsesLegacyKeys ? base.mythicGear : base.legendGear
      }, selectedCount),
      details: buildDetailRows(mastery, form.startStage, form.targetStage, keyMap, selectedCount)
    };
  }

  function calculateByTab(form, data) {
    if (form.tab === 'temper') return calculateTemper(form, data);
    if (form.tab === 'mastery') return calculateMastery(form, data);
    return calculateNormal(form, data);
  }

  function buildResourceIcon(meta) {
    if (meta && meta.image) {
      return '<img src="' + escapeHtml(meta.image) + '" alt="' + escapeHtml(meta.label) + '" loading="lazy" decoding="async">';
    }
    return '<span class="hg-res-fallback">' + escapeHtml((meta && meta.fallback) || (meta && meta.label) || '') + '</span>';
  }

  function buildResourceChip(key, compact) {
    var RESOURCE_META = buildResourceMeta();
    var meta = RESOURCE_META[key] || { label: key, image: '', fallback: key };

    return [
      '<span class="hg-inline-resource', compact ? ' is-compact' : '', '">',
        '<span class="hg-inline-resource-icon">', buildResourceIcon(meta), '</span>',
        '<span class="hg-inline-resource-text">', escapeHtml(meta.label), '</span>',
      '</span>'
    ].join('');
  }

  function buildResourceItem(key, value) {
    var RESOURCE_META = buildResourceMeta();
    var meta = RESOURCE_META[key] || { label: key, image: '', fallback: key };

    return [
      '<div class="hg-resource-item">',
        '<div class="hg-resource-left">',
          '<div class="hg-resource-icon">', buildResourceIcon(meta), '</div>',
          '<div class="hg-resource-name">', escapeHtml(meta.label), '</div>',
        '</div>',
        '<div class="hg-resource-value">', formatNumber(value), '</div>',
      '</div>'
    ].join('');
  }

  function buildResourceList(totals, keyOrder) {
    var html = '';
    keyOrder.forEach(function (key) {
      html += buildResourceItem(key, totals[key]);
    });
    return html;
  }

  function getResultKeyOrderByTab(tab) {
    if (tab === 'mastery') return ['forgehammer', 'legendGear'];
    if (tab === 'temper') return ['enhancementPart100', 'mithril', 'legendGear'];
    return ['enhancementPart100'];
  }

  function buildDetailTable(result, keyOrder) {
    var thead = ['<tr><th scope="col">' + escapeHtml(getMessage('result.range')) + '</th>'];
    var mobileHead = '';

    keyOrder.forEach(function (key) {
      thead.push('<th scope="col">', buildResourceChip(key, false), '</th>');
    });
    thead.push('</tr>');

    var body = '';
    result.details.forEach(function (row) {
      body += '<tr>';
      body += '<td class="hg-detail-range-cell"><span class="hg-detail-range">' + escapeHtml(row.fromLevel + ' → ' + row.toLevel) + '</span></td>';

      keyOrder.forEach(function (key) {
        body += '<td data-resource-key="' + escapeHtml(key) + '">';
        body += '<span class="hg-detail-cell-inner">';
        body += '<span class="hg-detail-mobile-label">' + buildResourceChip(key, true) + '</span>';
        body += '<span class="hg-detail-cell-value">' + formatNumber(row[key]) + '</span>';
        body += '</span>';
        body += '</td>';
      });

      body += '</tr>';
    });

    var foot = '<tr><th scope="row">' + escapeHtml(getMessage('result.total')) + '</th>';
    keyOrder.forEach(function (key) {
      foot += '<td data-resource-key="' + escapeHtml(key) + '">';
      foot += '<span class="hg-detail-cell-inner">';
      foot += '<span class="hg-detail-mobile-label">' + buildResourceChip(key, true) + '</span>';
      foot += '<span class="hg-detail-cell-value">' + formatNumber(result.total[key]) + '</span>';
      foot += '</span>';
      foot += '</td>';
    });
    foot += '</tr>';

    keyOrder.forEach(function (key) {
      mobileHead += '<div class="hg-detail-mobile-head-item">' + buildResourceChip(key, true) + '</div>';
    });

    return {
      head: thead.join(''),
      body: body,
      foot: foot,
      mobileHead: mobileHead
    };
  }

  function buildMobileDetailCards(result, keyOrder) {
    var html = '';

    result.details.forEach(function (row) {
      html += '<article class="hg-detail-card">';
      html += '<div class="hg-detail-card-top">';
      html += '<div class="hg-detail-card-range"><span class="hg-detail-range">' + escapeHtml(row.fromLevel + ' → ' + row.toLevel) + '</span></div>';
      html += '</div>';
      html += '<div class="hg-detail-card-grid">';

      keyOrder.forEach(function (key) {
        html += '<div class="hg-detail-card-item">';
        html += '<div class="hg-detail-card-item-label">' + buildResourceChip(key, true) + '</div>';
        html += '<div class="hg-detail-card-item-value">' + formatNumber(row[key]) + '</div>';
        html += '</div>';
      });

      html += '</div>';
      html += '</article>';
    });

    html += '<article class="hg-detail-card is-total">';
    html += '<div class="hg-detail-card-top">';
    html += '<div class="hg-detail-card-total-title">' + escapeHtml(getMessage('result.total')) + '</div>';
    html += '</div>';
    html += '<div class="hg-detail-card-grid">';

    keyOrder.forEach(function (key) {
      html += '<div class="hg-detail-card-item">';
      html += '<div class="hg-detail-card-item-label">' + buildResourceChip(key, true) + '</div>';
      html += '<div class="hg-detail-card-item-value">' + formatNumber(result.total[key]) + '</div>';
      html += '</div>';
    });

    html += '</div>';
    html += '</article>';

    return html;
  }

  function renderResult(root, form, result) {
    var TAB_META = buildTabMeta();
    var titleEl = root.querySelector('[data-hg-result-title]');
    var emptyEl = root.querySelector('[data-hg-empty]');
    var bodyEl = root.querySelector('[data-hg-result-body]');
    var detailWrapEl = root.querySelector('[data-hg-detail-wrap]');
    var detailHeadEl = root.querySelector('[data-hg-detail-head]');
    var detailBodyEl = root.querySelector('[data-hg-detail-body]');
    var detailFootEl = root.querySelector('[data-hg-detail-foot]');
    var detailMobileHeadEl = root.querySelector('[data-hg-detail-mobile-head]');
    var detailCardsEl = root.querySelector('[data-hg-detail-cards]');
    var tabMeta = TAB_META[form.tab] || TAB_META.normal;
    var keyOrder = getResultKeyOrderByTab(form.tab);
    var detailTable = buildDetailTable(result, keyOrder);

    if (titleEl) {
      titleEl.textContent = tabMeta.label + ' ' + getMessage('result.materialsSuffix');
    }
    if (emptyEl) emptyEl.style.display = 'none';
    if (bodyEl) bodyEl.innerHTML = buildResourceList(result.total, keyOrder);

    if (detailWrapEl) {
      detailWrapEl.style.display = result.details && result.details.length ? '' : 'none';
    }

    if (detailHeadEl) detailHeadEl.innerHTML = detailTable.head;
    if (detailBodyEl) detailBodyEl.innerHTML = detailTable.body;
    if (detailFootEl) detailFootEl.innerHTML = detailTable.foot;
    if (detailMobileHeadEl) detailMobileHeadEl.innerHTML = detailTable.mobileHead;
    if (detailCardsEl) detailCardsEl.innerHTML = buildMobileDetailCards(result, keyOrder);
  }

  function showEmpty(root, message) {
    var titleEl = root.querySelector('[data-hg-result-title]');
    var emptyEl = root.querySelector('[data-hg-empty]');
    var bodyEl = root.querySelector('[data-hg-result-body]');
    var detailWrapEl = root.querySelector('[data-hg-detail-wrap]');
    var detailHeadEl = root.querySelector('[data-hg-detail-head]');
    var detailBodyEl = root.querySelector('[data-hg-detail-body]');
    var detailFootEl = root.querySelector('[data-hg-detail-foot]');
    var detailMobileHeadEl = root.querySelector('[data-hg-detail-mobile-head]');
    var detailCardsEl = root.querySelector('[data-hg-detail-cards]');

    if (titleEl) titleEl.textContent = getMessage('result.title');
    if (bodyEl) bodyEl.innerHTML = '';
    if (detailWrapEl) detailWrapEl.style.display = 'none';
    if (detailHeadEl) detailHeadEl.innerHTML = '';
    if (detailBodyEl) detailBodyEl.innerHTML = '';
    if (detailFootEl) detailFootEl.innerHTML = '';
    if (detailMobileHeadEl) detailMobileHeadEl.innerHTML = '';
    if (detailCardsEl) detailCardsEl.innerHTML = '';

    if (emptyEl) {
      emptyEl.style.display = '';
      emptyEl.textContent = message || getMessage('messages.emptyDefault');
    }
  }

  function showLoading(root) {
    showEmpty(root, getMessage('messages.loading'));
  }

  function getValue(root, selector) {
    var el = root.querySelector(selector);
    return el ? el.value : '';
  }

  function readForm(root) {
    var tab = getActiveTab(root);
    var range = getStageRangeByTab(tab);

    return {
      tab: tab,
      selectedIds: getSelectedIds(root),
      startStage: normalizeStage(getValue(root, '[data-hg-start-stage]'), range.min, range.max),
      targetStage: normalizeStage(getValue(root, '[data-hg-target-stage]'), range.min, range.max)
    };
  }

  function validateForm(form) {
    if (!form.selectedIds.length) return getMessage('messages.selectItemFirst');
    if (form.targetStage <= form.startStage) return getMessage('messages.invalidStage');
    return '';
  }

  function buildStageOptions(minStage, maxStage, selectedValue) {
    var selected = normalizeStage(selectedValue, minStage, maxStage);
    var html = '';

    for (var i = minStage; i <= maxStage; i += 1) {
      html += [
        '<option value="', i, '"',
        (i === selected ? ' selected' : ''),
        '>',
        i, ' ', escapeHtml(getMessage('form.stageUnit')),
        '</option>'
      ].join('');
    }
    return html;
  }

  function buildTabsHTML() {
    var TAB_META = buildTabMeta();

    return TAB_ORDER.map(function (key, index) {
      var meta = TAB_META[key];
      return [
        '<button type="button" class="hg-top-tab', index === 0 ? ' is-active' : '', '" data-tab="', key, '">',
          '<span class="hg-top-tab-label">', escapeHtml(meta.label), '</span>',
        '</button>'
      ].join('');
    }).join('');
  }

  function buildSlotCardsHTML() {
    var SLOT_ITEMS = buildSlotItems();

    return SLOT_ITEMS.map(function (item) {
      var badgeClass = item.typeKey === 'infantry'
        ? 'is-infantry'
        : item.typeKey === 'lancer'
          ? 'is-lancer'
          : 'is-marksman';

      return [
        '<button type="button" class="hg-slot-card" data-slot-id="', escapeHtml(item.id), '">',
          '<div class="hg-slot-thumb-wrap">',
            '<span class="hg-slot-check" aria-hidden="true"></span>',
            '<div class="hg-slot-thumb">',
              '<img src="', escapeHtml(item.image), '" alt="', escapeHtml(item.typeLabel), '" loading="lazy" decoding="async">',
            '</div>',
            '<div class="hg-slot-type ', badgeClass, '">', escapeHtml(item.typeLabel), '</div>',
          '</div>',
        '</button>'
      ].join('');
    }).join('');
  }

  function updatePageMeta() {
    try {
      var title = getMessage('meta.title');
      var desc = getMessage('meta.description');

      if (title) document.title = title;

      var descMeta = document.querySelector('meta[name="description"]');
      if (descMeta) descMeta.setAttribute('content', desc);

      var ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', title);

      var ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', desc);

      var twTitle = document.querySelector('meta[name="twitter:title"]');
      if (twTitle) twTitle.setAttribute('content', title);

      var twDesc = document.querySelector('meta[name="twitter:description"]');
      if (twDesc) twDesc.setAttribute('content', desc);
    } catch (_) {}
  }

  function updateBreadcrumbs() {
    var nav = document.querySelector('.breadcrumb');
    if (!nav) return;

    var links = nav.querySelectorAll('a');
    var current = nav.querySelector('[data-breadcrumb-current]') || nav.querySelector('span:last-child');

    if (links[0]) links[0].textContent = getMessage('breadcrumbs.home');
    if (links[1]) links[1].textContent = getMessage('breadcrumbs.calculators');
    if (current) current.textContent = getMessage('breadcrumbs.current');
  }

  function injectStyles() {
    if (document.getElementById('hero-gear-calculator-style')) return;

    var style = document.createElement('style');
    style.id = 'hero-gear-calculator-style';
    style.textContent = [
      '.hg-calc{margin-top:0;padding:0;border:0;background:transparent;box-shadow:none}',
      '.hg-head{margin:0 0 18px}',
      '.hg-page-title{margin:0 0 10px;font-size:34px;font-weight:900;line-height:1.2;color:#111827;letter-spacing:-0.02em}',
      '.hg-page-desc{margin:0;font-size:16px;line-height:1.7;color:#374151;word-break:keep-all}',

      '.hg-top-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 14px}',
      '.hg-top-tab{height:58px;border:1px solid #000;border-radius:16px;background:linear-gradient(180deg,#57dce6 0%, #14b8c4 100%);color:#fff;font-size:16px;font-weight:900;cursor:pointer;box-shadow:inset 0 -3px 0 rgba(0,0,0,.15)}',
      '.hg-top-tab-label{display:inline-block;color:#fff;line-height:1.1;text-shadow:-1px 0 0 #000,1px 0 0 #000,0 -1px 0 #000,0 1px 0 #000}',
      '.hg-top-tab.is-active{transform:translateY(1px);filter:saturate(1.05);box-shadow:inset 0 -3px 0 rgba(0,0,0,.22)}',

      '.hg-slot-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:14px}',
      '.hg-slot-card{display:flex;align-items:stretch;justify-content:center;position:relative;padding:10px;border:1px solid #dbe4f0;border-radius:16px;background:#fff;text-align:left;cursor:pointer;transition:.15s ease all;min-width:0;min-height:126px}',
      '.hg-slot-card:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(15,23,42,.07)}',
      '.hg-slot-card.is-active{border-color:#1667d1;background:#f8fbff;box-shadow:0 0 0 2px rgba(22,103,209,.08) inset}',

      '.hg-slot-thumb-wrap{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:8px;min-width:0;width:100%}',
      '.hg-slot-thumb{width:58px;height:58px;border-radius:12px;background:#f8fafc;border:1px solid #eef2f7;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 auto}',
      '.hg-slot-thumb img{width:84%;height:84%;object-fit:contain;display:block}',

      '.hg-slot-type{display:inline-flex;align-items:center;justify-content:center;min-height:24px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap}',
      '.hg-slot-type.is-infantry{background:#d1fae5;color:#065f46}',
      '.hg-slot-type.is-lancer{background:#dbeafe;color:#1d4ed8}',
      '.hg-slot-type.is-marksman{background:#fef3c7;color:#b45309}',

      '.hg-slot-check{width:22px;height:22px;border:1px solid #bfd0e8;border-radius:999px;display:block;flex:0 0 auto;background:#fff}',
      '.hg-slot-card.is-active .hg-slot-check{background:#1667d1;border-color:#1667d1;box-shadow:inset 0 0 0 5px #fff}',

      '.hg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:6px}',
      '.hg-field{display:flex;flex-direction:column;gap:8px}',
      '.hg-field label{font-size:14px;font-weight:800;color:#111827}',
      '.hg-field select{height:50px;padding:0 14px;border:1px solid #d1d5db;border-radius:14px;background:#fff;font-size:14px;color:#111827}',

      '.hg-result{margin-top:18px;padding:16px;border:1px solid #e5e7eb;border-radius:20px;background:#f8fafc}',
      '.hg-result h3{margin:0 0 12px;font-size:20px;font-weight:900;color:#111827}',
      '.hg-empty{font-size:14px;line-height:1.7;color:#6b7280}',

      '.hg-resource-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}',
      '.hg-resource-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:16px;background:#fff}',
      '.hg-resource-left{display:flex;align-items:center;gap:10px;min-width:0}',
      '.hg-resource-icon{width:44px;height:44px;border-radius:12px;background:#f8fafc;border:1px solid #eef2f7;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 auto}',
      '.hg-resource-icon img{width:76%;height:76%;object-fit:contain;display:block}',
      '.hg-res-fallback{font-size:11px;font-weight:900;color:#374151}',
      '.hg-resource-name{font-size:14px;font-weight:800;color:#111827;line-height:1.35;word-break:keep-all}',
      '.hg-resource-value{font-size:18px;font-weight:900;color:#111827;line-height:1.25;flex:0 0 auto}',

      '.hg-detail-wrap{margin-top:16px}',
      '.hg-detail-title{margin:0 0 10px;font-size:15px;font-weight:900;color:#111827}',
      '.hg-detail-mobile-head{display:none}',
      '.hg-detail-mobile-cards{display:none}',
      '.hg-detail-mobile-head,.hg-detail-card-grid{gap:8px}',
      '.hg-detail-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #dbe4f0;border-radius:16px;background:#fff}',
      '.hg-detail-table{width:100%;min-width:520px;border-collapse:separate;border-spacing:0}',
      '.hg-detail-table th,.hg-detail-table td{padding:12px 10px;border-bottom:1px solid #eef2f7;font-size:13px;line-height:1.45;text-align:right;white-space:nowrap;vertical-align:middle}',
      '.hg-detail-table thead th{position:sticky;top:0;background:#f8fafc;color:#111827;font-weight:900;z-index:1}',
      '.hg-detail-table th:first-child,.hg-detail-table td:first-child{text-align:left}',
      '.hg-detail-table tbody tr:nth-child(even){background:#fbfdff}',
      '.hg-detail-table tfoot th,.hg-detail-table tfoot td{background:#f3f7fb;font-weight:900;color:#111827;border-bottom:0}',
      '.hg-detail-range{display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:4px 10px;border-radius:999px;background:#eef6ff;color:#0f4ea8;font-weight:800}',
      '.hg-detail-range-cell{min-width:96px}',
      '.hg-detail-cell-inner{display:flex;align-items:center;justify-content:flex-end;gap:8px}',
      '.hg-detail-mobile-label{display:none}',
      '.hg-detail-cell-value{display:inline-flex;align-items:center;justify-content:flex-end;min-width:0}',
      '.hg-inline-resource{display:inline-flex;align-items:center;gap:6px;line-height:1.2}',
      '.hg-inline-resource.is-compact{gap:5px}',
      '.hg-inline-resource-icon{width:18px;height:18px;border-radius:999px;background:#f8fafc;border:1px solid #e5e7eb;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 auto}',
      '.hg-inline-resource.is-compact .hg-inline-resource-icon{width:16px;height:16px}',
      '.hg-inline-resource-icon img{width:80%;height:80%;object-fit:contain;display:block}',
      '.hg-inline-resource-text{font-size:12px;font-weight:800;color:#111827;white-space:nowrap}',

      '.hg-detail-card{padding:12px;border:1px solid #dbe4f0;border-radius:16px;background:#fff}',
      '.hg-detail-card + .hg-detail-card{margin-top:10px}',
      '.hg-detail-card.is-total{background:#f3f7fb;border-color:#cfe0f7}',
      '.hg-detail-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}',
      '.hg-detail-card-total-title{font-size:14px;font-weight:900;color:#111827}',
      '.hg-detail-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}',
      '.hg-detail-card-item{padding:10px;border:1px solid #eef2f7;border-radius:14px;background:#fafcff;min-width:0}',
      '.hg-detail-card-item-label{display:flex;align-items:center;min-width:0;margin-bottom:6px}',
      '.hg-detail-card-item-value{font-size:15px;font-weight:900;color:#111827;word-break:break-word}',

      '@media (max-width:1200px){.hg-slot-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}',
      '@media (max-width:900px){.hg-grid,.hg-resource-list{grid-template-columns:1fr 1fr}.hg-slot-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hg-page-title{font-size:30px}}',
      '@media (max-width:640px){',
        '.hg-head{margin-bottom:16px}',
        '.hg-page-title{font-size:24px;margin-bottom:8px}',
        '.hg-page-desc{font-size:14px;line-height:1.6}',
        '.hg-top-tabs,.hg-grid,.hg-resource-list{grid-template-columns:1fr}',
        '.hg-top-tab{height:54px;font-size:15px}',
        '.hg-top-tab-label{text-shadow:-0.5px 0 0 #000,0.5px 0 0 #000,0 -0.5px 0 #000,0 0.5px 0 #000}',
        '.hg-result{padding:14px}',
        '.hg-result h3{font-size:18px}',
        '.hg-resource-item{padding:11px 12px}',
        '.hg-resource-name{font-size:13px}',
        '.hg-resource-value{font-size:16px}',
        '.hg-detail-title{font-size:14px}',
        '.hg-detail-table-wrap{display:none}',
        '.hg-detail-mobile-head{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:10px}',
        '.hg-detail-mobile-head-item{display:flex;align-items:center;justify-content:flex-start;padding:8px 10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;min-width:0}',
        '.hg-detail-mobile-cards{display:block}',
        '.hg-slot-grid{grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}',
        '.hg-slot-card{padding:8px 6px 10px;min-height:112px}',
        '.hg-slot-thumb-wrap{gap:6px}',
        '.hg-slot-thumb{width:40px;height:40px;border-radius:10px}',
        '.hg-slot-type{min-height:20px;padding:0 6px;font-size:10px}',
        '.hg-slot-check{width:18px;height:18px;margin-top:2px}',
        '.hg-inline-resource-text{font-size:11px}',
        '.hg-detail-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '}',
      '@media (max-width:390px){',
        '.hg-slot-grid{gap:6px}',
        '.hg-slot-card{padding:6px 4px 8px;min-height:104px}',
        '.hg-slot-thumb{width:36px;height:36px}',
        '.hg-slot-type{font-size:9px;padding:0 5px}',
        '.hg-slot-check{width:16px;height:16px}',
        '.hg-detail-card-item{padding:8px}',
        '.hg-detail-card-item-value{font-size:14px}',
        '.hg-page-title{font-size:22px}',
      '}'
    ].join('');
    document.head.appendChild(style);
  }

  function buildCalculatorHTML() {
    var TAB_META = buildTabMeta();
    var initialRange = TAB_META.normal;

    return [
      '<section class="hg-calc">',
        '<div class="hg-head">',
          '<h2 class="hg-page-title">', escapeHtml(getMessage('page.title')), '</h2>',
          '<p class="hg-page-desc">', escapeHtml(getMessage('page.description')), '</p>',
        '</div>',

        '<div class="hg-top-tabs" data-hg-top-tabs>',
          buildTabsHTML(),
        '</div>',

        '<div class="hg-slot-grid">',
          buildSlotCardsHTML(),
        '</div>',

        '<div class="hg-grid">',
          '<div class="hg-field">',
            '<label for="hg-start-stage">', escapeHtml(getMessage('form.currentStage')), '</label>',
            '<select id="hg-start-stage" data-hg-start-stage>',
              buildStageOptions(initialRange.min, initialRange.max, initialRange.min),
            '</select>',
          '</div>',
          '<div class="hg-field">',
            '<label for="hg-target-stage">', escapeHtml(getMessage('form.targetStage')), '</label>',
            '<select id="hg-target-stage" data-hg-target-stage>',
              buildStageOptions(initialRange.min, initialRange.max, initialRange.max),
            '</select>',
          '</div>',
        '</div>',

        '<div class="hg-result">',
          '<h3 data-hg-result-title>', escapeHtml(getMessage('result.title')), '</h3>',
          '<div class="hg-empty" data-hg-empty>', escapeHtml(getMessage('messages.emptyDefault')), '</div>',
          '<div class="hg-resource-list" data-hg-result-body></div>',

          '<div class="hg-detail-wrap" data-hg-detail-wrap style="display:none;">',
            '<h4 class="hg-detail-title">', escapeHtml(getMessage('result.detailTitle')), '</h4>',
            '<div class="hg-detail-mobile-head" data-hg-detail-mobile-head></div>',
            '<div class="hg-detail-table-wrap">',
              '<table class="hg-detail-table">',
                '<thead data-hg-detail-head></thead>',
                '<tbody data-hg-detail-body></tbody>',
                '<tfoot data-hg-detail-foot></tfoot>',
              '</table>',
            '</div>',
            '<div class="hg-detail-mobile-cards" data-hg-detail-cards></div>',
          '</div>',
        '</div>',
      '</section>'
    ].join('');
  }

  function rerender(root, data) {
    var form = readForm(root);
    var error = validateForm(form);

    if (error) {
      showEmpty(root, error);
      return;
    }

    var result = calculateByTab(form, data);
    renderResult(root, form, result);
  }

  function updateStageSelectsByTab(root) {
    var tab = getActiveTab(root);
    var range = getStageRangeByTab(tab);
    var startEl = root.querySelector('[data-hg-start-stage]');
    var targetEl = root.querySelector('[data-hg-target-stage]');

    if (!startEl || !targetEl) return;

    var nextStart = range.min;
    var nextTarget = range.max;

    if (tab === 'temper') {
      nextStart = 100;
      nextTarget = 200;
    } else if (tab === 'mastery') {
      nextStart = 0;
      nextTarget = 20;
    } else {
      nextStart = 0;
      nextTarget = 100;
    }

    startEl.innerHTML = buildStageOptions(range.min, range.max, nextStart);
    targetEl.innerHTML = buildStageOptions(range.min, range.max, nextTarget);
  }

  function bindInteractions(root) {
    Array.prototype.slice.call(root.querySelectorAll('.hg-slot-card')).forEach(function (card) {
      card.addEventListener('click', function () {
        card.classList.toggle('is-active');
        rerender(root, state.data);
      });
    });

    Array.prototype.slice.call(root.querySelectorAll('.hg-top-tab')).forEach(function (tabBtn) {
      tabBtn.addEventListener('click', function () {
        Array.prototype.slice.call(root.querySelectorAll('.hg-top-tab')).forEach(function (item) {
          item.classList.remove('is-active');
        });
        tabBtn.classList.add('is-active');
        updateStageSelectsByTab(root);
        rerender(root, state.data);
      });
    });

    var startEl = root.querySelector('[data-hg-start-stage]');
    var targetEl = root.querySelector('[data-hg-target-stage]');

    if (startEl) {
      startEl.addEventListener('change', function () {
        rerender(root, state.data);
      });
    }

    if (targetEl) {
      targetEl.addEventListener('change', function () {
        rerender(root, state.data);
      });
    }
  }

  function fetchJson(url) {
    return fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('JSON load failed: ' + response.status + ' ' + response.statusText);
      }
      return response.json();
    });
  }

  function loadI18n(options) {
    if (options && options.i18n) {
      return Promise.resolve(deepMerge(DEFAULT_I18N, options.i18n));
    }

    var lang = (options && options.lang) || state.lang;
    var url = (options && options.i18nUrl) || I18N_URL_TEMPLATE.replace('{lang}', lang);

    return fetchJson(url)
      .then(function (json) {
        return deepMerge(DEFAULT_I18N, json || {});
      })
      .catch(function () {
        return DEFAULT_I18N;
      });
  }

  function loadCalculatorData(options) {
    if (options && options.data) {
      return Promise.resolve(options.data);
    }

    if (window.HERO_GEAR_CALC_DATA && window.HERO_GEAR_CALC_DATA.heroGear) {
      return Promise.resolve(window.HERO_GEAR_CALC_DATA);
    }

    return fetchJson((options && options.dataUrl) || DATA_URL).then(function (json) {
      window.HERO_GEAR_CALC_DATA = json;
      return json;
    });
  }

  function mountCalculator(root) {
    root.innerHTML = buildCalculatorHTML();
    bindInteractions(root);
    showLoading(root);
  }

  function hidePageHeaderNav() {
    var selectors = [
      '.breadcrumb',
      '.section-tabs',
      '.page-tabs',
      '.calculator-nav',
      '.subnav',
      '.page-subnav',
      '.hero-tabs',
      '.sticky-tabs',
      '.section-tabs-wrap',
      '.calculator-header-nav',
      '.calculator-breadcrumb'
    ];

    selectors.forEach(function (selector) {
      Array.prototype.slice.call(document.querySelectorAll(selector)).forEach(function (el) {
        el.style.display = 'none';
      });
    });
  }

  function initHeroGearCalculator(options) {
    var opts = options || {};
    var root = typeof opts.root === 'string' ? document.querySelector(opts.root) : opts.root;
    if (!root) return;

    state.root = root;
    state.lang = opts.lang || getLangFromDom();

    injectStyles();
    hidePageHeaderNav();

    Promise.all([
      loadI18n(opts),
      loadCalculatorData(opts).catch(function () {
        return DEFAULT_DATA;
      })
    ]).then(function (results) {
      state.messages = results[0] || DEFAULT_I18N;
      state.data = results[1] || DEFAULT_DATA;

      updatePageMeta();
      updateBreadcrumbs();
      mountCalculator(root);
      rerender(root, state.data);
    }).catch(function () {
      state.messages = DEFAULT_I18N;
      state.data = DEFAULT_DATA;
      updatePageMeta();
      updateBreadcrumbs();
      mountCalculator(root);
      showEmpty(root, getMessage('messages.loadError'));
    });
  }

  window.initHeroGearCalculator = initHeroGearCalculator;
})();
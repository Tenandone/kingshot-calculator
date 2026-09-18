(function () {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function langInfo() {
    var raw = String((window.I18N && window.I18N.current) || document.documentElement.lang || window.__STATIC_LANG || 'ko').toLowerCase();
    if (raw.indexOf('zh') === 0) return { code: 'zh-TW', folder: 'zh-tw' };
    if (raw.indexOf('ja') === 0) return { code: 'ja', folder: 'ja' };
    if (raw.indexOf('en') === 0) return { code: 'en', folder: 'en' };
    return { code: 'ko', folder: 'ko' };
  }

  function installStyles() {
    if (document.getElementById('research-page-style')) return;
    var style = document.createElement('style');
    style.id = 'research-page-style';
    style.textContent = [
      '.research-shell{max-width:1040px;margin:0 auto}',
      '.research-intro{text-align:center;max-width:780px;margin:0 auto 24px}',
      '.research-branches{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}',
      '.research-branch{display:block;padding:20px;border:1px solid var(--line,#d7dce2);border-radius:8px;background:var(--panel,#fff);color:inherit;text-decoration:none;text-align:center}',
      '.research-branch:hover{border-color:var(--accent,#2563eb);transform:translateY(-1px)}',
      '.research-branch h2{margin:0 0 8px;font-size:21px}.research-branch p{margin:0;line-height:1.65}',
      '.research-facts{display:grid;grid-template-columns:minmax(130px,max-content) minmax(0,1fr);max-width:720px;margin:18px auto;border:1px solid var(--line,#d7dce2);border-radius:8px;overflow:hidden}',
      '.research-facts dt,.research-facts dd{margin:0;padding:11px 14px;border-bottom:1px solid var(--line,#d7dce2)}',
      '.research-facts dt{font-weight:800;background:rgba(127,127,127,.08)}',
      '.research-toolbar{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:22px 0}',
      '.research-toolbar input{width:min(100%,340px);min-height:42px;padding:8px 12px;border:1px solid var(--line,#d7dce2);border-radius:6px;background:var(--panel,#fff);color:inherit}',
      '.research-filter{min-height:42px;padding:8px 12px;border:1px solid var(--line,#d7dce2);border-radius:6px;background:var(--panel,#fff);color:inherit;cursor:pointer}',
      '.research-filter[aria-pressed="true"]{border-color:var(--accent,#2563eb);background:rgba(37,99,235,.1)}',
      '.research-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;list-style:none;padding:0;margin:0}',
      '.research-record{min-width:0;padding:13px;border:1px solid var(--line,#d7dce2);border-radius:7px;background:var(--panel,#fff)}',
      '.research-record strong{display:block;overflow-wrap:anywhere}.research-record span{display:block;margin-top:5px;font-size:13px;color:var(--muted,#667085)}',
      '.research-note,.research-sources{max-width:760px;margin:22px auto;text-align:left;line-height:1.7}',
      '.research-related{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}.research-related a{padding:8px 11px;border:1px solid var(--line,#d7dce2);border-radius:6px}',
      '@media(max-width:760px){.research-branches{grid-template-columns:1fr}.research-list{grid-template-columns:repeat(2,minmax(0,1fr))}.research-facts{grid-template-columns:1fr}.research-facts dt{border-bottom:0}}',
      '@media(max-width:460px){.research-list{grid-template-columns:1fr}.research-branch{padding:16px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function sourceList(data) {
    var labels = {
      gameDataBook: 'GameDataBook',
      optimizerAcademy: 'Kingshot Optimizer',
      optimizerAdvanced: 'Kingshot Optimizer',
      kingshotNetAdvanced: 'Kingshot.net'
    };
    return Object.keys(data.sources || {}).map(function (key) {
      return '<li><a href="' + esc(data.sources[key]) + '" target="_blank" rel="nofollow noopener">' + esc(labels[key] || key) + '</a></li>';
    }).join('');
  }

  function renderIndex(root, data, copy) {
    root.innerHTML = '<div class="research-shell"><div class="research-intro"><h1>' + esc(copy.title) + '</h1><p>' + esc(copy.intro) + '</p></div><div class="research-branches">' +
      '<a class="research-branch" href="/research/academy"><h2>' + esc(copy.academyTitle) + '</h2><p>' + esc(copy.academySummary) + '</p></a>' +
      '<a class="research-branch" href="/research/advanced-truegold"><h2>' + esc(copy.advancedTitle) + '</h2><p>' + esc(copy.advancedSummary) + '</p></a>' +
      '</div><h2>' + esc(copy.verification) + '</h2><p class="research-note">' + esc(copy.verificationText) + '</p></div>';
  }

  function renderBranch(root, data, copy, branch) {
    var isAcademy = branch === 'academy';
    var records = isAcademy ? data.academy : data.advancedWarAcademy;
    var title = isAcademy ? copy.academyTitle : copy.advancedTitle;
    var summary = isAcademy ? copy.academySummary : copy.advancedSummary;
    var categories = isAcademy ? ['all', 'growth', 'economy', 'battle'] : ['all'];
    var facts = [
      [copy.recordCount, records.length],
      [copy.categories, isAcademy ? [copy.growth, copy.economy, copy.battle].join(' / ') : copy.advanced],
      [copy.verifiedFields, copy.verifiedFieldsValue],
      [copy.lastVerified, data.verifiedAt]
    ];
    root.innerHTML = '<article class="research-shell"><div class="research-intro"><p><a href="/research">' + esc(copy.title) + '</a></p><h1>' + esc(title) + '</h1><p>' + esc(summary) + '</p></div><h2>' + esc(copy.quickFacts) + '</h2><dl class="research-facts">' + facts.map(function (row) {
      return '<dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd>';
    }).join('') + '</dl><div class="research-toolbar"><input id="research-search" type="search" placeholder="' + esc(copy.search) + '" aria-label="' + esc(copy.search) + '">' + categories.map(function (category, index) {
      return '<button class="research-filter" type="button" data-category="' + category + '" aria-pressed="' + (index === 0 ? 'true' : 'false') + '">' + esc(copy[category]) + '</button>';
    }).join('') + '</div><ul id="research-list" class="research-list"></ul><p id="research-empty" class="research-note" hidden>' + esc(copy.noResults) + '</p><h2>' + esc(copy.verification) + '</h2><p class="research-note">' + esc(copy.verificationText) + '</p><ul class="research-sources">' + sourceList(data) + '</ul><h2>' + esc(copy.related) + '</h2><div class="research-related"><a href="/waracademy">' + esc(copy.warAcademy) + '</a><a href="/' + langInfo().folder + '/guides/truegold.html" data-router-ignore="true">' + esc(copy.truegoldGuide) + '</a></div></article>';

    var list = root.querySelector('#research-list');
    var empty = root.querySelector('#research-empty');
    var input = root.querySelector('#research-search');
    var activeCategory = 'all';
    function draw() {
      var query = String(input.value || '').trim().toLowerCase();
      var filtered = records.filter(function (record) {
        return (!isAcademy || activeCategory === 'all' || record.category === activeCategory) && (!query || record.name.toLowerCase().indexOf(query) !== -1);
      });
      list.innerHTML = filtered.map(function (record) {
        var category = isAcademy ? (copy[record.category] || record.category) : copy.advanced;
        return '<li class="research-record"><strong>' + esc(record.name) + '</strong><span>' + esc(category) + ' · ' + esc(copy.maxLevel) + ' ' + esc(record.maxLevel) + '</span></li>';
      }).join('');
      empty.hidden = filtered.length !== 0;
    }
    input.addEventListener('input', draw);
    root.querySelectorAll('.research-filter').forEach(function (button) {
      button.addEventListener('click', function () {
        activeCategory = button.getAttribute('data-category') || 'all';
        root.querySelectorAll('.research-filter').forEach(function (item) { item.setAttribute('aria-pressed', item === button ? 'true' : 'false'); });
        draw();
      });
    });
    draw();
  }

  window.initResearch = async function initResearch(slug) {
    var root = document.getElementById('research-root');
    if (!root) return;
    installStyles();
    var lang = langInfo();
    try {
      var responses = await Promise.all([
        fetch('/data/research.json', { cache: 'no-store' }),
        fetch('/i18n/' + lang.code + '/research.json', { cache: 'no-store' })
      ]);
      if (!responses[0].ok || !responses[1].ok) throw new Error('Research data request failed');
      var values = await Promise.all(responses.map(function (response) { return response.json(); }));
      var cleanSlug = String(slug || '').replace(/^\/+|\/+$/g, '');
      if (!cleanSlug) renderIndex(root, values[0], values[1]);
      else if (cleanSlug === 'academy' || cleanSlug === 'advanced-truegold') renderBranch(root, values[0], values[1], cleanSlug);
      else throw new Error('Research branch not found: ' + cleanSlug);
    } catch (error) {
      console.error('[research]', error);
      root.innerHTML = '<div class="error">Unable to load research data.</div>';
    }
  };
})();

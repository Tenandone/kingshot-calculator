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
    if (document.getElementById('items-page-style')) return;
    var style = document.createElement('style');
    style.id = 'items-page-style';
    style.textContent = [
      '.items-shell{max-width:980px;margin:0 auto}.items-intro{text-align:center;max-width:760px;margin:0 auto 24px}',
      '.items-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}',
      '.item-card{display:block;border:1px solid var(--line,#d7dce2);border-radius:8px;padding:18px;color:inherit;text-decoration:none;background:var(--panel,#fff)}',
      '.item-card:hover{border-color:var(--accent,#2563eb);transform:translateY(-1px)}.item-card h2{font-size:20px;margin:0 0 8px}.item-card p{margin:0;line-height:1.65}',
      '.item-detail{text-align:center;max-width:860px;margin:0 auto}.item-detail>p{line-height:1.75}',
      '.item-facts{display:grid;grid-template-columns:minmax(130px,max-content) minmax(0,1fr);max-width:720px;margin:18px auto;border:1px solid var(--line,#d7dce2);border-radius:8px;overflow:hidden;text-align:left}',
      '.item-facts dt,.item-facts dd{margin:0;padding:11px 14px;border-bottom:1px solid var(--line,#d7dce2)}.item-facts dt{font-weight:800;background:rgba(127,127,127,.08)}',
      '.item-related{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}.item-related a{padding:8px 11px;border:1px solid var(--line,#d7dce2);border-radius:6px}',
      '.item-sources{max-width:720px;margin:12px auto;text-align:left}',
      '@media(max-width:700px){.items-grid{grid-template-columns:1fr}.item-facts{grid-template-columns:1fr}.item-facts dt{border-bottom:0}.item-card{padding:15px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function relatedLinks(item, copy, lang) {
    var links = [];
    (item.relatedResearch || []).forEach(function (slug) {
      links.push(['/research/' + slug, copy.records[item.slug].title + ' Research']);
    });
    (item.relatedEvents || []).forEach(function (slug) {
      links.push(['/events/' + slug, slug.replace(/-/g, ' ')]);
    });
    (item.relatedGuides || []).forEach(function (slug) {
      links.push(['/' + lang.folder + '/guides/' + slug + '.html', slug.replace(/-/g, ' '), true]);
    });
    (item.relatedBuildings || []).forEach(function (slug) {
      if (slug === 'war-academy') links.push(['/waracademy', 'War Academy']);
      else links.push(['/' + lang.folder + '/buildings/' + slug + '.html', slug.replace(/-/g, ' '), true]);
    });
    (item.relatedPages || []).forEach(function (slug) {
      if (slug === 'heroes') links.push(['/heroes', 'Heroes']);
      if (slug === 'hero-gear-calculator') links.push(['/' + lang.folder + '/calculators/hero-gear-calculator.html', 'Hero Gear Calculator', true]);
      if (slug === 'mastery-forging') links.push(['/' + lang.folder + '/database/mastery-forging.html', 'Mastery Forging', true]);
    });
    return links.map(function (link) {
      return '<a href="' + esc(link[0]) + '"' + (link[2] ? ' data-router-ignore="true"' : '') + '>' + esc(link[1]) + '</a>';
    }).join('');
  }

  function renderList(root, data, copy) {
    root.innerHTML = '<div class="items-shell"><div class="items-intro"><h1>' + esc(copy.title) + '</h1><p>' + esc(copy.intro) + '</p></div><div class="items-grid">' + data.items.map(function (item) {
      var text = copy.records[item.slug] || {};
      return '<a class="item-card" href="/items/' + encodeURIComponent(item.slug) + '"><h2>' + esc(text.title || item.slug) + '</h2><p>' + esc(text.summary || '') + '</p></a>';
    }).join('') + '</div></div>';
  }

  function renderDetail(root, item, data, copy, lang) {
    var labels = copy.labels || {};
    var text = copy.records[item.slug] || {};
    var sources = (item.sources || []).map(function (source) {
      return '<li><a href="' + esc(source.url) + '" target="_blank" rel="nofollow noopener">' + esc(source.name) + '</a></li>';
    }).join('');
    root.innerHTML = '<article class="item-detail"><p><a href="/items">' + esc(labels.back || copy.title) + '</a></p><h1>' + esc(text.title || item.slug) + '</h1><p>' + esc(text.summary || '') + '</p><h2>' + esc(labels.quickFacts) + '</h2><dl class="item-facts"><dt>' + esc(labels.category) + '</dt><dd>' + esc((copy.categories || {})[item.category] || item.category) + '</dd><dt>' + esc(labels.purpose) + '</dt><dd>' + esc(text.purpose || '') + '</dd><dt>' + esc(labels.acquisition) + '</dt><dd>' + esc(text.acquisition || '') + '</dd><dt>' + esc(labels.lastVerified) + '</dt><dd>' + esc(data.verifiedAt) + '</dd></dl><h2>' + esc(labels.related) + '</h2><div class="item-related">' + relatedLinks(item, copy, lang) + '</div><h2>' + esc(labels.sources) + '</h2><ul class="item-sources">' + sources + '</ul></article>';
  }

  window.initItems = async function initItems(slug) {
    var root = document.getElementById('items-root');
    if (!root) return;
    installStyles();
    var lang = langInfo();
    try {
      var responses = await Promise.all([
        fetch('/data/items.json', { cache: 'no-store' }),
        fetch('/i18n/' + lang.code + '/items.json', { cache: 'no-store' })
      ]);
      if (!responses[0].ok || !responses[1].ok) throw new Error('Item data request failed');
      var values = await Promise.all(responses.map(function (response) { return response.json(); }));
      var cleanSlug = String(slug || '').replace(/^\/+|\/+$/g, '');
      if (!cleanSlug) renderList(root, values[0], values[1]);
      else {
        var item = values[0].items.find(function (entry) { return entry.slug === cleanSlug; });
        if (!item) throw new Error('Item not found: ' + cleanSlug);
        renderDetail(root, item, values[0], values[1], lang);
      }
    } catch (error) {
      console.error('[items]', error);
      root.innerHTML = '<div class="error">Unable to load item data.</div>';
    }
  };
})();

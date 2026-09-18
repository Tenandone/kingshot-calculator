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

  function eventCopy(dictionary, slug) {
    return dictionary && dictionary.records && dictionary.records[slug] ? dictionary.records[slug] : {};
  }

  function duration(event, labels) {
    if (event.durationDays) return event.durationDays + ' ' + (labels.days || 'days');
    if (event.durationHours) return event.durationHours + ' ' + (labels.hours || 'hours');
    return '';
  }

  function installStyles() {
    if (document.getElementById('events-page-style')) return;
    var style = document.createElement('style');
    style.id = 'events-page-style';
    style.textContent = [
      '.events-shell{max-width:980px;margin:0 auto}',
      '.events-intro{text-align:center;max-width:760px;margin:0 auto 24px}',
      '.events-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}',
      '.event-card{display:block;border:1px solid var(--line,#d7dce2);border-radius:8px;padding:18px;color:inherit;text-decoration:none;background:var(--panel,#fff)}',
      '.event-card:hover{border-color:var(--accent,#2563eb);transform:translateY(-1px)}',
      '.event-card h2{font-size:20px;margin:0 0 8px}.event-card p{margin:0;line-height:1.65}',
      '.event-facts{display:grid;grid-template-columns:minmax(120px,max-content) minmax(0,1fr);gap:0;max-width:680px;margin:18px auto;border:1px solid var(--line,#d7dce2);border-radius:8px;overflow:hidden}',
      '.event-facts dt,.event-facts dd{margin:0;padding:11px 14px;border-bottom:1px solid var(--line,#d7dce2)}',
      '.event-facts dt{font-weight:800;background:rgba(127,127,127,.08)}',
      '.event-detail{text-align:center;max-width:860px;margin:0 auto}.event-detail>p{line-height:1.75}',
      '.event-related{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}.event-related a{padding:7px 10px;border:1px solid var(--line,#d7dce2);border-radius:6px}',
      '.event-sources{max-width:720px;margin:12px auto;text-align:left}',
      '@media(max-width:700px){.events-grid{grid-template-columns:1fr}.event-facts{grid-template-columns:1fr}.event-facts dt{border-bottom:0}.event-card{padding:15px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function renderLinks(slugs, events, dictionary) {
    var known = new Set(events.map(function (event) { return event.slug; }));
    return (slugs || []).filter(function (slug) { return known.has(slug); }).map(function (slug) {
      var copy = eventCopy(dictionary, slug);
      return '<a href="/events/' + encodeURIComponent(slug) + '">' + esc(copy.title || slug) + '</a>';
    }).join('');
  }

  function renderList(root, data, dictionary) {
    root.innerHTML = '<div class="events-shell"><div class="events-intro"><h1>' + esc(dictionary.title || 'Kingshot Events') + '</h1><p>' + esc(dictionary.intro || '') + '</p></div><div class="events-grid">' + data.events.map(function (event) {
      var copy = eventCopy(dictionary, event.slug);
      return '<a class="event-card" href="/events/' + encodeURIComponent(event.slug) + '"><h2>' + esc(copy.title || event.slug) + '</h2><p>' + esc(copy.summary || '') + '</p></a>';
    }).join('') + '</div></div>';
  }

  function renderDetail(root, event, data, dictionary, heroDictionary, lang) {
    var labels = dictionary.labels || {};
    var copy = eventCopy(dictionary, event.slug);
    var facts = [
      [labels.type || 'Event type', (dictionary.types || {})[event.type] || event.type],
      [labels.duration || 'Duration', duration(event, labels)],
      [labels.recurrence || 'Recurrence', (dictionary.recurrence || {})[event.recurrence] || ''],
      [labels.unlock || 'Unlock', (dictionary.unlock || {})[event.unlock] || ''],
      [labels.lastVerified || 'Last verified', data.verifiedAt || '']
    ].filter(function (row) { return row[1]; });
    var relatedEvents = renderLinks(event.relatedEvents, data.events, dictionary);
    var relatedHeroes = (event.relatedHeroes || []).map(function (slug) {
      var title = heroDictionary['heroes.card.' + slug + '.title'] || slug;
      return '<a href="/hero/' + encodeURIComponent(slug) + '">' + esc(title) + '</a>';
    }).join('');
    var relatedGuides = (event.relatedGuides || []).map(function (slug) {
      return '<a href="/' + lang.folder + '/guides/' + encodeURIComponent(slug) + '.html">' + esc(copy.title || event.slug) + '</a>';
    }).join('');
    var sources = (event.sources || []).map(function (source) {
      return '<li><a href="' + esc(source.url) + '" target="_blank" rel="nofollow noopener">' + esc(source.name) + '</a></li>';
    }).join('');

    root.innerHTML = '<article class="event-detail"><p><a href="/events">' + esc(dictionary.title || 'Kingshot Events') + '</a></p><h1>' + esc(copy.title || event.slug) + '</h1><p>' + esc(copy.summary || '') + '</p><h2>' + esc(labels.quickFacts || 'Quick Facts') + '</h2><dl class="event-facts">' + facts.map(function (row) {
      return '<dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd>';
    }).join('') + '</dl>' + (copy.answerTitle && copy.answer ? '<h2>' + esc(copy.answerTitle) + '</h2><p>' + esc(copy.answer) + '</p>' : '') + (relatedEvents ? '<h2>' + esc(labels.relatedEvents || 'Related events') + '</h2><div class="event-related">' + relatedEvents + '</div>' : '') + (relatedHeroes ? '<h2>' + esc(labels.relatedHeroes || 'Related heroes') + '</h2><div class="event-related">' + relatedHeroes + '</div>' : '') + (relatedGuides ? '<h2>' + esc(labels.relatedGuides || 'Related guides') + '</h2><div class="event-related">' + relatedGuides + '</div>' : '') + '<h2>' + esc(labels.verification || 'Data verification') + '</h2><p>' + esc(labels.crossVerified || 'Cross-verified') + ' · ' + esc(data.verifiedAt || '') + '</p><ul class="event-sources">' + sources + '</ul></article>';
  }

  window.initEvents = async function initEvents(slug) {
    var root = document.getElementById('events-root');
    if (!root) return;
    installStyles();
    var lang = langInfo();
    try {
      var responses = await Promise.all([
        fetch('/data/events.json', { cache: 'no-store' }),
        fetch('/i18n/' + lang.code + '/events.json', { cache: 'no-store' }),
        fetch('/i18n/' + lang.code + '/heroes.json', { cache: 'no-store' })
      ]);
      if (!responses[0].ok || !responses[1].ok) throw new Error('Event data request failed');
      var values = await Promise.all(responses.map(function (response) { return response.json(); }));
      var data = values[0];
      var dictionary = values[1];
      var heroDictionary = values[2];
      var cleanSlug = String(slug || '').replace(/^\/+|\/+$/g, '');
      if (!cleanSlug) renderList(root, data, dictionary);
      else {
        var event = data.events.find(function (item) { return item.slug === cleanSlug; });
        if (!event) throw new Error('Event not found: ' + cleanSlug);
        renderDetail(root, event, data, dictionary, heroDictionary, lang);
      }
    } catch (error) {
      console.error('[events]', error);
      root.innerHTML = '<div class="error">Unable to load event data.</div>';
    }
  };
})();

(function (window) {
  'use strict';
  if (window.KD_UI_BUILDING) return;
  var states = new WeakMap();
  function levelFrom(value) { var n = Number(value); return Number.isInteger(n) && n >= 1 && n <= 30 ? n : 1; }
  function enhance(root, locale) {
    var article = root && root.id === 'kd-building' ? root : root && root.querySelector('#kd-building');
    if (!article || (locale && article.dataset.locale !== locale)) return;
    if (states.has(article)) { states.get(article).restore(false); return; }
    var select = article.querySelector('#kd-building-level'), range = article.querySelector('#kd-building-level-range');
    if (!select || !range) return;
    var current = null;
    function update(level) {
      level = levelFrom(level);
      if (current === level) return;
      current = level; select.value = String(level); range.value = String(level);
      var row = article.querySelector('[data-kd-level="' + level + '"]');
      article.querySelectorAll('[data-kd-level]').forEach(function (item) {
        if (item === row) item.setAttribute('data-selected', 'true'); else item.removeAttribute('data-selected');
      });
      article.querySelector('#kd-building-current-level').textContent = 'Lv. ' + level;
      [['requirement', 'requirement'], ['time', 'constructionTime'], ['power', 'power'], ['wood', 'wood'], ['bread', 'bread'], ['stone', 'stone'], ['iron', 'iron']].forEach(function (pair) {
        var cell = row && row.querySelector('[data-kd-field="' + pair[1] + '"]'), output = article.querySelector('#kd-building-current-' + pair[0]);
        if (output) output.textContent = cell ? cell.textContent.trim() : '–';
      });
    }
    function restore(scroll) {
      var url = new URL(window.location.href); update(url.searchParams.get('level'));
      var anchor = url.hash.indexOf('#/') === 0 ? url.searchParams.get('section') : url.hash.slice(1);
      if (scroll !== false && anchor && ['requirements', 'truegold', 'overview', 'truegold-timeline', 'related', 'upgrade', 'overview-anchor'].indexOf(anchor) >= 0) {
        var target = article.querySelector('#' + anchor);
        if (target) target.scrollIntoView({ block: 'start' });
      }
    }
    function choose(value, push) {
      var level = levelFrom(value), url = new URL(window.location.href);
      url.searchParams.set('level', String(level));
      var state = Object.assign({}, window.history.state || {}, { kdBuilding: { locale: article.dataset.locale, level: level } });
      window.history[push ? 'pushState' : 'replaceState'](state, '', url.pathname + url.search + url.hash); update(level);
    }
    select.addEventListener('change', function () { choose(select.value, true); });
    range.addEventListener('input', function () { choose(range.value, false); });
    article.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[data-kd-anchor]');
      if (!link || !article.contains(link) || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var id = link.dataset.kdAnchor, target = article.querySelector('#' + id);
      if (!target) return;
      event.preventDefault(); event.stopPropagation();
      var url = new URL(window.location.href);
      if (url.hash.indexOf('#/') === 0) url.searchParams.set('section', id); else url.hash = id;
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    var state = { restore: restore };
    states.set(article, state);
    window.addEventListener('popstate', function () { if (article.isConnected) restore(); });
    window.addEventListener('hashchange', function () { if (article.isConnected) restore(); });
    restore();
  }
  window.KD_UI_BUILDING = { enhance: enhance };
})(window);

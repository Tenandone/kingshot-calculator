// js/pages/database.js — history 모드 + hero-exclusive-gear → widgets 리맵 + governor-charm SPA 경로 유지
(function () {
  'use strict';

  // =========================
  // 0) 네트워크 최적화 & 캐시 무효화
  // =========================
  var TTL_MS = 10 * 1000;

  function getV() {
    return (window.__V || 'now');
  }

  function appendVersion(u) {
    var V = getV();
    try {
      var url = new URL(String(u), location.origin);

      if (url.protocol === 'data:') return url.href;

      url.searchParams.set('v', V);

      if (url.origin === location.origin) {
        return url.pathname + url.search + url.hash;
      }
      return url.href;
    } catch (_) {
      var raw = String(u);
      var hashSplit = raw.split('#');
      var base = hashSplit[0];
      var hashPart = hashSplit[1];
      var qsSplit = base.split('?');
      var path = qsSplit[0];
      var qs = qsSplit[1];
      var params = new URLSearchParams(qs || '');
      params.set('v', V);
      return path + '?' + params.toString() + (hashPart ? '#' + hashPart : '');
    }
  }

  var MEMO = (window.__KSD_MEMO__ = window.__KSD_MEMO__ || new Map());

  function memoGet(key) {
    var hit = MEMO.get(key);
    if (!hit) return null;
    if (hit.v !== getV()) return null;
    if ((Date.now() - hit.ts) > TTL_MS) return null;
    return hit.p;
  }

  function memoSet(key, promise) {
    MEMO.set(key, { ts: Date.now(), v: getV(), p: promise });
    return promise;
  }

  function getText(url, opts) {
    opts = opts || {};
    var force = !!opts.force;
    var finalUrl = appendVersion(url);

    if (!force) {
      var cached = memoGet(finalUrl);
      if (cached) return cached;
    }

    var p = fetch(finalUrl, {
      cache: 'no-store',
      headers: {
        'cache-control': 'no-cache',
        'pragma': 'no-cache'
      }
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' @ ' + finalUrl);
      return r.text();
    });

    return memoSet(finalUrl, p);
  }

  // =========================
  // 1) i18n helpers
  // =========================
  function T(s, fb) {
    return (window.I18N && window.I18N.t) ? window.I18N.t(s, (fb != null ? fb : s)) : (fb != null ? fb : s);
  }

  async function ensureDbNamespace() {
    try {
      if (window.I18N && window.I18N.init) {
        await window.I18N.init({ namespaces: ['db'] });
      }
      if (window.I18N && window.I18N.loadNamespace) {
        await window.I18N.loadNamespace('db');
      } else if (window.I18N && window.I18N.loadNamespaces) {
        await window.I18N.loadNamespaces(['db']);
      }
    } catch (e) {
      console.debug('[db] i18n ensure namespace skipped', e);
    }
  }

  // =========================
  // 2) 병렬 풀 실행 헬퍼
  // =========================
  async function withPool(items, worker, limit) {
    limit = limit || 6;
    var q = items.map(function (v, i) { return { v: v, i: i }; });
    var running = [];
    var out = new Array(items.length);

    var runOne = function () {
      if (!q.length) return;
      var item = q.shift();
      var v = item.v;
      var i = item.i;

      var job = worker(v, i)
        .then(function (res) { out[i] = res; })
        .catch(function (err) {
          console.warn('[db] worker error', v, err);
          out[i] = null;
        })
        .finally(function () {
          var idx = running.indexOf(job);
          if (idx >= 0) running.splice(idx, 1);
          runOne();
        });

      running.push(job);
    };

    while (running.length < limit && q.length) runOne();
    while (running.length) await Promise.race(running);
    return out;
  }

  // =========================
  // 3) 경로/에셋
  // =========================
  var DB_BASE = '/pages/database/';
  function buildUrl(folder, file) {
    return appendVersion(DB_BASE + encodeURIComponent(folder) + '/' + file);
  }

  function resolveAsset(folder, src) {
    if (!src) return '';
    var s = String(src);
    if (/^(https?:|data:)/i.test(s)) return appendVersion(s).replace(/\s/g, '%20');
    if (s.indexOf('/') === 0) return appendVersion(s).replace(/\s/g, '%20');
    var rel = s.replace(/^\.?\//, '').replace(/\s/g, '%20');
    return buildUrl(folder, rel);
  }

  function mapFolder(folder) {
    return folder === 'hero-exclusive-gear' ? 'widgets' : folder;
  }

  // =========================
  // 4) 카드 목록 소스
  // =========================
  var INDEX_JSON = DB_BASE + 'index.json';

  var ITEMS_FALLBACK = [
    { folder: 'governor-gear',  category: 'db.governorGear.title' },
    { folder: 'governor-charm', category: 'db.governorCharm.title' },
    { folder: 'widgets',        category: 'db.widgets.title' },
    { folder: 'mastery-forging',category: 'db.masteryForging.title' },
    { folder: 'hero-shards',    category: 'db.heroShards.title' }
  ];

  var CANDIDATES = ['index.html', 'main.html', 'guide.html', 'list.html', 'README.html'];

  async function loadItems(opts) {
    opts = opts || {};
    var force = !!opts.force;

    try {
      var text = await getText(INDEX_JSON, { force: force });
      var j = JSON.parse(text);
      if (Array.isArray(j) && j.length) {
        return j
          .map(function (x) {
            return {
              folder: String(x.folder || '').trim(),
              category: String(x.category || '').trim() || 'db.widgets.title',
              directHref: String(x.directHref || '').trim()
            };
          })
          .filter(function (x) {
            return x.folder &&
              x.folder !== 'waracademy' &&
              x.folder !== 'hero-gear-enhancement-chart' &&
              x.folder !== 'max-levels';
          });
      }
    } catch (_) {}

    return ITEMS_FALLBACK.slice();
  }

  // =========================
  // 5) DOM 유틸
  // =========================
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]);
    });
  }

  function pickText(doc, sels) {
    var i, sel, n;
    for (i = 0; i < sels.length; i++) {
      sel = sels[i];
      n = doc.querySelector(sel);
      if (n && n.textContent && n.textContent.trim()) return n.textContent.trim();
    }
    return '';
  }

  function pickAttr(doc, sels, attr) {
    var i, sel, n, v;
    for (i = 0; i < sels.length; i++) {
      sel = sels[i];
      n = doc.querySelector(sel);
      v = n && n.getAttribute(attr);
      if (v) return v;
    }
    return '';
  }

  function extractMeta(doc, fallbackUrl) {
    var metaTitleNode = doc.querySelector('meta[name="db-title"]');
    var title =
      (metaTitleNode && metaTitleNode.content) ||
      pickText(doc, ['.page h1', '.building-page h1', 'h1', 'title']);

    var descNode = doc.querySelector('meta[name="description"]');
    var summary =
      (descNode && descNode.content) ||
      pickText(doc, ['.page p', '.building-page p', 'p']);

    var ogNode = doc.querySelector('meta[property="og:image"]');
    var image =
      (ogNode && ogNode.content) ||
      pickAttr(doc, ['.page img', '.building-page img', 'img'], 'src');

    return { title: title || '(제목 없음)', summary: summary || '', image: image || '', url: fallbackUrl };
  }

  // =========================
  // 6) 카드 템플릿
  // =========================
  var TITLE_FALLBACKS = {
    'db.heroGearEnhance.title': 'EXP'
  };

  var DESC_FALLBACKS = {};

  function card(it) {
    var img = it.image
      ? '<div class="card__media"><img src="' + esc(it.image) + '" alt="" loading="lazy" decoding="async"></div>'
      : '<div class="card__media"></div>';

    var href = it.directHref || ('/db/' + encodeURIComponent(mapFolder(it.folder)));
    var isKey =
      typeof it.title === 'string' &&
      /[A-Za-z0-9_.-]+\.[A-Za-z0-9_.-]+/.test(it.title);

    var titleText = T(it.title, TITLE_FALLBACKS[it.title] != null ? TITLE_FALLBACKS[it.title] : it.title);
    var descKey = it.desc || '';
    var descText = descKey
      ? T(descKey, DESC_FALLBACKS[descKey] != null ? DESC_FALLBACKS[descKey] : descKey)
      : (it.summary || '');

    return ''
      + '<a class="card card--db" href="' + href + '" data-folder="' + esc(it.folder) + '" aria-label="' + esc(titleText) + '">'
      +   img
      +   '<div class="card__body">'
      +     '<div class="card__title"' + (isKey ? ' data-i18n="' + esc(it.title) + '"' : '') + '>' + esc(titleText) + '</div>'
      +     (descText ? '<div class="card__subtitle"' + (descKey ? ' data-i18n="' + esc(descKey) + '"' : '') + '>' + esc(descText) + '</div>' : '')
      +   '</div>'
      + '</a>';
  }

  function getGrid() {
    var grid = document.getElementById('db-grid');
    if (grid) grid.classList.add('grid', 'category-grid');
    return grid;
  }

  function render(list) {
    var grid = getGrid();
    if (!grid) return;
    grid.innerHTML = list.map(card).join('');
    if (window.I18N && window.I18N.applyTo) I18N.applyTo(grid);
  }

  // =========================
  // 7) 목록 로드
  // =========================
  var _cache = [];
  var _lastRenderAt = 0;
  var _loading = null;

  function ttlExpired() {
    return (Date.now() - _lastRenderAt) > TTL_MS;
  }

  async function loadListAndRender(opts) {
    opts = opts || {};
    var force = !!opts.force;

    if (_loading) return _loading;

    if (!force && _cache.length && !ttlExpired()) {
      render(_cache);
      return;
    }

    _loading = (async function () {
      await ensureDbNamespace();

      var items = await loadItems({ force: force });
      var parser = new DOMParser();
      var keyRe = /[A-Za-z0-9_.-]+\.[A-Za-z0-9_.-]+/;

      var worker = async function (it) {
        var folderToLoad = mapFolder(it.folder);

        var i, file, url, text, doc, meta, fixedImage, title;
        for (i = 0; i < CANDIDATES.length; i++) {
          file = CANDIDATES[i];
          url = buildUrl(folderToLoad, file);
          try {
            text = await getText(url, { force: force || ttlExpired() });
            doc = parser.parseFromString(text, 'text/html');
            meta = extractMeta(doc, url);
            fixedImage = meta.image ? resolveAsset(folderToLoad, meta.image) : '';

            title =
              it.folder === 'hero-exclusive-gear'
                ? 'db.widgets.title'
                : keyRe.test(it.category)
                  ? it.category
                  : (meta.title || it.category);

            return {
              folder: it.folder,
              category: it.category,
              directHref: it.directHref,
              title: title,
              summary: meta.summary,
              image: fixedImage,
              url: meta.url
            };
          } catch (e) {
            console.debug('[db] fetch fail', url, e);
          }
        }

        return {
          folder: it.folder,
          category: it.category,
          directHref: it.directHref,
          title: it.folder === 'hero-exclusive-gear' ? 'db.widgets.title' : it.category,
          summary: '파일을 찾을 수 없습니다.',
          image: '',
          url: buildUrl(folderToLoad, 'index.html')
        };
      };

      var results = await withPool(items, worker, 6);
      _cache = results.filter(Boolean);
      _lastRenderAt = Date.now();
      render(_cache);
    })().finally(function () {
      _loading = null;
    });

    return _loading;
  }

  // =========================
  // 8) 초기화 + 이벤트 바인딩
  // =========================
  var _bound = false;

  async function initDatabase(opts) {
    opts = opts || {};

    if (!_bound) {
      document.addEventListener('i18n:changed', function () {
        _cache = [];
        _lastRenderAt = 0;
        loadListAndRender({ force: true });
      });

      window.addEventListener('popstate', function () { initDatabase(); });
      window.addEventListener('hashchange', function () { initDatabase(); });

      window.addEventListener('focus', function () { initDatabase(); });
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') initDatabase();
      });

      window.__dbRefresh = function (force) { return initDatabase({ force: force !== false }); };

      _bound = true;
    }

    return loadListAndRender(opts);
  }

  window.initDatabase = initDatabase;
})();
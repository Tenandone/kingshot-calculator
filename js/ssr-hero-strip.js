// /js/ssr-hero-strip.js
(function () {
  'use strict';

  var MOUNT_ID = 'ssrHeroStripMount';
  var HEROES_JSON = '/data/heroes.json';
  var reqId = 0;
  var observer = null;

  function getMount() {
    return document.getElementById(MOUNT_ID);
  }

  function normalizeText(v) {
    return v == null ? '' : String(v).trim();
  }

  function pickHeroName(hero) {
    return normalizeText(
      hero.nameKo ||
      hero.name_ko ||
      hero.nameKR ||
      hero.name_kr ||
      hero.nameEn ||
      hero.name_en ||
      hero.name ||
      hero.title ||
      'Hero'
    );
  }

  function pickHeroImage(hero) {
    return normalizeText(
      hero.image ||
      hero.imageUrl ||
      hero.image_url ||
      hero.thumb ||
      hero.thumbnail ||
      hero.portrait ||
      hero.avatar ||
      ''
    );
  }

  function pickHeroSlug(hero) {
    return normalizeText(
      hero.slug ||
      hero.id ||
      hero.key ||
      ''
    );
  }

  function hasGeneration(hero) {
    if (!hero) return false;
    if (hero.generation === null || hero.generation === undefined) return false;

    var n = Number(hero.generation);
    return Number.isFinite(n) && n > 0;
  }

  function buildHeroHref(hero) {
    var slug = pickHeroSlug(hero);
    if (slug) return '/heroes/' + encodeURIComponent(slug);
    return '/heroes';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderEmpty(mount) {
    mount.innerHTML = '';
  }

  function buildStripHtml(ssrHeroes) {
    return ''
      + '<section class="ssr-hero-strip" aria-label="SSR Heroes">'
      +   ssrHeroes.map(function (hero, idx) {
            var name = pickHeroName(hero);
            var img = pickHeroImage(hero);
            var href = buildHeroHref(hero);
            var cls = idx === 0
              ? 'ssr-hero-strip__item is-featured'
              : 'ssr-hero-strip__item';

            return ''
              + '<a class="' + cls + '" href="' + escapeHtml(href) + '" aria-label="' + escapeHtml(name) + '">'
              +   '<img src="' + escapeHtml(img) + '" alt="' + escapeHtml(name) + '" loading="lazy" decoding="async" width="40" height="40">'
              + '</a>';
          }).join('')
      + '</section>';
  }

  async function loadSSRHeroStrip() {
    var mount = getMount();
    if (!mount) return;

    var currentReqId = ++reqId;

    try {
      var src = window.v ? window.v(HEROES_JSON) : HEROES_JSON;
      var res = await fetch(src, { cache: 'default' });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      var data = await res.json();

      if (currentReqId !== reqId) return;

      var heroes = Array.isArray(data)
        ? data
        : (Array.isArray(data && data.heroes) ? data.heroes : []);

      var ssrHeroes = heroes.filter(function (hero) {
        return hero && hasGeneration(hero) && pickHeroImage(hero);
      });

      if (!ssrHeroes.length) {
        renderEmpty(mount);
        return;
      }

      mount.innerHTML = buildStripHtml(ssrHeroes);
    } catch (_e) {
      if (currentReqId !== reqId) return;
      renderEmpty(mount);
    }
  }

  function scheduleSSRHeroStrip() {
    var mount = getMount();
    if (!mount) return;
    if (mount.dataset.heroStripLoaded === '1') return;

    if (!('IntersectionObserver' in window)) {
      mount.dataset.heroStripLoaded = '1';
      loadSSRHeroStrip();
      return;
    }

    if (observer) observer.disconnect();
    observer = new IntersectionObserver(function (entries) {
      if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
      observer.disconnect();
      observer = null;
      mount.dataset.heroStripLoaded = '1';
      loadSSRHeroStrip();
    }, { rootMargin: '160px 0px' });
    observer.observe(mount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleSSRHeroStrip);
  } else {
    scheduleSSRHeroStrip();
  }

  document.addEventListener('i18n:changed', function () {
    var mount = getMount();
    if (mount && mount.dataset.heroStripLoaded === '1') loadSSRHeroStrip();
    else scheduleSSRHeroStrip();
  });
})();

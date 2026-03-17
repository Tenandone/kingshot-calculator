/* footer-tools.js (FINAL SAFE+LOCK — KO: gift+Kakao / EN-JA-TW: gift+Discord / NO ADS) */
;(() => {
  'use strict';

  if (window.__KD_FOOTER_TOOLS_LOADED__) return;
  window.__KD_FOOTER_TOOLS_LOADED__ = true;

  function t(key, fallback) {
    try {
      return (window.I18N && typeof I18N.t === 'function')
        ? I18N.t(key, fallback)
        : (fallback || key);
    } catch (_e) {
      return fallback || key;
    }
  }

  function getLangSafe() {
    var raw =
      document.documentElement.getAttribute('lang') ||
      (window.I18N && I18N.current) ||
      localStorage.getItem('lang') ||
      'en';

    var low = String(raw).trim().toLowerCase();
    if (low === 'zh-tw' || low === 'tw' || low === 'zh_tw') return 'zh-TW';
    if (low.indexOf('zh') === 0) return 'zh-TW';
    if (low.indexOf('ko') === 0) return 'ko';
    if (low.indexOf('ja') === 0) return 'ja';
    return 'en';
  }

  function isForever(val) {
    if (!val) return true;
    var v = String(val).trim().toLowerCase();
    return [
      'permanent',
      'infinite',
      '∞',
      'forever',
      'no-expiry',
      'noexp',
      'nolimit'
    ].indexOf(v) !== -1;
  }

  function foreverText() {
    var lang = getLangSafe();
    if (lang === 'ko') return '무기한';
    if (lang === 'ja') return '無期限';
    if (lang === 'zh-TW') return '永久';
    return 'Permanent';
  }

  function fmtDate(yyyy_mm_dd) {
    if (isForever(yyyy_mm_dd)) return foreverText();

    try {
      var s = String(yyyy_mm_dd).trim();
      var d = new Date(s + 'T00:00:00Z');
      if (isNaN(d)) return s;

      var lang = getLangSafe();
      return new Intl.DateTimeFormat(lang, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        timeZone: 'UTC'
      }).format(d);
    } catch (_e) {
      return String(yyyy_mm_dd);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function iconGift() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v8a2 2 0 0 1-2 2h-5v-10h7zM11 22H6a2 2 0 0 1-2-2v-8h7v10zM21 8h-3.17A3 3 0 1 0 12 6a3 3 0 1 0-5.83 2H3a1 1 0 0 0 0 2h18a1 1 0 1 0 0-2Z"/></svg>';
  }

  function iconBubble() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C7.03 3 3 6.13 3 10c0 2.19 1.29 4.15 3.31 5.44L5.6 20.5c-.08.44.39.77.78.56l4.33-2.38c.42.05.85.08 1.29.08 4.97 0 9-3.13 9-7s-4.03-7-9-7z"/></svg>';
  }

  async function fetchCoupons(url) {
    try {
      var res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw 0;
      var data = await res.json();
      return Array.isArray(data && data.coupons) ? data.coupons.slice(0, 3) : [];
    } catch (_e) {
      return [];
    }
  }

  function isExpiredUTC(until) {
    if (isForever(until)) return false;
    return new Date() >= new Date(String(until).trim() + 'T00:00:00Z');
  }

  function getGiftLabel(lang) {
    if (lang === 'ko') return '기프트코드';
    return 'Gift Code';
  }

  function getCommunityLabel(lang) {
    if (lang === 'ko') return '카카오톡';
    return 'Discord';
  }

  function getGiftGuideHref(lang) {
    if (lang === 'ko') return '/ko/guides/kingshot-giftcode';
    if (lang === 'ja') return '/ja/guides/kingshot-giftcode';
    if (lang === 'zh-TW') return '/zh-tw/guides/kingshot-giftcode';
    return '/en/guides/kingshot-giftcode';
  }

  function getCommunityHref(lang) {
    if (lang === 'ko') return 'https://open.kakao.com/o/gHPnO4uh';
    return 'https://discord.gg/vgzASAwx';
  }

  async function renderInto(container, opts) {
    opts = opts || {};
    if (!container) return;

    if (!opts.force) {
      if (container.dataset.footerToolsRendered === '1') return;
      container.dataset.footerToolsRendered = '1';
    }

    container.innerHTML = '';

    var lang = getLangSafe();

    var couponWrap = document.createElement('div');
    couponWrap.className = 'footer-coupons';

    var coupons = await fetchCoupons('/data/coupons.json?v=' + Date.now());

    if (!coupons.length) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = t('footer.coupons.empty', 'No active coupons at the moment.');
      couponWrap.appendChild(empty);
    } else {
      coupons.forEach(function (c) {
        var d = document.createElement('div');
        d.className = 'footer-coupon' + (isExpiredUTC(c.until) ? ' expired' : '');
        d.innerHTML =
          '<span class="code">' + escapeHtml(c.code) + '</span>' +
          '<span class="until">' + escapeHtml(fmtDate(c.until)) + '</span>';
        couponWrap.appendChild(d);
      });
    }

    var ctas = document.createElement('div');
    ctas.className = 'footer-ctas';
    ctas.innerHTML =
      '<a class="footer-cta footer-cta-gift" href="' + getGiftGuideHref(lang) + '" target="_blank" rel="noopener">' +
        iconGift() +
        '<strong>' + escapeHtml(getGiftLabel(lang)) + '</strong>' +
      '</a>' +
      '<a class="footer-cta footer-cta-community" href="' + getCommunityHref(lang) + '" target="_blank" rel="noopener noreferrer">' +
        iconBubble() +
        '<strong>' + escapeHtml(getCommunityLabel(lang)) + '</strong>' +
      '</a>';

    var lootbar = document.createElement('div');
    lootbar.className = 'footer-image-banner';
    lootbar.innerHTML =
      '<a href="https://lootbar.gg/shop/ten/top-up/kingshot" target="_blank" rel="noopener noreferrer">' +
        '<img src="/img/lootbar.png" alt="Top-up Guide Banner" loading="lazy">' +
      '</a>';

    container.appendChild(couponWrap);
    container.appendChild(ctas);
    container.appendChild(lootbar);
  }

  async function renderFooterToolsAll(opts) {
    opts = opts || {};
    var containers = document.querySelectorAll('#footerTools');
    if (!containers || !containers.length) return;

    await Promise.all(Array.prototype.map.call(containers, function (c) {
      return renderInto(c, opts);
    }));
  }

  var _timer = null;
  var _token = 0;
  var _inflight = false;
  var _pendingForce = false;

  function scheduleRender(force) {
    if (force) _pendingForce = true;

    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(async function () {
      var myToken = ++_token;
      var doForce = _pendingForce;
      _pendingForce = false;

      if (_inflight) {
        scheduleRender(doForce);
        return;
      }

      _inflight = true;
      try {
        await renderFooterToolsAll({ force: doForce });
      } finally {
        _inflight = false;
      }

      if (myToken !== _token) {
        scheduleRender(true);
      }
    }, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      scheduleRender(false);
    }, { once: true });
  } else {
    scheduleRender(false);
  }

  document.addEventListener('i18n:changed', function () {
    scheduleRender(true);
  });
})();
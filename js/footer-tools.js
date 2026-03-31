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
    if (val == null) return false;

    var v = String(val).trim().toLowerCase();
    if (!v) return false;

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

  function iconDiscord() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 4.37A19.8 19.8 0 0 0 15.4 3a13.7 13.7 0 0 0-.63 1.3 18.4 18.4 0 0 0-5.54 0A13.7 13.7 0 0 0 8.6 3a19.8 19.8 0 0 0-4.9 1.37C.58 9.08-.26 13.67.16 18.2A19.9 19.9 0 0 0 6.2 21a14.7 14.7 0 0 0 1.3-2.12 12.9 12.9 0 0 1-2.04-.98c.17-.13.33-.27.49-.41a14.2 14.2 0 0 0 12.1 0c.16.14.32.28.49.41-.65.39-1.34.72-2.04.98.38.73.81 1.43 1.3 2.12a19.9 19.9 0 0 0 6.04-2.8c.5-5.24-.86-9.8-3.54-13.83ZM8.68 15.47c-1.18 0-2.15-1.08-2.15-2.4s.95-2.4 2.15-2.4c1.21 0 2.17 1.09 2.15 2.4 0 1.32-.95 2.4-2.15 2.4Zm6.64 0c-1.18 0-2.15-1.08-2.15-2.4s.95-2.4 2.15-2.4c1.21 0 2.17 1.09 2.15 2.4 0 1.32-.94 2.4-2.15 2.4Z"/></svg>';
  }

  function iconKakao() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4c-4.97 0-9 3.13-9 7 0 2.19 1.29 4.15 3.31 5.44l-.73 3.45c-.09.43.38.77.77.57l4.02-2.18c.53.07 1.07.11 1.63.11 4.97 0 9-3.13 9-7s-4.03-7-9-7z"/></svg>';
  }

  function parseExpiryMs(c) {
    if (!c) return null;

    var expiresAt = String(c.expiresAt || '').trim();
    if (expiresAt) {
      if (isForever(expiresAt)) return Infinity;
      var ts = Date.parse(expiresAt);
      if (Number.isFinite(ts)) return ts;
    }

    var until = String(c.until || '').trim();
    if (until) {
      if (isForever(until)) return Infinity;

      var p = until.split('-');
      if (p.length === 3) {
        var y = p[0];
        var m = String(p[1]).padStart(2, '0');
        var d = String(p[2]).padStart(2, '0');
        var ts2 = Date.parse(y + '-' + m + '-' + d + 'T00:00:00Z');
        if (Number.isFinite(ts2)) return ts2;
      }

      var ts3 = Date.parse(until);
      if (Number.isFinite(ts3)) return ts3;
    }

    return null;
  }

  function parseStartMs(c) {
    if (!c) return null;

    var startAt = String(c.startAt || '').trim();
    if (!startAt) return null;

    var ts = Date.parse(startAt);
    return Number.isFinite(ts) ? ts : null;
  }

  function isActiveCoupon(c, nowMs) {
    if (!c || !c.code) return false;

    var expMs = parseExpiryMs(c);
    if (expMs == null) return false;
    if (expMs !== Infinity && nowMs >= expMs) return false;

    var startMs = parseStartMs(c);
    if (startMs != null && nowMs < startMs) return false;

    return true;
  }

  function isExpiredCoupon(c, nowMs) {
    if (!c || !c.code) return false;

    var expMs = parseExpiryMs(c);
    if (expMs == null || expMs === Infinity) return false;

    return nowMs >= expMs;
  }

  function getStatusIcon(c, nowMs) {
    return isActiveCoupon(c, nowMs) ? '🟢' : '⚫';
  }

  function isPermanentCoupon(c) {
    if (!c) return false;
    if (c.until != null && isForever(c.until)) return true;
    if (c.expiresAt != null && isForever(c.expiresAt)) return true;
    return false;
  }

  function getCouponDisplayDate(c) {
    if (!c) return '';

    if (isPermanentCoupon(c)) return '♾️';

    if (c.until != null && String(c.until).trim()) {
      return fmtDate(c.until);
    }

    if (c.expiresAt != null && String(c.expiresAt).trim()) {
      try {
        var lang = getLangSafe();
        var d = new Date(String(c.expiresAt).trim());
        if (!isNaN(d)) {
          return new Intl.DateTimeFormat(lang, {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            timeZone: 'UTC'
          }).format(d);
        }
      } catch (_e) {}
      return String(c.expiresAt).trim();
    }

    return '';
  }

  function sortActiveCoupons(a, b) {
    var aMs = parseExpiryMs(a);
    var bMs = parseExpiryMs(b);

    if (aMs === Infinity && bMs === Infinity) return 0;
    if (aMs === Infinity) return 1;
    if (bMs === Infinity) return -1;
    if (aMs == null && bMs == null) return 0;
    if (aMs == null) return 1;
    if (bMs == null) return -1;

    return aMs - bMs;
  }

  function sortExpiredCoupons(a, b) {
    var aMs = parseExpiryMs(a);
    var bMs = parseExpiryMs(b);

    if (aMs == null && bMs == null) return 0;
    if (aMs == null) return 1;
    if (bMs == null) return -1;

    return bMs - aMs;
  }

  async function fetchCoupons(url) {
    try {
      var res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw 0;

      var data = await res.json();
      var list = Array.isArray(data && data.coupons) ? data.coupons : [];
      var nowMs = Date.now();

      var active = list
        .filter(function (c) {
          return isActiveCoupon(c, nowMs);
        })
        .sort(sortActiveCoupons);

      var expired = list
        .filter(function (c) {
          return isExpiredCoupon(c, nowMs);
        })
        .sort(sortExpiredCoupons);

      return active.concat(expired).slice(0, 3);
    } catch (_e) {
      return [];
    }
  }

  function getGiftLabel(lang) {
    if (lang === 'ko') return '기프트코드';
    return 'Gift Code';
  }

  function getCommunityLabel(lang) {
    if (lang === 'ko') return '카카오톡';
    return 'Discord';
  }

  function getCommunityIcon(lang) {
    return lang === 'ko' ? iconKakao() : iconDiscord();
  }

  function getGiftGuideHref(lang) {
    if (lang === 'ko') return '/ko/guides/kingshot-giftcode';
    if (lang === 'ja') return '/ja/guides/kingshot-giftcode';
    if (lang === 'zh-TW') return '/zh-tw/guides/kingshot-giftcode';
    return '/en/guides/kingshot-giftcode';
  }

  function getCommunityHref(lang) {
    if (lang === 'ko') return 'https://open.kakao.com/o/gHPnO4uh';
    return 'https://discord.gg/EjqWhTPya';
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
    var nowMs = Date.now();

    if (!coupons.length) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = t('footer.coupons.empty', 'No coupons');
      couponWrap.appendChild(empty);
    } else {
      coupons.forEach(function (c) {
        var statusIcon = getStatusIcon(c, nowMs);
        var dateText = getCouponDisplayDate(c);
        var isActive = isActiveCoupon(c, nowMs);

        var d = document.createElement('div');
        d.className = 'footer-coupon' + (isActive ? ' is-active' : ' is-expired');

        d.innerHTML =
          '<span class="code">' +
            escapeHtml(statusIcon + ' ' + c.code) +
          '</span>' +
          (dateText
            ? '<span class="until">' + escapeHtml(dateText) + '</span>'
            : '');

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
        getCommunityIcon(lang) +
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
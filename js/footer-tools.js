/* footer-tools.js (FINAL SAFE+LOCK — coupons → CTAs → LootBar / NO ADS) */
;(() => {
  'use strict';

  // ✅ 스크립트 중복 로드 방지
  if (window.__KD_FOOTER_TOOLS_LOADED__) return;
  window.__KD_FOOTER_TOOLS_LOADED__ = true;

  /* ================= i18n helpers ================= */
  function t(key, fallback) {
    try {
      return (window.I18N && typeof I18N.t === 'function')
        ? I18N.t(key, fallback)
        : (fallback || key);
    } catch {
      return fallback || key;
    }
  }

  function getLangSafe() {
    const raw =
      document.documentElement.getAttribute('lang') ||
      (window.I18N && I18N.current) ||
      localStorage.getItem('lang') ||
      'en';

    const low = String(raw).trim().toLowerCase();
    if (low === 'zh-tw' || low === 'tw' || low === 'zh_tw') return 'zh-TW';
    if (low.startsWith('zh')) return 'zh-TW';
    if (low.startsWith('ko')) return 'ko';
    if (low.startsWith('ja')) return 'ja';
    return 'en';
  }

  /* ================= forever handling ================= */
  function isForever(val) {
    if (!val) return true;
    const v = String(val).trim().toLowerCase();
    return ['permanent', 'infinite', '∞', 'forever', 'no-expiry', 'noexp', 'nolimit'].includes(v);
  }

  function foreverText() {
    const lang = getLangSafe();
    if (lang === 'ko') return '무기한';
    if (lang === 'ja') return '無期限';
    if (lang === 'zh-TW') return '永久';
    return 'Permanent';
  }

  function fmtDate(yyyy_mm_dd) {
    if (isForever(yyyy_mm_dd)) return foreverText();
    try {
      const s = String(yyyy_mm_dd).trim();
      const d = new Date(s + 'T00:00:00Z');
      if (isNaN(d)) return s;

      const lang = getLangSafe();
      return new Intl.DateTimeFormat(lang, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        timeZone: 'UTC'
      }).format(d);
    } catch {
      return String(yyyy_mm_dd);
    }
  }

  /* ================= icons ================= */
  function iconGift() {
    return `<svg viewBox="0 0 24 24"><path d="M20 12v8a2 2 0 0 1-2 2h-5v-10h7zM11 22H6a2 2 0 0 1-2-2v-8h7v10zM21 8h-3.17A3 3 0 1 0 12 6a3 3 0 1 0-5.83 2H3a1 1 0 0 0 0 2h18a1 1 0 1 0 0-2Z"/></svg>`;
  }

  function iconChat() {
    return `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.76 1.6 5.2 4.09 6.8L5.5 22l4.3-2.37c.72.13 1.45.2 2.2.2 5.52 0 10-3.94 10-8.8S17.52 2 12 2z"/></svg>`;
  }

  /* ================= fetch coupons ================= */
  async function fetchCoupons(url) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw 0;
      const data = await res.json();
      return Array.isArray(data?.coupons) ? data.coupons.slice(0, 3) : [];
    } catch {
      return [];
    }
  }

  function isExpiredUTC(until) {
    if (isForever(until)) return false;
    return new Date() >= new Date(String(until).trim() + 'T00:00:00Z');
  }

  /* ================= render core ================= */
  async function renderInto(container, opts) {
    opts = opts || {};
    if (!container) return;

    if (!opts.force) {
      if (container.dataset.footerToolsRendered === '1') return;
      container.dataset.footerToolsRendered = '1';
    }

    container.innerHTML = '';

    const couponWrap = document.createElement('div');
    couponWrap.className = 'footer-coupons';

    const coupons = await fetchCoupons('/data/coupons.json?v=' + Date.now());

    if (!coupons.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = t('footer.coupons.empty', 'No active coupons at the moment.');
      couponWrap.appendChild(empty);
    } else {
      coupons.forEach((c) => {
        const d = document.createElement('div');
        d.className = 'footer-coupon' + (isExpiredUTC(c.until) ? ' expired' : '');
        d.innerHTML = `
          <span class="code">${c.code}</span>
          <span class="until">${fmtDate(c.until)}</span>
        `;
        couponWrap.appendChild(d);
      });
    }

    const ctas = document.createElement('div');
    ctas.className = 'footer-ctas';
    ctas.innerHTML = `
      <a href="/pages/guides/kingshot-giftcode.html" target="_blank" rel="noopener">
        ${iconGift()} <strong>${t('footer.cta.gift', 'Gift Code Guide')}</strong>
      </a>
      <a class="kakao" href="https://open.kakao.com/o/gHPnO4uh" target="_blank" rel="noopener noreferrer">
        ${iconChat()} <strong>${t('footer.cta.chat', 'Kingshot Group Chat')}</strong>
      </a>
    `;

    const lootbar = document.createElement('div');
    lootbar.className = 'footer-image-banner';
    lootbar.innerHTML = `
      <a href="https://lootbar.gg/shop/ten/top-up/kingshot" target="_blank" rel="noopener noreferrer">
        <img src="/img/lootbar.png" alt="Top-up Guide Banner" loading="lazy">
      </a>
    `;

    container.appendChild(couponWrap);
    container.appendChild(ctas);
    container.appendChild(lootbar);
  }

  async function renderFooterToolsAll(opts) {
    opts = opts || {};
    const containers = document.querySelectorAll('#footerTools');
    if (!containers || !containers.length) return;
    await Promise.all(Array.from(containers).map(c => renderInto(c, opts)));
  }

  // =========================================================
  // ✅ RENDER LOCK + DEBOUNCE (연속 i18n:changed 폭주 방지)
  // =========================================================
  let _timer = null;
  let _token = 0;
  let _inflight = false;
  let _pendingForce = false;

  function scheduleRender(force) {
    if (force) _pendingForce = true;

    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(async () => {
      const myToken = ++_token;
      const doForce = _pendingForce;
      _pendingForce = false;

      // 렌더 중이면 "최신만" 남기고 종료
      if (_inflight) {
        // 다음 tick에 다시 한 번만 돌도록 예약
        scheduleRender(doForce);
        return;
      }

      _inflight = true;
      try {
        await renderFooterToolsAll({ force: doForce });
      } finally {
        _inflight = false;
      }

      // 이 렌더 도중 또 예약이 들어왔다면 한 번 더만 실행
      if (myToken !== _token) {
        scheduleRender(true);
      }
    }, 150);
  }

  // ✅ 초기 렌더
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleRender(false), { once: true });
  } else {
    scheduleRender(false);
  }

  // ✅ 언어 변경 시 (폭주해도 마지막 1번만 렌더)
  document.addEventListener('i18n:changed', () => scheduleRender(true));
})();
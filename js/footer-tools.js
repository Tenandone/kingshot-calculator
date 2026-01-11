/* footer-tools.js (FINAL — coupons → CTAs → LootBar → AdFit(KO only)) */
;(() => {
  'use strict';

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
    return (
      document.documentElement.getAttribute('lang') ||
      localStorage.getItem('lang') ||
      (window.I18N && I18N.current) ||
      'en'
    ).toLowerCase();
  }

  /* ================= forever handling ================= */
  function isForever(val) {
    if (!val) return true;
    const v = String(val).trim().toLowerCase();
    return ['permanent', 'infinite', '∞', 'forever', 'no-expiry', 'noexp', 'nolimit'].includes(v);
  }

  function foreverText() {
    const lang = getLangSafe();
    if (lang.startsWith('ko')) return '무기한';
    if (lang.startsWith('ja')) return '無期限';
    if (lang.startsWith('zh')) return '永久';
    return 'Permanent';
  }

  function fmtDate(yyyy_mm_dd) {
    if (isForever(yyyy_mm_dd)) return foreverText();
    try {
      const d = new Date(String(yyyy_mm_dd).trim() + 'T00:00:00');
      if (isNaN(d)) return String(yyyy_mm_dd);
      return new Intl.DateTimeFormat(getLangSafe(), {
        year: 'numeric', month: 'short', day: '2-digit'
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

  /* ================= AdFit loader (KO only + load once) ================= */
  function loadAdfitOnce() {
    // // 왜: ba.min.js는 한 페이지에서 여러 번 로드되면 광고가 안 뜨거나 꼬일 수 있어서 1회만 로드
    if (document.querySelector('script[data-kakao-adfit="1"]')) return;

    const s = document.createElement('script');
    s.src = '//t1.daumcdn.net/kas/static/ba.min.js';
    s.async = true;
    s.setAttribute('data-kakao-adfit', '1');
    document.body.appendChild(s);
  }

  /* ================= render ================= */
  async function renderFooterTools() {
    const container = document.getElementById('footerTools');
    if (!container) return;

    // // 왜: SPA/라우팅에서 renderFooterTools가 여러 번 실행되면
    // //      AdFit는 동적 재삽입 때 광고가 안 뜨는 경우가 있어서 "테스트 단계"는 1회 렌더로 고정
    if (container.dataset.footerToolsRendered === '1') return;
    container.dataset.footerToolsRendered = '1';

    const lang = getLangSafe();
    container.innerHTML = '';

    /* --- coupons --- */
    const couponWrap = document.createElement('div');
    couponWrap.className = 'footer-coupons';

    const coupons = await fetchCoupons('/data/coupons.json?v=now');
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

    /* --- CTAs --- */
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

    /* --- LootBar --- */
    const lootbar = document.createElement('div');
    lootbar.className = 'footer-image-banner';
    lootbar.innerHTML = `
      <a href="https://lootbar.gg/ko/shop/ten/top-up/kingshot" target="_blank" rel="noopener noreferrer">
        <img src="/img/lootbar.png" alt="Top-up Guide Banner" loading="lazy">
      </a>
    `;

    /* --- mount base blocks --- */
    container.appendChild(couponWrap);
    container.appendChild(ctas);
    container.appendChild(lootbar);

    /* --- AdFit (KO only, below LootBar) --- */
    if (lang.startsWith('ko')) {
      const adfit = document.createElement('div');
      adfit.className = 'footer-adfit';
      adfit.innerHTML = `
        <ins class="kakao_ad_area"
             style="display:none;"
             data-ad-unit="DAN-iGFM4JeI8aenYEf7"
             data-ad-width="300"
             data-ad-height="250"></ins>
      `;
      container.appendChild(adfit);

      // // 왜: ins가 DOM에 붙은 다음 스크립트를 로드해야 스캔/렌더가 안정적
      loadAdfitOnce();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderFooterTools);
  } else {
    renderFooterTools();
  }
})();

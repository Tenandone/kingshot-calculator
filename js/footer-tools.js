/* footer-tools.js (FINAL — coupons → CTAs → banner, lang-safe) */
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
    return ['permanent','infinite','∞','forever','no-expiry','noexp','nolimit'].includes(v);
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
  function iconGift(){
    return `<svg viewBox="0 0 24 24"><path d="M20 12v8a2 2 0 0 1-2 2h-5v-10h7zM11 22H6a2 2 0 0 1-2-2v-8h7v10zM21 8h-3.17A3 3 0 1 0 12 6a3 3 0 1 0-5.83 2H3a1 1 0 0 0 0 2h18a1 1 0 1 0 0-2Z"/></svg>`;
  }
  function iconChat(){
    return `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.76 1.6 5.2 4.09 6.8L5.5 22l4.3-2.37c.72.13 1.45.2 2.2.2 5.52 0 10-3.94 10-8.8S17.52 2 12 2z"/></svg>`;
  }

  /* ================= fetch coupons ================= */
  async function fetchCoupons(url){
    try {
      const res = await fetch(url, { cache:'no-store' });
      if (!res.ok) throw 0;
      const data = await res.json();
      return Array.isArray(data?.coupons) ? data.coupons.slice(0,3) : [];
    } catch {
      return [];
    }
  }

  function isExpiredUTC(until){
    if (isForever(until)) return false;
    return new Date() >= new Date(String(until).trim() + 'T00:00:00Z');
  }

  /* ================= render ================= */
  async function renderFooterTools(){
    const container = document.getElementById('footerTools');
    if (!container) return;

    /* --- coupons --- */
    const couponWrap = document.createElement('div');
    couponWrap.className = 'footer-coupons';

    const coupons = await fetchCoupons('/data/coupons.json?v=now');
    if (!coupons.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = t('footer.coupons.empty','No active coupons at the moment.');
      couponWrap.appendChild(empty);
    } else {
      coupons.forEach(c=>{
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
      <a href="/pages/guides/kingshot-giftcode.html" target="_blank">
        ${iconGift()} <strong>${t('footer.cta.gift','Gift Code Guide')}</strong>
      </a>
      <a class="kakao" href="https://open.kakao.com/o/gHPnO4uh" target="_blank">
        ${iconChat()} <strong>${t('footer.cta.chat','Kingshot Group Chat')}</strong>
      </a>
    `;

    /* --- banner (LANG SAFE) --- */
const banner = document.createElement('div');
banner.className = 'footer-image-banner';

const img = document.createElement('img');
img.loading = 'lazy';
img.alt = 'Top-up Guide Banner';

/* 🔥 언어 무관, 단일 배너 */
img.src = '/img/lootbar.png';

const a = document.createElement('a');
a.href = 'https://lootbar.gg/ko/shop/ten/top-up/kingshot';
a.target = '_blank';
a.rel = 'noopener noreferrer';

a.appendChild(img);
banner.appendChild(a);


    /* --- mount order --- */
    container.innerHTML = '';
    container.appendChild(couponWrap); // 1️⃣ 쿠폰
    container.appendChild(ctas);       // 2️⃣ 버튼
    container.appendChild(banner);     // 3️⃣ 배너
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderFooterTools);
  } else {
    renderFooterTools();
  }
})();

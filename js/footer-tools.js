/* footer-tools.js (FINAL — add UTC00 expiry strike-through only) */
;(() => {
  'use strict';

  // ===== i18n helpers (original) =====
  function t(key, fallback) {
    try {
      return (window.I18N && typeof I18N.t === 'function') ? I18N.t(key, fallback) : (fallback || key);
    } catch (_) { return fallback || key; }
  }
  function getLang() {
    try {
      return (window.I18N && I18N.current) || document.documentElement.getAttribute('lang') || 'en';
    } catch(_) { return 'en'; }
  }

  // ===== forever handling (original) =====
  function isForever(val) {
    if (!val) return true; // 빈 값은 무기한 처리
    const v = String(val).trim().toLowerCase();
    return v === 'permanent' || v === 'infinite' || v === '∞' || v === 'forever' || v === 'no-expiry' || v === 'noexp' || v === 'nolimit';
  }
  function foreverText() {
    const lang = (getLang() || 'en').toLowerCase();
    if (lang.startsWith('ko')) return '무기한';
    if (lang.startsWith('ja')) return '無期限';
    if (lang.startsWith('zh')) return '永久';     // zh-CN / zh-TW 공통
    return 'Permanent';                           // default
  }
  function fmtDate(yyyy_mm_dd) {
    if (isForever(yyyy_mm_dd)) return foreverText();
    try {
      // 화면 표기는 기존대로 로컬 포맷(간단 표기 유지)
      const d = new Date(String(yyyy_mm_dd).trim() + 'T00:00:00');
      if (isNaN(d)) return String(yyyy_mm_dd);
      return new Intl.DateTimeFormat(getLang(), { year: 'numeric', month: 'short', day: '2-digit' }).format(d);
    } catch(_) { return String(yyyy_mm_dd); }
  }

  // ===== icons (original) =====
  function iconGift(){
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v8a2 2 0 0 1-2 2h-5v-10h7zM11 22H6a2 2 0 0 1-2-2v-8h7v10zM21 8h-3.17A3 3 0 1 0 12 6a3 3 0 1 0-5.83 2H3a1 1 0 0 0 0 2h18a1 1 0 1 0 0-2ZM9 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>';
  }
  function iconChat(){
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.76 1.6 5.2 4.09 6.8L5.5 22l4.3-2.37c.72.13 1.45.2 2.2.2 5.52 0 10-3.94 10-8.8S17.52 2 12 2z"/></svg>';
  }

  // ===== data fetch (original) =====
  async function fetchCoupons(url){
    try{
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const items = Array.isArray(data?.coupons) ? data.coupons : [];
      // 운영자가 적은 순서 유지, 최대 3개만 사용
      return items.slice(0, 3);
    }catch(_){ return []; }
  }

  // ===== [NEW] UTC 만료 판정 + 스타일 =====
  // "YYYY-MM-DD" → 그 날짜의 00:00:00 UTC
  function parseUTCDate(ymd){ return new Date(String(ymd).trim() + 'T00:00:00Z'); }
  // 만료: now >= UTC 00:00
  function isExpiredUTC(until){
    if (isForever(until)) return false;
    return new Date() >= parseUTCDate(until);
  }
  function injectExpireStyle(){
    if (document.getElementById('footer-expire-style')) return;
    const s = document.createElement('style');
    s.id = 'footer-expire-style';
    s.textContent = `
      #footerTools .footer-coupon.expired .code{
        text-decoration: line-through;
        color: var(--muted, #666);
      }
    `;
    document.head.appendChild(s);
  }

  // ===== render (original + expired 효과만 추가) =====
  async function renderFooterTools(){
    const container = document.getElementById('footerTools');
    if (!container) return;

    injectExpireStyle(); // 줄긋기 스타일만 주입

    // CTAs (원본 유지)
    const giftText = t('footer.cta.gift','Gift Code Guide');
    const giftAria = t('footer.cta.giftAria','Open Kingshot gift code page in a new tab');
    const chatText = t('footer.cta.chat','Kingshot Group Chat');
    const chatAria = t('footer.cta.chatAria','Open real-time Kingshot group chat (Kakao) in a new tab');

    const ctas = document.createElement('div');
    ctas.className = 'footer-ctas';
    ctas.innerHTML = `
      <a href="https://kingshotdata.kr/pages/guides/kingshot-giftcode.html" target="_blank" rel="noopener noreferrer"
         aria-label="${giftAria}">
        ${iconGift()} <strong>${giftText}</strong>
      </a>
      <a class="kakao" href="https://open.kakao.com/o/gHPnO4uh" target="_blank" rel="noopener noreferrer"
         aria-label="${chatAria}">
        ${iconChat()} <strong>${chatText}</strong>
      </a>
    `;

    // Coupons (원본 + expired 클래스만 추가)
    const couponWrap = document.createElement('div');
    couponWrap.className = 'footer-coupons';

    const untilLabel = t('footer.coupons.until','Until');
    const codeAria   = t('footer.coupons.codeAria','Coupon code');
    const untilAria  = t('footer.coupons.untilAria','Valid until');
    const emptyText  = t('footer.coupons.empty','No active coupons at the moment.');

    const coupons = await fetchCoupons('/data/coupons.json?v=now');
    if (!coupons.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = emptyText;
      couponWrap.appendChild(empty);
    } else {
      coupons.forEach(c=>{
        const code = (c.code || '').trim();
        const untilText = fmtDate(c.until || '');
        const expired = isExpiredUTC(c.until);

        const d = document.createElement('div');
        d.className = 'footer-coupon' + (expired ? ' expired' : '');

        const untilHTML = isForever(c.until)
          ? `<span class="until" aria-label="${untilAria}">${untilText}</span>`
          : `<span class="until" aria-label="${untilAria}">${untilLabel}: ${untilText}</span>`;

        d.innerHTML = `
          <span class="code" aria-label="${codeAria}">${code}</span>
          ${untilHTML}
        `;
        couponWrap.appendChild(d);
      });
    }

    // mount (원본 유지)
    container.innerHTML = '';
    container.appendChild(ctas);
    container.appendChild(couponWrap);
  }

  // DOM ready (원본 유지)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderFooterTools);
  } else {
    renderFooterTools();
  }
})();

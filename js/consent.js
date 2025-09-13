/* /js/consent.js
 * KingshotData - Consent Manager (V1.1)
 * - 배너와 모달을 JS로 주입 (index.html 가벼워짐)
 * - 동의 저장/적용/수정 모두 이 모듈에서 처리
 * - 개선사항: 중복로드 가드, 키보드 UX(Esc/포커스), 디버그 로그, 접근성 강화
 */

(function () {
  'use strict';

  // ---------- 중복 로드 방지 ----------
  if (window.__KSD_CONSENT_INIT__) return;
  window.__KSD_CONSENT_INIT__ = true;

  const KEY = 'KSD_CONSENT_V1';
  const defaultConsent = { necessary: true, analytics: false, ads: false };

  // ---------- Debug ----------
  const DEBUG = false;
  function dbg(...args){ if (DEBUG) console.log('[consent]', ...args); }

  // ---------- DOM Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);

  // ---------- Storage ----------
  function readConsent() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (_) { return null; }
  }
  function writeConsent(c) {
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (_) {}
  }

  // ---------- Loaders ----------
  function loadGA() {
    if (window.__gaLoaded) return; window.__gaLoaded = true;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-TMGDGSEWW6';
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', 'G-TMGDGSEWW6');
  }

  function loadAdSense() {
    if (window.__adsenseLoaded) return; window.__adsenseLoaded = true;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9189957764761115';
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
  }

  function applyConsent(c) {
    dbg('applyConsent', c);
    if (c.analytics) { dbg('load GA'); loadGA(); }
    if (c.ads) { dbg('load AdSense'); loadAdSense(); }
  }

  // ---------- UI (banner + modal) ----------
  function injectUI() {
    // 배너
    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Cookie Notice');
    banner.innerHTML = `
      <div class="cookie-banner__inner">
        <p class="cookie-banner__msg">
          We use cookies for site functionality, analytics, and ads. You can change preferences anytime.
        </p>
        <div class="cookie-banner__btns">
          <button id="cookie-accept-all" class="btn btn--accept">Accept all</button>
          <button id="cookie-reject-all" class="btn btn--reject">Reject all</button>
          <button id="cookie-customize"  class="btn btn--custom">Customize</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);

    // 모달
    const modal = document.createElement('div');
    modal.id = 'cookie-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'cookie-modal-title');
    modal.innerHTML = `
      <div class="cookie-modal__backdrop" data-close="1"></div>
      <div class="cookie-modal__panel" role="document">
        <header class="cookie-modal__header">
          <h2 id="cookie-modal-title">Cookie Preferences</h2>
          <button id="cookie-close" class="icon-btn" aria-label="Close">✕</button>
        </header>
        <div class="cookie-modal__content">
          <label class="row">
            <span><strong>Necessary</strong> (always on)</span>
            <input type="checkbox" checked disabled>
          </label>
          <label class="row">
            <span><strong>Analytics</strong> (GA4)</span>
            <input id="consent-analytics" type="checkbox">
          </label>
          <label class="row">
            <span><strong>Ads</strong> (AdSense)</span>
            <input id="consent-ads" type="checkbox">
          </label>
        </div>
        <footer class="cookie-modal__footer">
          <button id="cookie-save" class="btn btn--primary">Save</button>
          <button id="cookie-cancel" class="btn">Cancel</button>
        </footer>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function openModal() {
    const c = readConsent() || defaultConsent;
    $('#consent-analytics').checked = !!c.analytics;
    $('#consent-ads').checked = !!c.ads;
    $('#cookie-modal').classList.add('is-open');
    $('#consent-analytics')?.focus(); // 첫 포커스
  }
  function closeModal() {
    $('#cookie-modal').classList.remove('is-open');
  }

  function showBanner() { $('#cookie-banner').classList.add('is-show'); }
  function hideBanner() { $('#cookie-banner').classList.remove('is-show'); }

  // ---------- Event Bindings ----------
  function bindEvents() {
    $('#cookie-accept-all')?.addEventListener('click', () => {
      const c = { necessary: true, analytics: true, ads: true };
      writeConsent(c); dbg('saved', c); applyConsent(c); hideBanner();
    });
    $('#cookie-reject-all')?.addEventListener('click', () => {
      const c = { necessary: true, analytics: false, ads: false };
      writeConsent(c); dbg('saved', c); hideBanner();
    });
    $('#cookie-customize')?.addEventListener('click', openModal);

    $('#cookie-save')?.addEventListener('click', () => {
      const c = {
        necessary: true,
        analytics: $('#consent-analytics')?.checked,
        ads: $('#consent-ads')?.checked
      };
      writeConsent(c); dbg('saved', c); applyConsent(c); closeModal(); hideBanner();
    });
    $('#cookie-cancel')?.addEventListener('click', closeModal);
    $('#cookie-close')?.addEventListener('click', closeModal);
    $('#cookie-modal')?.addEventListener('click', (e) => {
      if (e.target?.dataset?.close) closeModal();
    });

    // ESC 키로 닫기
    document.addEventListener('keydown', (e) => {
      if ($('#cookie-modal')?.classList.contains('is-open') && e.key === 'Escape') {
        closeModal();
      }
    });

    // 푸터 버튼과 Do Not Sell 링크 연결 (index.html에 이미 있음)
    document.getElementById('cookie-prefs-open')?.addEventListener('click', openModal);
    document.getElementById('dnsmpi')?.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
      const ads = document.getElementById('consent-ads');
      if (ads) ads.checked = false; // 빠른 옵트아웃
    });
  }

  // ---------- Region Gate ----------
  function shouldShowBannerByRegion() {
    return true; // 현재는 항상 true (필요시 geo 필터 추가)
  }

  // ---------- Init ----------
  function init() {
    injectUI();
    bindEvents();

    const c = readConsent();
    if (!c) {
      if (shouldShowBannerByRegion()) showBanner();
    } else {
      applyConsent(c);
    }
  }

  // 문서 준비 후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* Presentation only. Existing router, analytics, storage and page scripts retain ownership. */
(() => {
  'use strict';
  const logo = '/img/kingshotdata-logo-56.webp?v=2026100621';
  function apply() {
    document.body.classList.add('ks-design');
    const subtitle = document.querySelector('.site-header .brand-sub');
    if(subtitle && subtitle.textContent !== 'Database & Strategy') subtitle.textContent = 'Database & Strategy';
    const brand = document.querySelector('.ks-nav-brand');
    if (brand && !brand.querySelector('.ks-brand-logo')) {
      const img = document.createElement('img');
      img.className = 'ks-brand-logo'; img.src = logo; img.alt = ''; img.width = 36; img.height = 36;
      const text = document.createElement('span'); text.className = 'ks-brand-text';
      const title = document.createElement('span'); title.className = 'ks-brand-title'; title.textContent = 'Kingshot Data';
      const sub = document.createElement('span'); sub.className = 'ks-brand-sub'; sub.textContent = 'Database & Strategy';
      text.append(title, sub); brand.replaceChildren(img, text);
    }
    const header = document.querySelector('.ks-site-nav,.site-header');
    if (header) document.documentElement.style.setProperty('--ks-site-nav-height', `${header.offsetHeight}px`);
  }
  let queued = false;
  function schedule() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; apply(); }); }
  function boot() {
    apply();
    new MutationObserver(records => { if(records.some(r => r.addedNodes.length)) schedule(); }).observe(document.body, {childList:true,subtree:true});
    window.addEventListener('resize', schedule, {passive:true});
    document.addEventListener('kd:page-ready', schedule);
    document.addEventListener('i18n:changed', schedule);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();

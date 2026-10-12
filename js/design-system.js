/* Presentation only. Existing router, analytics, storage and page scripts retain ownership. */
(() => {
  'use strict';
  const logo = '/img/brand/bear-symbol-112.png';
  const logo2x = '/img/brand/bear-symbol-224.png';
  function frameLogo(brand) {
    const img = brand.querySelector('.brand-logo,.ks-brand-logo');
    if (!img) return;
    if (img.getAttribute('src') !== logo) img.setAttribute('src', logo);
    if (img.getAttribute('srcset') !== `${logo} 1x, ${logo2x} 2x`) img.setAttribute('srcset', `${logo} 1x, ${logo2x} 2x`);
    img.alt = ''; img.width = 52; img.height = 52;
    // Preserve the actual brand anchor and every navigation event attached to it.
    // The character supplies its own silhouette; the wrapper has no background.
    if (!img.parentElement.classList.contains('ks-brand-mark')) {
      const mark = document.createElement('span');
      mark.className = 'ks-brand-mark'; mark.setAttribute('aria-hidden', 'true');
      img.before(mark); mark.append(img);
    }
    // The home link is named accessibly; its visible brand is the bear alone.
    brand.querySelectorAll('.brand-text,.ks-brand-text,.ks-brand-lettering,.ks-brand-wordmark').forEach(text => text.remove());
    brand.classList.add('ks-brand-ready');
    brand.setAttribute('aria-label', 'KingshotData Home');
  }
  function apply() {
    document.body.classList.add('ks-design');
    const brand = document.querySelector('.ks-nav-brand');
    if (brand && !brand.querySelector('.ks-brand-logo')) {
      const img = document.createElement('img');
      img.className = 'ks-brand-logo'; img.src = logo; img.alt = ''; img.width = 52; img.height = 52;
      brand.replaceChildren(img);
    }
    document.querySelectorAll('.site-header .brand.brand-pro,.ks-site-nav .ks-nav-brand').forEach(frameLogo);
    // Keep the existing controls and their listeners while normalizing visual order.
    document.querySelectorAll('.ks-nav-languages,.lang-pills').forEach(group=>{
      const controls=[...group.children];
      const language=el=>String(el.dataset.lang||el.getAttribute('hreflang')||'').toLowerCase();
      const order=['ko','en','ja','zh-tw'];
      if(!controls.length||controls.some(el=>!order.includes(language(el))))return;
      const sorted=controls.slice().sort((a,b)=>order.indexOf(language(a))-order.indexOf(language(b)));
      if(sorted.some((el,i)=>el!==controls[i]))sorted.forEach(el=>group.append(el));
      for(const el of sorted)if(language(el)==='zh-tw'&&el.textContent!=='TW')el.textContent='TW';
    });
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

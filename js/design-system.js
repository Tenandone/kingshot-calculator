/* Presentation only. Existing router, analytics, storage and page scripts retain ownership. */
(() => {
  'use strict';
  const logo = '/img/kingshotdata-logo-112.png';
  function frameLogo(brand) {
    const img = brand.querySelector('.brand-logo,.ks-brand-logo');
    if (!img) return;
    if (img.getAttribute('src') !== logo) img.setAttribute('src', logo);
    // Preserve the actual brand anchor and every navigation event attached to it.
    // The silhouette is CSS on a separate element, not a crop of the bear art.
    if (!img.parentElement.classList.contains('ks-brand-mark')) {
      const mark = document.createElement('span');
      mark.className = 'ks-brand-mark'; mark.setAttribute('aria-hidden', 'true');
      img.before(mark); mark.append(img);
    }
  }
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

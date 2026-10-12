/* Presentation only. Existing router, analytics, storage and page scripts retain ownership. */
(() => {
  'use strict';
  const logo = '/img/brand/bear-symbol-112.png';
  const logo2x = '/img/brand/bear-symbol-224.png';
  const wordmark = '/img/brand/wordmark-ink.svg';
  function frameLogo(brand) {
    const img = brand.querySelector('.brand-logo,.ks-brand-logo');
    if (!img) return;
    if (img.getAttribute('src') !== logo) img.setAttribute('src', logo);
    if (img.getAttribute('srcset') !== `${logo} 1x, ${logo2x} 2x`) img.setAttribute('srcset', `${logo} 1x, ${logo2x} 2x`);
    img.alt = ''; img.width = 44; img.height = 44;
    // Preserve the actual brand anchor and every navigation event attached to it.
    // The character supplies its own silhouette; the wrapper has no background.
    if (!img.parentElement.classList.contains('ks-brand-mark')) {
      const mark = document.createElement('span');
      mark.className = 'ks-brand-mark'; mark.setAttribute('aria-hidden', 'true');
      img.before(mark); mark.append(img);
    }
    const text = brand.querySelector('.brand-text,.ks-brand-text');
    if (text && !text.querySelector('.ks-brand-wordmark')) {
      const picture = document.createElement('picture');
      picture.className = 'ks-brand-lettering';
      const compact = document.createElement('source');
      compact.media = '(max-width: 360px)'; compact.srcset = '/img/brand/wordmark-compact-ink.svg';
      const lettering = document.createElement('img');
      lettering.className = 'ks-brand-wordmark'; lettering.src = wordmark;
      lettering.alt = ''; lettering.width = 360; lettering.height = 48;
      lettering.setAttribute('aria-hidden', 'true');
      picture.append(compact, lettering); text.prepend(picture);
    }
    brand.classList.add('ks-brand-ready');
    brand.setAttribute('aria-label', 'KingshotData Home');
  }
  function apply() {
    document.body.classList.add('ks-design');
    const brand = document.querySelector('.ks-nav-brand');
    if (brand && !brand.querySelector('.ks-brand-logo')) {
      const img = document.createElement('img');
      img.className = 'ks-brand-logo'; img.src = logo; img.alt = ''; img.width = 44; img.height = 44;
      const text = document.createElement('span'); text.className = 'ks-brand-text';
      const title = document.createElement('span'); title.className = 'ks-brand-title'; title.textContent = 'Kingshot Data';
      text.append(title); brand.replaceChildren(img, text);
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

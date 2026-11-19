/* First-party sponsor slots. No remote scripts, cookies or purchase tracking. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && !root.KD_SPONSORS) api.boot(root);
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const VERSION = 'buffhub-20261119-v2';
  const CONFIG_URL = '/data/sponsors/buffhub.json';
  const LOCALES = ['ko', 'en', 'ja', 'zh-tw'];
  const PLACEMENTS = ['guide_after_intro', 'content_after_intro', 'content_end', 'calculator_result'];
  const DESTINATIONS = {ko: '/ko/top-up/kingshot.html', en: '/top-up/kingshot.html', ja: '/ja/top-up/kingshot.html', 'zh-tw': '/zh-Hant/top-up/kingshot.html'};
  const LABELS = {ko: '광고', en: 'Sponsored', ja: '広告', 'zh-tw': '廣告'};
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string' && value.length > 0 && value.length <= 240 && !/[<>\u0000-\u001f]/.test(value);
  function normalizePath(value) {
    if (typeof value !== 'string' || value.length > 240 || !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]*$/.test(value)) return null;
    if (value.includes('//') || value.split('/').some(part => part === '.' || part === '..')) return null;
    return value.replace(/\/index\.html$/, '/');
  }
  function localeFor(pathname) { return pathname.match(/^\/(ko|en|ja|zh-tw)(?:\/|$)/)?.[1] || 'ko'; }
  function validateConfig(config) {
    const errors = [];
    if (!isObject(config)) return ['Campaign must be an object'];
    if (config.schemaVersion !== 1 || config.id !== 'buffhub-kingshot') errors.push('Unknown campaign or schema');
    if (typeof config.enabled !== 'boolean') errors.push('enabled must be boolean');
    if (!Array.isArray(config.approvedPaths) || config.approvedPaths.length > 10000 || config.approvedPaths.some(p => typeof p !== 'string' || normalizePath(p) !== p) || new Set(config.approvedPaths).size !== config.approvedPaths.length) errors.push('approvedPaths must contain unique exact static paths');
    if (!Array.isArray(config.placements) || !config.placements.length || config.placements.some(p => !PLACEMENTS.includes(p)) || new Set(config.placements).size !== config.placements.length) errors.push('Unknown placement');
    if (!isObject(config.pathOverrides)) errors.push('pathOverrides must be an object');
    else for (const [path, override] of Object.entries(config.pathOverrides)) {
      if (!Array.isArray(config.approvedPaths) || !config.approvedPaths.includes(path) || !isObject(override) || !Array.isArray(config.placements) || !config.placements.includes(override.placement)) errors.push('Override must target an approved path and enabled placement');
      if (!isObject(override)) continue;
      if (override.selector !== undefined && (typeof override.selector !== 'string' || override.selector.length > 160 || !/^[A-Za-z0-9_#.\- >\[\]="']+$/.test(override.selector))) errors.push('Unsafe placement selector');
    }
    if (config.events?.impression !== 'sponsor_impression' || config.events?.click !== 'sponsor_click') errors.push('Unsupported measurement event');
    if (!isObject(config.viewability) || !Number.isFinite(config.viewability.ratio) || config.viewability.ratio < 0.5 || config.viewability.ratio > 1 || !Number.isInteger(config.viewability.milliseconds) || config.viewability.milliseconds < 1000 || config.viewability.milliseconds > 60000) errors.push('Invalid viewability threshold');
    for (const locale of LOCALES) {
      const creative = config.creatives?.[locale];
      if (!isObject(creative)) { errors.push('Missing creative: ' + locale); continue; }
      if (typeof creative.id !== 'string' || !new RegExp('^buffhub-' + locale + '-[a-z0-9_-]{1,40}$').test(creative.id)) errors.push('Invalid creative ID: ' + locale);
      if (creative.image !== '/img/sponsors/buffhub/buffhub-' + locale + '-728.webp' || creative.image2x !== '/img/sponsors/buffhub/buffhub-' + locale + '-1456.webp') errors.push('Invalid local image: ' + locale);
      try {
        if (typeof creative.href !== 'string') throw Error();
        const url = new URL(creative.href);
        if (url.origin !== 'https://buffhub.com' || url.pathname !== DESTINATIONS[locale] || url.username || url.password || url.hash || url.searchParams.getAll('aff_short').length !== 1 || url.searchParams.get('aff_short') !== 'kingshot' || [...url.searchParams.keys()].some(k => k !== 'aff_short')) throw Error();
      } catch (_) { errors.push('Invalid referral URL: ' + locale); }
      if (creative.label !== LABELS[locale] || ['alt','mobileText','action','newWindow'].some(k => !text(creative[k]))) errors.push('Missing localized disclosure or accessible text: ' + locale);
    }
    return errors;
  }
  function selectCampaign(config, pathname) {
    if (validateConfig(config).length || !config.enabled) return null;
    const path = normalizePath(pathname);
    if (!path || !config.approvedPaths.includes(path)) return null;
    const locale = localeFor(path), override = config.pathOverrides[path];
    return {path, locale, placement: override?.placement || config.placements[0], selector: override?.selector || null, creative: config.creatives[locale]};
  }
  function findPlacement(doc, selection) {
    if (!selection) return null;
    const guide = /^\/(?:ko|en|ja|zh-tw)\/guides\/[^/]+\.html$/.test(selection.path);
    const reader = doc.querySelector('#ks-guide-content');
    const main = reader ? reader.querySelector('main') : doc.querySelector('main') || doc.querySelector('section[aria-label="Truegold Chart"]');
    if (!main || main.closest('[hidden]')) return null;
    if (selection.placement === 'guide_after_intro' && !guide) return null;
    if (selection.selector) {
      let found;
      try { found = main.querySelectorAll(selection.selector); } catch (_) { return null; }
      const anchor = found.length === 1 ? found[0] : null;
      return anchor && !anchor.closest('[hidden],nav,aside,footer,[data-kd-sponsor]') ? {anchor, mode: 'after'} : null;
    }
    if (selection.placement === 'calculator_result') {
      // Results need an explicit stable selector approved per page; never guess a calculator's validity.
      return null;
    }
    if (selection.placement === 'content_end') return {anchor: main, mode: 'append'};
    const hero = main.querySelector('.hero, [data-sponsor-intro], #introduction, #intro');
    if (hero && !hero.closest('[hidden],nav,aside,[data-kd-sponsor]')) return {anchor: hero, mode: 'after'};
    const heading = main.querySelector('h1');
    let anchor = heading?.nextElementSibling, last = null;
    while (anchor?.tagName === 'P' && !anchor.matches('[data-kd-personal]')) { last = anchor; anchor = anchor.nextElementSibling; }
    return last && !last.closest('[hidden],nav,aside,footer,[data-kd-sponsor]') ? {anchor: last, mode: 'after'} : null;
  }
  function boot(root) {
    if (root.KD_SPONSORS) return root.KD_SPONSORS;
    const doc = root.document;
    let config = null, record = null, frame = null, observer = null, fetchSequence = 0, refreshTimer = null, impressionTimer = null, stylesheetReady = null;
    let visitPath = normalizePath(root.location.pathname), visit = 1, stopped = false, stylesLoaded = false, finishReady;
    const ready = new Promise(resolve => { finishReady = resolve; });
    const measured = new Set(), removers = [];
    const listen = (target, name, fn, options) => { target.addEventListener(name, fn, options); removers.push(() => target.removeEventListener(name, fn, options)); };
    const currentSelection = () => selectCampaign(config, root.location.pathname);
    const signature = selection => JSON.stringify({creative: selection.creative, viewability: config.viewability});
    function clearImpression() { root.clearTimeout(impressionTimer); impressionTimer = null; }
    function removeSlot() {
      clearImpression();
      if (record) { record.observer?.disconnect(); record.element.remove(); record = null; }
      doc.querySelectorAll('[data-kd-sponsor="buffhub-kingshot"]').forEach(node => node.remove());
    }
    function canonicalMatches(selection) {
      const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
      try { const u = new URL(canonical); return u.origin === 'https://kingshotdata.kr' && normalizePath(u.pathname) === selection.path; } catch (_) { return false; }
    }
    function measurementContext(placement) {
      const selected = currentSelection();
      if (!record || !record.loaded || !record.element.isConnected || !selected || !canonicalMatches(selected) || selected.path !== record.path || selected.placement !== placement || record.placement !== placement || record.creativeId !== selected.creative.id || record.signature !== signature(selected)) return null;
      return Object.freeze({campaign_id: config.id, creative_id: selected.creative.id, placement_id: placement, page_path: selected.path, language: selected.locale});
    }
    function impression() {
      clearImpression();
      if (!record?.visible || !record.loaded || doc.visibilityState === 'hidden') return;
      const key = visit + '|' + record.path + '|' + record.creativeId + '|' + record.placement;
      if (measured.has(key) || !root.KD_PRIVACY?.canRecord()) return;
      const activeRecord = record;
      impressionTimer = root.setTimeout(() => {
        impressionTimer = null;
        if (record !== activeRecord || !record.visible || doc.visibilityState === 'hidden') return;
        const context = measurementContext(record.placement);
        if (context && root.KD_METRICS?.emit(config.events.impression, context)) measured.add(key);
      }, config.viewability.milliseconds);
    }
    function readyStyles() {
      if (stylesheetReady) return stylesheetReady;
      stylesheetReady = new Promise(resolve => {
        const link = doc.createElement('link');
        link.rel = 'stylesheet'; link.href = '/css/buffhub-sponsor.css?v=' + VERSION; link.dataset.kdSponsorStyle = '';
        const timer = root.setTimeout(() => { link.remove(); stylesheetReady = null; stylesLoaded = false; resolve(false); }, 8000);
        link.onload = () => { root.clearTimeout(timer); stylesLoaded = true; resolve(true); };
        link.onerror = () => { root.clearTimeout(timer); link.remove(); stylesheetReady = null; stylesLoaded = false; resolve(false); };
        doc.head.appendChild(link);
      });
      return stylesheetReady;
    }
    function mount(selection, placement) {
      const c = selection.creative, aside = doc.createElement('aside'), label = doc.createElement('span'), a = doc.createElement('a'), art = doc.createElement('span'), img = doc.createElement('img'), mobile = doc.createElement('span'), title = doc.createElement('strong'), action = doc.createElement('span'), newWindow = doc.createElement('span');
      aside.className = 'kd-sponsor'; aside.dataset.kdSponsor = config.id; aside.dataset.sponsorPlacement = selection.placement; aside.dataset.sponsorPath = selection.path; aside.lang = selection.locale === 'zh-tw' ? 'zh-Hant' : selection.locale; aside.setAttribute('aria-label', c.label + ' · BUFFHUB');
      label.className = 'kd-sponsor__label'; label.textContent = c.label;
      a.className = 'kd-sponsor__link'; a.href = c.href; a.target = '_blank'; a.rel = 'sponsored nofollow noopener noreferrer'; a.referrerPolicy = 'no-referrer'; a.setAttribute('aria-label', c.mobileText + ' — ' + c.action + ' (' + c.newWindow + ')');
      art.className = 'kd-sponsor__art';
      img.className = 'kd-sponsor__image'; img.width = 728; img.height = 90; img.alt = c.alt; img.decoding = 'async'; img.loading = 'eager'; img.fetchPriority = 'low';
      mobile.className = 'kd-sponsor__mobile'; mobile.setAttribute('aria-hidden','true'); title.textContent = c.mobileText; action.className = 'kd-sponsor__action'; action.textContent = c.action; mobile.append(title, action);
      newWindow.className = 'kd-sponsor__sr'; newWindow.textContent = c.newWindow;
      art.appendChild(img); a.append(art, mobile, newWindow); aside.append(label, a);
      const next = {element: aside, image: img, path: selection.path, creativeId: c.id, placement: selection.placement, signature: signature(selection), anchor: placement.anchor, mode: placement.mode, loaded: false, visible: false, observer: null};
      record = next;
      function allowClick(event) {
        const active = currentSelection();
        if (!active || record !== next || !aside.isConnected || !canonicalMatches(active) || active.path !== next.path || active.placement !== next.placement || signature(active) !== next.signature || a.href !== new URL(active.creative.href).href) {
          event.preventDefault(); removeSlot(); return false;
        }
        return true;
      }
      a.addEventListener('click', event => {
        if (event.defaultPrevented || (typeof event.button === 'number' && event.button !== 0)) return;
        if (!allowClick(event)) return;
        const context = measurementContext(next.placement);
        if (context) root.KD_METRICS?.emit(config.events.click, context);
      });
      a.addEventListener('auxclick', event => { if (event.button === 1 && !event.defaultPrevented && allowClick(event)) { const context = measurementContext(next.placement); if (context) root.KD_METRICS?.emit(config.events.click, context); } });
      img.onload = () => { if (record === next && img.naturalWidth > 0) { next.loaded = true; aside.dataset.sponsorLoaded = 'true'; impression(); } };
      img.onerror = () => { if (record === next) { removeSlot(); failedImages.add(c.image); } };
      img.srcset = c.image + ' 728w, ' + c.image2x + ' 1456w'; img.sizes = '(max-width: 760px) calc(100vw - 32px), 728px'; img.src = c.image;
      if (placement.mode === 'append') placement.anchor.appendChild(aside); else placement.anchor.after(aside);
      if (typeof root.IntersectionObserver === 'function') {
        next.observer = new root.IntersectionObserver(entries => {
          if (record !== next) return;
          const entry = entries.find(e => e.target === aside); if (!entry) return;
          next.visible = entry.isIntersecting && entry.intersectionRatio >= config.viewability.ratio; impression();
        }, {threshold: [0, config.viewability.ratio, 1]});
        next.observer.observe(aside);
      }
      if (img.complete && img.naturalWidth > 0) img.onload();
    }
    const failedImages = new Set();
    function mountSync() {
      if (stopped) return false;
      const path = normalizePath(root.location.pathname);
      if (path !== visitPath) { visitPath = path; visit++; measured.clear(); }
      const selected = currentSelection();
      if (!selected || failedImages.has(selected.creative.image) || !canonicalMatches(selected)) { removeSlot(); return false; }
      // Let the reader finish replacing the static main before attaching a slot.
      if (root.KD_GUIDE_READER && /^\/(ko|en|ja|zh-tw)\/guides\//.test(path) && !doc.querySelector('#ks-guide-content')) { removeSlot(); return false; }
      const placement = findPlacement(doc, selected);
      if (!placement) { removeSlot(); return false; }
      if (record?.element.isConnected && record.path === selected.path && record.creativeId === selected.creative.id && record.placement === selected.placement && record.anchor === placement.anchor && record.signature === signature(selected)) return true;
      removeSlot();
      if (!stylesLoaded) return false;
      mount(selected, placement); return true;
    }
    async function reconcile() {
      frame = null;
      if (stopped || mountSync()) return;
      if (!currentSelection() || !await readyStyles() || stopped) return;
      mountSync();
    }
    function schedule() { if (!stopped && frame === null) frame = root.requestAnimationFrame(() => { reconcile().catch(removeSlot); }); }
    async function reload() {
      const turn = ++fetchSequence;
      try {
        const response = await root.fetch(CONFIG_URL, {credentials: 'same-origin', cache: 'no-store'});
        if (!response.ok) throw Error('Campaign unavailable');
        const next = await response.json();
        if (validateConfig(next).length) throw Error('Campaign invalid');
        if (turn !== fetchSequence || stopped) return false;
        config = next;
      } catch (_) { if (turn !== fetchSequence || stopped) return false; config = null; removeSlot(); }
      root.clearTimeout(refreshTimer);
      if (config?.enabled) refreshTimer = root.setTimeout(reload, 60000);
      if (config?.enabled && !observer && typeof root.MutationObserver === 'function') {
        observer = new root.MutationObserver(records => { if (records.some(change => !change.target.closest?.('[data-kd-sponsor]') && [...change.addedNodes, ...change.removedNodes].some(node => node.nodeType === 1 && !node.matches?.('[data-kd-sponsor]')))) schedule(); });
        observer.observe(doc.body, {childList: true, subtree: true});
      } else if (!config?.enabled && observer) { observer.disconnect(); observer = null; }
      schedule(); return !!config;
    }
    function destroy() { stopped = true; fetchSequence++; root.clearTimeout(refreshTimer); if (frame !== null) root.cancelAnimationFrame(frame); observer?.disconnect(); removeSlot(); removers.forEach(fn => fn()); }
    const prepare = pathname => selectCampaign(config, pathname) ? readyStyles() : Promise.resolve(false);
    const api = Object.freeze({version: VERSION, ready, prepare, reload, refresh: schedule, mountSync, measurementContext, destroy, status: () => Object.freeze({configured: !!config, enabled: !!config?.enabled, eligible: !!currentSelection(), mounted: !!record?.element.isConnected, path: normalizePath(root.location.pathname)})});
    root.KD_SPONSORS = api;
    ['kd:page-ready','popstate','pageshow'].forEach(name => listen(root, name, schedule));
    ['i18n:changed','i18n:ready'].forEach(name => listen(doc, name, schedule));
    listen(root, 'kd:analytics-consent', impression);
    listen(doc, 'visibilitychange', () => { impression(); schedule(); });
    const start = () => reload().then(() => currentSelection() ? readyStyles() : false).then(finishReady, () => finishReady(false));
    if (doc.readyState === 'loading') listen(doc, 'DOMContentLoaded', start, {once: true}); else start();
    return api;
  }
  return {VERSION, LOCALES, PLACEMENTS, normalizePath, localeFor, validateConfig, selectCampaign, findPlacement, boot};
});

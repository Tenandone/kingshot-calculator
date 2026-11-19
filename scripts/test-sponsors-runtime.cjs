'use strict';
// Run the real sponsor, metrics and consent modules against a DOM. Resource
// loading, time and visibility are deterministic; no network requests are made.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {parseHTML} = require('linkedom');
const ROOT = path.join(__dirname, '..');
const DRAFT = {...JSON.parse(fs.readFileSync(path.join(ROOT, 'data/sponsors/buffhub.json'), 'utf8')), enabled: false};
const SOURCES = Object.fromEntries(['operator-profile-config','hub-metrics','privacy-controls','sponsors'].map(name => [name, fs.readFileSync(path.join(ROOT, 'js', name + '.js'), 'utf8')]));
const NOW = Date.parse('2026-11-19T04:00:00Z');
const LOCALES = ['ko','en','ja','zh-tw'];
const guidePath = (locale = 'ko', slug = 'kingshot-bearhunt') => '/' + locale + '/guides/' + slug + '.html';
const clone = value => JSON.parse(JSON.stringify(value));
const approved = LOCALES.flatMap(locale => [guidePath(locale), guidePath(locale, 'kingshot-f2p-guide')]);
const activeConfig = () => ({...clone(DRAFT), enabled: true, approvedPaths: approved.slice()});
const mainHTML = (title = 'Guide') => '<main><section class="hero"><h1>' + title + '</h1><p>Original introduction</p></section><nav id="contents"><a href="#details">Contents</a></nav><section id="details"><h2>Details</h2><p>Original body and calculator data stay here.</p></section></main>';

function target() {
  const listeners = new Map();
  return {listeners, addEventListener(name, fn, options) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push({fn, once: !!options?.once}); },
    removeEventListener(name, fn) { listeners.set(name, (listeners.get(name) || []).filter(item => item.fn !== fn)); },
    dispatchEvent(event) { for (const item of [...(listeners.get(event.type) || [])]) { item.fn(event); if (item.once) this.removeEventListener(event.type, item.fn); } return !event.defaultPrevented; }};
}
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return {promise, resolve, reject}; }

async function setup(options = {}) {
  let now = options.now ?? NOW, sequence = 0, config = clone(options.config ?? activeConfig());
  const pathname = options.pathname || guidePath();
  const html = options.html || '<!doctype html><html><head><link rel="canonical" href="https://kingshotdata.kr' + pathname + '"></head><body>' + mainHTML() + '<footer>Original footer</footer></body></html>';
  const {window: domWindow, document} = parseHTML(html);
  Object.defineProperty(document, 'readyState', {value: 'complete', configurable: true});
  Object.defineProperty(document, 'visibilityState', {value: 'visible', writable: true, configurable: true});
  if (!domWindow.HTMLElement.prototype.focus) domWindow.HTMLElement.prototype.focus = function () {};
  const timers = new Map(), raf = new Map(), intersections = [], mutations = [], requests = [], store = new Map(), emitted = [];
  if (options.consent !== null) store.set('KSD_CONSENT_V1', JSON.stringify({necessary: true, analytics: options.consent !== false, ads: false}));
  const location = new URL('https://' + (options.hostname || 'kingshotdata.kr') + pathname + '?email=private@example.test#private-note');
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  let fetchHandler = async () => ({ok: true, json: async () => clone(config)});
  const root = {...target(), document, location, URL, Date: ClockDate, console,
    CustomEvent: domWindow.CustomEvent,
    localStorage: {getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value))},
    setTimeout(fn, delay = 0) { const id = ++sequence; timers.set(id, {fn, at: now + Math.max(0, Number(delay) || 0)}); return id; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(fn) { const id = ++sequence; raf.set(id, fn); return id; },
    cancelAnimationFrame(id) { raf.delete(id); },
    fetch(url, init) { assert.equal(url, '/data/sponsors/buffhub.json', 'only the local campaign endpoint may be requested'); requests.push({url, init}); return fetchHandler(url, init); },
    IntersectionObserver: class {
      constructor(callback, init) { this.callback = callback; this.init = init; this.targets = new Set(); this.active = true; intersections.push(this); }
      observe(node) { this.targets.add(node); }
      disconnect() { this.active = false; this.targets.clear(); }
    },
    MutationObserver: class {
      constructor(callback) { this.active = false; this.inner = new domWindow.MutationObserver(callback); mutations.push(this); }
      observe(node, init) { this.active = true; this.inner.observe(node, init); }
      disconnect() { this.active = false; this.inner.disconnect(); }
    }
  };
  if (options.noIntersectionObserver) delete root.IntersectionObserver;
  if (options.readerPending) root.KD_GUIDE_READER = {version: 'pending-reader-test'};
  root.window = root;
  const context = vm.createContext(root);
  const run = name => vm.runInContext(SOURCES[name], context, {filename: name + '.js'});
  for (const name of ['operator-profile-config','hub-metrics','privacy-controls']) run(name);
  const originalEmit = root.KD_METRICS.emit;
  root.KD_METRICS.emit = function (name, data) { if (name.startsWith('sponsor_')) emitted.push({name, data: clone(data)}); return originalEmit(name, data); };
  const loadedStyles = new WeakSet();
  let autoStyles = options.autoStyles !== false;
  async function settle() {
    for (let round = 0; round < 12; round++) {
      await Promise.resolve();
      const frames = [...raf.values()]; raf.clear(); for (const frame of frames) frame(now);
      if (autoStyles) for (const link of document.querySelectorAll('link[data-kd-sponsor-style]')) if (!loadedStyles.has(link)) { loadedStyles.add(link); link.onload?.(); }
      await Promise.resolve();
    }
  }
  async function advance(milliseconds) {
    const end = now + milliseconds;
    let cycles = 0;
    while (true) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      assert(++cycles < 500, 'timer loop must remain bounded');
      now = due[1].at; timers.delete(due[0]); due[1].fn(); await settle();
    }
    now = end; await settle();
  }
  const slot = () => document.querySelector('[data-kd-sponsor="buffhub-kingshot"]');
  const events = () => Array.from(root.dataLayer || [], args => Array.from(args)).filter(args => args[0] === 'event' && ['sponsor_impression','sponsor_click'].includes(args[1]));
  const transport = async () => { const script = [...document.head.querySelectorAll('script')].find(node => node.src.startsWith('https://www.googletagmanager.com/gtag/js')); assert(script, 'expected the simulated consent-approved transport'); script.onload(); await settle(); };
  const imageLoad = async () => { const img = slot()?.querySelector('img'); assert(img, 'a mounted banner image is required'); Object.defineProperty(img, 'naturalWidth', {value: 728, configurable: true}); Object.defineProperty(img, 'complete', {value: true, configurable: true}); img.onload(); await settle(); };
  const visibility = async (ratio = 1, isIntersecting = true) => { const current = slot(); assert(current, 'a mounted slot is required'); for (const observer of intersections) if (observer.active && observer.targets.has(current)) observer.callback([{target: current, isIntersecting, intersectionRatio: ratio}]); await settle(); };
  const dispatchClick = ({button = 0, type = 'click', prevented = false, anchor = slot()?.querySelector('a')} = {}) => { assert(anchor); const event = new domWindow.Event(type, {bubbles: true, cancelable: true}); Object.defineProperty(event, 'button', {value: button}); if (prevented) event.preventDefault(); anchor.dispatchEvent(event); return event; };
  const click = async options => { const event = dispatchClick(options); await settle(); return event; };
  const consent = async value => { const panel = document.querySelector('.kd-privacy-banner'); panel.querySelector(value ? '[data-allow]' : '[data-decline]').onclick(); await settle(); };
  async function navigate(next, {replace = true, notify = true, canonical = next} = {}) {
    root.location.pathname = next;
    document.querySelector('link[rel="canonical"]').href = 'https://kingshotdata.kr' + canonical;
    if (replace) { const main = document.querySelector('main'); const wrap = document.createElement('div'); wrap.innerHTML = mainHTML('New guide'); main.replaceWith(wrap.firstElementChild); }
    if (notify) root.dispatchEvent({type: 'kd:page-ready'});
    await settle();
  }
  run('sponsors'); await settle();
  return {root, document, domWindow, run, settle, advance, slot, events, transport, imageLoad, visibility, click, dispatchClick, consent, navigate, emitted, requests, store, timers, raf, intersections, mutations,
    setFetch: handler => { fetchHandler = handler; }, setConfig: next => { config = clone(next); },
    reload: async next => { if (next) config = clone(next); const result = await root.KD_SPONSORS.reload(); await settle(); return result; },
    allowStyles: async () => { autoStyles = true; await settle(); },
    now: () => now, jumpClockWithoutTimers: milliseconds => { now += milliseconds; }, close: () => root.KD_SPONSORS.destroy()};
}

let assertions = 0;
const check = (value, message) => { assertions++; assert(value, message); };
(async () => {
  // Manual disable is globally off, with no style/image requests or slots.
  {
    const t = await setup({config: DRAFT});
    check(!t.slot(), 'a manually disabled campaign must not render');
    check(!t.document.querySelector('link[data-kd-sponsor-style]'), 'disabled campaigns do not load sponsor CSS');
    check(t.root.KD_SPONSORS.measurementContext('guide_after_intro') === null, 'disabled campaigns cannot be measured');
    check(t.intersections.length === 0 && t.mutations.length === 0, 'disabled campaigns have no body observers');
    check(t.requests.length === 1, 'disabled campaigns fetch once without a recurring timer');
    let prepared = 'pending'; t.root.KD_SPONSORS.ready.then(value => { prepared = value; }); await t.settle();
    assert.equal(prepared, false, 'disabled preparation resolves without requesting CSS');
    assert.equal(t.root.KD_SPONSORS.mountSync(), false, 'disabled synchronous mounting remains a no-op');
    await t.advance(120000); check(t.requests.length === 1, 'disabled campaign stays idle'); t.close();
  }
  // Initial preparation must not depend on reader mounting: the reader waits for
  // it while keeping the original document visible. The final insertion is sync.
  {
    const t = await setup({readerPending: true, autoStyles: false});
    const original = t.document.querySelector('main').outerHTML;
    let prepared = 'pending'; t.root.KD_SPONSORS.ready.then(value => { prepared = value; }); await t.settle();
    assert.equal(prepared, 'pending'); check(!t.slot(), 'preparing CSS does not mount into the original document');
    assert.equal(t.root.KD_SPONSORS.mountSync(), false, 'unready CSS cannot be mounted synchronously');
    assert.equal(t.document.querySelector('main').outerHTML, original);
    await t.allowStyles(); assert.equal(prepared, true, 'ready resolves even while the reader content does not exist');
    check(!t.slot(), 'prepared resources alone do not insert into the pending reader');
    const main = t.document.querySelector('main'), wrapper = t.document.createElement('div'); wrapper.id = 'ks-guide-content'; main.before(wrapper); wrapper.append(main);
    assert.equal(t.root.KD_SPONSORS.mountSync(), true);
    check(!!t.slot(), 'mountSync inserts before any animation frame or promise continuation');
    assert.equal(main.querySelector('.hero').nextElementSibling, t.slot());
    assert.equal(t.root.KD_SPONSORS.mountSync(), true); assert.equal(t.document.querySelectorAll('[data-kd-sponsor]').length, 1);
    await t.settle(); assert.equal(t.document.querySelectorAll('[data-kd-sponsor]').length, 1, 'the later observer/reconcile cannot duplicate the synchronous slot');
    t.close();
  }
  {
    const t = await setup({readerPending: true, autoStyles: false}), original = t.document.querySelector('main').outerHTML;
    let prepared = 'pending'; t.root.KD_SPONSORS.ready.then(value => { prepared = value; });
    t.document.querySelector('link[data-kd-sponsor-style]').onerror(); await t.settle();
    assert.equal(prepared, false, 'CSS failure settles preparation instead of blocking the reader');
    assert.equal(t.root.KD_SPONSORS.mountSync(), false); check(!t.slot(), 'CSS failure does not expose an unstyled slot');
    assert.equal(t.document.querySelector('main').outerHTML, original, 'a sponsor preparation failure leaves existing content intact');
    t.close();
  }
  {
    const t = await setup({pathname: '/ko/guides/unapproved.html', autoStyles: false});
    assert.equal(await t.root.KD_SPONSORS.ready, false);
    assert.equal(await t.root.KD_SPONSORS.prepare('/ko/guides/still-unapproved.html'), false);
    check(!t.document.querySelector('link[data-kd-sponsor-style]'), 'preparing an unapproved destination does not load sponsor CSS');
    let prepared = 'pending'; t.root.KD_SPONSORS.prepare(guidePath('en')).then(value => { prepared = value; });
    await t.settle(); assert.equal(prepared, 'pending'); check(!t.slot(), 'target-path preparation cannot insert into the old unapproved page');
    await t.allowStyles(); assert.equal(prepared, true); check(!t.slot(), 'preloading CSS does not authorize the current page');
    assert.equal(t.requests.length, 1, 'target preparation reuses the validated campaign without another fetch');
    t.root.location.pathname = guidePath('en'); t.document.querySelector('link[rel="canonical"]').href = 'https://kingshotdata.kr' + guidePath('en');
    assert.equal(t.root.KD_SPONSORS.mountSync(), true); assert.equal(t.slot().lang, 'en');
    assert.equal(t.slot().querySelector('a').getAttribute('href'), DRAFT.creatives.en.href);
    t.close();
  }
  // Execute all four real published guide documents, not just a synthetic tree.
  for (const locale of LOCALES) {
    const page = guidePath(locale), html = fs.readFileSync(path.join(ROOT, page.slice(1)), 'utf8');
    const t = await setup({pathname: page, html});
    const banner = t.slot(); check(!!banner, locale + ' actual guide must find a safe introduction');
    const c = DRAFT.creatives[locale], anchor = banner.querySelector('a'), img = banner.querySelector('img');
    assert.equal(anchor.getAttribute('href'), c.href); assert.equal(new URL(anchor.href).searchParams.get('aff_short'), 'kingshot');
    assert(anchor.rel.split(' ').includes('sponsored')); assert(anchor.rel.split(' ').includes('nofollow'));
    assert.equal(img.getAttribute('src'), c.image); assert.equal(img.width, 728); assert.equal(img.height, 90);
    assert.equal(banner.querySelector('.kd-sponsor__label').textContent, c.label);
    assert.equal(banner.lang, locale === 'zh-tw' ? 'zh-Hant' : locale);
    check(t.root.KD_SPONSORS.measurementContext('guide_after_intro') === null, 'unloaded images have no measurable impression or click');
    await t.imageLoad(); await t.transport(); await t.visibility(0.5); await t.advance(999);
    assert.equal(t.events().length, 0); await t.advance(1);
    assert.equal(t.events().length, 1); assert.equal(t.events()[0][1], 'sponsor_impression');
    await t.click(); assert.equal(t.events().length, 2); assert.equal(t.events()[1][1], 'sponsor_click');
    const payload = t.events()[1][2]; assert.equal(payload.language, locale); assert.equal(payload.page_path, page); assert.equal(payload.placement_id, 'guide_after_intro');
    assert(!JSON.stringify(t.root.dataLayer).includes('private'), 'query, hash and raw page title never reach GA');
    assert(Object.isFrozen(t.root.KD_SPONSORS.measurementContext('guide_after_intro')));
    assert.equal(t.requests.length, 1); t.close();
  }
  {
    const t = await setup({pathname: '/ko/guides/unapproved.html'});
    check(!t.slot(), 'a real-looking but unapproved guide must remain ad-free');
    await t.navigate(guidePath(), {canonical: guidePath('en')}); check(!t.slot(), 'stale canonical during language changes must block mounting');
    await t.navigate(guidePath()); check(!!t.slot(), 'matching approved path may mount');
    t.root.location.pathname = '/ko/guides/unapproved.html'; check(t.root.KD_SPONSORS.measurementContext('guide_after_intro') === null, 'path authorization is checked synchronously before a rerender');
    t.close();
  }
  {
    const t = await setup(); check(!!t.slot(), 'manual activation does not need campaign dates');
    await t.imageLoad();
    t.jumpClockWithoutTimers(366 * 86400000); await t.settle();
    check(!!t.slot() && !!t.root.KD_SPONSORS.measurementContext('guide_after_intro'), 'a full year cannot expire the campaign');
    await t.reload({...activeConfig(), enabled: false});
    check(!t.slot(), 'manual disable removes the banner without navigation');
    check(t.root.KD_SPONSORS.measurementContext('guide_after_intro') === null, 'manual disable clears attribution');
    await t.reload(activeConfig()); check(!!t.slot(), 'manual reactivation restores the banner'); t.close();
  }
  // Native navigation must be authorized at the instant of primary/middle click,
  // even when route cleanup is still waiting in the next browser frame.
  for (const options of [{type: 'click', button: 0}, {type: 'auxclick', button: 1}]) {
    const t = await setup(); await t.imageLoad(); await t.transport();
    const anchor = t.slot().querySelector('a'); t.root.location.pathname = '/ko/guides/unapproved.html';
    t.root.dispatchEvent({type: 'kd:page-ready'}); assert(t.slot(), 'the old slot still exists before the pending frame');
    const event = t.dispatchClick({...options, anchor});
    check(event.defaultPrevented, 'unapproved-path ' + options.type + ' is blocked synchronously');
    assert.equal(t.slot(), null, 'stale path slot is removed before returning from its listener');
    assert.equal(t.events().length, 0); await t.settle(); assert.equal(t.slot(), null); t.close();
  }
  for (const options of [{type: 'click', button: 0}, {type: 'auxclick', button: 1}]) {
    const t = await setup(); await t.imageLoad(); await t.transport();
    t.jumpClockWithoutTimers(366 * 86400000);
    const event = t.dispatchClick(options);
    check(!event.defaultPrevented, 'a future-date ' + options.type + ' remains available until manual disable');
    assert(t.slot()); assert.equal(t.events().length, 1); t.close();
  }
  for (const options of [{type: 'click', button: 0}, {type: 'auxclick', button: 1}]) for (const href of ['https://example.invalid/unapproved', DRAFT.creatives.ko.href.replace('aff_short=kingshot', 'aff_short=another'), DRAFT.creatives.ko.href + '&email=private@example.test']) {
    const t = await setup(); await t.imageLoad(); await t.transport();
    const anchor = t.slot().querySelector('a'); anchor.href = href;
    const event = t.dispatchClick({...options, anchor});
    check(event.defaultPrevented, 'a changed destination/referral/query cannot navigate through ' + options.type);
    assert.equal(t.slot(), null); assert.equal(t.events().length, 0); t.close();
  }
  for (const consent of [null, false]) for (const options of [{type: 'click', button: 0}, {type: 'auxclick', button: 1}]) {
    const t = await setup({consent}); await t.imageLoad();
    const event = t.dispatchClick(options);
    check(!event.defaultPrevented, 'valid ' + options.type + ' remains navigable without analytics consent');
    assert(t.slot(), 'privacy choice must not remove a valid nonpersonal advertisement');
    assert.equal(t.events().length, 0); assert(!t.document.querySelector('script[src^="https://www.googletagmanager.com"]')); t.close();
  }
  {
    const t = await setup(); await t.imageLoad(); await t.transport();
    const originalText = t.document.querySelector('#details').textContent, originalContents = t.document.querySelector('#contents').outerHTML;
    await t.visibility(); await t.advance(1000); assert.equal(t.events().length, 1);
    const api = t.root.KD_SPONSORS, listenerCount = t.root.listeners.get('kd:page-ready').length;
    t.run('sponsors'); t.run('hub-metrics'); await t.settle(); assert.equal(t.root.KD_SPONSORS, api);
    assert.equal(t.root.listeners.get('kd:page-ready').length, listenerCount);
    for (const name of ['kd:page-ready','popstate','pageshow']) t.root.dispatchEvent({type: name});
    await t.settle(); assert.equal(t.document.querySelectorAll('[data-kd-sponsor]').length, 1); assert.equal(t.events().length, 1);
    assert.equal(t.document.querySelector('#details').textContent, originalText); assert.equal(t.document.querySelector('#contents').outerHTML, originalContents);
    // DOM-only reader replacement is detected even without its readiness event.
    await t.navigate(guidePath(), {notify: false}); check(!!t.slot(), 'DOM replacement remounts once'); await t.imageLoad(); await t.visibility(); await t.advance(1000);
    assert.equal(t.events().length, 1, 'same visit and creative do not get a second impression after a remount');
    await t.navigate(guidePath('en')); await t.imageLoad(); await t.visibility(); await t.advance(1000);
    assert.equal(t.events().length, 2); assert.equal(t.events()[1][2].language, 'en');
    await t.navigate(guidePath()); t.root.dispatchEvent({type: 'popstate'}); await t.settle(); await t.imageLoad(); await t.visibility(); await t.advance(1000);
    assert.equal(t.document.querySelectorAll('[data-kd-sponsor]').length, 1); assert.equal(t.events().length, 3, 'return visits may earn a fresh viewable impression');
    await t.click({prevented: true}); await t.click({button: 2}); assert.equal(t.events().length, 3);
    await t.click({button: 1, type: 'auxclick'}); assert.equal(t.events().length, 4, 'a middle-button outbound click is measurable once');
    t.close(); check(!t.slot(), 'destroy removes the slot'); check(!t.mutations.some(item => item.active), 'destroy disconnects observers');
  }
  {
    const t = await setup({autoStyles: false}); check(!t.slot(), 'CSS must be ready before the slot can affect layout');
    await t.navigate(guidePath('en')); await t.allowStyles();
    assert.equal(t.document.querySelectorAll('[data-kd-sponsor]').length, 1); assert.equal(t.slot().dataset.sponsorPath, guidePath('en'), 'delayed CSS cannot mount an old route');
    t.close();
  }
  {
    const t = await setup(); await t.imageLoad(); const old = deferred();
    t.setFetch(() => old.promise); const first = t.root.KD_SPONSORS.reload();
    t.setFetch(async () => ({ok: true, json: async () => clone(DRAFT)})); await t.root.KD_SPONSORS.reload(); await t.settle(); check(!t.slot(), 'new disabled response removes the previous slot');
    old.resolve({ok: true, json: async () => activeConfig()}); await first; await t.settle();
    check(!t.slot() && !t.root.KD_SPONSORS.status().enabled, 'stale enabled response cannot reactivate a newer disabled configuration'); t.close();
  }
  {
    const t = await setup(); t.slot().querySelector('img').onerror(); await t.settle();
    check(!t.slot(), 'broken artwork removes its complete slot');
    t.root.KD_SPONSORS.refresh(); await t.settle(); check(!t.slot(), 'broken artwork does not enter a remount loop');
    check(t.root.KD_SPONSORS.measurementContext('guide_after_intro') === null, 'failed images cannot be attributed'); t.close();
  }
  {
    const t = await setup({autoStyles: false}); const link = t.document.querySelector('link[data-kd-sponsor-style]'); assert(link); link.onerror(); await t.settle();
    check(!t.slot(), 'failed CSS never flashes an unstyled advertisement'); t.close();
  }
  for (const failure of [async () => { throw Error('offline'); }, async () => ({ok: false}), async () => ({ok: true, json: async () => ({enabled: true})})]) {
    const t = await setup(); await t.imageLoad(); t.setFetch(failure); await t.root.KD_SPONSORS.reload(); await t.settle();
    check(!t.slot(), 'network, HTTP and invalid JSON config errors fail closed'); check(t.root.KD_SPONSORS.measurementContext('guide_after_intro') === null, 'configuration failure cannot continue tracking'); t.close();
  }
  {
    const t = await setup(); await t.imageLoad(); await t.transport();
    await t.visibility(0.49); await t.advance(2000); assert.equal(t.events().length, 0);
    await t.visibility(0.8); await t.advance(600); await t.visibility(0.1); await t.advance(800); assert.equal(t.events().length, 0, 'non-contiguous visible intervals cannot accumulate');
    await t.visibility(0.8); await t.advance(600); t.document.visibilityState = 'hidden'; t.document.dispatchEvent(new t.domWindow.Event('visibilitychange')); await t.settle(); await t.advance(1000); assert.equal(t.events().length, 0, 'hidden documents cannot earn impressions');
    t.document.visibilityState = 'visible'; t.document.dispatchEvent(new t.domWindow.Event('visibilitychange')); await t.settle(); await t.advance(999); assert.equal(t.events().length, 0); await t.advance(1); assert.equal(t.events().length, 1);
    await t.visibility(); await t.advance(1500); assert.equal(t.events().length, 1, 'one viewable impression per visit'); t.close();
  }
  {
    const t = await setup(); await t.imageLoad(); await t.transport(); await t.visibility(0.6); await t.advance(500);
    const stricter = activeConfig(); stricter.viewability.ratio = 1; stricter.viewability.milliseconds = 2000;
    await t.reload(stricter); await t.advance(600);
    assert.equal(t.events().length, 0, 'new viewability settings must invalidate the old visibility state and pending timer');
    await t.imageLoad(); await t.visibility(0.6); await t.advance(2500); assert.equal(t.events().length, 0);
    await t.visibility(1); await t.advance(1999); assert.equal(t.events().length, 0); await t.advance(1); assert.equal(t.events().length, 1);
    t.close();
  }
  {
    const t = await setup(); await t.imageLoad(); const before = t.slot(), oldImage = before.querySelector('img');
    const changed = activeConfig(); changed.creatives.ko.alt = 'Updated advertisement artwork'; changed.creatives.ko.mobileText = 'Updated sponsor message'; changed.creatives.ko.action = 'Updated action';
    await t.reload(changed); check(t.slot() !== before, 'same-ID creative text changes replace the rendered view');
    assert.equal(t.slot().querySelector('img').alt, changed.creatives.ko.alt);
    assert.equal(t.slot().querySelector('.kd-sponsor__mobile strong').textContent, changed.creatives.ko.mobileText);
    assert.equal(t.slot().querySelector('.kd-sponsor__action').textContent, changed.creatives.ko.action);
    assert.equal(t.root.KD_SPONSORS.measurementContext('guide_after_intro'), null);
    oldImage.onload(); check(t.root.KD_SPONSORS.measurementContext('guide_after_intro') === null, 'an old image load cannot mark its replacement ready');
    await t.imageLoad(); check(!!t.root.KD_SPONSORS.measurementContext('guide_after_intro'), 'replacement artwork becomes measurable only when loaded'); t.close();
  }
  for (const initialConsent of [null, false]) {
    const t = await setup({consent: initialConsent}); await t.imageLoad(); await t.visibility(); await t.advance(2000); await t.click(); assert.equal(t.events().length, 0);
    check(!t.document.querySelector('script[src^="https://www.googletagmanager.com"]'), 'no GA loader without consent');
    await t.consent(true); await t.transport(); await t.advance(999); assert.equal(t.events().length, 0, 'pre-consent visible time or clicks are not replayed'); await t.advance(1); assert.equal(t.events().length, 1);
    await t.click(); assert.equal(t.events().length, 2); await t.consent(false); await t.click(); assert.equal(t.events().length, 2, 'revocation blocks new click measurements'); t.close();
  }
  {
    const t = await setup(); await t.imageLoad(); await t.visibility(); await t.advance(1000); await t.click(); assert.equal(t.events().length, 0, 'loading transport queues consented events');
    await t.navigate(guidePath('en')); await t.imageLoad(); await t.click(); await t.transport();
    assert.deepEqual(t.events().map(event => event[2].page_path), [guidePath(),guidePath(),guidePath('en')], 'queued attribution remains attached to its original page'); t.close();
  }
  {
    const t = await setup(); await t.imageLoad(); await t.visibility(); await t.advance(1000); await t.click(); await t.consent(false); await t.transport(); assert.equal(t.events().length, 0, 'revocation discards pending impressions and clicks'); t.close();
  }
  for (const hostname of ['localhost','127.0.0.1','preview.kingshotdata.kr']) {
    const t = await setup({hostname}); await t.imageLoad(); await t.visibility(); await t.advance(1000); await t.click(); assert.equal(t.events().length, 0); assert(!t.document.querySelector('script[src^="https://www.googletagmanager.com"]')); t.close();
  }
  {
    const t = await setup({noIntersectionObserver: true}); await t.imageLoad(); await t.transport(); await t.advance(2000); assert.equal(t.events().length, 0, 'unsupported visibility APIs do not guess impressions'); await t.click(); assert.equal(t.events().length, 1, 'click tracking does not require visibility observation'); t.close();
  }
  console.log('Sponsor runtime integration passed: 4 real locale guides; manual enable/disable and allowlist without expiry; CSS and image readiness; SPA/replacement/back; deduplication; stale fetches; failures; continuous viewability; real metrics and consent/queue/privacy gates (' + assertions + ' named checks plus payload and lifecycle assertions). No network requests were made.');
})().catch(error => { console.error(error); process.exitCode = 1; });

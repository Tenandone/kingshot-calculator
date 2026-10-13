'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
const source = Object.fromEntries(['operator-profile-config', 'operator-profile-view', 'operator-profile'].map(name => [name, fs.readFileSync(path.join(ROOT, 'js', name + '.js'), 'utf8')]));

// These fixtures execute the real profile modules, with a small browser adapter.
// parse5 is an existing development dependency. No browser or package install is
// required. Calculator computation, CSS layout and trusted user events remain
// separate browser checks; this suite covers the profile's DOM/event lifecycle.
async function main() {
 const {parseFragment} = await import('parse5');
 let checks = 0;
 function eventTarget() {
  const listeners = new Map();
  return {listeners, addEventListener(type, fn, options) { const list = listeners.get(type) || []; list.push({fn, once: !!options?.once}); listeners.set(type, list); },
   dispatchEvent(event) { if (!event.target) event.target = this; for (const entry of [...(listeners.get(event.type) || [])]) { entry.fn.call(this, event); if (entry.once) listeners.set(event.type, listeners.get(event.type).filter(item => item !== entry)); } return true; }};
 }
 function setup(kind = 'gear', language = 'ko') {
  const raf = [], observers = [], metrics = [];
  let doc;
  const notify = record => { for (const observer of observers) { if (!observer.host || !(observer.host === record.target || observer.host.contains(record.target))) continue; if (record.type === 'attributes' && (!observer.options.attributes || observer.options.attributeFilter && !observer.options.attributeFilter.includes(record.attributeName))) continue; if (record.type === 'childList' && !observer.options.childList) continue; observer.records.push(record); }};
  function simple(node, selector) {
   if (!node || node.nodeType !== 1) return false;
   const tag = selector.match(/^[a-z][\w-]*/i)?.[0];
   if (tag && node.tagName.toLowerCase() !== tag.toLowerCase()) return false;
   for (const match of selector.matchAll(/#([\w-]+)/g)) if (node.id !== match[1]) return false;
   for (const match of selector.matchAll(/\.([\w-]+)/g)) if (!node.className.split(/\s+/).includes(match[1])) return false;
   for (const match of selector.matchAll(/\[([^\]=]+)(?:=["']?([^\]"']*)["']?)?\]/g)) if (!node.hasAttribute(match[1]) || match[2] !== undefined && node.getAttribute(match[1]) !== match[2]) return false;
   if (selector.includes(':checked') && !node.checked) return false;
   return true;
  }
  function matches(node, selector) {
   return selector.split(',').some(group => {
    const tokens = group.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/);
    let cursor = node, index = tokens.length - 1;
    if (!simple(cursor, tokens[index--])) return false;
    while (index >= 0) {
     if (tokens[index] === '>') { cursor = cursor.parentNode; index--; if (!simple(cursor, tokens[index--])) return false; }
     else { let parent = cursor.parentNode; while (parent && !simple(parent, tokens[index])) parent = parent.parentNode; if (!parent) return false; cursor = parent; index--; }
    }
    return true;
   });
  }
  class Element {
   constructor(tag, attrs = []) { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attributes = new Map(attrs.map(a => [a.name, a.value])); this.children = []; this.parentNode = null; this.value = this.getAttribute('value') || ''; this.checked = this.hasAttribute('checked'); this._style = {}; this.style = new Proxy(this._style, {set: (object, key, value) => { if (object[key] !== value) { object[key] = value; notify({type:'attributes', target:this, attributeName:'style', addedNodes:[]}); } return true; }}); const css = this.getAttribute('style') || ''; for (const item of css.split(';')) { const [key, value] = item.split(':'); if (value) this._style[key.trim()] = value.trim(); } }
   get id() { return this.getAttribute('id') || ''; }
   get className() { return this.getAttribute('class') || ''; }
   get dataset() { return Object.fromEntries([...this.attributes].filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value])); }
   get hidden() { return this.hasAttribute('hidden'); }
   set hidden(value) { if (value) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
   get disabled() { return this.hasAttribute('disabled'); }
   set disabled(value) { if (value) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }
   get isConnected() { return this === doc.body || !!this.parentNode?.isConnected; }
   get textContent() { return this.children.map(child => child.textContent).join(''); }
   getAttribute(name) { return this.attributes.get(name) ?? null; }
   hasAttribute(name) { return this.attributes.has(name); }
   setAttribute(name, value) { value = String(value); if (this.attributes.get(name) !== value) { this.attributes.set(name, value); notify({type:'attributes', target:this, attributeName:name, addedNodes:[]}); } }
   removeAttribute(name) { if (this.attributes.delete(name)) notify({type:'attributes', target:this, attributeName:name, addedNodes:[]}); }
   contains(node) { return this === node || this.children.some(child => child.nodeType === 1 && child.contains(node)); }
   matches(selector) { return matches(this, selector); }
   closest(selector) { for (let node = this; node?.nodeType === 1; node = node.parentNode) if (node.matches(selector)) return node; return null; }
   querySelectorAll(selector) { const result = []; const walk = node => { for (const child of node.children) if (child.nodeType === 1) { if (child.matches(selector)) result.push(child); walk(child); } }; walk(this); return result; }
   querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
   remove() { if (!this.parentNode) return; const parent = this.parentNode; parent.children.splice(parent.children.indexOf(this), 1); this.parentNode = null; notify({type:'childList', target:parent, addedNodes:[]}); }
   appendChild(child) { if (child.parentNode) child.remove(); child.parentNode = this; this.children.push(child); notify({type:'childList', target:this, addedNodes:[child]}); return child; }
   set innerHTML(html) { for (const child of this.children) child.parentNode = null; this.children = []; for (const child of parse(html)) { child.parentNode = this; this.children.push(child); } notify({type:'childList', target:this, addedNodes:[...this.children]}); }
   insertAdjacentHTML(where, html) { const nodes = parse(html); if (where === 'beforeend') { for (const node of nodes) this.appendChild(node); } else if (where === 'afterend') { const parent = this.parentNode; let index = parent.children.indexOf(this) + 1; for (const node of nodes) { node.parentNode = parent; parent.children.splice(index++, 0, node); } notify({type:'childList', target:parent, addedNodes:nodes}); } else throw Error('Unsupported fixture insertion: ' + where); }
  }
  function parse(html) { const convert = parsed => { if (parsed.nodeName === '#text') return {nodeType:3, textContent:parsed.value, parentNode:null}; const element = new Element(parsed.tagName, parsed.attrs); element.children = (parsed.childNodes || []).map(convert); for (const child of element.children) child.parentNode = element; return element; }; return parseFragment(String(html)).childNodes.filter(node => node.tagName || node.nodeName === '#text').map(convert); }
  doc = {...eventTarget(), readyState:'complete', body:new Element('body'), querySelector(selector) { return this.body.querySelector(selector); }, querySelectorAll(selector) { return this.body.querySelectorAll(selector); }};
  const location = new URL('https://kingshotdata.kr/' + (language === 'ko' ? '' : language + '/') + 'calc-' + kind + '/');
  let signature = 'current-inputs';
  const root = {...eventTarget(), document:doc, location, console, requestAnimationFrame:fn => { raf.push(fn); return raf.length; }, KD_CALCULATOR_SIGNATURE:() => signature,
   KD_METRICS:{emit:(name, data) => metrics.push({name, ...data})}, MutationObserver:class { constructor(callback) { this.callback = callback; this.records = []; observers.push(this); } observe(host, options) { this.host = host; this.options = options; } }};
  root.window = root;
  const context = vm.createContext(root);
  const run = name => vm.runInContext(source[name], context, {filename:name + '.js'});
  const query = selector => doc.querySelector(selector);
  const flush = () => { let loops = 0; while (raf.length || observers.some(o => o.records.length)) { assert(++loops < 50, 'MutationObserver/animation frame must settle without a render loop'); for (const observer of observers) if (observer.records.length) { const records = observer.records.splice(0); observer.callback(records); } const frames = raf.splice(0); for (const fn of frames) fn(); } };
  const emit = (type, detail) => root.dispatchEvent({type, detail});
  const action = (selector, type = 'change') => { const target = query(selector); assert(target, 'Missing action target ' + selector); doc.dispatchEvent({type, target}); };
  const parts = {gear:{mount:'gear-calc', tbody:'gc-tbody', head:'gc-head-row', detail:'gear-details', section:'gc-section', mobile:'gc-mobile-details'}, charm:{mount:'charm-calc', tbody:'cc-tbody', head:'cc-head-row', detail:'cc-details', section:'cc-section', mobile:'cc-mobile-details'}, pet:{mount:'pet-calc', tbody:'pc-tbody', head:'pc-head-row', detail:'pc-detail', section:'pc-section', mobile:'pc-mobile-detail'}};
  const controls = {gear:'<input name="slot" type="checkbox" checked><select id="current"><option value="0">0</option></select><select id="target"><option value="1">1</option></select><button id="gc-copy" disabled>Copy</button><button id="gc-reset">Reset</button><button id="gc-quick-clear">Clear</button><button id="gc-quick-all">All</button>', charm:'<input class="cc-unit-count" value="1"><select id="current"><option value="0">0</option></select><select id="target"><option value="1">1</option></select><button id="cc-clear">Clear</button><button id="cc-fill18">Fill</button>', pet:'<select id="pc-pet"><option value="graywolf">Gray Wolf</option></select><select id="pc-from"><option value="0">1</option></select><select id="pc-to"><option value="1">2</option></select><button class="pc-pet-btn" data-pet-id="graywolf">Gray Wolf</button>'};
  function mount(nextKind = kind) { kind = nextKind; const p = parts[kind]; query('#content').innerHTML = p ? `<div id="${p.mount}">${controls[kind]}<section class="${p.section}"><div class="${p.detail}" style="display:none"><table><thead><tr id="${p.head}"></tr></thead><tbody id="${p.tbody}"></tbody></table></div><div id="${p.mobile}"></div></section></div><section class="calc-workbench"><input data-inventory="food" value="0"></section><section data-kd-personal><button id="kd-restore-goal">Restore</button></section>` : '<div id="inactive-calc"><div id="result"><table><tbody><tr><td>Old result</td></tr></tbody></table></div></div>'; if (kind === 'pet') { query('#pc-from').value = '0'; query('#pc-to').value = '1'; query('#pc-pet').value = 'graywolf'; } }
  doc.body.innerHTML = '<main id="content"></main><footer class="site-footer"><div class="container"></div></footer>';
  mount();
  for (const name of ['operator-profile-config', 'operator-profile-view', 'operator-profile']) run(name);
  flush();
  function result() { const p = parts[kind]; query('#' + p.tbody).innerHTML = '<tr><td>150</td></tr><tr><td>Total 150</td></tr>'; query('#' + p.head).innerHTML = '<th>Cost</th>'; query('.' + p.detail).style.display = ''; if (kind === 'gear') query('#gc-copy').disabled = false; }
  function clear() { const p = parts[kind]; query('#' + p.tbody).innerHTML = ''; query('#' + p.head).innerHTML = ''; query('.' + p.detail).style.display = 'none'; if (kind === 'gear') query('#gc-copy').disabled = true; }
  function calculated(event = 'kd:calculated', data = {}) { emit(event, {kind, resources:[{key:'food', required:150}], ...data}); }
  const intent = () => action(kind === 'pet' ? '.pc-pet-btn' : '#current', kind === 'pet' ? 'click' : 'change');
  const count = () => doc.querySelectorAll('[data-ten-profile="calculator_result"]').length;
  const expect = (number, message) => { flush(); assert.equal(count(), number, language + '/' + kind + ': ' + message); checks++; };
  return {root, doc, context, run, flush, emit, action, query, parts, metrics, location, mount, result, clear, calculated, intent, count, expect, setSignature:value => { signature = value; }};
 }

 for (const language of ['ko', 'en', 'ja', 'zh-tw']) for (const kind of ['gear', 'charm', 'pet']) {
  const t = setup(kind, language);
  t.expect(0, 'initial empty state is hidden');
  t.calculated(); t.result(); t.expect(0, 'initial automatic success must not arm a profile, including pet');
  t.intent(); t.expect(0, 'intent without a new success remains hidden');
  t.clear(); t.calculated(); t.expect(0, 'success event without result rows remains hidden');
  t.result(); t.expect(1, 'rows published after success become eligible');
  const profile = t.query('[data-ten-profile]'), p = t.parts[kind];
  assert.equal(profile.dataset.tenLocale, language);
  assert.equal(profile.getAttribute('lang'), language === 'zh-tw' ? 'zh-Hant' : language);
  assert(profile.textContent.includes(t.root.KD_OPERATOR_PROFILE_CONFIG.locales[language].role));
  assert.equal(profile.parentNode, t.query('#' + p.mount), 'profile is a sibling of the full result section');
  assert.equal(profile.closest('.' + p.detail + ',#' + p.mobile), null, 'profile is outside desktop/mobile-only wrappers');
  assert.equal(profile.parentNode.children.indexOf(profile), profile.parentNode.children.indexOf(t.query('.' + p.section)) + 1);
  const link = profile.querySelector('a[data-ten-tiktok]');
  assert.equal(link.getAttribute('href'), t.root.KD_OPERATOR_PROFILE_CONFIG.url);
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  t.doc.dispatchEvent({type:'click', target:link}); t.flush();
  assert.equal(t.metrics.length, 1);
  assert.equal(t.metrics[0].name, 'ten_tiktok_click');
  assert.equal(t.metrics[0].language, language);
  t.calculated('kd:result-ready'); t.emit('kd:page-ready'); t.run('operator-profile'); t.expect(1, 'duplicate events and script execution do not duplicate profiles');
  if (kind === 'gear') { t.action('#gc-copy', 'click'); t.expect(1, 'copying an existing result does not invalidate it'); }
  t.clear(); t.expect(0, 'direct native reset DOM clears profile even with stale global result');
  t.intent(); t.calculated(); t.result(); t.expect(1, 'success event before DOM mutation in one turn shows once');
  t.query('[data-inventory]').setAttribute('aria-invalid', 'true'); t.expect(0, 'invalid inventory comparison hides profile');
  t.query('[data-inventory]').removeAttribute('aria-invalid'); t.expect(1, 'corrected inventory retains current base result');
  t.setSignature('silent-changed-input'); t.emit('kd:page-ready'); t.expect(0, 'stale input signature rejects otherwise populated DOM');
  t.intent(); t.calculated(); t.result(); t.expect(1, 'a new calculation for changed inputs is eligible');
  t.query('#content').insertAdjacentHTML('beforeend', '<div data-calculation-blocked role="status">Blocked</div>'); t.clear(); t.expect(0, 'blocked policy hides a previously valid profile');
  t.query('[data-calculation-blocked]').remove(); t.expect(0, 'removing blocked message alone does not fabricate result rows');
  t.action('#kd-restore-goal', 'click'); t.calculated(); t.result(); t.expect(1, 'restoration requires a fresh successful calculation');
  t.mount(); t.calculated(); t.result(); t.emit('kd:page-ready'); t.expect(0, 'same-route new SPA mount does not inherit old intent');
  t.intent(); t.calculated(); t.result(); t.expect(1, 'new SPA mount accepts new interaction');
  t.location.pathname = '/' + (language === 'ko' ? '' : language + '/') + 'calc-training/'; t.mount('training'); t.emit('popstate'); t.expect(0, 'navigation to an inactive calculator removes profile');
 }

 for (const kind of ['gear', 'charm', 'pet']) {
  const t = setup(kind);
  t.action('#kd-restore-goal', 'click'); t.expect(0, 'saved goal button alone is not a successful result');
  t.calculated(); t.result(); t.expect(1, 'saved goal can arm a previously untouched mount');
  t.query('.' + t.parts[kind].detail).hidden = true; t.expect(0, 'native hidden attribute excludes stale result');
 }
 for (const pathname of ['/calculator/', '/en/calculator/', '/ja/calculator/', '/zh-tw/calculator/', '/research/war-academy/', '/ko/database/governor-gear.html', '/en/guides/', '/coupons/']) {
  const t = setup('gear'); t.intent(); t.calculated(); t.result(); t.expect(1, 'excluded route transition setup');
  t.location.pathname = pathname; t.emit('hashchange'); t.calculated(); t.expect(0, 'calculator profile excluded at ' + pathname);
 }

 for (const kind of ['gear', 'charm', 'pet']) {
  const t = setup(kind); t.intent(); t.calculated(); t.result(); t.expect(1, 'clear test setup');
  const clearSelector = kind === 'gear' ? '#gc-reset' : kind === 'charm' ? '#cc-clear' : '#pc-from';
  t.action(clearSelector, kind === 'pet' ? 'change' : 'click');
  assert.equal(t.count(), 0, 'reset/clear/input invalidates immediately before next animation frame');
  t.clear(); t.expect(0, 'reset/clear does not reappear on mutation');
  t.intent(); t.result(); t.calculated('kd:calculated', {resources:[{required:0}, {required:NaN}]}); t.expect(0, 'zero/nonfinite resources are not success');
  t.calculated('kd:calculated', {kind:'training'}); t.expect(0, 'wrong calculator event is ignored');
  t.calculated(); t.expect(1, 'correct successful event recovers');
  if (kind === 'gear') { t.query('input[name="slot"]').checked = false; t.emit('kd:page-ready'); t.expect(0, 'no selected gear slot rejects stale rows'); }
  if (kind === 'charm') { t.query('.cc-unit-count').value = '0'; t.emit('kd:page-ready'); t.expect(0, 'zero charm count rejects stale rows'); }
  if (kind === 'pet') { t.query('#pc-to').value = '0'; t.emit('kd:page-ready'); t.expect(0, 'equal pet levels reject stale rows'); }
 }
 for (const language of ['ko', 'en', 'ja', 'zh-tw']) for (const kind of ['building', 'hero-gear', 'training', 'unknown']) {
  const t = setup(kind, language);
  t.root.KD_CALCULATOR_RESULT = {kind:'gear', resources:[{required:100}], signature:'current-inputs'};
  t.calculated('kd:calculated', {kind:'gear'}); t.emit('kd:result-ready', {kind:'pet', resources:[{required:150}]}); t.expect(0, 'inactive/unknown routes reject stale globals and success events');
 }
 {
  const t = setup('pet'); t.intent(); t.calculated(); t.result(); t.expect(1, 'load error setup');
  t.query('#pet-calc').innerHTML = '<p class="error">Unable to load data</p>'; t.expect(0, 'data load failure removes native result nodes');
 }
 console.log(`TEN profile: ${checks} lifecycle assertions passed across 12 active and 16 inactive/unknown locale routes; real config/view/runtime, initial auto-result, event-before-DOM, reset/clear, blocked/error, stale signature, inventory validity, SPA remount, placement structure and duplicate initialization verified.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });

/* Explicit editorial metadata only. Never changes URLs, content, images or data. */
(function (host, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (host && !host.KD_SEO_EDITORIAL) host.KD_SEO_EDITORIAL = api.start(host);
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const VERSION = 'ks-ui14-20261012';
  const ORIGIN = 'https://kingshotdata.kr';
  const META = Object.freeze([
    ['name','description','description'], ['property','og:title','title'],
    ['property','og:description','description'], ['name','twitter:title','title'],
    ['name','twitter:description','description']
  ]);
  const TYPES = new Set(['WebPage','CollectionPage','Article','NewsArticle','BlogPosting']);
  function pathKey(value) {
    if (typeof value !== 'string' || !value) return null;
    try {
      const url = new URL(value, ORIGIN);
      if (url.origin !== ORIGIN) return null;
      return url.pathname.replace(/\/index\.html$/i, '/').replace(/\/$/, '') || '/';
    } catch (_) { return null; }
  }
  function readModel(value) {
    if (!value || typeof value.version !== 'string' || !Array.isArray(value.pages)) throw Error('Invalid editorial metadata model');
    const pages = new Map();
    for (const entry of value.pages) {
      if (!entry || typeof entry.path !== 'string' || !entry.path.startsWith('/') || entry.path.startsWith('//') || /[?#]/.test(entry.path)
        || typeof entry.title !== 'string' || !entry.title.trim() || typeof entry.description !== 'string' || !entry.description.trim()) throw Error('Invalid editorial metadata entry');
      const key = pathKey(entry.path);
      if (!key || pages.has(key)) throw Error('Duplicate editorial metadata path');
      pages.set(key, {path:entry.path,title:entry.title,description:entry.description});
    }
    return {version:value.version,pages};
  }
  function selectEntry(model, pathname, canonical) {
    const entry = model?.pages.get(pathKey(pathname));
    return entry && pathKey(canonical) === pathKey(entry.path) ? entry : null;
  }
  function schemaOwner(node) {
    const value = node.url || node['@id'] || node.mainEntityOfPage;
    return typeof value === 'string' ? value : value && (value['@id'] || value.url);
  }
  function updateSchema(value, entry) {
    let changed = false;
    function visit(node) {
      if (Array.isArray(node)) return node.map(visit);
      if (!node || typeof node !== 'object') return node;
      const result = {...node};
      if (Array.isArray(node['@graph'])) result['@graph'] = node['@graph'].map(visit);
      const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
      if (!types.some(type => TYPES.has(type)) || pathKey(schemaOwner(node)) !== pathKey(entry.path)) return result;
      const keys = ['description'];
      if ('name' in node) keys.push('name');
      if ('headline' in node) keys.push('headline');
      if (!('name' in node) && !('headline' in node)) keys.push(types.some(type => /Article|BlogPosting/.test(type)) ? 'headline' : 'name');
      for (const key of keys) {
        const next = key === 'description' ? entry.description : entry.title;
        if (result[key] !== next) {result[key] = next;changed = true;}
      }
      return result;
    }
    const result = visit(value);
    return {value:result,changed};
  }
  function safeJson(value) { return JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029'); }
  function start(win) {
    const doc = win.document;
    let model = null, queued = false, observer = null, request = null, ready = false;
    const status = {state:'idle',version:null,lastPath:null,applications:0};
    function apply() {
      if (!model || !doc.head) return false;
      const canonical = doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href');
      const entry = selectEntry(model, win.location.pathname, canonical);
      if (!entry) return false;
      let changed = false;
      if (doc.title !== entry.title) {doc.title = entry.title;changed = true;}
      for (const [attribute,key,field] of META) {
        let nodes = [...doc.head.querySelectorAll('meta['+attribute+'="'+key+'"]')];
        if (!nodes.length) {
          const node = doc.createElement('meta');node.setAttribute(attribute,key);doc.head.appendChild(node);nodes = [node];
        }
        for (const node of nodes) if (node.getAttribute('content') !== entry[field]) {node.setAttribute('content',entry[field]);changed = true;}
      }
      for (const node of doc.head.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const result = updateSchema(JSON.parse(node.textContent),entry);
          if (result.changed) {node.textContent = safeJson(result.value);changed = true;}
        } catch (_) { /* Existing invalid structured data is not guessed or replaced. */ }
      }
      if (changed) status.applications++;
      status.lastPath = entry.path;
      return changed;
    }
    function schedule() {
      if (queued) return;
      queued = true;
      win.queueMicrotask(() => {queued = false;apply();});
    }
    function relevant(node) {
      const element = node?.nodeType === 1 ? node : node?.parentElement;
      return !!element?.matches?.('title,meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"],link[rel="canonical"],script[type="application/ld+json"]');
    }
    function observe() {
      if (observer || !doc.head) return;
      observer = new win.MutationObserver(records => {
        if (records.some(record => relevant(record.target) || [...record.addedNodes,...record.removedNodes].some(relevant))) schedule();
      });
      observer.observe(doc.head,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['content','href']});
    }
    function initialize() {
      if (ready) return;
      ready = true;observe();status.state = 'loading';
      request = win.fetch('/data/seo/editorial.json?v='+VERSION,{credentials:'same-origin',cache:'force-cache'})
        .then(response => {if (!response.ok) throw Error('Editorial metadata unavailable');return response.json();})
        .then(value => {model = readModel(value);status.state = 'ready';status.version = model.version;schedule();return true;})
        .catch(() => {status.state = 'unavailable';return false;});
    }
    for (const event of ['kd:page-ready','kd:catalog-ready','kd:planner-ready','popstate']) win.addEventListener(event,schedule);
    doc.addEventListener('i18n:changed',schedule);
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
    return Object.freeze({version:VERSION,apply,schedule,status,whenReady:() => request || Promise.resolve(false)});
  }
  return {VERSION,ORIGIN,META,pathKey,readModel,selectEntry,updateSchema,safeJson,start};
});

/* Display-only integration. No calculator, storage, consent, or validation APIs are replaced. */
(function (global, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (global && global.document) api.boot(global);
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  var protectedSelector = 'form,table,input,select,textarea,button,[data-verification-note],[data-calculation-blocked],.calc-workbench,.research-note,.research-facts,[data-kd-personal]';
  function routePath(value) {
    if (!value) return null;
    try {
      var url = new URL(value, 'https://kingshotdata.kr/');
      if (url.hostname !== 'kingshotdata.kr') return null;
      var p = url.hash.indexOf('#/') === 0 ? url.hash.slice(1) : url.pathname;
      return decodeURI(p).replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';
    } catch (_) { return null; }
  }
  function localeOf(pathname, declared) {
    var p = String(pathname || '').toLowerCase();
    if (/^\/(?:zh-tw|tw)(?:\/|$)/.test(p) || /^zh|^tw$/i.test(declared || '')) return 'zh-TW';
    var match = p.match(/^\/(ko|en|ja)(?:\/|$)/);
    return match ? match[1] : (/^(ko|en|ja)$/.test(declared || '') ? declared : 'ko');
  }
  function modelsFor(data, locale) { return Object.values(data.models && data.models[locale] || {}); }
  function routesFor(model) {
    var route = model.route || {};
    return [typeof route === 'string' ? route : route.canonical].concat(route.aliases || []).map(routePath).filter(Boolean);
  }
  function routeModel(models, path) {
    var key = routePath(path), matched = models.filter(function (m) { return routesFor(m).indexOf(key) !== -1; });
    return matched.length === 1 ? matched[0] : null;
  }
  function titleWithContext(previous, model) {
    if (previous.indexOf(model.title) !== -1) return previous;
    var old = [model.legacyTitle, model.legacyName].filter(Boolean).sort(function(a,b){return b.length-a.length;});
    for (var i = 0; i < old.length; i++) if (previous.indexOf(old[i]) !== -1) return previous.replace(old[i], model.title);
    var suffix = previous.indexOf('|') !== -1 ? ' | ' + previous.split('|').slice(1).join('|').trim() : '';
    return model.title + suffix;
  }
  function isResearch(model) { return /research/i.test(model.type || '') || /research/i.test(model.legacyId || ''); }
  function collectionMatches(model, current) {
    var value = model.collectionRoute;
    if (value && typeof value === 'object') value = value.canonical;
    return value && routePath(value) === routePath(current);
  }
  function researchModel(models, label, current) {
    var matches = models.filter(function (m) {
      return isResearch(m) && collectionMatches(m, current) && [m.legacyName, m.legacyTitle, m.title].indexOf(label.trim()) !== -1;
    });
    return matches.length === 1 ? matches[0] : null;
  }
  function researchForRecord(data,locale,record,branch) {
    var wanted=branch==='academy'?'academy':branch==='advanced-truegold'?'advanced-war-academy':branch;
    var matches=modelsFor(data,locale).filter(function(m){return isResearch(m)&&m.branch===wanted&&m.legacyName===record.name;});
    return matches.length===1?matches[0]:null;
  }
  function researchTitle(data,locale,record,branch) {
    var m=researchForRecord(data,locale,record,branch);
    return m&&m.titleApplied?m.title:record.name;
  }
  function researchMatches(data,locale,record,branch,query) {
    var m=researchForRecord(data,locale,record,branch), terms=[record.name];
    if(m&&m.titleApplied)terms=terms.concat([m.title],m.aliases||[]);
    var needle=String(query||'').toLocaleLowerCase();
    return terms.some(function(v){return typeof v==='string'&&v.toLocaleLowerCase().indexOf(needle)!==-1;});
  }
  function setText(node, model, field) {
    if (!node || !model || !model[field + 'Applied'] || typeof model[field] !== 'string' || !model[field].trim()) return false;
    if (node.closest(protectedSelector) || node.querySelector('input,select,textarea,button,table,form,img')) return false;
    node.setAttribute('data-kd-entity-id', model.bindingId);
    node.setAttribute('data-kd-field', field);
    if (node.textContent !== model[field]) node.textContent = model[field];
    return true;
  }
  function apply(doc, data, loc, declaredLocale) {
    var path = loc.hash && loc.hash.indexOf('#/') === 0 ? loc.hash.slice(1) : loc.pathname;
    var locale = localeOf(loc.pathname, declaredLocale), models = modelsFor(data, locale);
    if (locale === 'zh-TW' || !models.length) return {locale:locale, skipped:true};
    var detail = routeModel(models, path), changed = 0;
    // Previously bound nodes survive a locale event; newly rendered nodes are resolved below.
    doc.querySelectorAll('[data-kd-entity-id][data-kd-field]').forEach(function (node) {
      var m = data.models[locale][node.getAttribute('data-kd-entity-id')];
      if (setText(node, m, node.getAttribute('data-kd-field'))) changed++;
    });
    if (detail) {
      var h1 = doc.querySelector('#hero-root h1, #building-root .hero h1, main .hero h1, .item-detail h1, .ssg-initial-content h1, main h1');
      if (setText(h1, detail, 'title')) changed++;
      var description = doc.querySelector('#building-root .hero .sub, main .hero .sub');
      if (!description && /hero/i.test(detail.type || '')) {
        var root = doc.querySelector('#hero-root');
        if (root) {
          var summary = root.querySelector('h2');
          var next = summary && summary.nextElementSibling;
          if (next && next.tagName === 'HR') next = next.nextElementSibling;
          if (next && next.tagName === 'DIV' && !next.querySelector('h1,h2,h3,table,ul,ol')) description = next;
        }
      }
      if (!description) {
        var article = doc.querySelector('.ssg-initial-content, .item-detail');
        if (article) description = Array.from(article.children).find(function(n) {
          return n.tagName === 'P' && !n.classList.contains('ssg-subtitle') && !n.querySelector('a,img') && !n.closest(protectedSelector);
        });
      }
      if (setText(description, detail, 'description')) changed++;
      if (detail.titleApplied) {
        var title = titleWithContext(doc.title, detail);
        if (doc.title !== title) doc.title = title;
        doc.querySelectorAll('meta[property="og:title"],meta[name="twitter:title"]').forEach(function(n){var v=titleWithContext(n.content,detail);if(n.content!==v)n.content=v;});
      }
      if (detail.descriptionApplied) doc.querySelectorAll('meta[name="description"],meta[property="og:description"],meta[name="twitter:description"]').forEach(function(n){if(n.content!==detail.description)n.content=detail.description;});
    }
    doc.querySelectorAll('#buildings-grid a.card, .heroes-grid a.card, a.item-card').forEach(function(anchor) {
      var m = routeModel(models, anchor.getAttribute('href'));
      // Legacy hero cards use an unprefixed hash route in every locale.
      if (!m) {
        var slug = (anchor.getAttribute('href') || '').match(/#\/hero\/([^/?#]+)/);
        if (slug) {var matches=models.filter(function(x){return /hero/i.test(x.type||'') && x.contentSlug===slug[1];}); if(matches.length===1)m=matches[0];}
      }
      if (setText(anchor.querySelector('.card-title, .name .label, h2'), m, 'title')) changed++;
      if (setText(anchor.querySelector('p'), m, 'description')) changed++;
    });
    doc.querySelectorAll('#research-list .research-record strong, .ssg-initial-content li > strong').forEach(function(node) {
      var m = researchModel(models, node.textContent, path);
      if (setText(node, m, 'title')) changed++;
    });
    return {locale:locale, bound:changed, detailId:detail && detail.bindingId};
  }
  function needsModel(doc,loc) {
    var current=routePath(loc.hash && loc.hash.indexOf('#/')===0?loc.hash.slice(1):loc.pathname);
    if (['/','/ko','/en','/ja'].indexOf(current)===-1) return true;
    return !!doc.querySelector('[data-kd-entity-id][data-kd-field],#buildings-grid a.card,.heroes-grid a.card,a.item-card,#research-list .research-record strong,.ssg-initial-content li > strong');
  }
  function boot(win) {
    var doc=win.document, script=doc.currentScript;
    if (!script || !script.dataset.kdModel) return;
    var url=script.dataset.kdModel, expected=script.dataset.kdRelease, timer=null, data=null, started=false;
    function currentLocale(){var declared=win.I18N&&(typeof win.I18N.getLang==='function'?win.I18N.getLang():(win.I18N.current||win.I18N.lang))||doc.documentElement.lang;return localeOf(win.location.pathname,declared);}
    function run() {
      timer=null;
      if (!data) {if (!started && needsModel(doc,win.location)) load();return;}
      var declared = win.I18N && (typeof win.I18N.getLang === 'function' ? win.I18N.getLang() : (win.I18N.current || win.I18N.lang)) || doc.documentElement.lang;
      var state=apply(doc,data,win.location,declared);
      win.KD_PRESENTATION.lastState=state;
    }
    function schedule(){if(timer===null)timer=win.setTimeout(run,0);}
    win.KD_PRESENTATION={status:'loading',modelUrl:url,releaseId:expected,apply:schedule,
      researchTitle:function(record,branch){return data?researchTitle(data,currentLocale(),record,branch):record.name;},
      researchMatches:function(record,branch,query){return researchMatches(data||{models:{}},currentLocale(),record,branch,query);}
    };
    function load(){
    if(started)return;started=true;win.KD_PRESENTATION.status='loading';
    win.fetch(url,{credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error('Display model HTTP '+r.status);return r.json();}).then(function(value){
      if(value.releaseId!==expected)throw new Error('Display model release mismatch');
      data=value;win.KD_PRESENTATION.status='ready';win.KD_PRESENTATION.data=value;
      schedule();
      win.dispatchEvent(new win.CustomEvent('kd:presentation-ready',{detail:{releaseId:expected}}));
    }).catch(function(e){win.KD_PRESENTATION.status='error';win.KD_PRESENTATION.error=e.message;});
    }
    // Watch SPA mounts before loading so a deferred home can activate the existing display layer.
    var observer=new win.MutationObserver(schedule);
    observer.observe(doc.body,{childList:true,subtree:true,characterData:true});
    if(needsModel(doc,win.location))load();else win.KD_PRESENTATION.status='deferred';
    ['i18n:ready','i18n:changed'].forEach(function(name){doc.addEventListener(name,schedule);});
    ['kd:page-ready','popstate','hashchange'].forEach(function(name){win.addEventListener(name,schedule);});
    doc.addEventListener('DOMContentLoaded',schedule);
  }
  return {routePath:routePath,localeOf:localeOf,routeModel:routeModel,researchModel:researchModel,researchTitle:researchTitle,researchMatches:researchMatches,titleWithContext:titleWithContext,apply:apply,needsModel:needsModel,boot:boot};
});

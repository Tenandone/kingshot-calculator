'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.join(__dirname,'..');
const sources=Object.fromEntries(['operator-profile-config','operator-profile-view','operator-profile','hub-metrics','privacy-controls'].map(name=>[name,fs.readFileSync(path.join(ROOT,'js',name+'.js'),'utf8')]));
const CONSENT_KEY='KSD_CONSENT_V1';
const copy=value=>JSON.parse(JSON.stringify(value));

// Browser primitives are simulated; the consent gate, storage checks, queue,
// sanitizer, event dispatch and gtag/dataLayer implementation are real modules.
function target(){
 const listeners=new Map();
 return {listeners,addEventListener(name,fn,options){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push({fn,once:!!options?.once});},
  dispatchEvent(event){if(!event.target)event.target=this;for(const item of [...(listeners.get(event.type)||[])]){item.fn.call(this,event);if(item.once)listeners.set(event.type,listeners.get(event.type).filter(x=>x!==item));}return !event.defaultPrevented;}};
}
function element(tag){
 const node={...target(),tagName:tag.toUpperCase(),children:[],dataset:{},attributes:{},hidden:false,textContent:'',parentNode:null,
  setAttribute(name,value){this.attributes[name]=String(value);},getAttribute(name){return this.attributes[name]??null;},
  appendChild(child){child.parentNode=this;this.children.push(child);return child;},focus(){},
  querySelector(selector){if(this.controls?.[selector])return this.controls[selector];if(selector==='button')return this.controls?.['[data-allow]']||null;return null;},
  querySelectorAll(){return [];},closest(){return null;},matches(){return false;}};
 Object.defineProperty(node,'innerHTML',{set(value){this.html=value;if(value.includes('data-privacy-description'))this.controls={'[data-privacy-description]':element('p'),'[data-allow]':element('button'),'[data-decline]':element('button')};},get(){return this.html||'';}});
 return node;
}
function setup({consent=null,hostname='kingshotdata.kr',pathname='/ko/guides/private-source.html',runtime=false}={}){
 const store=new Map(),raf=[],observers=[];
 if(consent!==null)store.set(CONSENT_KEY,JSON.stringify({necessary:true,analytics:consent,ads:false}));
 const doc={...target(),readyState:'complete',head:element('head'),body:element('body'),footer:element('footer'),title:'Private user supplied title',createElement:element,
  querySelector(selector){return selector==='footer'?this.footer:null;},querySelectorAll(){return [];},getElementById(){return null;}};
 const location=new URL('https://'+hostname+pathname+'?email=private@example.test&query=secret-search#private-plan');
 const root={...target(),document:doc,location,URL,console,localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)},
  requestAnimationFrame:fn=>{raf.push(fn);return raf.length;},CustomEvent:class{constructor(type,init={}){this.type=type;Object.assign(this,init);}},
  MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}}};
 root.window=root;
 const context=vm.createContext(root);
 const run=name=>vm.runInContext(sources[name],context,{filename:name+'.js'});
 const flush=()=>{let count=0;while(raf.length){assert(++count<100,'animation frame loop');raf.shift()();}};
 for(const name of ['operator-profile-config','hub-metrics','privacy-controls'])run(name);
 if(runtime){run('operator-profile-view');run('operator-profile');}
 flush();
 const analytics=root.KD_OPERATOR_PROFILE_CONFIG.analytics;
 const scripts=()=>doc.head.children.filter(n=>n.tagName==='SCRIPT');
 const panel=()=>doc.body.children.find(n=>n.className==='kd-privacy-banner');
 const choose=allow=>{panel().querySelector(allow?'[data-allow]':'[data-decline]').onclick();flush();};
 const load=()=>{assert.equal(scripts().length,1);scripts()[0].onload();flush();};
 const events=()=>Array.from(root.dataLayer||[],args=>Array.from(args)).filter(args=>args[0]==='event'&&args[1]===analytics.eventName);
 const link=(placement,href=root.KD_OPERATOR_PROFILE_CONFIG.url)=>{
  const a=element('a');a.dataset.tenTiktok=placement;a.setAttribute('href',href);a.href=href;
  a.closest=selector=>['a[data-ten-tiktok]','a[href]'].includes(selector)?a:null;
  const child=element('span');child.closest=selector=>a.closest(selector);a.appendChild(child);return {a,child};
 };
 const click=(node,options={})=>{
  const event={type:'click',target:node,button:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...options};
  root.dispatchEvent(event);doc.dispatchEvent(event);flush();return event;
 };
 return {root,doc,context,run,flush,store,scripts,panel,choose,load,events,analytics,link,click,observers};
}

{
 const t=setup();
 assert.equal(t.analytics.eventName,'ten_tiktok_click');
 assert.deepEqual(copy(t.analytics.placements),{guide_footer:'guide',calculator_result:'calculator',about:'about',site_footer:'home'});
 assert.equal(t.root.KD_METRICS.eventNames.filter(n=>n===t.analytics.eventName).length,1);
 for(const value of [undefined,null,'','unknown','__proto__','https://private.example/path',{raw:'private'}])assert.equal(t.root.KD_METRICS.clean(t.analytics.eventName,{placement:value}),null);
 assert.equal(t.root.KD_METRICS.clean('unapproved_tiktok_event',{placement:'about'}),null);
}
for(const lang of ['ko','en','ja','zh-tw'])for(const [placement,pageType] of Object.entries({guide_footer:'guide',calculator_result:'calculator',about:'about',site_footer:'home'})){
 const t=setup({consent:true,pathname:'/'+lang+'/guides/private-source.html'});
 const raw={placement,language:'private-language',page_type:'private-type',page_location:'https://private.example/',url:'https://www.tiktok.com/@private',href:'private-href',label:'private-label',search_term:'secret-search'};
 const clean=t.root.KD_METRICS.clean(t.analytics.eventName,raw);
 assert.deepEqual(copy(clean),{name:t.analytics.eventName,params:{language:lang,page_type:pageType,placement}});
 assert.deepEqual(copy(t.root.KD_METRICS.clean(clean.name,clean.params)),copy(clean),'second sanitation preserves allowed dimensions');
 t.load();
 assert.equal(t.root.KD_PRIVACY.send(t.analytics.eventName,raw),true,'direct privacy call also sanitizes');
 assert.equal(t.events().length,1);
 const payload=copy(t.events()[0][2]);
 assert.deepEqual(Object.keys(payload).sort(),['language','page_type','placement','page_location','page_referrer','page_title','ignore_referrer','send_to'].sort());
 assert.equal(payload.page_type,pageType);
 assert.equal(payload.page_location,'https://kingshotdata.kr/'+lang+'/other/','existing anonymous route context stays independent from placement');
 assert.equal(payload.page_referrer,'');
 assert.equal(payload.page_title,'KingShotData | other');
 assert.equal(payload.ignore_referrer,true);
 assert(!JSON.stringify(payload).includes('private'));
 assert(!JSON.stringify(payload).includes('secret-search'));
 assert(!JSON.stringify(t.root.dataLayer).includes('private'),'GA config must not expose the raw location or title either');
}
for(const consent of [null,false]){
 const t=setup({consent});
 assert.equal(t.root.KD_METRICS.emit(t.analytics.eventName,{placement:'about'}),false);
 assert.equal(t.scripts().length,0);
 assert.equal(t.events().length,0);
 t.choose(true);t.load();
 assert.equal(t.events().length,0,'pre-consent intent must not replay after approval');
 assert.equal(t.root.KD_METRICS.emit(t.analytics.eventName,{placement:'about'}),true);
 assert.equal(t.events().length,1);
}
{
 const t=setup({consent:true});
 assert.equal(t.root.KD_PRIVACY.canSend(),false);
 assert.equal(t.root.KD_METRICS.emit(t.analytics.eventName,{placement:'guide_footer'}),true);
 assert.equal(t.events().length,0);
 t.run('hub-metrics');t.run('privacy-controls');t.flush();
 assert.equal(t.scripts().length,1,'duplicate privacy initialization must not reload transport');
 assert.equal(t.root.listeners.get('click').length,1,'duplicate metrics initialization must not attach another click handler');
 t.load();
 assert.equal(t.events().length,1,'loading-time intent drains once');
 t.root.dispatchEvent(new t.root.CustomEvent('kd:page-ready'));t.root.dispatchEvent(new t.root.CustomEvent('i18n:changed'));t.flush();
 assert.equal(t.events().length,1,'rerender events must not replay interaction events');
 t.root.KD_METRICS.emit(t.analytics.eventName,{placement:'guide_footer'});
 assert.equal(t.events().length,2,'a second independent intent remains measurable');
}
{
 const t=setup({consent:true});
 t.root.KD_METRICS.emit(t.analytics.eventName,{placement:'about'});
 t.choose(false);t.load();
 assert.equal(t.events().length,0,'revoking consent discards queued intent');
 assert.equal(t.root.KD_METRICS.emit(t.analytics.eventName,{placement:'about'}),false);
 t.choose(true);
 assert.equal(t.events().length,0,'reapproval must not replay the discarded queue');
 t.root.KD_METRICS.emit(t.analytics.eventName,{placement:'about'});
 assert.equal(t.events().length,1);
}
{
 const t=setup({consent:true});t.load();
 t.store.set(CONSENT_KEY,JSON.stringify({analytics:false}));
 assert.equal(t.root.KD_METRICS.emit(t.analytics.eventName,{placement:'about'}),false,'storage is rechecked at send time');
 t.root.dispatchEvent({type:'storage',key:CONSENT_KEY});t.flush();
 assert.equal(t.events().length,0);
}
{
 const t=setup({consent:true});
 t.root.KD_METRICS.emit(t.analytics.eventName,{placement:'about'});
 t.scripts()[0].onerror();
 assert.equal(t.root.KD_METRICS.emit(t.analytics.eventName,{placement:'about'}),false);
 assert.equal(t.events().length,0,'failed transport must not send the queue');
}
{
 const t=setup({consent:true,hostname:'localhost'});
 assert.equal(t.root.KD_METRICS.emit(t.analytics.eventName,{placement:'about'}),false);
 assert.equal(t.scripts().length,0,'nonproduction must not load GA');
}
{
 const t=setup({consent:true});
 for(let i=0;i<32;i++)assert.equal(t.root.KD_METRICS.emit(t.analytics.eventName,{placement:'about'}),true);
 assert.equal(t.root.KD_METRICS.emit(t.analytics.eventName,{placement:'about'}),false);
 t.load();assert.equal(t.events().length,32,'existing queue limit is preserved');
}
function observeCalls(t){
 const calls={emit:0,send:0},emit=t.root.KD_METRICS.emit,send=t.root.KD_PRIVACY.send;
 t.root.KD_METRICS.emit=function(...args){if(args[0]===t.analytics.eventName)calls.emit++;return emit(...args);};
 t.root.KD_PRIVACY.send=function(...args){if(args[0]===t.analytics.eventName)calls.send++;return send(...args);};
 return calls;
}
const routes={guide_footer:lang=>'/'+lang+'/guides/real-guide.html',calculator_result:lang=>'/'+lang+'/calc-gear/',about:lang=>'/'+lang+'/about/',site_footer:lang=>'/'+lang+'/'};
for(const lang of ['ko','en','ja','zh-tw'])for(const placement of Object.keys(routes)){
 const t=setup({consent:true,pathname:routes[placement](lang),runtime:true});t.load();
 const calls=observeCalls(t),first=t.link(placement);
 t.click(first.child);
 assert.deepEqual(calls,{emit:1,send:1},'one nested-link click calls the real emit/send chain once');
 assert.equal(t.events().length,1);
 const payload=t.events()[0][2];
 assert.equal(payload.placement,placement);assert.equal(payload.page_type,t.analytics.placements[placement]);assert.equal(payload.language,lang);
 const before={window:t.root.listeners.get('click').length,document:t.doc.listeners.get('click').length,observers:t.observers.length};
 t.run('operator-profile');t.run('hub-metrics');t.run('privacy-controls');t.flush();
 assert.deepEqual({window:t.root.listeners.get('click').length,document:t.doc.listeners.get('click').length,observers:t.observers.length},before,'repeat initialization must not add handlers or observers');
 for(const type of ['kd:page-ready','popstate','hashchange'])t.root.dispatchEvent(new t.root.CustomEvent(type));
 t.doc.dispatchEvent(new t.root.CustomEvent('i18n:changed'));t.flush();
 assert.equal(t.events().length,1,'rerender notifications must not resend the old click');
 const replacement=t.link(placement);t.click(replacement.a);
 assert.deepEqual(calls,{emit:2,send:2},'replacement link uses the existing delegated listener');
 assert.equal(t.events().length,2);
 t.click(t.link('unapproved').a);t.click(t.link(placement,'https://www.tiktok.com/@someone-else').a);
 assert.deepEqual(calls,{emit:2,send:2},'unknown placements and other accounts do not reach metrics');
 for(const options of [{defaultPrevented:true},{button:1},{button:2},{type:'auxclick',button:1}])t.click(t.link(placement).child,options);
 assert.deepEqual(calls,{emit:2,send:2},'cancelled, middle and right clicks do not reach metrics');
 assert.equal(t.events().length,2);
}
for(const consent of [null,false]){
 const t=setup({consent,runtime:true}),calls=observeCalls(t);
 t.click(t.link('guide_footer').child);
 assert.deepEqual(calls,{emit:1,send:0},'a declined/unset click reaches the real gate but no transport');
 assert.equal(t.events().length,0);assert.equal(t.scripts().length,0);
 t.choose(true);t.load();
 assert.equal(t.events().length,0,'declined clicks are not retained for later consent');
 t.click(t.link('guide_footer').child);
 assert.deepEqual(calls,{emit:2,send:1});assert.equal(t.events().length,1);
}
{
 const t=setup({consent:true,runtime:true}),calls=observeCalls(t);
 t.click(t.link('guide_footer').child);
 assert.deepEqual(calls,{emit:1,send:1});assert.equal(t.events().length,0);
 t.run('operator-profile');t.load();
 assert.deepEqual(calls,{emit:1,send:1});assert.equal(t.events().length,1,'a loading-time delegated click drains once');
}
console.log('TEN metrics: actual config/view/runtime plus consent modules passed. Sanitization, 16 locale/placement click cases, one emit/send per click, duplicate initialization, replacement-link delegation, loading/revocation queues and consent boundaries verified.');

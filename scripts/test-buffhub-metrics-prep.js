'use strict';
// No browser, network, cookies or production analytics are used. Run the actual
// sanitizer and privacy transport in a VM with small DOM/storage primitives.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.join(__dirname,'..');
const sources=Object.fromEntries(['operator-profile-config','hub-metrics','privacy-controls'].map(name=>[name,fs.readFileSync(path.join(ROOT,'js',name+'.js'),'utf8')]));
const KEY='KSD_CONSENT_V1',NAMES=['sponsor_impression','sponsor_click'];
const LOCALES=['ko','zh-tw','ja','en'];
const PLACEMENTS=['guide_after_intro','content_after_intro','content_end','calculator_result'];
const copy=value=>JSON.parse(JSON.stringify(value));
const guide=locale=>'/'+locale+'/guides/kingshot-bearhunt.html';
const dimensions=(locale='ko',placement='guide_after_intro',page=guide(locale))=>({campaign_id:'buffhub-kingshot',creative_id:'buffhub-'+locale+'-v1',placement_id:placement,page_path:page});
// This fixture is the renderer's read-only contract, not a second implementation
// of its approval logic. The actual runtime has independent lifecycle tests.
const contexts=new Map(LOCALES.flatMap(locale=>[guide(locale),'/'+locale+'/guides/kingshot-f2p-guide.html'].map(page=>[page,Object.fromEntries(PLACEMENTS.map(placement=>[placement,Object.freeze({...dimensions(locale,placement,page),language:locale})]))])));
contexts.set('/heroes/',Object.fromEntries(PLACEMENTS.map(placement=>[placement,Object.freeze({...dimensions('ko',placement,'/heroes/'),language:'ko'})])));

function target(){
 const listeners=new Map();
 return {listeners,addEventListener(name,fn,options){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push({fn,once:!!options?.once});},
  dispatchEvent(event){if(!event.target)event.target=this;for(const item of [...(listeners.get(event.type)||[])]){item.fn.call(this,event);if(item.once)listeners.set(event.type,listeners.get(event.type).filter(x=>x!==item));}return !event.defaultPrevented;}};
}
function element(tag){
 const node={...target(),tagName:tag.toUpperCase(),children:[],dataset:{},attributes:{},hidden:false,textContent:'',
  setAttribute(name,value){this.attributes[name]=String(value);},getAttribute(name){return this.attributes[name]??null;},
  appendChild(child){child.parentNode=this;this.children.push(child);return child;},focus(){},
  querySelector(selector){return this.controls?.[selector]||(selector==='button'?this.controls?.['[data-allow]']:null)||null;},
  querySelectorAll(){return [];},closest(){return null;},matches(){return false;}};
 Object.defineProperty(node,'innerHTML',{set(value){this.html=value;if(value.includes('data-privacy-description'))this.controls={'[data-privacy-description]':element('p'),'[data-allow]':element('button'),'[data-decline]':element('button')};},get(){return this.html||'';}});
 return node;
}
function setup({consent=null,hostname='kingshotdata.kr',pathname=guide('ko'),sponsorReady=true}={}){
 const store=new Map(),raf=[];
 if(consent!==null)store.set(KEY,JSON.stringify({necessary:true,analytics:consent,ads:false}));
 const doc={...target(),readyState:'complete',head:element('head'),body:element('body'),footer:element('footer'),title:'Private user title',createElement:element,
  querySelector(selector){return selector==='footer'?this.footer:null;},querySelectorAll(){return [];}};
 const location=new URL('https://'+hostname+pathname+'?email=private@example.test&search=private-search#private-plan');
 const root={...target(),document:doc,location,URL,console,localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)},
  requestAnimationFrame:fn=>{raf.push(fn);return raf.length;},CustomEvent:class{constructor(type,init={}){this.type=type;Object.assign(this,init);}}};
 root.window=root;
 const sponsorState={ready:sponsorReady};
 root.KD_SPONSORS={measurementContext:placement=>sponsorState.ready?contexts.get(root.location.pathname.replace(/\/index\.html$/,'/'))?.[placement]||null:null};
 const context=vm.createContext(root),run=name=>vm.runInContext(sources[name],context,{filename:name+'.js'});
 const flush=()=>{let count=0;while(raf.length){assert(++count<100,'unexpected animation-frame loop');raf.shift()();}};
 for(const name of Object.keys(sources))run(name);
 flush();
 const scripts=()=>doc.head.children.filter(node=>node.tagName==='SCRIPT');
 const panel=()=>doc.body.children.find(node=>node.className==='kd-privacy-banner');
 const choose=allow=>{panel().querySelector(allow?'[data-allow]':'[data-decline]').onclick();flush();};
 const load=()=>{assert.equal(scripts().length,1);scripts()[0].onload();flush();};
 const events=()=>Array.from(root.dataLayer||[],args=>Array.from(args)).filter(args=>args[0]==='event'&&NAMES.includes(args[1]));
 const emit=(name=NAMES[0],params=dimensions())=>root.KD_METRICS.emit(name,params);
 return {root,doc,store,run,flush,scripts,choose,load,events,emit,sponsorState};
}

// Startup, navigation and consent changes do not generate sponsor measurements.
{
 const t=setup({consent:true});
 for(const name of NAMES)assert.equal(t.root.KD_METRICS.eventNames.filter(value=>value===name).length,1);
 t.load();
 const listeners=t.root.listeners.get('click').length;
 t.run('hub-metrics');t.run('privacy-controls');t.flush();
 assert.equal(t.scripts().length,1);
 assert.equal(t.root.listeners.get('click').length,listeners,'reinitialization must not duplicate existing click handlers');
 for(const type of ['kd:page-ready','popstate','hashchange'])t.root.dispatchEvent({type});
 t.flush();
 assert.equal(t.events().length,0,'allowlisting does not activate sponsor measurement');
}

// Four locales, both event types and each approved placement use the real
// clean -> emit -> privacy.send -> clean chain, including metadata sanitation.
let matrixCases=0;
for(const locale of LOCALES)for(const placement of PLACEMENTS)for(const name of NAMES){
 const t=setup({consent:true,pathname:guide(locale)}),approved=dimensions(locale,placement);
 const input={...approved,language:'private-language',page_type:'private-type',page_location:'https://private.example/',url:'https://private.example/',href:'private-href',label:'private-label',user_id:'private-id',game_id:'private-game-id',search_term:'private-search',value:999,currency:'PRIVATE'};
 const expected={name,params:{language:locale,page_type:'other',...approved}};
 assert.deepEqual(copy(t.root.KD_METRICS.clean(name,input)),expected);
 assert.deepEqual(copy(t.root.KD_METRICS.clean(name,expected.params)),expected,'sanitization must be idempotent');
 t.load();
 assert.equal(t.emit(name,input),true);
 assert.equal(t.events().length,1);
 const payload=copy(t.events()[0][2]);
 assert.deepEqual(payload,{...expected.params,page_location:'https://kingshotdata.kr/'+locale+'/other/',page_referrer:'',page_title:'KingShotData | other',ignore_referrer:true,send_to:'G-TMGDGSEWW6'});
 assert(!JSON.stringify(t.root.dataLayer).includes('private'),'raw location, user data and labels cannot reach transport');
 assert.equal(t.root.KD_PRIVACY.send(name,input),true,'direct privacy calls sanitize the same event');
 assert.equal(t.events().length,2);
 matrixCases++;
}

for(const name of NAMES){
 const t=setup({consent:true});t.load();
 for(const field of ['campaign_id','creative_id','placement_id','page_path'])for(const value of [undefined,null,'','unknown','__proto__','private@example.test','https://private.example/',42,{},[]]){
  const input={...dimensions(),[field]:value};
  assert.equal(t.root.KD_METRICS.clean(name,input),null);
  assert.equal(t.emit(name,input),false);
  assert.equal(t.root.KD_PRIVACY.send(name,input),false);
 }
 for(const value of [undefined,null,[],true,'private']){
  assert.equal(t.root.KD_METRICS.clean(name,value),null);
  assert.equal(t.root.KD_METRICS.emit(name,value),false);
 }
 assert.equal(t.emit(name,dimensions('ja')),false,'creative locale cannot override route locale');
 assert.equal(t.events().length,0);
 assert.equal(t.emit('purchase',dimensions()),false,'outbound sponsor events do not create purchases');
}

// A caller cannot manufacture a sponsor event outside the mounted, approved
// campaign, nor supply another page's attribution or user-controlled URL parts.
for(const ready of [false,null,undefined]){
 const t=setup({consent:true,sponsorReady:false});t.load();
 t.root.KD_SPONSORS.measurementContext=()=>ready;
 for(const name of NAMES){assert.equal(t.emit(name),false);assert.equal(t.root.KD_PRIVACY.send(name,dimensions()),false);}
 assert.equal(t.events().length,0);
}
// Manual campaign disable/enable is represented by the runtime withdrawing and
// restoring its approved context. Metrics has no independent expiry clock.
{
 const t=setup({consent:true});t.load();
 assert.equal(t.emit('sponsor_impression'),true);
 t.sponsorState.ready=false;
 for(const name of NAMES){assert.equal(t.emit(name),false);assert.equal(t.root.KD_PRIVACY.send(name,dimensions()),false);}
 assert.equal(t.events().length,1,'manual disable keeps existing records and blocks new measurements');
 t.sponsorState.ready=true;t.flush();
 assert.equal(t.events().length,1,'manual reactivation does not replay disabled-period intent');
 assert.equal(t.emit('sponsor_click'),true);assert.equal(t.events().length,2);
 assert.equal(t.events()[1][2].page_path,guide('ko'));
 t.root.location.pathname='/ko/guides/unapproved.html';
 assert.equal(t.emit('sponsor_click'),false,'manual activation cannot bypass the exact approved path');
 assert.equal(t.events().length,2);
}
{
 const t=setup({consent:true});t.load();
 delete t.root.KD_SPONSORS;
 for(const name of NAMES)assert.equal(t.emit(name),false);
 t.root.KD_SPONSORS={measurementContext(){throw new Error('renderer unavailable');}};
 for(const name of NAMES){assert.equal(t.root.KD_METRICS.clean(name,dimensions()),null);assert.equal(t.emit(name),false);}
 assert.equal(t.events().length,0);
}
for(const page of ['/ko/guides/unapproved.html',guide('en'),guide('ko')+'?email=private@example.test',guide('ko')+'#private-plan','//private.example/','/ko/guides/%70rivate.html','/ko/../private.html','/private@example.test/','/a'.repeat(130)]){
 const t=setup({consent:true});t.load();
 for(const name of NAMES)assert.equal(t.emit(name,{...dimensions(),page_path:page}),false);
 assert.equal(t.events().length,0);
}
for(const page of ['/ko/guides/unapproved.html','/ko/guides/%70rivate.html','/private@example.test/','/a'.repeat(130)]){
 const t=setup({consent:true,pathname:page});t.load();
 for(const name of NAMES)assert.equal(t.emit(name,{...dimensions(),page_path:page}),false);
 assert.equal(t.events().length,0,'unapproved paths cannot be measured');
}
for(const page of ['/ko/guides/%70rivate.html','/private@example.test/','//private.example/','/a'.repeat(130)]){
 const t=setup({consent:true,pathname:page});t.load();
 const supplied={...dimensions(),page_path:page};
 t.root.KD_SPONSORS.measurementContext=()=>({...supplied,language:'ko'});
 assert.equal(t.emit('sponsor_click',supplied),false,'the transport boundary rejects unsafe paths even if a faulty renderer offers them');
 assert.equal(t.events().length,0);
}
{
 const t=setup({consent:true});t.load();
 const valid={...dimensions(),language:'ko'};
 for(const [field,value] of [['campaign_id','another-campaign'],['creative_id','private@example.test'],['creative_id','buffhub-en-v1'],['placement_id','content_end'],['page_path',guide('en')],['language','en']]){
  t.root.KD_SPONSORS.measurementContext=()=>({...valid,[field]:value});
  assert.equal(t.emit('sponsor_click'),false,'malformed/stale renderer context must fail closed');
 }
 t.root.KD_SPONSORS.measurementContext=()=>({...valid,creative_id:'buffhub-ko-v2'});
 assert.equal(t.emit('sponsor_click'),false,'old creative cannot impersonate replacement artwork');
 assert.equal(t.emit('sponsor_click',{...dimensions(),creative_id:'buffhub-ko-v2'}),true,'central creative replacements do not require metrics source changes');
 assert.equal(t.events().length,1);
}

// Root Korean paths retain the existing locale and page-type classification.
{
 const t=setup({consent:true,pathname:'/heroes/'});t.load();
 assert.equal(t.emit('sponsor_click',dimensions('ko','content_end','/heroes/')),true);
 assert.equal(t.events()[0][2].language,'ko');
 assert.equal(t.events()[0][2].page_type,'hero');
 t.root.location.pathname=guide('en');
 assert.equal(t.emit('sponsor_click',dimensions('ko')),false);
 assert.equal(t.emit('sponsor_click',dimensions('en')),true);
 assert.equal(t.events()[1][2].language,'en');
 assert.equal(t.events()[0][2].page_path,'/heroes/');
 assert.equal(t.events()[1][2].page_path,guide('en'));
 t.root.location.pathname='/heroes/index.html';
 assert.equal(t.emit('sponsor_click',dimensions('ko','content_end','/heroes/')),true,'index alias uses the approved canonical static path');
}

// Navigation while GA is loading must retain the original event's approved page
// instead of assigning queued events to a later page or leaking the new query.
{
 const t=setup({consent:true});
 assert.equal(t.emit('sponsor_click'),true);
 t.root.location.pathname=guide('en');
 t.root.location.search='?email=private@example.test';
 assert.equal(t.emit('sponsor_click',dimensions()),false,'stale route dimensions are rejected');
 assert.equal(t.emit('sponsor_click',dimensions('en')),true);
 t.load();
 assert.deepEqual(t.events().map(event=>event[2].page_path),[guide('ko'),guide('en')]);
 assert.deepEqual(t.events().map(event=>event[2].language),['ko','en']);
 assert(!JSON.stringify(t.root.dataLayer).includes('private'));
 t.root.location.pathname=guide('ko');
 assert.equal(t.emit('sponsor_click'),true,'a later visit can record a fresh explicit click');
 assert.equal(t.events()[2][2].page_path,guide('ko'));
}

for(const consent of [null,false]){
 const t=setup({consent});
 for(const name of NAMES)assert.equal(t.emit(name),false);
 assert.equal(t.scripts().length,0);
 t.choose(true);t.load();
 assert.equal(t.events().length,0,'pre-consent events are not retained or replayed');
 for(const name of NAMES)assert.equal(t.emit(name),true);
 assert.equal(t.events().length,2);
}
{
 const t=setup({consent:true});
 for(const name of NAMES)assert.equal(t.emit(name),true);
 assert.equal(t.events().length,0,'transport-loading events remain in the existing bounded queue');
 t.run('hub-metrics');t.run('privacy-controls');t.flush();
 assert.equal(t.scripts().length,1);
 t.load();assert.deepEqual(t.events().map(event=>event[1]),NAMES);
 for(const type of ['kd:page-ready','popstate','hashchange'])t.root.dispatchEvent({type});
 t.flush();assert.equal(t.events().length,2,'navigation does not replay queued or already-sent events');
 assert.equal(t.emit('sponsor_click'),true);assert.equal(t.events().length,3,'a new explicit intent remains measurable');
}
{
 const t=setup({consent:true});
 for(const name of NAMES)t.emit(name);
 t.choose(false);t.load();
 assert.equal(t.events().length,0,'revocation discards events awaiting transport');
 for(const name of NAMES)assert.equal(t.emit(name),false);
 t.choose(true);assert.equal(t.events().length,0,'reapproval cannot replay discarded events');
 assert.equal(t.emit('sponsor_click'),true);assert.equal(t.events().length,1);
 t.store.set(KEY,JSON.stringify({analytics:false}));
 assert.equal(t.emit('sponsor_click'),false,'storage is rechecked immediately at send time');
 t.root.dispatchEvent({type:'storage',key:KEY});t.flush();
 assert.equal(t.events().length,1);
}
for(const hostname of ['localhost','127.0.0.1','preview.kingshotdata.kr']){
 const t=setup({consent:true,hostname});
 for(const name of NAMES)assert.equal(t.emit(name),false);
 assert.equal(t.scripts().length,0,'nonproduction must not load production GA');
 assert.equal(t.events().length,0);
}
{
 const t=setup({consent:true});
 t.emit('sponsor_impression');t.scripts()[0].onerror();
 assert.equal(t.emit('sponsor_click'),false);
 assert.equal(t.events().length,0,'transport failure cannot flush queued events');
}
{
 const t=setup({consent:true});
 for(let i=0;i<32;i++)assert.equal(t.emit(NAMES[i%2]),true);
 assert.equal(t.emit('sponsor_click'),false,'the existing queue capacity is unchanged');
 t.load();assert.equal(t.events().length,32);
}
console.log('BUFFHUB metrics: '+matrixCases+' locale/event/placement cases passed; active renderer context, approved static page attribution, creative replacement, PII stripping, no automatic sponsor events, idempotent initialization, consent/local/transport gates and navigation-safe queue behavior verified. No production analytics requests were made.');

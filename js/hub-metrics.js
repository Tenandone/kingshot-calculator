(function(root){
 'use strict';
 if(root.KD_METRICS?.version==='ks-ten-profile-20261013')return;
 const categories=['all','buildings','heroes','research','gear','pets','items','tools','guides','events','other'],types=['home','building','hero','research','gear','pet','item','planner','other'],locales=['ko','en','ja','zh-tw'];
 const aliases={search:'search_execute',favorite:'favorite_add',goal_save:'calculator_goal_save'};
 const operatorAnalytics=root.KD_OPERATOR_PROFILE_CONFIG?.analytics||{},operatorEvent=operatorAnalytics.eventName,operatorPlacements=operatorAnalytics.placements||{};
 const events=['page_view','search_execute','search_no_results','search_result_click','detail_view','planner_enter','planner_goal_add','planner_save','favorite_add','language_change','navigation_click','calculator_complete','calculator_goal_save',...(typeof operatorEvent==='string'&&operatorEvent?[operatorEvent]:[])];
 const choose=(x,list,fallback)=>list.includes(x)?x:fallback;
 const bucket=n=>!Number.isFinite(n)||n<0?'unknown':n===0?'0':n===1?'1':n<=5?'2-5':n<=20?'6-20':'21+';
 function language(){return choose((root.location.pathname.match(/^\/(ko|en|ja|zh-tw)(?:\/|$)/i)?.[1]||'ko').toLowerCase(),locales,'ko');}
 function pageType(path=root.location.pathname){if(/^\/(?:(?:ko|en|ja|zh-tw)\/)?$/.test(path))return'home';if(/\/growth-planner\/?$/.test(path))return'planner';if(/\/(?:building|buildings)\//.test(path))return'building';if(/\/(?:hero|heroes)\//.test(path))return'hero';if(/\/research\//.test(path))return'research';if(/\/(?:pet|pets)\//.test(path))return'pet';if(/\/(?:gear|hero-gear)\//.test(path)||/^\/(?:ko|en|ja|zh-tw)\/database\/(?:|(?:governor-gear|governor-charm|hero-gear|mastery-forging|widgets|hero-shards)\.html)$/.test(path))return'gear';if(/\/items?\//.test(path))return'item';return'other';}
 function clean(name,params={}){
  name=aliases[name]||name;if(!events.includes(name))return null;
  const p={language:language(),page_type:pageType()};
  if(name===operatorEvent){const placement=choose(params.placement,Object.keys(operatorPlacements),'');if(!placement)return null;p.placement=placement;p.page_type=operatorPlacements[placement];}
  if(['search_execute','search_no_results','search_result_click','favorite_add'].includes(name))p.category=choose(params.category,categories,'other');
  if(['search_execute','search_no_results'].includes(name)){p.result_bucket=params.result_count===undefined?choose(params.result_bucket,['0','1','2-5','6-20','21+'],'unknown'):bucket(params.result_count);p.trigger=choose(params.trigger,['typing','submit','filter'],'typing');}
  if(name==='search_result_click')p.position_bucket=params.position===undefined?choose(params.position_bucket,['0','1','2-5','6-20','21+'],'unknown'):bucket(params.position);
  if(name==='detail_view')p.content_type=choose(params.content_type,types,'other');
  if(name==='planner_goal_add')p.entry_method=choose(params.entry_method,['picker','detail_link'],'picker');
  if(name==='language_change')p.target_language=choose(String(params.target_language||'').toLowerCase(),locales,'unknown');
  if(name==='navigation_click'){p.destination_type=choose(params.destination_type,types,'other');p.surface=choose(params.surface,['header','landing','related','planner','footer'],'landing');}
  if(['calculator_complete','calculator_goal_save'].includes(name))p.calculator=choose(params.calculator,['building','gear','charm','pet','training','hero-gear'],'other');
  return{name,params:p};
 }
 function emit(name,params){try{const event=clean(name,params);if(!event||!root.KD_PRIVACY?.canRecord())return false;const sent=root.KD_PRIVACY.send(event.name,event.params);if(sent&&event.name==='search_execute'&&event.params.result_bucket==='0'){const empty=clean('search_no_results',params);root.KD_PRIVACY.send(empty.name,empty.params);}return sent;}catch(_){return false;}}
 root.KD_METRICS={emit,clean,pageType,bucket,version:'ks-ten-profile-20261013',eventNames:events.slice()};
 let lastPage='',lastDetail='',scheduled=false,consentReady=!!root.KD_PRIVACY?.canSend();
 function matchesRoute(node,type){
  const d=node.dataset||{},path=root.location.pathname.replace(/\/index\.html$/,'/'),slug=path.split('/').filter(Boolean).at(-1)?.replace(/\.html$/,'');
  const declared=d.locale||d.khLocale||d.kcatLocale||node.closest?.('.kr-page')?.dataset.krLocale;if(declared&&String(declared).toLowerCase()!==language())return false;
  if(type==='hero')return /\/hero\//.test(path)&&d.khSlug===slug;
  if(d.kcatSlug)return d.kcatSlug===slug;
  if(type==='building'){const model=d.modelUrl?.match(/\/([^/]+)\.json(?:\?|$)/)?.[1];return !!model&&model===slug;}
  if(type==='research'){const u=new URL(root.location.href),selected=u.searchParams.get('kdu_item');if(selected&&selected!==d.krId)return false;const branch=node.closest?.('.kr-page')?.dataset.krBranch,expected=/\/research\/academy\/?$/.test(path)?'academy':/\/research\/advanced-truegold\/?$/.test(path)?'advanced-war-academy':'all';return !branch||branch===expected;}
  return false;
 }
 function measurePage(){
  scheduled=false;const doc=root.document,l=language(),path=root.location.pathname,key=l+'|'+path;
  if(key!==lastPage){lastPage=key;lastDetail='';emit('page_view');if(pageType()==='planner')emit('planner_enter');}
  const node=doc.querySelector('#kd-building[data-building-id],.kh-detail[data-kh-slug],[data-kr-detail][data-kr-id],.kcat-detail[data-kcat-slug]');
  if(node){const d=node.dataset||{},type=d.buildingId?'building':d.khSlug?'hero':d.krId?'research':({pet:'pet',database:'gear',item:'item'}[d.kcatType]||'other'),identity=key+'|'+(d.buildingId||d.khSlug||d.krId||d.kcatSlug);if(identity!==lastDetail&&type===pageType()&&matchesRoute(node,type)){lastDetail=identity;emit('detail_view',{content_type:type});}}
 }
 function schedule(){if(scheduled)return;scheduled=true;root.requestAnimationFrame(measurePage);}
 function navigation(e){const a=e.target.closest?.('a[href]');if(!a||a.closest('.hub-search-result')||e.defaultPrevented)return;let u;try{u=new URL(a.href,root.location.origin);}catch{return;}if(u.origin!==root.location.origin)return;const parent=a.closest('.kn-related,.kp-page,.hub-primary,.hub-category-links,.hub-tool-links,.hub-utility-nav,.site-header,header,footer,.mobile-bottom-nav,#mobileDrawer');if(!parent)return;const surface=parent.matches('.kn-related')?'related':parent.matches('.kp-page')?'planner':parent.matches('footer')?'footer':parent.matches('header,.site-header,.mobile-bottom-nav,#mobileDrawer')?'header':'landing';emit('navigation_click',{destination_type:pageType(u.pathname),surface});}
 function languageClick(e){const b=e.target.closest?.('.lang-pill[data-lang]');if(b){const target=String(b.dataset.lang||'').toLowerCase();if(target!==language()&&locales.includes(target))emit('language_change',{target_language:target});return true;}const a=e.target.closest?.('a[href]');if(!a||!a.closest('nav.lang,.kd-standalone-langs,nav[aria-label="Language"],nav[aria-label="언어 선택"],nav[aria-label="言語選択"],nav[aria-label="語言選擇"]'))return false;let u;try{u=new URL(a.href,root.location.origin);}catch{return true;}if(u.origin!==root.location.origin)return true;const target=String(a.getAttribute('lang')||a.getAttribute('hreflang')||u.pathname.match(/^\/(ko|en|ja|zh-tw)(?:\/|$)/i)?.[1]||'ko').toLowerCase();if(target!==language()&&locales.includes(target))emit('language_change',{target_language:target});return true;}
 // Capture menu intent before the document-level SPA router handles the native link.
 root.addEventListener('click',e=>{if(e.defaultPrevented||(typeof e.button==='number'&&e.button!==0))return;if(!languageClick(e))navigation(e);},true);
 ['kd:page-ready','kd:research-ready','kd:hero-ready','kd:heroes-ready','kd:catalog-ready','kd:planner-ready','popstate','hashchange'].forEach(e=>root.addEventListener(e,schedule));
 root.addEventListener('kd:analytics-consent',()=>{const ready=!!root.KD_PRIVACY?.canSend();if(ready&&!consentReady){lastPage='';lastDetail='';}consentReady=ready;schedule();});
 ['i18n:ready','i18n:changed'].forEach(e=>root.document.addEventListener(e,schedule));
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})(window);

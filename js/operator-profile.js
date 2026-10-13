(function(root){
 'use strict';
 const config=root.KD_OPERATOR_PROFILE_CONFIG,view=root.KD_OPERATOR_PROFILE_VIEW;
 if(!config||!view||root.__KD_OPERATOR_PROFILE)return;
 root.__KD_OPERATOR_PROFILE=true;
 let queued=false,state=null;
 const calcSelectors={
  gear:{mount:'#gear-calc',rows:'#gc-tbody > tr',section:'.gear-details',wrapper:'.gc-section'},
  charm:{mount:'#charm-calc',rows:'#cc-tbody > tr',section:'.cc-details',wrapper:'.cc-section'},
  pet:{mount:'#pet-calc',rows:'#pc-tbody > tr',section:'.pc-detail',wrapper:'.pc-section'}
 };
 function context(){
  const path=location.pathname,placement=view.placement(path),language=view.locale(path);
  const kind=placement==='calculator_result'?path.match(/calc-(gear|charm|pet)/)?.[1]:null;
  const mount=kind?document.querySelector(calcSelectors[kind].mount):null;
  if(!state||state.path!==path||state.mount!==mount)state={path,mount,kind,armed:false,success:null};
  return {placement,language,kind,mount};
 }
 function signature(){return root.KD_CALCULATOR_SIGNATURE?.()||'';}
 function hideResult(){document.querySelectorAll('[data-ten-profile="calculator_result"]').forEach(n=>n.remove());}
 function resultReady(ctx){
  const {kind,mount}=ctx,s=state.success;
  if(!mount||!mount.isConnected||!state.armed||!s||s.kind!==kind||!s.signature||s.signature!==signature())return false;
  if(document.querySelector('#content [data-calculation-blocked],#content .error,#content [data-inventory][aria-invalid="true"]'))return false;
  const rule=calcSelectors[kind];
  if(!mount.querySelector(rule.rows))return false;
  const detail=mount.querySelector(rule.section);
  if(!detail||detail.hidden||detail.style.display==='none')return false;
  if(kind==='gear')return !!mount.querySelector('input[name="slot"]:checked')&&mount.querySelector('#gc-copy')?.disabled===false;
  if(kind==='charm')return !!mount.querySelector('#cc-head-row > *')&&Array.from(mount.querySelectorAll('.cc-unit-count')).some(n=>Number(n.value)>0);
  return !!mount.querySelector('#pc-head-row > *')&&Number(mount.querySelector('#pc-to')?.value)>Number(mount.querySelector('#pc-from')?.value);
 }
 function place(ctx,anchor,where){
  if(!anchor)return;
  let found=Array.from(document.querySelectorAll('[data-ten-profile="'+ctx.placement+'"]'));
  const existing=found.find(n=>n.dataset.tenLocale===ctx.language);
  found.forEach(n=>{if(n!==existing)n.remove();});
  if(existing)return;
  anchor.insertAdjacentHTML(where,view.render(ctx.language,ctx.placement));
 }
 function reconcile(){
  queued=false;
  const ctx=context();
  document.querySelectorAll('[data-ten-profile]').forEach(n=>{if(n.dataset.tenProfile!==ctx.placement||n.dataset.tenLocale!==ctx.language)n.remove();});
  if(ctx.placement==='calculator_result'){
   if(!resultReady(ctx)){hideResult();return;}
   const rule=calcSelectors[ctx.kind],section=ctx.mount.querySelector(rule.section)?.closest(rule.wrapper);
   place(ctx,section,'afterend');
  }else if(ctx.placement==='guide_footer'){
   place(ctx,document.querySelector('#ks-guide-content main,#ks-guide-content section[aria-label="Truegold Chart"]')||document.querySelector('main,section[aria-label="Truegold Chart"]'),'beforeend');
  }else if(ctx.placement==='about'){
   const intro=document.querySelector('#content [data-community-unit="E13"],#content section[aria-labelledby="about-intro"]');
   place(ctx,intro||document.querySelector('#content article.ssg-initial-content'),intro?'afterend':'beforeend');
  }else if(ctx.placement==='site_footer'){
   place(ctx,document.querySelector('.site-footer .container')||document.querySelector('.site-footer'),'beforeend');
  }
 }
 function schedule(){if(!queued){queued=true;root.requestAnimationFrame(reconcile);}}
 function intent(event){
  const ctx=context(),target=event.target;
  if(!ctx.mount||!target?.closest)return;
  if(target.closest('.calc-workbench')){schedule();return;}
  const restore=target.closest('#kd-restore-goal');
  if(!ctx.mount.contains(target)&&!restore)return;
  if(event.type==='click'&&!restore&&!target.closest('.pc-pet-btn,#gc-quick-all,#gc-quick-clear,#gc-reset,#cc-clear,#cc-fill18'))return;
  state.armed=true;state.success=null;hideResult();schedule();
 }
 function calculated(event){
  const ctx=context(),data=event.detail;
  if(!ctx.mount||!data||data.kind!==ctx.kind)return;
  if(!(data.resources||[]).some(r=>Number.isFinite(r.required)&&r.required>0))return;
  state.success={kind:data.kind,signature:signature()};schedule();
 }
 // One delegated handler also covers static pages and SPA replacements. Metrics
 // owns consent, payload sanitization and transport; this does not send directly.
 document.addEventListener('click',event=>{
  if(event.defaultPrevented||(typeof event.button==='number'&&event.button!==0))return;
  const link=event.target?.closest?.('a[data-ten-tiktok]');
  if(!link||link.getAttribute('href')!==config.url)return;
  const placement=link.dataset.tenTiktok;
  if(!Object.prototype.hasOwnProperty.call(config.analytics.placements,placement))return;
  root.KD_METRICS?.emit(config.analytics.eventName,{placement,language:view.locale(location.pathname),page_type:config.analytics.placements[placement]});
 },true);
 ['input','change','click'].forEach(name=>document.addEventListener(name,intent,true));
 ['kd:calculated','kd:result-ready'].forEach(name=>root.addEventListener(name,calculated));
 ['kd:page-ready','popstate','hashchange'].forEach(name=>root.addEventListener(name,schedule));
 document.addEventListener('i18n:changed',schedule);
 function start(){
  context();reconcile();
  new MutationObserver(records=>{
   if(records.some(r=>!r.target.closest?.('[data-ten-profile]')&&(
    r.target.closest?.('#content,.site-footer')||Array.from(r.addedNodes).some(n=>n.nodeType===1&&(n.id==='content'||n.matches?.('.site-footer')))
   )))schedule();
  }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled','style','aria-invalid']});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);

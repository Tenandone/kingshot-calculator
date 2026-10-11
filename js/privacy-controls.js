(function(root){
 'use strict';if(root.__kdPrivacy)return;root.__kdPrivacy=true;
 const key='KSD_CONSENT_V1',id='G-TMGDGSEWW6';
 // Enable only after the exact GA4 stream's Enhanced Measurement is disabled and recorded.
 // send_page_view:false alone does not stop history pageviews or raw site-search events.
 const STREAM_PRIVACY_VERIFIED=true;
 let choice=null,transportReady=false,loaded=false,pending=[];
 const lang=root.location.pathname.match(/^\/(en|ja|zh-tw)\//)?.[1]||'ko';
 const copy={ko:['분석 설정','방문 통계 수집을 허용할까요? 검색 원문과 저장한 목표 내용은 보내지 않습니다. 성장 기록과 즐겨찾기는 선택과 관계없이 이 브라우저에 저장됩니다.','분석 허용','거절','현재 방문 통계 전송은 중지되어 있습니다. 선택한 설정은 이 브라우저에 보관됩니다.'],en:['Analytics settings','Allow usage analytics? Search text and saved plan details are not sent. Progress and favorites stay in this browser regardless of this choice.','Allow analytics','Decline','Usage analytics transmission is currently paused. Your preference stays in this browser.'],ja:['分析設定','利用統計の収集を許可しますか？検索文や保存した計画の内容は送信しません。育成記録とお気に入りは選択に関わらずこのブラウザに保存します。','分析を許可','拒否','現在、利用統計の送信は停止しています。設定はこのブラウザに保存します。'],'zh-tw':['分析設定','是否允許收集使用統計？不傳送搜尋原文或已儲存計畫內容。無論此選擇為何，成長紀錄與收藏僅儲存在此瀏覽器。','允許分析','拒絕','目前已暫停傳送使用統計。設定將保存在此瀏覽器。']}[lang];
 function read(){try{return JSON.parse(root.localStorage.getItem(key));}catch(_){return null;}}
 function allowed(){return choice?.analytics===true&&read()?.analytics===true;}
 function production(){return root.location.hostname==='kingshotdata.kr';}
 function context(){const language=root.location.pathname.match(/^\/(ko|en|ja|zh-tw)(?:\/|$)/)?.[1]||'ko',type=root.KD_METRICS?.pageType()||'other';return{page_location:'https://kingshotdata.kr/'+language+'/'+type+'/',page_referrer:'',page_title:'KingShotData | '+type,ignore_referrer:true};}
 function canRecord(){return STREAM_PRIVACY_VERIFIED&&production()&&allowed()&&!root['ga-disable-'+id];}
 function canSend(){return canRecord()&&transportReady;}
 function send(name,params){if(!canRecord())return false;const event=root.KD_METRICS?.clean(name,params);if(!event)return false;const data={...event.params,...context(),send_to:id};if(!transportReady){if(['page_view','detail_view','planner_enter'].includes(event.name))return false;if(pending.length>=32)return false;pending.push({name:event.name,data});return true;}root.gtag('event',event.name,data);return true;}
 function status(){return{provider:'ga4',measurementId:id,configured:true,consent:allowed()?'allowed':choice?'declined':'unset',enabled:canSend(),reason:!STREAM_PRIVACY_VERIFIED?'stream_privacy_unverified':!production()?'nonproduction':!allowed()?'consent_required':transportReady?'ready':'loading'};}
 function notify(){root.dispatchEvent(new CustomEvent('kd:analytics-consent'));}
 function apply(value){
  choice=value;const enabled=STREAM_PRIVACY_VERIFIED&&production()&&allowed();root['ga-disable-'+id]=!enabled;
  if(!enabled){transportReady=false;pending=[];return;}
  if(root.__gaLoaded){transportReady=loaded;root.gtag?.('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});return;}
  root.__gaLoaded=true;root.dataLayer=root.dataLayer||[];root.gtag=function(){if(allowed()&&!root['ga-disable-'+id])root.dataLayer.push(arguments);};
  root.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});root.gtag('js',new Date());root.gtag('config',id,{...context(),send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,url_passthrough:false});
  const s=root.document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+id;s.referrerPolicy='no-referrer';s.onload=()=>{loaded=true;transportReady=allowed()&&!root['ga-disable-'+id];const batch=pending;pending=[];if(transportReady){for(const event of batch){if(!canSend())break;root.gtag('event',event.name,event.data);}notify();}};s.onerror=()=>{transportReady=false;pending=[];};root.document.head.appendChild(s);
 }
 function start(){
  const doc=root.document,style=doc.createElement('style');style.textContent='.kd-privacy-banner{position:fixed;z-index:9999;bottom:76px;left:12px;right:12px;max-width:620px;margin:auto;background:#fff;color:#172a3a;padding:18px;border:1px solid #a5b6bf;border-radius:14px;box-shadow:0 8px 32px #0003;font:15px/1.6 system-ui}.kd-privacy-banner[hidden]{display:none}.kd-privacy-banner button,.kd-privacy-settings{font:inherit;background:#f1f5f9;color:#173d4a;border:1px solid #9caeb6;border-radius:8px;min-height:44px;padding:8px 16px;margin:4px;cursor:pointer}.kd-privacy-note{font-size:13px;color:#4b5d67}';doc.head.appendChild(style);
  const panel=doc.createElement('section');panel.className='kd-privacy-banner';panel.setAttribute('aria-label',copy[0]);panel.innerHTML='<p>'+copy[1]+'</p>'+(!STREAM_PRIVACY_VERIFIED?'<p class="kd-privacy-note">'+copy[4]+'</p>':'')+'<button type="button" data-allow>'+copy[2]+'</button><button type="button" data-decline>'+copy[3]+'</button>';doc.body.appendChild(panel);
  const setting=doc.createElement('button');setting.type='button';setting.className='kd-privacy-settings';setting.textContent=copy[0];(doc.querySelector('footer')||doc.body).appendChild(setting);setting.onclick=()=>{panel.hidden=false;panel.querySelector('button').focus();};
  function choose(allow){const value={necessary:true,analytics:allow,ads:false};try{root.localStorage.setItem(key,JSON.stringify(value));}catch(_){}apply(value);panel.hidden=true;setting.focus();notify();}
  panel.querySelector('[data-allow]').onclick=()=>choose(true);panel.querySelector('[data-decline]').onclick=()=>choose(false);const saved=read();panel.hidden=!!saved;apply(saved);
 }
 root.KD_PRIVACY={canRecord,canSend,send,status,version:'ks-ui9-20261012'};
 root['ga-disable-'+id]=true;
 root.addEventListener('storage',e=>{if(e.key===key){apply(read());notify();}});
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);

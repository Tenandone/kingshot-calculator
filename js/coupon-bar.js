/* Gift-code summary. Shares publication/expiry rules with the detail page. */
(function(win){
  'use strict';
  const copy={
    ko:{title:'기프트코드',active:'개 사용 가능',open:'전체 코드 · 입력 방법',checked:'마지막 확인',copy:'복사',copied:'복사됨',manual:'코드를 선택해 복사하세요.',show:'코드 바로 복사',empty:'현재 확인된 활성 코드가 없습니다.'},
    en:{title:'Gift codes',active:'active codes',open:'All codes · How to redeem',checked:'Last checked',copy:'Copy',copied:'Copied',manual:'Select the code to copy it.',show:'Quick copy',empty:'No active codes are currently confirmed.'},
    ja:{title:'ギフトコード',active:'件利用可能',open:'コード一覧・交換方法',checked:'最終確認',copy:'コピー',copied:'コピー済み',manual:'コードを選択してコピーしてください。',show:'コードをコピー',empty:'確認済みの有効なコードはありません。'},
    'zh-tw':{title:'禮包碼',active:'組可用代碼',open:'所有代碼 · 兌換方式',checked:'最後確認',copy:'複製',copied:'已複製',manual:'請選取代碼並複製。',show:'快速複製代碼',empty:'目前沒有已確認可用的代碼。'}
  };
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let payload=null,pending=null,timer=null;
  const locale=()=>location.pathname.match(/^\/(en|ja|zh-tw)(?:\/|$)/i)?.[1].toLowerCase()||'ko';
  function render(){
    const host=document.getElementById('couponBarMount');if(!host||!payload||!win.KD_COUPON_STATE)return;
    const l=locale(),c=copy[l],items=(payload.coupons||[]).filter(x=>win.KD_COUPON_STATE.isActive(x,Date.now())),expanded=host.querySelector('details')?.open;
    const checked=win.KD_COUPON_STATE.instant(payload.lastCheckedAt),date=checked==null?'':new Intl.DateTimeFormat(l==='zh-tw'?'zh-TW':l,{dateStyle:'medium',timeStyle:'short'}).format(checked);
    host.innerHTML='<section class="kd-gift-summary" aria-label="'+esc(c.title)+'"><div class="kd-gift-summary__heading"><strong>'+esc(c.title)+'</strong><span class="kd-gift-count">'+items.length+' '+esc(c.active)+'</span><a href="/'+l+'/guides/kingshot-giftcode.html">'+esc(c.open)+' <span aria-hidden="true">›</span></a></div>'+(date?'<p class="kd-gift-checked">'+esc(c.checked)+': <time datetime="'+esc(payload.lastCheckedAt)+'">'+esc(date)+'</time></p>':'')+'<details'+(expanded?' open':'')+'><summary>'+esc(c.show)+'</summary><div class="kd-gift-codes">'+items.map(x=>'<div><code>'+esc(x.code)+'</code><button type="button" data-gift-copy="'+esc(x.code)+'" aria-label="'+esc(c.copy+' '+x.code)+'">'+esc(c.copy)+'</button></div>').join('')+'</div>'+(!items.length?'<p>'+esc(c.empty)+'</p>':'')+'</details><span class="hub-sr-only" role="status" data-gift-status></span></section>';
    host.querySelectorAll('[data-gift-copy]').forEach(button=>button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(button.dataset.giftCopy);button.textContent=c.copied;host.querySelector('[data-gift-status]').textContent=c.copied;setTimeout(()=>{if(button.isConnected)button.textContent=c.copy;},1800);}catch{host.querySelector('[data-gift-status]').textContent=c.manual;const range=document.createRange();range.selectNodeContents(button.previousElementSibling);const selection=win.getSelection();selection.removeAllRanges();selection.addRange(range);}}));
  }
  async function refresh(){
    if(!document.getElementById('couponBarMount'))return;
    if(pending)return pending;
    pending=(async()=>{try{const r=await fetch('/data/coupons.json',{cache:'no-store'});if(!r.ok)throw Error('Coupon data unavailable');payload=await r.json();render();}catch{const h=document.getElementById('couponBarMount');if(h&&!payload)h.textContent='';}finally{pending=null;}})();return pending;
  }
  function start(){refresh();if(!timer)timer=setInterval(()=>{if(!document.hidden)render();},60000);}
  win.KD_COUPONBAR={refresh,destroy(){clearInterval(timer);timer=null;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  document.addEventListener('i18n:changed',render);
  win.addEventListener('kd:page-ready',()=>{payload?render():refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})(window);

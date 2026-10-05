(function(root){
 'use strict';
 const messages={
  ko:['데이터 검증 상태: 일부 확인','이 페이지의 수치·효과·획득 조건은 전체 검증이 완료되지 않았습니다. 별도로 확인 표시가 없는 값은 검증되지 않은 참고값입니다. 계산 결과도 이 자료를 이용한 추정치이므로 자원을 사용하기 전에 게임 화면과 대조하세요.'],
  en:['Data verification: partial','Values, effects and unlock conditions on this page have not all been verified. Unless explicitly marked as checked, values are unverified references. Calculator results based on them are estimates; compare with the game before spending resources.'],
  ja:['データ検証：一部確認済み','このページの数値・効果・解放条件は全件検証されていません。確認済みと明記していない値は未検証の参考値です。計算結果も推定値のため、資源を使用する前にゲーム画面で確認してください。'],
  'zh-tw':['資料驗證：部分完成','本頁數值、效果及解鎖條件尚未全部驗證。未明確標示已確認的數值均為未驗證參考資料。計算結果亦為估算，使用資源前請先核對遊戲畫面。']
 };
 function html(pathname){
  const p=pathname.replace(/^\/(en|ko|ja|zh-tw)(?=\/)/,'');
  if(!/^\/(hero(?:es)?|buildings?|research|waracademy|pet|masters?|items?|events?|calc-(?:building|charm|gear|hero-gear|pet|training))(?:\/|$)/.test(p)&&!/governor-(?:gear|charm)|hero-gear|mastery/.test(p))return '';
  const lang=pathname.match(/^\/(en|ja|zh-tw)\//)?.[1]||'ko',m=messages[lang];
  return '<aside data-verification-note style="max-width:1100px;margin:16px auto;padding:14px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;color:#334155"><strong>'+m[0]+'</strong><p style="margin:6px 0 0">'+m[1]+'</p></aside>';
 }
 if(typeof module==='object'&&module.exports){module.exports={html};return;}
 function start(){const markup=html(location.pathname);if(!markup)return;const main=document.getElementById('content')||document.querySelector('main')||document.body;if(!main)return;document.querySelectorAll('[data-verification-note]').forEach(n=>n.remove());main.insertAdjacentHTML('afterbegin',markup);}
 document.addEventListener('DOMContentLoaded',start,{once:true});root.addEventListener('kd:page-ready',start);
})(typeof window==='undefined'?{}:window);

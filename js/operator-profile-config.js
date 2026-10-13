/* TEN's operator signature: shared by the static publisher and browser. */
(function(root,factory){
 const config=factory();
 if(typeof module==='object'&&module.exports)module.exports=config;
 else root.KD_OPERATOR_PROFILE_CONFIG=config;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 return {
  version:'ks-ten-20261013',
  name:'TEN',
  url:'https://www.tiktok.com/@iamten_4100',
  handle:'@iamten_4100',
  placements:{guide_footer:'profile',calculator_result:'compact',about:'profile',site_footer:'link'},
  routes:{guides:'^/(ko|en|ja|zh-tw)/guides/[^/]+\\.html$',about:'^/(?:(?:ko|en|ja|zh-tw)/)?about/?$',home:'^/(?:(?:ko|en|ja|zh-tw)/)?$',calculators:'^/(?:(?:ko|en|ja|zh-tw)/)?calc-(gear|charm|pet)/?$'},
  analytics:{eventName:'ten_tiktok_click',placements:{guide_footer:'guide',calculator_result:'calculator',about:'about',site_footer:'home'}},
  locales:{
   ko:{role:'KingShotData 운영자',bio:'게임 밖에서는 일상과 라이브로 소통하고 있어.',personal:'개인 계정',footer:'TEN의 개인 TikTok',label:'운영자 TEN',newWindow:'새 창에서 열기'},
   en:{role:'KingShotData operator',bio:'Outside the game, I share everyday moments and chat on live streams.',personal:'Personal account',footer:'TEN’s personal TikTok',label:'About TEN, the operator',newWindow:'Opens in a new tab'},
   ja:{role:'KingShotData 運営者',bio:'ゲームの外では、日常の投稿やライブ配信で交流しています。',personal:'個人アカウント',footer:'TENの個人TikTok',label:'運営者TENについて',newWindow:'新しいタブで開きます'},
   'zh-tw':{role:'KingShotData 營運者',bio:'遊戲之外，我也會分享日常，透過直播和大家聊天。',personal:'個人帳號',footer:'TEN的個人TikTok',label:'關於營運者TEN',newWindow:'在新分頁開啟'}
  }
 };
});

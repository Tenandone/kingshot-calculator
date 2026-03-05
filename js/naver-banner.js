// /js/naver-banner.js
(function(){
  'use strict';

  var MOUNT_ID = 'naverCafeBannerMount';
  var SRC = '/tools/naver-banner.html';
  var bannerReqId = 0;

  async function loadNaverCafeBanner(){
    var mount = document.getElementById(MOUNT_ID);
    if (!mount) return;

    var reqId = ++bannerReqId;
    var lang = (document.documentElement.getAttribute('lang') || 'en').trim();

    if (lang !== 'ko') {
      mount.innerHTML = '';
      return;
    }

    try{
      var res = await fetch(SRC + '?v=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      var html = await res.text();

      if (reqId !== bannerReqId) return;

      if ((document.documentElement.getAttribute('lang') || 'en').trim() !== 'ko') {
        mount.innerHTML = '';
        return;
      }

      mount.innerHTML = html;
    }catch(_e){
      if (reqId !== bannerReqId) return;
      mount.innerHTML = '';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNaverCafeBanner);
  } else {
    loadNaverCafeBanner();
  }

  document.addEventListener('i18n:changed', loadNaverCafeBanner);
})();
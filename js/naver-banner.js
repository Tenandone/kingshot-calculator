// /js/naver-banner.js
(function(){
  'use strict';

  var MOUNT_ID = 'naverCafeBannerMount';
  var SRC = '/tools/naver-banner.html';
  var bannerReqId = 0;
  var observer = null;

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
      var src = window.v ? window.v(SRC) : SRC;
      var res = await fetch(src, { cache: 'default' });
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

  function scheduleNaverCafeBanner(){
    var mount = document.getElementById(MOUNT_ID);
    if (!mount) return;
    if (mount.dataset.naverBannerLoaded === '1') return;

    if (!('IntersectionObserver' in window)) {
      mount.dataset.naverBannerLoaded = '1';
      loadNaverCafeBanner();
      return;
    }

    if (observer) observer.disconnect();
    observer = new IntersectionObserver(function(entries){
      if (!entries.some(function(entry){ return entry.isIntersecting; })) return;
      observer.disconnect();
      observer = null;
      mount.dataset.naverBannerLoaded = '1';
      loadNaverCafeBanner();
    }, { rootMargin: '160px 0px' });
    observer.observe(mount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleNaverCafeBanner);
  } else {
    scheduleNaverCafeBanner();
  }

  document.addEventListener('i18n:changed', function(){
    var mount = document.getElementById(MOUNT_ID);
    if (mount && mount.dataset.naverBannerLoaded === '1') loadNaverCafeBanner();
    else scheduleNaverCafeBanner();
  });
})();

// /js/coupon-bar.js
(function(){
  'use strict';

  var MOUNT_ID = 'couponBarMount';
  var SRC = '/tools/coupon-bar.html';
  var remountTimer = null;

  function curLang(){
    var dataLang = (document.documentElement.getAttribute('data-lang') || '').trim();
    if (dataLang === 'ko' || dataLang === 'en' || dataLang === 'ja' || dataLang === 'zh-TW') return dataLang;

    var l = (document.documentElement.getAttribute('lang') || 'en').trim();
    if (l === 'ko' || l === 'en' || l === 'ja' || l === 'zh-TW') return l;

    var low = l.toLowerCase();
    if (low === 'zh-hant' || low === 'zh-tw' || low === 'tw' || low === 'zh_tw') return 'zh-TW';
    return 'en';
  }

  async function fetchText(url){
    var res = await fetch(url + '?v=' + Date.now(), { cache:'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  }

  async function mountCouponBar(){
    var mount = document.getElementById(MOUNT_ID);
    if (!mount) return;

    try{
      mount.innerHTML = await fetchText(SRC);

      var root = mount.querySelector('[data-kd-couponbar="1"]') || mount.querySelector('.kd-couponbar');
      if (!root) {
        mount.innerHTML = '';
        return;
      }

      if (window.KD_COUPONBAR && typeof window.KD_COUPONBAR.destroy === 'function') {
        window.KD_COUPONBAR.destroy();
      }

      window.KD_COUPONBAR = createCouponBarController(root);
      await window.KD_COUPONBAR.refresh();
    }catch(_e){
      mount.innerHTML = '';
    }
  }

  function createCouponBarController(root){
    var tickTimer = null;
    var targetNextMs = null;
    var cachedCount = 0;
    var destroyed = false;

    var TXT = {
      ko: { title:'킹샷 쿠폰 타이머', coupons:'쿠폰', next:'만료까지', now:'현재시간', suffix:'개 활성' },
      en: { title:'Kingshot Coupon Timer', coupons:'Coupons', next:'To expiry', now:'Now', suffix:'active' },
      ja: { title:'キングショット クーポンタイマー', coupons:'クーポン', next:'期限まで', now:'現在', suffix:'件 有効' },
      'zh-TW': { title:'Kingshot 優惠碼倒數', coupons:'優惠碼', next:'距到期', now:'目前時間', suffix:'個可用' }
    };

    function t(k){
      var l = curLang();
      return (TXT[l] && TXT[l][k]) || (TXT.en && TXT.en[k]) || k;
    }

    function safeStr(v){
      return v == null ? '' : String(v);
    }

    function parseExpiryMs(c){
      var iso = safeStr(c && c.expiresAt).trim();
      if (iso){
        var ts = Date.parse(iso);
        if (Number.isFinite(ts)) return ts;
      }

      var until = safeStr(c && c.until).trim();
      if (until){
        var p = until.split('-');
        if (p.length === 3){
          var y = p[0];
          var m = String(p[1]).padStart(2, '0');
          var d = String(p[2]).padStart(2, '0');
          var ts2 = Date.parse(y + '-' + m + '-' + d + 'T00:00:00Z');
          if (Number.isFinite(ts2)) return ts2;
        }
      }

      return null;
    }

    function isActive(c, nowMs){
      var exp = parseExpiryMs(c);
      if (exp == null || nowMs >= exp) return false;

      var st = safeStr(c && c.startAt).trim();
      if (st){
        var stMs = Date.parse(st);
        if (Number.isFinite(stMs) && nowMs < stMs) return false;
      }

      return true;
    }

    function fmt2(n){
      return String(n).padStart(2, '0');
    }

    function clockNow(dt){
      return fmt2(dt.getHours()) + ':' + fmt2(dt.getMinutes()) + ':' + fmt2(dt.getSeconds());
    }

    function countdown(ms){
      var sec = Math.max(0, Math.floor(ms / 1000));
      var d = Math.floor(sec / 86400); sec %= 86400;
      var h = Math.floor(sec / 3600); sec %= 3600;
      var m = Math.floor(sec / 60); sec %= 60;

      if (d > 0) return d + 'd ' + fmt2(h) + ':' + fmt2(m) + ':' + fmt2(sec);
      return fmt2(h) + ':' + fmt2(m) + ':' + fmt2(sec);
    }

    async function loadCoupons(){
      var res = await fetch('/data/coupons.json?v=' + Date.now(), { cache:'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      var data = await res.json();
      return Array.isArray(data && data.coupons)
        ? data.coupons
        : (Array.isArray(data) ? data : []);
    }

    function computeNextExpiry(active){
      var min = null;
      for (var i = 0; i < active.length; i++){
        var ms = parseExpiryMs(active[i]);
        if (ms == null) continue;
        if (min == null || ms < min) min = ms;
      }
      return min;
    }

    function q(sel){
      return root.querySelector(sel);
    }

    var els = {
      go: q('.kd-couponbar__a'),
      title: q('[data-kd="title"]'),
      lCoupons: q('[data-kd="lCoupons"]'),
      lNext: q('[data-kd="lNext"]'),
      lNow: q('[data-kd="lNow"]'),
      vCoupons: q('[data-kd="vCoupons"]'),
      vNext: q('[data-kd="vNext"]'),
      vNow: q('[data-kd="vNow"]')
    };

    function applyText(){
      if (els.title) els.title.textContent = t('title');
      if (els.lCoupons) els.lCoupons.textContent = t('coupons');
      if (els.lNext) els.lNext.textContent = t('next');
      if (els.lNow) els.lNow.textContent = t('now');
    }

    function renderCount(){
      if (!els.vCoupons) return;

      var l = curLang();
      var sfx = t('suffix');
      els.vCoupons.textContent = (l === 'en') ? (cachedCount + ' ' + sfx) : (cachedCount + sfx);
    }

    function syncLink(){
      if (!els.go) return;
      els.go.href = '/tools/coupon-countdown.html?lang=' + encodeURIComponent(curLang());
    }

    function tick(){
      if (destroyed) return;

      var now = new Date();

      if (els.vNow) {
        els.vNow.textContent = clockNow(now);
      }

      if (els.vNext){
        if (!targetNextMs) {
          els.vNext.textContent = '—';
        } else {
          var diff = targetNextMs - Date.now();
          els.vNext.textContent = (diff <= 0) ? '00:00:00' : countdown(diff);
        }
      }
    }

    async function refresh(){
      if (destroyed) return;

      try{
        applyText();
        syncLink();

        var list = await loadCoupons();
        if (destroyed) return;

        var nowMs = Date.now();
        var active = list.filter(function(c){
          return c && c.code && isActive(c, nowMs);
        });

        cachedCount = active.length;
        renderCount();
        targetNextMs = computeNextExpiry(active);

        root.hidden = false;

        if (tickTimer) clearInterval(tickTimer);
        tick();
        tickTimer = setInterval(tick, 1000);
      }catch(_e){
        root.hidden = true;
        if (tickTimer) clearInterval(tickTimer);
      }
    }

    function destroy(){
      destroyed = true;
      if (tickTimer) {
        clearInterval(tickTimer);
        tickTimer = null;
      }
    }

    return {
      refresh: refresh,
      destroy: destroy
    };
  }

  function handleLangChanged(){
    if (remountTimer) clearTimeout(remountTimer);
    remountTimer = setTimeout(function(){
      mountCouponBar();
    }, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountCouponBar);
  } else {
    mountCouponBar();
  }

  document.addEventListener('i18n:changed', handleLangChanged);
})();
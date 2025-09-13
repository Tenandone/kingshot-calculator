// /js/standalone-bridge.js
(function () {
  'use strict';

  // ===== 0) SPA 내부면 아무 것도 하지 않음 =====
  var inSPA = !!(window.__KSD_ROUTES__ || window.__KSD_DISPATCH__ || document.getElementById('content'));
  if (inSPA) return;

  // ===== helpers =====
  function addCSS(href) {
    if (!document.querySelector(`link[rel="stylesheet"][href^="${href}"]`)) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href;
      document.head.appendChild(l);
    }
  }
  function addInlineStyle(css) { var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }
  function normLang(x){
    x = (x || '').toLowerCase();
    if (x.startsWith('zh')) return x.includes('tw') ? 'zh-TW' : 'zh-CN';
    if (x.startsWith('ja')) return 'ja';
    if (x.startsWith('en')) return 'en';
    return 'ko';
  }
  function redirectToSPA(hash) {
    var lang = document.documentElement.getAttribute('lang') || 'ko';
    location.href = '/?lang=' + encodeURIComponent(lang) + (hash || '#/home');
  }

  // ===== 1) base 보장 =====
  if (!document.querySelector('base')) {
    var b = document.createElement('base'); b.setAttribute('href','/'); document.head.appendChild(b);
  }

  // ===== 2) 최소 CSS 보장 =====
  addCSS('/css/common.css?v=now');

  // ===== 3) 언어 확정 =====
  var sp   = new URLSearchParams(location.search);
  var lang = normLang(sp.get('lang') || document.documentElement.getAttribute('lang') || navigator.language || 'ko');
  document.documentElement.setAttribute('lang', lang);

  // ===== 4) 미니 헤더 (인덱스 + 해시 라우트로 이동) =====
  if (!document.querySelector('.mini-header')) {
    addInlineStyle(`
      .mini-header{position:sticky;top:0;z-index:999;background:#fff;border-bottom:1px solid #e5e7eb}
      .mh-wrap{max-width:1200px;margin:0 auto;padding:10px 12px;display:flex;gap:16px;align-items:center;justify-content:space-between}
      .mh-brand{display:flex;align-items:center;gap:8px}
      .mh-logo{height:32px;width:auto;display:block}
      .mh-nav{display:flex;gap:12px;flex-wrap:wrap}
      .mh-nav a{font-size:14px;color:#333;text-decoration:none;padding:6px 10px;border-radius:8px}
      .mh-nav a:hover{background:#f5f6f7}
      .mh-right{display:flex;gap:8px;align-items:center}
      .mh-lang{padding:4px 8px;border:1px solid #ddd;border-radius:6px;background:#fff}
    `);
    var qstr = '?lang=' + encodeURIComponent(lang);
    var header = document.createElement('header');
    header.className = 'mini-header';
    header.innerHTML = [
      '<div class="mh-wrap">',
        '<a class="mh-brand" href="/', qstr, '#/" aria-label="KingshotData Home">',
          '<img class="mh-logo" src="/img/logo-kingshotdata.png" alt="KingshotData" decoding="async" />',
        '</a>',
        '<nav class="mh-nav" aria-label="Mini navigation">',
          '<a href="/', qstr, '#/buildings">건물</a>',
          '<a href="/', qstr, '#/heroes">영웅</a>',
          '<a href="/', qstr, '#/database">데이터베이스</a>',
          '<a href="/', qstr, '#/guides">가이드</a>',
          '<a href="/', qstr, '#/calculator">계산기</a>',
          '<a href="/', qstr, '#/about">소개</a>',
        '</nav>',
        '<div class="mh-right">',
          '<select class="mh-lang" aria-label="Language">',
            '<option value="ko">한국어</option>',
            '<option value="en">English</option>',
            '<option value="ja">日本語</option>',
            '<option value="zh-CN">简体</option>',
            '<option value="zh-TW">繁體</option>',
          '</select>',
        '</div>',
      '</div>'
    ].join('');
    document.body.insertBefore(header, document.body.firstChild);

    var sel = header.querySelector('.mh-lang');
    sel.value = lang;
    sel.addEventListener('change', function(){
      var newLang = sel.value;
      var hash = location.hash && location.hash.startsWith('#/') ? location.hash : '#/home';
      location.href = '/?lang=' + encodeURIComponent(newLang) + hash;
    });
  }

  // ===== 5) 계산기 페이지는 지정 시간 내 무조건 SPA로 이동 =====
  (function forceRedirectCalculators(){
    // URL 기반으로 계산기 판별(마운트 유무와 무관, 가장 확실)
    var p = (location.pathname || '').toLowerCase();
    var hash = null;
    if (p.includes('/pages/calculators/building.html'))  hash = '#/calc-building';
    else if (p.includes('/pages/calculators/gear.html')) hash = '#/calc-gear';
    else if (p.includes('/pages/calculators/charm.html')) hash = '#/calc-charm';
    else if (p.includes('/pages/calculators/training.html')) hash = '#/calc-training';
    else if (p.includes('/pages/calculators/vip.html')) hash = '#/calc-vip';

    // delay ms: 기본 1500, ?delay=500 같이 조절 가능 (0~5000 제한)
    var delay = Number(sp.get('delay'));
    if (!Number.isFinite(delay)) delay = 1500;
    delay = Math.max(0, Math.min(5000, delay));

    if (hash) setTimeout(function(){ redirectToSPA(hash); }, delay);
  })();

  // (선택) 영웅/DB/가이드는 단독 유지. 필요하면 같은 방식으로 리다이렉트 추가 가능.
})();

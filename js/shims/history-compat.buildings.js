// /js/shims/history-compat.buildings.js
// 목적: 기존 해시(#/building, #/buildings) 기반 빌딩 코드를 수정하지 않고
//       History 모드 경로(/buildings, /buildings/:slug)에서 정상 동작하게 하는 호환 레이어
(function () {
  'use strict';

  // 현재 경로에서 /buildings/:slug 추출
  function currentBuildingSlug() {
    const m = location.pathname.match(/^\/buildings\/([^/?#]+)$/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  // 해시를 원하는 값으로 맞추고 hashchange 이벤트 발사
  function ensureHash(desiredHash) {
    if (location.hash !== desiredHash) {
      history.replaceState(null, '', location.pathname + location.search + desiredHash);
      // 기존 빌딩 코드가 hashchange에 반응하도록 명시적으로 이벤트 발사
      try { window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (_) {}
    }
  }

  // 클릭 인터셉트: #/building/slug → /buildings/slug,  #/buildings → /buildings
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    let a = e.target;
    while (a && a.tagName !== 'A') a = a.parentElement;
    if (!a) return;

    const href = a.getAttribute('href') || '';

    // 상세: #/building/{slug}
    if (href.startsWith('#/building/')) {
      e.preventDefault();
      const slug = href.replace(/^#\/building\/?/, '');
      if (window.navigate) window.navigate(`/buildings/${slug}`);
      else { history.pushState(null, '', `/buildings/${slug}`); ensureHash(`#/building/${slug}`); }
      return;
    }

    // 목록: #/buildings (또는 뒤에 쿼리 붙은 변형)
    if (href === '#/buildings' || href.startsWith('#/buildings?')) {
      e.preventDefault();
      if (window.navigate) window.navigate('/buildings');
      else { history.pushState(null, '', '/buildings'); ensureHash('#/buildings'); }
      return;
    }
  });

  // initBuildings 훅킹: 빌딩 JS가 로드된 직후, 현재 경로에 맞는 "가짜 해시"를 주입하고 hashchange 발사
  function wrapInit(fn) {
    return function wrappedInit() {
      const slug = currentBuildingSlug();
      if (slug) ensureHash(`#/building/${slug}`);
      else      ensureHash('#/buildings');
      return fn.apply(this, arguments);
    };
  }

  // 이미 로드된 경우
  if (typeof window.initBuildings === 'function') {
    window.initBuildings = wrapInit(window.initBuildings);
    return;
  }

  // 늦게 로드되는 경우까지 커버: setter 훅
  Object.defineProperty(window, 'initBuildings', {
    configurable: true,
    set(value) {
      const wrapped = (typeof value === 'function') ? wrapInit(value) : value;
      Object.defineProperty(window, 'initBuildings', {
        value: wrapped,
        writable: true,
        configurable: true,
        enumerable: true
      });
    }
  });

  // 페이지 새로고침으로 /buildings 또는 /buildings/:slug 로 들어온 경우도 보호
  document.addEventListener('DOMContentLoaded', () => {
    const slug = currentBuildingSlug();
    if (slug) ensureHash(`#/building/${slug}`);
    else if (location.pathname === '/buildings') ensureHash('#/buildings');
  });
})();

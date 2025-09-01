// /js/guides.js
(function () {
  'use strict';
  if (window.__GUIDES_INIT__) return;
  window.__GUIDES_INIT__ = true;

  function buildTOC() {
    const toc = document.getElementById('guide-toc');
    if (!toc) return;
    const blocks = Array.from(document.querySelectorAll('.g-block'));
    toc.innerHTML = blocks.map(b => {
      const id = b.id;
      const title = b.querySelector('.g-title')?.textContent?.trim() || id;
      return `<a href="#${id}">${title}</a>`;
    }).join('');
  }

  function initSearch() {
    const input = document.getElementById('guide-search');
    const counter = document.getElementById('guide-count');
    if (!input) return;

    const blocks = Array.from(document.querySelectorAll('.g-block'));
    const cards  = Array.from(document.querySelectorAll('.guide-card')); // 수동 카드와 동기화

    const apply = () => {
      const q = (input.value || '').trim().toLowerCase();
      let shown = 0;
      blocks.forEach((b, i) => {
        const text = b.textContent.toLowerCase();
        const hit = !q || text.includes(q);
        b.style.display = hit ? '' : 'none';
        if (cards[i]) cards[i].style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      if (counter) counter.textContent = `표시: ${shown}개`;
    };

    input.addEventListener('input', apply);
    apply();
  }

  async function loadIncludes(root) {
    const nodes = Array.from((root || document).querySelectorAll('[data-include]'));
    await Promise.all(nodes.map(async el => {
      const url = el.getAttribute('data-include');
      if (!url) return;
      try {
        const res = await fetch(url + '?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const text = await res.text();

        // 완전 문서면 <main> → 없으면 <body> → 없으면 원문
        let html = text;
        if (/<html[\s>]/i.test(text) || /<body[\s>]/i.test(text) || /<!doctype/i.test(text)) {
          const doc = new DOMParser().parseFromString(text, 'text/html');
          const rootEl = doc.querySelector('main') || doc.body;
          html = rootEl ? rootEl.innerHTML : text;
        }

        el.innerHTML = html;
        if (window.I18N?.applyTo) I18N.applyTo(el);
      } catch (err) {
        console.error('[include load fail]', url, err);
        el.innerHTML = `<div class="placeholder"><p class="muted">include 로드 실패: ${url}</p></div>`;
      }
    }));
  }

  // 내부 앵커(#id) 스무스 스크롤
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#/')) return; // 라우팅 링크 제외
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
  });

  // 외부 호출 가능
  window.GUIDES_apply = async function (root) {
    await loadIncludes(root || document);
    buildTOC();
    initSearch();
  };

  // 자동 1회 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.GUIDES_apply(document), { once: true });
  } else {
    window.GUIDES_apply(document);
  }

  // 언어 변경 시 TOC 갱신
  document.addEventListener('i18n:changed', buildTOC);
})();

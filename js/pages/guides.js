// /js/guides.js — TOC/검색 + include + 접힘/펼침(지연 로드)
// ✅ FIX: SPA에서 #anchor 클릭이 전역 라우터에 가로채여 튀는 현상만 차단
// ✅ IMPORTANT: /pages/guides/*.html 링크는 "정적 이동(풀리로드)" 그대로 유지 (SPA로 변환 금지)
(function () {
  'use strict';
  if (window.__GUIDES_INIT__) return;
  window.__GUIDES_INIT__ = true;

  const d = document;

  function getGuidesRoot() {
    return d.querySelector('[data-ks-guides-root="1"]') || d;
  }

  // ✅ 앵커(#id)만 가로채서 스무스 스크롤 (capture로 전역 라우터보다 먼저)
  function bindGuidesAnchorOnly(root){
    if (!root || root.__guides_anchor_bound) return;
    root.__guides_anchor_bound = true;

    root.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;

      const href = (a.getAttribute('href') || '').trim();
      if (!href) return;

      // 외부/새창/다운로드는 그대로
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      if (/^https?:\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      // 라우팅 hash 제외
      if (href.startsWith('#/')) return;

      // ✅ 같은 페이지 앵커만 처리
      if (href.charAt(0) !== '#' || href.length < 2) return;

      const id = href.slice(1);
      const target = d.getElementById(id);
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();

      try {
        if (history && history.replaceState) history.replaceState(null, '', '#' + id);
        else location.hash = '#' + id;
      } catch (_) {}

      try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
    }, true);
  }

  /* ========== TOC (목차) ========== */
  function buildTOC() {
    const toc = d.getElementById('guide-toc');
    if (!toc) return;

    const blocks = [...d.querySelectorAll('.g-block')].filter(b => {
      if (b.id === 'bear-tier') return false;
      const v = (b.dataset.toc || '').toLowerCase();
      return !(['false','0','no','off','hide'].includes(v));
    });

    const lang = d.documentElement.getAttribute('lang') || 'ko';
    const pickTitle = (h2) => {
      if (!h2) return '';
      const span = h2.querySelector(`.lang.lang-${lang}`);
      if (span) return span.textContent.trim();
      const vis = [...h2.querySelectorAll('.lang')].find(el => getComputedStyle(el).display !== 'none');
      if (vis) return vis.textContent.trim();
      return h2.textContent.trim();
    };

    toc.innerHTML = blocks.map(b => {
      const id = b.id;
      const h2 = b.querySelector('.g-title');
      const title = pickTitle(h2) || id;
      return `<a href="#${id}">${title}</a>`;
    }).join('');
  }

  /* ========== 검색 ========== */
  function initSearch() {
    const input = d.getElementById('guide-search');
    const counter = d.getElementById('guide-count');
    if (!input) return;

    const blocks = Array.from(d.querySelectorAll('.g-block'));
    const cards  = Array.from(d.querySelectorAll('.guide-card'));

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

  /* ========== data-include 로더(기존) ========== */
  async function loadIncludes(root) {
    const nodes = Array.from((root || d).querySelectorAll('[data-include]'));
    await Promise.all(nodes.map(async el => {
      const url = el.getAttribute('data-include');
      if (!url) return;
      try {
        const res = await fetch(url + '?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const text = await res.text();

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

  /* ============================================================
   * 접힘/펼침(이벤트 위임) + data-src 지연 로드 + 스코프 래퍼
   * ============================================================ */
  const SHOW_ICON = '▼▼▼';
  const HIDE_ICON = '▲▲▲';

  function currentLangParam(){
    const urlLang = new URLSearchParams(location.search).get('lang');
    const i18nLang = window.I18N?.getLang?.() || window.I18N?.lang;
    const lsLang = localStorage.getItem('lang');
    const lang = urlLang || i18nLang || lsLang || 'ko';
    return lang ? ('lang=' + encodeURIComponent(lang)) : '';
  }

  async function lazyInclude(host){
    if (!host || host.dataset.loaded === '1') return;
    let url = host.dataset.src || host.getAttribute('data-src');
    if (!url) return;

    const lp = currentLangParam();
    if (lp) url += (url.includes('?') ? '&' : '?') + lp;

    try{
      const html = await (await fetch(url, { credentials: 'same-origin' })).text();
      const doc  = new DOMParser().parseFromString(html, 'text/html');
      const frag = doc.querySelector('main') || doc.body || doc;

      const scope = host.dataset.scope || 'include-scope';
      host.innerHTML = `<div class="${scope}">${frag.innerHTML}</div>`;

      doc.querySelectorAll('style').forEach(st=>{
        const sig = (st.textContent||'').trim().slice(0,120);
        const dup = [...d.head.querySelectorAll('style')].some(s=>s.textContent.includes(sig));
        if (!dup){
          const copy = d.createElement('style');
          copy.textContent = st.textContent;
          d.head.appendChild(copy);
        }
      });

      frag.querySelectorAll('script').forEach(s=>{
        const ns = d.createElement('script');
        if (s.src){ ns.src = s.src; ns.defer = s.defer; ns.async = s.async; }
        else { ns.textContent = s.textContent; }
        [...s.attributes].forEach(a=>{ if (!ns.hasAttribute(a.name)) ns.setAttribute(a.name, a.value); });
        host.appendChild(ns);
      });

      if (window.I18N?.applyTo) I18N.applyTo(host);
      host.dataset.loaded = '1';
    }catch(err){
      console.error('[lazy include fail]', url, err);
      host.innerHTML = '<p class="muted">가이드를 불러오지 못했습니다.</p>';
    }
  }

  if (!window.__GUIDES_TOGGLE_WIRED__) {
    window.__GUIDES_TOGGLE_WIRED__ = true;
    d.addEventListener('click', onToggleClick, { passive: true });
  }

  async function onToggleClick(e){
    const btn = e.target.closest('.g-toggle');
    if (!btn) return;

    const block = btn.closest('.g-block');
    const body  = block?.querySelector('.g-body');
    if (!body) return;

    const open = btn.getAttribute('aria-expanded') === 'true';
    if (open){
      btn.setAttribute('aria-expanded','false');
      btn.textContent = SHOW_ICON;
      body.classList.remove('is-open');
      body.style.display = 'none';
    } else {
      btn.setAttribute('aria-expanded','true');
      btn.textContent = HIDE_ICON;
      body.classList.add('is-open');
      body.style.display = 'block';
      await lazyInclude(body);
    }
  }

  function initCollapsibles(root){
    (root || d).querySelectorAll('.g-block').forEach(block=>{
      const btn  = block.querySelector('.g-toggle');
      const body = block.querySelector('.g-body');
      if (!btn || !body) return;

      btn.removeAttribute('data-i18n');

      if (body.hasAttribute('data-include')){
        body.dataset.src = body.getAttribute('data-include');
        body.removeAttribute('data-include');
        body.innerHTML = '';
      }

      if (!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded','false');

      const open = btn.getAttribute('aria-expanded') === 'true' || body.classList.contains('is-open');
      if (open) {
        btn.setAttribute('aria-expanded','true');
        btn.textContent = HIDE_ICON;
        body.classList.add('is-open');
        body.style.display = 'block';
      } else {
        btn.setAttribute('aria-expanded','false');
        btn.textContent = SHOW_ICON;
        body.classList.remove('is-open');
        body.style.display = 'none';
      }
    });
  }

  window.addEventListener('i18n:change', ()=> { initCollapsibles(d); buildTOC(); });
  d.addEventListener('i18n:changed', ()=> { initCollapsibles(d); buildTOC(); });

  function openByHash(){
    const id = (location.hash||'').slice(1);
    if (!id) return;
    const block = d.getElementById(id);
    if (!block) return;
    const btn = block.querySelector('.g-toggle');
    if (btn && btn.getAttribute('aria-expanded') !== 'true'){
      btn.click();
      block.scrollIntoView({ behavior:'smooth', block:'start' });
    }
  }

  window.GUIDES_apply = async function (root) {
    const r = root || d;
    await loadIncludes(r);
    buildTOC();
    initSearch();
    initCollapsibles(r);
    openByHash();

    // ✅ 앵커만 스코프 가로채기
    bindGuidesAnchorOnly(getGuidesRoot());
  };

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', () => window.GUIDES_apply(d), { once: true });
  } else {
    window.GUIDES_apply(d);
  }

  d.addEventListener('i18n:changed', buildTOC);
})();
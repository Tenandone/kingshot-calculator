// /js/guides.js — TOC/검색 + include + 접힘/펼침(지연 로드)
(function () {
  'use strict';
  if (window.__GUIDES_INIT__) return;
  window.__GUIDES_INIT__ = true;

  const d = document;

  /* ========== TOC (목차) ========== */
  function buildTOC() {
    const toc = d.getElementById('guide-toc');
    if (!toc) return;

    // ✅ 제외 규칙: (1) id가 'bear-tier' 인 섹션 (2) data-toc="false|0|no|off|hide"
    const blocks = [...d.querySelectorAll('.g-block')].filter(b => {
      if (b.id === 'bear-tier') return false;
      const v = (b.dataset.toc || '').toLowerCase();
      return !(['false','0','no','off','hide'].includes(v));
    });

    // 다국어 span(.lang.lang-xx) 사용 시 현재 언어만 집어오기
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

  /* ========== 스무스 스크롤(내부 앵커) ========== */
  d.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#/')) return; // 라우팅 링크 제외

    const id = href.slice(1);
    const target = d.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
  });

  /* ============================================================
   * 접힘/펼침(이벤트 위임) + data-src 지연 로드 + 스코프 래퍼
   * ============================================================ */

  // 🔧 라벨은 기호 고정
  const SHOW_ICON = '▼▼▼';
  const HIDE_ICON = '▲▲▲';

  // 현재 언어 파라미터(포함 문서 번역 동기화)
  function currentLangParam(){
    const urlLang = new URLSearchParams(location.search).get('lang');
    const i18nLang = window.I18N?.getLang?.() || window.I18N?.lang;
    const lsLang = localStorage.getItem('lang');
    const lang = urlLang || i18nLang || lsLang || 'ko';
    return lang ? ('lang=' + encodeURIComponent(lang)) : '';
  }

  // data-src 지연 로드 + <style> 주입 + <script> 재실행 + i18n 적용
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

      // ✅ 스코프 래퍼 (data-scope || include-scope)
      const scope = host.dataset.scope || 'include-scope';
      host.innerHTML = `<div class="${scope}">${frag.innerHTML}</div>`;

      // <style> 1회 주입(간단한 중복 방지)
      doc.querySelectorAll('style').forEach(st=>{
        const sig = (st.textContent||'').trim().slice(0,120);
        const dup = [...d.head.querySelectorAll('style')].some(s=>s.textContent.includes(sig));
        if (!dup){
          const copy = d.createElement('style');
          copy.textContent = st.textContent;
          d.head.appendChild(copy);
        }
      });

      // <script> 재실행
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

  // ✅ 중복 바인딩 가드 + 토글 핸들러
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
      body.style.display = 'none';   // 인라인로 확실히 숨김
    } else {
      btn.setAttribute('aria-expanded','true');
      btn.textContent = HIDE_ICON;
      body.classList.add('is-open');
      body.style.display = 'block';  // 확실히 표시
      await lazyInclude(body);        // 첫 펼침 때만 로드
    }
  }

  // 초기 라벨/상태 정리
  function initCollapsibles(root){
    (root || d).querySelectorAll('.g-block').forEach(block=>{
      const btn  = block.querySelector('.g-toggle');
      const body = block.querySelector('.g-body');
      if (!btn || !body) return;

      // 번역 키 주입 방지 (아이콘 고정)
      btn.removeAttribute('data-i18n');

      // 과거 data-include가 남아있으면 data-src로 이동(자동 include 차단)
      if (body.hasAttribute('data-include')){
        body.dataset.src = body.getAttribute('data-include');
        body.removeAttribute('data-include');
        body.innerHTML = '';
      }

      if (!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded','false');

      // 상태/아이콘/표시 동기화
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

  // 언어 변경 시에도 아이콘 유지(번역 적용 금지) + 상태 재동기화 + TOC 재빌드
  window.addEventListener('i18n:change', ()=> { initCollapsibles(d); buildTOC(); });
  d.addEventListener('i18n:changed', ()=> { initCollapsibles(d); buildTOC(); });

  // 해시로 진입 시(#ruins 등) 자동 펼침
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

  /* ========== 외부 호출 가능 ========== */
  window.GUIDES_apply = async function (root) {
    await loadIncludes(root || d);   // data-include 처리
    buildTOC();
    initSearch();
    initCollapsibles(root || d);     // 접힘 초기화
    openByHash();                    // 해시 자동 펼침
  };

  /* ========== 자동 1회 실행 ========== */
  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', () => window.GUIDES_apply(d), { once: true });
  } else {
    window.GUIDES_apply(d);
  }

  // 언어 변경 시 TOC 갱신 (이벤트 네이밍 호환)
  d.addEventListener('i18n:changed', buildTOC);
})();

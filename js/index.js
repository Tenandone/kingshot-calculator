// js/index.js (FINAL, race-safe + include hydrate + i18n preload)
(function () {
  'use strict';

  // =========================
  // 기본 설정 & 유틸
  // =========================
  const ASSET_VER = window.ASSET_VER || 'now';
  const v = (url) => {
    if (!url) return url;
    if (/^(data:|blob:|#)/i.test(url)) return url;
    return url + (url.includes('?') ? '&' : '?') + 'v=' + ASSET_VER;
  };

  const $content = document.getElementById('content');
  let navToken = 0;                  // 마지막 네비만 유효
  let pendingController = null;      // fetch 취소용

  // 스크립트/스타일 로더(중복 방지)
  const _loadedScripts = new Set();
  async function ensureScript(url) {
    if (!url) return;
    if (_loadedScripts.has(url)) return;
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = v(url);
      s.async = false; // 순서 보장
      s.onload = () => { _loadedScripts.add(url); res(); };
      s.onerror = () => rej(new Error('script load fail: ' + url));
      document.head.appendChild(s);
    });
  }

  const _loadedCss = new Set();
  async function ensureCSS(url) {
    if (!url) return;
    if (_loadedCss.has(url)) return;
    await new Promise((res, rej) => {
      const exist = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .find(l => (l.getAttribute('href') || '').split('?')[0] === url.split('?')[0]);
      if (exist) { _loadedCss.add(url); return res(); }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = v(url);
      link.onload = () => { _loadedCss.add(url); res(); };
      link.onerror = () => rej(new Error('css load fail: ' + url));
      document.head.appendChild(link);
    });
  }

  // =========================
  // 라우트/타이틀/스크립트 맵
  // =========================
  const routes = {
    buildings: 'pages/buildings.html',
    database:  'pages/database.html',
    calculator:'pages/calculator.html',
    policy:    'pages/policy.html',
    about:     'pages/about.html',
    heroes:    'pages/heroes.html',

    // 상세
    towncenter:          'pages/buildings/towncenter.html',
    'truegold-crucible': 'pages/buildings/truegold-crucible.html',
    academy:             'pages/buildings/academy.html',
    embassy:             'pages/buildings/embassy.html',
    barracks:            'pages/buildings/barracks.html',
    range:               'pages/buildings/range.html',
    stable:              'pages/buildings/stable.html',
    'command-center':    'pages/buildings/command-center.html',
    kitchen:             'pages/buildings/kitchen.html',
    storehouse:          'pages/buildings/storehouse.html',
    'guard-station':     'pages/buildings/guard-station.html'
  };

  const PAGE_TITLES = {
    buildings: '건물 - KingshotData.KR',
    database:  '데이터베이스 - KingshotData.KR',
    calculator:'계산기 - KingshotData.KR',
    policy:    '이용약관 - KingshotData.KR',
    about:     '소개 - KingshotData.KR',
    heroes:    '영웅 - KingshotData.KR',
    towncenter:          '도시센터 - KingshotData.KR',
    'truegold-crucible': '순금정련소 - KingshotData.KR',
    academy:             '아카데미 - KingshotData.KR',
    embassy:             '대사관 - KingshotData.KR',
    barracks:            '보병대 - KingshotData.KR',
    range:               '궁병대 - KingshotData.KR',
    stable:              '기병대 - KingshotData.KR',
    'command-center':    '지휘부 - KingshotData.KR',
    kitchen:             '주방 - KingshotData.KR',
    storehouse:          '창고 - KingshotData.KR',
    'guard-station':     '방위소 - KingshotData.KR'
  };

  const PAGE_SCRIPTS = {
    buildings:  'js/pages/buildings.js',
    database:   'js/pages/database.js',
    calculator: 'js/pages/calculator.js',   // 여기 안에서 window.initCalculator 제공
    heroes:     'js/pages/heroes-spa.js'
  };

  const DETAIL_KEYS = new Set([
    'towncenter','truegold-crucible','academy','embassy','barracks','range','stable',
    'command-center','kitchen','storehouse','guard-station'
  ]);
  const DETAIL_SCRIPT = 'js/pages/buildings.js'; // window.initBuilding 제공

  // 페이지별 i18n 네임스페이스(선로딩)
  const PAGE_I18N = {
    buildings:  ['common','buildings'],
    database:   ['common','db'],
    calculator: ['common','calc'],
    policy:     ['common'],
    about:      ['common'],
    heroes:     ['common','heroes']
  };

  // 계산기 CSS
  const CALC_CSS = '/css/calculator.css';

  // =========================
  // include 하이드레이터 (재귀, 완료까지 대기)
  // =========================
  async function hydrateIncludes(rootEl, myToken) {
    const MAX_DEPTH = 6;
    const ver = (url) => v(url);
    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      if (myToken !== navToken) return;
      const nodes = rootEl.querySelectorAll('[data-include], [include]');
      if (!nodes.length) break;

      const tasks = [];
      nodes.forEach(node => {
        const url = node.getAttribute('data-include') || node.getAttribute('include');
        if (!url) return;
        tasks.push(
          fetch(ver(url), { cache: 'no-store' })
            .then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP '+r.status)))
            .then(html => ({ node, html }))
        );
      });

      const results = await Promise.allSettled(tasks);
      if (myToken !== navToken) return;

      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        const { node, html } = r.value;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('script').forEach(s => s.remove()); // 외부 스크립트는 로더로 통일
        const frag = document.createDocumentFragment();
        const body = doc.body;
        while (body.firstChild) frag.appendChild(body.firstChild);
        node.replaceWith(frag);
      }
    }
  }

  // =========================
  // i18n 도우미
  // =========================
  async function ensureI18N(namespaces) {
    if (!window.I18N) return;
    if (!I18N.current) {
      const saved = localStorage.getItem('lang');
      const urlLang = new URLSearchParams(location.search).get('lang');
      const fallback = (navigator.language || 'ko').replace('_','-');
      const lang = urlLang || saved || fallback;
      await I18N.init({ lang, namespaces: ['common'] });
    }
    if (Array.isArray(namespaces) && namespaces.length) {
      if (typeof I18N.loadNamespace === 'function') {
        for (const ns of namespaces) await I18N.loadNamespace(ns);
      } else if (typeof I18N.loadNS === 'function') {
        await I18N.loadNS(namespaces);
      }
    }
  }

  // =========================
  // 페이지 초기화 디스패처
  // =========================
  function runPageInit(key) {
    // 카테고리
    if (key === 'buildings' && typeof window.initBuildings === 'function') return window.initBuildings();
    if (key === 'database'  && typeof window.initDatabase  === 'function') return window.initDatabase();
    if (key === 'calculator'&& typeof window.initCalculator=== 'function') return window.initCalculator(); // ★ await 호출부에서 대기
    if (key === 'heroes'    && typeof window.initHeroesList=== 'function') return window.initHeroesList();
    // 상세 공통
    if (DETAIL_KEYS.has(key) && typeof window.initBuilding === 'function') return window.initBuilding(key);
  }

  // =========================
  // 핵심: 페이지 로더 (레이스-세이프)
  // =========================
  async function loadPage(page) {
    const my = ++navToken;

    // 이전 요청 취소
    if (pendingController) pendingController.abort();
    pendingController = new AbortController();

    const key  = routes[page] ? page : 'buildings';
    const path = routes[key];

    // 1) i18n 선로딩
    await ensureI18N(PAGE_I18N[key] || ['common']);

    // 2) HTML fetch + 주입
    window.scrollTo(0, 0);
    let html = '';
    try {
      const res = await fetch(v(path), { cache: 'no-store', signal: pendingController.signal });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
      html = await res.text();
    } catch (err) {
      if ($content) {
        $content.innerHTML = `
          <section style="max-width:900px;margin:24px auto;padding:16px;">
            <h2 style="margin:0 0 8px 0;">페이지를 불러오지 못했습니다</h2>
            <p style="color:#c00">${String(err)}</p>
            <p style="color:#666">잠시 후 다시 시도해 주세요.</p>
          </section>`;
      }
      return;
    }
    if (my !== navToken) return; // 취소

    if ($content) $content.innerHTML = html;

    // 3) include 하이드레이션(재귀) 완료까지 대기
    if ($content) {
      await hydrateIncludes($content, my);
      if (my !== navToken) return;
    }

    // 4) 페이지별 자원 보장 (CSS/JS)
    if (key === 'calculator') {
      await ensureCSS(CALC_CSS);
    }
    await ensureScript(PAGE_SCRIPTS[key]);
    if (DETAIL_KEYS.has(key)) await ensureScript(DETAIL_SCRIPT);

    // 5) i18n 적용 (DOM이 모두 들어온 뒤)
    if (window.I18N) {
      try { I18N.applyTo($content); } catch (_) {}
    }

    // 6) 페이지 초기화 — 계산기는 반드시 "await"로 완료를 보장
    try {
      if (key === 'calculator' && typeof window.initCalculator === 'function') {
        await window.initCalculator(); // ★ 레이스 근본 제거 (rAF 쓰지 않음)
      } else {
        runPageInit(key); // 비계산기는 동기/비중요 초기화
      }
    } catch (e) {
      console.warn('[page init] fail:', e);
    }
    if (my !== navToken) return;

    // 7) 타이틀
    document.title = PAGE_TITLES[key] || 'KingshotData.KR';
    if (key === 'calculator' && window.I18N?.t) {
      try { document.title = I18N.t('calc.meta.title', document.title); } catch(_) {}
    }
  }

  // =========================
  // 해시 라우팅
  // =========================
  function handleHashChange() {
    const raw = (location.hash || '').slice(1);

    if (raw.startsWith('building/')) {
      const slug = raw.replace('building/', '');
      loadPage(slug);
      return;
    }
    loadPage(raw || 'buildings');
  }

  window.addEventListener('hashchange', handleHashChange);
  window.addEventListener('DOMContentLoaded', handleHashChange);

  // (선택) 언어 변경 시 현재 페이지에 즉시 반영
  if (window.I18N?.on) {
    I18N.on('languageChanged', () => {
      if ($content && window.I18N?.applyTo) {
        try { I18N.applyTo($content); } catch(_) {}
      }
      // 계산기 화면이면 라벨/placeholder 재적용
      if ((location.hash||'').includes('calculator')) {
        window.reapplyCalculatorI18N?.();
      }
    });
  }
})();

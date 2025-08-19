// js/index.js (final)
(function () {
  'use strict';

  // --------------------
  // 라우트 정의: 해시값(#...) → HTML 경로
  // --------------------
  const routes = {
    // 상단 탭/메뉴
    buildings: 'pages/buildings.html',
    database:  'pages/database.html',
    calculator:'pages/calculator.html',
    policy:    'pages/policy.html',
    about:     'pages/about.html',
    heroes:    'pages/heroes.html',

    // 건물 상세 (개별 페이지)
    towncenter:           'pages/buildings/towncenter.html',
    'truegold-crucible':  'pages/buildings/truegold-crucible.html',
    academy:              'pages/buildings/academy.html',
    embassy:              'pages/buildings/embassy.html',
    barracks:             'pages/buildings/barracks.html',
    range:                'pages/buildings/range.html',
    stable:               'pages/buildings/stable.html',
    'command-center':     'pages/buildings/command-center.html',
    kitchen:              'pages/buildings/kitchen.html',
    storehouse:           'pages/buildings/storehouse.html',
    'guard-station':      'pages/buildings/guard-station.html'
  };

  // --------------------
  // 페이지 타이틀
  // --------------------
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

  // --------------------
  // 페이지별 필요 스크립트 (지연 로딩)
  // --------------------
  const PAGE_SCRIPTS = {
    buildings:  'js/pages/buildings.js',
    database:   'js/pages/database.js',
    calculator: 'js/pages/calculator.js',
    heroes:     'js/pages/heroes-spa.js'
  };

  // 상세 페이지들도 공통으로 buildings.js의 initBuilding을 쓰는 경우가 많음
  const DETAIL_KEYS = new Set([
    'towncenter','truegold-crucible','academy','embassy','barracks','range','stable',
    'command-center','kitchen','storehouse','guard-station'
  ]);
  const DETAIL_SCRIPT = 'js/pages/buildings.js';

  const _loadedScripts = new Set();
  function ensureScript(url) {
    return new Promise((resolve, reject) => {
      if (!url) return resolve();
      if (_loadedScripts.has(url)) return resolve();
      const s = document.createElement('script');
      s.src = url;
      s.defer = true;
      s.onload = () => { _loadedScripts.add(url); resolve(); };
      s.onerror = () => reject(new Error('script load fail: ' + url));
      document.head.appendChild(s);
    });
  }
  async function ensurePageScripts(key) {
    // 상단 탭용 스크립트
    if (PAGE_SCRIPTS[key]) await ensureScript(PAGE_SCRIPTS[key]);
    // 상세 페이지면 상세 스크립트도 보장
    if (DETAIL_KEYS.has(key)) await ensureScript(DETAIL_SCRIPT);
  }

  // 현재 진행 중인 fetch 취소용 컨트롤러 (중복 클릭 대비)
  let pendingController = null;

  // --------------------
  // 페이지별 초기화 디스패처
  // --------------------
  function runPageInit(key) {
    // 상단 카테고리 페이지들
    if (key === 'buildings' && typeof window.initBuildings === 'function') {
      requestAnimationFrame(() => window.initBuildings());
      return;
    }
    if (key === 'database' && typeof window.initDatabase === 'function') {
      requestAnimationFrame(() => window.initDatabase());
      return;
    }
    if (key === 'calculator' && typeof window.initCalculator === 'function') {
      requestAnimationFrame(() => window.initCalculator());
      return;
    }
    if (key === 'heroes' && typeof window.initHeroesList === 'function') {
      requestAnimationFrame(() => window.initHeroesList());
      return;
    }
    // 건물 상세 페이지 공통 훅
    if (typeof window.initBuilding === 'function') {
      requestAnimationFrame(() => window.initBuilding(key));
    }
  }

  // --------------------
  // 페이지 로더
  // --------------------
  async function loadPage(page) {
    const key  = routes[page] ? page : 'buildings';
    const path = routes[key];
    const main = document.getElementById('content');

    // 이전 요청 취소
    if (pendingController) pendingController.abort();
    pendingController = new AbortController();

    try {
      window.scrollTo(0, 0);

      const res = await fetch(path, { cache: 'no-store', signal: pendingController.signal });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);

      const html = await res.text();
      if (main) main.innerHTML = html;

      // 페이지 스크립트 보장 후 초기화 호출
      await ensurePageScripts(key);
      runPageInit(key);

    } catch (err) {
      console.error('[loadPage] error:', err);
      if (main) {
        main.innerHTML = `
          <section style="max-width:900px;margin:24px auto;padding:16px;">
            <h2 style="margin:0 0 8px 0;">페이지를 불러오지 못했습니다</h2>
            <p style="color:#c00">${String(err)}</p>
            <p style="color:#666">잠시 후 다시 시도해 주세요.</p>
          </section>
        `;
      }
    }

    // 문서 타이틀 갱신
    document.title = PAGE_TITLES[key] || 'KingshotData.KR';
  }

  // --------------------
  // 해시 라우팅
  // --------------------
  function handleHashChange() {
    const hash = (location.hash || '').slice(1);

    // 상세: "#building/{slug}"
    if (hash.startsWith('building/')) {
      const slug = hash.replace('building/', '');
      loadPage(slug);
      return;
    }

    // 일반 페이지 (기본: buildings)
    loadPage(hash || 'buildings');
  }

  window.addEventListener('hashchange', handleHashChange);
  window.addEventListener('DOMContentLoaded', handleHashChange);
})();

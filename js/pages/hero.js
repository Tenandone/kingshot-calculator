// /js/pages/hero.js — i18n 대응 (JSON 로드 + 이미지 중앙 + 소제목/구분선 + Talent 분기 + 번역 치환) ✅ FINAL
// ✅ FIX 포함:
// - 번역이 없을 때 "키 문자열"이 그대로 출력되는 현상 방지 (r !== key 체크)
// - keyOrText trim 처리 (키 뒤 공백/개행으로 인한 누락 방지)
// - ensureHeroesI18N: 현재 lang 유지
(function () {
  'use strict';
  // TW uses the current display model also when entered from the shared SPA shell.
  async function mountTwHeroDisplay() {
    if (!/^\/zh-tw\/(?:heroes|hero\/[^/]+)\/?$/.test(location.pathname)) return false;
    const pathname = location.pathname;
    if (!window.KD_TW_HERO_ENTRY) {
      window.KD_TW_HERO_ENTRY = (async function () {
        if (!document.querySelector('link[href^="/css/ui-heroes.css"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = '/css/ui-heroes.css?v=ks-ui16-tw-20261012';
          document.head.appendChild(link);
        }
        for (const [name, globalName] of [['hero-view', 'KD_HERO_VIEW'], ['hero-client', 'KD_UI_HEROES']]) {
          if (window[globalName]) continue;
          await new Promise(function (resolve, reject) {
            const script = document.createElement('script');
            script.src = '/js/ui/' + name + '.js?v=ks-ui16-tw-20261012';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
      })().catch(function (error) { window.KD_TW_HERO_ENTRY = null; throw error; });
    }
    await window.KD_TW_HERO_ENTRY;
    if (location.pathname === pathname) await window.KD_UI_HEROES.enhance(document, 'zh-tw');
    return true;
  }


  const esc = (s) => String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const byId = (id) => document.getElementById(id);

  const hasI18N = () => (window.I18N && typeof window.I18N.t === 'function');

  // ✅ 번역 안전 함수:
  // - keyOrText 가 i18n 키라면: 번역이 "실제로 존재할 때만" 사용 (키 그대로 반환이면 실패로 간주)
  // - 키 뒤 공백/개행 방지 위해 trim
  const T = (keyOrText, fallback) => {
    if (!keyOrText) return fallback ?? '';
    const key = String(keyOrText).trim();
    if (!key) return fallback ?? '';

    if (hasI18N()) {
      const r = window.I18N.t(key, undefined);

      // 🔥 핵심: 번역 미존재 시 라이브러리가 key를 그대로 돌려주는 케이스 방지
      if (r !== undefined && String(r) !== key) {
        return r;
      }
    }
    return fallback ?? key;
  };

  // ✅ lang을 ko로 강제하지 말고, 현재 설정을 사용
  async function ensureHeroesI18N() {
    if (!window.I18N) throw new Error('I18N not found');

    const curLang =
      (document.documentElement && document.documentElement.getAttribute('lang')) ||
      window.I18N.current ||
      'en';

    if (!window.I18N.current && typeof window.I18N.init === 'function') {
      await window.I18N.init({ lang: curLang });
    }

    if (typeof window.I18N.loadNamespace === 'function') {
      await window.I18N.loadNamespace('common');
      await window.I18N.loadNamespace('heroes');
    }
  }

  const norm = (s) => String(s || '').trim().toLowerCase();
  function findHeroBySlug(list, slug) {
    const t = norm(slug);
    return list.find(h =>
      norm(h.slug || '') === t ||
      norm(h.name || '') === t ||
      norm(h.nameEn || '') === t
    );
  }

  function normalizeUpgrade(u) {
    if (!u) return [];
    const raw = Array.isArray(u) ? u.map(String).join(' | ') : String(T(u));
    return raw
      .split(/\n|\s*\|\s*/).map(x => x.trim()).filter(Boolean);
  }

  function centeredImg(src, w) {
    const width = Number(w) || 0;
    const wAttr = width > 0 ? ` width="${width}"` : '';
    return `<img src="${esc(src)}"${wAttr} alt="" style="display:block;margin:0 auto;height:auto;max-width:100%;">`;
  }

  function renderStats(stats) {
    if (!stats) return '';
    if (Array.isArray(stats)) {
      return stats.map(s => `<div>${esc(T(s.label || ''))}: ${esc(String(s.value || ''))}</div>`).join('');
    }
    if (typeof stats === 'object') {
      return Object.entries(stats).map(([k, v]) => `<div>${esc(T(k))}: ${esc(String(v))}</div>`).join('');
    }
    return '';
  }

  function renderSkill(s) {
    if (!s) return '';
    let out = '<div style="margin:12px 0;">';

    if (s.icon) out += `<div>${centeredImg(s.icon, 64)}</div>`;
    if (s.name) out += `<div><b>${esc(T(s.name))}</b></div>`;

    if (s.desc) {
      const descHtml = esc(T(s.desc)).replace(/\n/g, '<br>');
      out += `<div>${descHtml}</div>`;
    }

    const upLines = normalizeUpgrade(s.upgrade);
    if (upLines.length) {
      out += `<div style="margin-top:6px;"><strong>${esc(T('heroes.common.upgrade','업그레이드'))}</strong></div>`;
      out += `<div style="font-size:90%;line-height:1.5;white-space:pre-wrap;">${upLines.map(line => esc(line)).join('<br>')}</div>`;
    }

    out += '</div>';
    return out;
  }

  const hr = () => '<hr style="margin:12px 0;">';

  function renderAll(hero) {
    let out = '';

    if (hero.conquest) {
      out += `<h2><strong>${esc(T('heroes.section.conquest','토벌'))}</strong></h2>${hr()}`;
      if (hero.conquest.stats) out += renderStats(hero.conquest.stats);
      if (Array.isArray(hero.conquest.skills)) out += hero.conquest.skills.map(renderSkill).join('');
      out += hr();
    }

    if (hero.expedition) {
      out += `<h2><strong>${esc(T('heroes.section.expedition','원정'))}</strong></h2>${hr()}`;
      if (hero.expedition.stats) out += renderStats(hero.expedition.stats);
      if (Array.isArray(hero.expedition.skills)) out += hero.expedition.skills.map(renderSkill).join('');
      out += hr();
    }

    if (hero.exclusiveGear) {
      out += `<h2><strong>${esc(T('heroes.section.exclusive','전용무기'))}</strong></h2>${hr()}`;
      if (hero.exclusiveGear.icon) out += `<div>${centeredImg(hero.exclusiveGear.icon, 72)}</div>`;
      if (hero.exclusiveGear.stats) out += renderStats(hero.exclusiveGear.stats);
      if (Array.isArray(hero.exclusiveGear.skills)) out += hero.exclusiveGear.skills.map(renderSkill).join('');
      out += hr();
    }

    return out;
  }

  function renderPage(hero) {
    const parts = [];

    const displayTitle = hero.title ? T(hero.title) : (hero.nameKo || hero.name || hero.nameEn || '영웅');
    const displaySub   = hero.subtitle ? T(hero.subtitle) : '';

    parts.push(`<h1>${esc(displayTitle)}</h1>`);
    if (displaySub) parts.push(`<div style="margin-top:4px;color:#666;">${esc(displaySub)}</div>`);
    if (hero.image) parts.push(`<div style="margin-top:10px;">${centeredImg(hero.image, 200)}</div>`);

    if (hero.summary) {
      parts.push(
        `<h2><strong>${esc(T('heroes.section.summary','영웅 소개'))}</strong></h2>${hr()}` +
        `<div>${esc(T(hero.summary))}</div>${hr()}`
      );
    }

    if (Array.isArray(hero.sources) && hero.sources.length) {
      parts.push(
        `<h2><strong>${esc(T('heroes.section.sources','획득처'))}</strong></h2>${hr()}` +
        `<div>${hero.sources.map(s => esc(T(s))).join('<br>')}</div>${hr()}`
      );
    }

    // ✅ Talent 분기
    if (hero.talent) {
      parts.push(
        `<h2><strong>${esc(T('heroes.section.talent','Talent'))}</strong></h2>${hr()}` +
        renderSkill({
          icon: hero.talent.icon,
          name: hero.talent.name ? hero.talent.name : '',
          desc: hero.talent.desc,
          upgrade: hero.talent.upgrade
        }) + hr()
      );
    }

    parts.push(renderAll(hero));
    return `<div style="text-align:center;max-width:800px;margin:0 auto;">${parts.join('')}</div>`;
  }

  function hardCenterFix(root) {
    root.querySelectorAll('img').forEach(img => {
      img.removeAttribute('align');
      const st = img.style;
      if (st) {
        if (st.float === 'left' || st.float === 'right') st.float = 'none';
        st.display = 'block';
        st.marginLeft = 'auto';
        st.marginRight = 'auto';
      }
    });

    root.querySelectorAll('.skills, .skill-list, .skill-row').forEach(w => {
      w.style.display = 'grid';
      w.style.placeItems = 'center';
    });
  }

  // ===== 데이터 캐시 & 상태 =====
  let HEROES_CACHE = null;
  let CURRENT_SLUG = '';
  let CURRENT_HERO = null;

  // ===== 엔트리 =====
  globalThis.initHero = async function (slug) {
    if (/^\/zh-tw\/hero\//.test(location.pathname)) { CURRENT_HERO = null; CURRENT_SLUG = ''; window.__HERO_BOOTED__ = true; }
    if (await mountTwHeroDisplay()) return;
    // 중복 실행 방지 (히스토리 라우터 + 폴백 가드)
    window.__HERO_BOOTED__ = true;

    const root = byId('hero-root');
    if (!root) return;

    root.style.display = 'flex';
    root.style.justifyContent = 'center';
    root.style.alignItems = 'flex-start';
    root.style.textAlign = 'center';

    CURRENT_SLUG = slug;
    root.innerHTML = 'Loading...';

    try {
      await ensureHeroesI18N();

      if (!HEROES_CACHE) {
        const res = await fetch('/data/heroes.json', { cache: 'no-store' });
        const data = await res.json();
        HEROES_CACHE = Array.isArray(data) ? data : (data.heroes || []);
      }

      const hero = findHeroBySlug(HEROES_CACHE, slug);
      CURRENT_HERO = hero;

      if (!hero) {
        root.innerHTML = esc(T('heroes.detail.notFound', '영웅 없음'));
        return;
      }

      root.innerHTML = renderPage(hero);

      // applyTo는 data-i18n 속성 기반 치환이 있을 때만 의미 있지만, 기존 호환 위해 유지
      if (hasI18N() && typeof window.I18N.applyTo === 'function') window.I18N.applyTo(root);

      hardCenterFix(root);
    } catch (e) {
      console.error(e);
      root.innerHTML = esc(T('heroes.detail.loadFail', '불러오기 실패'));
    }
  };

  // 언어 바뀌면 전체 재치환/재렌더
  document.addEventListener('i18n:changed', () => {
    const root = byId('hero-root');
    if (!root) return;

    if (CURRENT_HERO) {
      root.innerHTML = renderPage(CURRENT_HERO);
      if (hasI18N() && typeof window.I18N.applyTo === 'function') window.I18N.applyTo(root);
      hardCenterFix(root);
    } else if (CURRENT_SLUG) {
      globalThis.initHero(CURRENT_SLUG);
    }
  });

  // 🧰 폴백(선택): 히스토리 모드에서 라우터가 initHero를 못 불렀을 때만 가동
  document.addEventListener('DOMContentLoaded', () => {
    if (window.__HERO_BOOTED__) return;

    const m = location.pathname.match(/^\/hero\/([^/?#]+)$/);
    if (m) {
      const slug = decodeURIComponent(m[1]);
      if (slug) globalThis.initHero(slug);
    }
  });

  // (레거시 해시 진입은 이제 불필요하므로 제거)
})();

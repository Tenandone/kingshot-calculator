// /js/pages/hero.js — i18n 대응 (JSON 로드 + 이미지 중앙 + 소제목/구분선 + Talent 분기 + 번역 치환)
(function () {
  'use strict';

  const esc = (s) => String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const byId = (id) => document.getElementById(id);

  const hasI18N = () => (window.I18N && typeof I18N.t === 'function');
  const T = (keyOrText, fallback) => {
    if (!keyOrText) return fallback ?? '';
    if (hasI18N()) {
      const r = I18N.t(keyOrText, undefined);
      if (r !== undefined) return r;
    }
    return fallback ?? String(keyOrText);
  };

  async function ensureHeroesI18N() {
    if (!window.I18N) throw new Error('I18N not found');
    if (!I18N.current && typeof I18N.init === 'function') {
      await I18N.init({ lang: 'ko' });
    }
    if (typeof I18N.loadNamespace === 'function') {
      await I18N.loadNamespace('common');
      await I18N.loadNamespace('heroes');
    }
  }

  const norm = (s) => String(s||'').trim().toLowerCase();
  function findHeroBySlug(list, slug){
    const t = norm(slug);
    return list.find(h => norm(h.slug||'')===t || norm(h.name)===t || norm(h.nameEn||'')===t);
  }

  function normalizeUpgrade(u){
    if (!u) return [];
    const raw = Array.isArray(u) ? u.map(String).join(' | ') : String(T(u));
    return raw.split(/\n|\s*\|\s*/).map(x=>x.trim()).filter(Boolean);
  }

  function centeredImg(src, w){
    const width = Number(w)||0;
    const wAttr = width>0 ? ` width="${width}"` : '';
    return `<img src="${esc(src)}"${wAttr} alt="" style="display:block;margin:0 auto;height:auto;max-width:100%;">`;
  }

  function renderStats(stats){
    if (!stats) return '';
    if (Array.isArray(stats)){
      return stats.map(s=>`<div>${esc(T(s.label||''))}: ${esc(String(s.value||''))}</div>`).join('');
    }
    if (typeof stats==='object'){
      return Object.entries(stats).map(([k,v])=>`<div>${esc(T(k))}: ${esc(String(v))}</div>`).join('');
    }
    return '';
  }

  function renderSkill(s){
    if (!s) return '';
    let out = '<div style="margin:12px 0;">';
    if (s.icon) out += `<div>${centeredImg(s.icon, 64)}</div>`;
    if (s.name) out += `<div><b>${esc(T(s.name))}</b></div>`;
    if (s.desc) {
      const descHtml = esc(T(s.desc)).replace(/\n/g,'<br>');
      out += `<div>${descHtml}</div>`;
    }
    const upLines = normalizeUpgrade(s.upgrade);
    if (upLines.length){
      out += `<div style="margin-top:6px;"><strong>${esc(T('heroes.common.upgrade','업그레이드'))}</strong></div>`;
      out += `<div style="font-size:90%;line-height:1.5;white-space:pre-wrap;">${upLines.map(line=>esc(line)).join('<br>')}</div>`;
    }
    out += '</div>';
    return out;
  }

  const hr = () => '<hr style="margin:12px 0;">';

  function renderAll(hero){
    let out = '';

    if (hero.conquest){
      out += `<h2><strong>${esc(T('heroes.section.conquest','토벌'))}</strong></h2>${hr()}`;
      if (hero.conquest.stats) out += renderStats(hero.conquest.stats);
      if (Array.isArray(hero.conquest.skills)) out += hero.conquest.skills.map(renderSkill).join('');
      out += hr();
    }

    if (hero.expedition){
      out += `<h2><strong>${esc(T('heroes.section.expedition','원정'))}</strong></h2>${hr()}`;
      if (hero.expedition.stats) out += renderStats(hero.expedition.stats);
      if (Array.isArray(hero.expedition.skills)) out += hero.expedition.skills.map(renderSkill).join('');
      out += hr();
    }

    if (hero.exclusiveGear){
      out += `<h2><strong>${esc(T('heroes.section.exclusive','전용무기'))}</strong></h2>${hr()}`;
      if (hero.exclusiveGear.icon) out += `<div>${centeredImg(hero.exclusiveGear.icon, 72)}</div>`;
      if (hero.exclusiveGear.stats) out += renderStats(hero.exclusiveGear.stats);
      if (Array.isArray(hero.exclusiveGear.skills)) out += hero.exclusiveGear.skills.map(renderSkill).join('');
      out += hr();
    }

    return out;
  }

  function renderPage(hero){
    const parts = [];

    const displayTitle = hero.title ? T(hero.title) : (hero.nameKo||hero.name||hero.nameEn||'영웅');
    const displaySub = hero.subtitle ? T(hero.subtitle) : '';

    parts.push(`<h1>${esc(displayTitle)}</h1>`);
    if (displaySub) parts.push(`<div style="margin-top:4px;color:#666;">${esc(displaySub)}</div>`);
    if (hero.image) parts.push(`<div style="margin-top:10px;">${centeredImg(hero.image, 200)}</div>`);

    if (hero.summary){
      parts.push(
        `<h2><strong>${esc(T('heroes.section.summary','영웅 소개'))}</strong></h2>${hr()}` +
        `<div>${esc(T(hero.summary))}</div>${hr()}`
      );
    }

    if (Array.isArray(hero.sources) && hero.sources.length){
      parts.push(
        `<h2><strong>${esc(T('heroes.section.sources','획득처'))}</strong></h2>${hr()}` +
        `<div>${hero.sources.map(s => esc(T(s))).join('<br>')}</div>${hr()}`
      );
    }

    if (hero.talent){
      parts.push(
        `<h2><strong>${esc(T('heroes.section.talent','Talent'))}</strong></h2>${hr()}` +
        renderSkill({
          icon: hero.talent.icon,
          name: hero.talent.name ? T(hero.talent.name) : '',
          desc: T(hero.talent.desc),
          upgrade: T(hero.talent.upgrade)
        }) + hr()
      );
    }

    parts.push(renderAll(hero));
    return `<div style="text-align:center;max-width:800px;margin:0 auto;">${parts.join('')}</div>`;
  }

  function hardCenterFix(root){
    root.querySelectorAll('img').forEach(img=>{
      img.removeAttribute('align');
      const st = img.style;
      if (st) {
        if (st.float === 'left' || st.float === 'right') st.float = 'none';
        st.display = 'block';
        st.marginLeft = 'auto';
        st.marginRight = 'auto';
      }
    });
    root.querySelectorAll('.skills, .skill-list, .skill-row').forEach(w=>{
      w.style.display = 'grid';
      w.style.placeItems = 'center';
    });
  }

  // ===== 데이터 캐시 & 상태 =====
  let HEROES_CACHE = null;
  let CURRENT_SLUG = '';
  let CURRENT_HERO = null;

  // ===== 엔트리 =====
  globalThis.initHero = async function(slug){
    const root = byId('hero-root');
    if (!root) return;

    root.style.display = 'flex';
    root.style.justifyContent = 'center';
    root.style.alignItems = 'flex-start';
    root.style.textAlign = 'center';

    CURRENT_SLUG = slug;
    root.innerHTML = 'Loading...';

    try{
      await ensureHeroesI18N();

      if (!HEROES_CACHE) {
        const res = await fetch('/data/heroes.json',{cache:'no-store'});
        const data = await res.json();
        HEROES_CACHE = Array.isArray(data) ? data : (data.heroes || []);
      }

      const hero = findHeroBySlug(HEROES_CACHE, slug);
      CURRENT_HERO = hero;

      if (!hero){ root.innerHTML = T('heroes.detail.notFound','영웅 없음'); return; }

      root.innerHTML = renderPage(hero);
      if (hasI18N() && typeof I18N.applyTo === 'function') I18N.applyTo(root);
      hardCenterFix(root);
    }catch(e){
      console.error(e);
      root.innerHTML = T('heroes.detail.loadFail','불러오기 실패');
    }
  };

  // 언어 바뀌면 전체 재치환/재렌더
  document.addEventListener('i18n:changed', () => {
    const root = byId('hero-root');
    if (!root) return;
    if (CURRENT_HERO) {
      root.innerHTML = renderPage(CURRENT_HERO);
      if (hasI18N() && typeof I18N.applyTo === 'function') I18N.applyTo(root);
      hardCenterFix(root);
    } else if (CURRENT_SLUG) {
      globalThis.initHero(CURRENT_SLUG);
    }
  });

  // 해시 진입시 자동 실행(라우터 없이 직접 접근한 경우)
  if (location.hash.startsWith('#/hero/')){
    const slug = location.hash.split('/')[2]||'';
    if (slug) setTimeout(()=>globalThis.initHero(slug),0);
  }
})();

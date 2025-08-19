// /js/pages/hero.js — JSON 로드 + 이미지 중앙 배치 + 소제목/구분선 정리 + Talent 분기 (final)
(function () {
  'use strict';

  const esc = (s) => String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const byId = (id) => document.getElementById(id);

  // ===== utils =====
  const norm = (s) => String(s||'').trim().toLowerCase();
  function findHeroBySlug(list, slug){
    const t = norm(slug);
    return list.find(h => norm(h.slug||'')===t || norm(h.name)===t || norm(h.nameEn||'')===t);
  }

  function renderStats(stats){
    if (!stats) return '';
    if (Array.isArray(stats)){
      return stats.map(s=>`<div>${esc(s.label||'')}: ${esc(s.value||'')}</div>`).join('');
    }
    if (typeof stats==='object'){
      return Object.entries(stats).map(([k,v])=>`<div>${esc(k)}: ${esc(v)}</div>`).join('');
    }
    return '';
  }

  function normalizeUpgrade(u){
    if (!u) return [];
    if (Array.isArray(u)) return u.map(String);
    return String(u).split(/\n|\s*\|\s*/).map(x=>x.trim()).filter(Boolean);
  }

  // 공통: 가운데 정렬되는 이미지 태그 생성
  function centeredImg(src, w){
    const width = Number(w)||0;
    const wAttr = width>0 ? ` width="${width}"` : '';
    return `<img src="${esc(src)}"${wAttr} alt="" style="display:block;margin:0 auto;height:auto;max-width:100%;">`;
  }

  // 스킬/탈렌트 공통 출력기
  function renderSkill(s){
    if (!s) return '';
    let out = '<div style="margin:12px 0;">';
    if (s.icon) out += `<div>${centeredImg(s.icon, 64)}</div>`;
    if (s.name) out += `<div><b>${esc(s.name)}</b></div>`;
    if (s.desc) {
      const descHtml = esc(s.desc).replace(/\n/g,'<br>');
      out += `<div>${descHtml}</div>`;
    }
    const upLines = normalizeUpgrade(s.upgrade);
    if (upLines.length){
      out += `<div style="margin-top:6px;"><strong>업그레이드</strong></div>`;
      out += `<div style="font-size:90%;line-height:1.5;white-space:pre-wrap;">${
        upLines.map(line=>esc(line)).join('<br>')
      }</div>`;
    }
    out += '</div>';
    return out;
  }

  const hr = () => '<hr style="margin:12px 0;">';

  function renderAll(hero){
    let out = '';

    // 토벌
    if (hero.conquest){
      out += `<h2><strong>토벌</strong></h2>${hr()}`;
      if (hero.conquest.stats) out += renderStats(hero.conquest.stats);
      if (Array.isArray(hero.conquest.skills)) out += hero.conquest.skills.map(renderSkill).join('');
      out += hr();
    }

    // 원정
    if (hero.expedition){
      out += `<h2><strong>원정</strong></h2>${hr()}`;
      if (hero.expedition.stats) out += renderStats(hero.expedition.stats);
      if (Array.isArray(hero.expedition.skills)) out += hero.expedition.skills.map(renderSkill).join('');
      out += hr();
    }

    // 전용무기
    if (hero.exclusiveGear){
      out += `<h2><strong>전용무기</strong></h2>${hr()}`;
      if (hero.exclusiveGear.icon) out += `<div>${centeredImg(hero.exclusiveGear.icon, 72)}</div>`;
      if (hero.exclusiveGear.stats) out += renderStats(hero.exclusiveGear.stats);
      if (Array.isArray(hero.exclusiveGear.skills)) out += hero.exclusiveGear.skills.map(renderSkill).join('');
      out += hr();
    }

    return out;
  }

  function renderPage(hero){
    const parts = [];
    parts.push(`<h1>${esc(hero.nameKo||hero.name||hero.nameEn||'영웅')}</h1>`);
    if (hero.image) parts.push(`<div>${centeredImg(hero.image, 200)}</div>`);

    if (hero.summary){
      parts.push(`<h2><strong>영웅 소개</strong></h2>${hr()}<div>${esc(hero.summary)}</div>${hr()}`);
    }

    if (Array.isArray(hero.sources) && hero.sources.length){
      parts.push(`<h2><strong>획득처</strong></h2>${hr()}<div>${hero.sources.map(esc).join('<br>')}</div>${hr()}`);
    }

    // ✅ Talent(재능) — 아마데우스/헬가처럼 talent가 있을 때만 표시
    if (hero.talent){
      parts.push(
        `<h2><strong>Talent</strong></h2>${hr()}` +
        renderSkill({
          icon: hero.talent.icon,
          name: hero.talent.name,
          desc: hero.talent.desc,
          upgrade: hero.talent.upgrade
        }) + hr()
      );
    }

    parts.push(renderAll(hero));

    // 중앙 래퍼
    return `<div style="text-align:center;max-width:800px;margin:0 auto;">${parts.join('')}</div>`;
  }

  // 렌더 후 혹시 남은 float/align 정리(방어코드)
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

  // ===== 엔트리 =====
  globalThis.initHero = async function(slug){
    const root = byId('hero-root');
    if (!root) return;

    // 가운데 레이아웃
    root.style.display = 'flex';
    root.style.justifyContent = 'center';
    root.style.alignItems = 'flex-start';
    root.style.textAlign = 'center';

    root.innerHTML = 'Loading...';
    try{
      const res = await fetch('/data/heroes.json',{cache:'no-store'});
      const data = await res.json();
      const arr = Array.isArray(data)?data:(data.heroes||[]);
      const hero = findHeroBySlug(arr, slug);
      if (!hero){ root.innerHTML = '영웅 없음'; return; }
      root.innerHTML = renderPage(hero);
      hardCenterFix(root);
    }catch(e){
      console.error(e);
      root.innerHTML = '불러오기 실패';
    }
  };

  // 해시 진입시 자동 실행
  if (location.hash.startsWith('#/hero/')){
    const slug = location.hash.split('/')[2]||'';
    if (slug) setTimeout(()=>globalThis.initHero(slug),0);
  }
})();

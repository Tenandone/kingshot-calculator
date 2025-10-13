// ===== Language auto-detect & alias map (ja / zh-CN / zh-TW support) =====
(function () {
  function detectLangAlias() {
    const qs = new URLSearchParams(location.search);
    let lang =
      (qs.get('lang') ||
        document.documentElement.getAttribute('lang') ||
        (navigator.language || navigator.userLanguage) ||
        'en')
        .toLowerCase()
        .replace('_', '-');

    // Normalize zh variants -> cn/tw buckets used by /locales/{lang}
    if (lang === 'cn' || lang === 'zh' || lang.startsWith('zh-cn') || lang.includes('hans')) return 'cn';
    if (lang === 'tw' || lang.startsWith('zh-tw') || lang.includes('hk') || lang.includes('mo') || lang.includes('hant')) return 'tw';
    if (lang.startsWith('ja')) return 'ja';
    if (lang.startsWith('ko')) return 'ko';
    if (lang.startsWith('en')) return 'en';
    // Accept direct short codes if present in your folders
    if (['en', 'ko', 'ja', 'cn', 'tw'].includes(lang)) return lang;
    // Fallback
    return 'en';
  }

  const __LANG__ = detectLangAlias();
  // Keep <html lang> in a standards-friendly code for accessibility/SEO
  document.documentElement.lang = (__LANG__ === 'cn') ? 'zh-CN' : (__LANG__ === 'tw') ? 'zh-TW' : __LANG__;

  // ===== I18N bootstrap =====================================================
  window.I18N.init({
    lang: __LANG__,                   // <- auto-detected (ko/en/ja/cn/tw)
    namespaces: ['waracademy'],       // 사용할 JSON 네임스페이스
    path: '/locales/{lang}/{ns}.json' // 실제 JSON 경로
  }).then(() => {
    // If your I18N lib exposes setLang(), ensure runtime state matches
    if (typeof window.I18N.setLang === 'function') {
      window.I18N.setLang(__LANG__);
    }
    console.log('I18N ready ✅', __LANG__);
    window.I18N.applyTo(document.body); // 모든 data-i18n 적용
    window.initWarAcademy?.();          // 페이지 로직 실행
  });
})();


window.initWarAcademy = function () {
  'use strict';

  // ---- i18n helpers --------------------------------------------------------
  const I18N = window.I18N || {};
  const t = (k, f) => (I18N.t ? I18N.t(k, f) : (f ?? k));
  const nfmt = (n) => {
    const v = Number(n ?? 0);
    if (Number.isNaN(v)) return '0';
    try {
      if (typeof I18N.nfmt === 'function') return I18N.nfmt(v);
    } catch (_) {}
    return v.toLocaleString();
  };

  // Fallback chain translator (try multiple keys, then fallback text)
  const __SENTINEL__ = `__MISSING__${Math.random().toString(36).slice(2)}`;
  function tryT(key) {
    const v = t(key, __SENTINEL__);
    return v === __SENTINEL__ ? null : v;
  }
  function tt(primaryKey, fallback, ...altKeys) {
    const keys = [primaryKey, ...altKeys];
    for (const k of keys) {
      const v = tryT(k);
      if (v != null && v !== k) return v;
    }
    return fallback;
  }

  // ---- K/M/B suffixes (localizable) ----------------------------------------
  const SUFFIX = {
    k: t('waracademy.units.k', 'K'),
    m: t('waracademy.units.m', 'M'),
    b: t('waracademy.units.b', 'B')
  };

  /** Number formatter for resources (Bread/Wood/Stone/Iron) */
  function formatKMB(n) {
    const v = Number(n ?? 0);
    const abs = Math.abs(v);
    const trim = (s) => s.replace(/\.?0+$/, '');
    if (abs >= 1e9) return trim((v / 1e9).toFixed(2)) + SUFFIX.b;
    if (abs >= 1e6) return trim((v / 1e6).toFixed(2)) + SUFFIX.m;
    if (abs >= 1e3) return trim((v / 1e3).toFixed(2)) + SUFFIX.k;
    return nfmt(v);
  }

  /** Create a key-friendly id from an English title */
  function toKeyId(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  /** Look up localized research title for a research record r */
  function trResearchTitle(r) {
    const title = r?.title ?? '';
    // Prefer slugged key, then raw-title key, then title itself
    const k1 = `waracademy.research.${toKeyId(title)}.title`;
    const k2 = `waracademy.research.${title}.title`;
    return t(k1, t(k2, title));
  }

  /** Look up localized research description for a research record r */
  function trResearchDesc(r) {
    const title = r?.title ?? '';
    const fallback = r?.description ?? '';
    const k1 = `waracademy.research.${toKeyId(title)}.desc`;
    const k2 = `waracademy.research.${title}.desc`;
    return t(k1, t(k2, fallback));
  }

  /** Time helpers ---------------------------------------------------------- */
  function parseTimeToSeconds(str) {
    if (!str) return 0;
    const s = String(str);
    const dMatch = s.match(/(\d+)\s*d/i);
    const days = dMatch ? parseInt(dMatch[1], 10) : 0;
    const tMatch = s.match(/(\d{1,3}):(\d{2}):(\d{2})/);
    let h = 0, m = 0, sec = 0;
    if (tMatch) {
      h = parseInt(tMatch[1], 10);
      m = parseInt(tMatch[2], 10);
      sec = parseInt(tMatch[3], 10);
    }
    return days * 86400 + h * 3600 + m * 60 + sec;
  }

  function secondsToRaw(secs) {
    secs = Math.max(0, Math.floor(Number(secs) || 0));
    const days = Math.floor(secs / 86400);
    secs -= days * 86400;
    const h = Math.floor(secs / 3600);
    secs -= h * 3600;
    const m = Math.floor(secs / 60);
    const s = secs - m * 60;
    const pad = (n) => String(n).padStart(2, '0');
    return days > 0 ? `${days}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  /** Time string localizer: "Xd HH:MM:SS" -> localized units (hides 0m/0s) */
  function localizeTime(str) {
    if (!str) return t('waracademy.table.none', '-');
    const s = String(str);

    // Extract days ("<num>d")
    const dMatch = s.match(/(\d+)\s*d/i);
    const days = dMatch ? parseInt(dMatch[1], 10) : 0;

    // Extract hh:mm:ss (h 1~3 digits)
    const tMatch = s.match(/(\d{1,3}):(\d{2}):(\d{2})/);
    let h = 0, m = 0, sec = 0;
    if (tMatch) {
      h = parseInt(tMatch[1], 10);
      m = parseInt(tMatch[2], 10);
      sec = parseInt(tMatch[3], 10);
    }

    const parts = [];
    if (days > 0) parts.push(`${days}${t('waracademy.units.day', 'd')}`);
    if (h > 0)    parts.push(`${h}${t('waracademy.units.hour', 'h')}`);
    if (m > 0)    parts.push(`${m}${t('waracademy.units.minute', 'm')}`);
    if (sec > 0)  parts.push(`${sec}${t('waracademy.units.second', 's')}`);

    return parts.length ? parts.join(' ') : t('waracademy.table.none', '-');
  }

  /**
   * Token-localize requirement/bonus free text found in the JSON.
   * Avoid hardcoded language; let i18n files drive all locales (ko/en/ja/cn/tw).
   * Includes robust fallbacks so ja/cn/tw still translate even if keys differ.
   */
  function localizeTokens(str) {
    if (str == null || str === '') return t('waracademy.table.none', '-');
    let out = String(str);

    /** Replacement pairs (longer first to avoid partial overlaps) */
    const pairs = [
      // --- Bonus phrases (ensure these BEFORE shorter tokens) ---------------
      ['Rally Squad Capacity', tt(
        'waracademy.tokens.rally_squad_capacity', 'Rally Squad Capacity',
        'waracademy.bonuses.rally_squad_capacity',
        'waracademy.labels.rally_squad_capacity',
        'waracademy.tokens.rally_capacity' // last resort
      )],
      ['Squad Deployment Capacity', tt(
        'waracademy.tokens.squad_deployment_capacity', 'Squad Deployment Capacity',
        'waracademy.bonuses.squad_deployment_capacity',
        'waracademy.labels.squad_deployment_capacity',
        'waracademy.table.squad_deployment_capacity',
        'waracademy.tokens.squad_capacity',
        'waracademy.bonuses.squad_capacity'
      )],
      ["Squads' Deployment Capacity", tt(
        'waracademy.tokens.squad_deployment_capacity', "Squads' Deployment Capacity",
        'waracademy.bonuses.squad_deployment_capacity',
        'waracademy.labels.squad_deployment_capacity',
        'waracademy.table.squad_deployment_capacity',
        'waracademy.tokens.squad_capacity',
        'waracademy.bonuses.squad_capacity'
      )],
      ['Squads’ Deployment Capacity', tt(
        'waracademy.tokens.squad_deployment_capacity', 'Squads’ Deployment Capacity',
        'waracademy.bonuses.squad_deployment_capacity',
        'waracademy.labels.squad_deployment_capacity',
        'waracademy.table.squad_deployment_capacity',
        'waracademy.tokens.squad_capacity',
        'waracademy.bonuses.squad_capacity'
      )],
      ['Rally Capacity', tt(
        'waracademy.tokens.rally_capacity', 'Rally Capacity',
        'waracademy.bonuses.rally_capacity',
        'waracademy.labels.rally_capacity'
      )],
      ['Squad Capacity', tt(
        'waracademy.tokens.squad_capacity', 'Squad Capacity',
        'waracademy.bonuses.squad_capacity',
        'waracademy.labels.squad_capacity'
      )],

      // --- Buildings / general tokens ---------------------------------------
      ['War Academy', t('waracademy.labels.waracademy', 'War Academy')],
      ['Town Center', t('waracademy.labels.towncenter', 'Town Center')],
      ['Training Time Down', t('waracademy.tokens.training_time_down', 'Training Time Down')],
      ['Training Speed Up', t('waracademy.tokens.training_speed_up', 'Training Speed Up')],
      ['Training Cost Down', t('waracademy.tokens.training_cost_down', 'Training Cost Down')],
      ['Healing Time Down', t('waracademy.tokens.healing_time_down', 'Healing Time Down')],
      ['Healing Cost Down', t('waracademy.tokens.healing_cost_down', 'Healing Cost Down')],
      ['Healing Cost Reduction', t('waracademy.tokens.healing_cost_reduction', 'Healing Cost Reduction')],
      ['Resource Cost Down', t('waracademy.tokens.resource_cost_down', 'Resource Cost Down')],
      ['Construction Time Down', t('waracademy.tokens.construction_time_down', 'Construction Time Down')],
      ['Upgrade Time Down', t('waracademy.tokens.upgrade_time_down', 'Upgrade Time Down')],
      ['Research Time Down', t('waracademy.tokens.research_time_down', 'Research Time Down')],
      ['Cost Reduction', t('waracademy.tokens.cost_reduction', 'Cost Reduction')],
      ['Time Down', t('waracademy.tokens.time_down', 'Time Down')],
      ['Cost Down', t('waracademy.tokens.cost_down', 'Cost Down')],
      ['Speed Up', t('waracademy.tokens.speed_up', 'Speed Up')],

      // --- Truegold research names (BEFORE generic "Gold") -------------------
      // INFANTRY
      ['Truegold Infantry Training', t('waracademy.research.truegold_infantry_training.title', 'Truegold Infantry Training')],
      ['Truegold Infantry Aid', t('waracademy.research.truegold_infantry_aid.title', 'Truegold Infantry Aid')],
      ['Truegold Infantry Healing', t('waracademy.research.truegold_infantry_healing.title', 'Truegold Infantry Healing')],
      ['Truegold Infantry', t('waracademy.infantry.title', 'Truegold Infantry')],

      // ARCHER
      ['Truegold Archer Training', t('waracademy.research.truegold_archer_training.title', 'Truegold Archer Training')],
      ['Truegold Archer Aid', t('waracademy.research.truegold_archer_aid.title', 'Truegold Archer Aid')],
      ['Truegold Archer Healing', t('waracademy.research.truegold_archer_healing.title', 'Truegold Archer Healing')],
      ['Truegold Archers', t('waracademy.archer.title', 'Truegold Archers')],
      ['Truegold Archer', t('waracademy.archer.title', 'Truegold Archer')],
      ['Truegold Vests', t('waracademy.research.truegold_vests.title', 'Truegold Vests')],
      ['Truegold Arrows', t('waracademy.research.truegold_arrows.title', 'Truegold Arrows')],
      ['Truegold Bracers', t('waracademy.research.truegold_bracers.title', 'Truegold Bracers')],
      ['Truegold Bows', t('waracademy.research.truegold_bows.title', 'Truegold Bows')],
      ['Truegold Legionaries (Archer)', t('waracademy.research.truegold_legionaries_archer.title', 'Truegold Legionaries (Archer)')],
      ['Truegold Battalion (Archer)', t('waracademy.research.truegold_battalion_archer.title', 'Truegold Battalion (Archer)')],

      // CAVALRY
      ['Truegold Cavalry Training', t('waracademy.research.truegold_cavalry_training.title', 'Truegold Cavalry Training')],
      ['Truegold Cavalry Aid', t('waracademy.research.truegold_cavalry_aid.title', 'Truegold Cavalry Aid')],
      ['Truegold Cavalry Healing', t('waracademy.research.truegold_cavalry_healing.title', 'Truegold Cavalry Healing')],
      ['Truegold Cavalry', t('waracademy.cavalry.title', 'Truegold Cavalry')],
      ['Truegold Platecraft', t('waracademy.research.truegold_platecraft.title', 'Truegold Platecraft')],
      ['Truegold Lances', t('waracademy.research.truegold_lances.title', 'Truegold Lances')],
      ['Truegold Charge', t('waracademy.research.truegold_charge.title', 'Truegold Charge')],
      ['Truegold Farriery', t('waracademy.research.truegold_farriery.title', 'Truegold Farriery')],
      ['Truegold Legionaries (Cavalry)', t('waracademy.research.truegold_legionaries_cavalry.title', 'Truegold Legionaries (Cavalry)')],
      ['Truegold Battalion (Cavalry)', t('waracademy.research.truegold_battalion_cavalry.title', 'Truegold Battalion (Cavalry)')],

      // SHARED
      ['Truegold Blades', t('waracademy.research.truegold_blades.title', 'Truegold Blades')],
      ['Truegold Shields', t('waracademy.research.truegold_shields.title', 'Truegold Shields')],
      ['Truegold Mauls', t('waracademy.research.truegold_mauls.title', 'Truegold Mauls')],
      ['Truegold Plating', t('waracademy.research.truegold_plating.title', 'Truegold Plating')],
      ['Truegold Legionaries', t('waracademy.research.truegold_legionaries.title', 'Truegold Legionaries')],
      ['Truegold Battalion', t('waracademy.research.truegold_battalion.title', 'Truegold Battalion')],

      // --- Attributes --------------------------------------------------------
      ['Attack', t('waracademy.attrs.attack', 'Attack')],
      ['Defense', t('waracademy.attrs.defense', 'Defense')],
      ['Health', t('waracademy.attrs.health', 'Health')],
      ['Lethality', t('waracademy.attrs.lethality', 'Lethality')],
      ['Power', t('waracademy.attrs.power', 'Power')],
      ['Bonus', t('waracademy.attrs.bonus', 'Bonus')],

      // --- Troop classes (generic) ------------------------------------------
      ['Archers', t('waracademy.labels.archers', 'Archers')],
      ['Archer', t('waracademy.labels.archer', 'Archer')],
      ['Infantry', t('waracademy.labels.infantry', 'Infantry')],
      ['Cavalry', t('waracademy.labels.cavalry', 'Cavalry')],

      // --- Resources (case sensitive & lower) -------------------------------
      ['Bread', t('waracademy.meta.bread', 'Bread')],
      ['Wood', t('waracademy.meta.wood', 'Wood')],
      ['Stone', t('waracademy.meta.stone', 'Stone')],
      ['Iron', t('waracademy.meta.iron', 'Iron')],
      ['Gold', t('waracademy.meta.gold', 'Gold')],
      ['Dust', t('waracademy.meta.dust', 'Dust')],
      ['bread', t('waracademy.meta.bread', 'Bread')],
      ['wood', t('waracademy.meta.wood', 'Wood')],
      ['stone', t('waracademy.meta.stone', 'Stone')],
      ['iron', t('waracademy.meta.iron', 'Iron')],
      ['gold', t('waracademy.meta.gold', 'Gold')],
      ['dust', t('waracademy.meta.dust', 'Dust')],

      // --- Level tokens ------------------------------------------------------
      ['Lv.', t('waracademy.table.level_short', 'Lv.')],
      ['Lv', t('waracademy.table.level_short', 'Lv.')],
      ['Level', t('waracademy.table.level', 'Level')]
    ].sort((a, b) => b[0].length - a[0].length);

    // Simple global replacements
    for (const [src, dst] of pairs) {
      const re = new RegExp(src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      out = out.replace(re, dst);
    }

    // Handle "Unlock <ROMAN> <Unit>" pattern (XI, XII, etc.)
    out = out.replace(/\bUnlock\s+([IVXLCDM]+)\s+/g, (m, roman) => {
      return `${t('waracademy.tokens.unlock', 'Unlock')} ${roman} `;
    });

    return out;
  }

  // ---- Renderers -----------------------------------------------------------

  /**
   * === 메타 정보 (연구 조건 + 자원 총합 + 보너스) ===
   * - JSON의 meta.title / meta.troop / troop_type 도 함께 노출
   * - i18n 키: waracademy.meta.*, waracademy.bonus.* (ko/en/ja/cn/tw)
   */
  function renderMeta(data, id) {
    const b = document.getElementById(id);
    if (!b || !data?.requirements) return;
    const r = data.requirements, bo = data.bonuses || {};

    const metaTitle = data.meta?.title
      ? t(`waracademy.meta.title.${toKeyId(data.meta.title)}`, data.meta.title) : '';
    const troopLabel = data.meta?.troop
      ? t(`waracademy.troop.${toKeyId(data.meta.troop)}`, data.meta.troop) : '';
    const troopType = data.troop_type ? localizeTokens(data.troop_type) : '';

    b.innerHTML = `
    <div class="tg-meta">
      ${ false
  ? `<div class="tg-meta-headline">
       ${metaTitle ? `<h3 class="tg-meta-h3">${metaTitle}</h3>` : ``}
       ${troopType ? `<p class="tg-meta-desc">${troopType}</p>` : ``}
       ${troopLabel ? `<p class="tg-meta-desc">${troopLabel}</p>` : ``}
     </div>` : `` }
      
      <ul>
        <li><b>${t('waracademy.meta.buildings','건물 요구사항')}:</b> ${t('waracademy.meta.towncenter','도시센터')} ${r.building?.towncenter ?? '-'}, ${t('waracademy.meta.waracademy','전쟁아카데미')} ${r.building?.waracademy ?? '-'}</li>
        <li><b>${t('waracademy.meta.total_time','총 연구 시간')}:</b> ${r.research_time_days ?? '-'} ${t('waracademy.units.day','일')}</li>
        <li><b>${t('waracademy.meta.dust','필요한 황금 가루 총량')}:</b> ${nfmt(r.dust)}</li>
        <li><b>${t('waracademy.meta.bread','총 빵 소비량')}:</b> ${formatKMB(r.bread)}</li>
        <li><b>${t('waracademy.meta.wood','총 나무 소비량')}:</b> ${formatKMB(r.wood)}</li>
        <li><b>${t('waracademy.meta.stone','총 석재 소비량')}:</b> ${formatKMB(r.stone)}</li>
        <li><b>${t('waracademy.meta.iron','총 철 소비량')}:</b> ${formatKMB(r.iron)}</li>
        <li><b>${t('waracademy.meta.gold','총 금화 소비량')}:</b> ${nfmt(r.gold)}</li>
      </ul>
      <h3>${t('waracademy.meta.bonus_title','보너스 효과')}</h3>
<ul>
  <li>${t('waracademy.bonuses.squad_capacity','부대 수용량')}: ${bo.squad_capacity ?? '-'}</li>
  <li>${t('waracademy.bonuses.health','체력')}: ${bo.health ?? '-'}</li>
  <li>${t('waracademy.bonuses.lethality','파괴력')}: ${bo.lethality ?? '-'}</li>
  <li>${t('waracademy.bonuses.attack','공격력')}: ${bo.attack ?? '-'}</li>
  <li>${t('waracademy.bonuses.defense','방어력')}: ${bo.defense ?? '-'}</li>
  <li>${t('waracademy.bonuses.rally_capacity','집결 수용량')}: ${bo.rally_capacity ?? '-'}</li>
</ul>

    </div>`;
  }

  /** Research cards grid */
  function renderResearchGrid(data, gridId, detailId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    grid.innerHTML = (data.researches || []).map((r, i) => `
      <div class="wa-card" data-index="${i}">
        <img src="${r.image}" alt="${trResearchTitle(r)}">
        <div class="wa-info">
          <h4>${trResearchTitle(r)}</h4>
          <p>${trResearchDesc(r)}</p>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.wa-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.index, 10);
        renderResearchDetail(data.researches[idx], detailId);

        // highlight selection
        grid.querySelectorAll('.wa-card').forEach(x => x.classList.remove('active'));
        card.classList.add('active');

        // smooth scroll to detail table (or container)
        setTimeout(() => {
          const container = document.getElementById(detailId);
          const table = container?.querySelector('table');
          (table || container)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      });
    });
  }

  /**
   * Research detail table
   * - Rows for each level
   * - Σ totals row **inside <tbody> at the bottom** (요청사항)
   */
  function renderResearchDetail(research, detailId) {
    const d = document.getElementById(detailId);
    if (!d) return;

    d.innerHTML = `
      <h2>${trResearchTitle(research)}</h2>
      <p>${trResearchDesc(research)}</p>
    `;

    if (research.levels?.length) {
      // Totals accumulators
      let sumBread = 0, sumWood = 0, sumStone = 0, sumIron = 0, sumGold = 0, sumDust = 0, sumSecs = 0;

      const bodyRows = research.levels.map(l => {
        // ✅ 요구사항 표시 처리 (requirements_parsed 우선)
        let reqText = t('waracademy.table.none','-');
        if (Array.isArray(l.requirements_parsed) && l.requirements_parsed.length > 0) {
          const lvShort = t('waracademy.table.level_short','Lv.');
          reqText = l.requirements_parsed.map(r => {
            const name = localizeTokens(r.name);
            const lv = r.level ? `${lvShort} ${r.level}` : '';
            return lv ? `${name} ${lv}` : name;
          }).join(', ');
        } else if (l.requirements) {
          reqText = localizeTokens(l.requirements);
        }

        // accumulate totals
        const b = Number(l.bread || 0);
        const w = Number(l.wood || 0);
        const s = Number(l.stone || 0);
        const i = Number(l.iron || 0);
        const g = Number(l.gold || 0);
        const d2 = Number(l.dust || 0);
        const secs = parseTimeToSeconds(l.time);
        sumBread += b; sumWood += w; sumStone += s; sumIron += i; sumGold += g; sumDust += d2; sumSecs += secs;

        return `
          <tr>
            <td>${l.level ?? '-'}</td>
            <td>${reqText}</td>
            <td>${formatKMB(b)}</td>
            <td>${formatKMB(w)}</td>
            <td>${formatKMB(s)}</td>
            <td>${formatKMB(i)}</td>
            <td>${nfmt(g)}</td>
            <td>${nfmt(d2)}</td>
            <td>${localizeTime(l.time)}</td>
            <td>${nfmt(l.power)}</td>
            <td>${localizeTokens(l.bonus ?? t('waracademy.table.none','-'))}</td>
          </tr>
        `;
      }).join('');

      // Σ totals row (append to <tbody> bottom)
      const totalTimeRaw = secondsToRaw(sumSecs);
      const totalTimeLocalized = localizeTime(totalTimeRaw);
      const totalRow = `
        <tr class="tg-total">
          <td>${t('waracademy.table.total_sign','Σ')}</td>
          <td>${t('waracademy.table.totals','Totals')}</td>
          <td>${formatKMB(sumBread)}</td>
          <td>${formatKMB(sumWood)}</td>
          <td>${formatKMB(sumStone)}</td>
          <td>${formatKMB(sumIron)}</td>
          <td>${nfmt(sumGold)}</td>
          <td>${nfmt(sumDust)}</td>
          <td>${totalTimeLocalized}</td>
          <td>—</td>
          <td>—</td>
        </tr>`;

      d.insertAdjacentHTML('beforeend', `
        <table class="tg-table">
          <thead>
            <tr>
              <th>${t('waracademy.table.lv','Lv')}</th>
              <th>${t('waracademy.table.requirements','Requirements')}</th>
              <th>${t('waracademy.table.bread','Bread')}</th>
              <th>${t('waracademy.table.wood','Wood')}</th>
              <th>${t('waracademy.table.stone','Stone')}</th>
              <th>${t('waracademy.table.iron','Iron')}</th>
              <th>${t('waracademy.table.gold','Gold')}</th>
              <th>${t('waracademy.table.dust','Dust')}</th>
              <th>${t('waracademy.table.time','Time')}</th>
              <th>${t('waracademy.table.power','Power')}</th>
              <th>${t('waracademy.table.bonus','Bonus')}</th>
            </tr>
          </thead>
          <tbody>${bodyRows}${totalRow}</tbody>
        </table>
      `);
    }
  }

  // ---- Data loading (with cache) -------------------------------------------
  const cache = {};
  function loadData(url, metaId, gridId, detailId) {
    const absUrl = new URL(url, location.origin).href;
    if (cache[absUrl]) {
      renderMeta(cache[absUrl], metaId);
      renderResearchGrid(cache[absUrl], gridId, detailId);
      return;
    }
    fetch(absUrl)
      .then(r => r.json())
      .then(j => {
        cache[absUrl] = j;
        renderMeta(j, metaId);
        renderResearchGrid(j, gridId, detailId);
      })
      .catch(e => {
        console.error('[WarAcademy] load fail', e);
        const g = document.getElementById(gridId);
        if (g) g.innerHTML = `<p style="color:red;">⚠️ ${t('waracademy.load_failed','Failed to load data')} (${absUrl})</p>`;
      });
  }

  // ---- Optional: localize static headings if your i18n lib doesn't autobind
  function localizeStaticHeadings() {
    try {
      document.title = t('waracademy.page_title', t('waracademy.title', 'War Academy (Truegold Troops)'));

      const h1 = document.querySelector('h1[data-i18n="waracademy.title"]');
      if (h1) h1.textContent = t('waracademy.title', 'War Academy (Truegold Troops)');

      document.querySelectorAll('details summary').forEach(sum => {
        const h3 = sum.querySelector('h3');
        const p  = sum.querySelector('p');
        const img = sum.querySelector('img[alt]');

        if (h3) {
          const txt = h3.textContent.trim();
          // ✅ 다국어(ko/en/ja/cn/tw) 인식 추가
          if (/Infantry|보병|歩兵|步兵/i.test(txt))
            h3.textContent = t('waracademy.infantry.title', 'Truegold Infantry');
          else if (/Archer|궁병|弓兵|弓箭手/i.test(txt))
            h3.textContent = t('waracademy.archer.title', 'Truegold Archer');
          else if (/Cavalry|기병|騎兵|骑兵/i.test(txt))
            h3.textContent = t('waracademy.cavalry.title', 'Truegold Cavalry');
        }

        if (p) {
          if (h3 && (/Infantry|보병|歩兵|步兵/i.test(h3.textContent)))
            p.textContent = t('waracademy.infantry.desc', 'Training requirements, costs, and bonuses.');
          else if (h3 && (/Archer|궁병|弓兵|弓箭手/i.test(h3.textContent)))
            p.textContent = t('waracademy.archer.desc', 'Training requirements, costs, and bonuses.');
          else if (h3 && (/Cavalry|기병|騎兵|骑兵/i.test(h3.textContent)))
            p.textContent = t('waracademy.cavalry.desc', 'Training requirements, costs, and bonuses.');
          else
            p.textContent = t('waracademy.section.hint', 'Training requirements, costs, and bonuses.');
        }

        if (img && h3) img.alt = h3.textContent.trim();
      });
    } catch (_) {}
  }

  // ---- Init ---------------------------------------------------------------
  requestAnimationFrame(() => {
    localizeStaticHeadings();

    // Lazy-load each section when opened
    document.querySelectorAll('details').forEach(d => {
      d.addEventListener('toggle', () => {
        if (!d.open) return;
        if (d.querySelector('#infantry-section')) {
          loadData('/data/waracademy-infantry.json', 'infantry-meta', 'infantry-grid', 'infantry-detail');
        } else if (d.querySelector('#archer-section')) {
          loadData('/data/waracademy-archer.json', 'archer-meta', 'archer-grid', 'archer-detail');
        } else if (d.querySelector('#cavalry-section')) {
          loadData('/data/waracademy-cavalry.json', 'cavalry-meta', 'cavalry-grid', 'cavalry-detail');
        }
      });
    });
  });
};

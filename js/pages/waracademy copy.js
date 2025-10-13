// === /js/pages/waracademy.js ===
window.initWarAcademy = function () {
  'use strict';
  const t = (k, f) => window.I18N?.t?.(k, f) || f || k;

  /** ✅ K/M/B 포맷터 (빵/나무/석재/철 전용) */
  function formatKMB(n) {
    const v = Number(n ?? 0);
    const abs = Math.abs(v);
    const trim = s => s.replace(/\.?0+$/, '');
    if (abs >= 1e9) return trim((v / 1e9).toFixed(2)) + 'B';
    if (abs >= 1e6) return trim((v / 1e6).toFixed(2)) + 'M';
    if (abs >= 1e3) return trim((v / 1e3).toFixed(2)) + 'K';
    return v.toLocaleString();
  }

  /** ✅ 연구명–설명 매핑 (보병·궁병·기병 전체) */
  function getResearchTranslation(title, type) {
    const map = {
      // --- INFANTRY ---
      "Truegold Infantry Training": ["황금보병훈련", "최신식 황금 생산 라인을 통해 황금보병의 훈련 비용을 절감합니다."],
      "Truegold Infantry Aid": ["황금보병치료", "황금의 회복력이 황금보병의 치료 속도를 가속화합니다."],
      "Truegold Infantry Healing": ["황금보병응급치료", "황금의 힘으로 황금보병의 치료 비용을 줄입니다."],
      "Truegold Infantry": ["황금보병", "황금 무장을 갖춘 보병이 병영에서 생산됩니다."],
      "Truegold Plating": ["황금판금갑옷", "보병의 방어력을 향상시키는 최고급 황금 방어구입니다."],
      "Truegold Mauls": ["황금망치", "강화된 황금 철퇴로 보병의 공격력을 증가시킵니다."],
      "Truegold Legionaries": ["황금군단", "연맹 영웅의 지휘 능력을 향상시키고 집결 수용량을 증가시킵니다."],
      "Truegold Blades": ["황금강타", "정제된 황금 무기가 보병의 파괴력을 높입니다."],
      "Truegold Shields": ["황금방패", "황금으로 제작된 방패가 보병의 체력을 향상시킵니다."],
      "Truegold Battalion": ["황금부대", "영웅의 지휘 능력을 강화하여 출정 병력 수용량을 증가시킵니다."],

      // --- ARCHER ---
      "Truegold Archer Training": ["황금궁병훈련", "황금 생산 라인을 통해 궁병 훈련 비용을 절감합니다."],
      "Truegold Archer Aid": ["황금궁병치료", "황금의 회복력이 궁병의 치료 속도를 가속화합니다."],
      "Truegold Archer Healing": ["황금궁병응급치료", "황금의 힘으로 궁병의 치료 비용을 줄입니다."],
      "Truegold Archers": ["황금궁병", "황금 무장을 갖춘 궁병이 사거리와 공격력을 강화합니다."],
      "Truegold Vests": ["황금손목보호대", "황금 갑옷으로 궁병의 방어력을 향상시킵니다."],
      "Truegold Arrows": ["황금활시위", "황금 화살이 궁병의 공격력을 높입니다."],
      "Truegold Legionaries (Archer)": ["황금군단", "연맹 궁병의 지휘 능력을 향상시켜 집결 수용량을 증가시킵니다."],
      "Truegold Bracers": ["황금경갑", "궁병의 체력을 향상시키는 황금 팔보호대입니다."],
      "Truegold Bows": ["황금화살", "정제된 황금 활이 궁병의 파괴력을 높입니다."],
      "Truegold Battalion (Archer)": ["황금부대", "영웅의 지휘 능력을 강화하여 궁병 출정 병력 수용량을 증가시킵니다."],

      // --- CAVALRY ---
      "Truegold Cavalry Training": ["황금기병훈련", "황금 생산 라인을 통해 기병 훈련 비용을 절감합니다."],
      "Truegold Cavalry Aid": ["황금기병치료", "황금의 회복력이 기병의 치료 속도를 가속화합니다."],
      "Truegold Cavalry Healing": ["황금기병응급치료", "황금의 힘으로 기병의 치료 비용을 줄입니다."],
      "Truegold Cavalry": ["황금기병", "황금 갑옷과 창을 장착한 강력한 기병이 생산됩니다."],
      "Truegold Platecraft": ["황금중갑", "기병의 방어력을 향상시키는 황금 갑주를 제작합니다."],
      "Truegold Lances": ["황금장창", "황금 창이 기병의 공격력을 강화합니다."],
      "Truegold Legionaries (Cavalry)": ["황금군단", "연맹 기병의 지휘 능력을 향상시켜 집결 수용량을 증가시킵니다."],
      "Truegold Charge": ["황금돌격", "기병의 기동성과 공격력을 향상시킵니다."],
      "Truegold Farriery": ["황금말발굽", "기병의 속도와 체력을 향상시키는 황금 편자입니다."],
      "Truegold Battalion (Cavalry)": ["황금부대", "기병 부대의 출정 병력 수용량을 증가시킵니다."]
    };
    return map[title] ? map[title][type === 'desc' ? 1 : 0] : title;
  }

  /** ✅ 시간 문자열 한글 변환 (+ 00분 00초 자동 숨김) */
  function localizeTime(str) {
    if (!str) return '-';
    const s = String(str);

    // 일 수 추출
    const dMatch = s.match(/(\d+)d/);
    const days = dMatch ? parseInt(dMatch[1], 10) : 0;

    // 시:분:초 추출 (시 1~3자리 허용)
    const tMatch = s.match(/(\d{1,3}):(\d{2}):(\d{2})/);
    let h = 0, m = 0, sec = 0;
    if (tMatch) {
      h = parseInt(tMatch[1], 10);
      m = parseInt(tMatch[2], 10);
      sec = parseInt(tMatch[3], 10);
    }

    const parts = [];
    if (days > 0) parts.push(`${days}${t('waracademy.units.day','일')}`);
    if (h > 0) parts.push(`${h}${t('waracademy.units.hour','시간')}`);
    if (m > 0) parts.push(`${m}${t('waracademy.units.minute','분')}`);
    if (sec > 0) parts.push(`${sec}${t('waracademy.units.second','초')}`);

    // 모두 0이면 '0초' 대신 '-' 반환
    if (parts.length === 0) {
      return '-';
    }
    return parts.join(' ');
  }

  /** ✅ 병종명 및 비용/시간 관련 문구 전체 한글화 + 자원명 교체 */
  function localizeBonus(str) {
    if (!str) return '-';
    let r = str;

    // 연구명 매핑
    Object.keys(researchMap).forEach(k => {
      const re = new RegExp(k, 'g');
      r = r.replace(re, researchMap[k]);
    });

    // 병종 이름
    r = r
      .replace(/Truegold Infantry/g, '황금보병')
      .replace(/Truegold Archer/g, '황금궁병')
      .replace(/Truegold Cavalry/g, '황금기병')
      .replace(/\bInfantry\b/g, '보병')
      .replace(/\bArcher(s)?\b/g, '궁병')
      .replace(/\bCavalry\b/g, '기병');

    // 자원명 교체 (요구사항/보너스 문구 내)
    r = r
      .replace(/\b[Bb]read\b/g, '빵')
      .replace(/\b[Ww]ood\b/g, '나무')
      .replace(/\b[Ss]tone\b/g, '석재')
      .replace(/\b[Ii]ron\b/g, '철')
      .replace(/\b[Gg]old\b/g, '금화');

    // 공통 문구 한글화
    return r
      .replace(/War Academy/g, '전쟁아카데미')
      .replace(/Lv\./g, '레벨')
      .replace(/Training Time Down/g, '훈련 시간 단축')
      .replace(/Training Speed Up/g, '훈련 속도 증가')
      .replace(/Training Cost Down/g, '훈련 비용 감소')
      .replace(/Healing Time Down/g, '치료 시간 단축')
      .replace(/Healing Cost Down/g, '치료 비용 감소')
      .replace(/Healing Cost Reduction/g, '치료 비용 감소')
      .replace(/Cost Reduction/g, '비용 감소')
      .replace(/Resource Cost Down/g, '자원 비용 감소')
      .replace(/Construction Time Down/g, '건설 시간 단축')
      .replace(/Upgrade Time Down/g, '업그레이드 시간 단축')
      .replace(/Research Time Down/g, '연구 시간 단축')
      .replace(/Time Down/g, '시간 단축')
      .replace(/Cost Down/g, '비용 감소')
      .replace(/Speed Up/g, '속도 증가')
      .replace(/Attack/g, '공격력')
      .replace(/Defense/g, '방어력')
      .replace(/Health/g, '체력')
      .replace(/Lethality/g, '파괴력')
      .replace(/Rally Capacity/g, '집결 수용량 증가')
      .replace(/Squad Deployment Capacity/g, '출정 병력 수용량')
      .replace(/Unlock XI 황금보병/g, '황금보병 XI 해금')
      .replace(/Unlock XI 황금궁병/g, '황금궁병 XI 해금')
      .replace(/Unlock XI 황금기병/g, '황금기병 XI 해금');
  }

  /** ✅ 연구명 매핑 (요구사항/보너스용) */
  const researchMap = {
    "Truegold Infantry Training": "황금보병 훈련",
    "Truegold Infantry Aid": "황금보병 치료 지원",
    "Truegold Infantry Healing": "황금보병 치료",
    "Truegold Infantry": "황금보병",
    "Truegold Plating": "황금 방패판",
    "Truegold Mauls": "황금 철퇴",
    "Truegold Legionaries": "황금보병부대",
    "Truegold Blades": "황금강타",
    "Truegold Shields": "황금방패",
    "Truegold Battalion": "황금보병부대 편성",
    "Truegold Archer Training": "황금궁병 훈련",
    "Truegold Archer Aid": "황금궁병 치료 지원",
    "Truegold Archer Healing": "황금궁병 치료",
    "Truegold Archers": "황금궁병",
    "Truegold Vests": "황금 갑옷",
    "Truegold Arrows": "황금 화살",
    "Truegold Legionaries (Archer)": "황금궁병부대",
    "Truegold Bracers": "황금 팔보호대",
    "Truegold Bows": "황금 활",
    "Truegold Battalion (Archer)": "황금궁병부대 편성",
    "Truegold Cavalry Training": "황금기병 훈련",
    "Truegold Cavalry Aid": "황금기병 치료 지원",
    "Truegold Cavalry Healing": "황금기병 치료",
    "Truegold Cavalry": "황금기병",
    "Truegold Platecraft": "황금 갑주 제작",
    "Truegold Lances": "황금 창",
    "Truegold Legionaries (Cavalry)": "황금기병부대",
    "Truegold Charge": "황금 돌격",
    "Truegold Farriery": "황금 편자",
    "Truegold Battalion (Cavalry)": "황금기병부대 편성"
  };

  /** ✅ 상단 카드 한글화 */
  function localizeSectionTitles() {
    const nameMap = {
      'Truegold Infantry': t('waracademy.infantry.title', '황금보병'),
      'Truegold Archer': t('waracademy.archer.title', '황금궁병'),
      'Truegold Cavalry': t('waracademy.cavalry.title', '황금기병')
    };
    document.querySelectorAll('.wa-accordion summary h3').forEach(h3 => {
      const key = h3.textContent.trim();
      if (nameMap[key]) h3.textContent = nameMap[key];
    });
    document.querySelectorAll('.wa-accordion summary p').forEach(p => {
      if (p.textContent.includes('Training requirements')) {
        const h3 = p.closest('summary')?.querySelector('h3');
        const titleText = h3?.textContent?.trim() || '';
        if (titleText === t('waracademy.infantry.title', '황금보병')) {
          p.textContent = t('waracademy.infantry.desc', '연구 조건, 비용, 효과를 확인하세요.');
        } else if (titleText === t('waracademy.archer.title', '황금궁병')) {
          p.textContent = t('waracademy.archer.desc', '연구 조건, 비용, 효과를 확인하세요.');
        } else if (titleText === t('waracademy.cavalry.title', '황금기병')) {
          p.textContent = t('waracademy.cavalry.desc', '연구 조건, 비용, 효과를 확인하세요.');
        } else {
          p.textContent = t('waracademy.section.hint', '연구 조건, 비용, 효과를 확인하세요.');
        }
      }
    });
  }

  /** === 메타 정보 === */
  function renderMeta(data, id) {
    const b = document.getElementById(id);
    if (!b || !data.requirements) return;
    const r = data.requirements, bo = data.bonuses || {};
    b.innerHTML = `
    <div class="tg-meta">
      <h2>${t('waracademy.meta.requirements','황금 병종 연구 조건')}</h2>
      <ul>
        <li><b>${t('waracademy.meta.buildings','건물 요구사항')}:</b> ${t('waracademy.meta.towncenter','도시센터')} ${r.building.towncenter}, ${t('waracademy.meta.waracademy','전쟁아카데미')} ${r.building.waracademy}</li>
        <li><b>${t('waracademy.meta.time','총 연구 시간')}:</b> ${r.research_time_days} ${t('waracademy.units.day','일')}</li>
        <li><b>${t('waracademy.meta.dust','필요한 황금 가루 총량')}:</b> ${Number(r.dust ?? 0).toLocaleString()}</li>
        <li><b>${t('waracademy.meta.bread','총 빵 소비량')}:</b> ${formatKMB(r.bread)}</li>
        <li><b>${t('waracademy.meta.wood','총 나무 소비량')}:</b> ${formatKMB(r.wood)}</li>
        <li><b>${t('waracademy.meta.stone','총 석재 소비량')}:</b> ${formatKMB(r.stone)}</li>
        <li><b>${t('waracademy.meta.iron','총 철 소비량')}:</b> ${formatKMB(r.iron)}</li>
        <li><b>${t('waracademy.meta.gold','총 금화 소비량')}:</b> ${Number(r.gold ?? 0).toLocaleString()}</li>
      </ul>
      <h3>${t('waracademy.meta.bonus_title','보너스 효과')}</h3>
      <ul>
        <li>${t('waracademy.bonus.squad_capacity','부대 수용량')}: ${bo.squad_capacity ?? '-'}</li>
        <li>${t('waracademy.bonus.health','체력')}: ${bo.health ?? '-'}</li>
        <li>${t('waracademy.bonus.lethality','파괴력')}: ${bo.lethality ?? '-'}</li>
        <li>${t('waracademy.bonus.attack','공격력')}: ${bo.attack ?? '-'}</li>
        <li>${t('waracademy.bonus.defense','방어력')}: ${bo.defense ?? '-'}</li>
        <li>${t('waracademy.bonus.rally_capacity','집결 용량')}: ${bo.rally_capacity ?? '-'}</li>
      </ul>
    </div>`;
  }

  /** === 연구 카드 리스트 === */
  function renderResearchGrid(data, gid, did) {
    const g = document.getElementById(gid);
    if (!g) return;
    g.innerHTML = data.researches.map((r, i) => `
      <div class="wa-card" data-index="${i}">
        <img src="${r.image}" alt="${t('waracademy.research.' + r.title + '.title', getResearchTranslation(r.title))}">
        <div class="wa-info">
          <h4>${t('waracademy.research.' + r.title + '.title', getResearchTranslation(r.title))}</h4>
          <p>${t('waracademy.research.' + r.title + '.desc', getResearchTranslation(r.title, 'desc'))}</p>
        </div>
      </div>`).join('');
    
    // ✅ 카드 클릭 이벤트 (표 표시 + 스크롤 이동 추가)
    g.querySelectorAll('.wa-card').forEach(c => {
      c.addEventListener('click', () => {
        const idx = parseInt(c.dataset.index, 10);
        renderResearchDetail(data.researches[idx], did);
        g.querySelectorAll('.wa-card').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        // 표 영역으로 부드럽게 스크롤 이동
        document.getElementById(did)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /** === 상세 연구 표 === */
  function renderResearchDetail(r, id) {
    const d = document.getElementById(id);
    if (!d) return;
    d.innerHTML = `<h2>${t('waracademy.research.' + r.title + '.title', getResearchTranslation(r.title))}</h2><p>${t('waracademy.research.' + r.title + '.desc', getResearchTranslation(r.title, 'desc'))}</p>`;
    if (r.levels?.length) {
      d.insertAdjacentHTML('beforeend', `
      <table class="tg-table"><thead>
      <tr>
        <th>${t('waracademy.table.level','레벨')}</th>
        <th>${t('waracademy.table.requirements','요구사항')}</th>
        <th>${t('waracademy.table.bread','빵')}</th>
        <th>${t('waracademy.table.wood','나무')}</th>
        <th>${t('waracademy.table.stone','석재')}</th>
        <th>${t('waracademy.table.iron','철')}</th>
        <th>${t('waracademy.table.gold','금화')}</th>
        <th>${t('waracademy.table.dust','황금 가루')}</th>
        <th>${t('waracademy.table.time','시간')}</th>
        <th>${t('waracademy.table.power','전투력')}</th>
        <th>${t('waracademy.table.bonus','보너스')}</th>
      </tr>
      </thead><tbody>${
        r.levels.map(l => `<tr>
          <td>${l.level}</td>
          <td>${localizeBonus(l.requirements)}</td>
          <td>${formatKMB(l.bread)}</td>
          <td>${formatKMB(l.wood)}</td>
          <td>${formatKMB(l.stone)}</td>
          <td>${formatKMB(l.iron)}</td>
          <td>${Number(l.gold ?? 0).toLocaleString()}</td>
          <td>${Number(l.dust ?? 0).toLocaleString()}</td>
          <td>${localizeTime(l.time)}</td>
          <td>${Number(l.power ?? 0).toLocaleString()}</td>
          <td>${localizeBonus(l.bonus)}</td>
        </tr>`).join('')
      }</tbody></table>`);
    }
  }

  /** === JSON 로드 === */
  function loadData(u, m, g, d) {
    fetch(new URL(u, location.origin))
      .then(r => r.json())
      .then(j => { renderMeta(j, m); renderResearchGrid(j, g, d); })
      .catch(e => console.error('load fail', e));
  }

  /** === 초기 실행 === */
  requestAnimationFrame(() => {
    document.title = t('waracademy.title', '황금과학기술연구 - KingshotData.kr');
    const h1 = document.querySelector('h1[data-i18n="waracademy.title"]');
    if (h1) h1.textContent = t('waracademy.title', '황금과학기술연구');

    localizeSectionTitles();

    document.querySelectorAll('details').forEach(d => {
      d.addEventListener('toggle', () => {
        if (!d.open) return;
        if (d.querySelector('#infantry-section'))
          loadData('/data/waracademy-infantry.json', 'infantry-meta', 'infantry-grid', 'infantry-detail');
        else if (d.querySelector('#archer-section'))
          loadData('/data/waracademy-archer.json', 'archer-meta', 'archer-grid', 'archer-detail');
        else if (d.querySelector('#cavalry-section'))
          loadData('/data/waracademy-cavalry.json', 'cavalry-meta', 'cavalry-grid', 'cavalry-detail');
      });
    });
  });
};

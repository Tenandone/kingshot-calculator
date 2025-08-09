// calculator.js (선행건물 자동 생성 + 표시 포함 완성본, 한글 매핑 보강)

// ------------------------ 기본 설정 ------------------------
const allBuildingData = {};
let prereqMap = {}; // towncenter.json로부터 자동 생성

const resourceNames = {
  meat: '빵',
  wood: '나무',
  coal: '석재',
  iron: '철',
  crystals: '순금'
};

// 화면 표기용(영문 키 -> 한글명) ★ 누락분 보강
const buildingNameMap = {
  towncenter: '도시센터',
  embassy: '대사관',
  academy: '아카데미',
  command: '지휘부',
  commandcenter: '지휘부', // 별칭
  range: '궁병대',
  barracks: '보병대',
  stable: '기병대',
  infirmary: '의무실',
  camp: '야전병원',
  // 생활/생산 건물(선행조건 표시에 사용)
  lumbermill: '벌목장',
  house: '민가',
  stonework: '석재공장',
  'hero-hall': '영웅의 홀',
  ironworks: '제철공장',
  mill: '방앗간'
};

// 한글 원문 → 내부 키 매핑(선행 파싱용)
const nameToKeyMap = {
  '도시센터': 'towncenter',
  '대사관': 'embassy',
  '아카데미': 'academy',
  '지휘부': 'command',
  '궁병대': 'range',
  '보병대': 'barracks',
  '기병대': 'stable',
  '의무실': 'infirmary',
  '야전병원': 'camp',
  // 생활/생산 건물
  '벌목장': 'lumbermill',
  '민가': 'house',
  '석재공장': 'stonework',
  '영웅의 홀': 'hero-hall',
  '제철공장': 'ironworks',
  '방앗간': 'mill'
};

const resourceIcons = {
  meat: '🍞',
  wood: '🌲',
  coal: '🗿',
  iron: '⛏️',
  crystals: '🥇'
};

const lang = {
  upgradeFrom: '업그레이드: 레벨',
  upgradeTo: '부터',
  upgradeFor: '까지',
  upgradeTime: '건설 시간',
  totalCosts: '총 자원 소모량',
};

// ------------------------ 유틸 ------------------------
function removeTrailingZeros(numStr) {
  return numStr.replace(/\.00$/, '').replace(/(\.[1-9]*)0+$/, '$1');
}

function formatNumber(value) {
  if (value >= 1_000_000_000) return removeTrailingZeros((value / 1_000_000_000).toFixed(2)) + 'B';
  if (value >= 1_000_000) return removeTrailingZeros((value / 1_000_000).toFixed(2)) + 'M';
  if (value >= 1_000) return removeTrailingZeros((value / 1_000).toFixed(2)) + 'K';
  return (value ?? 0).toString();
}

function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const days = Math.floor(sec / 86400);
  sec %= 86400;
  const hours = Math.floor(sec / 3600);
  sec %= 3600;
  const minutes = Math.floor(sec / 60);
  sec %= 60;
  let result = '';
  if (days > 0) result += days + '일 ';
  if (hours > 0) result += hours + '시간 ';
  if (minutes > 0) result += minutes + '분 ';
  if (sec > 0) result += sec + '초';
  return result.trim() || '0초';
}

// 표의 level 키("30-1","TG1-3" 등) → 숫자(1~55)로 변환
function levelKeyToNumber(levelKey) {
  if (typeof levelKey === 'number') return levelKey;

  if (/^\d+-\d+$/.test(levelKey)) {
    const [base, sub] = levelKey.split('-').map(Number);
    return base + sub; // 30-1 → 31
  }
  if (/^TG\d+$/.test(levelKey)) {
    const n = parseInt(levelKey.slice(2), 10); // TG1 → 1
    return 30 + n * 5; // TG1=35, TG2=40, TG3=45, TG4=50, TG5=55
  }
  if (/^TG\d+-\d+$/.test(levelKey)) {
    const [tg, subStr] = levelKey.split('-');
    const n = parseInt(tg.slice(2), 10);
    const sub = parseInt(subStr, 10);
    return 30 + n * 5 + sub; // TG1-1=36 ... TG4-4=54
  }

  const num = parseInt(levelKey, 10);
  return Number.isFinite(num) ? num : 0;
}

// requirement 문자열 → [{name(한글), level(숫자), tg(true/false)}]
function extractPrereqsAny(reqStr) {
  if (!reqStr || reqStr.trim() === '-') return [];
  return reqStr.split(',').map(s => s.trim()).map(token => {
    const tg = /\bTG\b/i.test(token);
    const cleaned = token.replace(/\bTG\b/gi, '').trim();
    const m = cleaned.match(/^(.*?)(?:\s*Lv\.\s*(\d+))?$/i);
    if (!m) return null;
    const name = (m[1] || '').trim();
    const level = m[2] ? parseInt(m[2], 10) : 1;
    return { name, level, tg };
  }).filter(Boolean);
}

// 특정 건물의 구간 합(증분) 계산
function sumSegment(building, fromLevel, toLevel) {
  const list = allBuildingData[building];
  if (!list) return { meat:0, wood:0, coal:0, iron:0, crystals:0, time:0 };
  let meat=0, wood=0, coal=0, iron=0, crystals=0, time=0;
  for (let lvl = Math.max(fromLevel, 1) + 1; lvl <= toLevel; lvl++) {
    const row = list.find(r => r.level === lvl);
    if (!row) continue;
    meat     += row.meat     || 0;
    wood     += row.wood     || 0;
    coal     += row.coal     || 0;
    iron     += row.iron     || 0;
    crystals += row.crystals || 0;
    time     += row.time     || 0; // 초
  }
  return { meat, wood, coal, iron, crystals, time };
}

// ------------------------ 데이터 로드 ------------------------
async function loadAllData() {
  const names = ['academy', 'camp', 'command', 'embassy', 'infirmary', 'towncenter'];

  // /data/{name}_data.json 로드(자원/시간 테이블)
  await Promise.all(names.map(async (name) => {
    const url = `/data/${name}_data.json`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${name}_data.json 로드 실패 (${res.status}) - 경로: ${url}`);
    allBuildingData[name] = await res.json();
  }));

  // 병영 3종은 camp 재사용
  allBuildingData.barracks = allBuildingData.camp;
  allBuildingData.stable   = allBuildingData.camp;
  allBuildingData.range    = allBuildingData.camp;

  // 지휘부 별칭
  allBuildingData.commandcenter = allBuildingData.command;

  // towncenter.json(원문)에서 선행조건 맵 자동 구성
  try {
    const url = `/data/towncenter.json`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`towncenter.json 로드 실패 (${r.status}) - 경로: ${url}`);
    const raw = await r.json();
    buildPrereqMapFromTowncenter(raw);
  } catch (e) {
    console.error(e);
    prereqMap = {}; // 실패 시 비움
  }

  initCalculator();
}

// towncenter.json → prereqMap.towncenter 생성
function buildPrereqMapFromTowncenter(rawRows) {
  prereqMap = prereqMap || {};
  prereqMap.towncenter = {};

  for (const row of rawRows) {
    const numericLevel = levelKeyToNumber(row.level);
    if (!numericLevel) continue;

    const parts = extractPrereqsAny(row.requirement || '-');
    if (!parts.length) continue;

    // 요구사항을 {buildingKey, to} 배열로 변환
    const reqs = [];
    for (const p of parts) {
      const key = nameToKeyMap[p.name] || p.name; // 내부 키(없으면 원문 fallback)
      reqs.push({ building: key, to: p.level });
    }
    prereqMap.towncenter[numericLevel] = reqs;
  }
}

// ------------------------ 공통 시간 계수 ------------------------
/**
 * timeFactor = (법령 20%는 시간 ×0.8) / (1 + (속도보너스합 / 100))
 */
function computeTimeFactor(buffs) {
  const speedSum =
    (Number(buffs.speedBonus)    || 0) +
    (Number(buffs.saulBonus)     || 0) +
    (Number(buffs.wolfBonus)     || 0) +
    (Number(buffs.positionBonus) || 0);

  const lawFactor = buffs.doubleTime ? 0.8 : 1.0;
  return lawFactor / (1 + speedSum / 100);
}

// ------------------------ 핵심 계산 ------------------------
function calculateUpgrade(building, startLevel, targetLevel, buffs) {
  const dataList = allBuildingData[building];
  if (!dataList) throw new Error('존재하지 않는 건물입니다.');
  if (!(Number.isFinite(startLevel) && Number.isFinite(targetLevel))) {
    throw new Error('레벨 입력이 올바르지 않습니다.');
  }
  if (startLevel >= targetLevel) throw new Error('목표 레벨은 시작 레벨보다 커야 합니다.');

  let total = { meat:0, wood:0, coal:0, iron:0, crystals:0, time:0 };

  // 중복 합산 방지용 현재 달성 레벨 상태
  const currentLevels = {};
  currentLevels[building] = startLevel;

  // 특정 건물 toLevel까지 보장(재귀적으로 선행 처리)
  const ensureBuildingLevel = (bKey, toLevel) => {
    const curr = currentLevels[bKey] ?? 1; // 미지정시 1
    if (toLevel <= curr) return;

    const seg = sumSegment(bKey, curr, toLevel);
    total.meat     += seg.meat;
    total.wood     += seg.wood;
    total.coal     += seg.coal;
    total.iron     += seg.iron;
    total.crystals += seg.crystals;
    total.time     += seg.time;

    currentLevels[bKey] = toLevel;

    // 이 건물 올리는 과정의 선행도 재귀 처리
    for (let lv = curr + 1; lv <= toLevel; lv++) {
      const reqs = (prereqMap[bKey] && prereqMap[bKey][lv]) ? prereqMap[bKey][lv] : null;
      if (!reqs) continue;
      for (const req of reqs) {
        if (!req || !req.building || !Number.isFinite(req.to)) continue;
        ensureBuildingLevel(req.building, req.to);
      }
    }
  };

  // 메인 건물 start→target 증분 + 각 레벨 선행 처리
  for (let lvl = startLevel + 1; lvl <= targetLevel; lvl++) {
    const reqs = (prereqMap[building] && prereqMap[building][lvl]) ? prereqMap[building][lvl] : null;
    if (reqs && reqs.length) {
      for (const req of reqs) {
        if (!req || !req.building || !Number.isFinite(req.to)) continue;
        ensureBuildingLevel(req.building, req.to);
      }
    }

    const row = dataList.find(item => item.level === lvl);
    if (row) {
      total.meat     += row.meat     || 0;
      total.wood     += row.wood     || 0;
      total.coal     += row.coal     || 0;
      total.iron     += row.iron     || 0;
      total.crystals += row.crystals || 0;
      total.time     += row.time     || 0;
      currentLevels[building] = lvl;
    }
  }

  const timeFactor = computeTimeFactor(buffs);
  const timeSec = Math.round(Math.max(0, total.time * timeFactor));

  return {
    meat: total.meat,
    wood: total.wood,
    coal: total.coal,
    iron: total.iron,
    crystals: total.crystals,
    timeSec
  };
}

// ------------------------ 선행조건 표시 ------------------------
function renderPrereqBox(building, startLevel, targetLevel) {
  const box = document.getElementById('prereq-box');
  const ul  = document.getElementById('prereq-list');
  if (!box || !ul) return;

  if (!prereqMap || !prereqMap[building]) {
    ul.innerHTML = `<li>선행조건 데이터가 없습니다.</li>`;
    return;
  }

  const need = {}; // { buildingKey: maxLevelNeeded }
  for (let lv = startLevel + 1; lv <= targetLevel; lv++) {
    const reqs = (prereqMap[building] && prereqMap[building][lv]) ? prereqMap[building][lv] : null;
    if (!reqs) continue;
    for (const r of reqs) {
      if (!r || !r.building || !Number.isFinite(r.to)) continue;
      need[r.building] = Math.max(need[r.building] || 0, r.to);
    }
  }

  const keys = Object.keys(need);
  if (!keys.length) {
    ul.innerHTML = `<li>선행조건 없음</li>`;
    return;
  }

  const liHtml = keys.map(k => {
    const displayName = buildingNameMap[k] || k; // ★ 한글 매핑 적용
    const known = !!allBuildingData[k];
    const style = known ? '' : 'style="color:#888"';
    return `<li ${style}>${displayName} Lv.${need[k]}</li>`;
  }).join("");

  ul.innerHTML = liHtml;
}

// ------------------------ 출력 ------------------------
function displaySummaryAndTable(building, startLevel, targetLevel, result) {
  const resultDiv = document.getElementById('result');

  const summaryHtml = `
    <div style="background:#d7e8fc; padding:10px 15px; border-radius:15px; max-width:900px; margin:0 auto 5px; font-weight:600; color:#004a99; line-height:1.1; font-size:14px;">
      <p><strong>${lang.upgradeFrom} ${startLevel} ${lang.upgradeTo} ${targetLevel} ${lang.upgradeFor} ${buildingNameMap[building] || building}</strong></p>
      <p><strong>${lang.upgradeTime}:</strong> ${formatTime(result.timeSec)}</p>
      <p><strong>${lang.totalCosts}:</strong></p>
      <p>${resourceIcons.meat} ${resourceNames.meat}: ${result.meat.toLocaleString()} (${formatNumber(result.meat)})</p>
      <p>${resourceIcons.wood} ${resourceNames.wood}: ${result.wood.toLocaleString()} (${formatNumber(result.wood)})</p>
      <p>${resourceIcons.coal} ${resourceNames.coal}: ${result.coal.toLocaleString()} (${formatNumber(result.coal)})</p>
      <p>${resourceIcons.iron} ${resourceNames.iron}: ${result.iron.toLocaleString()} (${formatNumber(result.iron)})</p>
      <p>${resourceIcons.crystals} ${resourceNames.crystals}: ${result.crystals.toLocaleString()}</p>
    </div>
  `;

  let rowsHtml = '';
  const dataList = allBuildingData[building];
  for (let lvl = startLevel + 1; lvl <= targetLevel; lvl++) {
    const data = dataList.find(item => item.level === lvl);
    if (!data) continue;

    const showCrystals = targetLevel >= 31; // TG 구간부터 노출

    rowsHtml += `
      <tr>
        <td>${lvl - startLevel}</td>
        <td>${buildingNameMap[building] || building}</td>
        <td>${(lvl - 1)} → ${lvl}</td>
        <td>${formatNumber(data.meat || 0)}</td>
        <td>${formatNumber(data.wood || 0)}</td>
        <td>${formatNumber(data.coal || 0)}</td>
        <td>${formatNumber(data.iron || 0)}</td>
        ${showCrystals ? `<td>${(data.crystals ?? 0).toLocaleString()}</td>` : ''}
        <td>${formatTime(data.time)}</td>
      </tr>
    `;
  }

  const tableHeaders = `
    <tr>
      <th>#</th>
      <th>건물 (Building)</th>
      <th>레벨 (Level)</th>
      <th>빵 (Bread)</th>
      <th>나무 (Wood)</th>
      <th>석재 (Stone)</th>
      <th>철 (Iron)</th>
      ${targetLevel >= 31 ? '<th>순금 (Truegold)</th>' : ''}
      <th>건설 시간 (Build Time)</th>
    </tr>
  `;

  const tableHtml = `
    <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; max-width: 900px; margin: 0 auto; text-align: center; font-size:13px;">
      <thead style="background-color: #e9f0fa; font-weight: 700;">
        ${tableHeaders}
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;

  resultDiv.innerHTML = summaryHtml + tableHtml;
}

// ------------------------ 초기화 ------------------------
function initCalculator() {
  const calcBtn = document.getElementById('calcBtn');
  if (!calcBtn) return;

  // 목표 레벨 바뀔 때 선행조건 미리 갱신(선택)
  const targetEl = document.getElementById('targetLevel');
  if (targetEl) {
    targetEl.addEventListener('input', (e) => {
      const building = document.getElementById('building').value;
      const startLevel = parseInt(document.getElementById('startLevel').value || 1, 10);
      const targetLevel = parseInt(e.target.value || 1, 10);
      if (targetLevel > startLevel) {
        renderPrereqBox(building, startLevel, targetLevel);
      }
    });
  }

  calcBtn.addEventListener('click', () => {
    try {
      const building = document.getElementById('building').value;
      const startLevel = parseInt(document.getElementById('startLevel').value, 10);
      const targetLevel = parseInt(document.getElementById('targetLevel').value, 10);

      if (!(Number.isFinite(startLevel) && Number.isFinite(targetLevel))) {
        alert('레벨 입력이 올바르지 않습니다.');
        return;
      }
      if (startLevel >= targetLevel) {
        alert('목표 레벨은 시작 레벨보다 커야 합니다.');
        return;
      }

      const buffs = {
        speedBonus: parseFloat(document.getElementById('speedBonus').value) || 0,
        saulBonus: parseFloat(document.getElementById('saulBonus').value) || 0,
        wolfBonus: parseFloat(document.getElementById('wolfBonus').value) || 0,
        positionBonus: parseFloat(document.getElementById('positionBonus').value) || 0,
        doubleTime: document.getElementById('doubleTime').checked,
        includePrereq: document.getElementById('includePrereq')?.checked || false,
      };

      let result;
      if (!buffs.includePrereq) {
        // 메인 건물만 합산
        let totals = { meat:0, wood:0, coal:0, iron:0, crystals:0, time:0 };
        const list = allBuildingData[building];
        for (let lvl = startLevel + 1; lvl <= targetLevel; lvl++) {
          const row = list.find(r => r.level === lvl);
          if (!row) continue;
          totals.meat     += row.meat     || 0;
          totals.wood     += row.wood     || 0;
          totals.coal     += row.coal     || 0;
          totals.iron     += row.iron     || 0;
          totals.crystals += row.crystals || 0;
          totals.time     += row.time     || 0;
        }
        const timeFactor = computeTimeFactor(buffs);
        result = {
          meat: totals.meat,
          wood: totals.wood,
          coal: totals.coal,
          iron: totals.iron,
          crystals: totals.crystals,
          timeSec: Math.round(Math.max(0, totals.time * timeFactor))
        };
      } else {
        // 선행건물 합산
        result = calculateUpgrade(building, startLevel, targetLevel, buffs);
      }

      displaySummaryAndTable(building, startLevel, targetLevel, result);
      renderPrereqBox(building, startLevel, targetLevel);
    } catch (e) {
      alert(e.message || '알 수 없는 오류가 발생했습니다.');
      console.error(e);
    }
  });
}

loadAllData().catch(err => {
  console.error(err);
  const resultDiv = document.getElementById('result');
  if (resultDiv) {
    resultDiv.innerHTML = `<div style="color:#b00020; font-weight:600;">데이터 로드 중 오류: ${err.message}</div>`;
  }
});

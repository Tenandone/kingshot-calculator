const allBuildingData = {};

const resourceNames = {
  meat: '빵',
  wood: '나무',
  coal: '석재',
  iron: '철',
  crystals: '순금'
};

const buildingNameMap = {
  towncenter: '도시센터',
  embassy: '대사관',
  academy: '아카데미',
  command: '지휘부',
  range: '궁병대',
  barracks: '보병대',
  stable: '기병대',
  infirmary: '의무실',
  camp: '야전병원'
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

function removeTrailingZeros(numStr) {
  return numStr.replace(/\.00$/, '').replace(/(\.[1-9]*)0+$/, '$1');
}

function formatNumber(value) {
  if (value >= 1_000_000_000) return removeTrailingZeros((value / 1_000_000_000).toFixed(2)) + 'B';
  if (value >= 1_000_000) return removeTrailingZeros((value / 1_000_000).toFixed(2)) + 'M';
  if (value >= 1_000) return removeTrailingZeros((value / 1_000).toFixed(2)) + 'K';
  return value.toString();
}

function formatTime(sec) {
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

async function loadAllData() {
  const names = ['academy', 'camp', 'command', 'embassy', 'infirmary', 'towncenter'];

  await Promise.all(names.map(async (name) => {
    const res = await fetch(`./data/${name}_data.json`);
    allBuildingData[name] = await res.json();
  }));

  allBuildingData.barracks = allBuildingData.camp;
  allBuildingData.stable = allBuildingData.camp;
  allBuildingData.range = allBuildingData.camp;

  initCalculator();
}

function calculateUpgrade(building, startLevel, targetLevel, buffs) {
  const dataList = allBuildingData[building];
  if (!dataList) throw new Error('존재하지 않는 건물입니다.');

  if (startLevel >= targetLevel) throw new Error('목표 레벨은 시작 레벨보다 커야 합니다.');

  let totalMeat = 0, totalWood = 0, totalCoal = 0, totalIron = 0, totalCrystals = 0, totalTime = 0;

  for (let lvl = startLevel + 1; lvl <= targetLevel; lvl++) {
    const levelData = dataList.find(item => item.level === lvl);
    if (!levelData) continue;

    totalMeat += levelData.meat || 0;
    totalWood += levelData.wood || 0;
    totalCoal += levelData.coal || 0;
    totalIron += levelData.iron || 0;
    totalCrystals += levelData.crystals || 0;
    totalTime += levelData.time || 0;
  }

  let totalBuffPercent = buffs.speedBonus + buffs.saulBonus + buffs.wolfBonus + buffs.positionBonus;
  if (buffs.doubleTime) totalTime *= 0.5;
  totalTime *= (1 - totalBuffPercent / 100);
  if (totalTime < 0) totalTime = 0;

  return {
    meat: totalMeat,
    wood: totalWood,
    coal: totalCoal,
    iron: totalIron,
    crystals: totalCrystals,
    timeSec: Math.round(totalTime),
  };
}

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

    const showCrystals = targetLevel >= 30;

    rowsHtml += `
      <tr>
        <td>${lvl - startLevel}</td>
        <td>${buildingNameMap[building] || building}</td>
        <td>${lvl - 1} → ${lvl}</td>
        <td>${formatNumber(data.meat || 0)}</td>
        <td>${formatNumber(data.wood || 0)}</td>
        <td>${formatNumber(data.coal || 0)}</td>
        <td>${formatNumber(data.iron || 0)}</td>
        ${showCrystals ? `<td>${data.crystals?.toLocaleString() || 0}</td>` : ''}
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
      ${targetLevel >= 30 ? '<th>순금 (Truegold)</th>' : ''}
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

function initCalculator() {
  const calcBtn = document.getElementById('calcBtn');
  calcBtn.addEventListener('click', () => {
    try {
      const building = document.getElementById('building').value;
      const startLevel = parseInt(document.getElementById('startLevel').value, 10);
      const targetLevel = parseInt(document.getElementById('targetLevel').value, 10);

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
        includePrereq: document.getElementById('includePrereq').checked,
      };

      const result = calculateUpgrade(building, startLevel, targetLevel, buffs);

      displaySummaryAndTable(building, startLevel, targetLevel, result);
    } catch (e) {
      alert(e.message);
    }
  });
}

loadAllData();

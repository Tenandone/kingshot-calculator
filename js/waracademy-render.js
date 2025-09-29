(function () {
  'use strict';

  // -------- JSON 불러오기 + 렌더링 --------
  function renderWarAcademy(jsonUrl, rootId) {
    fetch(jsonUrl)
      .then(res => res.json())
      .then(data => {
        const root = document.getElementById(rootId);
        if (!root) return;

        // --- 상단 메타 요약 ---
        const meta = document.createElement('div');
        meta.className = 'tg-meta';
        meta.innerHTML = `
          <h2>Requirements for Truegold Troops</h2>
          <ul>
            <li><b>Building Requirements:</b> Town Center ${data.meta.requirements.towncenter} and War Academy ${data.meta.requirements.waracademy}</li>
            <li><b>Total research time:</b> ${data.meta.research.time_days} days</li>
            <li><b>Total Truegold Dust:</b> ${data.meta.research.dust.toLocaleString()}</li>
            <li><b>Total Bread:</b> ${data.meta.research.bread.toLocaleString()}</li>
            <li><b>Total Wood:</b> ${data.meta.research.wood.toLocaleString()}</li>
            <li><b>Total Stone:</b> ${data.meta.research.stone.toLocaleString()}</li>
            <li><b>Total Iron:</b> ${data.meta.research.iron.toLocaleString()}</li>
            <li><b>Total Gold:</b> ${data.meta.research.gold.toLocaleString()}</li>
          </ul>
          <h3>Bonuses:</h3>
          <ul>
            <li>+${data.meta.bonuses.squad_capacity} Squad Deployment Capacity</li>
            <li>+${data.meta.bonuses.health} Troop-Type Health</li>
            <li>+${data.meta.bonuses.lethality} Troop-Type Lethality</li>
            <li>+${data.meta.bonuses.attack} Troop-Type Attack</li>
            <li>+${data.meta.bonuses.defense} Troop-Type Defense</li>
            <li>+${data.meta.bonuses.rally_capacity.toLocaleString()} Rally Capacity</li>
          </ul>
          <p><b>${data.meta.title}</b></p>
          <p>${data.meta.description}</p>
        `;
        root.appendChild(meta);

        // --- 레벨별 표 ---
        data.levels.forEach(lv => {
          const wrapper = document.createElement('div');
          wrapper.className = 'tg-level';

          // 이미지
          const img = document.createElement('img');
          img.src = lv.image;
          img.alt = `${data.meta.troop} Training Lv.${lv.level}`;
          img.style.maxWidth = '300px';

          // 표
          const table = document.createElement('table');
          table.className = 'tg-table';
          table.innerHTML = `
            <caption>Level ${lv.level}</caption>
            <tr><th>Requirements</th><td>${lv.requirements}</td></tr>
            <tr><th>Bread</th><td>${lv.bread.toLocaleString()}</td></tr>
            <tr><th>Wood</th><td>${lv.wood.toLocaleString()}</td></tr>
            <tr><th>Stone</th><td>${lv.stone.toLocaleString()}</td></tr>
            <tr><th>Iron</th><td>${lv.iron.toLocaleString()}</td></tr>
            <tr><th>Gold</th><td>${lv.gold.toLocaleString()}</td></tr>
            <tr><th>Truegold Dust</th><td>${lv.dust.toLocaleString()}</td></tr>
            <tr><th>Upgrade Time</th><td>${lv.time}</td></tr>
            <tr><th>Power</th><td>${lv.power.toLocaleString()}</td></tr>
            <tr><th>Bonus</th><td>${lv.bonus}</td></tr>
          `;

          wrapper.appendChild(img);
          wrapper.appendChild(table);
          root.appendChild(wrapper);
        });
      })
      .catch(err => {
        console.error('[tg] Failed to load:', jsonUrl, err);
      });
  }

  // -------- 전역 등록 --------
  window.WarAcademyRender = { renderWarAcademy };
})();

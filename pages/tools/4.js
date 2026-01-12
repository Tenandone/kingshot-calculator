(function(){
  'use strict';

  function renderResearchTree(containerId, researches) {
    const NODE_W = 120, NODE_H = 130, ICON = 80, ICON_RX = 14;
    const NS = 'http://www.w3.org/2000/svg';
    const $ = n => document.createElementNS(NS, n);
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const vw = container.clientWidth || 1200, vh = 700;
    const svg = $('svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '700');
    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    container.appendChild(svg);

    const bg = $('rect');
    bg.setAttribute('x', '0'); bg.setAttribute('y', '0');
    bg.setAttribute('width', vw); bg.setAttribute('height', vh);
    bg.setAttribute('fill', '#2d2416');
    svg.appendChild(bg);

    const phaseX = { 1: vw * 0.18, 2: vw * 0.5, 3: vw * 0.82 };
    const phases = new Set(researches.filter(r => r.phase).map(r => r.phase));
    [1,2,3].forEach(p => {
      if (!phases.has(p)) return;
      const t = $('text');
      t.setAttribute('x', phaseX[p]); t.setAttribute('y', 36);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('fill', '#ffffff');
      t.setAttribute('font-size', '20'); t.setAttribute('font-weight', '700');
      t.textContent = p === 1 ? 'Phase I' : p === 2 ? 'Phase II' : 'Phase III';
      svg.appendChild(t);

      const v = $('line');
      v.setAttribute('x1', phaseX[p]); v.setAttribute('x2', phaseX[p]);
      v.setAttribute('y1', '50'); v.setAttribute('y2', vh - 12);
      v.setAttribute('stroke', 'rgba(255,255,255,0.35)'); v.setAttribute('stroke-width', '1');
      svg.appendChild(v);
    });

    const layout = new Map();
    researches.forEach(r => {
      const baseX = r.phase ? phaseX[r.phase] : 0;
      const x = (r.x || 0) + (r.phase ? baseX - NODE_W / 2 : 0);
      const y = (r.y || 0) + (r.phase ? 60 : 0);
      layout.set(r.id, { x, y, r });
    });

    const lines = $('g'), nodes = $('g');
    svg.appendChild(lines); svg.appendChild(nodes);

    researches.forEach(r => {
      if (!r.requires || !r.requires.length) return;
      const to = layout.get(r.id); if (!to) return;
      const tx = to.x + NODE_W / 2, ty = to.y + 12 + ICON + 8;
      r.requires.forEach(pid => {
        const from = layout.get(pid); if (!from) return;
        const fx = from.x + NODE_W / 2, fy = from.y + NODE_H - 8;
        const mx = (fx + tx) / 2;
        const path = $('path');
        path.setAttribute('d', `M ${fx} ${fy} C ${mx} ${fy}, ${mx} ${ty}, ${tx} ${ty}`);
        path.setAttribute('stroke', '#c9a44f');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        lines.appendChild(path);
      });
    });

    researches.forEach(r => {
      const pos = layout.get(r.id); if (!pos) return;
      const g = $('g');
      g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
      g.style.cursor = 'pointer';
      g.addEventListener('click', () => {
        const name = typeof getResearchTranslation === 'function' ? getResearchTranslation(r.title) : r.title;
        alert(name);
      });

      const rect = $('rect');
      rect.setAttribute('x', '0'); rect.setAttribute('y', '0');
      rect.setAttribute('width', NODE_W); rect.setAttribute('height', NODE_H);
      rect.setAttribute('rx', '16'); rect.setAttribute('ry', '16');
      rect.setAttribute('fill', '#3a2f1d'); rect.setAttribute('stroke', '#5a472a');
      rect.setAttribute('stroke-width', '2');
      g.appendChild(rect);

      const defs = $('defs');
      const clipId = `clip_${containerId}_${r.id}`;
      const cp = $('clipPath'); cp.setAttribute('id', clipId);
      const cr = $('rect');
      cr.setAttribute('x', (NODE_W - ICON) / 2); cr.setAttribute('y', 12);
      cr.setAttribute('width', ICON); cr.setAttribute('height', ICON);
      cr.setAttribute('rx', ICON_RX); cr.setAttribute('ry', ICON_RX);
      cp.appendChild(cr); defs.appendChild(cp); g.appendChild(defs);

      const img = $('image');
      img.setAttribute('href', r.image);
      img.setAttribute('x', (NODE_W - ICON) / 2); img.setAttribute('y', 12);
      img.setAttribute('width', ICON); img.setAttribute('height', ICON);
      img.setAttribute('clip-path', `url(#${clipId})`);
      g.appendChild(img);

      const tt = $('text');
      tt.setAttribute('x', NODE_W / 2);
      tt.setAttribute('y', 12 + ICON + 22);
      tt.setAttribute('text-anchor', 'middle');
      tt.setAttribute('fill', '#e9e0d0');
      tt.setAttribute('font-size', '13');
      tt.setAttribute('font-weight', '700');
      tt.setAttribute('dominant-baseline', 'middle');
      tt.textContent = typeof getResearchTranslation === 'function' ? getResearchTranslation(r.title) : r.title;
      g.appendChild(tt);

      nodes.appendChild(g);
    });
  }

  const cache = {};
  function renderMeta(data, metaId) {
    const box = document.getElementById(metaId);
    if (!box || !data.requirements) return;
    const r = data.requirements, b = data.bonuses || {};
    box.innerHTML = `
      <div class="tg-meta">
        <h2>Requirements</h2>
        <ul>
          <li><b>Town Center:</b> ${r.building.towncenter}</li>
          <li><b>War Academy:</b> ${r.building.waracademy}</li>
          <li><b>Total Time:</b> ${r.research_time_days} days</li>
          <li><b>Bread:</b> ${r.bread.toLocaleString()}</li>
          <li><b>Wood:</b> ${r.wood.toLocaleString()}</li>
          <li><b>Stone:</b> ${r.stone.toLocaleString()}</li>
          <li><b>Iron:</b> ${r.iron.toLocaleString()}</li>
          <li><b>Gold:</b> ${r.gold.toLocaleString()}</li>
          <li><b>Dust:</b> ${r.dust.toLocaleString()}</li>
        </ul>
        <h3>Bonuses</h3>
        <ul>
          <li>Squad Capacity: ${b.squad_capacity ?? '-'}</li>
          <li>Health: ${b.health ?? '-'}</li>
          <li>Lethality: ${b.lethality ?? '-'}</li>
          <li>Attack: ${b.attack ?? '-'}</li>
          <li>Defense: ${b.defense ?? '-'}</li>
          <li>Rally Capacity: ${b.rally_capacity ?? '-'}</li>
        </ul>
      </div>`;
  }
  function renderResearchGrid(data, gridId, detailId) {
    const grid = document.getElementById(gridId);
    grid.innerHTML = data.researches.map((r,i)=>`
      <div class="wa-card" data-index="${i}">
        <img src="${r.image}" alt="${r.title}">
        <div class="wa-info">
          <h4>${r.title}</h4>
          <p>${r.description ?? ''}</p>
        </div>
      </div>`).join('');
    grid.querySelectorAll('.wa-card').forEach(card=>{
      card.addEventListener('click',()=>{
        const idx = parseInt(card.dataset.index,10);
        renderResearchDetail(data.researches[idx], detailId);
        grid.querySelectorAll('.wa-card').forEach(c=>c.classList.remove('active'));
        card.classList.add('active');
        setTimeout(()=>document.getElementById(detailId)?.scrollIntoView({behavior:'smooth', block:'start'}), 120);
      });
    });
  }
  function renderResearchDetail(research, detailId) {
    const box = document.getElementById(detailId);
    box.innerHTML = `<h2>${research.title}</h2><p>${research.description ?? ''}</p>`;
    if (research.levels?.length) {
      const rows = research.levels.map(l=>`
        <tr>
          <td>${l.level}</td>
          <td>${l.requirements ?? '-'}</td>
          <td>${(l.bread ?? 0).toLocaleString()}</td>
          <td>${(l.wood ?? 0).toLocaleString()}</td>
          <td>${(l.stone ?? 0).toLocaleString()}</td>
          <td>${(l.iron ?? 0).toLocaleString()}</td>
          <td>${(l.gold ?? 0).toLocaleString()}</td>
          <td>${(l.dust ?? 0).toLocaleString()}</td>
          <td>${l.time ?? '-'}</td>
          <td>${(l.power ?? 0).toLocaleString()}</td>
          <td>${l.bonus ?? '-'}</td>
        </tr>`).join('');
      box.insertAdjacentHTML('beforeend', `
        <table class="tg-table">
          <thead><tr>
            <th>Lv</th><th>Requirements</th><th>Bread</th><th>Wood</th><th>Stone</th>
            <th>Iron</th><th>Gold</th><th>Dust</th><th>Time</th><th>Power</th><th>Bonus</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`);
    }
  }
  function loadData(url, metaId, gridId, detailId, treeBuilder, treeContainerId) {
    const abs = new URL(url, location.origin).href;
    const paint = (data)=>{
      renderMeta(data, metaId);
      renderResearchGrid(data, gridId, detailId);
      if (treeBuilder && treeContainerId) renderResearchTree(treeContainerId, treeBuilder(data));
    };
    if (cache[abs]) return paint(cache[abs]);
    fetch(abs).then(r=>r.json()).then(j=>{ cache[abs]=j; paint(j); })
      .catch(e=>console.error('[TG] Load failed:', e));
  }

  function mountTreeBox(sectionId, treeId){
    const sec = document.getElementById(sectionId);
    if (!sec) return null;
    let box = document.getElementById(treeId);
    if (!box) {
      box = document.createElement('div');
      box.id = treeId;
      box.style.margin = '14px 0 18px';
      sec.prepend(box);
    }
    return box.id;
  }
  function makeR(id, title, phase, x, y, requires, set){
    const found = (set || []).find(v=>v.title===title) || {};
    return { id, title, image: found.image || '/img/placeholder.webp', phase, x, y, requires };
  }

  function buildInfantryPositions(data){
    const S = data.researches || [];
    return [
      makeR('mauls','Truegold Mauls',1,-180,  90, [], S),
      makeR('plating','Truegold Plating',1,  20,  10, [], S),
      makeR('shields','Truegold Shields',1, -80, 260, [], S),
      makeR('blades','Truegold Blades',1,  60, 330, [], S),
      makeR('legion','Truegold Legionaries',1,  60, 190, ['mauls','shields'], S),
      makeR('inf','Truegold Infantry',2,   0, 190, ['legion','plating','blades'], S),
      makeR('heal','Truegold Infantry Healing',3, 200,  40, ['inf'], S),
      makeR('train','Truegold Infantry Training',3, 200, 190, ['inf'], S),
      makeR('aid','Truegold Infantry Aid',3, 200, 320, ['inf'], S),
    ];
  }
  function buildArcherPositions(data){
    const S = data.researches || [];
    return [
      makeR('arrows','Truegold Arrows',1,-180,  90, [], S),
      makeR('vests','Truegold Vests',1,   20,  10, [], S),
      makeR('bracers','Truegold Bracers',1, -80, 260, [], S),
      makeR('bows','Truegold Bows',1,     60, 330, [], S),
      makeR('legionA','Truegold Legionaries (Archer)',1, 60, 190, ['arrows','bracers'], S),
      makeR('arch','Truegold Archers',2,   0, 190, ['legionA','vests','bows'], S),
      makeR('healA','Truegold Archer Healing',3, 200,  40, ['arch'], S),
      makeR('trainA','Truegold Archer Training',3, 200, 190, ['arch'], S),
      makeR('aidA','Truegold Archer Aid',3, 200, 320, ['arch'], S),
    ];
  }
  function buildCavalryPositions(data){
    const S = data.researches || [];
    return [
      makeR('lances','Truegold Lances',1,-180,  90, [], S),
      makeR('plate','Truegold Platecraft',1,  20,  10, [], S),
      makeR('farriery','Truegold Farriery',1, -80, 260, [], S),
      makeR('charge','Truegold Charge',1,    60, 330, [], S),
      makeR('legionC','Truegold Legionaries (Cavalry)',1, 60, 190, ['lances','farriery'], S),
      makeR('cav','Truegold Cavalry',2,   0, 190, ['legionC','plate','charge'], S),
      makeR('healC','Truegold Cavalry Healing',3, 200,  40, ['cav'], S),
      makeR('trainC','Truegold Cavalry Training',3, 200, 190, ['cav'], S),
      makeR('aidC','Truegold Cavalry Aid',3, 200, 320, ['cav'], S),
    ];
  }

  document.querySelectorAll('details').forEach(d=>{
    d.addEventListener('toggle',()=>{
      if (!d.open) return;
      if (d.querySelector('#infantry-section')) {
        const treeId = mountTreeBox('infantry-section','infantry-tree');
        loadData('/data/waracademy-infantry.json','infantry-meta','infantry-grid','infantry-detail', buildInfantryPositions, treeId);
      } else if (d.querySelector('#archer-section')) {
        const treeId = mountTreeBox('archer-section','archer-tree');
        loadData('/data/waracademy-archer.json','archer-meta','archer-grid','archer-detail', buildArcherPositions, treeId);
      } else if (d.querySelector('#cavalry-section')) {
        const treeId = mountTreeBox('cavalry-section','cavalry-tree');
        loadData('/data/waracademy-cavalry.json','cavalry-meta','cavalry-grid','cavalry-detail', buildCavalryPositions, treeId);
      }
    });
  });

  window.renderResearchTree = renderResearchTree;
})();

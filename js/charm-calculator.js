/* js/charm-calculator.js (v20250902-i18n-full)
 * 영주 보석 계산기: JSON 로드 → UI 렌더 → 합산 (i18n 대응 + 언어 전환 갱신)
 */
(function(){
  'use strict';

  // ===== i18n helper =====
  const t = (k, fb) => (window.I18N && typeof I18N.t==='function') ? I18N.t(k, fb ?? k) : (fb ?? k);
  const fmt = n => (n||0).toLocaleString(undefined,{maximumFractionDigits:2});
  const h = (tag, attrs={}, children=[]) => {
    const el = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) {
      if (k==='class') el.className=v;
      else if (k==='text') el.textContent=v;
      else el.setAttribute(k,v);
    }
    (Array.isArray(children)?children:[children]).forEach(c=>{
      if (c==null) return;
      el.appendChild(typeof c==='string'?document.createTextNode(c):c);
    });
    return el;
  };
  const keysOf = steps => Object.keys(steps);

  // fromIdx+1..toIdx 까지 비용 합
  function sumUpgrade(steps, keys, fromIdx, toIdx){
    let manual=0, blueprint=0;
    for(let i=fromIdx+1;i<=toIdx;i++){
      const s = steps[keys[i]] || {};
      manual += +s.manual || 0;
      blueprint += +s.blueprint || 0;
    }
    return {manual, blueprint};
  }

  async function initCharmCalculator({mount, jsonUrl, data}){
    const root = document.querySelector(mount);
    if(!root){
      console.error('[charm] mount not found:', mount);
      return;
    }

    // 데이터 로드
    let charm;
    try{
      if (data) charm = data;
      else {
        const res = await fetch(jsonUrl, {cache:'no-store'});
        if (!res.ok) throw new Error('fetch '+res.status);
        charm = await res.json();
      }
    }catch(e){
      root.textContent = t('calcCharm.error.load','데이터를 불러오지 못했습니다.');
      console.error(e);
      return;
    }

    // 스타일(중복 방지)
    if(!document.getElementById('charm-calc-style')){
      const st = document.createElement('style');
      st.id='charm-calc-style';
      st.textContent = `
      .charm-card{border:1px solid #e5e7eb;border-radius:14px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.05);max-width:860px;background:#fff;margin:0 auto}
      .charm-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:10px 0;justify-content:center}
      .charm-row input,.charm-row select,.charm-row button{padding:8px 10px;border:1px solid #ddd;border-radius:10px;background:#f8f9fb}
      .class-group{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center}
      .class-pill{font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid #ddd;background:#fafafa}
      .charm-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
      .charm-kpi{border:1px solid #eee;border-radius:12px;padding:12px;text-align:center;background:#fafafa}
      .charm-kpi .num{font-size:18px;font-weight:700}
      .charm-details{margin-top:12px;font-size:13px;background:#fff;border:1px solid #eee;border-radius:10px;max-height:260px;overflow:auto;padding-top:6px}
      .charm-details table{border-collapse:collapse;width:100%}
      .charm-details th,.charm-details td{border-bottom:1px solid #f0f0f0;padding:8px 10px;text-align:left;line-height:1.2}
      .charm-details th{background:#fafafa;font-weight:600;white-space:nowrap}
      `;
      document.head.appendChild(st);
    }

    // ---------- UI ----------
    root.innerHTML='';
    const card = h('div',{class:'charm-card'});

    const fromSel=h('select');
    const toSel=h('select');

    const cavInp=h('input',{type:'number',min:'0',value:'0',style:'width:80px'});
    const infInp=h('input',{type:'number',min:'0',value:'0',style:'width:80px'});
    const arcInp=h('input',{type:'number',min:'0',value:'0',style:'width:80px'});

    const fill9 = h('button');
    const clear = h('button');
    const runBtn=h('button');

    const kpiManual= h('div',{class:'charm-kpi'},[h('div',{class:'num',id:'ck-manual',text:'0'}),h('div')]);
    const kpiBp = h('div',{class:'charm-kpi'},[h('div',{class:'num',id:'ck-bp',text:'0'}),h('div')]);
    const kpiAttr = h('div',{class:'charm-kpi'},[h('div',{class:'num',id:'ck-attr',text:'0%'}),h('div')]);

    const grid=h('div',{class:'charm-grid'},[kpiManual,kpiBp,kpiAttr]);

    const row1=h('div',{class:'charm-row'},[ fromSel, toSel ]);
    const row2=h('div',{class:'charm-row class-group'},[ cavInp, infInp, arcInp, fill9, clear, runBtn ]);

    const hint=h('div',{class:'gear-muted'});

    // ✅ 헤더 라벨을 채워서 상단 한 줄이 '보이도록'
    const detailWrap=h('div',{class:'charm-details',style:'display:none'});
    const detailTable=h('table',{},[
      h('thead',{},h('tr',{},[
        h('th',{text: t('calcCharm.table.level','레벨')}),
        h('th',{text: t('calcCharm.table.manual','보석매뉴얼')}),
        h('th',{text: t('calcCharm.table.blueprint','보석도면')}),
        h('th',{text: t('calcCharm.table.attr','속성(%)')})
      ])),
      h('tbody',{id:'ck-tbody'})
    ]);
    detailWrap.appendChild(detailTable);

    card.appendChild(row1);
    card.appendChild(row2);
    card.appendChild(grid);
    card.appendChild(hint);
    card.appendChild(detailWrap);
    root.appendChild(card);

    const keys = keysOf(charm.steps);
    keys.forEach((label,idx)=>{
      fromSel.appendChild(h('option',{value:String(idx),text:label}));
      toSel.appendChild(h('option',{value:String(idx),text:label}));
    });
    fromSel.value='0';
    toSel.value=String(keys.length-1);

    // ---------- 계산 함수 ----------
    function doCalc(){
      const fromIdx=parseInt(fromSel.value,10);
      const toIdx=parseInt(toSel.value,10);
      const cav=Math.max(0, parseInt(cavInp.value,10)||0);
      const inf=Math.max(0, parseInt(infInp.value,10)||0);
      const arc=Math.max(0, parseInt(arcInp.value,10)||0);
      const totalCount=cav+inf+arc;

      if (toIdx<=fromIdx || totalCount<=0){
        document.getElementById('ck-manual').textContent = '0';
        document.getElementById('ck-bp').textContent = '0';
        document.getElementById('ck-attr').textContent = '0%';
        detailWrap.style.display='none';
        return;
      }
      const cost = sumUpgrade(charm.steps, keys, fromIdx, toIdx);
      const attrTo = +charm.steps[keys[toIdx]].attr || 0;
      const attrFrom = +charm.steps[keys[fromIdx]].attr|| 0;
      const attrDelta = (attrTo - attrFrom);

      const totalManual = cost.manual * totalCount;
      const totalBlueprint = cost.blueprint * totalCount;
      const totalAttr = attrDelta * totalCount;

      document.getElementById('ck-manual').textContent = fmt(totalManual);
      document.getElementById('ck-bp').textContent = fmt(totalBlueprint);
      document.getElementById('ck-attr').textContent = fmt(totalAttr) + '%';

      // 상세
      const tb=document.getElementById('ck-tbody');
      tb.innerHTML='';
      for(let i=fromIdx+1;i<=toIdx;i++){
        const k=keys[i], s=charm.steps[k];
        tb.appendChild(h('tr',{},[
          h('td',{text:k}),
          h('td',{text:fmt(s.manual)}),
          h('td',{text:fmt(s.blueprint)}),
          h('td',{text:fmt(s.attr)+'%'}),
        ]));
      }
      detailWrap.style.display='';
    }

    // ---------- 라벨 갱신 함수 ----------
    function updateLabels(){
      fromSel.setAttribute('aria-label', t('calcCharm.form.currentLevel.label','현재 레벨'));
      toSel.setAttribute('aria-label', t('calcCharm.form.targetLevel.label','목표 레벨'));

      cavInp.setAttribute('placeholder', t('calcCharm.form.counts.cavalry','기병'));
      infInp.setAttribute('placeholder', t('calcCharm.form.counts.infantry','보병'));
      arcInp.setAttribute('placeholder', t('calcCharm.form.counts.archer','궁병'));

      fill9.textContent = t('calcCharm.form.actions.fill9','기본 3·3·3');
      clear.textContent = t('calcCharm.form.actions.clear','초기화');
      runBtn.textContent = t('calcCharm.form.actions.calculate','계산하기');

      kpiManual.lastChild.textContent = t('calcCharm.result.manual','보석매뉴얼');
      kpiBp.lastChild.textContent     = t('calcCharm.result.blueprint','보석도면');
      kpiAttr.lastChild.textContent   = t('calcCharm.result.attribute','속성 증가(총)');

      hint.textContent = t('calcCharm.hint','※ 비용은 현재→목표 업그레이드 구간 합 × (총 개수). 속성은 (목표% − 현재%) × 총 개수.');
    }

    // 이벤트
    fill9.addEventListener('click', ()=>{ cavInp.value=3; infInp.value=3; arcInp.value=3; doCalc(); });
    clear.addEventListener('click', ()=>{ cavInp.value=0; infInp.value=0; arcInp.value=0; doCalc(); });
    runBtn.addEventListener('click', doCalc);
    fromSel.addEventListener('change', doCalc);
    toSel.addEventListener('change', doCalc);

    // 언어 전환 시 라벨 갱신
    document.addEventListener('i18n:changed', ()=>{
      updateLabels();
    });

    // 최초 실행
    updateLabels();
    doCalc();
  }

  window.initCharmCalculator = initCharmCalculator;
})();

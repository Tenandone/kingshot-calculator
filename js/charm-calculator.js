/* js/charm-calculator.js (v20250823b - class counts)
 * 영주 보석 계산기: JSON 로드 → UI 렌더 → 합산
 * - 병종(기병/보병/궁병) 별 개수 입력 → 총합 계산
 * - 비용: from→to 업그레이드 구간 합 × (세 병종 개수 합)
 * - 속성: (목표% − 현재%) × (세 병종 개수 합)
 */
(function(){
  'use strict';

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

  // fromIdx+1..toIdx 까지(목표 레벨까지) 업그레이드 비용 합
  function sumUpgrade(steps, keys, fromIdx, toIdx){
    let manual=0, blueprint=0;
    for(let i=fromIdx+1;i<=toIdx;i++){
      const s = steps[keys[i]] || {};
      manual    += +s.manual    || 0;
      blueprint += +s.blueprint || 0;
    }
    return {manual, blueprint};
  }

  async function initCharmCalculator({mount, jsonUrl, data}){
    const root = document.querySelector(mount);
    if(!root){ console.error('[charm] mount not found:', mount); return; }

    // 데이터
    let charm;
    try{
      if (data) charm = data;
      else {
        const res = await fetch(jsonUrl, {cache:'no-store'});
        if (!res.ok) throw new Error('fetch '+res.status);
        charm = await res.json();
      }
    }catch(e){
      root.textContent='데이터를 불러오지 못했습니다.'; console.error(e); return;
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
        .charm-details{margin-top:12px;font-size:13px;background:#fff;border:1px solid #eee;border-radius:10px;max-height:260px;overflow:auto}
        .charm-details table{border-collapse:collapse;width:100%}
        .charm-details th,.charm-details td{border-bottom:1px solid #f0f0f0;padding:8px 10px;text-align:left}
        .charm-details th{background:#fafafa;font-weight:600}
      `;
      document.head.appendChild(st);
    }

    // UI
    root.innerHTML='';
    const card = h('div',{class:'charm-card'});

    const fromSel=h('select',{'aria-label':'현재 보석 레벨'});
    const toSel=h('select',{'aria-label':'목표 보석 레벨'});

    // 병종별 개수
    const cavInp=h('input',{type:'number',min:'0',value:'0',style:'width:80px',placeholder:'기병'});
    const infInp=h('input',{type:'number',min:'0',value:'0',style:'width:80px',placeholder:'보병'});
    const arcInp=h('input',{type:'number',min:'0',value:'0',style:'width:80px',placeholder:'궁병'});
    const fill9 = h('button',{text:'기본 3·3·3',title:'세 병종 모두 3개로 채우기'});
    const clear = h('button',{text:'초기화',title:'세 병종 개수 초기화'});
    const runBtn=h('button',{text:'계산하기','aria-label':'계산하기'});

    const kpiManual= h('div',{class:'charm-kpi'},[h('div',{class:'num',id:'ck-manual',text:'0'}),h('div',{text:'보석매뉴얼'})]);
    const kpiBp    = h('div',{class:'charm-kpi'},[h('div',{class:'num',id:'ck-bp',text:'0'}),h('div',{text:'보석도면'})]);
    const kpiAttr  = h('div',{class:'charm-kpi'},[h('div',{class:'num',id:'ck-attr',text:'0%'}),h('div',{text:'속성 증가(총)'})]);

    const grid=h('div',{class:'charm-grid'},[kpiManual,kpiBp,kpiAttr]);

    const row1=h('div',{class:'charm-row'},[
      h('label',{text:'현재'}), fromSel,
      h('label',{text:'→ 목표'}), toSel
    ]);

    const row2=h('div',{class:'charm-row class-group'},[
      h('span',{class:'class-pill',text:'기병'}), cavInp,
      h('span',{class:'class-pill',text:'보병'}), infInp,
      h('span',{class:'class-pill',text:'궁병'}), arcInp,
      fill9, clear, runBtn
    ]);

    const hint=h('div',{class:'gear-muted',text:'※ 비용은 현재→목표 업그레이드 구간 합 × (기병+보병+궁병 개수). 속성은 (목표% − 현재%) × 총 개수.'});

    const detailWrap=h('div',{class:'charm-details',style:'display:none'});
    const detailTable=h('table',{},[
      h('thead',{},h('tr',{},[
        h('th',{text:'레벨(도달)'}),
        h('th',{text:'필요 매뉴얼'}),
        h('th',{text:'필요 도면'}),
        h('th',{text:'해당 레벨 속성%'}),
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

    // 레벨 옵션 채우기
    const keys = keysOf(charm.steps);
    keys.forEach((label,idx)=>{
      fromSel.appendChild(h('option',{value:String(idx),text:label}));
      toSel.appendChild(h('option',{value:String(idx),text:label}));
    });
    fromSel.value='0';
    toSel.value=String(keys.length-1);

    // 단축 버튼
    fill9.addEventListener('click', ()=>{ cavInp.value=3; infInp.value=3; arcInp.value=3; });
    clear.addEventListener('click', ()=>{ cavInp.value=0; infInp.value=0; arcInp.value=0; });

    // 계산
    runBtn.addEventListener('click', ()=>{
      const fromIdx=parseInt(fromSel.value,10);
      const toIdx=parseInt(toSel.value,10);
      const cav=Math.max(0, parseInt(cavInp.value,10)||0);
      const inf=Math.max(0, parseInt(infInp.value,10)||0);
      const arc=Math.max(0, parseInt(arcInp.value,10)||0);
      const totalCount=cav+inf+arc;

      if (toIdx<=fromIdx){ alert('목표 레벨이 현재 레벨보다 높아야 합니다.'); return; }
      if (totalCount<=0){ alert('기병/보병/궁병 중 최소 1개 이상을 입력하세요.'); return; }

      const cost = sumUpgrade(charm.steps, keys, fromIdx, toIdx);
      const attrTo   = +charm.steps[keys[toIdx]].attr  || 0;
      const attrFrom = +charm.steps[keys[fromIdx]].attr|| 0;
      const attrDelta = (attrTo - attrFrom);

      const totalManual    = cost.manual    * totalCount;
      const totalBlueprint = cost.blueprint * totalCount;
      const totalAttr      = attrDelta      * totalCount;

      document.getElementById('ck-manual').textContent = fmt(totalManual);
      document.getElementById('ck-bp').textContent     = fmt(totalBlueprint);
      document.getElementById('ck-attr').textContent   = fmt(totalAttr) + '%';

      // 상세: 단일 보석 기준 단계별 비용 (참고용)
      const tb=document.getElementById('ck-tbody'); tb.innerHTML='';
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
    });
  }

  window.initCharmCalculator = initCharmCalculator;
})();

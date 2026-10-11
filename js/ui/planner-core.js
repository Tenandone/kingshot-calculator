(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KD_PLANNER_CORE=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
  // A separate, deterministic boundary. No legacy calculator input, buffs, or storage is mutated.
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
  const clone=v=>JSON.parse(JSON.stringify(v));
  const stepId=(entityId,key)=>entityId+'::'+key;
  const resourceKeys=model=>Array.isArray(model.resources)?model.resources.map(r=>r.key):Object.keys(model.resources||{});
  function normalizeState(model,input){
    input=input&&typeof input==='object'?input:{};
    const current=Object.create(null),entities=new Set((model.entities||[]).map(e=>e.id));
    for(const [id,key] of Object.entries(input.current||{}))if(entities.has(id)&&typeof key==='string')current[id]=key;
    const targets=(Array.isArray(input.targets)?input.targets:[]).filter(t=>t&&typeof t.entityId==='string'&&typeof t.levelKey==='string').map(t=>({entityId:t.entityId,levelKey:t.levelKey}));
    const history=(Array.isArray(input.history)?input.history:[]).filter(h=>h&&entities.has(h.entityId)&&typeof h.levelKey==='string'&&typeof h.completedAt==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(h.completedAt)&&Number.isFinite(Date.parse(h.completedAt))).map(h=>({entityId:h.entityId,levelKey:h.levelKey,completedAt:h.completedAt}));
    return{schemaVersion:1,modelVersion:model.version||model.id,name:String(input.name||'').slice(0,100),current,targets,history};
  }
  function makeIndex(model){
    const entities=new Map(),issues=[];
    for(const entity of model.entities||[]){
      if(!entity.id||entities.has(entity.id)||!['building','research'].includes(entity.type)){issues.push({code:'invalid_entity',entityId:entity.id});continue;}
      const rows=[...(entity.levels||[])].sort((a,b)=>a.order-b.order),byKey=new Map(),byOrder=new Map();
      for(const row of rows){
        if(typeof row.key!=='string'||!Number.isSafeInteger(row.order)||row.order<1||byKey.has(row.key)||byOrder.has(row.order))issues.push({code:'invalid_level',entityId:entity.id,levelKey:row.key});
        byKey.set(row.key,row);byOrder.set(row.order,row);
      }
      entities.set(entity.id,{...entity,rows,byKey,byOrder});
    }
    return{entities,issues};
  }
  function plan(model,input){
    const state=normalizeState(model,input),index=makeIndex(model),nodes=new Map(),done=new Set(),visiting=new Set(),sorted=[],blockers=[],warnings=[],required=new Set(),currentOrders=new Map(),currentInvalid=new Set(),targets=new Set();
    let dependencyFault=false,cycle=false,invalid=false;
    const addBlock=(code,entityId,levelKey,text)=>{const b={code,entityId,levelKey,text:String(text||'')};if(!blockers.some(x=>x.code===code&&x.entityId===entityId&&x.levelKey===levelKey&&x.text===b.text))blockers.push(b);};
    for(const problem of index.issues){invalid=true;addBlock(problem.code,problem.entityId,problem.levelKey);}
    function currentOrder(e){
      if(currentOrders.has(e.id))return currentOrders.get(e.id);
      let order=0;
      if(!own(state.current,e.id))required.add(e.id);
      else if(state.current[e.id]==='0')order=0;
      else if(e.byKey.has(state.current[e.id]))order=e.byKey.get(state.current[e.id]).order;
      else{currentInvalid.add(e.id);invalid=true;addBlock('invalid_current',e.id,state.current[e.id]);}
      currentOrders.set(e.id,order);return order;
    }
    function resolveDependency(dep,entityId,key){
      if(dep.status!=='resolved'||!dep.entityId||!dep.levelKey){dependencyFault=true;addBlock('unresolved_dependency',entityId,key,dep.text);return null;}
      const target=index.entities.get(dep.entityId),row=target?.byKey.get(dep.levelKey);
      if(!target||!row){dependencyFault=true;addBlock('missing_dependency_target',entityId,key,dep.text||dep.entityId);return null;}
      return{target,row};
    }
    function visit(e,row,depth){
      const curr=currentOrder(e);
      if(row.order<=curr)return null;
      const id=stepId(e.id,row.key);
      if(done.has(id))return id;
      if(visiting.has(id)){cycle=true;dependencyFault=true;addBlock('dependency_cycle',e.id,row.key);return id;}
      if(depth>1500||nodes.size>=12000){invalid=true;addBlock('graph_limit',e.id,row.key);return null;}
      visiting.add(id);
      const requirements=[],edges=[];
      const n={id,entityId:e.id,levelKey:row.key,order:row.order,label:row.label||row.key,type:e.type,title:e.title,route:e.route,reason:targets.has(id)?'target':'prerequisite',requirements,costs:clone(row.costs||{}),time:clone(row.time||{value:null,quality:'unknown'}),timeBasis:own(row.time,'timeBasis')?row.time.timeBasis:(row.timeBasis||'source_listed'),status:'ready',canComplete:false,currentConfirmed:own(state.current,e.id),unassignedCosts:!!row.unassignedCosts||!row.costs||typeof row.costs!=='object'||Array.isArray(row.costs),edges};nodes.set(id,n);
      const previousKey=own(row,'previousKey')?row.previousKey:(e.byOrder.get(row.order-1)?.key||null);
      const start=e.startsAtOrder||1;
      if(previousKey){
        const prev=e.byKey.get(previousKey);
        if(!prev||prev.order!==row.order-1){dependencyFault=true;addBlock('missing_previous_step',e.id,row.key,previousKey);}
        else{const d={entityId:e.id,levelKey:prev.key,text:e.title+' '+(prev.label||prev.key),status:'resolved'};requirements.push(d);const prevId=visit(e,prev,depth+1);if(prevId)edges.push(prevId);}
      }else if(row.order!==start&&curr<row.order-1){dependencyFault=true;addBlock('missing_previous_step',e.id,row.key);}
      if(row.dependenciesKnown!==true){dependencyFault=true;addBlock('unconfirmed_conditions',e.id,row.key);}
      for(const dep of row.dependencies||[]){
        if(!requirements.some(d=>dep.status==='resolved'?d.status==='resolved'&&d.entityId===dep.entityId&&d.levelKey===dep.levelKey:d.status===dep.status&&d.text===dep.text))requirements.push(clone(dep));
        const r=resolveDependency(dep,e.id,row.key);if(r){const depId=visit(r.target,r.row,depth+1);if(depId)edges.push(depId);}
      }
      n.edges=[...new Set(edges)];
      visiting.delete(id);done.add(id);sorted.push(id);return id;
    }
    for(const t of state.targets)targets.add(stepId(t.entityId,t.levelKey));
    if(state.targets.length>100){invalid=true;addBlock('too_many_targets');}
    for(const t of state.targets.slice(0,100)){
      const e=index.entities.get(t.entityId),row=e?.byKey.get(t.levelKey);
      if(!e||!row){invalid=true;addBlock('invalid_target',t.entityId,t.levelKey);continue;}
      const curr=currentOrder(e);
      if(row.order<curr){invalid=true;addBlock('target_below_current',e.id,row.key);continue;}
      visit(e,row,0);
    }
    for(const id of required)addBlock('current_state_required',id,null);
    // Unknown dependency closure or current state prevents a complete-plan total, even if all visited costs are numeric.
    const closureComplete=!dependencyFault&&!required.size&&!invalid&&!cycle;
    const blank=()=>({value:null,knownValue:0,quality:'exact',unknownSteps:[],approximateSteps:[],sourceTypes:[],timeBases:[]});
    const totals={resources:Object.fromEntries(resourceKeys(model).map(k=>[k,blank()])),constructionTime:blank(),researchTime:blank()};
    const validCell=(c,unit)=>c&&['exact','approx'].includes(c.quality)&&Number.isSafeInteger(c.value)&&c.value>=0&&c.unit===unit;
    function addCell(total,cell,n,unknown,unit){
      const q=cell?.quality,v=cell?.value;
      if(unknown||!validCell(cell,unit)){total.unknownSteps.push(n.id);return;}
      if(!Number.isSafeInteger(total.knownValue+v)){total.unknownSteps.push(n.id);addBlock('numeric_overflow',n.entityId,n.levelKey);return;}
      total.knownValue+=v;
      if(q==='approx')total.approximateSteps.push(n.id);
      if(cell.sourceType&&!total.sourceTypes.includes(cell.sourceType))total.sourceTypes.push(cell.sourceType);
    }
    for(const id of sorted){
      const n=nodes.get(id),row=index.entities.get(n.entityId).byKey.get(n.levelKey);
      for(const k of Object.keys(n.costs))if(!totals.resources[k])totals.resources[k]=blank();
      for(const [k,total] of Object.entries(totals.resources)){
        // Absence is not zero. Adapter must supply only applicable resources, plus explicit unknowns for omissions.
        if(own(n.costs,k))addCell(total,n.costs[k],n,n.unassignedCosts,'resource_unit');
        else if(n.unassignedCosts)total.unknownSteps.push(n.id);
      }
      const timeTotal=n.type==='building'?totals.constructionTime:totals.researchTime;addCell(timeTotal,n.time,n,false,'second');if(!timeTotal.timeBases.includes(n.timeBasis))timeTotal.timeBases.push(n.timeBasis);
      n.status=n.unassignedCosts||Object.values(n.costs).some(c=>!validCell(c,'resource_unit'))||!validCell(n.time,'second')?'partial':'ready';
      const relevant=blockers.filter(b=>b.entityId===n.entityId&&(!b.levelKey||b.levelKey===n.levelKey));
      if(relevant.length)n.status='blocked';
      const curr=currentOrders.get(n.entityId),predecessor=row.previousKey?index.entities.get(n.entityId).byKey.get(row.previousKey)?.order:row.order-(row.order===(index.entities.get(n.entityId).startsAtOrder||1)?row.order:1);
      n.canComplete=!invalid&&!cycle&&n.currentConfirmed&&row.dependenciesKnown===true&&!relevant.length&&n.status==='ready'&&(predecessor===0?curr===0:curr===predecessor)&&n.requirements.every(d=>{const e=index.entities.get(d.entityId),r=e?.byKey.get(d.levelKey);return d.status==='resolved'&&!!r&&own(state.current,d.entityId)&&currentOrder(e)>=r.order;});
    }
    let partial=false,approx=false;
    for(const total of [...Object.values(totals.resources),totals.constructionTime,totals.researchTime]){
      total.unknownSteps=[...new Set(total.unknownSteps)];
      total.quality=total.unknownSteps.length||!closureComplete?'partial':total.approximateSteps.length?'approx':'exact';
      total.value=total.quality==='partial'?null:total.knownValue;
      total.approximate=total.approximateSteps.length>0;
      partial ||= total.quality==='partial';approx ||= total.approximate;
    }
    const status=invalid?'invalid':cycle?'blocked':!state.targets.length?'empty':!sorted.length&&closureComplete?'complete':partial?'partial':approx?'approx':'exact';
    return{modelVersion:model.version||model.id,status,state,steps:sorted.map(id=>nodes.get(id)),totals,blockers,requiredStates:[...required],warnings,closureComplete,calculationPolicy:{buffs:false,parallelQueues:false,powerTotals:false,legacyCalculatorChanged:false}};
  }
  function completeStep(model,input,id){
    const p=plan(model,input),step=p.steps.find(s=>s.id===id);
    if(!step||!step.canComplete)return{ok:false,state:p.state,reason:!step?'step_not_pending':'requirements_not_complete'};
    const state=clone(p.state);state.current[step.entityId]=step.levelKey;return{ok:true,state,reason:null};
  }
  return{version:'1.0.0',normalizeState,plan,completeStep};
});

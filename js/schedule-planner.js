/* Independent progressive schedule UI. Never writes game data or legacy storage. */
(() => {'use strict';
 const root=document.querySelector('[data-schedule-planner]');if(!root)return;
 const locale=document.documentElement.lang,w=window.KSScheduleCopy?.[locale],engine=window.KS_SCHEDULE_ENGINE;
 const form=document.getElementById('schedule-form'),kingdom=document.getElementById('schedule-kingdom'),date=document.getElementById('schedule-date'),status=document.getElementById('schedule-status'),results=document.getElementById('schedule-results'),mode=document.getElementById('schedule-mode');
 if(!w||!engine)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dateFmt=new Intl.DateTimeFormat({ko:'ko-KR',en:'en-GB',ja:'ja-JP'}[locale],{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});
 const phaseName=id=>({'idle':w.waiting,'preparation':w.preparation,'battle':w.battle,'matchmaking':w.matchmaking,'pre-transfer':w.preTransfer,'invitational':w.invitational,'open-transfer':w.openTransfer}[id]||w.unavailable);
 const targetCopy={ko:{'next-preparation-start':'준비 시작까지','preparation-end':'준비 종료까지','battle-end':'전투 종료까지'},en:{'next-preparation-start':'Until preparation starts','preparation-end':'Until preparation ends','battle-end':'Until battle ends'},ja:{'next-preparation-start':'準備開始まで','preparation-end':'準備終了まで','battle-end':'戦闘終了まで'}}[locale];
 let rules=null,applied={kingdom:null,date:''},valid=true;
 function time(value,withTime=true){if(!value)return '';const d=new Date(value);if(!Number.isFinite(d.valueOf()))return '';return '<time datetime="'+esc(d.toISOString())+'">'+esc(dateFmt.format(d))+(withTime?' · '+esc(d.toISOString().slice(11,d.getUTCSeconds()?19:16)):'')+'</time>';}
 function remaining(value){if(!value)return '—';return value.days+w.days+' '+value.hours+w.hours+' '+value.minutes+w.minutes;}
 function table(title,rows){return '<div class="kx-scroll ks-schedule-phase" role="region" tabindex="0" aria-label="'+esc(title)+'"><table class="kx-table"><caption>'+esc(title)+'</caption><thead><tr><th scope="col">'+esc(w.phase)+'</th><th scope="col">'+esc(w.period)+'</th></tr></thead><tbody>'+rows.map(r=>'<tr><th scope="row">'+esc(phaseName(r.id))+'</th><td>'+time(r.startAt)+' – '+time(r.endAt)+'</td></tr>').join('')+'</tbody></table></div>';}
 function output(model){
  const k=model.kvk,t=model.transfer,cycle=['preparation','battle'].includes(k.phase)?k.currentCycle:k.nextCycle;
  const kRows=[{id:'matchmaking',startAt:cycle.matchmakingAt,endAt:cycle.preparationAt},{id:'preparation',startAt:cycle.preparationAt,endAt:cycle.battleAt},{id:'battle',startAt:cycle.battleAt,endAt:cycle.battleEndAt}];
  let html='<div class="ks-schedule-results"><section id="kvk"><span class="kx-badge">'+esc(w.estimated)+'</span><h2>'+esc(w.kvk)+'</h2><p class="ks-schedule-date">'+time(cycle.preparationAt,false)+'</p><dl><dt>'+esc(w.current)+'</dt><dd>'+esc(phaseName(k.phase))+'</dd><dt>'+esc(targetCopy[k.timer.target])+'</dt><dd>'+esc(remaining(k.timer.remaining))+'</dd></dl>'+table(w.calendar,kRows)+'</section>';
  const window=t.referenceWindow,isEstimate=t.status==='single-step-estimate';
  html+='<section id="transfer"><span class="kx-badge">'+esc(!window?w.unavailable:isEstimate?w.estimated:w.reference)+'</span><h2>'+esc(w.transfer)+'</h2>';
  if(window){html+='<p class="ks-schedule-date">'+time(window.startAt,false)+(window.endAt?' – '+time(new Date(Date.parse(window.endAt)-1000).toISOString(),false):'')+'</p><dl><dt>'+esc(w.current)+'</dt><dd>'+esc(phaseName(t.phase))+'</dd><dt>'+esc(t.currentWindow?w.until:w.next)+'</dt><dd>'+esc(remaining(t.remaining))+'</dd></dl>';}
  else html+='<p class="ks-schedule-date">'+esc(w.unavailable)+'</p><p>'+esc(w.unavailableNote)+'</p>';
  const g=t.group;let groupText=g.status==='select-kingdom'?w.noKingdom:g.status==='not-extended-to-prediction'?w.futureGroup:w.unknownGroup;
  if(g.range)groupText=esc(w.groupPrefix)+' '+g.groupId+' · K'+g.range.from+'–K'+g.range.to;
  else groupText=esc(groupText);
  html+='<div class="ks-schedule-group"><strong>'+esc(w.group)+'</strong>'+groupText+'</div>';
  if(g.range)html+='<p class="kx-muted">'+esc(w.groupNote)+'</p>';
  if(window?.endAt){const source=rules.transfer.windows.find(a=>a.id===window.id);let start=Date.parse(window.startAt);const rows=rules.transfer.phases.map(p=>{const end=Math.min(start+p.durationDays*86400000,Date.parse(window.endAt)),row={id:p.id,startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString()};start=end;return row;});html+=table(w.transferCalendar,rows);
   if(source?.groups?.length&&Date.parse(source.groupObservedAt)<=Date.parse(model.calculatedAt))html+='<details class="ks-schedule-rules"><summary>'+esc(w.allGroups)+'</summary><ul>'+source.groups.map(a=>'<li>'+esc(w.groupPrefix)+' '+a.id+' · K'+a.from+'–K'+a.to+'</li>').join('')+'</ul></details>';
  }
  html+='</section></div>';return html;
 }
 function paint(preserve=false){if(!rules||!valid)return;const now=applied.date?applied.date+'T00:00:00Z':new Date().toISOString();const result=engine.calculate(rules,{now,kingdom:applied.kingdom});if(!result.ok){status.textContent=w.error;status.classList.add('ks-schedule-error');results.innerHTML='';return;}
  // Timed updates preserve keyboard focus and each table's independent scroll.
  const focusable='summary,[tabindex],a,button',focused=preserve?[...results.querySelectorAll(focusable)].indexOf(document.activeElement):-1;
  const scroll=preserve?[...results.querySelectorAll('.kx-scroll')].map(el=>({left:el.scrollLeft,top:el.scrollTop})):[];
  const wasOpen=!!results.querySelector('details[open]');results.innerHTML=output(result);if(wasOpen){const details=results.querySelector('details');if(details)details.open=true;}
  if(preserve){[...results.querySelectorAll('.kx-scroll')].forEach((el,i)=>{if(scroll[i]){el.scrollLeft=scroll[i].left;el.scrollTop=scroll[i].top;}});if(focused>=0)results.querySelectorAll(focusable)[focused]?.focus({preventScroll:true});}
  mode.textContent=(applied.date?w.simulation:w.liveMode)+' · '+result.calculatedAt.slice(0,16).replace('T',' ')+' UTC';status.textContent='';status.classList.remove('ks-schedule-error');
 }
 function readInputs(){const k=kingdom.value.trim(),d=date.value;if((k&&!/^[1-9]\d{0,5}$/.test(k))||(d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d<date.min||d>date.max)))return null;return {kingdom:k?Number(k):null,date:d};}
 function apply(write,preserve=false){const input=readInputs();valid=!!input;if(!valid){status.textContent=w.error;status.classList.add('ks-schedule-error');results.innerHTML='';return;}applied=input;
  if(write){const u=new URL(location.href);input.kingdom?u.searchParams.set('kingdom',String(input.kingdom)):u.searchParams.delete('kingdom');input.date?u.searchParams.set('date',input.date):u.searchParams.delete('date');history.replaceState(history.state,'',u.pathname+u.search+u.hash);}
  paint(preserve);
 }
 function restore(preserve=false){const p=new URLSearchParams(location.search),k=p.get('kingdom')||'',d=p.get('date')||'';kingdom.value=k;date.value=d;if((k&&kingdom.value!==k)||(d&&date.value!==d)){valid=false;status.textContent=w.error;results.innerHTML='';return;}apply(false,preserve);}
 form.addEventListener('submit',e=>{e.preventDefault();apply(true);});
 document.getElementById('schedule-live').addEventListener('click',()=>{date.value='';apply(true);});
 window.addEventListener('popstate',()=>restore());window.addEventListener('pageshow',()=>{if(rules)restore(true);});document.addEventListener('visibilitychange',()=>{if(!document.hidden)paint(true);});
 fetch('/data/ui/external/schedule-rules.json?v='+encodeURIComponent(root.dataset.rulesRelease),{credentials:'omit',cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('schedule');return r.json();}).then(model=>{if(model.release!==root.dataset.rulesRelease||engine.validate(model,{now:new Date().toISOString(),kingdom:null}).errors.length)throw Error('version');rules=model;form.hidden=false;restore();if(['#kvk','#transfer'].includes(location.hash))requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView({block:'start'}));setInterval(()=>{if(!document.hidden)paint(true);},60000);}).catch(()=>{status.textContent=w.loadError;status.classList.add('ks-schedule-error');});
})();

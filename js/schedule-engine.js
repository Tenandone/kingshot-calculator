/* Independent UTC schedule model. Community predictions are not game confirmations. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KS_SCHEDULE_ENGINE=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const DAY=86400000,HOUR=3600000;
 function instant(value){
  if(value instanceof Date){if(!Number.isFinite(value.valueOf()))return null;value=value.toISOString();}
  if(typeof value==='number')return Number.isSafeInteger(value)&&Number.isFinite(new Date(value).valueOf())?value:null;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
  const day=value.slice(0,10),d=new Date(day+'T00:00:00Z');
  if(!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==day)return null;
  const time=value.slice(11).split(/[Z+-]/)[0].split(':');
  if(Number(time[0])>23||Number(time[1])>59||Number(time[2])>=60)return null;
  const offset=value.match(/[+-](\d{2}):(\d{2})$/);if(offset&&(Number(offset[1])>14||Number(offset[2])>59||(Number(offset[1])===14&&Number(offset[2])!==0)))return null;
  const epoch=Date.parse(value);return Number.isFinite(epoch)?epoch:null;
 }
 const iso=n=>new Date(n).toISOString();
 const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
 function validate(rules,options){
  const errors=[],add=(code,path)=>errors.push({code,path});let now=null,kingdom=null;
  if(!options||typeof options!=='object')add('invalid-options','options');
  else{try{now=instant(options.now);}catch{now=null;}if(now===null)add('invalid-now','options.now');kingdom=options.kingdom??null;if(kingdom!==null&&!integer(kingdom,1,1000000))add('invalid-kingdom','options.kingdom');}
  if(!rules||typeof rules!=='object')return {errors:[...errors,{code:'invalid-rules',path:'rules'}],now,kingdom};
  if(rules.schemaVersion!==1)add('unsupported-schema','rules.schemaVersion');
  if(rules.timezone!=='UTC'||rules.phaseIntervals!=='half-open')add('unsupported-time-contract','rules');
  const k=rules.kvk,t=rules.transfer;
  if(!k||instant(k.anchor)===null||!integer(k.periodDays,3,365)||!integer(k.baseEventNumber,1,1000000)||!integer(k.matchingLeadDays,0,30)||!integer(k.preparationHours,1,8760)||!integer(k.battleHours,1,8760))add('invalid-kvk-rule','rules.kvk');
  else if((k.preparationHours+k.battleHours+k.matchingLeadDays*24)>=k.periodDays*24)add('overlapping-kvk-phases','rules.kvk');
  if(!t||!Array.isArray(t.phases)||t.phases.length!==3||!integer(t.fallbackDays,8,365)||t.fallbackMaxOccurrences!==1||!Array.isArray(t.windows)||!t.windows.length){add('invalid-transfer-rule','rules.transfer');return {errors,now,kingdom};}
  const phaseIds=['pre-transfer','invitational','open-transfer'];
  if(t.phases.some((p,i)=>!p||p.id!==phaseIds[i]||!integer(p.durationDays,1,30)))add('invalid-transfer-phases','rules.transfer.phases');
  const duration=t.phases.reduce((s,p)=>s+(Number(p?.durationDays)||0)*DAY,0),ids=new Set(),windows=[];
  if(t.fallbackDays*DAY<=duration)add('invalid-fallback-period','rules.transfer.fallbackDays');
  t.windows.forEach((w,i)=>{
   const key='rules.transfer.windows['+i+']';
   if(!w||typeof w.id!=='string'||ids.has(w.id)){add('invalid-window-id',key+'.id');return;}ids.add(w.id);
   const start=instant(w.startAt),end=instant(w.endAt);
   if(start===null||end===null||end<=start||end-start>duration){add('invalid-window-range',key);return;}
   if(w.sourceEndAt!==undefined&&(instant(w.sourceEndAt)===null||end-instant(w.sourceEndAt)!==1000||w.endNormalization!=='inclusive-second-to-exclusive'))add('invalid-end-normalization',key+'.endAt');
   if(!Array.isArray(w.groups)){add('invalid-groups',key+'.groups');return;}
   const sorted=[...w.groups].sort((a,b)=>a.from-b.from),groupIds=new Set();
   sorted.forEach((g,j)=>{if(!g||!integer(g.id,1,1000000)||groupIds.has(g.id)||!integer(g.from,1,1000000)||!integer(g.to,g.from,1000000)||(j&&sorted[j-1].to>=g.from))add('invalid-group-range',key+'.groups['+j+']');groupIds.add(g?.id);});
   if(w.groups.length&&instant(w.groupObservedAt)===null)add('invalid-group-observation',key+'.groupObservedAt');
   windows.push({rule:w,start,end});
  });
  windows.sort((a,b)=>a.start-b.start);
  for(let i=1;i<windows.length;i++)if(windows[i].start<windows[i-1].end)add('overlapping-windows','rules.transfer.windows');
  return {errors,now,kingdom,windows};
 }
 function timeLeft(ms){
  const value=Math.max(0,ms),seconds=Math.floor(value/1000);
  return {milliseconds:value,days:Math.floor(seconds/86400),hours:Math.floor(seconds%86400/3600),minutes:Math.floor(seconds%3600/60),seconds:seconds%60};
 }
 function phase(id,start,end,now,eventNumber){return {id,startAt:iso(start),endAt:iso(end),startsInMs:Math.max(0,start-now),durationMs:end-start,remainingMs:Math.max(0,end-now),eventNumber:eventNumber>0?eventNumber:null};}
 function kvkResult(rule,now){
  const anchor=instant(rule.anchor),period=rule.periodDays*DAY,index=Math.floor((now-anchor)/period),start=anchor+index*period,end=start+period;
  const prepEnd=start+rule.preparationHours*HOUR,battleEnd=prepEnd+rule.battleHours*HOUR,matching=end-rule.matchingLeadDays*DAY,event=rule.baseEventNumber+index;
  let current,next,timerState,timerTarget,timerMeaning;
  if(now<prepEnd){current=phase('preparation',start,prepEnd,now,event);next=phase('battle',prepEnd,battleEnd,now,event);timerState='preparation';timerTarget=prepEnd;timerMeaning='preparation-end';}
  else if(now<battleEnd){current=phase('battle',prepEnd,battleEnd,now,event);next=phase('matchmaking',matching,end,now,event+1);timerState='battle';timerTarget=battleEnd;timerMeaning='battle-end';}
  else{timerState='countdown';timerTarget=end;timerMeaning='next-preparation-start';
   if(now>=matching){current=phase('matchmaking',matching,end,now,event+1);next=phase('preparation',end,end+rule.preparationHours*HOUR,now,event+1);}
   else{current=phase('idle',battleEnd,matching,now,event);next=phase('matchmaking',matching,end,now,event+1);}
  }
  return {status:'predicted-cycle',assurance:'community-prediction',phase:current.id,currentPhase:current,nextPhase:next,eventNumber:current.eventNumber,
   currentCycle:{preparationAt:iso(start),matchmakingAt:iso(start-rule.matchingLeadDays*DAY),battleAt:iso(prepEnd),battleEndAt:iso(battleEnd),eventNumber:event>0?event:null},
   nextCycle:{preparationAt:iso(end),matchmakingAt:iso(matching),battleAt:iso(end+rule.preparationHours*HOUR),battleEndAt:iso(end+(rule.preparationHours+rule.battleHours)*HOUR),eventNumber:event+1>0?event+1:null},
   timer:{state:timerState,target:timerMeaning,targetAt:iso(timerTarget),remaining:timeLeft(timerTarget-now)},remainingMs:timerTarget-now,
   kingdomChangesDates:false,eligibility:'unknown',officiallyConfirmed:false};
 }
 function windowView(w,status){return {id:w.rule.id,startAt:iso(w.start),endAt:iso(w.end),status:status||'community-provisional',officiallyConfirmed:false};}
 function groupFor(w,kingdom,now,estimated){
  if(estimated)return {status:'not-extended-to-prediction',kingdom,range:null,groupId:null,windowStartAt:null,validUntil:null};
  if(!w)return {status:'unavailable',kingdom,range:null,groupId:null,windowStartAt:null,validUntil:null};
  const base={kingdom,range:null,groupId:null,windowStartAt:iso(w.start),validUntil:iso(w.end),observedAt:w.rule.groupObservedAt||null};
  if(now>=w.end)return {...base,status:'expired-reference'};
  if(!w.rule.groups.length)return {...base,status:'no-group-data'};
  if(instant(w.rule.groupObservedAt)>now)return {...base,status:'not-yet-observed-at-simulated-date'};
  if(kingdom===null)return {...base,status:'select-kingdom'};
  const group=w.rule.groups.find(g=>kingdom>=g.from&&kingdom<=g.to);
  return group?{...base,status:'provisional-match',range:{from:group.from,to:group.to},groupId:group.id,eligibilityGuaranteed:false}:{...base,status:'outside-listed-groups'};
 }
 function transferResult(rule,windows,now,kingdom){
  const current=windows.find(w=>now>=w.start&&now<w.end),upcoming=windows.find(w=>w.start>now),latest=windows[windows.length-1];
  const fallback=latest.start+rule.fallbackDays*DAY;
  const predicted=!upcoming&&!current&&now<fallback;
  const next=upcoming?windowView(upcoming):predicted?{id:null,startAt:iso(fallback),endAt:null,status:'single-step-estimate',officiallyConfirmed:false}:null;
  let currentPhase=null,nextPhase=null,status='unavailable',remainingMs=null;
  if(current){
   let begin=current.start;
   for(const p of rule.phases){const finish=Math.min(begin+p.durationDays*DAY,current.end);if(now>=begin&&now<finish){currentPhase=phase(p.id,begin,finish,now,windows.indexOf(current)+1);break;}begin=finish;}
   status='listed-window-active';remainingMs=currentPhase.remainingMs;
   const pos=rule.phases.findIndex(p=>p.id===currentPhase.id),p=rule.phases[pos+1];
   if(p&&Date.parse(currentPhase.endAt)<current.end)nextPhase=phase(p.id,Date.parse(currentPhase.endAt),Math.min(Date.parse(currentPhase.endAt)+p.durationDays*DAY,current.end),now,windows.indexOf(current)+1);
   else if(upcoming)nextPhase=phase(rule.phases[0].id,upcoming.start,Math.min(upcoming.start+rule.phases[0].durationDays*DAY,upcoming.end),now,windows.indexOf(upcoming)+1);
  }else if(next){status=predicted?'single-step-estimate':'listed-window-upcoming';remainingMs=Date.parse(next.startAt)-now;}
  return {status,assurance:'community-prediction',phase:currentPhase?.id||'idle',currentPhase,nextPhase,currentWindow:current?windowView(current):null,nextWindow:next,
   referenceWindow:current?windowView(current):next,remainingMs,remaining:remainingMs===null?null:timeLeft(remainingMs),
   group:groupFor(current||upcoming||latest,kingdom,now,predicted),kingdomChangesDates:false,officiallyConfirmed:false,
   limitation:status==='unavailable'?'no-future-listed-window-or-remaining-single-estimate':predicted?'56-day-site-heuristic-not-confirmed-recurrence':null};
 }
 function calculate(rules,options){
  let v;try{v=validate(rules,options);}catch{return {ok:false,errors:[{code:'invalid-rules',path:'rules'}]};}
  if(v.errors.length)return {ok:false,errors:v.errors};
  try{return {ok:true,calculatedAt:iso(v.now),timezone:'UTC',assurance:'community-prediction',kingdom:v.kingdom,kvk:kvkResult(rules.kvk,v.now),transfer:transferResult(rules.transfer,v.windows,v.now,v.kingdom)};}
  catch{return {ok:false,errors:[{code:'date-out-of-range',path:'options.now'}]};}
 }
 return {calculate,validate,parseInstant:instant,timeLeft};
});

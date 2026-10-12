'use strict';
// Regenerates only the three new schedule reference pages from the reviewed model.
const fs=require('node:fs'),path=require('node:path');
const {page,esc}=require('./page.cjs');
const root=path.resolve(__dirname,'../..');
const model=JSON.parse(fs.readFileSync(path.join(root,'data/ui/external/schedules.json'),'utf8'));
const copy={
 ko:{title:'KvK·왕국 이민 일정',description:'KvK와 왕국 이민의 참고 날짜, 서버별 적용 조건과 단계별 진행 시간을 확인하세요.',lead:'참고 날짜와 단계별 진행 순서를 한곳에서 확인하세요. 실제 일정은 게임 내 이벤트 달력이 기준입니다.',reference:'참고 일정',cycle:'참고 주기 · 서버별 차이 있음',provisional:'잠정 일정 · 게임 내 확인 필요',unknown:'현재 확인된 확정 일정은 없습니다. 아래 단계별 진행 규칙을 참고하고 게임 내 일정을 확인하세요.',kvkScope:'아래 날짜는 2026년 10월 12일을 1주차 월요일로 놓은 주기 예시입니다. 왕국 생성 시점과 진행 상황에 따라 달라집니다.',transferScope:'아래 기간과 왕국 그룹은 참고용 잠정안입니다. 참여 가능 여부와 최종 그룹은 게임 내에서 확인하세요. 시작 시각은 확인되지 않았습니다.',phase:'단계',dates:'참고 날짜',rule:'진행 규칙',next:'예정',details:'단계별 진행',matchmaking:'매칭',preparation:'준비',battle:'전투',castle:'성 전투',triage:'전장 치료',preTransfer:'이민 준비',invitational:'초청 이민',openTransfer:'자유 이민',twoDays:'2일',prepRule:'월요일부터 준비. 금요일·토요일은 토요일 10:00 UTC까지 이어집니다.',battleRule:'토요일 10:00–22:00 UTC',castleRule:'토요일 12:00 UTC 시작, 최대 17:00 UTC까지',triageRule:'전투 후 22:00 UTC 시작 · 2일 2시간',transfer1:'일요일–화요일 · 3일',transfer2:'수요일–목요일 · 2일',transfer3:'금요일–토요일 · 2일',timeCaution:'이민 단계의 정확한 시작 시각은 게임 내에서 확인하세요.',groups:'참고 왕국 그룹',group:'그룹',kingdoms:'왕국 범위',links:'관련 가이드',kvkGuide:'최강 왕국 준비 가이드',transferGuide:'왕국 이민 가이드',utc:'UTC 날짜 기준의 참고 주기이며, 카운트다운을 제공하지 않습니다.',fresh:'새 일정이 확인되기 전에는 지난 날짜를 자동으로 연장하지 않습니다.'},
 en:{title:'KvK & Kingdom Transfer schedule',description:'Check reference dates, kingdom scope and phase timing for KvK and Kingdom Transfer.',lead:'Reference dates and event phases in one place. The in-game calendar determines your kingdom’s actual schedule.',reference:'Reference schedule',cycle:'Reference cycle · varies by kingdom',provisional:'Provisional · confirm in game',unknown:'No confirmed upcoming schedule is available here. Use the phase guide below and check your in-game calendar.',kvkScope:'These dates use 12 October 2026 as Week 1, Monday. Your kingdom’s age and progress can shift the cycle.',transferScope:'The dates and kingdom groups below are provisional reference information. Confirm eligibility and final groups in game. The start time is not confirmed.',phase:'Phase',dates:'Reference dates',rule:'Timing',next:'Upcoming',details:'Event phases',matchmaking:'Matchmaking',preparation:'Preparation',battle:'Battle',castle:'Castle battle',triage:'Field triage',preTransfer:'Pre-transfer',invitational:'Invitational transfer',openTransfer:'Open transfer',twoDays:'2 days',prepRule:'Preparation starts Monday. Friday and Saturday activities continue until Saturday 10:00 UTC.',battleRule:'Saturday, 10:00–22:00 UTC',castleRule:'Saturday, 12:00 UTC; may last until 17:00 UTC',triageRule:'After battle at 22:00 UTC · 2 days 2 hours',transfer1:'Sunday–Tuesday · 3 days',transfer2:'Wednesday–Thursday · 2 days',transfer3:'Friday–Saturday · 2 days',timeCaution:'Check the precise transfer phase start times in game.',groups:'Reference kingdom groups',group:'Group',kingdoms:'Kingdom range',links:'Related guides',kvkGuide:'Kingdom of Power preparation',transferGuide:'Kingdom Transfer guide',utc:'The reference cycle uses UTC calendar dates. No countdown is provided.',fresh:'Past dates are not extended automatically while awaiting a new schedule.'},
 ja:{title:'KvK・王国移民の日程',description:'KvKと王国移民の参考日程、王国ごとの適用条件、各段階の進行時間を確認できます。',lead:'参考日程と各段階の流れをまとめています。実際の日程はゲーム内のイベントカレンダーで確認してください。',reference:'参考日程',cycle:'参考周期・王国により異なります',provisional:'暫定日程・ゲーム内で要確認',unknown:'現時点で確定した次回日程は掲載していません。以下の段階別情報とゲーム内カレンダーを確認してください。',kvkScope:'以下は2026年10月12日を第1週の月曜日とした周期例です。王国の開設時期や進行状況により異なります。',transferScope:'以下の期間と王国グループは暫定的な参考情報です。参加条件と最終グループはゲーム内で確認してください。開始時刻は未確認です。',phase:'段階',dates:'参考日程',rule:'進行時間',next:'予定',details:'段階別の流れ',matchmaking:'マッチング',preparation:'準備',battle:'戦闘',castle:'城戦',triage:'戦場治療',preTransfer:'移民準備',invitational:'招待移民',openTransfer:'自由移民',twoDays:'2日間',prepRule:'月曜日から準備。金曜・土曜の内容は土曜日10:00 UTCまで続きます。',battleRule:'土曜日 10:00–22:00 UTC',castleRule:'土曜日12:00 UTC開始、最大17:00 UTCまで',triageRule:'戦闘後22:00 UTC開始・2日2時間',transfer1:'日曜日〜火曜日・3日間',transfer2:'水曜日〜木曜日・2日間',transfer3:'金曜日〜土曜日・2日間',timeCaution:'移民各段階の正確な開始時刻はゲーム内で確認してください。',groups:'参考王国グループ',group:'グループ',kingdoms:'王国範囲',links:'関連ガイド',kvkGuide:'最強王国の準備ガイド',transferGuide:'王国移民ガイド',utc:'UTCの日付を基準にした参考周期です。カウントダウンは表示しません。',fresh:'新しい日程を確認するまで、過去の日付を自動で延長しません。'}
};
function range(start,end,l){
 const fmt=new Intl.DateTimeFormat({ko:'ko-KR',en:'en-US',ja:'ja-JP'}[l],{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});
 const one=d=>'<time datetime="'+esc(d)+'">'+esc(fmt.format(new Date(d+'T00:00:00Z')))+'</time>';
 return one(start)+(end!==start?' – '+one(end):'');
}
function table(caption,headers,rows){return '<div class="kx-scroll" role="region" aria-label="'+esc(caption)+'" tabindex="0"><table class="kx-table"><caption>'+esc(caption)+'</caption><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map((v,i)=>i?'<td class="kx-text">'+v+'</td>':'<th scope="row">'+v+'</th>').join('')+'</tr>').join('')+'</tbody></table></div>';}
function reference(event,l,w){
 const n=event.next,id=event.id.includes('transfer')?'transfer':'kvk',fallback='schedule-unavailable-'+id;
 const attrs=' data-schedule-reference data-status="'+esc(n.status)+'" data-start="'+n.startDate+'" data-end="'+n.endDateInclusive+'" data-observed="'+n.sourceObservedAt+'" data-review="'+n.reviewBy+'" data-fallback="'+fallback+'" hidden';
 let body='<p><span class="kx-badge">'+(id==='kvk'?w.cycle:w.provisional)+'</span></p><p>'+esc(id==='kvk'?w.kvkScope:w.transferScope)+'</p>';
 if(id==='kvk'){
  const names={matchmaking:w.matchmaking,preparation:w.preparation,'castle-battle':w.castle};
  body+=table(w.reference,[w.phase,w.dates],n.stages.map(s=>[esc(names[s.id]),range(s.startDate,s.endDateInclusive,l)]))+'<p class="kx-muted">'+esc(w.utc)+'</p>';
 }else{
  body+='<p><strong>'+range(n.startDate,n.endDateInclusive,l)+'</strong></p><details class="kx-tech"><summary>'+esc(w.groups)+'</summary>'+table(w.groups,[w.group,w.kingdoms],n.kingdomGroups.map(g=>[String(g.group),'K'+g.kingdomFrom+'–K'+g.kingdomTo]))+'</details>';
 }
 return '<p id="'+fallback+'" class="kx-note">'+esc(w.unknown)+'</p><div'+attrs+'>'+body+'</div>';
}
const changed=[];
for(const l of model.locales){
 const w=copy[l];if(!w)throw Error('Unexpected locale '+l);
 const kvk=model.events.find(e=>e.id==='ks:event:kingdom-of-power'),transfer=model.events.find(e=>e.id==='ks:event:kingdom-transfer-event');
 const body='<header class="kx-intro"><h1>'+esc(w.title)+'</h1><p>'+esc(w.lead)+'</p><nav class="kx-links"><a href="#kvk">'+esc(kvk.names[l])+'</a><a href="#transfer">'+esc(transfer.names[l])+'</a></nav></header>'+
 '<section id="kvk" class="kx-stage"><h2>'+esc(kvk.names[l])+' · KvK</h2>'+reference(kvk,l,w)+table(w.details,[w.phase,w.rule],[[w.matchmaking,w.twoDays],[w.preparation,w.prepRule],[w.battle,w.battleRule],[w.castle,w.castleRule],[w.triage,w.triageRule]].map(r=>r.map(esc)))+'</section>'+
 '<section id="transfer" class="kx-stage"><h2>'+esc(transfer.names[l])+'</h2>'+reference(transfer,l,w)+table(w.details,[w.phase,w.rule],[[w.preTransfer,w.transfer1],[w.invitational,w.transfer2],[w.openTransfer,w.transfer3]].map(r=>r.map(esc)))+'<p class="kx-muted">'+esc(w.timeCaution)+'</p></section>'+
 '<p class="kx-muted">'+esc(w.fresh)+'</p><nav class="kx-links" aria-label="'+esc(w.links)+'"><a href="/'+l+'/guides/kingdom-of-power-prep.html">'+esc(w.kvkGuide)+'</a><a href="/'+l+'/guides/transfer.html">'+esc(w.transferGuide)+'</a></nav>';
 const route='/'+l+'/events/calendar/',file=path.join(root,route,'index.html');
 const html=page({locale:l,path:route,title:w.title+' | KingShotData',description:w.description,body,entityId:'ks:events:calendar',extraScripts:['/js/schedule-reference.js?v=ks-ui15-20261012']});
 fs.mkdirSync(path.dirname(file),{recursive:true});if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==html){fs.writeFileSync(file,html);changed.push(path.relative(root,file).replaceAll('\\','/'));}
}
console.log(JSON.stringify({pages:model.locales.length,changed}));

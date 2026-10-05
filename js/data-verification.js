(function(root){
 'use strict';
 const messages={
  ko:['데이터 검증 상태: 일부 확인','이 페이지의 수치·효과·획득 조건은 전체 검증이 완료되지 않았습니다. 별도로 확인 표시가 없는 값은 검증되지 않은 참고값입니다. 미검증 핵심 데이터를 사용하는 계산은 차단됩니다. 자료를 참고할 때는 현재 게임 화면을 확인하세요.'],
  en:['Data verification: partial','Values, effects and unlock conditions on this page have not all been verified. Unless explicitly marked as checked, values are unverified references. Calculations requiring unverified core data are blocked. Check the current game when consulting reference data.'],
  ja:['データ検証：一部確認済み','このページの数値・効果・解放条件は全件検証されていません。確認済みと明記していない値は未検証の参考値です。未検証の主要データを使う計算は停止しています。参考資料は現在のゲーム画面で確認してください。'],
  'zh-tw':['資料驗證：部分完成','本頁數值、效果及解鎖條件尚未全部驗證。未明確標示已確認的數值均為未驗證參考資料。使用未驗證核心資料的計算已停用。參考資料請核對目前遊戲畫面。']
 };
 const verifiedScope={
  ko:{gear:'확인 범위(2026-10-06): 영주 장비 58단계의 비단·금사·스케치 비용과 보석 1–22레벨의 재료·누적 속성을 공식 위키 표와 대조했습니다. 장비 평점과 이벤트 점수는 이 검증에 포함되지 않습니다.',building:'확인 범위(2026-10-06): 일반 건물 8종의 Lv.1–30 자원 표와 도시센터 Lv.2–30 기본 시간을 대조했습니다. 원문이 비어 있는 비용, 아카데미 Lv.12 나무의 원문 단위 오기, 선행 조건, TG 단계·전쟁아카데미 비용은 확인이 남아 있습니다.',pet:'확인 범위(2026-10-06): 회색늑대·스라소니·치타·사자·거대코뿔소를 기준으로 5개 등급의 먹이·돌파 재료 표를 대조했습니다. 다른 펫의 동일 표 적용 여부와 스킬·해금 시점은 별도 확인이 필요합니다.'},
  en:{gear:'Checked 2026-10-06: material costs for 58 governor gear stages and costs/cumulative attributes for charm levels 1–22 match the official Wiki tables. Gear scores and event points are outside this verification.',building:'Checked 2026-10-06: ordinary level 1–30 resource tables for eight buildings and Town Center level 2–30 base times. Blank source costs, a malformed Academy level 12 wood unit, prerequisites, Truegold stages and War Academy costs still need confirmation.',pet:'Checked 2026-10-06: food and breakthrough costs for five rarity tables using Gray Wolf, Lynx, Cheetah, Lion and Giant Rhino. Applying the same tables to other pets, skills and unlock timing need separate confirmation.'},
  ja:{gear:'2026-10-06確認：領主装備58段階の素材費用と宝石Lv.1–22の素材・累計属性を公式Wiki表と照合しました。装備評点とイベントポイントは対象外です。',building:'2026-10-06確認：通常建物8種のLv.1–30資源表と都市センターLv.2–30基本時間を照合しました。原文の空欄費用、学院Lv.12の木材単位誤記、前提条件、TG段階・戦争学院費用は未確認です。',pet:'2026-10-06確認：灰色狼・オオヤマネコ・チーター・ライオン・巨大サイを基準に5等級の餌と突破素材表を照合しました。他のペットへの同表適用・スキル・解放時期は別途確認が必要です。'},
  'zh-tw':{gear:'2026-10-06核對：領主裝備58階段材料需求，以及寶石1–22級材料與累計屬性已與官方Wiki表核對。裝備評分和活動分數不在本次驗證範圍。',building:'2026-10-06核對：8種一般建築Lv.1–30資源表與市政廳Lv.2–30基本時間。原文空白費用、學院Lv.12木材單位誤植、前置條件、TG階段及戰爭學院費用仍待確認。',pet:'2026-10-06核對：以灰狼、猞猁、獵豹、獅子、巨型犀牛核對5種稀有度的飼料與突破材料表。其他寵物是否適用同表、技能及解鎖時點仍需另外確認。'}
 };
 function html(pathname){
  const p=pathname.replace(/^\/(en|ko|ja|zh-tw)(?=\/)/,'');
  if(!/^\/(hero(?:es)?|buildings?|research|waracademy|pet|masters?|items?|events?|calc-(?:building|charm|gear|hero-gear|pet|training))(?:\/|$)/.test(p)&&!/governor-(?:gear|charm)|hero-gear|mastery/.test(p))return '';
  const lang=pathname.match(/^\/(en|ja|zh-tw)\//)?.[1]||'ko',m=messages[lang];
  const paused=/^\/calc-(building|hero-gear|training)(?:\/|$)/.test(p);
  const pausedCopy={ko:'현재 이 계산기는 핵심 수치 검증을 위해 계산과 새 결과 저장을 중단했습니다. 기존 저장값은 저장 당시의 기록입니다.',en:'Calculation and saving new results are paused pending core data verification. Existing saved results are historical snapshots.',ja:'主要データの検証のため計算と新しい結果の保存を停止しています。保存済みの結果は保存時点の記録です。','zh-tw':'核心資料驗證期間暫停計算及儲存新結果。既有儲存結果為當時的紀錄。'};
  const scope=/governor-(gear|charm)|\/calc-(gear|charm)/.test(p)?'gear':/\/buildings|\/calc-building/.test(p)?'building':/\/pet|\/calc-pet/.test(p)?'pet':null;
  const source=scope==='gear'?'https://kingshotwiki.com/governor-gear/governor-gear/':scope==='building'?'https://kingshotwiki.com/buildings/town-center/':'https://kingshotwiki.com/pets/gray-wolf/';
  return '<aside data-verification-note style="max-width:1100px;margin:16px auto;padding:14px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;color:#334155"><strong>'+m[0]+'</strong><p style="margin:6px 0 0">'+m[1]+'</p>'+(paused?'<p><strong>'+pausedCopy[lang]+'</strong></p>':'')+(scope?'<p>'+verifiedScope[lang][scope]+' <a href="'+source+'">Kingshot Official Wiki</a></p>':'')+'</aside>';
 }
 if(typeof module==='object'&&module.exports){module.exports={html};return;}
 function start(){const markup=html(location.pathname);if(!markup)return;const main=document.getElementById('content')||document.querySelector('main')||document.body;if(!main)return;document.querySelectorAll('[data-verification-note]').forEach(n=>n.remove());main.insertAdjacentHTML('afterbegin',markup);}
 document.addEventListener('DOMContentLoaded',start,{once:true});root.addEventListener('kd:page-ready',start);
})(typeof window==='undefined'?{}:window);

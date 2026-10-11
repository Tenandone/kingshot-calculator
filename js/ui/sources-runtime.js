(function(root,factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root){root.KD_UI_SOURCES=api;api.boot(root);}})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var policyVersion='source-centralization-v1';
  var sourceClasses=['research-sources','item-sources','event-sources'];
  var sourceHeadings=['출처','자료 출처','참고 자료','Sources','References','情報源','出典','参考資料','來源','資料來源'];
  var providerHosts=['kingshotwiki.com','kingshot.wiki','hunteronewiki.github.io','kingshotdata.com','ks-toolkit.com','gamedatabook.com','kingshotoptimizer.com','kingshot.net','kingshotalmanach.com','centurygames.helpshift.com'];
  var providerNames=/^(?:Kingshot(?: Official)? Wiki|Kingshot Database|KingShot Data Toolkit|GameDataBook|Kingshot Optimizer|Kingshot\.net|Kingshot Almanach|Century Games Support)$/i;
  var legalWords=/(?:copyright|licen[cs]e|licensed|attribution required|CC[ -]BY|©|저작권|라이선스|표시 의무|著作権|ライセンス|版權|授權)/i;
  var comparisonValues={
    '외부 데이터베이스 비교 범위':'이름, 분류, 최대 레벨',
    'External database comparison scope':'Name, branch, and maximum level',
    '外部データベースの比較範囲':'名称、分類、最大レベル',
    '外部資料庫比較範圍':'名稱、分類、最高等級'
  };
  var referenceDateLabels=['참고 출처 검토일','Reference review date','参考資料の確認日','參考來源查閱日期'];
  var norm=function(v){return String(v||'').replace(/\s+/g,' ').trim();};
  var esc=function(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');};
  function pageKind(url){var p;try{p=new URL(url||'/', 'https://kingshotdata.kr').pathname;}catch(_){p='/';}if(/\/(?:privacy|terms)(?:\/|\.html|$)/i.test(p))return 'legal';if(/\/(?:about)(?:\/|\.html|$)/i.test(p))return 'about';return 'content';}
  function locale(url,declared){var p=String(url||'');if(/\/(?:zh-tw|tw)\//i.test(p)||/^zh/i.test(declared||''))return 'zh-TW';var m=p.match(/\/(ko|en|ja)\//);return m?m[1]:/^(ko|en|ja)$/.test(declared||'')?declared:'ko';}
  function isProvider(href){try{var u=new URL(href);return /^https?:$/.test(u.protocol)&&providerHosts.indexOf(u.hostname.replace(/^www\./,''))!==-1;}catch(_){return false;}}
  function plan(document,ops,url){
    var removals=[],exceptions=[],suspected=[],kind=pageKind(url),elements=ops.all(document);
    if(kind==='legal'||kind==='about')return {removals:removals,exceptions:[{node:null,reason:kind==='legal'?'legal-page-preserved':'about-central-source-policy-preserved'}],suspected:suspected};
    function parentWith(n,test){for(var p=ops.parent(n);p;p=ops.parent(p))if(test(p))return p;return null;}
    function classes(n){return (ops.attr(n,'class')||'').split(/\s+/);}
    function tag(n){return ops.tag(n);}
    function forbidden(n){return ['script','style','template','head'].indexOf(tag(n))!==-1||!!parentWith(n,function(p){return ['script','style','template','head'].indexOf(tag(p))!==-1;});}
    function legal(n){
      if(legalWords.test(ops.text(n)))return true;
      if(ops.attr(n,'data-license')!==null||ops.attr(n,'data-attribution-required')!==null)return true;
      var box=parentWith(n,function(p){return ['figure','figcaption','footer','section'].indexOf(tag(p))!==-1||ops.attr(p,'data-license')!==null||ops.attr(p,'data-attribution-required')!==null;});
      return !!box&&(legalWords.test(ops.text(box))||ops.attr(box,'data-license')!==null||ops.attr(box,'data-attribution-required')!==null);
    }
    function remove(n,reason){if(!n||forbidden(n))return;if(legal(n)){exceptions.push({node:n,reason:'legal-or-license-attribution-preserved'});return;}if(!removals.some(function(x){return x.node===n;}))removals.push({node:n,reason:reason});}
    function citationList(n){
      if(['ul','ol'].indexOf(tag(n))===-1)return false;
      var anchors=ops.all(n).filter(function(x){return tag(x)==='a';});
      if(!anchors.length||!anchors.every(function(a){return isProvider(ops.attr(a,'href'))&&providerNames.test(norm(ops.text(a)));}))return false;
      var bare=norm(ops.text(n)),linkText=norm(anchors.map(function(a){return ops.text(a);}).join(' '));
      return bare.replace(/\s/g,'')===linkText.replace(/\s/g,'');
    }
    elements.forEach(function(n){
      if(forbidden(n))return;
      var cls=classes(n),known=sourceClasses.some(function(c){return cls.indexOf(c)!==-1;});
      if(known||citationList(n)){
        if(!citationList(n)){suspected.push({node:n,reason:'source-container-has-unclassified-or-mixed-content'});return;}
        remove(n,known?'explicit-reference-list':'reference-provider-only-list');
        var prev=ops.previous(n);if(prev&&/^h[2-6]$/.test(tag(prev))&&sourceHeadings.indexOf(norm(ops.text(prev)))!==-1)remove(prev,'heading-of-reference-list');
      }
      if(tag(n)==='a'&&isProvider(ops.attr(n,'href'))&&providerNames.test(norm(ops.text(n)))){
        // Verification scope, calculation blocking and caveats surrounding this link stay intact.
        if(parentWith(n,function(p){return ops.attr(p,'data-verification-note')!==null;}))remove(n,'reference-link-only-inside-preserved-verification-note');
      }
      if(/^h[2-6]$/.test(tag(n))&&sourceHeadings.indexOf(norm(ops.text(n)))!==-1){
        var next=ops.next(n);if(!next||!citationList(next))suspected.push({node:n,reason:ops.all(ops.parent(n)||n).some(function(x){return classes(x).indexOf('source-card')!==-1;})?'game-acquisition-sources-preserved':'source-heading-not-followed-by-a-classified-citation-list'});
      }
      if(tag(n)==='dt'){
        var label=norm(ops.text(n)),comparison=Object.prototype.hasOwnProperty.call(comparisonValues,label),referenceDate=referenceDateLabels.indexOf(label)!==-1;
        if(comparison||referenceDate){
          var dd=ops.next(n),isProtected=parentWith(n,function(p){return ['table','form'].indexOf(tag(p))!==-1||ops.attr(p,'data-verification-note')!==null||ops.attr(p,'data-calculation-blocked')!==null;});
          if(isProtected){exceptions.push({node:n,reason:'game-verification-context-metadata-preserved'});return;}
          if(!dd||tag(dd)!=='dd'||tag(ops.parent(n))!=='dl'||ops.all(dd).length||
             (comparison?norm(ops.text(dd))!==comparisonValues[label]:!/^\d{4}-\d{2}-\d{2}$/.test(norm(ops.text(dd))))){
            suspected.push({node:n,reason:'reference-metadata-pair-has-unclassified-value-or-markup'});return;
          }
          if(legal(n)||legal(dd)){exceptions.push({node:n,reason:'legal-or-license-attribution-preserved'});return;}
          var reason=comparison?'general-reference-comparison-scope':'general-reference-review-date';
          remove(n,reason);remove(dd,reason);
        }
      }
    });
    // Only log/delete the outermost planned nodes; no duplicate child span deletions.
    removals=removals.filter(function(x){return !parentWith(x.node,function(p){return removals.some(function(y){return y.node===p;});});});
    return {removals:removals,exceptions:exceptions,suspected:suspected};
  }
  var copy={
    ko:{title:'자료 수집과 검증 기준',purpose:'킹샷데이터코리아는 건물·영웅·연구와 성장 계산에 필요한 정보를 쉽게 찾고 비교하도록 정리하는 비공식 팬사이트입니다.',sourceTitle:'기준 자료',source:'공식 게임 위키의 한국어·영어·일본어 자료를 대조해 명칭과 설명을 연결합니다. 기존 번체중국어 자료는 별도로 보존합니다. 모든 수치가 검증되었다는 뜻은 아니며, 게임 버전이 원문에 없으면 추정하지 않습니다.',processTitle:'수집·검증·업데이트',process:'원문 주소, 수집 시점, 원래 값, 이미지 출처와 검증 상태를 데이터에 보관합니다. 자료 갱신 시 변경분을 비교하고, 값이나 조건이 충돌하면 원본을 덮어쓰지 않고 보류합니다. 검증을 거친 변경만 검토 후 반영합니다.',limits:'게임 버전, 서버 진행, 버프와 적용 조건에 따라 결과가 달라질 수 있습니다. 각 화면의 조건과 미검증 안내를 확인해 주세요.',rightsTitle:'이미지와 권리',rights:'게임 이미지와 상표의 권리는 각 권리자에게 있습니다. 출처 확인과 이용 허락은 별개이며, 권리가 확인되지 않은 새 이미지는 임의로 공개하거나 대체하지 않습니다. 개별 자료에 필요한 저작권·라이선스 고지는 유지합니다.',feedbackTitle:'오류 제보',feedback:'잘못된 명칭·수치·이미지를 발견하면 게임 언어, 화면, 버전 또는 확인 시점을 함께 알려 주세요.',contact:'기존 문의 페이지',wiki:'공식 게임 위키 (한국어)'},
    en:{title:'Data collection and verification',purpose:'KingshotData is an unofficial fan site that helps players find and compare buildings, heroes, research and growth-calculation information.',sourceTitle:'Reference material',source:'We compare Korean, English and Japanese material from the official game wiki to connect names and descriptions. Existing Traditional Chinese material is preserved separately. This does not mean every value is verified; a game version absent from a source is not inferred.',processTitle:'Collection, review and updates',process:'The data retains source URLs, collection dates, original values, image provenance and verification status. Updates are compared against saved material. Conflicting values or conditions are held for review instead of overwriting the originals. Reviewed changes are applied after verification.',limits:'Game versions, server progress, buffs and conditions can affect results. Read the conditions and unverified-data notices on each page.',rightsTitle:'Images and rights',rights:'Game images and trademarks belong to their respective owners. Identifying a source does not grant permission to reuse it. New images with unconfirmed rights are not published or substituted arbitrarily. Required copyright and license notices remain with the relevant material.',feedbackTitle:'Report an error',feedback:'When reporting an incorrect name, value or image, include the game language, screen, version or date checked.',contact:'Existing contact page',wiki:'Official game wiki (Korean)'},
    ja:{title:'資料の収集と検証方針',purpose:'KingshotData は、建物・英雄・研究や成長計算に必要な情報を探し、比較しやすく整理する非公式ファンサイトです。',sourceTitle:'基準資料',source:'公式ゲーム Wiki の韓国語・英語・日本語資料を照合し、名称と説明を対応付けます。既存の繁体字中国語資料は別途保持します。すべての数値が検証済みという意味ではなく、原文にないゲームバージョンは推測しません。',processTitle:'収集・検証・更新',process:'原文 URL、収集日時、元の値、画像の出典、検証状態をデータに保存します。更新時は保存資料との差分を確認し、値や条件が矛盾する場合は原本を上書きせず保留します。検証した変更を確認後に反映します。',limits:'ゲームバージョン、サーバー進行、バフ、適用条件で結果が変わる場合があります。各画面の条件と未検証データの案内を確認してください。',rightsTitle:'画像と権利',rights:'ゲーム画像と商標の権利は各権利者に帰属します。出典の確認と利用許可は別です。権利未確認の新しい画像を任意に公開・代替しません。個別資料に必要な著作権・ライセンス表記は維持します。',feedbackTitle:'誤りの報告',feedback:'名称・数値・画像の誤りは、ゲームの言語、画面、バージョンまたは確認時点とともにお知らせください。',contact:'既存のお問い合わせページ',wiki:'公式ゲーム Wiki（韓国語）'},
    'zh-TW':{title:'資料收集與驗證原則',purpose:'KingshotData 是非官方粉絲網站，整理建築、英雄、研究及成長計算資訊，方便玩家查找與比較。',sourceTitle:'參考資料',source:'我們比對官方遊戲 Wiki 的韓語、英語及日語資料，對應名稱與說明。既有繁體中文資料另行保留。這不代表所有數值均已驗證；原文未標示的遊戲版本不會推測補上。',processTitle:'收集、驗證與更新',process:'資料保留原始網址、收集時間、原始值、圖片來源及驗證狀態。更新時比對已保存內容，數值或條件衝突時先保留待查，不覆寫原始資料。經驗證的變更會在審閱後套用。',limits:'遊戲版本、伺服器進度、增益及適用條件可能影響結果。請查看各畫面的條件與未驗證資料提示。',rightsTitle:'圖片與權利',rights:'遊戲圖片及商標權利屬於各權利人。確認來源不等於取得使用許可；權利尚未確認的新圖片不會任意公開或替換。個別資料所需的版權與授權告示會保留。',feedbackTitle:'回報錯誤',feedback:'若發現名稱、數值或圖片錯誤，請一併提供遊戲語言、畫面、版本或確認時間。',contact:'既有聯絡頁面',wiki:'官方遊戲 Wiki（韓語）'}
  };
  function aboutMarkup(lang,contact){var c=copy[lang]||copy.ko;return '<section class="kd-ui kd-about" data-kd-source-policy="v1" lang="'+esc(lang)+'"><h2>'+esc(c.title)+'</h2><p>'+esc(c.purpose)+'</p><h3>'+esc(c.sourceTitle)+'</h3><p>'+esc(c.source)+'</p><p><a href="https://kingshotwiki.com/ko/" target="_blank" rel="noopener">'+esc(c.wiki)+'</a></p><h3>'+esc(c.processTitle)+'</h3><p>'+esc(c.process)+'</p><p>'+esc(c.limits)+'</p><h3>'+esc(c.rightsTitle)+'</h3><p>'+esc(c.rights)+'</p><h3>'+esc(c.feedbackTitle)+'</h3><p>'+esc(c.feedback)+'</p><p><a href="'+esc(contact)+'">'+esc(c.contact)+'</a></p></section>';}
  function domOps(){return {all:function(n){return Array.from(n.querySelectorAll('*'));},tag:function(n){return (n.tagName||'').toLowerCase();},attr:function(n,k){return n.getAttribute?n.getAttribute(k):null;},text:function(n){return n.textContent||'';},parent:function(n){return n.parentElement;},previous:function(n){return n.previousElementSibling;},next:function(n){return n.nextElementSibling;}};}
  function domPath(n){var out=[];for(var p=n;p&&p.tagName&&out.length<7;p=p.parentElement){var index=p.parentElement?Array.from(p.parentElement.children).indexOf(p)+1:1;out.unshift(p.tagName.toLowerCase()+(p.id?'#'+p.id:':nth-child('+index+')'));}return out.join(' > ');}
  function apply(doc){
    doc=doc||document;var win=doc.defaultView,pathname=win&&win.location?(String(win.location.hash||'').indexOf('#/')===0?win.location.hash.slice(1):win.location.pathname):'/',ops=domOps(),result=plan(doc,ops,pathname),log=[];
    result.removals.forEach(function(x){log.push({url:pathname,domPath:domPath(x.node),text:norm(ops.text(x.node)),html:x.node.outerHTML,reason:x.reason,sourceSpan:null});x.node.remove();});
    if(pageKind(pathname)==='about'){
      var declared=win&&win.I18N&&(win.I18N.current||win.I18N.lang)||doc.documentElement.lang,lang=locale(pathname,declared),contact=lang==='ko'?'/contact/':'/'+(lang==='zh-TW'?'zh-tw':lang)+'/contact/';
      var live=doc.querySelector('#content');
      var target=live&&(live.querySelector('main.container')||live.querySelector('main')||live.querySelector('.ssg-initial-content')||live)||doc.querySelector('main.container')||doc.querySelector('main')||doc.querySelector('.ssg-initial-content');
      var policies=Array.from(doc.querySelectorAll('[data-kd-source-policy="v1"]'));
      var existing=policies.find(function(n){return target&&target.contains(n);})||policies[0];
      policies.forEach(function(n){if(n!==existing){log.push({url:pathname,domPath:domPath(n),text:norm(ops.text(n)),html:n.outerHTML,reason:'duplicate-central-about-policy',sourceSpan:null});n.remove();}});
      if(existing&&target&&!target.contains(existing))target.appendChild(existing);
      if(existing&&existing.getAttribute('lang')!==lang)existing.outerHTML=aboutMarkup(lang,contact);
      else if(!existing&&target)target.insertAdjacentHTML('beforeend',aboutMarkup(lang,contact));
    }
    api.lastAudit={policyVersion:policyVersion,url:pathname,removals:log,exceptions:result.exceptions.map(function(x){return {domPath:x.node?domPath(x.node):null,reason:x.reason};}),suspected:result.suspected.map(function(x){return {domPath:domPath(x.node),text:norm(ops.text(x.node)),reason:x.reason};})};
    if(log.length){api.history.push(api.lastAudit);if(api.history.length>30)api.history.shift();}
    return api.lastAudit;
  }
  function boot(win){
    if(api.booted)return;api.booted=true;var pending=false,doc=win.document;
    function schedule(){if(pending)return;pending=true;win.setTimeout(function(){pending=false;apply(doc);},0);}
    function start(){schedule();if(doc.body){var observer=new win.MutationObserver(schedule);observer.observe(doc.body,{subtree:true,childList:true,characterData:true});}}
    if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
    ['i18n:ready','i18n:changed'].forEach(function(name){doc.addEventListener(name,schedule);});
    ['kd:page-ready','popstate','hashchange'].forEach(function(name){win.addEventListener(name,schedule);});
  }
  var api={policyVersion:policyVersion,plan:plan,apply:apply,boot:boot,aboutMarkup:aboutMarkup,pageKind:pageKind,locale:locale,domOps:domOps,history:[],selectors:{sourceLists:sourceClasses.map(function(c){return '.'+c;}),verification:'[data-verification-note]',about:'[data-kd-source-policy="v1"]'}};
  return api;
});

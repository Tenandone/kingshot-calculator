(function(win){'use strict';
  const doc=win.document,script=doc.currentScript,version=script?.dataset.kdUiVersion;
  if(win.KD_UI?.version===version)return;
  win.KD_UI={version,status:'loading',errors:[]};
  let scheduled=false,running=false,rerun=false;
  const labels={ko:['건물','영웅','연구','계산기','소개'],en:['Buildings','Heroes','Research','Calculators','About'],ja:['建物','英雄','研究','計算機','サイト紹介']};
  function locale(){const m=location.pathname.match(/^\/(ko|en|ja|zh-tw)(?:\/|$)/);return m?m[1]:((doc.documentElement.lang||'ko').startsWith('zh')?'zh-tw':doc.documentElement.lang||'ko');}
  function scope(){const p=location.hash.startsWith('#/')?location.hash.slice(1):location.pathname;return /(?:buildings\/embassy(?:\.html)?|(?:^|\/)heroes\/?$|hero\/jabel|research(?:\/(?:academy|advanced-truegold))?\/?$|(?:^|\/)about(?:\.html)?\/?$)/.test(p);}
  function subnav(lang){
    const host=doc.querySelector('#content')||doc.querySelector('main');if(!host||host.querySelector(':scope > .kd-subnav'))return;
    const prefix=lang==='ko'?'':'/'+lang,words=labels[lang]||labels.ko;
    const targets=['/'+lang+'/buildings/',prefix+'/heroes/',prefix+'/research/',prefix+'/calculator/',prefix+'/about/'];
    const nav=doc.createElement('nav');nav.className='kd-subnav';nav.setAttribute('aria-label',lang==='ko'?'게임 데이터 분류':'Game data');
    words.forEach((word,i)=>{const a=doc.createElement('a');a.href=targets[i];a.textContent=word;if((i===0&&/building/.test(location.pathname))||(i===1&&/hero/.test(location.pathname))||(i===2&&/research/.test(location.pathname))||(i===4&&/about/.test(location.pathname)))a.setAttribute('aria-current','page');nav.append(a);});host.prepend(nav);
  }
  async function run(){
    scheduled=false;if(running){rerun=true;return;}running=true;
    try{
      const lang=locale(),enabled=lang!=='zh-tw'&&scope();doc.body.classList.toggle('kd-ui-shell',enabled);
      (doc.querySelector('#content')||doc.querySelector('main'))?.classList.toggle('kd-ui',enabled);
      win.KD_UI_SOURCES?.apply(doc);
      if(enabled){
        win.KD_UI_BUILDING?.enhance(doc,lang);
        const buildingNotice=doc.querySelector('[data-verification-note]'),buildingState=doc.querySelector('#kd-building #requirements .kd-building-state');
        if(buildingNotice&&buildingState&&buildingNotice.previousElementSibling!==buildingState)buildingState.after(buildingNotice);
        if(/\/(?:heroes\/?$|hero\/jabel|research\/(?:academy|advanced-truegold))/.test(location.pathname))await win.KD_UI_COLLECTIONS?.enhance(doc,lang);
        subnav(lang);
      }
      win.KD_UI_SOURCES?.apply(doc);win.KD_UI.status='ready';
    }catch(e){win.KD_UI.status='error';win.KD_UI.errors.push(e.message);console.error('[ui-integration]',e);}
    finally{running=false;if(rerun){rerun=false;schedule();}}
  }
  function schedule(){if(!scheduled){scheduled=true;win.requestAnimationFrame(run);}}
  win.KD_UI.refresh=schedule;
  new MutationObserver(records=>{if(records.some(r=>r.type==='childList'||r.type==='characterData'))schedule();}).observe(doc.body,{childList:true,subtree:true,characterData:true});
  ['kd:page-ready','kd:presentation-ready','popstate','hashchange'].forEach(name=>win.addEventListener(name,schedule));
  ['i18n:ready','i18n:changed','DOMContentLoaded'].forEach(name=>doc.addEventListener(name,schedule));
  schedule();
})(window);

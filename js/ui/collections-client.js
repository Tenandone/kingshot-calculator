(function (root) {
  'use strict';
  const COPY = {
    ko: {search:'이름·별칭 검색',unit:'병종',generation:'세대',all:'전체',unknown:'미분류',sort:'정렬',order:'기존 순서',name:'이름순',newest:'최신 세대순',max:'최대 레벨순',reset:'초기화',INF:'보병',CAV:'기병',ARC:'궁병',gen:'세대',results:'개 결과',none:'조건에 맞는 항목이 없습니다.',select:'상세 정보',empty:'연구를 선택하면 확인된 정보와 미확인 항목을 볼 수 있습니다.',maxLevel:'최대 레벨',cost:'비용',effect:'레벨별 효과',requirements:'선행 조건',unconfirmed:'자료 미확인',notice:'연구별 비용·레벨별 효과·선행 조건은 아직 확인되지 않았습니다.',description:'설명',contents:'목차',category:'분류',growth:'성장',economy:'경제',battle:'전투',advanced:'고급 연구'},
    en: {search:'Search names and aliases',unit:'Troop type',generation:'Generation',all:'All',unknown:'Unclassified',sort:'Sort',order:'Original order',name:'Name',newest:'Newest generation',max:'Maximum level',reset:'Reset',INF:'Infantry',CAV:'Cavalry',ARC:'Archer',gen:'Gen.',results:'results',none:'No matching records.',select:'Details',empty:'Select research to view available details and unconfirmed fields.',maxLevel:'Maximum level',cost:'Cost',effect:'Effect by level',requirements:'Prerequisites',unconfirmed:'Unconfirmed',notice:'Research costs, effects by level and prerequisites are unconfirmed.',description:'Description',contents:'Contents',category:'Category',growth:'Growth',economy:'Economy',battle:'Battle',advanced:'Advanced'},
    ja: {search:'名前・別名で検索',unit:'兵種',generation:'世代',all:'すべて',unknown:'未分類',sort:'並べ替え',order:'元の順序',name:'名前順',newest:'新しい世代順',max:'最大レベル順',reset:'リセット',INF:'歩兵',CAV:'騎兵',ARC:'弓兵',gen:'世代',results:'件',none:'条件に一致する項目がありません。',select:'詳細',empty:'研究を選択すると確認済み情報と未確認項目を表示します。',maxLevel:'最大レベル',cost:'コスト',effect:'レベル別効果',requirements:'前提条件',unconfirmed:'資料未確認',notice:'研究のコスト・レベル別効果・前提条件は未確認です。',description:'説明',contents:'目次',category:'分類',growth:'成長',economy:'経済',battle:'戦闘',advanced:'上級研究'},
  };
  const KEYS = ['q','unit','gen','sort','cat','item'];
  const STORY = {ko:{label:'영웅 이야기',heading:'영웅 소개'},en:{label:'Hero story',heading:'Hero Summary'},ja:{label:'英雄の物語',heading:'英雄紹介'}};
  const DEFAULT = { q:'', unit:'all', gen:'all', sort:'order', cat:'all', item:'' };
  const states = new WeakMap();
  const heroRestoreUrl=root.location?.href||null;
  let heroRestoreVersion=0, heroHashRestored=false, heroHashPending=false, heroRestoreCancelled=false;
  let renderedHeroLocation=null, pendingHeroHistory=null;
  let data, loading;
  const text = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function normalizeState(value) {
    const x = { ...DEFAULT, ...value };
    x.q = String(x.q || '').slice(0,200); x.item = String(x.item || '').slice(0,180);
    x.gen = String(x.gen);
    if (!['all','INF','CAV','ARC','unknown'].includes(x.unit)) x.unit = 'all';
    if (!/^(all|unknown|[1-9][0-9]?)$/.test(x.gen)) x.gen = 'all';
    if (!['order','name','newest','max'].includes(x.sort)) x.sort = 'order';
    if (!['all','growth','economy','battle','advanced'].includes(x.cat)) x.cat = 'all';
    return x;
  }
  function stateFromUrl(url, fallback) {
    const u = new URL(url, 'http://localhost');
    return normalizeState(u.searchParams.has('kdu') ? Object.fromEntries(KEYS.map(k => [k,u.searchParams.get('kdu_'+k) ?? DEFAULT[k]])) : fallback || DEFAULT);
  }
  function stateUrl(url, state) {
    const u = new URL(url, 'http://localhost'); u.searchParams.set('kdu','1');
    for (const key of KEYS) { if (state[key] !== DEFAULT[key]) u.searchParams.set('kdu_'+key,state[key]); else u.searchParams.delete('kdu_'+key); }
    return u.pathname + u.search + u.hash;
  }
  function key(locale) { return 'KSD_UI_COLLECTIONS_V1:'+root.location.pathname+':'+locale; }
  function restore(locale, onlyUrl) {
    let saved; if (!onlyUrl) try { saved=JSON.parse(root.sessionStorage.getItem(key(locale))); } catch (_) {}
    return stateFromUrl(root.location.href,saved);
  }
  function save(state, locale, push) {
    const value=normalizeState(state), next=stateUrl(root.location.href,value);
    try { root.sessionStorage.setItem(key(locale),JSON.stringify(value)); } catch (_) {}
    if (next !== root.location.pathname+root.location.search+root.location.hash) root.history[push?'pushState':'replaceState'](root.history.state,'',next);
  }
  function element(doc, tag, className, html) { const el=doc.createElement(tag); if(className)el.className=className; if(html != null)el.innerHTML=html; return el; }
  function options(values, selected) { return values.map(([value,label])=>`<option value="${text(value)}"${value===selected?' selected':''}>${text(label)}</option>`).join(''); }
  function compare(sort, locale) { return (a,b)=> sort==='name'?a.title.localeCompare(b.title,locale):sort==='newest'?(Number(b.generation)||0)-(Number(a.generation)||0)||a.index-b.index:sort==='max'?b.maxLevel-a.maxLevel||a.index-b.index:a.index-b.index; }
  function heroMatches(record,state) { const q=state.q.trim().toLocaleLowerCase();return (!q||[record.title,...record.aliases].some(v=>v.toLocaleLowerCase().includes(q)))&&(state.unit==='all'||record.unit===state.unit)&&(state.gen==='all'||record.generation===state.gen); }
  function heroSlug(anchor) { const h=anchor.getAttribute('href')||'';const match=h.match(/(?:#)?\/hero\/([^/?#]+)/);return match?decodeURIComponent(match[1]):null; }
  function heroTocTarget(doc, host, href) {
    let url, current;try{current=new URL(root.location.href);url=new URL(href,current);}catch(_){return null;}
    if(url.origin!==current.origin||url.pathname!==current.pathname||url.search!==current.search||!/^#kd-hero-section-\d+$/.test(url.hash))return null;
    const target=doc.getElementById(url.hash.slice(1));
    return target&&host.contains(target)&&target.matches('h2.kd-hero-section-title')?{target,url}:null;
  }
  function onHeroTocClick(event) {
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const origin=event.target?.nodeType===3?event.target.parentElement:event.target;
    const anchor=origin?.closest?.('a[href]'),nav=anchor?.closest('.kd-hero-toc[data-kdu-toc]'),host=nav?.closest('.kd-hero-detail');
    if(!host)return;
    const result=heroTocTarget(root.document,host,anchor.getAttribute('href'));if(!result)return;
    event.preventDefault();event.stopPropagation();heroRestoreVersion++;heroRestoreCancelled=true;pendingHeroHistory=null;
    renderedHeroLocation=root.location.pathname+root.location.search;
    const next=result.url.pathname+result.url.search+result.url.hash;
    if(next!==root.location.pathname+root.location.search+root.location.hash)root.history.pushState(root.history.state,'',next);
    result.target.scrollIntoView({block:'start',behavior:'auto'});
  }
  function onHeroTocPop() {
    heroRestoreVersion++;heroRestoreCancelled=true;pendingHeroHistory=null;
    // The legacy router may already have removed the live host. Keep only the
    // requested same-page anchor, then wait for its fresh page-ready/enhancement.
    if(/^\/(?:ko\/|en\/|ja\/)?hero\/jabel\/?$/.test(root.location.pathname)&&/^#kd-hero-section-\d+$/.test(root.location.hash)&&renderedHeroLocation===root.location.pathname+root.location.search){
      pendingHeroHistory={href:root.location.href,version:heroRestoreVersion,ready:false,scheduled:false,appliedHost:null};
    }
    restoreHeroHistory(root.document);
    const content=root.document?.querySelector('#content');if(!content)return;
    for(const node of content.querySelectorAll('#heroes-root,#research-search,[data-kdu-collection="heroes"]'))states.get(node)?.restore?.();
  }
  function restoreHeroHistory(doc) {
    const request=pendingHeroHistory;
    if(!request||request.scheduled||request.href!==root.location.href)return;
    const host=doc.querySelector('#hero-root');
    if(!host||request.appliedHost===host||host.dataset.kduHeroLocation!==root.location.pathname+root.location.search||!heroTocTarget(doc,host,request.href))return;
    request.scheduled=true;
    const frame=root.requestAnimationFrame?.bind(root)||((callback)=>callback());
    frame(()=>frame(()=>{
      if(pendingHeroHistory!==request||request.version!==heroRestoreVersion||root.location.href!==request.href)return;
      request.scheduled=false;
      const freshHost=doc.querySelector('#hero-root');
      if(!freshHost||freshHost.dataset.kduHeroLocation!==root.location.pathname+root.location.search)return;
      const result=heroTocTarget(doc,freshHost,request.href);
      if(!result||result.target.isConnected===false)return;
      request.appliedHost=freshHost;
      if(request.ready)pendingHeroHistory=null;
      result.target.scrollIntoView({block:'start',behavior:'auto'});
    }));
  }
  function restoreHeroHash(doc, host) {
    if(heroRestoreCancelled||heroHashRestored||heroHashPending||!heroRestoreUrl||root.location.href!==heroRestoreUrl)return;
    // The full-shell router replaces SSR content and resets scroll. Restore only
    // after its live hero root exists; plain static documents use their SSR root.
    if(typeof root.navigate==='function'&&host.id!=='hero-root')return;
    if(!heroTocTarget(doc,host,heroRestoreUrl))return;
    const version=heroRestoreVersion,restoreUrl=heroRestoreUrl;
    heroHashPending=true;
    const frame=root.requestAnimationFrame?.bind(root)||((callback)=>callback());
    frame(()=>frame(()=>{
      if(version!==heroRestoreVersion)return;
      heroHashPending=false;
      if(heroRestoreCancelled||heroHashRestored||root.location.href!==restoreUrl)return;
      const result=heroTocTarget(doc,host,restoreUrl);
      if(!result||result.target.isConnected===false)return;
      heroHashRestored=true;result.target.scrollIntoView({block:'start',behavior:'auto'});
    }));
  }
  function mountResearchDetail(notice, list, detail) {
    detail.hidden=true;
    if(notice.parentNode===list.parentNode)notice.after(detail);else list.before(detail);
  }
  function selectResearch(state, id, locale) {
    state.value.item=id;save(state.value,locale,true);state.decorate();
    if(!state.detail.hidden)state.detail.scrollIntoView({block:'nearest',behavior:'auto'});
  }
  function drawResearchDetail(state, selected, c) {
    state.detail.hidden=!selected;
    const html=selected?`<h2>${text(selected.title)}</h2>${selected.description?'<p>'+text(selected.description)+'</p>':''}<dl><dt>${c.maxLevel}</dt><dd>${selected.maxLevel}</dd><dt>${c.category}</dt><dd>${text(c[selected.category]||selected.category)}</dd><dt>${c.cost}</dt><dd class="kd-unconfirmed">${c.unconfirmed}</dd><dt>${c.effect}</dt><dd class="kd-unconfirmed">${c.unconfirmed}</dd><dt>${c.requirements}</dt><dd class="kd-unconfirmed">${c.unconfirmed}</dd></dl>`:'';
    if(state.detail.innerHTML!==html)state.detail.innerHTML=html;
  }
  function enhanceHeroes(doc, locale, content) {
    const live=content.querySelector('#heroes-root'), host=live||content.querySelector('[data-kdu-collection="heroes"]');
    if(!host)return;
    const records=data.locales[locale].heroes, c=COPY[locale];
    const cards=[...host.querySelectorAll('a[href]')].filter(a=>records.some(r=>r.id===heroSlug(a)));
    if(!cards.length)return;
    const container=host.closest('.kd-heroes')||host;container.classList.add('kd-heroes');
    let state=states.get(host);
    if(!state){
      state={value:restore(locale),locale,kind:'heroes'};states.set(host,state);
      const toolbar=element(doc,'div','kd-collection-toolbar');toolbar.dataset.kduHeroesToolbar='';
      toolbar.innerHTML=`<label class="kd-collection-search">${c.search}<input type="search" data-kdu="q" autocomplete="off"></label><label>${c.unit}<select data-kdu="unit">${options([['all',c.all],['INF',c.INF],['CAV',c.CAV],['ARC',c.ARC],['unknown',c.unknown]],'all')}</select></label><label>${c.generation}<select data-kdu="gen">${options([['all',c.all],...[...new Set(records.map(r=>r.generation))].filter(v=>v!=='unknown').sort((a,b)=>+b-+a).map(v=>[v,v]),['unknown',c.unknown]],'all')}</select></label><label>${c.sort}<select data-kdu="sort">${options([['order',c.order],['newest',c.newest],['name',c.name]],'order')}</select></label><button type="button" class="kd-button" data-kdu-reset>${c.reset}</button>`;
      host.before(toolbar);state.toolbar=toolbar;
      state.status=element(doc,'p','kd-collection-status');state.status.setAttribute('role','status');toolbar.after(state.status);
      state.grid=element(doc,'div','kd-collection-cards');host.prepend(state.grid);
      const update=e=>{state.value[e.target.dataset.kdu]=e.target.value;save(state.value,locale,e.type==='change');drawHeroes();};
      toolbar.querySelectorAll('[data-kdu]').forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',update));
      toolbar.querySelector('[data-kdu-reset]').onclick=()=>{state.value={...DEFAULT};save(state.value,locale,true);sync();drawHeroes();};
      state.restore=()=>{state.value=restore(locale,true);sync();drawHeroes();};
    }
    if(!state.grid.isConnected||state.locale!==locale){state.toolbar.remove();state.status.remove();states.delete(host);return enhanceHeroes(doc,locale,content);}
    for(const card of cards){
      const record=records.find(r=>r.id===heroSlug(card));card.dataset.kduHero=record.id;card.classList.add('kd-hero-card');
      card.setAttribute('href',record.href);
      if(!card.querySelector('img')){const img=doc.createElement('img');if(record.image){img.src=record.image;img.alt='';img.loading='lazy';img.width=160;img.height=160;card.prepend(img);}}
      if(!card.querySelector('.kd-hero-meta')){const meta=element(doc,'span','kd-hero-meta');meta.textContent=`${record.generation==='unknown'?c.unknown:c.gen+' '+record.generation} · ${c[record.unit]||c.unknown}${record.rarity?' · '+record.rarity:''}`;card.append(meta);}
      if(card.parentNode!==state.grid)state.grid.append(card);
    }
    host.querySelectorAll('.section,ul').forEach(s=>{if(!s.querySelector('a[data-kdu-hero]')&&!s.contains(state.grid))s.hidden=true;});
    function sync(){state.toolbar.querySelectorAll('[data-kdu]').forEach(el=>{el.value=state.value[el.dataset.kdu];});}
    function drawHeroes(){
      const nodes=[...state.grid.querySelectorAll('[data-kdu-hero]')], ordered=nodes.map(node=>({node,record:records.find(r=>r.id===node.dataset.kduHero)})).sort((a,b)=>compare(state.value.sort,locale)(a.record,b.record));
      let count=0;ordered.forEach(({node,record},index)=>{node.hidden=!heroMatches(record,state.value);node.style.order=String(index);if(!node.hidden)count++;});
      const message=count?`${count} ${c.results}`:c.none;if(state.status.textContent!==message)state.status.textContent=message;
    }
    sync();drawHeroes();
  }
  function enhanceResearch(doc, locale, content, branch) {
    const host=content.querySelector('#research-root')||content.querySelector('[data-kdu-collection="research"]');if(!host)return;
    host.classList.add('kd-research');const c=COPY[locale],records=data.locales[locale].research[branch];if(!records)return;
    let input=host.querySelector('#research-search'),list=host.querySelector('#research-list');
    const isSpa=!!input;
    if(!list){list=[...host.querySelectorAll('ul')].find(ul=>ul.querySelector('li > strong'));if(!list)return;list.id='research-list';list.classList.add('research-list');}
    let state=states.get(input||list);
    if(!state){
      state={value:restore(locale),kind:'research',locale,list};
      let toolbar=input?.closest('.research-toolbar');
      if(!toolbar){toolbar=element(doc,'div','research-toolbar');list.before(toolbar);input=element(doc,'input');input.id='research-search';input.type='search';input.placeholder=c.search;input.setAttribute('aria-label',c.search);toolbar.append(input);
        for(const category of branch==='academy'?['all','growth','economy','battle']:['all']){const b=element(doc,'button','research-filter');b.type='button';b.dataset.category=category;b.textContent=category==='all'?c.all:c[category];b.setAttribute('aria-pressed',String(category==='all'));toolbar.append(b);}
      }
      states.set(input,state);state.input=input;state.toolbar=toolbar;
      const label=element(doc,'label','kd-research-sort',`${c.sort}<select data-kdu-research-sort>${options([['order',c.order],['name',c.name],['max',c.max]],'order')}</select>`);toolbar.append(label);state.sort=label.querySelector('select');
      const reset=element(doc,'button','kd-button',c.reset);reset.type='button';toolbar.append(reset);
      state.status=element(doc,'p','kd-collection-status');state.status.setAttribute('role','status');toolbar.after(state.status);
      const notice=element(doc,'p','kd-research-unknown',c.notice);state.status.after(notice);
      state.detail=element(doc,'aside','kd-research-detail');state.detail.setAttribute('aria-live','polite');state.detail.dataset.kduResearchDetail='';mountResearchDetail(notice,list,state.detail);
      state.decorate=decorate;
      input.addEventListener('input',()=>{state.value.q=input.value;save(state.value,locale,false);decorate();});
      toolbar.querySelectorAll('.research-filter').forEach(button=>button.addEventListener('click',()=>{state.value.cat=button.dataset.category;save(state.value,locale,true);decorate();}));
      state.sort.addEventListener('change',()=>{state.value.sort=state.sort.value;save(state.value,locale,true);decorate();});
      reset.onclick=()=>{state.value={...DEFAULT};save(state.value,locale,true);sync();};
      state.restore=()=>{state.value=restore(locale,true);sync();};
      function sync(){input.value=state.value.q;state.sort.value=state.value.sort;const button=toolbar.querySelector(`[data-category="${state.value.cat}"]`)||toolbar.querySelector('[data-category="all"]');if(isSpa&&button)button.click();input.dispatchEvent(new root.Event('input',{bubbles:true}));decorate();}
      // Restore through the original listeners; do not replace or clone the input.
      input.value=state.value.q;state.sort.value=state.value.sort;
      const initial=toolbar.querySelector(`[data-category="${state.value.cat}"]`);if(isSpa&&initial&&state.value.cat!=='all')initial.click();
      if(isSpa&&state.value.q)input.dispatchEvent(new root.Event('input',{bubbles:true}));
    }
    state.decorate();
    function decorate(){
      const all=[...list.children].map((node,index)=>{
        const title=node.querySelector('strong')?.textContent.trim();const record=records.find(r=>r.id===node.dataset.kduResearch)||records.find(r=>r.title===title||r.legacyTitle===title);
        if(!record)return null;node.dataset.kduResearch=record.id;node.classList.add('research-record');node.style.order=String(index);
        if(!node.querySelector('[data-kdu-select]')){const button=element(doc,'button','kd-research-select');button.type='button';button.dataset.kduSelect='';button.textContent=c.select;button.setAttribute('aria-label',record.title+' · '+c.select);button.onclick=()=>selectResearch(state,record.id,locale);node.append(button);}
        return {node,record};
      }).filter(Boolean);
      all.sort((a,b)=>compare(state.value.sort,locale)(a.record,b.record)).forEach(({node,record},index)=>{
        node.style.order=String(index);if(!isSpa){const q=state.value.q.trim().toLowerCase();node.hidden=!(state.value.cat==='all'||record.category===state.value.cat)||!!q&&![record.title,...record.aliases].some(x=>x.toLowerCase().includes(q));}
        node.classList.toggle('kd-selected',state.value.item===record.id);node.querySelector('[data-kdu-select]').setAttribute('aria-pressed',String(state.value.item===record.id));
      });
      state.toolbar.querySelectorAll('.research-filter').forEach(b=>{if(!isSpa)b.setAttribute('aria-pressed',String(b.dataset.category===state.value.cat));});
      const count=all.filter(x=>!x.node.hidden).length,message=count?`${count} ${c.results}`:c.none;if(state.status.textContent!==message)state.status.textContent=message;
      const selected=records.find(r=>r.id===state.value.item);
      drawResearchDetail(state,selected,c);
    }
  }
  function enhanceDetail(doc, locale, content) {
    const host=content.querySelector('#hero-root')||content.querySelector('[data-kdu-collection="hero-detail"]')||content;
    if(!host.querySelector('h1')||!host.querySelector('h2'))return;
    host.classList.add('kd-hero-detail');
    host.dataset.kduHeroLocation=root.location.pathname+root.location.search;
    renderedHeroLocation=host.dataset.kduHeroLocation;
    const h1=host.querySelector('h1'),record=data.locales[locale].heroes.find(h=>h.id==='jabel');
    let identity=host.querySelector('[data-kdu-identity]');
    if(!identity){
      const parent=h1.parentNode, portrait=[...host.querySelectorAll('img')].find(img=>(img.getAttribute('src')||'').split('?')[0]===record.image);
      let subtitle=parent.querySelector(':scope > .ssg-subtitle');
      if(!subtitle)for(let n=h1.nextElementSibling;n&&n.tagName!=='H2';n=n.nextElementSibling){if(n.tagName==='DIV'&&!n.querySelector('img,h1,h2')&&n.textContent.trim().length>0&&n.textContent.trim().length<100){subtitle=n;break;}}
      identity=element(doc,'header','kd-hero-identity');identity.dataset.kduIdentity='';parent.insertBefore(identity,h1);
      const copy=element(doc,'div','kd-hero-identity-copy');
      if(portrait){const picture=portrait.parentNode.tagName==='DIV'&&portrait.parentNode.children.length===1?portrait.parentNode:portrait;picture.classList.add('kd-hero-portrait');identity.append(picture);}
      identity.append(copy);copy.append(h1);
      if(subtitle)copy.append(subtitle);
      else {const meta=element(doc,'p','kd-hero-identity-meta');meta.textContent=`${COPY[locale].gen} ${record.generation} · ${COPY[locale][record.unit]||COPY[locale].unknown}${record.rarity?' · '+record.rarity:''}`;copy.append(meta);}
      const metadata=parent.querySelector(':scope > dl');if(metadata){metadata.classList.add('kd-hero-identity-facts');copy.append(metadata);}
    }
    let headings=[...host.querySelectorAll('h2')].filter(h=>!h.closest('[data-kdu-toc],.kd-hero-story'));
    // Explicit section wrappers move live nodes; original skill text and image listeners survive.
    const parent=headings[0]?.parentNode;
    if(parent&&!parent.classList.contains('kd-hero-section')){
      let section;
      for(const node of [...parent.childNodes]){
        if(node.nodeType===1&&node.tagName==='H2'){section=element(doc,'section','kd-hero-section');parent.insertBefore(section,node);}
        if(section&&node!==section)section.append(node);
      }
    }
    if(!host.querySelector('.kd-hero-story')){
      const summary=[...host.querySelectorAll('.kd-hero-section')].find(s=>s.querySelector(':scope > h2')?.textContent.trim()===STORY[locale].heading);
      let biography=summary;
      if(!biography){
        // The original static page keeps its entire biography in one paragraph
        // before the first skill/acquisition section. Preserve that exact node.
        biography=[...identity.parentNode.children].find(n=>n.tagName==='P'&&n.textContent.trim().length>180);
      }
      if(biography){const details=element(doc,'details','kd-hero-story');const label=element(doc,'summary');label.textContent=STORY[locale].label;biography.before(details);details.append(label,biography);}
    }
    headings=[...host.querySelectorAll('h2')].filter(h=>!h.closest('[data-kdu-toc],.kd-hero-story'));
    let nav=host.querySelector('[data-kdu-toc]');
    if(!nav){nav=element(doc,'nav','kd-hero-toc');nav.dataset.kduToc='';nav.setAttribute('aria-label',COPY[locale].contents);identity.after(nav);}
    headings.forEach((h,index)=>{if(!h.id)h.id='kd-hero-section-'+index;h.classList.add('kd-hero-section-title');});
    const html=headings.map(h=>`<a data-router-ignore="true" href="${text(root.location.pathname+root.location.search+'#'+h.id)}">${text(h.textContent)}</a>`).join('');if(nav.innerHTML!==html)nav.innerHTML=html;
    restoreHeroHash(doc,host);
    restoreHeroHistory(doc);
  }
  async function enhance(doc, locale) {
    const l=String(locale||'ko').toLowerCase();if(!COPY[l])return false;
    if(!data){loading ||= root.fetch('/data/ui/collections.json').then(r=>{if(!r.ok)throw Error('Collections model unavailable');return r.json();}).then(configure).catch(()=>{loading=null;return null;});await loading;}
    if(!data?.locales?.[l])return false;
    const content=doc.querySelector('#content')||doc.querySelector('main');if(!content)return false;
    const p=root.location.pathname.replace(/^\/(ko|en|ja)(?=\/)/,'').replace(/\/+$/,'');
    if(/^\/(heroes|hero\/jabel|research\/(academy|advanced-truegold))$/.test(p))content.classList.add('kd-ui');
    if(p==='/heroes')enhanceHeroes(doc,l,content);
    else if(p==='/hero/jabel')enhanceDetail(doc,l,content);
    else if(/^\/research\/(academy|advanced-truegold)$/.test(p))enhanceResearch(doc,l,content,p.split('/')[2]);
    return true;
  }
  function configure(value){data=value;return value;}
  root.KD_UI_COLLECTIONS={enhance,configure,normalizeState,stateFromUrl,stateUrl,heroMatches,compare};
  // Window capture runs before the existing document-capture SPA router.
  if(root.addEventListener){
    root.addEventListener('click',onHeroTocClick,{capture:true,passive:false});
    root.addEventListener('popstate',onHeroTocPop);
    root.addEventListener('hashchange',()=>{heroRestoreCancelled=true;if(pendingHeroHistory&&pendingHeroHistory.href!==root.location.href){pendingHeroHistory=null;heroRestoreVersion++;}});
    root.addEventListener('kd:page-ready',()=>{
      if(renderedHeroLocation!==root.location.pathname+root.location.search)renderedHeroLocation=null;
      if(!pendingHeroHistory)return;
      if(pendingHeroHistory.href!==root.location.href){pendingHeroHistory=null;heroRestoreVersion++;return;}
      pendingHeroHistory.ready=true;pendingHeroHistory.appliedHost=null;restoreHeroHistory(root.document);
    });
    // Same-document history can complete without a route-ready event. Restore
    // each rendered host once, but never override a later deliberate user scroll.
    for(const name of ['wheel','pointerdown','keydown'])root.addEventListener(name,()=>{pendingHeroHistory=null;},{passive:true});
  }
  if(typeof module==='object'&&module.exports)module.exports={...root.KD_UI_COLLECTIONS,restoreHeroHash,restoreHeroHistory,mountResearchDetail,selectResearch,drawResearchDetail};
})(typeof window!=='undefined'?window:globalThis);

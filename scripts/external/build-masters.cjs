'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const {page,esc,route}=require('./page.cjs');
const site=path.resolve(__dirname,'../..'),privateRoot=path.resolve(site,'../sources/masters');
const input=JSON.parse(fs.readFileSync(path.join(site,'data/ui/external/masters.json'),'utf8'));
const BASE='b2bceea6';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const t={
 ko:{title:'거장',intro:'거장별 스킬, 친밀도와 단계별 재료를 확인하세요.',find:'거장 이름 검색',all:'전체',known:'한국어 이름',english:'영문 이름',list:'거장 목록',skills:'스킬·특성',affinity:'친밀도',level:'레벨',rank:'관계 단계',unlock:'해금 조건',material:'거장 원고',xp:'학습 XP',effect:'효과',cost:'단계 비용',classes:'관계 단계와 해금',emblem:'문장',expertLevel:'필요 거장 레벨',links:'다른 거장',reference:'이 거장의 단계표는 영문 참고 자료 범위입니다. 한국어 명칭과 계산 기능은 제공하지 않습니다.',missingLocale:'한국어 명칭이 확인되지 않아 영문 이름과 표를 표시합니다.',supplement:'관계 단계별 해금 조건',read:'상세 보기',refTable:'영문 단계별 참고표',blank:'—'},
 en:{title:'Masters',intro:'Explore master skills, affinity, and materials by level.',find:'Search master names',all:'All',known:'Localized names',english:'English names',list:'Masters list',skills:'Skills & talent',affinity:'Affinity',level:'Level',rank:'Class',unlock:'Unlock requirements',material:"Master’s Manuscripts",xp:'Learning XP',effect:'Effect',cost:'Step cost',classes:'Class milestones & unlocks',emblem:'Emblems',expertLevel:'Required master level',links:'Other masters',reference:'These level tables are based on an English reference. They do not enable a master calculator.',missingLocale:'English names and tables are shown where a localized name is unavailable.',supplement:'Class milestones & unlocks',read:'View details',refTable:'English level reference',blank:'—'},
 ja:{title:'マスター',intro:'マスターごとのスキル、好感度、段階別の素材を確認できます。',find:'マスター名を検索',all:'すべて',known:'日本語名',english:'英語名',list:'マスター一覧',skills:'スキル・特性',affinity:'好感度',level:'レベル',rank:'関係段階',unlock:'解放条件',material:'原稿',xp:'学習XP',effect:'効果',cost:'段階コスト',classes:'関係段階と解放条件',emblem:'紋章',expertLevel:'必要マスターレベル',links:'ほかのマスター',reference:'このマスターの段階表は英語の参考資料に基づきます。日本語名と計算機能は提供していません。',missingLocale:'日本語名が確認できないため、英語名と表を表示しています。',supplement:'関係段階ごとの解放条件',read:'詳細を見る',refTable:'英語の段階別参考表',blank:'—'}
};
t['zh-tw']={title:'大師',intro:'查看各位大師的技能、好感度與各階段所需材料。',find:'搜尋大師名稱',all:'全部',known:'既有名稱',english:'原文名稱',list:'大師列表',skills:'技能與天賦',affinity:'好感度',level:'等級',rank:'關係階段',unlock:'解鎖條件',material:'大師手稿',xp:'學習經驗值',effect:'效果',cost:'階段消耗',classes:'關係階段與解鎖',emblem:'徽記',expertLevel:'需求大師等級',links:'其他大師',reference:'此大師的階段表依參考資料整理，不提供大師計算功能。',missingLocale:'',supplement:'關係階段的解鎖條件',read:'查看詳細資料',refTable:'階段參考表',blank:'—'};
const {localizeMaster,text:twText}=require('./tw-copy.cjs');
const selectedLocale=process.argv.includes('--locale')?process.argv[process.argv.indexOf('--locale')+1]:null;
if(selectedLocale&&!['ko','en','ja','zh-tw'].includes(selectedLocale))throw Error('Invalid locale');
const locales=selectedLocale?[selectedLocale]:['ko','en','ja'];
if(selectedLocale==='zh-tw')input.entries=input.entries.map(localizeMaster);
const records=[];
function name(e,l){return l==='zh-tw'?({pan:'潘',roman:'羅曼',valora:'瓦洛拉'}[e.slug]||e.names.en):(e.names[l]||e.names.en);}
function cell(v){return v===null||v===undefined||v===''?'—':String(v);}
function table(headers,rows,caption){return '<div class="kx-scroll" tabindex="0" role="region" aria-label="'+esc(caption)+'"><table class="kx-table"><caption>'+esc(caption)+'</caption><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map((v,i)=>'<'+(i?'td':'th scope="row"')+'>'+esc(cell(v))+'</'+(i?'td':'th')+'>').join('')+'</tr>').join('')+'</tbody></table></div>';}
function classRows(e){return e.reference.classes.map(c=>[c.class,c.name,c.requiredExpertLevel,c.emblemCost,c.unlocksSkills.map(id=>e.reference.skills.find(s=>s.id===id)?.name||id).join(', ')||'—']);}
function classTable(e,l){const w=t[l];return table([w.rank,l==='zh-tw'?'名稱':'Name',w.expertLevel,w.emblem,w.unlock],classRows(e),w.classes);}
function links(e,l){return '<nav class="kx-links" aria-label="'+esc(t[l].links)+'"><a href="'+route(l,'masters')+'">'+t[l].list+'</a>'+input.entries.filter(x=>x.id!==e.id).map(x=>'<a href="'+route(l,'masters/'+x.slug)+'">'+esc(name(x,l))+'</a>').join('')+'</nav>';}
function wikiTables(e,l){const chosen=e.localizations[l]||e.localizations.en,w=t[l];const groups=[];
 for(const tbl of chosen.tables){let group=groups.find(g=>g.heading===tbl.heading);if(!group){group={heading:tbl.heading,tables:[]};groups.push(group);}group.tables.push(tbl);}
 return groups.map((g,i)=>'<details class="kx-tech" id="master-table-'+i+'"><summary>'+esc(g.heading)+'</summary><div class="kx-tech-body">'+g.tables.map((x,j)=>table(x.headers,x.rows,g.heading+(g.tables.length>1?' · '+(j+1):''))).join('')+'</div></details>').join('');
}
function referenceTables(e,l){const w=t[l],r=e.reference;
 const affinity=table([w.level,w.affinity+' · '+w.cost,w.rank],r.levels.map(x=>[x.level,x.affinityDelta,x.needClass]),w.affinity);
 const sections=[{id:'affinity',name:w.affinity,html:affinity},{id:'classes',name:w.classes,html:classTable(e,l)}];
 for(const skill of r.skills){const required=r.classes.find(c=>c.class===skill.requires.class);const desc='<p>'+w.unlock+': '+esc(required?.name||skill.requires.class)+(skill.requires.expertLevel?' · '+esc(w.expertLevel)+' '+skill.requires.expertLevel:'')+'</p>';
  // These are explicit source fields. No derived source-site totals or calculator results are emitted.
  const headers=[w.level,...skill.valueLabels.map((v,i)=>v+(skill.isShowPercent[i]?' (%)':'')),w.material,w.xp];
  const rows=skill.levels.map(x=>[x.level,...skill.valueLabels.map((_,i)=>x.values[i]),x.manuscriptCost,x.expNeed]);
  sections.push({id:skill.id,name:skill.name,html:desc+table(headers,rows,skill.name)});
 }
 const talent=r.talent;sections.push({id:talent.id,name:talent.name,html:table([w.level,...talent.valueLabels.map((v,i)=>v+(talent.isShowPercent[i]?' (%)':''))],talent.levels.map(x=>[x.level,...x.values]),talent.name)});
 return sections.map(s=>'<details class="kx-tech" id="master-'+esc(s.id)+'"><summary>'+esc(s.name)+'</summary><div class="kx-tech-body">'+s.html+'</div></details>').join('');
}
function detailBody(e,l){const w=t[l],n=name(e,l);return '<nav class="kx-links"><a href="'+route(l,'masters')+'">'+w.list+'</a></nav><header class="kx-summary">'+(e.image?'<img src="'+esc(e.image)+'" alt="'+esc(n)+'" width="120" height="120">':'')+'<div><h1>'+esc(n)+'</h1><p>'+esc(e.reference.type)+'</p></div></header>'+(e.referenceOnly?'<p class="kx-note">'+esc(w.reference)+'</p>':!e.names[l]&&w.missingLocale?'<p class="kx-note">'+esc(w.missingLocale)+'</p>':'')+'<h2>'+w.skills+'</h2>'+(e.referenceOnly?referenceTables(e,l):wikiTables(e,l))+links(e,l);}
function alternates(e){const x=Object.fromEntries(['ko','en','ja'].map(l=>[l,route(l,'masters/'+e.slug)]));if(e.legacy||selectedLocale==='zh-tw')x['zh-TW']=route('zh-tw','masters/'+e.slug);return x;}
function original(rel){if(selectedLocale==='zh-tw')return cp.execFileSync('git',['show','HEAD:'+rel],{cwd:site,encoding:'utf8',maxBuffer:10*1024*1024});return cp.execFileSync('git',['show',BASE+':'+rel],{cwd:site,encoding:'utf8',maxBuffer:10*1024*1024});}
// Masters contain no calculator. The generic verification loader only injects a
// progress report here; omit this page-level loader without changing its policy.
function omitReportLoader(html){const removed=[];const result=html.replace(/<script\b[^>]*\bsrc=["']\/js\/data-verification\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gi,s=>{removed.push(s);return '';});return {html:result,removed};}
function hideLegacyReports(html){const tags=[];const result=html.replace(/<aside\b(?=[^>]*\bdata-verification-note\b)[^>]*>/gi,before=>{const after=before.replace('<aside','<aside hidden').replace(/style="/,'style="display:none!important;');tags.push({before,after});return after;});return {html:result,tags};}
function write(rel,html,kind,before=null,extra={}){if(selectedLocale==='zh-tw')html=require('./tw-copy.cjs').htmlBody(html).replace(/href="\/ko\/masters\//g,'href="/zh-tw/masters/').replace('提高 競技場商店 的 部隊 容量。','提高巨熊集結的部隊容量。').replace('提升 競技場商店 中的 英雄 能力值。','提升競技場戰鬥中的英雄能力值。');const dest=path.join(site,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,html);records.push({path:rel,kind,beforeSha256:before?hash(before):null,afterSha256:hash(html),...extra});}
function appendLegacy(e,l,rel){const before=original(rel);const marker='<!-- ks-ui15-masters:start -->';if(before.includes(marker)&&l!=='zh-tw')throw Error('Already patched baseline');
 const addition=marker+'<section id="master-milestones"><h2>'+esc(t[l].supplement)+'</h2><details class="kx-tech"><summary>'+esc(t[l].refTable)+'</summary><div class="kx-tech-body">'+classTable(e,l)+'</div></details>'+links(e,l)+'</section><!-- ks-ui15-masters:end -->';
 const refs='<link rel="stylesheet" href="/css/external-data.css?v=ks-ui15-20261012"><script defer src="/js/external-data.js?v=ks-ui15-20261012"></script>';
 if(!before.includes('</main>')||!before.includes('</head>'))throw Error('Missing exact legacy boundary '+rel);
 const filtered=omitReportLoader(before);const report=hideLegacyReports(filtered.html);const clean=report.html.replace(/<!-- ks-ui15-masters:start -->[\s\S]*?<!-- ks-ui15-masters:end -->/,'');const after=clean.replace('</head>',(clean.includes('/css/external-data.css')?'':refs)+'</head>').replace('</main>',addition+'</main>');
 if(l!=='zh-tw'&&after.replace(refs,'').replace(addition,'')!==report.html)throw Error('Legacy mutation beyond appended section and report presentation');
 write(rel,after,'legacy_detail_additive',before,{legacyContentExactAfterRemovingAdditions:true,addition,headAssets:refs,removedReportLoaders:filtered.removed,hiddenReportTags:report.tags});
}
function listing(l,rel,legacy=false){const w=t[l];const content='<header class="kx-intro"><h1>'+w.title+'</h1><p>'+w.intro+'</p></header><div class="kx-bar" data-kx-filter hidden><label>'+w.find+'<input type="search" autocomplete="off" maxlength="120" aria-label="'+w.find+'"></label><label>'+w.all+'<select><option value="all">'+w.all+'</option><option value="localized">'+w.known+'</option><option value="english">'+w.english+'</option></select></label><span role="status" aria-live="polite">8 / 8</span></div><div class="kx-grid">'+input.entries.map(e=>'<a class="kx-item" data-kx-entity="'+e.id+'" data-category="'+((l==='zh-tw'?e.legacy:e.names[l])?'localized':'english')+'" data-search="'+esc(name(e,l)+' '+Object.values(e.names).filter(Boolean).join(' ')+' '+e.slug)+'" href="'+route(l,'masters/'+e.slug)+'">'+(e.image?'<img src="'+esc(e.image)+'" alt="'+esc(name(e,l))+'" width="72" height="72" loading="lazy">':'')+'<div><h2>'+esc(name(e,l))+'</h2><p>'+esc(e.reference.type)+'</p>'+(!e.names[l]?'<span class="kx-badge">EN</span>':'')+'</div></a>').join('')+'</div>';
 const pathname=legacy?'/masters/':route(l,'masters');let html=page({locale:l,path:pathname,title:w.title+' | KingshotData',description:w.intro,body:content,alternates:{ko:'/ko/masters/',en:'/en/masters/',ja:'/ja/masters/','zh-TW':'/zh-tw/masters/'}});
 const before=original(rel);
 // Keep existing canonical, language alternates, title, and metadata exactly; append only common presentation assets.
 const filtered=omitReportLoader(before);const head=filtered.html.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)[0];const generated=html.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)[0];
 const knownAssets=new Set([...head.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m=>m[1].split('?')[0]));
 const assets=[...generated.matchAll(/<(?:script\b[^>]*\bsrc=[^>]*>[\s\S]*?<\/script>|link\b[^>]*rel="stylesheet"[^>]*>)/g)].map(m=>m[0]).filter(s=>!knownAssets.has(s.match(/(?:src|href)=["']([^"']+)["']/)[1].split('?')[0]));
 html=html.replace(generated,head.replace('</head>',assets.join('')+'</head>'));
 write(rel,html,'existing_list_expanded',before,{seoHeadPreserved:true,removedReportLoaders:filtered.removed});
}
for(const l of locales){
 listing(l,l+'/masters/index.html');
 for(const e of input.entries){const rel=l+'/masters/'+e.slug+'/index.html';
  if(e.legacy)appendLegacy(e,l,rel);
  else write(rel,page({locale:l,path:route(l,'masters/'+e.slug),title:name(e,l)+' · '+t[l].title+' | KingshotData',description:t[l].intro,body:detailBody(e,l),alternates:alternates(e),entityId:e.id}),'new_master_detail');
 }
}
// /masters/* are existing redirects; retain their original documents and destinations.
fs.mkdirSync(privateRoot,{recursive:true});fs.writeFileSync(path.join(privateRoot,'html-build.json'),JSON.stringify({schemaVersion:1,createdAt:new Date().toISOString(),baseCommit:cp.execFileSync('git',['rev-parse',BASE],{cwd:site,encoding:'utf8'}).trim(),releaseId:input.releaseId,records,counts:{pages:records.length,newDetails:records.filter(x=>x.kind==='new_master_detail').length,legacyDetails:records.filter(x=>x.kind==='legacy_detail_additive').length,listings:records.filter(x=>x.kind==='existing_list_expanded').length},preserved:[...(selectedLocale==='zh-tw'?['KO/EN/JA output files']:['Traditional Chinese files']),'Original legacy master prose, tables, numeric values and links','All calculator data/formulas/blocking','Existing master canonical/hreflang/metadata','Existing /masters/* redirect aliases'],copiedExternalNarrativeOrImages:false},null,2)+'\n');
console.log(JSON.stringify({release:input.releaseId,pages:records.length,newDetails:records.filter(x=>x.kind==='new_master_detail').length,legacyDetails:records.filter(x=>x.kind==='legacy_detail_additive').length,listings:locales.length}));

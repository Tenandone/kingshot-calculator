'use strict';
// Deterministic factual projection. The private source model is never published.
const fs=require('node:fs'),path=require('node:path');
const {page,esc}=require('./page.cjs');
const ROOT=path.resolve(__dirname,'../..');
const PRIVATE_MODEL=path.resolve(__dirname,'../../../sources/alliance/model.json');
const LOCALES=['ko','en','ja'];
const TEXT={
 ko:{title:'킹샷 연맹 과학 기술 | 성장·영지·전투 단계표',h1:'연맹 과학 기술',description:'킹샷 연맹 과학 기술의 성장·영지·전투 분류와 단계별 연맹 자원, 연구 시간, 효과와 선행 기술을 확인하세요.',intro:'성장·영지·전투 기술을 찾아 단계별 비용과 선행 기술을 확인하세요.',fallback:'공식 번역을 확보하지 못한 명칭과 설명은 영문으로 표시합니다.',scope:'비용은 연구를 시작할 때 쓰는 연맹 보유 자원입니다. 개인 기부 자원과 별개입니다.',missing:'—는 자료가 없거나 확정할 수 없는 항목입니다. 선행 기술이 비어 있어도 조건이 없다는 뜻은 아닙니다.',search:'기술 검색',placeholder:'영문 기술명 또는 별칭',category:'분류',all:'전체',growth:'성장',territory:'영지',battle:'전투',level:'레벨',bread:'연맹 식량',wood:'연맹 목재',stone:'연맹 석재',iron:'연맹 철',time:'연구 시간',effect:'효과',requirements:'선행 기술',table:'단계별 요구 사항',tier:'티어',max:'최대 레벨',count:'개 기술',stages:'단계',minutes:'분',hours:'시간',seconds:'초',instant:'즉시',tableRegion:'레벨별 비용 표, 가로로 스크롤 가능',filter:'기술 검색과 분류',samePage:'이 기술로 이동'},
 en:{title:'Kingshot Alliance Tech: Growth, Territory & Battle Tables',h1:'Alliance Technologies',description:'Browse Kingshot alliance technologies by Growth, Territory and Battle. Compare alliance resource costs, research time, effects and prerequisite technologies by level.',intro:'Find Growth, Territory and Battle technologies, then compare level costs and prerequisites.',fallback:'',scope:'Research costs use the alliance treasury. They are separate from each member’s personal resource donations.',missing:'— means a value is unavailable or unresolved. A blank prerequisite does not confirm that no prerequisite exists.',search:'Search technologies',placeholder:'Technology name or alias',category:'Tree',all:'All',growth:'Growth',territory:'Territory',battle:'Battle',level:'Level',bread:'Alliance Bread',wood:'Alliance Wood',stone:'Alliance Stone',iron:'Alliance Iron',time:'Research time',effect:'Effect',requirements:'Prerequisites',table:'Level requirements',tier:'Tier',max:'Max level',count:'technologies',stages:'levels',minutes:'m',hours:'h',seconds:'s',instant:'Instant',tableRegion:'Level costs table, scroll horizontally',filter:'Search and filter technologies',samePage:'Link to this technology'},
 ja:{title:'キングショット 同盟科学技術｜成長・領地・戦闘のレベル表',h1:'同盟科学技術',description:'キングショットの同盟科学技術を成長・領地・戦闘から検索。レベル別の同盟資源、研究時間、効果と前提技術を確認できます。',intro:'成長・領地・戦闘の技術を探し、レベル別の費用と前提技術を確認できます。',fallback:'公式翻訳が確認できない名称と説明は英語で表示しています。',scope:'研究費用は同盟が保有する資源です。メンバー個人の資源寄付とは別です。',missing:'—は未掲載または未確定の項目です。前提技術の空欄は、条件がないことを意味しません。',search:'技術を検索',placeholder:'英語の技術名または別名',category:'分類',all:'すべて',growth:'成長',territory:'領地',battle:'戦闘',level:'レベル',bread:'同盟食料',wood:'同盟木材',stone:'同盟石材',iron:'同盟鉄鉱',time:'研究時間',effect:'効果',requirements:'前提技術',table:'レベル別の条件',tier:'ティア',max:'最大レベル',count:'技術',stages:'レベル',minutes:'分',hours:'時間',seconds:'秒',instant:'即時',tableRegion:'レベル別費用表、横スクロールできます',filter:'技術の検索と分類',samePage:'この技術へのリンク'}
};
function project(source){
 const admitted=source.entities.filter(e=>e.publicationStatus==='display_candidate');
 const ids=new Set(admitted.map(e=>e.id));
 return{version:'ks-ui15-alliance-1',categories:['growth','territory','battle'],entities:admitted.map(e=>({id:e.id,slug:e.slug,type:'alliance_research',category:e.category,tier:e.tier,names:{ko:e.names.ko,en:e.names.en,ja:e.names.ja},descriptions:{ko:e.descriptions.ko,en:e.descriptions.en,ja:e.descriptions.ja},aliases:e.aliases,levels:e.levels.map(r=>({level:r.level,allianceCosts:r.allianceCosts?.map(c=>({resourceId:c.resourceId,value:c.value}))||null,timeSeconds:r.timeSeconds,effect:r.effect.displayRaw||null,prerequisites:(r.prerequisites||[]).filter(p=>p.resolved&&ids.has(p.entityId)).map(p=>({entityId:p.entityId,level:p.level})),requirementsIncomplete:r.prerequisiteStatus!=='resolved'||(r.prerequisites||[]).some(p=>!p.resolved||!ids.has(p.entityId))}))}))};
}
function duration(seconds,w){
 if(!Number.isInteger(seconds)||seconds<0)return '—';
 if(seconds===0)return w.instant;
 const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;
 return[h?`${h}${w.hours}`:'',m?`${m}${w.minutes}`:'',s?`${s}${w.seconds}`:''].filter(Boolean).join(' ');
}
function render(model,locale){
 const w=TEXT[locale],byId=new Map(model.entities.map(e=>[e.id,e]));
 const count=model.entities.length,stages=model.entities.reduce((n,e)=>n+e.levels.length,0),nf=new Intl.NumberFormat(locale);
 const categories=model.categories.map(c=>`<option value="${c}">${esc(w[c])}</option>`).join('');
 const body=`<header class="kx-intro"><h1>${esc(w.h1)}</h1><p>${esc(w.intro)}</p><p class="kx-muted">${count} ${esc(w.count)} · ${stages} ${esc(w.stages)}</p>${w.fallback?`<p class="kx-muted">${esc(w.fallback)}</p>`:''}</header>
<form class="kx-bar" data-kx-filter hidden role="search" aria-label="${esc(w.filter)}" action="/${locale}/alliance/tech/" method="get"><label for="alliance-q">${esc(w.search)}<input id="alliance-q" name="q" type="search" placeholder="${esc(w.placeholder)}" autocomplete="off" maxlength="120"></label><label for="alliance-category">${esc(w.category)}<select id="alliance-category" name="category"><option value="all">${esc(w.all)}</option>${categories}</select></label><output role="status" aria-live="polite">${count} / ${count}</output></form>
<p class="kx-note">${esc(w.scope)}</p><p class="kx-muted">${esc(w.missing)}</p>
<section aria-label="${esc(w.h1)}">${model.entities.map((e,index)=>{
 const name=e.names[locale]||e.names.en,description=e.descriptions[locale]||e.descriptions.en,search=[...Object.values(e.names),...(e.aliases?.en||[]),e.slug,e.category,w[e.category]].filter(Boolean).join(' ');
 const rows=e.levels.map(r=>{
  const costs=new Map((r.allianceCosts||[]).map(c=>[c.resourceId,c.value]));
  const requirements=r.prerequisites.map(p=>{const target=byId.get(p.entityId);return`<a href="#${esc(target.slug)}-level-${p.level}"><span lang="en">${esc(target.names[locale]||target.names.en)}</span> · Lv.${p.level}</a>`;});
  if(r.requirementsIncomplete)requirements.push('—');
  return`<tr class="kx-stage" id="${esc(e.slug)}-level-${r.level}"><th scope="row">${r.level}</th>${['bread','wood','stone','iron'].map(resource=>`<td>${costs.has('alliance_'+resource)?esc(nf.format(costs.get('alliance_'+resource))):'—'}</td>`).join('')}<td>${esc(duration(r.timeSeconds,w))}</td><td>${esc(r.effect||'—')}</td><td class="kx-text">${requirements.join('<br>')||'—'}</td></tr>`;
 }).join('\n');
 return`<details class="kx-tech" id="${esc(e.slug)}" data-kx-entity="${esc(e.id)}" data-search="${esc(search)}" data-category="${esc(e.category)}"${index===0?' open':''}><summary><span lang="en">${esc(name)}</span><small>${esc(w[e.category])} · ${esc(w.tier)} ${e.tier} · ${esc(w.max)} ${Math.max(...e.levels.map(r=>r.level))}</small></summary><div class="kx-tech-body">${description?`<p lang="en">${esc(description)}</p>`:''}<div class="kx-links"><a href="#${esc(e.slug)}" aria-label="${esc(name+' · '+w.samePage)}">${esc(w.samePage)}</a></div><div class="kx-scroll" role="region" tabindex="0" aria-label="${esc(name+' · '+w.tableRegion)}"><table class="kx-table"><caption><span lang="en">${esc(name)}</span> · ${esc(w.table)}</caption><thead><tr>${[w.level,w.bread,w.wood,w.stone,w.iron,w.time,w.effect,w.requirements].map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></div></details>`;
 }).join('\n')}</section>`;
 return page({locale,path:`/${locale}/alliance/tech/`,title:w.title,description:w.description,body,entityId:'ks:category:alliance-research'});
}
function build({sourcePath=PRIVATE_MODEL,root=ROOT}={}){
 const source=JSON.parse(fs.readFileSync(sourcePath,'utf8')),model=project(source);
 if(model.entities.length!==59||model.entities.flatMap(e=>e.levels).length!==278)throw Error('Unexpected public alliance scope');
 const out=path.join(root,'data/ui/external/alliance.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(model,null,2)+'\n');
 const files=['data/ui/external/alliance.json'];
 for(const locale of LOCALES){const file=path.join(root,locale,'alliance/tech/index.html');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,render(model,locale));files.push(`${locale}/alliance/tech/index.html`);}
 return{entities:model.entities.length,levels:model.entities.reduce((n,e)=>n+e.levels.length,0),locales:LOCALES,files};
}
module.exports={build,project,render,duration};
if(require.main===module)console.log(JSON.stringify(build(),null,2));

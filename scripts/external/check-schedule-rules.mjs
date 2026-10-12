// Read-only static projection of observed public bundles. Never imports, evaluates,
// saves, or publishes third-party executable code. Unknown syntax fails closed.
import crypto from 'node:crypto';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const origin='https://kingshot.net';
const chunk=/^\/_next\/static\/chunks\/[a-z0-9-]+\.js$/;
export function discoverRuleScripts(html,config){
 const observed=new Set([...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(m=>m[1]).filter(p=>chunk.test(p)));
 let flight='';
 for(const m of html.matchAll(/self\.__next_f\.push\((\[(?:[^<]|<(?!\/script>))*?\])\)<\/script>/g)){
  try{const p=JSON.parse(m[1]);if(typeof p[1]==='string')flight+=p[1];}catch{}
 }
 const imports=new Map();
 for(const m of flight.matchAll(/\bI\[(\d+),(\[[^\]\n]*\]),/g)){
  try{imports.set(m[1],JSON.parse(m[2]).filter(p=>observed.has(p)));}catch{}
 }
 const approved=(config.reviewedScripts||[]).filter(p=>observed.has(p));
 // A hash rotation must not cause a wide crawl. The reviewed route import's
 // non-shared tail is a bounded discovery fallback and still requires review.
 let candidates=imports.get(String(config.importModule))||[];
 if(config.subtractModule){const shared=new Set(imports.get(String(config.subtractModule))||[]);candidates=candidates.filter(p=>!shared.has(p));}
 else candidates=candidates.slice(-(config.maxScripts||3));
 const all=[...new Set([...approved,...candidates])];
 if(!all.length||all.length>(config.maxScripts||3))throw Error('Unrecognized or excessive public rule script set');
 return all.map(p=>origin+p);
}
function part(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);if(a<0||b<0)throw Error('Reviewed function signature is absent');return source.slice(a,b);}
function numeric(value){if(!/^[0-9]+(?:\.[0-9]+)?(?:e[0-9]+)?$/i.test(value||''))throw Error('Unrecognized numeric literal');return Number(value);}
export function projectCalendarScripts(scripts){
 const data=scripts.find(s=>s.text.includes('getCurrentCycleDayGrid')&&s.text.includes('37077,e=>'))?.text;
 const view=scripts.find(s=>s.text.includes('function H({viewMode:')&&s.text.includes('function K('))?.text;
 if(!data||!view)throw Error('Calendar data/view modules not discovered');
 const algorithm=part(data,'241947,e=>','getEventDatesForWeek",()=>n])');
 const anchor=algorithm.match(/new Date\("(\d{4}-\d{2}-\d{2}T00:00:00Z)"\)/)?.[1];
 if(!anchor||!algorithm.includes('%28+28)%28')||!algorithm.includes('864e5'))throw Error('Calendar anchor/period syntax changed');
 const raw=data.match(/37077,e=>\{e\.v\(JSON\.parse\('((?:\\.|[^'\\])*)'\)\)\}/)?.[1];
 if(!raw)throw Error('Calendar JSON literal is absent');
 // Only the surrounding single-quoted JS string apostrophe escape is decoded.
 // The remaining text must be valid JSON, never a JavaScript expression.
 const dataset=JSON.parse(raw.replace(/\\'/g,"'"));
 if(!Array.isArray(dataset.weeks)||dataset.weeks.length!==4)throw Error('Unexpected calendar week count');
 const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
 const rows=[];
 for(const w of dataset.weeks){
  if(!Number.isInteger(w.week)||w.week<1||w.week>4)throw Error('Unknown calendar week');
  for(const kind of ['events','packs']){
   if(!Array.isArray(w[kind])||w[kind].length>60)throw Error('Unexpected calendar rows');
   for(const e of w[kind]){
    if(typeof e.titleKey!=='string'||!days.includes(e.startDay)||!days.includes(e.endDay))throw Error('Unknown calendar event shape');
    rows.push({week:w.week,kind,key:e.titleKey,startDay:e.startDay,endDay:e.endDay});
   }
  }
 }
 return {kind:'calendar',anchorUtc:anchor,periodDays:28,rows,algorithmSha256:hash(algorithm),dayFilterSha256:hash(part(view,'function K(','function P(')),initialPositionSha256:hash(part(view,'function V(){','let en=e=>')),gridInputSha256:hash(part(view,'function H({','p=e=>'))};
}
export function projectTimerScripts(scripts){
 const timer=scripts.find(s=>s.text.includes('function ei()')&&s.text.includes('Next KvK'))?.text;
 const data=scripts.find(s=>s.text.includes('465893,e=>')&&s.text.includes('transferData'))?.text;
 if(!timer||!data)throw Error('Timer/transfer modules not discovered');
 const anchor=timer.match(/en=new Date\("([^"\n]+)"\)/)?.[1];
 const kvk=part(timer,'function ei()','function eo()'),transfer=part(timer,'function eo()','function el(');
 const mod=kvk.match(/t=\(e%([\de.]+)\+([\de.]+)\)%([\de.]+)/);
 const cutoffs=[...kvk.matchAll(/t<([\de.]+)\?/g)].map(m=>numeric(m[1]));
 const base=kvk.match(/r=(\d+)\+Math\.floor/);
 if(!/^\d{4}-\d{2}-\d{2}T00:00:00Z$/.test(anchor||'')||!mod||mod[1]!==mod[2]||mod[1]!==mod[3]||cutoffs.length!==2||!base)throw Error('Timer numeric rule syntax changed');
 const duration=transfer.match(/r\.startMs\+([\de.]+)\+([\de.]+)\+([\de.]+),r\.endMs/);
 const fallback=transfer.match(/a\.startMs\+([\de.]+)-e/);
 if(!duration||!fallback)throw Error('Transfer duration/fallback syntax changed');
 const sourceData=part(data,'465893,e=>','"transferData"');
 const windows=[...sourceData.matchAll(/\{date:"(\d{4}-\d{2}-\d{2})",endDate:"([^"\n]+)"/g)].map(m=>({startDate:m[1],endDateAsPublished:m[2]}));
 if(!windows.length||windows.length>80)throw Error('Unrecognized transfer windows');
 return {kind:'timers',kvk:{anchorUtc:anchor,periodMs:numeric(mod[1]),cutoffsMs:cutoffs,baseNumber:Number(base[1])},transfer:{phaseDurationsMs:duration.slice(1).map(numeric),fallbackMs:numeric(fallback[1]),windows},kvkFunctionSha256:hash(kvk),transferFunctionSha256:hash(transfer),formatFunctionSha256:hash(part(timer,'function es(','function ei()')),transferDataSha256:hash(sourceData)};
}
export async function checkScheduleRules({html,config,fetchImpl=fetch,bodyLimited}){
 const urls=discoverRuleScripts(html,config),scripts=[],receipts=[];
 for(const url of urls){
  // urls are constructed exclusively from observed, same-origin static paths.
  const response=await fetchImpl(url,{redirect:'manual',headers:{'User-Agent':'KingShotData source-change check (+https://kingshotdata.kr/about/)','Accept':'text/javascript, application/javascript'},signal:AbortSignal.timeout(20000)});
  if(response.status!==200){const error=Error('Public script HTTP '+response.status+'; no retry or redirect');error.rateLimited=response.status===429;throw error;}
  if(!/(?:javascript|ecmascript|text\/plain)/i.test(response.headers.get('content-type')||''))throw Error('Unexpected script content type');
  const text=await bodyLimited(response);scripts.push({url,text});receipts.push({url,sha256:hash(text),bytes:Buffer.byteLength(text)});
 }
 const projection=config.kind==='calendar'?projectCalendarScripts(scripts):config.kind==='timers'?projectTimerScripts(scripts):null;
 if(!projection)throw Error('Unknown reviewed rule type');
 const projectionSha256=hash(JSON.stringify(projection));
 return {kind:config.kind,status:projectionSha256===config.expectedProjectionSha256?'unchanged':'review-required',projection,projectionSha256,expectedProjectionSha256:config.expectedProjectionSha256,scripts:receipts,thirdPartyCodeExecuted:false,thirdPartyCodeStored:false,publicationAllowed:false};
}

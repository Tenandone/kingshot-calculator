// Read-only source monitor. It writes an evidence artifact, never reviewed site data.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),site=path.resolve(here,'../..');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const allowedHosts=new Set(['kingshot.net','kingshotwiki.com','kingshot.wiki','kingshotdata.com']);
export function allowedURL(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&allowedHosts.has(u.hostname)&&!/^\/(?:api|admin|dashboard|profile|auth)(?:\/|$)/i.test(u.pathname);}catch{return false;}
}
export function visibleText(html){
 return html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ').replace(/<[^>]*>/g,' ').replace(/&#(?:x([\da-f]+)|(\d+));/gi,(_,h,d)=>{const n=parseInt(h||d,h?16:10);return n<=0x10ffff?String.fromCodePoint(n):' ';}).replace(/&(?:nbsp|amp|lt|gt|quot|apos);/g,s=>({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[s])).replace(/\s+/g,' ').trim();
}
export function project(html,kind){
 if(kind==='transfer-window'){
  const dates=[...html.matchAll(/<time\b[^>]*\bdatetime=["'](\d{4}-\d{2}-\d{2})["'][^>]*>/gi)].map(m=>m[1]);
  const groupList=html.match(/<ul\b[^>]*aria-label=["']Transfer groups["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1]||'';
  const groups=[...groupList.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>visibleText(m[1])).filter(t=>/^\d+-\d+$/.test(t));
  const text=visibleText(html);
  return {startDate:dates[0]||null,endDateInclusive:dates[1]||null,groups,provisionalWarningPresent:/Numbers and ranges may shift/i.test(text),fanSiteDisclosure:/fan-made website/i.test(text)};
 }
 if(kind==='visible-text')return {textSha256:hash(visibleText(html))};
 throw Error('Unsupported projection: '+kind);
}
export function compareSource(source,html){
 const currentProjection=project(html,source.projection),bodySha256=hash(html),projectionSha256=hash(JSON.stringify(currentProjection));
 const factsChanged=projectionSha256!==source.expectedProjectionSha256;
 return {id:source.id,url:source.url,observedAt:new Date().toISOString(),status:factsChanged?'review-required':bodySha256!==source.expectedBodySha256?'markup-changed':'unchanged',expectedBodySha256:source.expectedBodySha256,bodySha256,expectedProjectionSha256:source.expectedProjectionSha256,projectionSha256,currentProjection,renderedReviewRequired:!!source.renderedReviewRequired,publicationAllowed:false};
}
async function bodyLimited(response){
 const limit=3*1024*1024;
 if(Number(response.headers.get('content-length'))>limit)throw Error('Response exceeds limit');
 const chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.byteLength;if(size>limit)throw Error('Response exceeds limit');chunks.push(chunk);}
 return Buffer.concat(chunks).toString('utf8');
}
export async function checkSources({registry,output,fetchImpl=fetch}){
 const out=path.resolve(output),relative=path.relative(site,out);
 if(!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative))throw Error('Evidence output must be outside the published repository');
 if(!Array.isArray(registry.sources)||registry.sources.length>40)throw Error('Invalid source registry');
 for(const s of registry.sources)if(!/^[a-z0-9-]+$/.test(s.id)||!allowedURL(s.url))throw Error('Source URL/id is outside approved public scope');
 fs.mkdirSync(out,{recursive:true});const results=[];let rateLimited=false;
 // Deliberately sequential: no automatic retries, auth, API or publication step.
 for(const source of registry.sources){
  if(rateLimited){results.push({id:source.id,status:'not-requested-after-rate-limit',publicationAllowed:false});continue;}
  try{
   const response=await fetchImpl(source.url,{redirect:'manual',headers:{'User-Agent':'KingShotData source-change check (+https://kingshotdata.kr/about/)','Accept':'text/html'},signal:AbortSignal.timeout(20000)});
   if(response.status===429){rateLimited=true;throw Error('HTTP 429; remaining requests stopped');}
   if(response.status!==200)throw Error('HTTP '+response.status+'; no redirect/retry attempted');
   if(!/text\/html|application\/xhtml/i.test(response.headers.get('content-type')||''))throw Error('Unexpected content type');
   const html=await bodyLimited(response);const record=compareSource(source,html);results.push(record);
   // Keep public workflow artifacts factual: hashes and extracted schedule fields,
   // not third-party page code, prose or image payloads.
  }catch(error){results.push({id:source.id,url:source.url,status:'access-unconfirmed',error:String(error.message),publicationAllowed:false});}
 }
 const report={schemaVersion:1,checkedAt:new Date().toISOString(),mode:'read-only-review-artifact',automaticPublication:false,requestsSequential:true,sources:results,reviewRequired:results.some(r=>r.status!=='unchanged'),accessFailures:results.filter(r=>r.status==='access-unconfirmed').length};
 fs.writeFileSync(path.join(out,'source-changes.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=flag=>{const at=args.indexOf(flag);return at<0?null:args[at+1];};
 const registryPath=value('--registry')||path.join(here,'schedule-sources.json'),output=value('--output');
 if(!output)throw Error('Provide --output pointing outside the public repository');
 const report=await checkSources({registry:JSON.parse(fs.readFileSync(registryPath,'utf8')),output});
 console.log(JSON.stringify({sources:report.sources.length,reviewRequired:report.reviewRequired,accessFailures:report.accessFailures,automaticPublication:false}));
 if(report.accessFailures)process.exitCode=1;
}

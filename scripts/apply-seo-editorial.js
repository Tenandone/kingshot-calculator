'use strict';
// Apply only approved editorial head fields. Never run content/data generators.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const runtime = require('../js/seo-editorial');
const {classification} = require('./apply-design-system');
const ROOT = path.resolve(__dirname,'..');
const START='<!-- ks-ui14-seo:start -->', END='<!-- ks-ui14-seo:end -->';
const BLOCK=START+'\n<script defer src="/js/seo-editorial.js?v='+runtime.VERSION+'"></script>\n'+END;
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const esc=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function attrs(tag) {return Object.fromEntries([...tag.matchAll(/\s([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m=>[m[1].toLowerCase(),m[2]??m[3]]));}
function canonical(html) {for(const tag of html.match(/<link\b[^>]*>/gi)||[]){const a=attrs(tag);if(a.rel==='canonical')return a.href;}return null;}
function updateContent(tag,value) {
  if (/\scontent\s*=/i.test(tag)) return tag.replace(/(\scontent\s*=\s*)(["'])([\s\S]*?)\2/i,(_,lead,quote)=>lead+quote+esc(value)+quote);
  return tag.replace(/\s*\/?>(\s*)$/, ' content="'+esc(value)+'">$1');
}
function stripRuntime(html) {
  const starts=html.split(START).length-1,ends=html.split(END).length-1;let pairs=0;
  const clean=html.replace(/<!-- ks-ui14-seo:start -->[\s\S]*?<!-- ks-ui14-seo:end -->/g,()=>{pairs++;return '';});
  if(starts!==ends||pairs!==starts)throw Error('Malformed editorial runtime marker');return clean;
}
function applyDocument(html,relative,model) {
  const kind=classification(relative,html).kind;
  if(kind==='excluded')return {html,entry:null};
  const url='/'+relative.replace(/index\.html$/,'');
  const entry=kind==='operational'?runtime.selectEntry(model,url,canonical(html)):null;
  stripRuntime(html); // Validate marker balance without moving an existing block.
  let result=html;
  result=result.replace(/(<head\b[^>]*>)([\s\S]*?)(<\/head\s*>)/i,(_,open,head,close)=>{
    const seen=new Set();let titleSeen=false;
    // Keep the approved coupon intro refresh reachable after a publishing pass.
    head=head.replace(/(<script\b[^>]*\bsrc=["'])\/js\/guide-features\.js\?v=ks-ui12-20261012(["'])/g,
      '$1/js/guide-features.js?v=ks-ui14-20261012$2');
    if(entry)head=head.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<title\b[^>]*>[\s\S]*?<\/title\s*>|<meta\b[^>]*>/gi,tag=>{
      if(/^<title\b/i.test(tag)){titleSeen=true;return tag.replace(/(^<title\b[^>]*>)[\s\S]*?(<\/title\s*>$)/i,(_,a,b)=>a+esc(entry.title)+b);}
      if(/^<meta\b/i.test(tag)){
        const a=attrs(tag),rule=runtime.META.find(([key,value])=>a[key]===value);
        if(rule){seen.add(rule[1]);return updateContent(tag,entry[rule[2]]);}return tag;
      }
      const opening=tag.slice(0,tag.indexOf('>')+1);
      if(attrs(opening).type!=='application/ld+json')return tag;
      return tag.replace(/(^<script\b[^>]*>)([\s\S]*?)(<\/script\s*>$)/i,(all,a,text,b)=>{
        try{const updated=runtime.updateSchema(JSON.parse(text),entry);return updated.changed?a+runtime.safeJson(updated.value)+b:all;}catch{return all;}
      });
    });
    if(entry){
      if(!titleSeen)head+='<title>'+esc(entry.title)+'</title>\n';
      for(const [key,value,field] of runtime.META)if(!seen.has(value))head+='<meta '+key+'="'+value+'" content="'+esc(entry[field])+'">\n';
    }
    if(head.includes(START)){
      let replaced=false;
      head=head.replace(/<!-- ks-ui14-seo:start -->[\s\S]*?<!-- ks-ui14-seo:end -->/g,()=>{
        if(replaced)return '';replaced=true;return BLOCK;
      });
    }else head+=BLOCK;
    return open+head+close;
  });
  return {html:result,entry};
}
function applySeoEditorial(options={}) {
  const root=path.resolve(options.root||ROOT),file=path.join(root,'data/seo/editorial.json');
  const model=runtime.readModel(JSON.parse(fs.readFileSync(file,'utf8')));
  const reportFile=options.report?path.resolve(options.report):null;
  if(reportFile&&(reportFile===root||reportFile.startsWith(root+path.sep)))throw Error('Keep SEO evidence outside the public root');
  const rows=[],mapped=new Set(),writes=[];
  function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    if(e.name.startsWith('.')||e.name==='node_modules'||e.isSymbolicLink())continue;
    const absolute=path.join(dir,e.name);if(e.isDirectory()){walk(absolute);continue;}if(!e.name.endsWith('.html'))continue;
    const relative=path.relative(root,absolute).replace(/\\/g,'/'),before=fs.readFileSync(absolute,'utf8');
    const result=applyDocument(before,relative,model);if(result.entry)mapped.add(runtime.pathKey(result.entry.path));
    if(before===result.html)continue;
    const body=value=>value.match(/<body\b[^>]*>[\s\S]*$/i)?.[0]||'';
    if(body(before)!==body(result.html))throw Error('Body mutation refused: '+relative);
    rows.push({path:relative,editorialPath:result.entry?.path||null,beforeSha256:hash(before),afterSha256:hash(result.html),bodyUnchanged:true});
    writes.push({absolute,html:result.html});
  }}
  walk(root);
  const unresolved=[...model.pages].filter(([key])=>!mapped.has(key)).map(([,entry])=>entry.path);
  if(unresolved.length)throw Error('Editorial path has no exact existing canonical document: '+unresolved.join(', '));
  if(!options.check)for(const write of writes)fs.writeFileSync(write.absolute,write.html);
  const report={version:model.version,assetVersion:runtime.VERSION,createdAt:new Date().toISOString(),mode:options.check?'check':'apply',summary:{approvedEntries:model.pages.size,changedFiles:rows.length,changedEditorialFiles:rows.filter(r=>r.editorialPath).length},files:rows};
  if(reportFile){fs.mkdirSync(path.dirname(reportFile),{recursive:true});fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');}
  return report;
}
module.exports={START,END,BLOCK,attrs,canonical,stripRuntime,applyDocument,applySeoEditorial};
if(require.main===module){const args=process.argv.slice(2),i=args.indexOf('--report');if(i>=0&&!args[i+1])throw Error('--report requires a path');const report=applySeoEditorial({check:args.includes('--check'),report:i>=0?args[i+1]:undefined});console.log(JSON.stringify(report.summary));if(args.includes('--check')&&report.summary.changedFiles)process.exitCode=1;}

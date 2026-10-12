'use strict';

// Repair static, same-document anchors affected by <base>. No runtime or body rewrite.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { classification } = require('./apply-design-system.js');
const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://kingshotdata.kr';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
let parser;
async function getParser() {
  if (!parser) parser = await import(pathToFileURL(require.resolve('parse5')).href);
  return parser;
}
const attr = (node, name) => (node.attrs || []).find(item => item.name === name)?.value;
function elements(document) {
  const result = [];
  function visit(node) {
    if (node.tagName) result.push(node);
    // Template content is not part of the current, rendered document.
    if (node.tagName === 'template') return;
    for (const child of node.childNodes || []) visit(child);
  }
  visit(document);
  return result;
}
function protectedSignature(document) {
  const nodes = elements(document);
  function text(node) {
    if (node.nodeName === '#text') return node.value;
    return (node.childNodes || []).map(text).join('');
  }
  return JSON.stringify({
    allText:text(document),
    headings:nodes.filter(n => /^h[1-6]$/.test(n.tagName)).map(text),
    tableCells:nodes.filter(n => /^(td|th)$/.test(n.tagName)).map(text),
    scripts:nodes.filter(n => n.tagName === 'script').map(n => [n.attrs,text(n)]),
    metadata:nodes.filter(n => n.tagName === 'meta' || n.tagName === 'title' ||
      (n.tagName === 'link' && /(?:canonical|alternate)/i.test(attr(n,'rel') || '')))
      .map(n => [n.tagName,n.attrs,text(n)])
  });
}
function quotedValue(raw, value) {
  const match = /^(\s*[^\s=]+\s*=\s*)(?:"([\s\S]*)"|'([\s\S]*)'|([^\s]+))$/.exec(raw);
  if (!match) throw new Error('Cannot safely locate href value.');
  const quote = match[2] !== undefined ? '"' : match[3] !== undefined ? "'" : '';
  let safe = value.replace(/&/g, '&amp;');
  if (quote === '"') safe = safe.replace(/"/g, '&quot;');
  else if (quote === "'") safe = safe.replace(/'/g, '&#39;');
  else if (/[\s"'`=<>]/.test(safe)) throw new Error('Unsafe unquoted href; refusing to change quote style.');
  return match[1] + quote + safe + quote;
}
async function normalizeHtml(html, relative) {
  const selection = classification(relative, html);
  if (selection.kind !== 'operational') return {html,selection,changes:[],skipped:[],preserved:true};
  const { parse } = await getParser();
  const document = parse(html, {sourceCodeLocationInfo:true});
  const nodes = elements(document);
  const canonicals = nodes.filter(n => n.tagName === 'link' &&
    (attr(n,'rel') || '').toLowerCase().split(/\s+/).includes('canonical'));
  const skipped = [];
  if (canonicals.length !== 1) return {html,selection,changes:[],skipped:[{reason:'Missing or multiple canonical URLs'}],preserved:true};
  let canonical;
  try { canonical = new URL(attr(canonicals[0],'href'), ORIGIN); } catch (_) {}
  if (!canonical || canonical.origin !== ORIGIN || canonical.hash) {
    return {html,selection,changes:[],skipped:[{reason:'Canonical URL is not a valid same-origin document'}],preserved:true};
  }
  const baseNode = nodes.find(n => n.tagName === 'base' && attr(n,'href') !== undefined);
  if (!baseNode) return {html,selection,changes:[],skipped,preserved:true};
  let base;
  try { base = new URL(attr(baseNode,'href'), canonical); } catch (_) {}
  if (!base) return {html,selection,changes:[],skipped:[{reason:'Invalid base URL'}],preserved:true};
  if (base.origin !== canonical.origin) return {html,selection,changes:[],skipped:[{reason:'External base URL requires separate review'}],preserved:true};
  const targets = new Set(nodes.flatMap(n => [attr(n,'id'), n.tagName === 'a' ? attr(n,'name') : null]).filter(Boolean));
  const changes = [];
  for (const node of nodes) {
    if (node.tagName !== 'a') continue;
    const href = attr(node,'href');
    if (!href || !href.startsWith('#')) continue;
    if (href === '#' || /^#(?:\/|goal)/i.test(href) || href.includes(':~:text=')) {
      skipped.push({href,reason:'Empty fragment or application/state/text-fragment link'}); continue;
    }
    let id;
    try { id = decodeURIComponent(href.slice(1)); } catch (_) {
      skipped.push({href,reason:'Invalid fragment encoding'}); continue;
    }
    if (!targets.has(id)) { skipped.push({href,reason:'No matching target in this static document'}); continue; }
    const resolved = new URL(href, base);
    if (resolved.origin === canonical.origin && resolved.pathname === canonical.pathname && resolved.search === canonical.search) continue;
    const location = node.sourceCodeLocation?.attrs?.href;
    if (!location) { skipped.push({href,reason:'No original source location'}); continue; }
    const before = html.slice(location.startOffset,location.endOffset);
    const target = canonical.pathname + canonical.search + href;
    let after;
    try { after = quotedValue(before,target); } catch (error) {
      skipped.push({href,reason:error.message}); continue;
    }
    changes.push({start:location.startOffset,end:location.endOffset,line:location.startLine,
      oldHref:href,newHref:target,targetId:id,before,after});
  }
  let output = html;
  for (const change of [...changes].sort((a,b) => b.start-a.start)) {
    output = output.slice(0,change.start) + change.after + output.slice(change.end);
  }
  // Exact splice reconstruction proves all bytes outside the selected attributes remain untouched.
  let cursor = 0, reconstructed = '';
  for (const change of changes.sort((a,b) => a.start-b.start)) {
    reconstructed += html.slice(cursor,change.start) + change.after; cursor=change.end;
  }
  reconstructed += html.slice(cursor);
  const preserved = reconstructed === output && protectedSignature(document) === protectedSignature(parse(output));
  if (!preserved) throw new Error('Protected HTML content changed: ' + relative);
  return {html:output,selection,canonical:canonical.href,changes,skipped,preserved};
}
function htmlFiles(root) {
  const files=[];
  function walk(dir) {
    for (const item of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b) => a.name.localeCompare(b.name,'en'))) {
      if (item.isSymbolicLink() || item.name.startsWith('.') || item.name==='node_modules') continue;
      const file=path.join(dir,item.name);
      if (item.isDirectory()) walk(file); else if (/\.html$/i.test(item.name)) files.push(file);
    }
  }
  walk(root); return files;
}
async function normalizeStaticAnchors(options={}) {
  const root=path.resolve(options.root || ROOT), apply=options.apply === true;
  const reportPath=options.report ? path.resolve(options.report) : null;
  if (reportPath && (reportPath===root || reportPath.startsWith(root+path.sep))) throw new Error('Audit output must be outside the published site.');
  const pages=[], excluded=[];
  for (const file of htmlFiles(root)) {
    const relative=path.relative(root,file).replace(/\\/g,'/');
    const before=fs.readFileSync(file,'utf8');
    const result=await normalizeHtml(before,relative);
    if (result.selection.kind !== 'operational') { excluded.push({path:relative,...result.selection}); continue; }
    const row={path:relative,canonical:result.canonical,changed:result.changes.length>0,
      beforeSha256:sha(before),afterSha256:sha(result.html),preserved:result.preserved,
      changes:result.changes.map(({before,after,start,end,...change})=>change),skipped:result.skipped};
    pages.push(row);
    if (apply && row.changed) fs.writeFileSync(file,result.html);
  }
  const report={schema:'ks-static-anchor-normalization-v1',createdAt:new Date().toISOString(),mode:apply?'apply':'dry-run',
    summary:{operationalPages:pages.length,excludedFiles:excluded.length,changedFiles:pages.filter(p=>p.changed).length,
      changedLinks:pages.reduce((n,p)=>n+p.changes.length,0),allProtectedContentPreserved:pages.every(p=>p.preserved)},
    preservation:'Only href attribute values for existing same-document targets change. Exact original text, heading and table text, scripts, canonical, hreflang and metadata are verified unchanged.',pages,excluded};
  if (reportPath) { fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n'); }
  return report;
}
module.exports={normalizeHtml,normalizeStaticAnchors};
if (require.main===module) {
  const args=process.argv.slice(2), value=name=>{const i=args.indexOf(name);if(i<0)return undefined;if(!args[i+1])throw new Error(name+' requires a value');return args[i+1];};
  normalizeStaticAnchors({apply:args.includes('--apply'),root:value('--root'),report:value('--report')})
    .then(report=>console.log(JSON.stringify({mode:report.mode,...report.summary})))
    .catch(error=>{console.error(error.stack);process.exitCode=1;});
}

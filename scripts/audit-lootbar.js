'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { parse } = require('parse5');
const { LOOTBAR_ENABLED } = require('../js/site-features');
const root = path.resolve(__dirname, '..');
const issues = [], notices = [];
let checked = 0;
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.name.startsWith('.') || ['node_modules', 'dist', '_lootbar'].includes(e.name)) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith('.html') ? [p] : [];
  });
}
function nodes(n) { return [n, ...(n.childNodes || []).flatMap(nodes)]; }
const attr = (n, k) => (n.attrs || []).find(a => a.name === k)?.value || '';
function visibleText(n) {
  if (['script', 'style', 'template'].includes(n.tagName)) return '';
  if (n.nodeName === '#text') return n.value;
  return (n.childNodes || []).map(visibleText).join(' ');
}
if (LOOTBAR_ENABLED) throw Error('This audit checks the disabled publishing state.');
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
if (/topup-(guide|promotion)/.test(sitemap)) issues.push({ file: 'sitemap.xml', issue: 'Inactive guide indexed' });
for (const file of walk(root)) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const html = fs.readFileSync(file, 'utf8');
  const doc = parse(html), all = nodes(doc);
  checked++;
  const problem = issue => issues.push({ file: rel, issue });
  if (/lootbar|루트바/i.test(visibleText(doc))) problem('Brand visible in document');
  if (/^[ \t]*NaN[ \t]*$/m.test(html)) problem('Malformed HTML');
  if (html.includes('footer-tools.js') && !html.includes('/js/site-features.js')) problem('Missing runtime feature config');
  for (const n of all) {
    if (['a', 'iframe', 'img'].includes(n.tagName) && /lootbar|topup-(guide|promotion)|kingshot1\/5567/i.test(attr(n, 'href') + attr(n, 'src'))) problem('Promotion link or resource exposed');
    if (n.tagName === 'meta' && /lootbar|Kingshot top up/i.test(attr(n, 'content'))) problem('Promotion metadata exposed');
    if (n.tagName === 'script' && !attr(n, 'src') && !['application/ld+json', 'application/json', 'module'].includes(attr(n, 'type'))) {
      try { new vm.Script((n.childNodes || []).map(c => c.value || '').join('')); } catch (e) { problem('Inline JavaScript syntax: ' + e.message); }
    }
  }
  if (/(?:^|\/)topup-(guide|promotion)\.html$/.test(rel)) {
    notices.push(rel);
    if (!all.some(n => n.tagName === 'meta' && attr(n, 'name') === 'robots' && /noindex/.test(attr(n, 'content')))) problem('Notice missing noindex');
    if (visibleText(doc).trim().length < 80 || !all.some(n => n.tagName === 'a')) problem('Empty notice');
    if (all.some(n => n.tagName === 'meta' && attr(n, 'http-equiv') === 'refresh')) problem('Unexpected redirect');
  }
}
const result = { featureFlag: LOOTBAR_ENABLED, htmlFilesChecked: checked, notices, issues };
fs.mkdirSync(path.join(root, '.audit'), { recursive: true });
fs.writeFileSync(path.join(root, '.audit/lootbar.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (issues.length) process.exitCode = 1;

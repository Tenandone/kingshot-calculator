'use strict';

// Presentation-only publishing pass. Original HTML and SEO remain byte-for-byte
// intact outside the dedicated marker; source fragments and aliases stay separate.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const VERSION = 'ks-symbol-20261012';
const HUB_VERSION = 'ks-ui17-20261012';
const START = '<!-- ks-ui13-design:start -->';
const END = '<!-- ks-ui13-design:end -->';
const ASSETS = Object.freeze([
  'css/design-system.css', 'css/design-home.css', 'css/design-guides.css',
  'css/design-data.css', 'css/editorial-home.css', 'css/editorial-adapter.css',
  'js/editorial-home.js', 'js/design-system.js', 'js/design-guides.js'
]);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function headBlock(newline = '\n') {
  return [START,
    `<link rel="icon" type="image/x-icon" sizes="16x16 32x32 48x48" href="/favicon.ico?v=${VERSION}">`,
    `<link rel="icon" type="image/png" sizes="16x16" href="/img/brand/favicon-16.png?v=${VERSION}">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="/img/brand/favicon-32.png?v=${VERSION}">`,
    `<link rel="icon" type="image/png" sizes="48x48" href="/img/brand/favicon-48.png?v=${VERSION}">`,
    `<link rel="apple-touch-icon" sizes="180x180" href="/img/brand/apple-touch-icon.png?v=${VERSION}">`,
    `<link rel="manifest" href="/site.webmanifest?v=${VERSION}">`, ...ASSETS.map(file => file.endsWith('.css')
    ? `<link rel="stylesheet" href="/${file}?v=${VERSION}">`
    : `<script defer src="/${file}?v=${VERSION}"></script>`), END].join(newline);
}

function stripDesignBlock(html) {
  const starts = html.split(START).length - 1;
  const ends = html.split(END).length - 1;
  const pattern = /<!-- ks-ui13-design:start -->[\s\S]*?<!-- ks-ui13-design:end -->/g;
  let pairs = 0;
  let clean = html.replace(pattern, () => { pairs++; return ''; });
  if (starts !== ends || pairs !== starts || clean.includes(START) || clean.includes(END)) {
    throw new Error('Unbalanced design markers; refusing to rewrite HTML.');
  }
  // External-data pages formerly linked a subset outside the shared marker.
  // Normalize only these presentation tags so the final asset is loaded once.
  for(const file of ASSETS){const escaped=file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');clean=clean.replace(new RegExp('<(?:link|script)\\b[^>]*(?:href|src)=["\']/'+escaped+'(?:\\?[^"\']*)?["\'][^>]*>(?:\\s*</script>)?', 'gi'),'');}
  return clean;
}

function classification(relative, html) {
  const file = relative.replace(/\\/g, '/');
  if (/^(?:pages|src|reports|scripts|public|_lootbar|dist)\//.test(file)) {
    return {kind:'excluded', reason:file.startsWith('pages/') ? 'SPA/source document; public shell supplies the design' : 'Source, report, backup or generated-build directory'};
  }
  if (file.startsWith('templates/') && file !== 'templates/spa-shell.html') {
    return {kind:'excluded', reason:'Non-publishing template'};
  }
  if (/^naver-site-verification:/.test(html.trim())) {
    return {kind:'excluded', reason:'Ownership verification protocol payload'};
  }
  if (!/<html\b/i.test(html) || !/<head\b/i.test(html) || !/<\/head\s*>/i.test(html) || !/<body\b/i.test(html)) {
    return {kind:'excluded', reason:'HTML fragment rather than a navigable full document'};
  }
  if (file === 'templates/spa-shell.html') return {kind:'template', reason:'Public static-route generation template'};
  if (file === '404.html') return {kind:'operational', reason:'SPA error-entry shell; redirect logic preserved'};
  if (/<meta\b[^>]*http-equiv=["']refresh["']/i.test(html) || /Kingshot legacy redirect: generated|<title[^>]*>\s*Redirecting/i.test(html)) {
    return {kind:'excluded', reason:'Existing redirect alias; destination receives the design'};
  }
  // Match the established experiment boundary in apply-index-policy.js.
  if (file.startsWith('tools/') && file !== 'tools/coupon-countdown.html') {
    return {kind:'excluded', reason:'Experimental or duplicate tool under the existing index policy'};
  }
  return {kind:'operational', reason:'Navigable published HTML; existing index/noindex policy preserved'};
}

function injectDesign(html, relative) {
  const selection = classification(relative, html);
  const normalizeCache=value=>value.replace(/\/js\/hub\.js\?v=[^"'\s<>]+/g, '/js/hub.js?v='+HUB_VERSION);
  const clean = normalizeCache(stripDesignBlock(html));
  const block = headBlock(html.includes('\r\n') ? '\r\n' : '\n');
  const after = selection.kind === 'excluded' ? clean
    : clean.replace(/<\/head\s*>/i, close => block + close);
  if (normalizeCache(stripDesignBlock(after)) !== clean) throw new Error('Unexpected HTML mutation outside the presentation boundary: ' + relative);
  return {html:after, ...selection};
}

function walkHtml(root) {
  const files = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes:true}).sort((a,b) => a.name.localeCompare(b.name, 'en'))) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(file);
      else if (/\.html$/i.test(entry.name)) files.push(file);
    }
  }
  visit(root);
  return files;
}

function applyDesignSystem(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const check = !!options.check;
  const reportFile = options.report ? path.resolve(options.report) : null;
  if (reportFile && (reportFile === root || reportFile.startsWith(root + path.sep))) throw new Error('Evidence must remain outside the public site root.');
  for (const asset of ASSETS) if (!fs.existsSync(path.join(root, asset))) throw new Error('Missing approved design asset: ' + asset);
  const pages = [], templates = [], excluded = [];
  let changedFiles = 0;
  for (const file of walkHtml(root)) {
    const relative = path.relative(root, file).replace(/\\/g, '/');
    const before = fs.readFileSync(file, 'utf8');
    const result = injectDesign(before, relative);
    const changed = before !== result.html;
    if (changed) changedFiles++;
    const row = {
      path:relative, url:'/' + relative.replace(/index\.html$/, ''),
      reason:result.reason, changed,
      beforeSha256:hash(before), afterSha256:hash(result.html),
      originalContentSha256:hash(stripDesignBlock(before)),
      originalContentUnchanged:stripDesignBlock(before) === stripDesignBlock(result.html),
      previousDesignBlocks:before.split(START).length - 1,
      finalDesignBlocks:result.html.split(START).length - 1
    };
    (result.kind === 'operational' ? pages : result.kind === 'template' ? templates : excluded).push(row);
    if (changed && !check) fs.writeFileSync(file, result.html);
  }
  const languageCounts = {};
  for (const row of pages) {
    const folder = row.path.split('/')[0];
    const locale = ['ko','en','ja','zh-tw'].includes(folder) ? folder : 'root-or-shared';
    languageCounts[locale] = (languageCounts[locale] || 0) + 1;
  }
  const report = {
    schema:'ks-ui13-design-injection-v1', version:VERSION, createdAt:new Date().toISOString(), mode:check?'check':'apply',
    summary:{scannedHtml:pages.length+templates.length+excluded.length, operationalPages:pages.length, publishingTemplates:templates.length, excludedFiles:excluded.length, changedFiles, languageCounts},
    assets:ASSETS.map(file => ({path:file, sha256:hash(fs.readFileSync(path.join(root,file)))})),
    preservation:'Remove only the exact design marker block; all remaining original document bytes are unchanged. No generator, data, SEO, URL or body rewrite.',
    templateChanges:['templates/spa-shell.html receives the same six-asset block.', 'prepare-publishing.js invokes this isolated final pass after its existing work; no other generator is executed by this script.'],
    pages, templates, excluded
  };
  if (reportFile) {
    fs.mkdirSync(path.dirname(reportFile), {recursive:true});
    fs.writeFileSync(reportFile, JSON.stringify(report,null,2) + '\n');
  }
  return report;
}

module.exports = {VERSION, START, END, ASSETS, headBlock, stripDesignBlock, classification, injectDesign, applyDesignSystem};
if (require.main === module) {
  const args = process.argv.slice(2);
  const reportIndex = args.indexOf('--report');
  if (reportIndex >= 0 && !args[reportIndex + 1]) throw new Error('--report requires a private output path.');
  const report = applyDesignSystem({check:args.includes('--check'), report:reportIndex >= 0 ? args[reportIndex+1] : undefined});
  console.log(JSON.stringify({version:VERSION, mode:report.mode, ...report.summary}));
  if (report.mode === 'check' && report.summary.changedFiles) process.exitCode = 1;
}

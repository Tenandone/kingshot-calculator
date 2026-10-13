'use strict';

// A presentation-only pass: retain original bytes outside profile markup,
// profile asset tags, and the explicitly versioned metrics script reference.
const fs = require('fs');
const path = require('path');
const {pathToFileURL} = require('url');
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const ASSET_START = 'ten-profile-assets:start';
const ASSET_END = 'ten-profile-assets:end';
const METRICS_VERSION = 'ks-ten-profile-20261013';
const LOCALES = ['ko', 'en', 'ja', 'zh-tw'];
const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;
const hasClass = (node, name) => (attr(node, 'class') || '').split(/\s+/).includes(name);

function nodes(root, result = []) {
  result.push(root);
  for (const child of root.childNodes || []) nodes(child, result);
  return result;
}

function edit(html, edits) {
  const ordered = edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let boundary = html.length;
  for (const item of ordered) {
    if (item.start < 0 || item.end < item.start || item.end > boundary) throw Error('Overlapping profile edits');
    html = html.slice(0, item.start) + item.text + html.slice(item.end);
    boundary = item.start;
  }
  return html;
}

function stripBlock(html, all, start, end, trailingNewline = false) {
  const starts = all.filter(node => node.nodeName === '#comment' && node.data.trim() === start);
  const ends = all.filter(node => node.nodeName === '#comment' && node.data.trim() === end);
  if (!starts.length && !ends.length) return html;
  if (starts.length !== 1 || ends.length !== 1 || starts[0].sourceCodeLocation.endOffset > ends[0].sourceCodeLocation.startOffset) {
    throw Error('Invalid profile marker pair: ' + start);
  }
  const begin = starts[0].sourceCodeLocation.startOffset;
  let finish = ends[0].sourceCodeLocation.endOffset;
  if (trailingNewline) finish += html.slice(finish).match(/^(?:\r\n|\n)/)?.[0].length || 0;
  return html.slice(0, begin) + html.slice(finish);
}

function sourcePath(node) {
  const src = attr(node, 'src');
  if (!src) return '';
  try { return new URL(src, 'https://kingshotdata.kr/').pathname; } catch (_) { return ''; }
}

function protectedMarkup(html, parse) {
  return nodes(parse(html, {sourceCodeLocationInfo: true})).filter(node =>
    node.tagName === 'title' || node.tagName === 'meta' ||
    (node.tagName === 'link' && ['canonical', 'alternate'].includes(attr(node, 'rel'))) ||
    (node.tagName === 'script' && attr(node, 'type') === 'application/ld+json')
  ).map(node => html.slice(node.sourceCodeLocation.startOffset, node.sourceCodeLocation.endOffset));
}

function htmlFiles(root) {
  const result = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (entry.name.startsWith('.') || ['node_modules', 'dist', '_lootbar'].includes(entry.name) || entry.isSymbolicLink()) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.html$/i.test(entry.name)) result.push(file);
    }
  }
  visit(root);
  return result;
}

async function applyOperatorProfile(options = {}) {
  const root = path.resolve(options.root || DEFAULT_ROOT);
  const {parse} = await import(pathToFileURL(require.resolve('parse5')).href);
  const config = require(path.join(root, 'js/operator-profile-config.js'));
  const view = require(path.join(root, 'js/operator-profile-view.js'));
  const assets = ['css/operator-profile.css', 'js/operator-profile-config.js', 'js/operator-profile-view.js', 'js/operator-profile.js'];
  for (const asset of assets) if (!fs.existsSync(path.join(root, asset))) throw Error('Missing operator profile asset: ' + asset);
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'data/ui/guides.json'), 'utf8'));
  const targets = new Map();
  for (const entry of registry.entries.filter(item => item.kind === 'detail')) {
    if (!/^\/(ko|en|ja|zh-tw)\/guides\/[^/]+\.html$/.test(entry.url)) throw Error('Unexpected guide URL: ' + entry.url);
    const relative = entry.url.slice(1);
    if (targets.has(relative)) throw Error('Duplicate guide URL: ' + entry.url);
    targets.set(relative, {locale: entry.locale, placement: 'guide_footer'});
  }
  for (const locale of LOCALES) {
    const prefix = locale === 'ko' ? '' : locale + '/';
    targets.set(prefix + 'about/index.html', {locale, placement: 'about'});
    targets.set(prefix + 'index.html', {locale, placement: 'site_footer'});
  }
  for (const relative of targets.keys()) if (!fs.existsSync(path.join(root, relative))) throw Error('Missing profile target: ' + relative);

  const summary = {mode: options.check ? 'check' : 'apply', guideProfiles: 0, aboutProfiles: 0, footerLinks: 0, fullAssetPages: 0, configOnlyPages: 0, metricsReferences: 0, changedFiles: 0};
  const pages = [];
  const writes = [];
  for (const file of htmlFiles(root)) {
    const relative = path.relative(root, file).replace(/\\/g, '/');
    const target = targets.get(relative);
    const before = fs.readFileSync(file, 'utf8');
    let html = before;
    let all = nodes(parse(html, {sourceCodeLocationInfo: true}));
    const hasApp = all.some(node => node.tagName === 'script' && sourcePath(node) === '/js/app.js');
    const hasGuideReader = all.some(node => node.tagName === 'script' && sourcePath(node) === '/js/guide-reader.js');
    const hasMetrics = all.some(node => node.tagName === 'script' && sourcePath(node) === '/js/hub-metrics.js');
    const fullAssets = !!target || hasApp || hasGuideReader;
    if (!fullAssets && !hasMetrics) continue;

    html = stripBlock(html, all, ASSET_START, ASSET_END, true);
    all = nodes(parse(html, {sourceCodeLocationInfo: true}));
    if (target) {
      const marker = 'ten-profile:' + target.placement;
      html = stripBlock(html, all, marker + ':start', marker + ':end');
      all = nodes(parse(html, {sourceCodeLocationInfo: true}));
      // A previously rendered signature is itself an explicit profile marker.
      const old = all.filter(node => attr(node, 'data-ten-profile') === target.placement);
      if (old.length > 1) throw Error('Duplicate existing profile in ' + relative);
      if (old.length) {
        const bounds = old[0].sourceCodeLocation;
        html = edit(html, [{start: bounds.startOffset, end: bounds.endOffset, text: ''}]);
        all = nodes(parse(html, {sourceCodeLocationInfo: true}));
      }
    }

    const head = all.find(node => node.tagName === 'head');
    const eol = html.includes('\r\n') ? '\r\n' : '\n';
    const selectedAssets = fullAssets ? assets : ['js/operator-profile-config.js'];
    const assetMarkup = '<!-- ' + ASSET_START + ' -->' + eol + selectedAssets.map(asset => asset.endsWith('.css')
      ? `<link rel="stylesheet" href="/${asset}?v=${config.version}">`
      : `<script defer src="/${asset}?v=${config.version}"></script>`).join(eol) + eol + '<!-- ' + ASSET_END + ' -->' + eol;
    const scripts = all.filter(node => node.tagName === 'script' && sourcePath(node) === '/js/hub-metrics.js');
    const app = all.find(node => node.tagName === 'script' && sourcePath(node) === '/js/app.js');
    const anchors = [scripts[0]?.sourceCodeLocation.startOffset, app?.sourceCodeLocation.startOffset, head?.sourceCodeLocation?.endTag?.startOffset].filter(value => value != null);
    if (!anchors.length) throw Error('Missing profile asset insertion point in ' + relative);
    const anchor = Math.min(...anchors);
    const edits = [{start: anchor, end: anchor, text: assetMarkup}];
    for (const script of scripts) {
      if (!script.attrs.some(item => item.name === 'defer')) throw Error('Metrics must defer until profile config is ready: ' + relative);
      const bounds = script.sourceCodeLocation.attrs.src;
      edits.push({start: bounds.startOffset, end: bounds.endOffset, text: html.slice(bounds.startOffset, bounds.endOffset).replace(/hub-metrics\.js(?:\?[^"'\s>]*)?/, 'hub-metrics.js?v=' + METRICS_VERSION)});
    }
    summary.metricsReferences += scripts.length;
    if (fullAssets) summary.fullAssetPages++; else summary.configOnlyPages++;

    if (target) {
      let offset;
      if (target.placement === 'guide_footer') {
        const body = all.find(node => node.tagName === 'main') || all.find(node => node.tagName === 'section' && attr(node, 'aria-label') === 'Truegold Chart');
        offset = body?.sourceCodeLocation?.endTag?.startOffset;
        summary.guideProfiles++;
      } else if (target.placement === 'about') {
        const article = all.find(node => node.tagName === 'article' && hasClass(node, 'ssg-initial-content'));
        const intro = article && nodes(article).find(node => attr(node, 'data-community-unit') === 'E13');
        const endMarker = article && nodes(article).find(node => node.nodeName === '#comment' && node.data.trim() === 'community-E13:end');
        if (!intro) throw Error('Missing community introduction in ' + relative);
        offset = endMarker?.sourceCodeLocation.endOffset ?? intro.sourceCodeLocation.endOffset;
        summary.aboutProfiles++;
      } else {
        const footer = all.find(node => node.tagName === 'footer' && hasClass(node, 'site-footer'));
        const container = footer && nodes(footer).find(node => hasClass(node, 'container'));
        offset = container?.sourceCodeLocation?.endTag?.startOffset;
        summary.footerLinks++;
      }
      if (offset == null) throw Error('Missing profile insertion point in ' + relative);
      const marker = 'ten-profile:' + target.placement;
      edits.push({start: offset, end: offset, text: '<!-- ' + marker + ':start -->' + view.render(target.locale, target.placement) + '<!-- ' + marker + ':end -->'});
    }
    html = edit(html, edits);
    if (JSON.stringify(protectedMarkup(before, parse)) !== JSON.stringify(protectedMarkup(html, parse))) throw Error('SEO metadata changed in ' + relative);
    const changed = html !== before;
    if (changed) {
      summary.changedFiles++;
      writes.push({file, html});
    }
    pages.push({path: relative, placement: target?.placement || null, assets: fullAssets ? 'full' : 'config', changed});
  }
  if (summary.guideProfiles !== registry.entries.filter(item => item.kind === 'detail').length || summary.aboutProfiles !== 4 || summary.footerLinks !== 4) throw Error('Incomplete profile target coverage');
  // Validate the complete set before changing any document.
  if (!options.check) for (const item of writes) fs.writeFileSync(item.file, item.html, 'utf8');
  return {summary, pages};
}

module.exports = {applyOperatorProfile};
if (require.main === module) applyOperatorProfile({check: process.argv.includes('--check')}).then(report => {
  console.log(JSON.stringify(report.summary));
  if (process.argv.includes('--check') && report.summary.changedFiles) process.exitCode = 1;
}).catch(error => {console.error(error);process.exitCode = 1;});

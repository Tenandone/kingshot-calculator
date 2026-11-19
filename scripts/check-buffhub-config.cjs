'use strict';

// Read-only operational preflight for the explicitly approved 81 guide pages.
// Manual enabled/disabled control has no start date, end date or automatic expiry.
// No production configuration is changed and no advertiser URL is requested.
const fs = require('node:fs');
const path = require('node:path');
const { parseHTML } = require('linkedom');
const core = require('../js/sponsors.js');
const { checkImages } = require('./optimize-buffhub-images.cjs');
const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://kingshotdata.kr';

function resolvePage(root, pathname) {
  const base = fs.realpathSync(root);
  let file = path.resolve(base, '.' + pathname);
  if (file !== base && !file.startsWith(base + path.sep)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && !path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
  if (!fs.existsSync(file) || !fs.statSync(file).isFile() || path.extname(file).toLowerCase() !== '.html') return null;
  if (!fs.realpathSync(file).startsWith(base + path.sep)) return null;
  return file;
}

async function inspectConfig(config, { root = ROOT } = {}) {
  const errors = core.validateConfig(config);
  const report = { valid: false, enabled: config?.enabled === true, state: 'invalid', approvedPathCount: 0, imageCount: 0, paths: [], errors };
  if (errors.length) return report;
  report.approvedPathCount = config.approvedPaths.length;
  if (config.enabled && !config.approvedPaths.length) errors.push('Activation requires at least one explicitly approved path.');
  report.state = config.enabled ? 'active' : 'disabled';
  if (Object.hasOwn(config, 'startsAt') || Object.hasOwn(config, 'endsAt')) errors.push('Operational campaigns use manual enabled control; remove legacy date fields.');
  try {
    const registry = JSON.parse(fs.readFileSync(path.join(root, 'data', 'ui', 'guides.json'), 'utf8'));
    const guides = registry.entries.filter(entry => entry.kind === 'detail');
    const expected = new Set(guides.map(entry => entry.url));
    const actual = new Set(config.approvedPaths);
    if (guides.length !== 81 || expected.size !== 81) errors.push('The operational approval scope must contain exactly 81 registered guide pages.');
    const missing = [...expected].filter(url => !actual.has(url));
    const extra = [...actual].filter(url => !expected.has(url));
    if (missing.length || extra.length) errors.push(`Approved paths differ from the 81-guide operational scope: ${missing.length} missing, ${extra.length} extra.`);
  } catch (_) { errors.push('The registered guide approval scope could not be verified.'); }

  try {
    const manifest = await checkImages({ outputDir: path.join(root, 'img', 'sponsors', 'buffhub') });
    for (const locale of core.LOCALES) {
      const entry = manifest.locales[locale], creative = config.creatives[locale];
      if (creative.image !== entry.variants[0].src || creative.image2x !== entry.variants[1].src) {
        errors.push('Creative does not match the optimized image manifest: ' + locale);
      }
      report.imageCount += entry.variants.length;
    }
  } catch (error) { errors.push('Optimized banner asset check failed: ' + error.message); }

  for (const pathname of config.approvedPaths) {
    const file = resolvePage(root, pathname);
    if (!file) { errors.push('Approved path has no static HTML file: ' + pathname); continue; }
    const { document } = parseHTML(fs.readFileSync(file, 'utf8'));
    const canonicals = [...document.querySelectorAll('link[rel="canonical"]')];
    let canonical = null;
    try {
      if (canonicals.length !== 1) throw new Error('not a unique canonical');
      canonical = new URL(canonicals[0].getAttribute('href'));
      if (canonical.origin !== ORIGIN || canonical.search || canonical.hash || core.normalizePath(canonical.pathname) !== pathname) throw new Error('mismatch');
    } catch (_) { errors.push('Approved path must match its unique production canonical: ' + pathname); }
    const override = config.pathOverrides[pathname];
    const selection = {
      path: pathname,
      locale: core.localeFor(pathname),
      placement: override?.placement || config.placements[0],
      selector: override?.selector || null
    };
    const target = core.findPlacement(document, selection);
    if (!target) errors.push('Approved placement has no safe static anchor: ' + pathname);
    const bootstrap = [...document.querySelectorAll('script[src]')].some(node => /^\/js\/hub\.js(?:\?|$)/.test(node.getAttribute('src')));
    if (!bootstrap) errors.push('Approved page does not load the shared sponsor bootstrap: ' + pathname);
    report.paths.push({
      path: pathname,
      file: path.relative(root, file).replace(/\\/g, '/'),
      canonical: canonical?.href || null,
      locale: selection.locale,
      placement: selection.placement,
      anchor: target ? { tag: target.anchor.tagName.toLowerCase(), id: target.anchor.id || null, class: target.anchor.className || null, mode: target.mode } : null
    });
  }
  report.valid = errors.length === 0;
  return report;
}

async function main(args) {
  let configFile = path.join(ROOT, 'data', 'sponsors', 'buffhub.json');
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--config' && args[index + 1]) configFile = path.resolve(args[++index]);
    else throw new Error('Unknown or incomplete argument: ' + args[index]);
  }
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  const report = await inspectConfig(config);
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) process.exitCode = 1;
}

module.exports = { inspectConfig, resolvePage };
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });

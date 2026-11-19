'use strict';

// Published HTML is the source of truth for this static GitHub Pages site.
// A feature build must never silently regenerate reviewed pages or shrink search coverage.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(__dirname, 'published-baseline.json');
const ORIGIN = 'https://kingshotdata.kr';
const normalize = text => String(text).replace(/\r\n/g, '\n');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function resolveInside(root, relative) {
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error('Path outside site root: ' + relative);
  return resolved;
}

function listSitemapUrls(xml) {
  return [...String(xml).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].replace(/&amp;/g, '&'));
}

function fileForUrl(root, value) {
  const url = new URL(value);
  if (url.origin !== ORIGIN || url.search || url.hash) throw new Error('Unexpected published URL: ' + value);
  const relative = decodeURIComponent(url.pathname).replace(/^\//, '');
  return resolveInside(root, relative.endsWith('/') || !relative ? relative + 'index.html' : relative);
}

function inspectPublishedSite(root = ROOT, options = {}) {
  root = path.resolve(root);
  const baseline = options.baseline || readJson(BASELINE_FILE);
  const errors = [];
  const changed = [];
  let htmlFiles = 0;
  for (const item of baseline.files) {
    const file = resolveInside(root, item.path);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      errors.push('Missing protected file: ' + item.path);
      changed.push({ path: item.path, reason: 'missing' });
      continue;
    }
    const contents = fs.readFileSync(file);
    const actual = sha256(item.kind === 'binary' ? contents : normalize(contents.toString('utf8')));
    if (actual !== item.sha256) {
      errors.push('Published content changed: ' + item.path);
      changed.push({ path: item.path, reason: 'content', expected: item.sha256, actual });
    }
    if (item.kind === 'html') htmlFiles++;
  }
  let actualUrls = [];
  try { actualUrls = listSitemapUrls(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8')); }
  catch (_) { errors.push('Missing or unreadable sitemap.xml'); }
  const expectedUrls = new Set(baseline.sitemapUrls);
  const actualSet = new Set(actualUrls);
  const removedUrls = [...expectedUrls].filter(url => !actualSet.has(url));
  const addedUrls = [...actualSet].filter(url => !expectedUrls.has(url));
  if (removedUrls.length) errors.push('Published sitemap URLs removed: ' + removedUrls.length);
  if (addedUrls.length) errors.push('Unreviewed sitemap URLs added: ' + addedUrls.length);
  if (actualUrls.length !== actualSet.size) errors.push('Duplicate sitemap URL');
  for (const url of baseline.sitemapUrls) {
    try {
      const file = fileForUrl(root, url);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) errors.push('Published URL has no page: ' + url);
    } catch (error) { errors.push(error.message); }
  }
  const policyFile = path.join(root, 'scripts', 'public-index-policy.json');
  if (fs.existsSync(policyFile)) {
    const allowed = new Set(readJson(policyFile).paths);
    const missing = baseline.sitemapUrls.filter(url => !allowed.has(new URL(url).pathname));
    if (missing.length) errors.push('Index policy would exclude published pages: ' + missing.length);
  }
  return {
    passed: errors.length === 0,
    sourceCommit: baseline.sourceCommit,
    protectedFiles: baseline.files.length,
    htmlFiles,
    expectedSitemapUrls: baseline.sitemapUrls.length,
    actualSitemapUrls: actualUrls.length,
    removedUrls,
    addedUrls,
    changed,
    errors
  };
}

module.exports = { ROOT, BASELINE_FILE, ORIGIN, normalize, sha256, readJson, resolveInside, listSitemapUrls, fileForUrl, inspectPublishedSite };

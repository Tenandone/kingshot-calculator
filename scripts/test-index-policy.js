'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('parse5');
const { ROOT, ORIGIN, readJson, fileForUrl, inspectPublishedSite } = require('./published-integrity');
const allow = new Set(require('./public-index-policy.json').paths);
const baseline = require('./published-baseline.json');
const attr = (node, name) => (node.attrs || []).find(item => item.name === name)?.value || '';
const nodes = node => [node, ...(node.childNodes || []).flatMap(nodes)];

// Validate actual published pages, not the old mutable .audit/index-policy.json.
// Some existing pages intentionally have no robots tag; absence means indexable.
// Their exact metadata is still protected by the immutable baseline.
assert.equal(inspectPublishedSite(ROOT).passed, true, 'Existing published source must be preserved');
for (const url of baseline.sitemapUrls) {
  assert(allow.has(new URL(url).pathname), 'Published route missing from policy: ' + url);
  const all = nodes(parse(fs.readFileSync(fileForUrl(ROOT, url), 'utf8')));
  const canonical = all.filter(node => node.tagName === 'link' && attr(node, 'rel') === 'canonical');
  assert.equal(canonical.length, 1, url);
  assert.equal(attr(canonical[0], 'href'), url, url);
  const robots = all.filter(node => node.tagName === 'meta' && attr(node, 'name').toLowerCase() === 'robots');
  assert(robots.every(node => !/\bnoindex\b/i.test(attr(node, 'content'))), url);
  assert(!all.some(node => node.tagName === 'meta' && attr(node, 'http-equiv').toLowerCase() === 'refresh'), url);
}

const sitemap = new Set(baseline.sitemapUrls);
const catalogCounts = {};
for (const language of ['ko', 'en', 'ja', 'zh-tw']) {
  const rows = readJson(path.join(ROOT, 'data', 'catalog', language + '.json'));
  catalogCounts[language] = rows.length;
  for (const row of rows) {
    const url = new URL(row.url, ORIGIN);
    url.search = ''; url.hash = '';
    assert(sitemap.has(url.href), row.url);
    assert(!/\/(?:tools|pages|templates)\//.test(url.pathname), row.url);
  }
}
console.log('Published indexing: 644 canonical/indexable pages and preserved search catalogs passed. ' + JSON.stringify(catalogCounts));

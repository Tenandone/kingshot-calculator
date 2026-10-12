'use strict';
// Keep no-JavaScript discovery in step with the existing reader registry.
// Existing guide cards, guide documents, metadata and runtime scripts stay intact.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const START = '<!-- ks-static-guide-links:start -->';
const END = '<!-- ks-static-guide-links:end -->';
const esc = value => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ui/guides.json'), 'utf8'));
const check = process.argv.includes('--check');
const report = [];

function listBounds(html) {
  const opening = /<div\b[^>]*\bid=["']guide-list["'][^>]*>/i.exec(html);
  if (!opening) throw new Error('Missing existing guide-list container');
  const start = opening.index + opening[0].length;
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = start;
  let depth = 1, tag;
  while ((tag = tags.exec(html))) {
    depth += /^<\//.test(tag[0]) ? -1 : 1;
    if (!depth) return { start, end: tag.index };
  }
  throw new Error('Unclosed guide-list container');
}

function card(entry, eol) {
  if (!/^\/(?:ko|en|ja|zh-tw)\/guides\/[^/?#]+\.html$/.test(entry.url)) throw new Error('Unexpected guide URL: ' + entry.url);
  if (!fs.existsSync(path.join(ROOT, entry.url.slice(1)))) throw new Error('Missing guide document: ' + entry.url);
  let image = '';
  if (entry.image) {
    if (!entry.image.startsWith('/img/') || !fs.existsSync(path.join(ROOT, entry.image.split('?')[0].slice(1)))) throw new Error('Missing existing guide image: ' + entry.image);
    image = '          <div class="tile-icon" aria-hidden="true"><img src="' + esc(entry.image) + '" alt="" width="140" height="140" loading="lazy" decoding="async"></div>' + eol;
  }
  return '      <section class="g-block" id="guide-' + esc(entry.slug) + '" data-guide="' + esc(entry.slug) + '" data-slug="' + esc(entry.slug) + '" data-toc="true" data-title="' + esc(entry.title) + '">' + eol +
    '        <a class="g-link" href="' + esc(entry.url) + '" aria-label="' + esc(entry.title) + '">' + eol + image +
    '          <div class="tile-title"><h2 class="g-title">' + esc(entry.title) + '</h2></div>' + eol +
    '        </a>' + eol + '      </section>';
}

for (const locale of ['ko', 'en', 'ja', 'zh-tw']) {
  const file = path.join(ROOT, locale, 'guides/index.html');
  const original = fs.readFileSync(file, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const {start, end} = listBounds(original);
  const inner = original.slice(start, end);
  const manual = inner.replace(/\r?\n[ \t]*<!-- ks-static-guide-links:start -->[\s\S]*?<!-- ks-static-guide-links:end -->/, '');
  const sections = [...manual.matchAll(/<section\b[^>]*\bclass=["'][^"']*\bg-block\b[^"']*["'][^>]*>[\s\S]*?<\/section>/gi)];
  if (!sections.length) throw new Error('Missing original guide cards: ' + locale);
  const urls = sections.map(section => section[0].match(/<a\b[^>]*\bhref=["']([^"']+)["']/i)?.[1]);
  if (urls.some(url => !url) || new Set(urls).size !== urls.length) throw new Error('Invalid or duplicate original guide card: ' + locale);
  const entries = registry.entries.filter(entry => entry.locale === locale && entry.kind === 'detail');
  const expected = new Set(entries.map(entry => entry.url));
  if (expected.size !== entries.length || urls.some(url => !expected.has(url))) throw new Error('Original cards require review before synchronization: ' + locale);
  const missing = entries.filter(entry => !urls.includes(entry.url));
  const last = sections[sections.length - 1];
  const insertion = last.index + last[0].length;
  const generated = missing.length ? eol + '      ' + START + eol + missing.map(entry => card(entry, eol)).join(eol + eol) + eol + '      ' + END : '';
  const updated = original.slice(0, start) + manual.slice(0, insertion) + generated + manual.slice(insertion) + original.slice(end);
  if (check && updated !== original) throw new Error('Static guide links are stale: ' + locale);
  if (!check && updated !== original) fs.writeFileSync(file, updated, 'utf8');
  report.push({ locale, preservedCards: urls.length, registryCards: entries.length, generatedCards: missing.length, changed: updated !== original });
}
console.log(JSON.stringify({ mode: check ? 'check' : 'write', registry: registry.version, pages: report }));

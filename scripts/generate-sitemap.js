'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://kingshotdata.kr';
const LANGS = [
  { folder: 'ko', code: 'ko' },
  { folder: 'en', code: 'en' },
  { folder: 'ja', code: 'ja' },
  { folder: 'zh-tw', code: 'zh-TW' }
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function walkHtml(directory) {
  const output = [];
  const stack = [directory];

  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith('.html')) output.push(full);
    }
  }

  return output;
}

function getCanonical(html) {
  const tag = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i);
  if (!tag) return '';
  const href = tag[0].match(/\bhref=["']([^"']+)["']/i);
  return href ? href[1] : '';
}

function normalizeUrl(value) {
  try {
    const url = new URL(value, ORIGIN);
    if (url.origin !== ORIGIN) return '';
    url.hash = '';
    return url.toString();
  } catch (_) {
    return '';
  }
}

function languageFromUrl(value) {
  const url = new URL(value);
  const queryLang = url.searchParams.get('lang');
  if (queryLang) return queryLang.toLowerCase() === 'zh-tw' ? 'zh-TW' : queryLang.toLowerCase();
  const first = url.pathname.split('/').filter(Boolean)[0] || '';
  if (first === 'zh-tw') return 'zh-TW';
  return ['ko', 'en', 'ja'].includes(first) ? first : '';
}

function logicalKey(value) {
  const url = new URL(value);
  const queryLang = url.searchParams.get('lang');
  if (queryLang) url.searchParams.delete('lang');
  url.pathname = url.pathname.replace(/^\/(ko|en|ja|zh-tw)(?=\/|$)/, '');
  if (!url.pathname) url.pathname = '/';
  const search = url.searchParams.toString();
  return url.pathname + (search ? '?' + search : '');
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const urls = new Set();

for (const lang of LANGS) {
  const directory = path.join(ROOT, lang.folder);
  for (const file of walkHtml(directory)) {
    const html = fs.readFileSync(file, 'utf8');
    if (/<title[^>]*>\s*Redirecting/i.test(html)) continue;
    const canonical = normalizeUrl(getCanonical(html));
    if (canonical && languageFromUrl(canonical) && !canonical.includes('/tw/')) urls.add(canonical);
  }
}

const spaPaths = [
  '/',
  '/heroes',
  '/database',
  '/calculator',
  '/calc-building',
  '/calc-gear',
  '/calc-charm',
  '/calc-training',
  '/calc-pet',
  '/waracademy',
  '/about',
  '/privacy'
];

const heroes = readJson(path.join(ROOT, 'data', 'heroes.json'));
for (const hero of heroes) {
  if (hero && hero.slug) spaPaths.push('/hero/' + encodeURIComponent(hero.slug));
}

for (const lang of LANGS) {
  for (const pathname of spaPaths) {
    urls.add(ORIGIN + pathname + '?lang=' + encodeURIComponent(lang.code));
  }
}

const groups = new Map();
for (const value of urls) {
  const lang = languageFromUrl(value);
  if (!lang) continue;
  const key = logicalKey(value);
  if (!groups.has(key)) groups.set(key, new Map());
  groups.get(key).set(lang, value);
}

const languageOrder = new Map(LANGS.map((lang, index) => [lang.code, index]));
const sortedUrls = Array.from(urls).sort((a, b) => {
  const keyCompare = logicalKey(a).localeCompare(logicalKey(b), 'en');
  if (keyCompare) return keyCompare;
  return (languageOrder.get(languageFromUrl(a)) || 0) - (languageOrder.get(languageFromUrl(b)) || 0);
});

const lines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  '        xmlns:xhtml="http://www.w3.org/1999/xhtml">'
];

for (const value of sortedUrls) {
  const alternates = groups.get(logicalKey(value));
  lines.push('  <url>');
  lines.push('    <loc>' + escapeXml(value) + '</loc>');

  if (alternates && LANGS.every(lang => alternates.has(lang.code))) {
    lines.push('    <xhtml:link rel="alternate" hreflang="x-default" href="' + escapeXml(alternates.get('en')) + '" />');
    for (const lang of LANGS) {
      lines.push('    <xhtml:link rel="alternate" hreflang="' + lang.code + '" href="' + escapeXml(alternates.get(lang.code)) + '" />');
    }
  }

  lines.push('  </url>');
}

lines.push('</urlset>', '');
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), lines.join('\n'), 'utf8');
console.log('Generated sitemap.xml with ' + sortedUrls.length + ' URLs.');

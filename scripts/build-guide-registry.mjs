import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Reviewed guide topics. A new slug must be classified deliberately; content is
// read from its existing localized page/catalog, never translated or generated.
const topics = {
  'Tri-Alliance-Clash': 'battle',
  'fishing-event-guide': 'events',
  hallofgovernors: 'events',
  'kingdom-of-power-prep': 'events',
  'kingshot-bear-reward': 'rewards',
  'kingshot-bearhunt': 'battle',
  'kingshot-easter-event-spending-guide': 'events',
  'kingshot-f2p-guide': 'beginner',
  'kingshot-giftcode': 'rewards',
  'kingshot-ruins-tip': 'events',
  'mystic-trial': 'battle',
  'pirates-treasure-guide': 'events',
  'server-timeline': 'systems',
  'ssr-hero-vs': 'battle',
  transfer: 'systems',
  truegold: 'growth',
  viking: 'battle',
  'war-academy-t11-guide': 'growth',
  'waves-voyage-guide': 'events'
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = ['ko', 'en', 'ja', 'zh-tw'];
const output = path.join(root, 'data/ui/guides.json');
const origin = 'https://kingshotdata.kr';
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const readJSON = name => JSON.parse(read(name));
const sha = value => createHash('sha256').update(value).digest('hex');
const decode = value => String(value || '').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n))).replace(/&(amp|quot|apos|lt|gt|nbsp);/g, (_, key) => ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }[key]));
const text = value => decode(String(value || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const unique = values => [...new Set(values.filter(Boolean))];
const attr = (tag, name) => decode(tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2] || '');
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(match => match[0]);
const catalogs = new Map();
for (const locale of locales) {
  const base = readJSON(`data/catalog/${locale}.json`);
  const enhancedFile = `data/ui/search/${locale}.json`;
  const enhanced = fs.existsSync(path.join(root, enhancedFile)) ? readJSON(enhancedFile).entries : [];
  const map = new Map(base.map(entry => [entry.url, entry]));
  for (const entry of enhanced) map.set(entry.url, { ...map.get(entry.url), ...entry });
  catalogs.set(locale, map);
}

const sitemap = [...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(match => decode(match[1]));
const urls = sitemap.filter(url => /^https:\/\/kingshotdata\.kr\/(ko|en|ja|zh-tw)\/guides\/(?:[^/?#]+\.html)?$/.test(url));
if (new Set(urls).size !== urls.length) throw new Error('Duplicate guide canonical in sitemap');
const entries = urls.sort().map(canonical => {
  const url = new URL(canonical).pathname;
  const locale = url.split('/')[1];
  const filename = url.endsWith('/') ? `${url}index.html` : url;
  const html = read(filename.slice(1));
  const canonicalTags = tags(html, 'link').filter(tag => attr(tag, 'rel').split(/\s+/).includes('canonical'));
  if (canonicalTags.length !== 1 || attr(canonicalTags[0], 'href') !== canonical) throw new Error(`Canonical mismatch: ${url}`);
  if (tags(html, 'meta').some(tag => attr(tag, 'name') === 'robots' && /noindex/i.test(attr(tag, 'content')))) throw new Error(`Noindex guide in registry: ${url}`);
  const kind = url.endsWith('/') ? 'list' : 'detail';
  const slug = kind === 'list' ? '' : path.basename(url, '.html');
  if (kind === 'detail' && !topics[slug]) throw new Error(`Unclassified guide: ${slug}`);
  const catalog = catalogs.get(locale).get(url);
  if (!catalog) throw new Error(`Missing existing catalog entry: ${url}`);
  const localeKey = locale === 'zh-tw' ? 'zh-TW' : locale;
  const title = kind === 'list' ? readJSON(`i18n/${localeKey}/guides.json`).guides.title : text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || catalog.title);
  const description = text(catalog.description);
  const image = catalog.image || '';
  if (image && (!image.startsWith('/') || !fs.existsSync(path.join(root, image.split('?')[0].slice(1))))) throw new Error(`Unresolved existing image: ${url}: ${image}`);
  return { id: kind === 'list' ? 'guide:list' : `guide:${slug}`, kind, locale, slug, title, description, aliases: unique([...(catalog.aliases || []), catalog.title, slug ? slug.replace(/-/g, ' ') : 'guides']).filter(alias => alias !== title), url, category: kind === 'list' ? 'all' : topics[slug], image };
});

// Share only existing localized names and aliases within the exact same slug ID.
// This enables multilingual matching without fabricating unavailable locales.
for (const entry of entries) {
  const siblings = entries.filter(candidate => candidate.id === entry.id);
  entry.aliases = unique([...entry.aliases, ...siblings.flatMap(candidate => [candidate.title, ...candidate.aliases])]).filter(alias => alias !== entry.title);
}
entries.sort((a, b) => locales.indexOf(a.locale) - locales.indexOf(b.locale) || a.url.localeCompare(b.url, 'en'));
const version = `ks-guides-${sha(JSON.stringify(entries)).slice(0, 16)}`;
const data = { schemaVersion: 1, version, entries };
const serialized = JSON.stringify(data, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== serialized) throw new Error('Guide registry is stale; run node scripts/build-guide-registry.mjs');
} else {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, serialized, 'utf8');
}
console.log(JSON.stringify({ version, entries: entries.length, details: entries.filter(entry => entry.kind === 'detail').length, lists: entries.filter(entry => entry.kind === 'list').length, locales: Object.fromEntries(locales.map(locale => [locale, entries.filter(entry => entry.locale === locale).length])), bytes: Buffer.byteLength(serialized), sha256: sha(serialized), mode: process.argv.includes('--check') ? 'check' : 'write' }));

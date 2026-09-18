'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://kingshotdata.kr';

function decode(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(value) {
  return decode(String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(tag, name) {
  const match = String(tag || '').match(new RegExp('\\b' + name + '=["\\\']([^"\\\']*)["\\\']', 'i'));
  return match ? decode(match[1]) : '';
}

function tagContent(html, tag) {
  const match = html.match(new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  return match ? stripHtml(match[1]) : '';
}

function metaContent(html, key, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const found = tags.find(tag => attr(tag, key).toLowerCase() === value.toLowerCase());
  return found ? attr(found, 'content') : '';
}

function linkHref(html, rel) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  const found = tags.find(tag => attr(tag, 'rel').toLowerCase().split(/\s+/).includes(rel));
  return found ? attr(found, 'href') : '';
}

function localFileForUrl(rawUrl) {
  const url = new URL(rawUrl, ORIGIN);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') return path.join(ROOT, 'index.html');
  const clean = pathname.replace(/^\/+/, '');
  if (path.extname(clean)) return path.join(ROOT, clean);
  return path.join(ROOT, clean, 'index.html');
}

function localAsset(rawUrl) {
  if (!rawUrl || rawUrl.includes('${') || /^(?:data:|blob:|javascript:|mailto:|tel:|#)/i.test(rawUrl)) return null;
  const url = new URL(rawUrl, ORIGIN);
  if (url.origin !== ORIGIN) return null;
  return localFileForUrl(url.href);
}

function listSitemapUrls() {
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decode(match[1]));
}

function audit() {
  const errors = [];
  const warnings = [];
  const titles = new Map();
  const canonicals = new Map();
  const urls = listSitemapUrls();

  for (const url of urls) {
    const file = localFileForUrl(url);
    if (!fs.existsSync(file)) {
      errors.push(url + ': no deployable local HTML file');
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    const title = tagContent(html, 'title');
    const description = metaContent(html, 'name', 'description');
    const canonical = linkHref(html, 'canonical').replace(/\/$/, '');
    const expectedCanonical = url.replace(/\/$/, '');
    const h1Count = (html.match(/<h1\b/gi) || []).length;
    const ogTitle = metaContent(html, 'property', 'og:title');
    const ogDescription = metaContent(html, 'property', 'og:description');
    const ogImage = metaContent(html, 'property', 'og:image');
    const alternates = (html.match(/<link\b[^>]*>/gi) || []).filter(tag => attr(tag, 'rel').toLowerCase() === 'alternate' && attr(tag, 'hreflang'));
    const rawText = stripHtml(html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '');

    if (!title) errors.push(url + ': missing title');
    if (!description) errors.push(url + ': missing meta description');
    if (!canonical) errors.push(url + ': missing canonical');
    else if (canonical !== expectedCanonical) errors.push(url + ': canonical mismatch (' + canonical + ')');
    if (h1Count !== 1) errors.push(url + ': expected one H1, found ' + h1Count);
    if (!ogTitle || !ogDescription || !ogImage) errors.push(url + ': incomplete Open Graph metadata');
    if (alternates.length < 4) warnings.push(url + ': fewer than four hreflang alternates');
    if (rawText.length < 120) warnings.push(url + ': thin raw HTML (' + rawText.length + ' characters)');

    if (title) {
      const values = titles.get(title) || [];
      values.push(url);
      titles.set(title, values);
    }
    if (canonical) {
      const values = canonicals.get(canonical) || [];
      values.push(url);
      canonicals.set(canonical, values);
    }

    const schemas = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    if (!schemas.length) warnings.push(url + ': missing JSON-LD');
    for (const schema of schemas) {
      try { JSON.parse(schema[1]); } catch (error) { errors.push(url + ': invalid JSON-LD (' + error.message + ')'); }
    }

    for (const match of html.matchAll(/<(?:img|source)\b[^>]*>/gi)) {
      const src = attr(match[0], 'src') || attr(match[0], 'srcset').split(/\s+/)[0];
      const asset = localAsset(src);
      if (asset && !fs.existsSync(asset)) errors.push(url + ': broken image ' + src);
    }
    for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
      const href = attr(match[0], 'href');
      const target = localAsset(href);
      if (target && !fs.existsSync(target)) warnings.push('unresolved internal route ' + href);
    }
  }

  for (const [title, duplicates] of titles) {
    if (duplicates.length > 1) errors.push('duplicate title "' + title + '": ' + duplicates.join(', '));
  }
  for (const [canonical, duplicates] of canonicals) {
    if (duplicates.length > 1) errors.push('duplicate canonical ' + canonical + ': ' + duplicates.join(', '));
  }

  const uniqueErrors = [...new Set(errors)];
  const uniqueWarnings = [...new Set(warnings)];
  console.log('[seo-audit] sitemap URLs:', urls.length);
  console.log('[seo-audit] errors:', uniqueErrors.length);
  console.log('[seo-audit] warnings:', uniqueWarnings.length);
  for (const item of uniqueErrors.slice(0, 200)) console.error('[error]', item);
  for (const item of uniqueWarnings.slice(0, 200)) console.warn('[warning]', item);
  if (uniqueErrors.length > 200) console.error('[error] additional findings:', uniqueErrors.length - 200);
  if (uniqueWarnings.length > 200) console.warn('[warning] additional findings:', uniqueWarnings.length - 200);
  if (uniqueErrors.length) process.exitCode = 1;
}

audit();

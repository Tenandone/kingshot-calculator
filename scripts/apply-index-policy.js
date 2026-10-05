'use strict';
const fs = require('fs'), path = require('path');
const { ROOT, ORIGIN } = require('./static-routes');
const policy = require('./public-index-policy.json');
const allowed = new Set(policy.paths);
const rows = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (/^[._]/.test(entry.name) || ['node_modules', 'dist', 'scripts', 'reports'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!entry.name.endsWith('.html')) continue;
    const relative = path.relative(ROOT, file).replace(/\\/g, '/');
    let html = fs.readFileSync(file, 'utf8');
    const pathname = '/' + relative.replace(/index\.html$/, '');
    // Ownership challenge files are protocol payloads, not HTML documents.
    if (/^naver-site-verification:/.test(html.trim())) {
      rows.push({ pathname, classification: 'INTERNAL ONLY', reason: 'Ownership verification protocol payload; exact contents preserved', robots: 'not an HTML document' });
      continue;
    }
    const redirect = /<meta\b[^>]*http-equiv=["']refresh["']/i.test(html);
    const internal = /^(pages|templates)\//.test(relative);
    const experiment = /^tools\//.test(relative) && !/coupon-countdown\.html$/.test(relative);
    const index = allowed.has(pathname) && !redirect && !internal && !experiment;
    const classification = redirect ? 'REDIRECT' : internal ? 'INTERNAL ONLY' : experiment ? 'REMOVE CANDIDATE' : index ? 'PUBLIC INDEX' : 'PUBLIC NOINDEX';
    const oldCanonical = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/i)?.[1];
    const canonical = redirect && oldCanonical ? new URL(oldCanonical, ORIGIN).href : ORIGIN + pathname;
    html = html.replace(/<meta\b(?=[^>]*\bname=["']robots["'])[^>]*>\s*/gi, '')
      .replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>\s*/gi, '');
    const meta = '<meta name="robots" content="' + (index ? 'index,follow' : 'noindex,follow') + '">\n<link rel="canonical" href="' + canonical + '">\n';
    if (/<head\b[^>]*>/i.test(html)) html = html.replace(/(<head\b[^>]*>)\s*/i, (_, tag) => tag + '\n' + meta);
    else html = '<head>' + meta + '</head>\n' + html;
    if (html !== fs.readFileSync(file, 'utf8')) fs.writeFileSync(file, html);
    rows.push({ pathname, classification, canonical, robots: index ? 'index,follow' : 'noindex,follow', reason: index ? 'Intentional canonical content route; editorial review tracked separately' : redirect ? 'Legacy destination helper' : internal ? 'SPA source/template' : experiment ? 'Experimental or duplicate tool' : 'Supplementary page excluded from search' });
  }
}
walk(ROOT);
fs.mkdirSync(path.join(ROOT, '.audit'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.audit/index-policy.json'), JSON.stringify(rows, null, 2));
console.log('Explicit index policy:', rows.reduce((acc, r) => (acc[r.classification] = (acc[r.classification] || 0) + 1, acc), {}));

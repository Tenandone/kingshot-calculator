'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { ROOT, normalize, sha256, inspectPublishedSite } = require('./published-integrity');
const { assertRegenerationWorkspace } = require('./regeneration-safety');

const directory = path.join(ROOT, '.audit', 'integrity-tests');
fs.mkdirSync(directory, { recursive: true });
const fixture = fs.mkdtempSync(path.join(directory, 'site-'));
const html = fs.readFileSync(path.join(ROOT, 'ko', 'guides', 'kingshot-bearhunt.html'), 'utf8');
const data = '{"approved":true,"cost":123}\n';
const urls = ['https://kingshotdata.kr/', 'https://kingshotdata.kr/guide.html'];
const sitemap = '<?xml version="1.0"?><urlset>' + urls.map(url => '<url><loc>' + url + '</loc></url>').join('') + '</urlset>';
const originals = { 'index.html': html, 'guide.html': html, 'data/game.json': data, 'sitemap.xml': sitemap };
for (const [file, contents] of Object.entries(originals)) {
  fs.mkdirSync(path.dirname(path.join(fixture, file)), { recursive: true });
  fs.writeFileSync(path.join(fixture, file), contents);
}
fs.mkdirSync(path.join(fixture, 'scripts'), { recursive: true });
fs.writeFileSync(path.join(fixture, 'scripts', 'public-index-policy.json'), JSON.stringify({ paths: ['/', '/guide.html'] }));
const baseline = { sourceCommit: 'fixture', sitemapUrls: urls, files: Object.entries(originals).map(([file, contents]) => ({ path: file, kind: file.endsWith('.html') ? 'html' : 'text', sha256: sha256(normalize(contents)) })) };
const inspect = () => inspectPublishedSite(fixture, { baseline });
let cases = 0;
assert.equal(inspect().passed, true); cases++;

function mutation(file, transform, expectedReason) {
  const value = transform(originals[file]);
  assert.notEqual(value, originals[file], 'Mutation must exercise an actual change: ' + expectedReason);
  fs.writeFileSync(path.join(fixture, file), value);
  const result = inspect();
  assert.equal(result.passed, false, expectedReason);
  assert(result.changed.some(item => item.path === file), expectedReason);
  fs.writeFileSync(path.join(fixture, file), originals[file]);
  cases++;
}

mutation('sitemap.xml', value => value.replace('<url><loc>' + urls[1] + '</loc></url>', ''), 'Removed sitemap route');
mutation('sitemap.xml', value => value.replace('</urlset>', '<url><loc>' + urls[0] + '</loc></url></urlset>'), 'Duplicate sitemap route');
mutation('guide.html', value => value.replace(/rel="canonical"\s+href="[^"]+"/, 'rel="canonical" href="https://example.invalid/"'), 'Canonical replacement');
mutation('guide.html', value => value.replace(/hreflang="[^"]+"/, 'hreflang="xx"'), 'Hreflang corruption');
mutation('guide.html', value => value.replace(/<head[^>]*>/i, '$&<meta name="robots" content="noindex">'), 'Unexpected noindex');
mutation('guide.html', value => value.replace(/<title>[\s\S]*?<\/title>/i, '<title>Unapproved replacement</title>'), 'SEO title overwrite');
mutation('guide.html', value => value.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, '<h1>Missing article</h1>'), 'Static body overwrite');
mutation('data/game.json', () => '{"approved":true,"cost":999}', 'Game data corruption');

const originalGuide = path.join(fixture, 'guide.html');
fs.renameSync(originalGuide, path.join(fixture, 'saved-guide.html'));
assert(inspect().errors.some(error => error.includes('Missing protected file: guide.html'))); cases++;
fs.renameSync(path.join(fixture, 'saved-guide.html'), originalGuide);

fs.writeFileSync(path.join(fixture, 'scripts', 'public-index-policy.json'), JSON.stringify({ paths: ['/'] }));
assert(inspect().errors.some(error => error.includes('Index policy would exclude'))); cases++;
fs.writeFileSync(path.join(fixture, 'scripts', 'public-index-policy.json'), JSON.stringify({ paths: ['/', '/guide.html'] }));

fs.writeFileSync(originalGuide, normalize(html).replace(/\n/g, '\r\n'));
assert.equal(inspect().passed, true, 'Line endings are not editorial changes'); cases++;
fs.writeFileSync(originalGuide, html);
assert.throws(() => assertRegenerationWorkspace(ROOT), /Direct regeneration/); cases++;

// Exercise actual dangerous entry points: each must refuse before changing a source file.
const sourceBefore = inspectPublishedSite(ROOT);
assert.equal(sourceBefore.passed, true);
for (const script of ['generate-static-routes.js', 'prepare-publishing.js', 'apply-index-policy.js', 'generate-sitemap.js', 'apply-lootbar-state.js']) {
  const result = cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts', script)], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 10000 });
  assert.notEqual(result.status, 0, script);
  assert.match(result.stderr, /Direct regeneration of published source is disabled/, script);
  cases++;
}
assert.equal(inspectPublishedSite(ROOT).passed, true); cases++;

// Regression for the five Korean root routes missed by locale-directory discovery.
// Run the real sitemap generator with a minimal route registry and real disk pages.
const reviews = path.join(ROOT, '.audit', 'regeneration-review');
fs.mkdirSync(reviews, { recursive: true });
const sitemapFixture = fs.mkdtempSync(path.join(reviews, 'sitemap-test-'));
fs.mkdirSync(path.join(sitemapFixture, 'scripts'), { recursive: true });
const rootRoutes = ['/growth-planner/', '/items/pet-food/', '/items/pet-notebook/', '/items/pet-supplement/', '/items/pet-promotion-medal/'];
for (const locale of ['ko', 'en', 'ja', 'zh-tw']) fs.mkdirSync(path.join(sitemapFixture, locale));
for (const pathname of rootRoutes) {
  const target = path.join(sitemapFixture, pathname, 'index.html');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, '<html lang="ko"><head><title>Published page</title><link rel="canonical" href="https://kingshotdata.kr' + pathname + '"><meta name="robots" content="index,follow"></head><body>Published</body></html>');
}
for (const script of ['generate-sitemap.js', 'regeneration-safety.js']) fs.copyFileSync(path.join(ROOT, 'scripts', script), path.join(sitemapFixture, 'scripts', script));
fs.writeFileSync(path.join(sitemapFixture, 'scripts', 'public-index-policy.json'), JSON.stringify({ paths: rootRoutes }));
fs.writeFileSync(path.join(sitemapFixture, 'scripts', 'static-routes.js'), "module.exports={ROOT:require('path').resolve(__dirname,'..'),ORIGIN:'https://kingshotdata.kr',LANGS:[{folder:'ko',code:'ko'},{folder:'en',code:'en'},{folder:'ja',code:'ja'},{folder:'zh-tw',code:'zh-TW'}],getStaticRoutes:()=>[]};");
fs.writeFileSync(path.join(sitemapFixture, '.regeneration-review.json'), JSON.stringify({ reviewOnly: true, sourceRoot: ROOT, workspace: sitemapFixture }));
const generate = () => cp.spawnSync(process.execPath, ['scripts/generate-sitemap.js'], { cwd: sitemapFixture, encoding: 'utf8', windowsHide: true, timeout: 10000 });
assert.equal(generate().status, 0);
const generatedXml = fs.readFileSync(path.join(sitemapFixture, 'sitemap.xml'), 'utf8');
assert.equal((generatedXml.match(/<loc>/g) || []).length, 5);
for (const pathname of rootRoutes) assert(generatedXml.includes('<loc>https://kingshotdata.kr' + pathname + '</loc>'));
cases++;
const rootPage = path.join(sitemapFixture, 'growth-planner', 'index.html');
const rootPageSource = fs.readFileSync(rootPage, 'utf8');
for (const [changed, message] of [
  [rootPageSource.replace('index,follow', 'noindex,follow'), /redirect or noindex/],
  [rootPageSource.replace('https://kingshotdata.kr/growth-planner/', 'https://kingshotdata.kr/other/'), /canonical differs/]
]) {
  fs.writeFileSync(rootPage, changed);
  const result = generate();
  assert.notEqual(result.status, 0); assert.match(result.stderr, message); cases++;
}
fs.writeFileSync(rootPage, rootPageSource);
fs.renameSync(rootPage, rootPage + '.saved');
const missingPage = generate(); assert.notEqual(missingPage.status, 0); assert.match(missingPage.stderr, /no HTML/); cases++;
fs.renameSync(rootPage + '.saved', rootPage);
fs.mkdirSync(path.join(sitemapFixture, 'unreviewed'));
fs.writeFileSync(path.join(sitemapFixture, 'unreviewed', 'index.html'), '<html><head><link rel="canonical" href="https://kingshotdata.kr/unreviewed/"></head></html>');
assert.equal(generate().status, 0);
assert(!fs.readFileSync(path.join(sitemapFixture, 'sitemap.xml'), 'utf8').includes('/unreviewed/')); cases++;
console.log(`Published integrity: ${cases} mutation and regeneration-safety cases passed. Existing HTML, SEO, data and sitemap preservation verified.`);

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseHTML } = require('linkedom');
const core = require('../js/sponsors.js');
const { inspectConfig, resolvePage } = require('./check-buffhub-config.cjs');
const ROOT = path.resolve(__dirname, '..');
const campaign = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/sponsors/buffhub.json'), 'utf8'));
const guides = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ui/guides.json'), 'utf8')).entries.filter(entry => entry.kind === 'detail');
const GUIDE = '/ko/guides/kingshot-bearhunt.html';
const copy = value => JSON.parse(JSON.stringify(value));
const active = (paths = [GUIDE]) => ({ ...copy(campaign), enabled: true, approvedPaths: paths });
const results = [];
function test(name, run) {
  try { run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); }
}
async function asyncTest(name, run) {
  try { await run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); }
}
function invalid(name, mutate) {
  test(name, () => {
    const config = active(); mutate(config);
    assert.ok(core.validateConfig(config).length, 'invalid configuration must be rejected');
    assert.equal(core.selectCampaign(config, GUIDE), null, 'invalid configuration must fail closed');
  });
}

test('operational campaign retains exactly 81 approvals with manual enabled control', () => {
  assert.equal(typeof campaign.enabled, 'boolean');
  assert.equal(guides.length, 81);
  assert.deepEqual([...campaign.approvedPaths].sort(), guides.map(entry => entry.url).sort());
  assert.equal(Object.hasOwn(campaign, 'startsAt'), false);
  assert.equal(Object.hasOwn(campaign, 'endsAt'), false);
  assert.deepEqual(core.validateConfig(campaign), []);
});
for (const value of [null, undefined, false, true, 0, 1, '', 'campaign', [], [{}]]) {
  test('malformed root ' + JSON.stringify(value), () => {
    assert.ok(core.validateConfig(value).length);
    assert.equal(core.selectCampaign(value, GUIDE), null);
  });
}
// Deterministic JSON-shape mutations exercise fail-closed behavior independently
// of the curated negative cases, including malformed sibling fields together.
for (const field of ['approvedPaths', 'placements', 'pathOverrides', 'creatives', 'events', 'viewability', 'enabled']) {
  for (const value of [null, [], {}, 0, 1, false, true, '', 'unexpected', [null], { includes: true }, { toString: null, valueOf: null }]) {
    test('shape mutation ' + field + ' ' + JSON.stringify(value), () => {
      const config = active(); config[field] = value;
      const errors = core.validateConfig(config);
      assert.ok(Array.isArray(errors));
      if (errors.length) assert.equal(core.selectCampaign(config, GUIDE), null);
    });
  }
}
for (const [name, pathname] of Object.entries({
  wildcard: '/ko/guides/*', query: GUIDE + '?email=private@example.test', fragment: GUIDE + '#intro',
  encoded: '/ko/guides/%61.html', traversal: '/ko/../guides/a.html', current: '/ko/./guides/a.html',
  network: '//example.test/a', scheme: 'https://kingshotdata.kr' + GUIDE, doubleSlash: '/ko//guides/a.html',
  backslash: '/ko\\guides/a.html', whitespace: ' /ko/guides/a.html', newline: GUIDE + '\n',
  excessive: '/' + 'x'.repeat(241), null: null
})) {
  test('reject path ' + name, () => assert.equal(core.normalizePath(pathname), null));
  invalid('reject allowlist ' + name, config => { config.approvedPaths = [pathname]; });
}
test('static index normalization and preserved path case', () => {
  assert.equal(core.normalizePath('/en/index.html'), '/en/');
  assert.equal(core.normalizePath('/'), '/');
  assert.equal(core.normalizePath('/ko/guides/Tri-Alliance-Clash.html'), '/ko/guides/Tri-Alliance-Clash.html');
});
invalid('canonical index alias cannot appear in allowlist', config => { config.approvedPaths = ['/en/index.html']; });
invalid('duplicate approved path', config => { config.approvedPaths.push(GUIDE); });
for (const value of [null, false, 1, {}, { includes: true }, GUIDE]) {
  invalid('malformed allowlist ' + JSON.stringify(value), config => { config.approvedPaths = value; config.pathOverrides = { [GUIDE]: { placement: 'guide_after_intro' } }; });
}
for (const value of [null, false, 1, {}, { includes: true }, 'guide_after_intro', [], [null], ['*'], ['guide_after_intro', 'guide_after_intro']]) {
  invalid('malformed placements ' + JSON.stringify(value), config => { config.placements = value; config.pathOverrides = { [GUIDE]: { placement: 'guide_after_intro' } }; });
}
for (const value of [null, false, 1, [], 'override']) invalid('malformed path overrides ' + JSON.stringify(value), config => { config.pathOverrides = value; });
invalid('unapproved override', config => { config.pathOverrides = { '/en/guides/kingshot-bearhunt.html': { placement: 'guide_after_intro' } }; });
invalid('override selects disabled placement', config => { config.pathOverrides = { [GUIDE]: { placement: 'content_end' } }; });
for (const selector of ['*', '#intro,#other', '<script>', 'a[href^="https:"]', 'x'.repeat(161), null, 1, []]) {
  invalid('unsafe selector ' + JSON.stringify(selector), config => { config.pathOverrides = { [GUIDE]: { placement: 'guide_after_intro', selector } }; });
}
test('approved campaign selection has no clock or automatic expiry dependency', () => {
  const config = active();
  assert.deepEqual(core.validateConfig(config), []);
  const originalNow = Date.now;
  try {
    for (const clock of [0, Date.parse('2026-11-19T00:00:00Z'), Date.parse('2099-12-31T23:59:59Z')]) {
      Date.now = () => clock;
      assert.ok(core.selectCampaign(config, GUIDE));
      assert.ok(core.selectCampaign(config, GUIDE, clock), 'obsolete third argument cannot impose a date gate');
    }
  } finally { Date.now = originalNow; }
});
test('manually disabled, unapproved and query-bearing requests stay hidden', () => {
  const config = active();
  for (const pathname of ['/ko/guides/', '/ko/guides/other.html', GUIDE + '?q=private', GUIDE + '#intro']) assert.equal(core.selectCampaign(config, pathname), null);
  config.enabled = false;
  assert.equal(core.selectCampaign(config, GUIDE), null);
});
for (const value of [null, '', false, 1, [], ['buffhub-ko-v1'], {}, { toString: null, valueOf: null }, 'buffhub-en-v1', 'buffhub-ko-<script>']) {
  invalid('invalid creative ID ' + JSON.stringify(value), config => { config.creatives.ko.id = value; });
}
for (const value of [null, [], 'creative', false, 1]) invalid('malformed creative ' + JSON.stringify(value), config => { config.creatives.ko = value; });
for (const href of [
  'http://buffhub.com/ko/top-up/kingshot.html?aff_short=kingshot',
  'https://example.test/ko/top-up/kingshot.html?aff_short=kingshot',
  'https://buffhub.com.evil.test/ko/top-up/kingshot.html?aff_short=kingshot',
  'https://user@buffhub.com/ko/top-up/kingshot.html?aff_short=kingshot',
  'https://buffhub.com:444/ko/top-up/kingshot.html?aff_short=kingshot',
  'https://buffhub.com/ja/top-up/kingshot.html?aff_short=kingshot',
  'https://buffhub.com/ko/top-up/kingshot.html',
  'https://buffhub.com/ko/top-up/kingshot.html?aff_short=other',
  'https://buffhub.com/ko/top-up/kingshot.html?aff_short=kingshot&aff_short=other',
  'https://buffhub.com/ko/top-up/kingshot.html?aff_short=kingshot&user=email',
  'https://buffhub.com/ko/top-up/kingshot.html?aff_short=kingshot#fragment',
  'javascript:alert(1)', null, [], {}
]) invalid('invalid referral ' + JSON.stringify(href), config => { config.creatives.ko.href = href; });
invalid('array must not coerce to a referral URL', config => { config.creatives.ko.href = [config.creatives.ko.href]; });
invalid('wrong locale image', config => { config.creatives.ko.image = config.creatives.en.image; });
invalid('remote tracking image', config => { config.creatives.ko.image = 'https://example.test/pixel'; });
invalid('missing disclosure', config => { config.creatives.ko.label = ''; });
invalid('markup in accessible copy', config => { config.creatives.ko.alt = '<img onerror=alert(1)>'; });
invalid('unknown event', config => { config.events.click = 'page_view'; });
invalid('fractional viewability time', config => { config.viewability.milliseconds = 1000.5; });
invalid('too short viewability time', config => { config.viewability.milliseconds = 999; });
invalid('too small viewability ratio', config => { config.viewability.ratio = 0.49; });
test('four languages select their own approved creative and destination', () => {
  const paths = core.LOCALES.map(locale => '/' + locale + '/guides/kingshot-bearhunt.html');
  const config = active(paths);
  paths.forEach((pathname, index) => {
    const selected = core.selectCampaign(config, pathname);
    assert.equal(selected.locale, core.LOCALES[index]);
    assert.equal(selected.creative.id, 'buffhub-' + core.LOCALES[index] + '-v1');
    assert.equal(new URL(selected.creative.href).searchParams.get('aff_short'), 'kingshot');
  });
});

const doc = body => parseHTML('<html><head></head><body>' + body + '</body></html>').document;
const selection = { path: GUIDE, placement: 'guide_after_intro', selector: null };
test('placement rejects missing, hidden and unrelated content', () => {
  assert.equal(core.findPlacement(doc('<div class="hero">outside main</div>'), selection), null);
  assert.equal(core.findPlacement(doc('<main hidden><div class="hero">hidden</div></main>'), selection), null);
  assert.equal(core.findPlacement(doc('<main><div hidden class="hero"><h1>Hidden</h1><p>intro</p></div></main>'), selection), null);
  assert.equal(core.findPlacement(doc('<main><div class="hero">not a guide</div></main>'), { ...selection, path: '/calculator/', selector: '.hero' }), null);
  assert.equal(core.findPlacement(doc('<main><h1>Calculator</h1><p>intro</p></main>'), { ...selection, path: '/calc-charm/', placement: 'calculator_result' }), null);
});
test('explicit anchor must be unique, outside navigation, and visible', () => {
  assert.equal(core.findPlacement(doc('<main><p class="intro">a</p><p class="intro">b</p></main>'), { ...selection, selector: '.intro' }), null);
  assert.equal(core.findPlacement(doc('<main><nav><p id="intro">navigation</p></nav></main>'), { ...selection, selector: '#intro' }), null);
  assert.equal(core.findPlacement(doc('<main><p hidden id="intro">hidden</p></main>'), { ...selection, selector: '#intro' }), null);
  assert.equal(core.findPlacement(doc('<main><p id="intro">intro</p></main>'), { ...selection, selector: '#intro' }).anchor.id, 'intro');
});

const guideResults = [];
test('all 81 existing guides have safe intro anchors before and after reader mounting', () => {
  assert.equal(guides.length, 81);
  for (const entry of guides) {
    const { document } = parseHTML(fs.readFileSync(resolvePage(ROOT, entry.url), 'utf8'));
    const before = document.documentElement.outerHTML;
    const selected = { ...selection, path: entry.url };
    const target = core.findPlacement(document, selected);
    assert.ok(target, entry.url + ': static intro');
    assert.equal(target.mode, 'after');
    assert.equal(target.anchor.closest('nav,aside,footer,[hidden]'), null);
    const h1 = (document.querySelector('main') || document.querySelector('section[aria-label="Truegold Chart"]')).querySelector('h1');
    assert.ok(target.anchor.contains(h1) || target.anchor.tagName === 'P', entry.url + ': introduction contains the title or its lead paragraph');
    const marker = document.createElement('aside'); marker.dataset.kdSponsor = 'test';
    target.anchor.after(marker);
    assert.equal(target.anchor.nextElementSibling, marker);
    marker.remove();
    assert.equal(document.documentElement.outerHTML, before, entry.url + ': original content unchanged');
    const main = document.querySelector('main') || document.querySelector('section[aria-label="Truegold Chart"]');
    const reader = doc('<div id="ks-guide-content">' + (main.tagName === 'MAIN' ? main.outerHTML : '<main>' + main.outerHTML + '</main>') + '</div>');
    reader.querySelectorAll('#ks-guide-content script, #ks-guide-content header, #ks-guide-content nav.tabs, #ks-guide-content .tabs[aria-label="Section navigation"]').forEach(node => node.remove());
    const remounted = core.findPlacement(reader, selected);
    assert.ok(remounted, entry.url + ': reader intro');
    assert.equal(remounted.anchor.textContent.trim(), target.anchor.textContent.trim());
    guideResults.push({ path: entry.url, locale: entry.locale, anchor: target.anchor.tagName, kind: target.anchor.classList.contains('hero') ? 'hero' : 'lead-paragraph' });
  }
});

const sitemapURLs = [...fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname);
test('all 644 published URLs load the bootstrap and only the 81 approved guides can activate', () => {
  assert.equal(sitemapURLs.length, 644);
  const hub = fs.readFileSync(path.join(ROOT, 'js/hub.js'), 'utf8');
  assert.ok(hub.includes("script.src = '/js/sponsors.js?v="));
  const approved = new Set(campaign.approvedPaths);
  const enabledConfig = { ...copy(campaign), enabled: true };
  const disabledConfig = { ...copy(campaign), enabled: false };
  let approvedSeen = 0;
  for (const pathname of sitemapURLs) {
    const file = resolvePage(ROOT, pathname); assert.ok(file, pathname + ': static file');
    const { document } = parseHTML(fs.readFileSync(file, 'utf8'));
    assert.ok([...document.querySelectorAll('script[src]')].some(node => /^\/js\/hub\.js(?:\?|$)/.test(node.getAttribute('src'))), pathname + ': bootstrap');
    const isApproved = approved.has(pathname);
    if (isApproved) approvedSeen++;
    assert.equal(!!core.selectCampaign(campaign, pathname), campaign.enabled && isApproved, pathname + ': actual manual state and exact allowlist');
    assert.equal(!!core.selectCampaign(enabledConfig, pathname), isApproved, pathname + ': only approved guides activate');
    assert.equal(core.selectCampaign(disabledConfig, pathname), null, pathname + ': manual disable overrides approvals');
  }
  assert.equal(approvedSeen, 81, 'Every operationally approved guide remains in the preserved sitemap');
});

(async () => {
  await asyncTest('read-only preflight accepts all 81 approved guides in either manual state', async () => {
    const current = await inspectConfig(campaign);
    assert.equal(current.valid, true, current.errors.join('\n'));
    assert.equal(current.state, campaign.enabled ? 'active' : 'disabled');
    assert.equal(current.imageCount, 8); assert.equal(current.paths.length, 81);
    for (const enabled of [false, true]) {
      const report = await inspectConfig({ ...copy(campaign), enabled });
      assert.equal(report.valid, true, report.errors.join('\n'));
      assert.equal(report.paths.length, 81);
      assert.equal(report.state, enabled ? 'active' : 'disabled');
    }
  });
  await asyncTest('preflight rejects empty approval, missing page, invalid placement and canonical aliases', async () => {
    const empty = await inspectConfig(active([])); assert.equal(empty.valid, false);
    const missing = await inspectConfig(active(['/ko/guides/not-an-approved-existing-page.html']));
    assert.ok(missing.errors.some(error => /no static HTML/.test(error)));
    const noIntro = await inspectConfig(active(['/calculator/']));
    assert.ok(noIntro.errors.some(error => /no safe static anchor/.test(error)));
    const alias = await inspectConfig({ ...active(['/ko/buildings/town-center/']), placements: ['content_end'] });
    assert.ok(alias.errors.some(error => /canonical/.test(error)));
  });
  await asyncTest('preflight rejects operational scope drift and obsolete schedule fields', async () => {
    for (const enabled of [false, true]) {
      const missing = { ...copy(campaign), enabled, approvedPaths: campaign.approvedPaths.slice(1) };
      assert.equal((await inspectConfig(missing)).valid, false, 'Manual disable must not erase the approved operational scope');
      const extra = { ...copy(campaign), enabled, approvedPaths: [...campaign.approvedPaths, '/ko/guides/'] };
      assert.equal((await inspectConfig(extra)).valid, false, 'A guide index is not one of the 81 approved detail pages');
    }
    for (const obsolete of [{ startsAt: null }, { endsAt: '2099-12-31T23:59:59Z' }]) {
      const report = await inspectConfig({ ...copy(campaign), ...obsolete });
      assert.equal(report.valid, false, 'Operational config must not imply an unused schedule');
    }
  });
  const failures = results.filter(result => !result.passed);
  console.log(JSON.stringify({ tests: results.length, passed: results.length - failures.length, failed: failures.length, campaignEnabled: campaign.enabled, approvedPaths: campaign.approvedPaths.length, guides: guideResults.length, sitemapURLs: sitemapURLs.length, guideLocales: guideResults.reduce((counts, row) => { counts[row.locale] = (counts[row.locale] || 0) + 1; return counts; }, {}), failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });

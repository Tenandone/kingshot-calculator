'use strict';

// Legacy generators remain available for editorial maintenance, but can only
// run in a fresh review copy. No command in this script promotes its output.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { ROOT, inspectPublishedSite } = require('./published-integrity');
const { inspectSeoRegressions } = require('./seo-regressions');
const { listSiteFiles, copyFiles } = require('./static-site-files');

function treeFiles(root, relative) {
  const output = [];
  const directory = path.join(root, relative);
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const file = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) output.push(...treeFiles(root, file));
    else if (entry.isFile()) output.push(file);
  }
  return output;
}

function reviewLegacyGeneration({ routesOnly = false } = {}) {
  const starting = inspectPublishedSite(ROOT);
  if (!starting.passed) throw new Error('Preservation baseline already differs; inspect it before regeneration.');
  const parent = path.join(ROOT, '.audit', 'regeneration-review');
  fs.mkdirSync(parent, { recursive: true });
  const workspace = fs.mkdtempSync(path.join(parent, 'review-'));
  const files = [...new Set([...listSiteFiles(ROOT), ...treeFiles(ROOT, 'scripts'), ...treeFiles(ROOT, '_lootbar'), 'package.json', 'package-lock.json'])];
  copyFiles(ROOT, workspace, files);
  fs.writeFileSync(path.join(workspace, '.regeneration-review.json'), JSON.stringify({ reviewOnly: true, sourceRoot: ROOT, workspace }, null, 2));
  const commands = routesOnly ? [['scripts/generate-static-routes.js']] : [
    ['scripts/apply-lootbar-state.js', '--restore'],
    ['scripts/generate-static-routes.js'],
    ['scripts/generate-calculation-proof.js'],
    ['scripts/prepare-publishing.js'],
    ['scripts/apply-lootbar-state.js'],
    ['scripts/sync-static-guides.js'],
    ['scripts/apply-index-policy.js'],
    ['scripts/generate-sitemap.js'],
    ['scripts/generate-catalog.js'],
    ['scripts/generate-image-manifest.js'],
    ['scripts/generate-context.js'],
    ['scripts/apply-verification-notices.js']
  ];
  const steps = [];
  for (const args of commands) {
    const result = cp.spawnSync(process.execPath, args, {
      cwd: workspace,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 60000,
      env: { ...process.env, NODE_PATH: path.join(ROOT, 'node_modules') }
    });
    steps.push({ command: args, exitCode: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message || null });
    if (result.status !== 0) break;
  }
  const generated = inspectPublishedSite(workspace);
  const sourceAfter = inspectPublishedSite(ROOT);
  const seo = inspectSeoRegressions(workspace);
  const report = {
    reviewOnly: true,
    workspace,
    sourcePreserved: sourceAfter.passed,
    commandsCompleted: steps.length === commands.length && steps.every(step => step.exitCode === 0),
    promotionAllowed: false,
    steps,
    generated,
    sourceAfter,
    seo
  };
  fs.writeFileSync(path.join(parent, 'latest.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('Isolated regeneration review: ' + workspace);
  console.log(`Generated sitemap: ${generated.actualSitemapUrls}; protected files changed: ${generated.changed.length}; source preserved: ${sourceAfter.passed}.`);
  console.log('Output is review-only and was not promoted into the published source.');
  if (!sourceAfter.passed || !report.commandsCompleted || !generated.passed || !seo.passed) process.exitCode = 1;
  return report;
}

if (require.main === module) {
  try { reviewLegacyGeneration({ routesOnly: process.argv.includes('--routes-only') }); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { reviewLegacyGeneration };

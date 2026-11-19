'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, inspectPublishedSite, sha256 } = require('./published-integrity');
const { inspectSeoRegressions } = require('./seo-regressions');
const { listSiteFiles, copyFiles } = require('./static-site-files');

function buildPreservedSite(root = ROOT) {
  const integrity = inspectPublishedSite(root);
  if (!integrity.passed) throw new Error('Published integrity failed: ' + integrity.errors.slice(0, 5).join('; '));
  const seo = inspectSeoRegressions(root);
  if (!seo.passed) throw new Error('New SEO findings or incomplete SEO audit. Run npm run check:seo.');
  // Each build gets a fresh directory. Never delete user files or overwrite a prior audit artifact.
  const builds = path.join(root, '.audit', 'static-build');
  fs.mkdirSync(builds, { recursive: true });
  const destination = fs.mkdtempSync(path.join(builds, 'site-'));
  const files = listSiteFiles(root);
  copyFiles(root, destination, files);
  const artifactIntegrity = inspectPublishedSite(destination);
  const copied = files.map(relative => {
    const source = fs.readFileSync(path.join(root, relative));
    const output = fs.readFileSync(path.join(destination, relative));
    if (sha256(source) !== sha256(output)) throw new Error('Copy integrity failure: ' + relative);
    return { path: relative, bytes: output.length, sha256: sha256(output) };
  });
  if (!artifactIntegrity.passed) throw new Error('Artifact integrity failed: ' + artifactIntegrity.errors.slice(0, 5).join('; '));
  const report = {
    passed: true,
    generatedAt: new Date().toISOString(),
    destination,
    deploySource: 'GitHub Pages main:/ remains authoritative; this directory is a local verification artifact only.',
    integrity,
    seo,
    files: copied
  };
  fs.writeFileSync(path.join(builds, 'latest.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (require.main === module) {
  try {
    const result = buildPreservedSite();
    console.log(`Static build passed: ${result.files.length} files; ${result.integrity.actualSitemapUrls} sitemap URLs preserved.`);
    console.log('Local artifact: ' + result.destination);
    console.log('Existing SEO findings: ' + result.seo.currentErrors + ' errors / ' + result.seo.currentWarnings + ' warnings; new findings: 0.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { buildPreservedSite };

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, inspectPublishedSite } = require('./published-integrity');
const result = inspectPublishedSite();
const directory = path.join(ROOT, '.audit', 'buffhub-implementation');
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'published-integrity.json'), JSON.stringify(result, null, 2) + '\n');
console.log(`Published integrity: ${result.actualSitemapUrls}/${result.expectedSitemapUrls} URLs, ${result.htmlFiles} unchanged HTML files, ${result.protectedFiles} protected files.`);
if (!result.passed) {
  for (const error of result.errors.slice(0, 30)) console.error(error);
  console.error('Build stopped. Review editorial changes explicitly; do not regenerate the baseline to hide differences.');
  process.exitCode = 1;
}

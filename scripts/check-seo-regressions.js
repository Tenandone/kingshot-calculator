'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./published-integrity');
const { inspectSeoRegressions } = require('./seo-regressions');
const result = inspectSeoRegressions();
const directory = path.join(ROOT, '.audit', 'buffhub-implementation');
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'seo-regressions.json'), JSON.stringify(result, null, 2) + '\n');
console.log(`SEO regression: ${result.newErrors?.length ?? '?'} new errors, ${result.newWarnings?.length ?? '?'} new warnings; existing ${result.currentErrors ?? '?'} errors / ${result.currentWarnings ?? '?'} warnings retained.`);
if (!result.passed) { console.error('SEO regression check failed. See the audit report.'); process.exitCode = 1; }

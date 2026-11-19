'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tests = [
  'scripts/test-hub.js',
  'scripts/test-calculation-proof.js',
  'scripts/test-primary-costs.js',
  'scripts/test-calculator-route-guard.js',
  'scripts/test-operator-profile.js',
  'scripts/test-operator-metrics.js',
  'scripts/test-buffhub-metrics-prep.js',
  'scripts/coupons/test-coupons.js',
  'scripts/external/test-schedule-engine.cjs',
  'scripts/test-sponsor-config.cjs',
  'scripts/test-sponsors-runtime.cjs',
  'scripts/test-buffhub-images.cjs',
  'scripts/test-published-integrity.js',
  'scripts/test-index-policy.js'
];
const results = [];
for (const file of tests) {
  const start = Date.now();
  const result = cp.spawnSync(process.execPath, [file], {cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 16 * 1024 * 1024});
  results.push({file, exitCode: result.status, milliseconds: Date.now() - start, stdout: result.stdout, stderr: result.stderr, error: result.error?.message || null});
  console.log((result.status === 0 ? 'PASS ' : 'FAIL ') + file);
}
const directory = path.join(root, '.audit', 'buffhub-implementation');
fs.mkdirSync(directory, {recursive: true});
const passed = results.every(result => result.exitCode === 0);
fs.writeFileSync(path.join(directory, 'final-tests.json'), JSON.stringify({checkedAt: new Date().toISOString(), passed, suites: results.length, results}, null, 2));
console.log('Local test suites: ' + results.filter(result => result.exitCode === 0).length + '/' + results.length);
if (!passed) process.exitCode = 1;

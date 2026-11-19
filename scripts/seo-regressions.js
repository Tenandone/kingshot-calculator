'use strict';
const path = require('node:path');
const cp = require('node:child_process');
const { ROOT, readJson } = require('./published-integrity');

function inspectSeoRegressions(root = ROOT) {
  const baseline = readJson(path.join(__dirname, 'published-seo-baseline.json'));
  const audit = cp.spawnSync(process.execPath, [path.join(__dirname, 'audit-static-seo.js')], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
    timeout: 60000,
    env: { ...process.env, KD_SEO_AUDIT_ROOT: root }
  });
  if (audit.error || ![0, 1].includes(audit.status)) {
    return { passed: false, errors: ['SEO audit did not complete'], auditExitCode: audit.status };
  }
  const output = String(audit.stdout) + '\n' + String(audit.stderr);
  const errors = output.split(/\r?\n/).filter(line => line.startsWith('[error] ')).map(line => line.slice(8));
  const warnings = output.split(/\r?\n/).filter(line => line.startsWith('[warning] ')).map(line => line.slice(10));
  const newErrors = errors.filter(item => !baseline.errors.includes(item));
  const newWarnings = warnings.filter(item => !baseline.warnings.includes(item));
  const expectedErrorCount = Number(output.match(/\[seo-audit\] errors:\s*(\d+)/)?.[1]);
  const expectedWarningCount = Number(output.match(/\[seo-audit\] warnings:\s*(\d+)/)?.[1]);
  const complete = errors.length === expectedErrorCount && warnings.length === expectedWarningCount;
  return {
    passed: complete && newErrors.length === 0 && newWarnings.length === 0,
    auditExitCode: audit.status,
    auditComplete: complete,
    existingErrors: baseline.errors.length,
    existingWarnings: baseline.warnings.length,
    currentErrors: errors.length,
    currentWarnings: warnings.length,
    newErrors,
    newWarnings,
    errors,
    warnings,
    note: 'Existing findings remain visible. A successful regression check means no new finding, not zero total SEO errors.'
  };
}
module.exports = { inspectSeoRegressions };

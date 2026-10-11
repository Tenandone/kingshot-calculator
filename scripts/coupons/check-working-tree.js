'use strict';

const path = require('path');
const { execFileSync } = require('child_process');
const ALLOWED = new Set(['data/coupons.json', 'data/coupon-candidates.json', 'DATA_CONFLICT_REPORT.md']);

function unexpectedCouponPaths(porcelain) {
  const entries = String(porcelain).split('\0');
  const unexpected = new Set();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const paths = [entry.slice(3)];
    if (/[RC]/.test(entry.slice(0, 2))) paths.push(entries[++i] || '');
    for (const file of paths) if (!ALLOWED.has(file)) unexpected.add(file);
  }
  return [...unexpected];
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..', '..');
  const status = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
  const unexpected = unexpectedCouponPaths(status);
  if (unexpected.length) {
    console.error('[coupon-boundary] Unexpected changed paths: ' + unexpected.map(file => JSON.stringify(file)).join(', '));
    process.exitCode = 1;
  } else {
    console.log('[coupon-boundary] Only the three allowed coupon outputs may change.');
  }
}

module.exports = { unexpectedCouponPaths };

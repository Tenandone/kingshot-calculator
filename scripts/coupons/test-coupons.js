'use strict';

const assert = require('assert');
const { mergeCouponData, normalizeCode } = require('./lib');
const { parseOfficialExpiry } = require('./sources/official-centurygames');

const NOW = '2026-09-18T00:00:00.000Z';
const source = (id, status, official = false, code = 'TESTCODE') => ({
  code,
  status,
  sourceId: id,
  sourceName: id,
  sourceUrl: 'https://example.com/' + id,
  official
});

function result(observations, published = [], candidates = []) {
  return mergeCouponData(published, candidates, observations, NOW);
}

{
  const merged = result([source('official', 'active', true)]);
  assert.equal(merged.coupons[0].status, 'active', 'official active code should publish');
  assert.equal(merged.coupons[0].confidence, 100);
}

{
  const merged = result([source('a', 'active'), source('b', 'active')]);
  assert.equal(merged.coupons[0].status, 'active', 'two independent active sources should publish');
  assert.equal(merged.coupons[0].verifiedSourceCount, 2);
}

{
  const merged = result([source('a', 'active')]);
  assert.equal(merged.candidates[0].status, 'candidate', 'one unofficial source should remain candidate');
  assert.equal(merged.coupons.length, 0);
}

{
  const published = [{ code: 'TestCode', until: 'permanent', manualOverride: true }];
  const merged = result([source('a', 'active', false, 'testcode')], published);
  assert.equal(merged.coupons.length, 1, 'case-insensitive duplicate should not create another row');
  assert.equal(merged.coupons[0].code, 'TestCode', 'manual casing should be preserved');
}

{
  const merged = result([{ ...source('official', 'active', true), expiresAt: '2026-09-17T00:00:00.000Z' }]);
  assert.equal(merged.coupons[0].status, 'expired', 'past expiration should win over active observation');
}

{
  const merged = result([source('a', 'active'), source('b', 'expired')]);
  assert.equal(merged.candidates[0].status, 'candidate', 'conflicting unofficial sources should not publish');
  assert.equal(merged.conflicts.length, 1);
}

assert.equal(normalizeCode(' Kingshot888 '), 'KINGSHOT888');
assert.equal(parseOfficialExpiry('14 Sept 2025, 23:59 UTC+0', '2025-09-11'), '2025-09-14T23:59:59.000Z');
assert.equal(parseOfficialExpiry('Jan 11, 23:59 UTC+0', '2026-01-09'), '2026-01-11T23:59:59.000Z');
console.log('Coupon automation tests passed.');

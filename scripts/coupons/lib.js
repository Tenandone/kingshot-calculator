'use strict';

const ACTIVE_STATUSES = new Set(['active', 'expiring']);

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function isPlausibleCode(value) {
  const code = String(value || '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9_-]{3,39}$/.test(code) && /[A-Za-z]/.test(code);
}

function parseTime(value) {
  if (!value || /^(permanent|perpetual|unlimited|ongoing|indefinite)$/i.test(String(value).trim())) return Infinity;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function deriveManualStatus(record, nowMs) {
  const expiry = parseTime(record.expiresAt || record.until);
  if (expiry === Infinity) return 'active';
  if (expiry == null) return record.status || 'candidate';
  if (expiry <= nowMs) return 'expired';
  if (expiry - nowMs <= 24 * 60 * 60 * 1000) return 'expiring';
  return 'active';
}

function confidenceFor(observations) {
  if (observations.some(item => item.official)) return 100;
  const count = new Set(observations.map(item => item.sourceId)).size;
  if (count >= 3) return 90;
  if (count >= 2) return 80;
  return 50;
}

function compactSource(observation, checkedAt) {
  const source = {
    id: observation.sourceId,
    name: observation.sourceName,
    url: observation.sourceUrl,
    official: Boolean(observation.official),
    observedStatus: observation.status,
    checkedAt
  };
  if (observation.expiresAt) source.observedExpiresAt = observation.expiresAt;
  return source;
}

function mergeSourceHistory(previous, observations, checkedAt) {
  const byId = new Map((previous || []).map(item => [item.id, item]));
  for (const observation of observations) {
    byId.set(observation.sourceId, compactSource(observation, checkedAt));
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function decideObservationStatus(observations, nowMs) {
  const official = observations.filter(item => item.official);
  const officialActive = official.some(item => ACTIVE_STATUSES.has(item.status));
  const officialExpired = official.some(item => item.status === 'expired');
  const activeSources = new Set(observations.filter(item => ACTIVE_STATUSES.has(item.status)).map(item => item.sourceId));
  const expiredSources = new Set(observations.filter(item => item.status === 'expired').map(item => item.sourceId));
  const sourceConflict = activeSources.size > 0 && expiredSources.size > 0;
  const conflict = sourceConflict && official.length === 0;
  const expiries = observations.map(item => item.expiresAt).filter(Boolean).map(parseTime).filter(value => value !== null && value !== Infinity);
  const expiresAt = expiries.length ? new Date(Math.min(...expiries)).toISOString() : null;

  let status = 'candidate';
  if (officialActive && !officialExpired) status = 'active';
  else if (officialExpired && !officialActive) status = 'expired';
  else if (!sourceConflict && activeSources.size >= 2) status = 'active';
  else if (!sourceConflict && expiredSources.size >= 2) status = 'expired';

  if (status === 'active' && expiresAt) {
    const expiryMs = parseTime(expiresAt);
    if (expiryMs <= nowMs) status = 'expired';
    else if (expiryMs - nowMs <= 24 * 60 * 60 * 1000) status = 'expiring';
  }

  return {
    status,
    conflict,
    expiresAt,
    officialVerified: official.length > 0,
    verifiedSourceCount: new Set(observations.map(item => item.sourceId)).size,
    confidence: confidenceFor(observations)
  };
}

function groupObservations(observations) {
  const groups = new Map();
  for (const observation of observations) {
    if (!isPlausibleCode(observation.code)) continue;
    const key = normalizeCode(observation.code);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...observation, code: String(observation.code).trim() });
  }
  return groups;
}

function migrateManualRecord(record, nowMs) {
  const code = String(record.code || '').trim();
  const status = deriveManualStatus(record, nowMs);
  const migrated = {
    ...record,
    code,
    normalizedCode: normalizeCode(code),
    status,
    manualOverride: record.manualOverride !== false,
    officialVerified: Boolean(record.officialVerified),
    verifiedSourceCount: Number(record.verifiedSourceCount || 0),
    confidence: Number(record.confidence || 100)
  };
  if (!Array.isArray(migrated.sources)) migrated.sources = [{ id: 'manual', name: 'KingshotData manual record', official: false }];
  return migrated;
}

function buildRecord(previous, observations, decision, checkedAt) {
  const first = observations[0];
  const record = {
    ...(previous || {}),
    code: previous && previous.code ? previous.code : first.code,
    normalizedCode: normalizeCode(first.code),
    status: decision.status,
    discoveredAt: previous && previous.discoveredAt ? previous.discoveredAt : checkedAt,
    firstSeenAt: previous && previous.firstSeenAt ? previous.firstSeenAt : checkedAt,
    lastSeenAt: checkedAt,
    expiresAt: decision.expiresAt,
    rewards: previous && Array.isArray(previous.rewards) ? previous.rewards : [],
    sources: mergeSourceHistory(previous && previous.sources, observations, checkedAt),
    officialVerified: decision.officialVerified,
    verifiedSourceCount: decision.verifiedSourceCount,
    lastCheckedAt: checkedAt,
    confidence: decision.confidence,
    manualOverride: false
  };
  if (record.expiresAt) record.until = record.expiresAt.slice(0, 10);
  else delete record.until;
  if (decision.conflict) record.notes = 'Source status conflict; not published as active.';
  else if (record.notes === 'Source status conflict; not published as active.') delete record.notes;
  return record;
}

function mergeCouponData(existingCoupons, existingCandidates, observations, checkedAt) {
  const nowMs = Date.parse(checkedAt);
  const published = new Map((existingCoupons || []).map(record => {
    const migrated = migrateManualRecord(record, nowMs);
    return [migrated.normalizedCode, migrated];
  }));
  const candidates = new Map((existingCandidates || []).map(record => [normalizeCode(record.code), record]));
  const conflicts = [];

  for (const [key, grouped] of groupObservations(observations)) {
    const decision = decideObservationStatus(grouped, nowMs);
    const manual = published.get(key);
    if (manual && manual.manualOverride) {
      manual.sources = mergeSourceHistory(manual.sources, grouped, checkedAt);
      manual.lastSeenAt = checkedAt;
      manual.lastCheckedAt = checkedAt;
      manual.officialVerified = manual.officialVerified || decision.officialVerified;
      manual.verifiedSourceCount = Math.max(manual.verifiedSourceCount || 0, decision.verifiedSourceCount);
      continue;
    }

    const previous = manual || candidates.get(key);
    const next = buildRecord(previous, grouped, decision, checkedAt);
    if (decision.conflict) conflicts.push({ code: next.code, sources: next.sources });

    if (decision.status === 'active' || decision.status === 'expiring' || decision.status === 'expired') {
      published.set(key, next);
      candidates.delete(key);
    } else {
      candidates.set(key, next);
      published.delete(key);
    }
  }

  const rank = { expiring: 0, active: 1, candidate: 2, expired: 3, rejected: 4 };
  const sortRecords = (a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || String(b.expiresAt || b.until || '').localeCompare(String(a.expiresAt || a.until || '')) || a.normalizedCode.localeCompare(b.normalizedCode);
  return {
    coupons: [...published.values()].sort(sortRecords),
    candidates: [...candidates.values()].sort(sortRecords),
    conflicts: conflicts.sort((a, b) => normalizeCode(a.code).localeCompare(normalizeCode(b.code)))
  };
}

module.exports = {
  normalizeCode,
  isPlausibleCode,
  parseTime,
  deriveManualStatus,
  decideObservationStatus,
  mergeCouponData
};

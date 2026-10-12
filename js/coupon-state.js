/* Shared coupon publication/expiry rules. Pure: no storage, network or clock reads. */
(function (root) {
  'use strict';
  const permanentWords = new Set(['permanent', 'perpetual', 'unlimited', 'ongoing', 'indefinite', 'infinite', 'forever', 'no-expiry', 'noexp', 'nolimit', '∞', '상시', '무기한', '常設', '無期限', '常駐', '常駐序號', '永久']);
  const text = value => value == null ? '' : String(value).trim();
  const isPermanent = value => permanentWords.has(text(value).toLowerCase());

  // Date-only legacy `until` values retain their established UTC-midnight meaning.
  // Unzoned date-times and human-language dates are not guessed in the user's zone.
  function instant(value) {
    const raw = text(value);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2}))?$/i);
    if (!match) return null;
    const [, year, month, day, hour, minute, second, , zone] = match;
    const y = Number(year), m = Number(month), d = Number(day);
    const calendar = new Date(Date.UTC(y, m - 1, d));
    if (calendar.getUTCFullYear() !== y || calendar.getUTCMonth() !== m - 1 || calendar.getUTCDate() !== d) return null;
    if (hour != null && (Number(hour) > 23 || Number(minute) > 59 || Number(second || 0) > 59)) return null;
    if (zone && zone.toUpperCase() !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59)) return null;
    const ms = Date.parse(hour == null ? raw + 'T00:00:00Z' : raw);
    return Number.isFinite(ms) ? ms : null;
  }

  function expiry(coupon) {
    const c = coupon || {};
    // Explicit expiresAt is authoritative; fall back to legacy until only if absent.
    const field = text(c.expiresAt) ? 'expiresAt' : 'until';
    const raw = text(c[field]);
    if (!raw) return { kind: 'unknown', ms: null, field: null };
    if (isPermanent(raw)) return { kind: 'permanent', ms: null, field };
    const ms = instant(raw);
    return { kind: ms == null ? 'invalid' : 'exact', ms, field };
  }

  function state(coupon, nowMs) {
    const c = coupon || {}, status = text(c.status).toLowerCase(), end = expiry(c);
    const startRaw = text(c.startAt), startMs = instant(startRaw);
    let reason = 'unconfirmed';
    if (!text(c.code)) reason = 'missing-code';
    else if (!Number.isFinite(nowMs)) reason = 'invalid-clock';
    else if (['candidate', 'rejected', 'expired'].includes(status)) reason = status;
    else if (startRaw && startMs == null) reason = 'invalid-start';
    else if (startMs != null && nowMs < startMs) reason = 'not-started';
    else if (end.kind === 'exact' && nowMs >= end.ms) reason = 'expired';
    else if (status === 'active' || status === 'expiring') reason = 'active';
    else if (!status && (end.kind === 'exact' || end.kind === 'permanent')) reason = 'active';
    return { active: reason === 'active', expired: reason === 'expired', reason, expiryKind: end.kind, expiresAtMs: end.ms, startsAtMs: startMs };
  }

  const isActive = (coupon, nowMs) => state(coupon, nowMs).active;
  const isExpired = (coupon, nowMs) => state(coupon, nowMs).expired;
  function nextExpiry(coupons, nowMs) {
    const times = coupons.filter(c => isActive(c, nowMs)).map(c => expiry(c).ms).filter(Number.isFinite);
    return times.length ? Math.min(...times) : null;
  }
  function nextChange(coupons, nowMs) {
    const times = coupons.flatMap(c => [expiry(c).ms, instant(c && c.startAt)]).filter(ms => Number.isFinite(ms) && ms > nowMs);
    return times.length ? Math.min(...times) : null;
  }
  function sortActive(a, b) {
    const rank = c => { const end = expiry(c); return end.kind === 'exact' ? end.ms : Infinity; };
    const x = rank(a), y = rank(b);
    return x === y ? 0 : x < y ? -1 : 1;
  }
  const api = Object.freeze({ version: 'ks-ui12-coupon-state-v1', instant, expiry, state, isActive, isExpired, nextExpiry, nextChange, sortActive });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.KD_COUPON_STATE = api;
})(typeof window === 'undefined' ? globalThis : window);

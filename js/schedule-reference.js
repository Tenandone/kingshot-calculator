/* Date-only community references never become confirmed countdowns. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root || !root.document) return;
  const refresh = () => api.refresh(root.document, new Date());
  refresh();
  root.addEventListener('pageshow', refresh);
  root.document.addEventListener('visibilitychange', () => { if (!root.document.hidden) refresh(); });
  // A page left open overnight must not retain an expired reference.
  root.setInterval(refresh, 60000);
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  function dateOnly(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value ? value : null;
  }
  function visible(input, now) {
    const epoch = now instanceof Date ? now.valueOf() : NaN;
    if (!Number.isFinite(epoch) || !dateOnly(input.start) || !dateOnly(input.end) || input.end < input.start) return false;
    if (!['community-provisional', 'community-cycle-reference'].includes(input.status)) return false;
    const observed = Date.parse(input.observed), review = Date.parse(input.review);
    if (!Number.isFinite(observed) || !Number.isFinite(review) || observed > epoch || review <= epoch || review <= observed) return false;
    // UTC calendar comparison is a conservative hiding rule, not an inferred event start instant.
    return input.start > now.toISOString().slice(0, 10);
  }
  function refresh(doc, now) {
    doc.querySelectorAll('[data-schedule-reference]').forEach(node => {
      const show = visible(node.dataset, now);
      node.hidden = !show;
      const fallback = doc.getElementById(node.dataset.fallback);
      if (fallback) fallback.hidden = show;
    });
  }
  return { dateOnly, visible, refresh };
});

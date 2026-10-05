// Shared by the publishing scripts and the browser. Rebuild after changing a flag.
(function (root) {
  'use strict';
  var features = Object.freeze({ LOOTBAR_ENABLED: false });
  if (typeof module === 'object' && module.exports) module.exports = features;
  else root.KINGSHOT_FEATURES = features;
})(typeof window !== 'undefined' ? window : this);

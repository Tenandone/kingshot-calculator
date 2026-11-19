'use strict';
const fs = require('node:fs');
const path = require('node:path');

function assertRegenerationWorkspace(root) {
  root = path.resolve(root);
  const sentinel = path.join(root, '.regeneration-review.json');
  let context;
  try { context = JSON.parse(fs.readFileSync(sentinel, 'utf8')); } catch (_) {}
  const parent = context && path.join(path.resolve(context.sourceRoot), '.audit', 'regeneration-review');
  if (!context || context.reviewOnly !== true || !root.startsWith(parent + path.sep) || path.resolve(context.workspace) !== root) {
    throw new Error('Direct regeneration of published source is disabled. Use npm run regenerate:review; it writes an isolated review copy and never promotes it automatically.');
  }
}
module.exports = { assertRegenerationWorkspace };

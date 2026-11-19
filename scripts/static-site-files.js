'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { resolveInside } = require('./published-integrity');

const excludedDirectories = new Set(['node_modules', 'dist', 'dist-ssr', 'reports', 'scripts', '_lootbar']);
const staticExtensions = new Set(['.html', '.js', '.css', '.json', '.xml', '.txt', '.webmanifest', '.png', '.webp', '.avif', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.webm', '.mp3', '.ogg']);

function listSiteFiles(root) {
  const output = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!excludedDirectories.has(entry.name)) walk(file);
      } else if (entry.isFile()) {
        const relative = path.relative(root, file).replace(/\\/g, '/');
        if (['package.json', 'package-lock.json', 'bump-version.js', 'inject-ga.js'].includes(relative)) continue;
        if (!relative.includes('/') && path.extname(relative) === '.txt' && !['ads.txt', 'robots.txt'].includes(relative)) continue;
        if (staticExtensions.has(path.extname(file).toLowerCase()) || ['CNAME', 'ads.txt', 'robots.txt'].includes(relative)) output.push(relative);
      }
    }
  }
  walk(root);
  return output.sort();
}

function copyFiles(root, destination, files) {
  for (const relative of files) {
    const source = resolveInside(root, relative);
    const target = resolveInside(destination, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

module.exports = { listSiteFiles, copyFiles };

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://kingshotdata.kr';
const LANGS = [
  { folder: 'ko', code: 'ko', htmlLang: 'ko' },
  { folder: 'en', code: 'en', htmlLang: 'en' },
  { folder: 'ja', code: 'ja', htmlLang: 'ja' },
  { folder: 'zh-tw', code: 'zh-TW', htmlLang: 'zh-Hant' }
];

const GENERIC_ROUTES = [
  '/',
  '/heroes',
  '/events',
  '/calculator',
  '/calc-building',
  '/calc-gear',
  '/calc-charm',
  '/calc-training',
  '/calc-pet',
  '/waracademy',
  '/about',
  '/privacy'
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function readHeroes() {
  return readJson(path.join(ROOT, 'data', 'heroes.json'));
}

function readEvents() {
  const data = readJson(path.join(ROOT, 'data', 'events.json'));
  return Array.isArray(data.events)
    ? data.events.map(event => ({ ...event, verifiedAt: event.verifiedAt || data.verifiedAt }))
    : [];
}

function getRoutePaths() {
  return GENERIC_ROUTES.concat(
    readHeroes()
      .filter(hero => hero && hero.slug)
      .map(hero => '/hero/' + encodeURIComponent(hero.slug)),
    readEvents()
      .filter(event => event && event.slug)
      .map(event => '/events/' + encodeURIComponent(event.slug))
  );
}

function localizedPath(routePath, lang) {
  const clean = routePath === '/' ? '/' : '/' + String(routePath).split('/').filter(Boolean).join('/');
  if (clean === '/') return lang.code === 'ko' ? '/' : '/' + lang.folder + '/';
  const prefix = lang.code === 'ko' ? '' : '/' + lang.folder;
  return prefix + clean + '/';
}

function outputFile(routePath, lang) {
  const pathname = localizedPath(routePath, lang);
  return path.join(ROOT, pathname.replace(/^\//, ''), 'index.html');
}

function absoluteUrl(routePath, lang) {
  return ORIGIN + localizedPath(routePath, lang);
}

function getStaticRoutes() {
  const routes = [];
  for (const routePath of getRoutePaths()) {
    for (const lang of LANGS) {
      routes.push({
        routePath,
        lang,
        pathname: localizedPath(routePath, lang),
        url: absoluteUrl(routePath, lang),
        file: outputFile(routePath, lang)
      });
    }
  }
  return routes;
}

module.exports = {
  ROOT,
  ORIGIN,
  LANGS,
  GENERIC_ROUTES,
  readJson,
  readHeroes,
  readEvents,
  getRoutePaths,
  localizedPath,
  outputFile,
  absoluteUrl,
  getStaticRoutes
};

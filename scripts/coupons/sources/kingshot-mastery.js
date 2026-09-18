'use strict';

const { fetchText, decodeEntities, jsonLdBlocks } = require('./helpers');

const SOURCE = {
  id: 'kingshot-mastery',
  name: 'Kingshot Mastery gift codes',
  url: 'https://kingshotmastery.com/gift-codes',
  official: false,
  tier: 2,
  robotsAllowed: true
};

async function collect() {
  const html = await fetchText(SOURCE.url);
  const observations = [];
  const list = jsonLdBlocks(html).find(item => item['@type'] === 'ItemList' && /active kingshot gift codes/i.test(item.name || ''));
  if (list && Array.isArray(list.itemListElement)) {
    for (const entry of list.itemListElement) {
      observations.push({
        code: entry && (entry.name || (entry.item && entry.item.name)),
        status: 'active',
        sourceId: SOURCE.id,
        sourceName: SOURCE.name,
        sourceUrl: SOURCE.url,
        official: false
      });
    }
  }
  for (const match of html.matchAll(/<s>([A-Za-z0-9][A-Za-z0-9_-]{3,39})<\/s>/gi)) {
    observations.push({
      code: decodeEntities(match[1]),
      status: 'expired',
      sourceId: SOURCE.id,
      sourceName: SOURCE.name,
      sourceUrl: SOURCE.url,
      official: false
    });
  }
  if (!observations.length) throw new Error('No active or expired code markup was found');
  return observations;
}

module.exports = { ...SOURCE, collect };

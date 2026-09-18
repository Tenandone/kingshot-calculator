'use strict';

const { fetchText, jsonLdBlocks } = require('./helpers');

const SOURCE = {
  id: 'kingshot-net',
  name: 'Kingshot.net gift codes',
  url: 'https://v2.kingshot.net/gift-codes',
  official: false,
  tier: 2,
  robotsAllowed: true
};

async function collect() {
  const html = await fetchText(SOURCE.url);
  const list = jsonLdBlocks(html).find(item => item['@type'] === 'ItemList' && /gift codes/i.test(item.name || ''));
  if (!list || !Array.isArray(list.itemListElement)) throw new Error('Active ItemList was not found');
  const observations = list.itemListElement.map(entry => ({
    code: entry && (entry.name || (entry.item && entry.item.name)),
    status: 'active',
    sourceId: SOURCE.id,
    sourceName: SOURCE.name,
    sourceUrl: SOURCE.url,
    official: false
  })).filter(item => item.code);
  if (!observations.length) throw new Error('Active ItemList contained no coupon codes');
  return observations;
}

module.exports = { ...SOURCE, collect };

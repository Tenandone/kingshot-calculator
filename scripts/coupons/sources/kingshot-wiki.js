'use strict';

const { fetchText, decodeEntities } = require('./helpers');

const SOURCE = {
  id: 'kingshot-wiki',
  name: 'Kingshot Wiki gift codes',
  url: 'https://kingshotwiki.com/giftcodes/',
  official: false,
  tier: 2,
  robotsAllowed: true
};

async function collect() {
  const html = await fetchText(SOURCE.url);
  const observations = [];
  for (const match of html.matchAll(/<span\s+class=["']code["'][^>]*>([^<]+)<\/span>/gi)) {
    observations.push({
      code: decodeEntities(match[1]).trim(),
      status: 'active',
      sourceId: SOURCE.id,
      sourceName: SOURCE.name,
      sourceUrl: SOURCE.url,
      official: false
    });
  }
  if (!observations.length) throw new Error('No active code markup was found');
  return observations;
}

module.exports = { ...SOURCE, collect };

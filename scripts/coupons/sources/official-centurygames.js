'use strict';

const { fetchText, htmlToText } = require('./helpers');

const SOURCE = {
  id: 'official-centurygames',
  name: 'Century Games official Kingshot posts',
  url: 'https://www.centurygames.com/wp-json/wp/v2/posts?search=Kingshot&per_page=100&_fields=link,date,modified,title,content',
  official: true,
  tier: 1,
  robotsAllowed: true
};

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function parseOfficialExpiry(value, postDate) {
  const text = String(value || '').replace(/[()]/g, ' ').trim();
  const monthFirst = text.match(/(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:,?\s+(\d{4}))?(?:,?\s+(\d{1,2}):(\d{2}))?/i);
  const dayFirst = text.match(/(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+(\d{4}))?(?:,?\s+(\d{1,2}):(\d{2}))?/i);
  if (!monthFirst && !dayFirst) return null;
  const baseYear = new Date(postDate).getUTCFullYear();
  const year = Number((monthFirst ? monthFirst[3] : dayFirst[3]) || baseYear);
  const monthName = monthFirst ? monthFirst[1] : dayFirst[2];
  const month = MONTHS[monthName.slice(0, 3).toLowerCase()];
  const day = Number(monthFirst ? monthFirst[2] : dayFirst[1]);
  const hour = Number((monthFirst ? monthFirst[4] : dayFirst[4]) || 23);
  const minute = Number((monthFirst ? monthFirst[5] : dayFirst[5]) || 59);
  return new Date(Date.UTC(year, month, day, hour, minute, 59)).toISOString();
}

async function collect() {
  const posts = JSON.parse(await fetchText(SOURCE.url));
  const observations = [];
  const now = Date.now();
  for (const post of posts) {
    const text = htmlToText(post.content && post.content.rendered);
    const codeMatch = text.match(/Gift\s*Code\s*:\s*([A-Za-z0-9][A-Za-z0-9_-]{3,39})/i);
    if (!codeMatch) continue;
    const expiryMatch = text.match(/Valid\s*Until\s*:\s*([^\n.]+)/i);
    const expiresAt = expiryMatch ? parseOfficialExpiry(expiryMatch[1], post.date) : null;
    observations.push({
      code: codeMatch[1],
      status: expiryMatch && !expiresAt ? 'candidate' : (expiresAt && Date.parse(expiresAt) <= now ? 'expired' : 'active'),
      expiresAt,
      sourceId: SOURCE.id,
      sourceName: SOURCE.name,
      sourceUrl: post.link || SOURCE.url,
      official: true
    });
  }
  return observations;
}

module.exports = { ...SOURCE, collect, parseOfficialExpiry };

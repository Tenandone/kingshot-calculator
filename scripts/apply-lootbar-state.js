'use strict';
// Remove disabled promotions before publication, retaining reversible source fragments.
// _lootbar is excluded from GitHub Pages by Jekyll's underscore-directory rule.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parse } = require('parse5');
const { LOOTBAR_ENABLED } = require('../js/site-features');
const ROOT = path.resolve(__dirname, '..');
const archiveFile = path.join(ROOT, '_lootbar', 'source.json');
const archive = fs.existsSync(archiveFile) ? JSON.parse(fs.readFileSync(archiveFile, 'utf8')) : {};
const marker = /<!-- lootbar-disabled:([a-f0-9]+) -->/g;
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.name.startsWith('.') || ['node_modules', 'dist', '_lootbar'].includes(e.name)) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : e.name.endsWith('.html') ? [p] : [];
  });
}
function remember(html) {
  const id = crypto.createHash('sha256').update(html).digest('hex').slice(0, 24);
  archive[id] = html;
  return `<!-- lootbar-disabled:${id} -->`;
}
const attr = (n, key) => (n.attrs || []).find(a => a.name === key)?.value || '';
const cls = n => attr(n, 'class').split(/\s+/);
function nodes(root) {
  return [root, ...(root.childNodes || []).flatMap(nodes)];
}
function text(n) {
  if (n.nodeName === '#text') return n.value;
  if (['script', 'style'].includes(n.tagName)) return '';
  return (n.childNodes || []).map(text).join(' ');
}
const promoWords = /lootbar|루트바|top[ -]?up|충전|チャージ|儲值|充值/i;
const promoURL = /lootbar\.|\/topup-(?:guide|promotion)(?:\.html|\/|$)|cafe\.naver\.com\/kingshot1\/5567/i;
function notice(relative, original) {
  const lang = relative.split('/')[0];
  const labels = {
    ko: ['안내 일시 중단', '이 페이지에서 안내하던 외부 서비스는 현재 이용할 수 없어 관련 안내를 중단했습니다. 게임 데이터, 계산기와 일반 가이드는 계속 이용할 수 있습니다.', '가이드', '계산기'],
    ja: ['ご案内を一時停止しています', 'このページで紹介していた外部サービスは現在利用できないため、ご案内を停止しています。ゲームデータ、計算機、通常のガイドは引き続き利用できます。', 'ガイド', '計算機'],
    'zh-tw': ['此頁說明暫停提供', '此頁介紹的外部服務目前無法使用，因此暫停提供相關說明。遊戲資料、計算機及一般攻略仍可使用。', '攻略', '計算機'],
    en: ['This guide is temporarily unavailable', 'The external service previously described here is currently unavailable, so this guide is paused. Game data, calculators and general guides remain available.', 'Guides', 'Calculators']
  };
  const l = labels[lang] || labels.en;
  const folder = labels[lang] ? lang : 'en';
  const prefix = folder === 'ko' ? '' : '/' + folder;
  const policyFooter = original.match(/<!-- shared-policy-footer:start -->[\s\S]*?<!-- shared-policy-footer:end -->/)?.[0] || '';
  return `<!doctype html>\n${remember(original)}\n<!-- lootbar-notice -->\n<html lang="${folder}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>${l[0]} | KingshotData</title><meta name="description" content="${l[1]}"><link rel="canonical" href="https://kingshotdata.kr/${relative}"><link rel="stylesheet" href="/css/common.css"></head><body><main style="max-width:760px;margin:48px auto;padding:24px;font:16px/1.8 system-ui"><h1>${l[0]}</h1><p>${l[1]}</p><nav><a href="/${folder}/guides/">${l[2]}</a> · <a href="${prefix}/calculator/">${l[3]}</a></nav></main>${policyFooter}</body></html>\n`;
}
let changed = 0, fragments = 0;
for (const file of files(ROOT)) {
  const before = fs.readFileSync(file, 'utf8');
  let html = before;
  if (html.includes('<!-- lootbar-notice -->')) {
    const id = /<!-- lootbar-disabled:([a-f0-9]+) -->/.exec(html)?.[1];
    if (!archive[id]) throw Error('Missing preserved page: ' + file);
    html = archive[id];
  } else html = html.replace(marker, (_, id) => {
    if (!archive[id]) throw Error('Missing preserved fragment: ' + id);
    return archive[id];
  });
  const relative = path.relative(ROOT, file).replace(/\\/g, '/');
  if (!process.argv.includes('--restore') && !LOOTBAR_ENABLED) {
    if (/(?:^|\/)topup-(guide|promotion)\.html$/.test(relative)) {
      html = notice(relative, html);
    } else {
      const all = nodes(parse(html, { sourceCodeLocationInfo: true }));
      const removed = new Set();
      for (const n of all) {
        if (!n.sourceCodeLocation || !n.tagName) continue;
        const id = attr(n, 'id');
        // Coupon-tool promotions and the unused landing-page affiliate controls.
        if (['popBack', 'footerAdBtn', 'topupBtn', 'bottomTopup'].includes(id) ||
            (relative === 'tools/coupon-countdown.html' && cls(n).some(c => ['stickyBar', 'midBanner', 'iframeSection'].includes(c)))) removed.add(n);
        if (id === 'bannerLink') removed.add(n.parentNode);
        if (n.tagName === 'a' && promoURL.test(attr(n, 'href'))) {
          let target = n;
          for (let p = n.parentNode; p && p.tagName !== 'body'; p = p.parentNode) {
            if (cls(p).includes('g-block') || (cls(p).includes('links') && (p.childNodes || []).filter(x => x.tagName === 'a').length === 1)) { target = p; break; }
          }
          if (target === n && n.parentNode?.tagName === 'p' && text(n.parentNode).trim() === text(n).trim()) target = n.parentNode;
          removed.add(target);
        }
        // Promotional prose in mixed guides; gameplay purchase/pack data is retained.
        if (n.tagName === 'p' && promoWords.test(text(n)) && /\/guides\/(hallofgovernors|truegold|kingshot-bear-reward|waves-voyage-guide)\.html$/.test(relative)) removed.add(n);
      }
      const ranges = [...removed].filter(n => n.sourceCodeLocation).map(n => n.sourceCodeLocation)
        .sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
      const outer = [];
      for (const r of ranges) if (!outer.some(p => p.startOffset <= r.startOffset && p.endOffset >= r.endOffset)) outer.push(r);
      for (const r of outer.reverse()) {
        html = html.slice(0, r.startOffset) + remember(html.slice(r.startOffset, r.endOffset)) + html.slice(r.endOffset);
        fragments++;
      }
    }
  }
  if (html !== before) { fs.writeFileSync(file, html); changed++; }
}
fs.mkdirSync(path.dirname(archiveFile), { recursive: true });
fs.writeFileSync(archiveFile, JSON.stringify(archive, null, 2) + '\n');
console.log(`LootBar enabled=${LOOTBAR_ENABLED}; changed ${changed} pages; suppressed ${fragments} fragments.`);

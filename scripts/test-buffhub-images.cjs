'use strict';

// Acceptance checks for the actual approved creative artifacts; no browser/network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { checkImages } = require('./optimize-buffhub-images.cjs');
const ROOT = path.resolve(__dirname, '..');
const SOURCE_HASHES = {
  ko: '2e6e436666f07c1b007b77dd996127680182fc0633c9358fa1d0b5e9951df221',
  'zh-tw': '55f9ad518c1cfcd7b770056b638c61dc6d96383abeb0ded4505c4679305c464a',
  ja: '1f5fb41f6bb3fe6e33c0d502ed8cf6fe2182b725f4e2647a49456a49bd8281d7',
  en: '6336e593fd9f64b8d8779eb3da8e18f5f4c9a7cde0a5df78985c2924bbfe2a99'
};

(async () => {
  const manifest = await checkImages();
  const outputHashes = new Set();
  let bytes = 0;
  for (const [locale, entry] of Object.entries(manifest.locales)) {
    // A replacement creative needs an explicit review/update, not only a filename swap.
    assert.equal(entry.source.sha256, SOURCE_HASHES[locale], `${locale}: approved source fingerprint`);
    assert.equal(entry.source.width, locale === 'en' ? 1456 : 4436, `${locale}: source width`);
    assert.equal(entry.source.height, locale === 'en' ? 180 : 548, `${locale}: source height`);
    for (const variant of entry.variants) {
      const buffer = fs.readFileSync(path.join(ROOT, 'img', 'sponsors', 'buffhub', variant.file));
      const metadata = await sharp(buffer).metadata();
      assert.equal(variant.width / variant.height, 728 / 90, `${locale}: exact display ratio`);
      assert.ok(variant.bytes <= (variant.width === 728 ? 30 : 70) * 1024, `${locale}: transfer budget`);
      assert.ok(variant.bytes < entry.source.bytes, `${locale}: smaller than original PNG`);
      assert.equal(metadata.exif, undefined, `${locale}: no source EXIF shipped`);
      const stats = await sharp(buffer).stats();
      // The source PNGs have RGBA channels, but every source alpha value is 255.
      // WebP may omit the redundant alpha channel without changing appearance.
      assert.equal(entry.source.isOpaque, true, `${locale}: approved source is opaque`);
      assert.equal(stats.isOpaque, true, `${locale}: source opacity preserved`);
      assert.ok(stats.entropy > 4, `${locale}: actual banner pixels, not a blank image`);
      outputHashes.add(variant.sha256);
      bytes += variant.bytes;
    }
  }
  assert.equal(outputHashes.size, 8, 'All four languages and both resolutions are distinct assets');
  console.log(`BUFFHUB images: 4 approved source fingerprints, 8 decodable WebP assets, dimensions/opacity/metadata/budgets passed (${bytes} bytes total).`);
})().catch(error => { console.error(error); process.exitCode = 1; });

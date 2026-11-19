'use strict';

// Resize and encode the advertiser-supplied PNGs. Never modifies the source files.
// Usage: node scripts/optimize-buffhub-images.cjs --source-dir "<PNG directory>"
// Append --check to verify the existing outputs and source hashes without writing.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'img', 'sponsors', 'buffhub');
const SOURCES = Object.freeze({
  ko: 'buffhub-kingshot-ko-1456x180.png',
  'zh-tw': 'buffhub-kingshot-zh-TW-1456x180.png',
  ja: 'buffhub-kingshot-ja-1456x180.png',
  en: 'buffhub-kingshot-en-1456x180.png'
});
const SIZES = Object.freeze([{ width: 728, height: 90 }, { width: 1456, height: 180 }]);
const WEBP = Object.freeze({ quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true });
const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

async function optimizeImages({ sourceDir, outputDir = OUTPUT }) {
  if (!sourceDir) throw new Error('A --source-dir containing the four original PNGs is required.');
  const sourceRoot = fs.realpathSync(sourceDir);
  const outputRoot = path.resolve(outputDir);
  if (outputRoot === sourceRoot) throw new Error('Keep optimized output separate from the original PNG directory.');
  const pending = [];
  const manifest = {
    schemaVersion: 1,
    encoder: { sharp: sharp.versions.sharp, libvips: sharp.versions.vips, webp: sharp.versions.webp },
    display: { width: 728, height: 90 },
    resize: { fit: 'contain', kernel: 'lanczos3', background: 'transparent', withoutEnlargement: true },
    webp: WEBP,
    locales: {}
  };

  for (const [locale, filename] of Object.entries(SOURCES)) {
    const input = fs.readFileSync(path.join(sourceRoot, filename));
    const metadata = await sharp(input).metadata();
    const sourceStats = await sharp(input).stats();
    if (metadata.format !== 'png' || !metadata.width || !metadata.height) throw new Error(`Invalid source PNG: ${filename}`);
    if (metadata.width < 1456 || metadata.height < 180) throw new Error(`Source is too small for the 2x banner: ${filename}`);
    const source = { file: filename, width: metadata.width, height: metadata.height, bytes: input.length, sha256: sha256(input), isOpaque: sourceStats.isOpaque };
    const variants = [];
    for (const { width, height } of SIZES) {
      const output = await sharp(input)
        .resize(width, height, {
          fit: 'contain',
          kernel: 'lanczos3',
          withoutEnlargement: true,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .ensureAlpha()
        .webp(WEBP)
        .toBuffer();
      const file = `buffhub-${locale}-${width}.webp`;
      variants.push({
        file,
        src: `/img/sponsors/buffhub/${file}`,
        width,
        height,
        bytes: output.length,
        sha256: sha256(output),
        reductionPercent: Number(((1 - output.length / input.length) * 100).toFixed(2))
      });
      pending.push({ file, buffer: output });
    }
    manifest.locales[locale] = { source, variants };
  }

  // Detect a source changed during encoding, before writing any deployment assets.
  for (const { source } of Object.values(manifest.locales)) {
    if (sha256(fs.readFileSync(path.join(sourceRoot, source.file))) !== source.sha256) {
      throw new Error(`Source PNG changed during encoding: ${source.file}`);
    }
  }
  fs.mkdirSync(outputRoot, { recursive: true });
  for (const { file, buffer } of pending) fs.writeFileSync(path.join(outputRoot, file), buffer);
  fs.writeFileSync(path.join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

async function checkImages({ sourceDir, outputDir = OUTPUT } = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(outputDir, 'manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== 1) throw new Error('Unsupported image manifest version.');
  if (Object.keys(manifest.locales || {}).sort().join(',') !== Object.keys(SOURCES).sort().join(',')) {
    throw new Error('The manifest must contain exactly KO, TW, JA and EN.');
  }
  for (const [locale, filename] of Object.entries(SOURCES)) {
    const entry = manifest.locales[locale];
    if (entry.source.file !== filename) throw new Error(`Wrong source matching: ${locale}`);
    if (sourceDir && sha256(fs.readFileSync(path.join(sourceDir, filename))) !== entry.source.sha256) {
      throw new Error(`Original PNG hash differs: ${filename}`);
    }
    if (entry.variants.length !== SIZES.length) throw new Error(`Missing responsive variant: ${locale}`);
    for (let index = 0; index < SIZES.length; index++) {
      const variant = entry.variants[index], size = SIZES[index];
      const expectedFile = `buffhub-${locale}-${size.width}.webp`;
      if (variant.file !== expectedFile || variant.src !== `/img/sponsors/buffhub/${expectedFile}`) {
        throw new Error(`Wrong output matching: ${locale}`);
      }
      const buffer = fs.readFileSync(path.join(outputDir, variant.file));
      const metadata = await sharp(buffer).metadata();
      if (metadata.format !== 'webp' || metadata.width !== size.width || metadata.height !== size.height ||
          variant.width !== size.width || variant.height !== size.height ||
          buffer.length !== variant.bytes || sha256(buffer) !== variant.sha256) {
        throw new Error(`Corrupt or mismatched banner: ${variant.file}`);
      }
      if (buffer.length > 100 * 1024) throw new Error(`Banner exceeds 100 KiB budget: ${variant.file}`);
      // Fully decode each file as well as inspecting its header.
      await sharp(buffer).raw().toBuffer();
    }
  }
  return manifest;
}

async function main(args) {
  let sourceDir, check = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--source-dir' && args[index + 1]) sourceDir = args[++index];
    else if (args[index] === '--check') check = true;
    else throw new Error(`Unknown or incomplete argument: ${args[index]}`);
  }
  const manifest = check ? await checkImages({ sourceDir }) : await optimizeImages({ sourceDir });
  console.log(JSON.stringify({
    action: check ? 'verified' : 'encoded',
    originalPNGsModified: false,
    locales: Object.fromEntries(Object.entries(manifest.locales).map(([locale, entry]) => [locale, entry.variants.map(({ file, bytes }) => ({ file, bytes }))]))
  }, null, 2));
}

module.exports = { SOURCES, SIZES, WEBP, optimizeImages, checkImages };
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });

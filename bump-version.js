// bump-version.js (extended, env-aware, safer regex)
// KingshotData.kr - CSS/JS/JSON 캐시버스터 자동 업데이트 (프로젝트 전체 스캔)
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ENV = process.env.NODE_ENV || 'development';

// 스탬프: YYYYMMDDhhmm (prod) / 'now' (dev)
const buildStamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 12);
const stamp = ENV === 'production' ? buildStamp : 'now';

// 처리할 확장자
const TARGET_EXT = new Set(['.html', '.js', '.css']);

// 제외 폴더(필요시 추가)
const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.vercel']);

// 재귀적으로 파일 목록 수집
function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) out.push(...walk(p));
    else if (TARGET_EXT.has(path.extname(p))) out.push(p);
  }
  return out;
}

// 안전 치환 헬퍼 (치환 여부/횟수 카운트)
function replaceAll(str, regex, replacement, tag, counters) {
  let count = 0;
  str = str.replace(regex, (...args) => {
    count++;
    return typeof replacement === 'function' ? replacement(...args) : replacement;
  });
  if (count) counters[tag] = (counters[tag] || 0) + count;
  return str;
}

// 경로 뒤에 따옴표/백틱이 바로 오는 href/src 패턴에서만 작동하도록 lookahead 고정
// → “있으면 교체, 없으면 추가”를 통합 처리
function upsertQueryVersionFor(str, baseRe, tag, counters) {
  // 예: /(\/i18n\/...\.json)(\?v=[^"'` ]+)?(?=(["'`]))/g
  const re = new RegExp(`${baseRe.source}(\\?v=[^"'\\\` ]+)?(?=(["'\\\`]))`, 'g');
  return replaceAll(
    str,
    re,
    (_m, p1) => `${p1}?v=${stamp}`,
    tag,
    counters
  );
}

function processFile(file) {
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  const counters = {};

  // 0) 개발 모드에서만 Date.now()류 강제 now로 통일 (있다면)
  if (ENV !== 'production') {
    text = replaceAll(
      text,
      /\?v=\$\{?Date\.now\(\)\}?/g,
      `?v=${stamp}`,
      'swap.dev.datenow',
      counters
    );
  }

  // 1) .css / .js 링크: 있으면 교체, 없으면 추가 (따옴표/백틱 바로 앞 위치만)
  // href="/css/app.css?v=now"  src="/js/app.js?v=now"
  text = upsertQueryVersionFor(
    text,
    /(\/[A-Za-z0-9_\-./]+?\.(?:css|js))/,
    'upsert.cssjs',
    counters
  );

  // 2) i18n / locales JSON: 있으면 교체, 없으면 추가
  text = upsertQueryVersionFor(
    text,
    /(\/i18n\/[A-Za-z0-9_\-/]+?\.json)/,
    'upsert.i18n.json',
    counters
  );
  text = upsertQueryVersionFor(
    text,
    /(\/locales\/[A-Za-z0-9_\-/]+?\.json)/,
    'upsert.locales.json',
    counters
  );

  // 3) i18n.js 내부에 하드코딩된 now/Date.now() → prod에서만 스탬프 고정
  if (ENV === 'production') {
    text = replaceAll(
      text,
      /\?v=(?:now|\$\{?Date\.now\(\)\}?)/g,
      `?v=${stamp}`,
      'prod.fix.datenow',
      counters
    );
  }

  // 4) ASSET_VER / APP_VERSION 상수 갱신 (둘 중 있는 것만)
  text = replaceAll(
    text,
    /const\s+ASSET_VER\s*=\s*['"][^'"]*['"]\s*;/g,
    `const ASSET_VER = 'now';`,
    'swap.assetver',
    counters
  );
  text = replaceAll(
    text,
    /window\.APP_VERSION\s*=\s*["'][^"']*["']\s*;?/g,
    `window.APP_VERSION = "now";`,
    'swap.appversion',
    counters
  );

  if (text !== before) {
    fs.writeFileSync(file, text, 'utf8');
    console.log(
      `[${ENV}] Updated: ${path.relative(ROOT, file)} → v=${stamp} ` +
      Object.keys(counters).map(k => `${k}×${counters[k]}`).join(' ')
    );
  }
}

(function main() {
  const files = walk(ROOT);
  if (!files.length) {
    console.warn('No target files found.');
    return;
  }
  files.forEach(processFile);
  console.log(`Done. NODE_ENV=${ENV}, version=${stamp}`);
})();

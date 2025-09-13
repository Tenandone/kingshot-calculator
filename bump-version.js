
// .\deploy.ps1
// bump-version.js
// 배포 시 index.html의 window.__V 갱신 + 정적 자원(js/css/img)에만 ?v= 붙이기
// + sitemap.xml 의 <lastmod> 자동 갱신

const fs = require('fs');
const path = require('path');

// yyyyMMddHHmm
const now = new Date();
const stamp =
  now.getFullYear().toString() +
  String(now.getMonth() + 1).padStart(2, '0') +
  String(now.getDate()).padStart(2, '0') +
  String(now.getHours()).padStart(2, '0') +
  String(now.getMinutes()).padStart(2, '0');

console.log(`📌 New build version: ${stamp}`);

const files = [
  path.join(__dirname, 'index.html'),
  // 필요 시 추가: path.join(__dirname, 'pages', 'foo.html'),
];

// 정적 자원 확장자(HTML 제외)
const ASSET_EXT = /\.(?:js|mjs|css|png|jpg|jpeg|webp|gif|svg|ico|bmp|avif)$/i;

// 외부/비정상 링크는 제외
function isIgnorable(url) {
  return (
    /^https?:\/\//i.test(url) || // 절대 외부
    /^\/\//.test(url) || // 프로토콜 상대
    /^data:/i.test(url) || // data URI
    /^mailto:/i.test(url) || // 메일
    /^tel:/i.test(url) // 전화
  );
}

// v 파라미터 교체(+기존 쿼리/해시 유지)
function withVersion(url, version) {
  if (isIgnorable(url)) return url;

  // 해시 분리
  const [front, hash = ''] = url.split('#');
  // 쿼리 분리
  const [pathname, qs = ''] = front.split('?');

  // HTML은 건드리지 않음
  if (!ASSET_EXT.test(pathname)) {
    return url; // 그대로
  }

  // 쿼리 파싱(기존 파라미터 보존)
  const params = new URLSearchParams(qs);
  // 기존 v 제거 후 새 버전으로 덮기
  params.delete('v');
  params.set('v', version);

  const q = params.toString();
  const rebuilt = q ? `${pathname}?${q}` : `${pathname}?v=${version}`;

  return hash ? `${rebuilt}#${hash}` : rebuilt;
}

// 1) index.html 계열 처리
for (const filePath of files) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  ${filePath} not found, skip`);
    continue;
  }

  let html = fs.readFileSync(filePath, 'utf8');

  // window.__V 갱신
  if (/window\.__V\s*=/.test(html)) {
    html = html.replace(
      /window\.__V\s*=\s*['"][^'"]+['"]/,
      `window.__V='${stamp}'`
    );
  } else {
    html = html.replace(
      /<head([^>]*)>/i,
      `<head$1>\n<script>window.__V='${stamp}'</script>`
    );
  }

  // src/href 자원에만 v 적용
  html = html.replace(
    /\b(src|href)\s*=\s*(['"])([^'"]+)\2/gi,
    (m, attr, quote, url) => {
      const next = withVersion(url, stamp);
      return `${attr}=${quote}${next}${quote}`;
    }
  );

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`✅ Updated ${path.basename(filePath)} with version ${stamp}`);
}

// 2) sitemap.xml lastmod 갱신
const sitemap = path.join(__dirname, 'sitemap.xml');
if (fs.existsSync(sitemap)) {
  let xml = fs.readFileSync(sitemap, 'utf8');

  // 오늘 날짜 yyyy-MM-dd
  const today = new Date().toISOString().split('T')[0];

  if (/<lastmod>.*<\/lastmod>/.test(xml)) {
    xml = xml.replace(/<lastmod>.*<\/lastmod>/, `<lastmod>${today}</lastmod>`);
  }

  fs.writeFileSync(sitemap, xml, 'utf8');
  console.log(`✅ Updated sitemap.xml lastmod → ${today}`);
} else {
  console.warn(`⚠️ sitemap.xml not found, skip`);
}

process.exit(0);

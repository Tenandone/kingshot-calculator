// bump-version.js
// KingshotData.kr - CSS/JS 캐시버스터 자동 업데이트
const fs = require("fs");
const path = require("path");

// 업데이트할 파일 목록
const files = [
  path.join(__dirname, "index.html"),
  path.join(__dirname, "js/routes.js"),
  path.join(__dirname, "js/app.js")
];

// 타임스탬프 기반 버전 문자열 (예: 202508281530)
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 12);

files.forEach(file => {
  if (!fs.existsSync(file)) {
    console.warn("skip (not found):", file);
    return;
  }
  let text = fs.readFileSync(file, "utf8");

  // 1) CSS/JS 링크: 기존 v=숫자 교체
  text = text.replace(/(\.(css|js))\?v=[0-9a-zA-Z]+/g, `$1?v=${stamp}`);

  // 2) app.js 내부 ASSET_VER 교체
  text = text.replace(/const ASSET_VER = '.*?';/, `const ASSET_VER = '${stamp}';`);

  fs.writeFileSync(file, text, "utf8");
  console.log(`Updated: ${file} → v=${stamp}`);
});

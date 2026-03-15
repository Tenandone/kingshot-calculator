const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const GA_SNIPPET = `  <!-- GA4 -->
  <link rel="preconnect" href="https://www.googletagmanager.com">
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-TMGDGSEWW6"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', 'G-TMGDGSEWW6', { send_page_view: true });
  </script>
`;

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules'
]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walk(fullPath);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith('.html')) continue;

    processHtml(fullPath);
  }
}

function processHtml(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');

  // 이미 GA4 코드가 있으면 건너뜀
  if (
    html.includes(`gtag/js?id=G-TMGDGSEWW6`) ||
    html.includes(`gtag('config', 'G-TMGDGSEWW6'`) ||
    html.includes(`<!-- GA4 -->`)
  ) {
    console.log(`SKIP  ${filePath}`);
    return;
  }

  // </head> 바로 앞에 삽입
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${GA_SNIPPET}\n</head>`);
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`ADD   ${filePath}`);
    return;
  }

  console.log(`NOHEAD ${filePath}`);
}

walk(ROOT);
console.log('DONE');
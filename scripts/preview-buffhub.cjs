'use strict';
// Loopback-only QA. Overrides responses in memory; never changes the production JSON.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const testCampaign = args.includes('--test-campaign');
const port = Number(args.find(a => a.startsWith('--port='))?.split('=')[1] || 4174);
const imageDelay = Math.max(0, Math.min(3000, Number(args.find(a => a.startsWith('--image-delay='))?.split('=')[1]) || 0));
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid loopback port');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.xml':'application/xml','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.txt':'text/plain; charset=utf-8'};
let mode = 'active';
function fixture() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/sponsors/buffhub.json'), 'utf8'));
  if (!testCampaign) return config;
  config.enabled = mode !== 'disabled';
  config.approvedPaths = require('../data/ui/guides.json').entries.filter(e => e.kind === 'detail' && e.slug !== 'equipment-investment').map(e => e.url);
  if (mode === 'invalid') config.creatives.en.href = 'https://buffhub.com/top-up/kingshot.html';
  return config;
}
const instrumentation = `<script data-buffhub-local-qa>
(function(){
 var cls=0,session=0,first=0,last=0,shifts=[];
 try{new PerformanceObserver(function(list){list.getEntries().forEach(function(e){if(e.hadRecentInput)return;if(e.startTime-last>1000||e.startTime-first>5000){session=0;first=e.startTime;}last=e.startTime;session+=e.value;cls=Math.max(cls,session);shifts.push({value:e.value,time:e.startTime,sources:(e.sources||[]).map(function(s){return s.node?(s.node.id||s.node.className||s.node.nodeName):'unknown';})});});}).observe({type:'layout-shift',buffered:true});}catch(e){}
 function start(){
  var box=document.createElement('details');box.id='buffhub-local-qa';box.style.cssText='position:fixed;z-index:20000;right:4px;bottom:4px;max-width:260px;background:#fff;color:#111;border:1px solid #64748b;padding:4px;font:12px/1.4 monospace';
  box.innerHTML='<summary>Local BUFFHUB QA</summary><output id="buffhub-qa-status"></output><div>'+['active','disabled','invalid'].map(function(m){return '<button type="button" data-qa-mode="'+m+'">'+m+'</button>';}).join('')+'</div>';
  document.body.append(box);
  box.addEventListener('click',function(e){var mode=e.target.dataset.qaMode;if(!mode)return;fetch('/__buffhub-test/mode',{method:'POST',headers:{'Content-Type':'text/plain'},body:mode}).then(function(){return window.KD_SPONSORS&&window.KD_SPONSORS.reload();});});
  setInterval(function(){var ad=document.querySelector('[data-kd-sponsor]'),img=ad&&ad.querySelector('img'),r=ad&&ad.getBoundingClientRect(),data={cls:cls,shifts:shifts,banners:document.querySelectorAll('[data-kd-sponsor]').length,loaded:!!(img&&img.complete&&img.naturalWidth),width:r?r.width:0,height:r?r.height:0,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)};var out=document.getElementById('buffhub-qa-status');out.textContent=JSON.stringify(data);},250);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
</script>`;
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const headers = {'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
  if (url.pathname === '/__buffhub-test/mode' && req.method === 'POST' && testCampaign) {
    let input = '';
    req.on('data', chunk => { input += chunk; if (input.length > 40) req.destroy(); });
    req.on('end', () => { if (!['active','disabled','invalid'].includes(input)) { res.writeHead(400,headers); return res.end(); } mode = input; res.writeHead(204,headers); res.end(); });
    return;
  }
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,headers); return res.end(); }
  if (url.pathname === '/data/sponsors/buffhub.json') { res.writeHead(200,{...headers,'Content-Type':types['.json']}); return res.end(JSON.stringify(fixture())); }
  let file;
  try {
    const decoded = decodeURIComponent(url.pathname);
    if (decoded.split('/').some(p => p.startsWith('.')) || decoded.includes('\\')) throw Error();
    file = path.resolve(ROOT, '.' + decoded);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) throw Error();
  } catch (_) { res.writeHead(403,headers); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!url.pathname.endsWith('/')) { res.writeHead(301,{...headers,Location:url.pathname + '/' + url.search}); return res.end(); }
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file) && !path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404,headers); return res.end('404'); }
  const send = () => {
    res.writeHead(200,{...headers,'Content-Type':types[path.extname(file)] || 'application/octet-stream'});
    if (req.method === 'HEAD') return res.end();
    if (file.endsWith('.html')) return res.end(fs.readFileSync(file,'utf8').replace(/<head([^>]*)>/i, '<head$1>' + instrumentation));
    fs.createReadStream(file).pipe(res);
  };
  if (imageDelay && file.includes(path.join('img','sponsors','buffhub')) && file.endsWith('.webp')) setTimeout(send,imageDelay); else send();
}).listen(port,'127.0.0.1',() => console.log('BUFFHUB local QA: http://127.0.0.1:' + port + '/ko/guides/kingshot-bearhunt.html (test campaign ' + (testCampaign?'ON, responses only':'OFF') + ')'));

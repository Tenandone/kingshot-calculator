'use strict';
const fs=require('fs'),path=require('path'),{ROOT}=require('./static-routes');
const {html}=require('../js/data-verification');
let count=0;
for(const p of require('./public-index-policy.json').paths){
 const note=html(p);if(!note)continue;
 const file=path.join(ROOT,decodeURIComponent(p),p.endsWith('/')?'index.html':'');
 let source=fs.readFileSync(file,'utf8').replace(/<aside\b[^>]*data-verification-note[^>]*>[\s\S]*?<\/aside>/g,'');
 if(!source.includes('/js/data-verification.js'))source=source.replace('</head>','<script defer src="/js/data-verification.js?v=2026100612"></script>\n</head>');
 if(/<main\b[^>]*>/i.test(source))source=source.replace(/<main\b[^>]*>/i,tag=>tag+note);else source=source.replace(/<body\b[^>]*>/i,tag=>tag+note);
 fs.writeFileSync(file,source);count++;
}
console.log('Visible verification scope notices:',count);

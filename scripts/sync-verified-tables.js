'use strict';
// Update only known material columns; retain localized names, icons and other data.
const fs=require('fs'),path=require('path'),{parse}=require('parse5'),{ROOT}=require('./static-routes');
const all=n=>[n,...(n.childNodes||[]).flatMap(all)];
const text=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('').trim();
function update(file,change){let s=fs.readFileSync(file,'utf8');const doc=parse(s,{sourceCodeLocationInfo:true}),patches=[];
 const replace=(cell,value)=>{const t=all(cell).filter(n=>n.nodeName==='#text'&&/[\d–—-]/.test(n.value.trim())).at(-1);if(!t)throw Error('No cell text in '+file);const loc=t.sourceCodeLocation;patches.push([loc.startOffset,loc.endOffset,Number(value).toLocaleString('en-US')]);};
 change(all(doc).filter(n=>n.tagName==='tr').map(n=>(n.childNodes||[]).filter(c=>c.tagName==='td')),replace);
 for(const [a,b,v]of patches.sort((a,b)=>b[0]-a[0]))s=s.slice(0,a)+v+s.slice(b);fs.writeFileSync(file,s);
}
const gear=Object.values(require('../data/governor-gear.json').steps);
for(const lang of ['ko','en','ja','zh-tw']){
 update(path.join(ROOT,lang,'database/governor-gear.html'),(rows,replace)=>{const costs=rows.filter(r=>r.length===5);if(costs.length!==gear.length)throw Error('Gear row mismatch '+lang);costs.forEach((r,i)=>['satin','thread','sketch'].forEach((k,j)=>replace(r[j+1],gear[i][k])));});
 update(path.join(ROOT,lang,'buildings/town-center.html'),(rows,replace)=>{for(const r of rows){const level=Number(text(r[0]||{}));if(r.length===9&&[11,17].includes(level))replace(r[level===11?4:5],level===11?260000:460000);}});
}
console.log('Localized gear material tables and two Town Center cells synchronized.');

'use strict';
const fs=require('fs'),path=require('path'),{imageSize}=require('image-size');
const {ROOT}=require('./static-routes');
const images={},errors=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.(png|jpe?g|webp|gif|svg)$/i.test(f)){try{const b=fs.readFileSync(f),s=imageSize(b);images['/'+path.relative(ROOT,f).replace(/\\/g,'/')]={width:s.width,height:s.height,bytes:b.length};}catch(e){errors.push(path.relative(ROOT,f));}}}}
walk(path.join(ROOT,'img'));
fs.writeFileSync(path.join(ROOT,'data/image-manifest.json'),JSON.stringify(images)+'\n');
console.log('Image dimensions:',Object.keys(images).length,'Unmeasured:',errors.length);
if(errors.length)console.log(errors);

let dimensionsAdded=0;
function htmlWalk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name.startsWith('.')||['node_modules','dist','scripts','_lootbar'].includes(e.name))continue;const f=path.join(dir,e.name);if(e.isDirectory())htmlWalk(f);else if(e.name.endsWith('.html')){let source=fs.readFileSync(f,'utf8'),index=0;const updated=source.replace(/<img\b[^>]*>/gi,tag=>{index++;const src=tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];if(!src||/^(https?:|data:|\/\/)/.test(src))return tag;const key='/'+path.relative(ROOT,path.resolve(path.dirname(f),src.startsWith('/')?path.join(ROOT,src):src)).replace(/\\/g,'/');const m=images[key];if(!m)return tag;const w=Number(tag.match(/\bwidth=["'](\d+)["']/i)?.[1]),h=Number(tag.match(/\bheight=["'](\d+)["']/i)?.[1]);let attrs='';if(!/\bwidth=/.test(tag))attrs+=' width="'+(h?Math.round(h*m.width/m.height):m.width)+'"';if(!/\bheight=/.test(tag))attrs+=' height="'+(w?Math.round(w*m.height/m.width):m.height)+'"';if(!/\bdecoding=/.test(tag))attrs+=' decoding="async"';if(index>3&&!/\bloading=/.test(tag))attrs+=' loading="lazy"';if(attrs)dimensionsAdded++;return tag.replace(/\s*\/?>(?=$)/,attrs+'>');});if(updated!==source)fs.writeFileSync(f,updated);}}}
htmlWalk(ROOT);console.log('Static image attributes added:',dimensionsAdded);

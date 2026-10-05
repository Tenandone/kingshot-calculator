'use strict';
const fs=require('fs'),path=require('path'),{imageSize}=require('image-size');
const {ROOT}=require('./static-routes');
const images={},errors=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.(png|jpe?g|webp|gif|svg)$/i.test(f)){try{const b=fs.readFileSync(f),s=imageSize(b);images['/'+path.relative(ROOT,f).replace(/\\/g,'/')]={width:s.width,height:s.height,bytes:b.length};}catch(e){errors.push(path.relative(ROOT,f));}}}}
walk(path.join(ROOT,'img'));
fs.writeFileSync(path.join(ROOT,'data/image-manifest.json'),JSON.stringify(images)+'\n');
console.log('Image dimensions:',Object.keys(images).length,'Unmeasured:',errors.length);
if(errors.length)console.log(errors);

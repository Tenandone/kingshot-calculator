'use strict';
const fs=require('fs'),path=require('path');
async function applyEditorialHome(options={}){
 const root=options.root||path.resolve(__dirname,'..');
 const {parse}=await import(require('url').pathToFileURL(require.resolve('parse5')).href);
 const hub=require(path.join(root,'js/hub.js')),editorial=require(path.join(root,'js/editorial-home.js'));
 const rows=[];
 for(const locale of ['ko','en','ja','zh-tw']){
  const relative=locale==='ko'?'index.html':locale+'/index.html',file=path.join(root,relative),before=fs.readFileSync(file,'utf8');
  const entries=JSON.parse(fs.readFileSync(path.join(root,'data/ui/search/'+locale+'.json'),'utf8')).entries;
  const legacy=hub.homeMarkup(entries,locale,[]),html=editorial.markup(locale,legacy);
  let content;function visit(n){if(n.attrs?.some(a=>a.name==='id'&&a.value==='content'))content=n;for(const c of n.childNodes||[])visit(c);}visit(parse(before,{sourceCodeLocationInfo:true}));
  if(!content?.sourceCodeLocation?.endTag)throw Error('Missing home content: '+file);
  const start=content.sourceCodeLocation.startTag.endOffset,end=content.sourceCodeLocation.endTag.startOffset;
  const after=before.slice(0,start)+html+before.slice(end);if(after!==before)fs.writeFileSync(file,after);
  rows.push({path:relative,locale,bytes:Buffer.byteLength(html)});
 }
 return rows;
}
module.exports={applyEditorialHome};
if(require.main===module)applyEditorialHome().then(rows=>console.log(JSON.stringify(rows))).catch(e=>{console.error(e);process.exitCode=1;});

'use strict';
// Mirrors static hosting; never serves the home page for unknown routes.
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.xml':'application/xml','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.txt':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');let file;
 try{file=path.resolve(ROOT,'.'+decodeURIComponent(u.pathname));}catch{res.writeHead(400);return res.end();}
 if((file!==ROOT&&!file.startsWith(ROOT+path.sep))||u.pathname.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);return res.end();}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory()){
   if(!u.pathname.endsWith('/')){res.writeHead(301,{Location:u.pathname+'/'+u.search});return res.end();}file=path.join(file,'index.html');
 }
 if(!fs.existsSync(file)&&!u.pathname.endsWith('/')&&!path.extname(file)&&fs.existsSync(file+'.html'))file+='.html';
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404,{'Content-Type':'text/html'});return res.end('<h1>404</h1>');}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('Static preview ready')); 

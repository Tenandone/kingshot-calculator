(function(){
 'use strict';let pending;
 function start(){if(!document.getElementById('content'))return;pending=pending||fetch('/data/content-context.json?v=2026100614').then(r=>r.ok?r.json():{}).catch(()=>({}));const path=location.pathname.replace(/\/?$/,'/');pending.then(map=>{if(location.pathname.replace(/\/?$/,'/')!==path)return;document.querySelectorAll('[data-kd-related]').forEach(n=>n.remove());const html=map[path];if(html)document.getElementById('content')?.insertAdjacentHTML('beforeend',html);});}
 window.addEventListener('kd:page-ready',start);document.addEventListener('DOMContentLoaded',start,{once:true});
})();

/* Progressive enhancement for factual reference pages. No calculator or legacy storage writes. */
(() => {'use strict';
 const root=document.querySelector('[data-kx-filter]'),norm=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
 let clearFilter=null;
 function reveal(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const target=id&&document.getElementById(id);if(!target)return;const section=target.closest('details');if(section){if(section.hidden&&clearFilter)clearFilter();section.hidden=false;section.open=true;}requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));}
 if(root){const input=root.querySelector('input[type=search]'),select=root.querySelector('select'),status=root.querySelector('[role=status]'),rows=[...document.querySelectorAll('[data-kx-entity]')];
  function filter(write){const q=norm(input.value),cat=select?.value||'all',terms=q.split(' ').filter(Boolean);let count=0;for(const row of rows){const hit=terms.every(t=>norm(row.dataset.search||row.textContent).includes(t))&&(cat==='all'||cat===row.dataset.category);row.hidden=!hit;if(hit)count++;}status.textContent=count+' / '+rows.length;
   if(write){const u=new URL(location.href);input.value?u.searchParams.set('q',input.value.slice(0,120)):u.searchParams.delete('q');cat==='all'?u.searchParams.delete('category'):u.searchParams.set('category',cat);history.replaceState(history.state,'',u.pathname+u.search+u.hash);}}
  function restore(){const p=new URLSearchParams(location.search);input.value=(p.get('q')||'').slice(0,120);if(select)select.value=[...select.options].some(o=>o.value===p.get('category'))?p.get('category'):'all';filter(false);reveal();}
  clearFilter=()=>{input.value='';if(select)select.value='all';filter(true);};
  root.hidden=false;root.addEventListener('submit',e=>{e.preventDefault();filter(true);});input.addEventListener('input',()=>filter(true));select?.addEventListener('change',()=>filter(true));window.addEventListener('popstate',restore);restore();
 }
 window.addEventListener('hashchange',reveal);if(location.hash)reveal();
 // Equivalent translated documents retain the reader's filter and exact row.
 document.addEventListener('click',e=>{const a=e.target.closest?.('.ks-nav-languages a[hreflang]');if(!a)return;const u=new URL(a.href,location.href);if(!/^\/(ko|en|ja)\/(alliance\/tech|events\/calendar|masters)(\/|$)/.test(u.pathname))return;a.href=u.pathname+location.search+location.hash;},true);
})();

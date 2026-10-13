(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./operator-profile-config'));
 else root.KD_OPERATOR_PROFILE_VIEW=factory(root.KD_OPERATOR_PROFILE_CONFIG);
})(typeof window!=='undefined'?window:globalThis,function(config){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function locale(path){return (String(path).match(/^\/(ko|en|ja|zh-tw)(?:\/|$)/i)?.[1]||'ko').toLowerCase();}
 function placement(path){const p=String(path).split(/[?#]/)[0].replace(/\/index\.html$/,'/');return new RegExp(config.routes.guides).test(p)?'guide_footer':new RegExp(config.routes.about).test(p)?'about':new RegExp(config.routes.home).test(p)?'site_footer':new RegExp(config.routes.calculators).test(p)?'calculator_result':null;}
 function render(language,position){
  const l=String(language).toLowerCase(),copy=config.locales[l]||config.locales.ko,variant=config.placements[position];
  if(!variant)return '';
  const text=variant==='link'?copy.footer+' · '+config.handle:'TikTok · '+config.handle;
  const link=`<a class="ten-signature-link" href="${esc(config.url)}" target="_blank" rel="noopener noreferrer" data-ten-tiktok="${esc(position)}" aria-label="${esc(config.name+' · TikTok · '+config.handle+' · '+copy.personal+' · '+copy.newWindow)}">${esc(text)} <span aria-hidden="true">↗</span></a>`;
  const identity=`<p class="ten-signature-identity"><strong>${esc(config.name)}</strong><span>${esc(copy.role)}</span></p>`;
  const body=variant==='link'?link:identity+(variant==='profile'?`<p class="ten-signature-bio">${esc(copy.bio)}</p>`:'')+`<div class="ten-signature-social">${link}<span class="ten-signature-personal">${esc(copy.personal)}</span></div>`;
  return `<aside class="ten-signature ten-signature--${variant}" data-ten-profile="${esc(position)}" data-ten-locale="${esc(l)}" lang="${l==='zh-tw'?'zh-Hant':esc(l)}" aria-label="${esc(copy.label)}">${body}</aside>`;
 }
 return {render,locale,placement};
});

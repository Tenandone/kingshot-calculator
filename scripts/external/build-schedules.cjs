'use strict';
// Existing static URL/shell; dynamic dates are independent community estimates.
const fs=require('node:fs'),path=require('node:path');
const {page,esc}=require('./page.cjs');
const copy=require('../../js/schedule-copy.js');
const root=path.resolve(__dirname,'../..');
const rules=JSON.parse(fs.readFileSync(path.join(root,'data/ui/external/schedule-rules.json'),'utf8'));
const changed=[];
for(const l of ['ko','en','ja']){
 const w=copy[l],prefix=l==='ko'?'':'/'+l;
 const intro='<header class="kx-intro"><h1>'+esc(w.title)+'</h1><p>'+esc(w.lead)+'</p></header>';
 const form='<form class="ks-schedule-form" id="schedule-form" hidden><label for="schedule-kingdom">'+esc(w.kingdom)+'<input id="schedule-kingdom" name="kingdom" inputmode="numeric" type="number" min="1" max="999999" step="1" placeholder="'+esc(w.optional)+'"></label><label for="schedule-date">'+esc(w.date)+'<input id="schedule-date" name="date" type="date" min="2026-01-26" max="2100-12-31"></label><button type="submit">'+esc(w.calculate)+'</button><button type="button" id="schedule-live">'+esc(w.live)+'</button></form><p id="schedule-mode" class="ks-schedule-mode"></p><p class="ks-schedule-status" id="schedule-status" role="status">'+esc(w.loading)+'</p><div id="schedule-results"></div>';
 const phase='<section class="ks-schedule-rules" id="schedule-rules"><h2>'+esc(w.rules)+'</h2><p>'+esc(w.ruleKvk)+'</p><p>'+esc(w.ruleTransfer)+'</p><p>'+esc(w.kingdomScope)+'</p><p>'+esc(w.ruleTime)+'</p><p>'+esc(w.boundary)+'</p><p class="kx-muted">'+esc(w.official)+'</p></section>';
 const sources='<section class="ks-schedule-source"><p>'+esc(w.verified)+': <time datetime="'+esc(rules.observedAt)+'">'+esc(rules.observedAt.slice(0,10))+'</time></p><nav class="kx-links" aria-label="'+esc(w.sources)+'"><a href="https://kingshot.net/">Kingshot.net</a><a href="https://kingshot.net/transfer-history">Transfer History</a><a href="https://kingshot.net/calendar">Event Calendar</a><a href="https://kingshot.net/kingdom-timeline">'+esc(w.tracker)+'</a><a href="'+prefix+'/about/">'+esc(w.policy)+'</a></nav><p>'+esc(w.auto)+'</p></section>';
 const links='<nav class="kx-links" aria-label="'+esc(w.links)+'"><a href="/'+l+'/guides/kingdom-of-power-prep.html">'+esc(w.kvkGuide)+'</a><a href="/'+l+'/guides/transfer.html">'+esc(w.transferGuide)+'</a></nav>';
 const body='<div data-schedule-planner data-rules-release="'+esc(rules.release)+'">'+intro+form+'<noscript><p class="kx-note">'+esc(w.ruleKvk)+' '+esc(w.ruleTransfer)+'</p></noscript>'+phase+links+sources+'</div>';
 const route='/'+l+'/events/calendar/',file=path.join(root,route,'index.html');
 let html=page({locale:l,path:route,title:w.title+' | KingShotData',description:w.description,body,entityId:'ks:events:calendar',extraScripts:['/js/schedule-copy.js?v=ks-ui16-20261012','/js/schedule-engine.js?v=ks-ui16-20261012','/js/schedule-planner.js?v=ks-ui16-20261012']});
 html=html.replace('</head>','<link rel="stylesheet" href="/css/schedule-planner.css?v=ks-ui16-20261012"></head>');
 fs.mkdirSync(path.dirname(file),{recursive:true});if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==html){fs.writeFileSync(file,html);changed.push(path.relative(root,file).replaceAll('\\','/'));}
}
console.log(JSON.stringify({pages:3,release:rules.release,changed}));

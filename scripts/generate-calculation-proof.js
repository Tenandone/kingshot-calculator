'use strict';
const fs=require('fs');
const records=JSON.parse(fs.readFileSync('data/primary-verified-fields.json','utf8'));
const proof={};
for(const r of records){if(r.status!=='VERIFIED'||!r.source||!r.verified_at)continue;proof[r.file+'|'+r.field]={value:r.value,status:r.status,source:r.source,verified_at:r.verified_at};}
fs.writeFileSync('js/calculation-provenance.js','// Generated from reviewed primary-source evidence; do not edit.\nwindow.KD_PROVENANCE='+JSON.stringify(proof)+';\nwindow.KD_PROOF_LAYOUT='+JSON.stringify(JSON.parse(fs.readFileSync('data/calculation-layout.json','utf8')))+';\n');
console.log('Calculation proof records:',Object.keys(proof).length);

import fs from 'node:fs';
const raw=process.argv[2];if(!raw)throw Error('Usage: node scripts/configure-extension.mjs https://your-site.example');
const url=new URL(raw);if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw Error('Provide only an HTTPS website origin.');
const dir='companion/extension/',manifest=JSON.parse(fs.readFileSync(dir+'manifest.json'));
manifest.version='2.0.0';manifest.host_permissions=['https://chatgpt.com/*',url.origin+'/*'];
for(const script of manifest.content_scripts)if(script.js.includes('studio.js'))script.matches=[url.origin+'/*'];
fs.writeFileSync(dir+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
const shared=fs.readFileSync(dir+'shared.js','utf8').replace(/const SITE = '[^']+';/,`const SITE = '${url.origin}';`);fs.writeFileSync(dir+'shared.js',shared);
console.log('Extension configured for '+url.origin+'. Reload this folder in Chrome.');

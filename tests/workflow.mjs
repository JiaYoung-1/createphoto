import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'http://localhost:5173';
assert.equal(new URL(origin).hostname,'localhost','Only run against local preview');
const cookie='__sites_local_auth=1';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6itkAAAAASUVORK5CYII=','base64');
async function request(body,expected=200,headers={}){const r=await fetch(origin+'/api/workspace',{method:'POST',headers:{cookie,origin,...(typeof body==='string'?{'Content-Type':'application/json'}:{}),...headers},body});const raw=await r.text();assert.equal(r.status,expected,raw);let d;try{d=JSON.parse(raw)}catch{d={error:raw}}return d}
async function upload(kind,project='',parent='',name='本地流程验证.png'){const f=new FormData();f.set('file',new Blob([png],{type:'image/png'}),name);f.set('kind',kind);f.set('project',project);f.set('parent',parent);f.set('prompt','柱子改成红砖，其他不变。');return request(f)}
assert.equal((await fetch(origin+'/api/workspace')).status,401);
await request('{}',403,{origin:'https://invalid.example'});
const first=await upload('original');
const ref=await upload('reference',first.project);
await request(JSON.stringify({action:'role',project:first.project,id:ref.id,role:'构造方式'}));
await request(JSON.stringify({action:'draft',project:first.project,prompt:'只改柱子。',revision:0}));
await request(JSON.stringify({action:'draft',project:first.project,prompt:'不得覆盖。',revision:0}),409);
const second=await upload('result',first.project,first.version);
const branch=await upload('result',first.project,first.version);
const d=await (await fetch(origin+'/api/workspace?project='+first.project,{headers:{cookie}})).json();
assert.equal(d.project.prompt,'只改柱子。');assert.equal(d.versions.length,3);assert.equal(d.versions.find(v=>v.id===second.version).parent,first.version);assert.equal(d.versions.find(v=>v.id===branch.version).parent,first.version);assert.equal(JSON.parse(d.versions.find(v=>v.id===branch.version).references)[0].role,'构造方式');
assert.equal((await fetch(origin+'/api/image/'+first.id)).status,401);
const image=await fetch(origin+'/api/image/'+first.id+'?download=1',{headers:{cookie}});assert.equal(image.status,200);assert.match(image.headers.get('Content-Disposition'),/attachment/);assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
const invalid=new FormData();invalid.set('file',new Blob(['not a png'],{type:'image/png'}),'bad.png');invalid.set('kind','original');await request(invalid,400);
console.log('PASS: private access, request origin, uploads, persistent drafts, edit conflict, reference roles, version branches, download integrity, invalid image rejection.');

const config=await (await fetch(origin+'/api/generate',{headers:{cookie}})).json();
assert.equal('key' in config,false);assert.equal((await fetch(origin+'/api/generate')).status,401);
if(!config.aiReady){const r=await fetch(origin+'/api/generate',{method:'POST',headers:{cookie,origin,'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),project:first.project,parent:first.version,prompt:'test',references:[]})});assert.equal(r.status,503);assert.match((await r.json()).error,/密钥/)}
console.log('PASS: image-generation endpoint access and missing-key gating.');

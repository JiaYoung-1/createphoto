import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'http://localhost:5173';assert.equal(new URL(origin).hostname,'localhost');
const headers={cookie:'__sites_local_auth=1',origin},png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6itkAAAAASUVORK5CYII=','base64');
async function post(url,body,status=200){const r=await fetch(origin+url,{method:'POST',headers:{...headers,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j}
const form=new FormData();form.set('file',new Blob([png],{type:'image/png'}),'companion-test.png');form.set('kind','original');const base=await post('/api/workspace',form);
const id=crypto.randomUUID(),worker=crypto.randomUUID(),input={id,project:base.project,parent:base.version,prompt:'只改变围挡颜色。',references:[]};
assert.equal((await fetch(origin+'/api/companion',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({action:'heartbeat',worker,state:'ready'})})).status,401);
assert.equal((await post('/api/generate',input,202)).phase,'queued');await post('/api/generate',input,202);await post('/api/generate',{...input,id:crypto.randomUUID()},409);
await post('/api/companion',{action:'heartbeat',worker,state:'ready'});
await post('/api/companion',{action:'heartbeat',worker:crypto.randomUUID(),state:'ready'},409);
const {job}=await post('/api/companion',{action:'claim',worker});assert.equal(job.id,id);assert.equal(job.phase,'claimed');assert.equal(job.images[0].id,base.id);assert.match(job.promptForChatGPT,/第一张图片是当前所选版本/);
await post('/api/companion',{action:'phase',worker,id,phase:'submitting'});await post('/api/companion',{action:'phase',worker,id,phase:'submitting'},409);
await post('/api/companion',{action:'phase',worker,id,phase:'waiting',conversation:'https://evil.example/c/test'},400);
await post('/api/companion',{action:'phase',worker,id,phase:'waiting',conversation:'https://chatgpt.com/c/test-conversation'});
await post('/api/generate',{id,action:'cancel'},409);
const result=new FormData();result.set('worker',worker);result.set('id',id);result.set('file',new Blob([png],{type:'image/png'}),'result.png');assert.equal((await post('/api/companion',result)).status,'succeeded');assert.equal((await post('/api/companion',result)).status,'succeeded');
const workspace=await (await fetch(origin+'/api/workspace?project='+base.project,{headers})).json();assert.equal(workspace.versions.length,2);assert.equal(workspace.versions.find(v=>v.id===id).parent,base.version);assert.equal(workspace.assets.find(a=>a.id===id).mime,'image/png');
const another=crypto.randomUUID();await post('/api/generate',{...input,id:another},202);await post('/api/generate',{id:another,action:'cancel'});assert.equal((await post('/api/companion',{action:'claim',worker})).job,null);
console.log('PASS: authenticated queue, idempotent submit, single active job, worker exclusion, guarded phases, no duplicate Send transition, safe conversation URL, original result storage/parent, idempotent upload, safe cancellation. No ChatGPT/API generation performed.');

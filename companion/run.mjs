import {chromium} from 'playwright';
import {mkdir,readFile,writeFile,rename,access} from 'node:fs/promises';
import {appendFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
const site='https://atelier-two-arch-0913.wjy2378408967.chatgpt.site';
const state=path.join(path.dirname(fileURLToPath(import.meta.url)),'.state');
await mkdir(state,{recursive:true});
const workerFile=path.join(state,'worker-id');let worker;
try{worker=(await readFile(workerFile,'utf8')).trim()}catch{worker=randomUUID();await writeFile(workerFile,worker,{mode:0o600})}
if(!/^[0-9a-f-]{36}$/.test(worker))throw Error('本机配置异常。');
let lastStatus='';function status(s){if(s!==lastStatus){const line=new Date().toLocaleTimeString()+' '+s;console.log(line);appendFileSync(path.join(state,'status.log'),line+'\n');lastStatus=s}}
let context;
for(const channel of ['chrome','msedge']){try{context=await chromium.launchPersistentContext(path.join(state,channel==='chrome'?'browser':'edge-browser'),{channel,headless:false,acceptDownloads:true,viewport:null,args:['--start-maximized']});break}catch(e){status(`${channel} 启动失败：${String(e.message).split('\n')[0]}`)}}
if(!context)throw Error('无法启动 Chrome 或 Edge，请安装官方浏览器，或先关闭另一个接单程序。');
let closed=false;context.on('close',()=>{closed=true});
const studio=context.pages()[0]||await context.newPage();
let gpt=await context.newPage();
const opening=await Promise.allSettled([studio.goto(site,{waitUntil:'domcontentloaded',timeout:30000}),gpt.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded',timeout:30000})]);
for(const [i,result] of opening.entries())if(result.status==='rejected')status(`${i===0?'工作室':'ChatGPT'} 页面暂时未打开，请在浏览器中检查网络并刷新；程序继续等待。`);
await studio.bringToFront().catch(()=>{});
status('请在两个标签页分别登录工作室和 ChatGPT。保持此程序运行；不要操作正在生成的标签页。');
let online=false;
async function api(action,extra={}){
 const r=await context.request.post(site+'/api/companion',{data:{action,worker,...extra},headers:{Origin:site},maxRedirects:0,timeout:20000});
 if(r.status()!==200)throw Error(r.status()===401||r.status()===302?'请在工作室标签页完成登录。':'工作室连接或任务状态异常，请检查登录和是否重复启动程序。');
 if(!r.headers()['content-type']?.includes('application/json'))throw Error('请在工作室标签页完成登录。');return r.json();
}
async function loggedIn(){return !gpt.isClosed()&&await gpt.getByRole('textbox',{name:/与 ChatGPT 聊天|Ask anything|Message ChatGPT/}).first().isVisible().catch(()=>false)&&!await gpt.getByRole('button',{name:/^(登录|Log in)$/}).isVisible().catch(()=>false)}
async function heartbeat(){try{const ready=await loggedIn();await api('heartbeat',{state:ready?'ready':'login_required'});online=ready;if(!ready)status('请在 ChatGPT 标签页登录会员账号，程序正在等待。')}catch{online=false;status('请在工作室标签页完成登录；程序会自动检测。')}}
await heartbeat();const timer=setInterval(()=>{void heartbeat()},20000);
const journal=path.join(state,'current-job.json');
async function record(value){await writeFile(journal+'.tmp',JSON.stringify(value),{mode:0o600});await rename(journal+'.tmp',journal)}
async function saved(){try{return JSON.parse(await readFile(journal,'utf8'))}catch{return null}}
async function exists(p){try{await access(p);return true}catch{return false}}
async function uploadResult(job,file){
 const buffer=await readFile(file);if(buffer.length>10*1024*1024)throw Error('结果超过网站保存上限，请手动处理。');
 const r=await context.request.post(site+'/api/companion',{headers:{Origin:site},multipart:{id:job.id,worker,file:{name:'result.png',mimeType:'image/png',buffer}},maxRedirects:0,timeout:60000});
 if(r.status()!==200)throw Error('生成结果尚未保存，已留在本机；程序不会重复提交生成。');
 await record({id:job.id,phase:'complete'});status('完成：结果已保存回网站。');
}
async function phase(job,next,conversation){await api('phase',{id:job.id,phase:next,...(conversation?{conversation}:{})});await record({id:job.id,phase:next,conversation})}
async function processJob(job){
 const dir=path.join(state,'jobs',job.id),resultFile=path.join(dir,'result.png');await mkdir(dir,{recursive:true});
 const previous=await saved();
 if(await exists(resultFile)){await uploadResult(job,resultFile);return}
 if(job.phase!=='claimed'||(previous?.id===job.id&&['submitting','waiting','attention'].includes(previous.phase))){
  if(job.phase!=='attention')await api('phase',{id:job.id,phase:'attention'}).catch(()=>{});status('发现可能已提交的任务。请检查 ChatGPT；程序不会自动重发。');return;
 }
 try{
  if(!await loggedIn())throw Error('请先登录 ChatGPT。');
  await gpt.goto('https://chatgpt.com/');
  const composer=gpt.getByRole('textbox',{name:/与 ChatGPT 聊天|Ask anything|Message ChatGPT/}).first();await composer.waitFor({state:'visible',timeout:30000});
  const files=[];
  for(const [i,image] of job.images.entries()){
   if(!/^[0-9a-f-]{36}$/.test(image.id)||!['image/png','image/jpeg','image/webp'].includes(image.mime))throw Error('输入图片格式无效。');
   const r=await context.request.get(site+'/api/image/'+image.id,{maxRedirects:0,timeout:30000});if(r.status()!==200||!r.headers()['content-type']?.startsWith('image/'))throw Error('主图或参考图读取失败。');
   const bytes=await r.body();if(bytes.length>10*1024*1024)throw Error('输入图片过大。');
   const file=path.join(dir,`${i===0?'01-main':String(i+1).padStart(2,'0')+'-reference'}.${image.mime.split('/')[1]}`);await writeFile(file,bytes);files.push(file);
  }
  await gpt.getByRole('button',{name:/添加文件等|Add photos and files|Add files/}).first().click();
  const chooser=gpt.waitForEvent('filechooser',{timeout:15000});await gpt.getByText(/^(添加照片和文件|Add photos & files|Add photos and files)$/).click();await (await chooser).setFiles(files);
  // Filenames must appear before submission. If the UI changes, fail closed without clicking Send.
  for(const file of files)await gpt.getByRole('button',{name:new RegExp('移除文件.*'+path.basename(file).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'|Remove.*'+path.basename(file).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).waitFor({state:'visible',timeout:30000});
  await composer.fill(job.promptForChatGPT);
  await phase(job,'submitting'); // Durable record BEFORE Send; never retry an uncertain click.
  await gpt.getByRole('button',{name:/^(发送提示词|Send prompt|Send message)$/}).click({timeout:30000});
  await gpt.waitForURL(/\/c\//,{timeout:30000});await phase(job,'waiting',gpt.url());
  status('正在使用 ChatGPT 网页生成图片，请勿操作该标签页。');
  const output=gpt.getByRole('img',{name:/^(已生成图片[:：]|Generated image)/}).last();
  await output.waitFor({state:'visible',timeout:600000});await api('phase',{id:job.id,phase:'waiting',conversation:gpt.url()});
  // Download only the generated image actually displayed by the page, never the uploaded input.
  const src=await output.getAttribute('src');const url=new URL(src||'');
  if(url.origin!=='https://chatgpt.com'||!url.pathname.startsWith('/backend-api/estuary/content'))throw Error('图片地址已变化，请手动保存结果。');
  const response=await context.request.get(url.toString(),{timeout:60000});
  if(response.status()!==200)throw Error('结果下载失败，请手动保存。');
  const bytes=await response.body();if(bytes.length>10*1024*1024||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('结果大小或格式不符合保存要求。');
  await writeFile(resultFile,bytes,{mode:0o600});await uploadResult(job,resultFile);
 }catch{
  await api('phase',{id:job.id,phase:'attention',...(/^https:\/\/chatgpt.com\/c\/[a-zA-Z0-9:-]+$/.test(gpt.url())?{conversation:gpt.url()}:{})}).catch(()=>{});
  await record({id:job.id,phase:'attention',conversation:gpt.url()});
  status('需要人工检查：请查看 ChatGPT 的登录、额度、附件或生成结果。未自动重发；结果若已下载会留在本机。');
 }
}
try{
 while(!closed){
  if(online){try{const {job}=await api('claim');if(job&&/^[0-9a-f-]{36}$/.test(job.id)){await processJob(job)}else status('本机在线，等待网站提交任务。')}catch{status('工作室连接中断，正在等待恢复；不会重发已提交的生成。')}}
  await sleep(5000);
 }
}finally{clearInterval(timer);await context.close().catch(()=>{})}

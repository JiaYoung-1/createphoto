const A=Atelier;
let worker,studioTab,gptTab,active=null,running=false,ticking=false,heartbeatBusy=false;
const statusEl=document.querySelector('#status'),detail=document.querySelector('#detail'),log=document.querySelector('#log');
function status(text,more=''){if(statusEl.textContent!==text){log.textContent=(new Date().toLocaleTimeString()+' '+text+'\n'+log.textContent).slice(0,6000)}statusEl.textContent=text;detail.textContent=more}
async function send(tab,message){if(!Number.isInteger(tab))throw Error('请先开始接单。');let r;try{r=await chrome.tabs.sendMessage(tab,message)}catch{throw Error('标签页已关闭或扩展尚未连接，请保留页面；重新启动接单可重建连接。')}if(!r?.ok)throw Error(r?.error||'页面未响应。');return r}
const api=(action,extra={})=>send(studioTab,{target:'studio',action,worker,...extra});
async function journal(phase,conversation,error){await chrome.storage.local.set({lastJob:{id:active.id,phase,conversation:conversation||active.conversation||null,...(error?{error}:{})}})}
function resultStore(action,id,value){return new Promise((resolve,reject)=>{const open=indexedDB.open('atelier-results',1);open.onupgradeneeded=()=>open.result.createObjectStore('results');open.onerror=()=>reject(Error('本机结果存储不可用。'));open.onsuccess=()=>{const db=open.result,tx=db.transaction('results',action==='get'?'readonly':'readwrite'),s=tx.objectStore('results');const r=action==='get'?s.get(id):action==='put'?s.put(value,id):s.delete(id);tx.oncomplete=()=>{resolve(r.result);db.close()};tx.onerror=()=>{reject(Error('本机结果保存失败。'));db.close()}}})}
async function heartbeat(){if(!worker||!studioTab||heartbeatBusy||(!running&&!active))return;heartbeatBusy=true;try{const r=await send(gptTab,{target:'gpt',action:'ping'});await api('heartbeat',{state:r.ready?'ready':'login_required'});if(!r.ready&&!active)status('等待 ChatGPT 登录','请在刚打开的 ChatGPT 页面完成登录；不用重新启动。')}catch(e){status('连接需要检查',e.message)}finally{heartbeatBusy=false}}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m?.target!=='desk')return;
  if(sender.id!==chrome.runtime.id||sender.tab?.id!==gptTab||!sender.url?.startsWith('https://chatgpt.com/')||!active||m.id!==active.id||!['submitting','waiting'].includes(m.phase)){reply({ok:false,error:'任务来源或阶段无效，已停止。'});return}
  (async()=>{const conversation=A.conversation(m.conversation);await api('phase',{id:active.id,phase:m.phase,...(conversation?{conversation}:{})});await journal(m.phase,conversation);active.phase=m.phase;active.conversation=conversation;status(m.phase==='submitting'?'正在提交给 ChatGPT':'ChatGPT 正在生成','请勿操作出图标签页。接单台需要保持打开。');return {ok:true}})().then(reply,e=>reply({ok:false,error:e.message}));return true;
});
async function complete(job,data){await api('complete',{id:job.id,data});await chrome.storage.local.set({lastJob:{id:job.id,phase:'complete'}});await resultStore('delete',job.id);status('图片已保存回工作室','在工作室选择最新版本查看。')}
async function processJob(job){
  active=job;document.querySelector('#focus').disabled=false;
  try{
    const cached=await resultStore('get',job.id);if(cached){await complete(job,cached);return}
    const {lastJob}=await chrome.storage.local.get('lastJob');
    if(job.phase!=='claimed'||lastJob?.id===job.id){if(job.phase!=='attention')await api('phase',{id:job.id,phase:'attention'});status('需要检查上一笔任务',lastJob?.id===job.id&&lastJob.error?lastJob.error+' 已停止自动重发。':'可能已经提交，扩展不会重复生成。请在 ChatGPT 检查结果；可手动保存并导入，或在网站结束等待。');return}
    await journal('preparing');status('正在准备主图和参考图');
    const {files}=await api('inputs',{images:job.images});
    const tab=await chrome.tabs.create({url:'https://chatgpt.com/',active:true});gptTab=tab.id;
    let pageProblem='ChatGPT 输入框尚未就绪或尚未登录。';
    try{await A.until(async()=>{try{const probe=await send(gptTab,{target:'gpt',action:'ping'});pageProblem=probe.ready?'':'ChatGPT 输入框尚未就绪或尚未登录。';return probe.ready}catch(e){pageProblem=e.message;return false}},60000)}catch{throw Error('连接出图标签页：'+pageProblem)}
    const r=await send(gptTab,{target:'gpt',action:'run',id:job.id,prompt:job.promptForChatGPT,files});
    A.bytes(r.data);await resultStore('put',job.id,r.data);await complete(job,r.data);
  }catch(e){await api('phase',{id:job.id,phase:'attention',...(active.conversation?{conversation:active.conversation}:{})}).catch(()=>{});await journal('attention',null,e.message).catch(()=>{});status('任务需要人工检查',e.message+' 已停止自动重发。')}
  finally{active=null}
}
async function tick(){if(!running||ticking)return;ticking=true;try{const r=await send(gptTab,{target:'gpt',action:'ping'});await api('heartbeat',{state:r.ready?'ready':'login_required'});if(!r.ready){status('等待 ChatGPT 登录');return}const {job}=await api('claim');if(job){if(!A.UUID.test(job.id))throw Error('任务编号无效。');await processJob(job)}else status('在线，等待任务','现在可以到工作室提交修改要求。')}catch(e){status('连接需要检查',e.message)}finally{ticking=false}}
document.querySelector('#start').onclick=async()=>{
  document.querySelector('#start').disabled=true;
  // One visible desk owns this browser's jobs; a second desk must not race Send.
  await navigator.locks.request('atelier-desk',{ifAvailable:true},async lock=>{
    if(!lock){status('已有接单台在运行','请使用原来的接单台标签页。');document.querySelector('#start').disabled=false;return}
    try{const saved=await chrome.storage.local.get('worker');worker=saved.worker||crypto.randomUUID();if(!A.UUID.test(worker))throw Error('本机标识无效。');await chrome.storage.local.set({worker});
      studioTab=(await chrome.tabs.create({url:A.SITE+'/',active:false})).id;gptTab=(await chrome.tabs.create({url:'https://chatgpt.com/',active:true})).id;
      running=true;document.querySelector('#stop').disabled=false;document.querySelector('#focus').disabled=false;status('正在连接','请保留接单台，完成两个网页的登录。');
      while(running||active){await tick();await A.sleep(5000)}
    }catch(e){status('无法启动接单',e.message)}finally{running=false;document.querySelector('#start').disabled=false;document.querySelector('#stop').disabled=true}
  });
};
document.querySelector('#stop').onclick=()=>{running=false;document.querySelector('#stop').disabled=true;status(active?'本笔处理结束后暂停':'已暂停新任务','暂停不撤回已提交给 ChatGPT 的生成。')};
document.querySelector('#focus').onclick=()=>{if(gptTab)chrome.tabs.update(gptTab,{active:true}).catch(()=>status('出图标签页已关闭'))};
setInterval(()=>{void heartbeat()},20000);

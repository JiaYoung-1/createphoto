(() => {
  const A=Atelier;let busy=false,lastError='';
  const visible=e=>!!e&&e.getClientRects().length>0;
  const label=e=>e.getAttribute('aria-label')||e.textContent.trim();
  const button=re=>[...document.querySelectorAll('button,[role="button"],[role="radio"]')].find(e=>visible(e)&&re.test(label(e)));
  const composer=()=>document.querySelector('#prompt-textarea[contenteditable="true"],textarea#prompt-textarea');
  function show(text){let badge=document.querySelector('#atelier-extension-status');if(!badge){badge=document.createElement('div');badge.id='atelier-extension-status';badge.setAttribute('role','status');badge.style.cssText='position:fixed;bottom:12px;right:12px;z-index:2147483647;background:#173448;color:white;padding:10px 16px;border-radius:8px;font:13px/1.5 system-ui;max-width:430px;pointer-events:none';document.body.append(badge)}badge.textContent='工作室接单 1.0.4 · '+text}
  function ready(){return visible(composer())&&!button(/^(登录|Log in|Sign in)$/)}
  async function phase(id,value){const r=await chrome.runtime.sendMessage({target:'desk',action:'phase',id,phase:value,conversation:A.conversation(location.href)});if(!r?.ok)throw Error(r?.error||'接单台已关闭，停止提交。')}
  async function run(m){
    if(busy)throw Error('此标签页正在处理任务。');
    if(!A.UUID.test(m.id)||typeof m.prompt!=='string'||m.prompt.length>10000||!Array.isArray(m.files)||m.files.length>3)throw Error('任务内容无效。');
    if(location.pathname!=='/'||!ready())throw Error('请先登录 ChatGPT，任务需要空白聊天页。');
    busy=true;lastError='';let step='等待聊天页面';show(step);
    try{
      const chat=button(/^聊天$|^Chat$/);if(chat&&chat.getAttribute('aria-checked')!=='true'){chat.click();await A.sleep(700)}
      const box=await A.until(()=>visible(composer())&&composer());
      if((box.innerText||box.value||'').trim()&&!/^(处理任何事务|询问任何问题|Ask anything)$/.test((box.innerText||box.value||'').trim()))throw Error('输入框已有文字，为防覆盖已停止。');
      // Standard file input and editor events. No hidden APIs, anti-detection flags or CAPTCHA handling.
      if(m.files.length){
      const plus=button(/添加文件等|Add photos and files|Add files/);if(!plus)throw Error('找不到添加文件按钮。');plus.click();
      const menuItem=await A.until(()=>[...document.querySelectorAll('[role="menuitem"],button,div,span')].find(e=>visible(e)&&e.children.length===0&&/^(添加照片和文件|Add photos & files|Add photos and files)$/.test(e.textContent.trim())));
      menuItem.click();
      const input=await A.until(()=>document.querySelector('#upload-files[type="file"]'));
      const dt=new DataTransfer();for(const f of m.files){const b=A.bytes(f.data);dt.items.add(new File([b],f.name,{type:A.mime(b)}))}
      step='上传图片';show(step);
      if(!input.isConnected)throw Error('上传控件已被页面替换，请重新开始任务。');
      input.files=dt.files;
      input.dispatchEvent(new Event('input',{bubbles:true,composed:true}));
      input.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
      for(const f of m.files)await A.until(()=>[...document.querySelectorAll('button')].some(e=>visible(e)&&/移除文件|Remove/.test(label(e))&&label(e).includes(f.name)),60000);
      }
      step='填写创作要求';show(step);
      const editor=await A.until(()=>visible(composer())&&composer());editor.focus();
      if(editor.tagName==='TEXTAREA'){Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(editor,m.prompt);editor.dispatchEvent(new Event('input',{bubbles:true}));}
      else {const selection=getSelection(),range=document.createRange();range.selectNodeContents(editor);selection.removeAllRanges();selection.addRange(range);if(!document.execCommand('insertText',false,m.prompt))throw Error('无法填写提示词，停止提交。');}
      await A.until(()=>A.samePrompt(composer()?.innerText||composer()?.value||'',m.prompt));
      const send=await A.until(()=>{const b=button(/^(发送提示词|Send prompt|Send message)$/);return b&&!b.disabled&&b.getAttribute('aria-disabled')!=='true'&&b},60000);
      step='发送任务';show(step);
      await phase(m.id,'submitting'); // Durable server and local journal BEFORE clicking Send.
      send.click();
      await A.until(()=>A.conversation(location.href),45000);await phase(m.id,'waiting');
      step='等待生成图片';show(step);
      const output=await A.until(()=>[...document.querySelectorAll('img')].filter(e=>visible(e)&&/^(已生成图片[:：]|Generated image)/.test(e.alt)&&e.complete&&e.naturalWidth>256).at(-1),600000);
      await phase(m.id,'waiting');
      step='下载生成结果';show(step);
      const u=new URL(output.currentSrc||output.src);
      if(u.origin!=='https://chatgpt.com'||!u.pathname.startsWith('/backend-api/estuary/content'))throw Error('生成图片地址已变化，请在 ChatGPT 保存结果。');
      const r=await fetch(u.href,{credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('生成结果下载失败，请在 ChatGPT 保存图片。');
      return {data:await A.encode(await r.blob()),conversation:A.conversation(location.href)};
    }catch(e){lastError=`${step}：${e.message}`;show(lastError);throw Error(lastError)}finally{busy=false}
  }
  chrome.runtime.onMessage.addListener((m,sender,reply)=>{
    if(!A.trusted(sender)||m?.target!=='gpt')return;
    if(m.action==='ping'){const isReady=ready();if(!busy)show(lastError||(isReady?'已连接，等待任务':'等待聊天输入框或登录'));reply({ok:true,ready:isReady,busy,version:'1.0.4'});return}
    if(m.action!=='run')return;
    run(m).then(r=>reply({ok:true,...r}),e=>reply({ok:false,error:e.message,conversation:A.conversation(location.href)}));return true;
  });
})();

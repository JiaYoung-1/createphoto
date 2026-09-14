(() => {
  const A=Atelier;
  chrome.runtime.onMessage.addListener((m,sender,reply)=>{
    if (!A.trusted(sender) || m?.target!=='studio') return;
    (async()=>{
      if(m.action==='ping')return {ready:true};
      if(!A.UUID.test(m.worker))throw Error('接单设备标识无效。');
      if(m.action==='inputs'){
        if(!Array.isArray(m.images)||m.images.length>3)throw Error('图片数量无效。');
        const files=[];
        for(const [i,img] of m.images.entries()){
          if(!A.UUID.test(img.id))throw Error('图片编号无效。');
          const r=await fetch('/api/image/'+img.id,{credentials:'same-origin',redirect:'follow',signal:AbortSignal.timeout(30000)});
          if(!r.ok)throw Error('工作室图片读取失败，请检查登录。');
          const data=await A.encode(await r.blob()),type=A.mime(A.bytes(data));
          files.push({name:`${i===0?'01-main':String(i+1).padStart(2,'0')+'-reference'}.${type.split('/')[1]}`,type,data});
        }
        return {files};
      }
      let body,headers;
      if(m.action==='complete'){
        if(!A.UUID.test(m.id))throw Error('任务编号无效。');
        const b=A.bytes(m.data);body=new FormData();body.set('worker',m.worker);body.set('id',m.id);body.set('file',new Blob([b],{type:A.mime(b)}),'result.'+A.mime(b).split('/')[1]);
      }else{
        if(!['heartbeat','claim','phase'].includes(m.action))throw Error('不支持的接单操作。');
        body=JSON.stringify({action:m.action,worker:m.worker,id:m.id,phase:m.phase,state:m.state,conversation:m.conversation});headers={'Content-Type':'application/json'};
      }
      if(body instanceof FormData){
        const file=body.get('file'),fields={worker:m.worker,id:m.id};
        const ticketResponse=await fetch('/api/uploads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:'/api/companion',name:file.name,size:file.size,type:file.type,fields}),signal:AbortSignal.timeout(30000)});
        const ticket=await ticketResponse.json();if(!ticketResponse.ok)throw Error(ticket.error||'无法准备图片上传。');
        const uploaded=await fetch(ticket.uploadUrl,{method:'PUT',headers:{'Content-Type':file.type,'x-upsert':'false'},body:file,credentials:'omit',signal:AbortSignal.timeout(60000)});
        if(!uploaded.ok)throw Error('结果图片上传失败，请重试。');
        body=JSON.stringify({fileReceipt:ticket.receipt});headers={'Content-Type':'application/json'};
      }
      const r=await fetch('/api/companion',{method:'POST',credentials:'same-origin',redirect:'error',headers,body,signal:AbortSignal.timeout(60000)});
      if(!r.headers.get('content-type')?.includes('application/json'))throw Error('请在工作室标签页完成登录。');
      const result=await r.json();if(!r.ok)throw Error(result.error||'工作室暂时无法连接。');return result;
    })().then(data=>reply({ok:true,...data}),e=>reply({ok:false,error:e.message}));return true;
  });
})();

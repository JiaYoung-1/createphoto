import {authorizeOwner as authorize,bucket,database,fail,imageMime,limitedBody} from '../storage';
import {finish,uuid,WEB_MODEL,type Job} from '../jobs';
import {architecturePrompt,creationPrompt} from '@/lib/architecture';
export async function POST(request:Request){try{
 await authorize(request);const db=database(),body=await limitedBody(request),now=new Date().toISOString();
 if(request.headers.get('content-type')?.includes('multipart/form-data')){
  const form=await body.formData(),id=String(form.get('id')),worker=String(form.get('worker')),file=form.get('file');
  if(!uuid.test(id)||!uuid.test(worker)||!(file instanceof File)||!file.size||file.size>10*1024*1024)throw new Error('结果文件或任务编号无效，图片不得超过 10 MB。');
  const job=await db.prepare('SELECT * FROM edit_jobs WHERE id=? AND worker=? AND model=?').bind(id,worker,WEB_MODEL).first<Job>();
  if(!job)throw new Error('没有找到本机领取的任务。');if(job.status==='succeeded')return Response.json({status:'succeeded',version:id});
  if(job.status!=='running'||!['submitting','waiting','attention'].includes(job.phase))throw new Error('任务已结束或尚未开始生成。');
  if(!await bucket().head(`images/${id}`)){const bytes=new Uint8Array(await file.arrayBuffer()),mime=imageMime(bytes);await bucket().put(`images/${id}`,bytes,{httpMetadata:{contentType:mime},customMetadata:{job:id}})}
  await finish(id);return Response.json({status:'succeeded',version:id});
 }
 const input=await body.json() as Record<string,unknown>;if(typeof input.worker!=='string'||!uuid.test(input.worker))throw new Error('本机标识无效。');
 const worker=input.worker;
 if(input.action==='heartbeat'){
  if(!['ready','login_required','attention'].includes(String(input.state)))throw new Error('本机状态无效。');
  const r=await db.prepare("INSERT INTO companion (id,worker,state,updated) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET worker=excluded.worker,state=excluded.state,updated=excluded.updated WHERE companion.worker=excluded.worker OR companion.updated<?").bind(worker,input.state,now,new Date(Date.now()-90000).toISOString()).run();
  if(!r.meta.changes)return Response.json({error:'已有另一台电脑正在接单。'},{status:409});return Response.json({ok:true});
 }
 const device=await db.prepare('SELECT worker,updated FROM companion WHERE id=1').first<{worker:string;updated:string}>();
 if(device?.worker!==worker||Date.now()-Date.parse(device.updated)>90000)return Response.json({error:'请先连接本机程序。'},{status:409});
 if(input.action==='claim'){
  const active=await db.prepare("SELECT * FROM edit_jobs WHERE status='running' AND model=? LIMIT 1").bind(WEB_MODEL).first<Job>();
  if(!active)return Response.json({job:null});
  if(active.phase==='queued')await db.prepare("UPDATE edit_jobs SET phase='claimed',worker=?,updated=? WHERE id=? AND phase='queued' AND status='running'").bind(worker,now,active.id).run();
  const job=await db.prepare('SELECT * FROM edit_jobs WHERE id=? AND worker=?').bind(active.id,worker).first<Job>();if(!job)return Response.json({job:null});
  if(job.phase==='claimed'){
   const base=await db.prepare('SELECT a.id,a.mime FROM versions v JOIN assets a ON a.id=v.asset WHERE v.id=? AND v.project=?').bind(job.parent,job.project).first<{id:string;mime:string}>();
   if(job.parent&&!base)throw new Error('主图不存在。');
   const refs=JSON.parse(job.references) as {id:string;name:string;role:string}[];
   const images=base?[base]:[];for(const r of refs){const asset=await db.prepare("SELECT id,mime FROM assets WHERE id=? AND project=? AND kind='reference'").bind(r.id,job.project).first<{id:string;mime:string}>();if(!asset)throw new Error('参考图不存在。');images.push(asset)}
   return Response.json({job:{...job,images,promptForChatGPT:`请直接生成一张修改后的图片，不要仅给文字说明。\n${job.parent?architecturePrompt(job.prompt,refs,false,job.preserveRules??undefined):creationPrompt(job.prompt)}\n工作台任务编号：${job.id}`}});
  }
  return Response.json({job});
 }
 if(typeof input.id!=='string'||!uuid.test(input.id))throw new Error('任务编号无效。');
 if(input.action==='phase'){
  const phase=String(input.phase);if(!['submitting','waiting','attention'].includes(phase))throw new Error('任务阶段无效。');
  let conversation:string|null=null;
  if(input.conversation){const u=new URL(String(input.conversation));if(u.origin!=='https://chatgpt.com'||!/^\/c\/[a-zA-Z0-9:-]+$/.test(u.pathname))throw new Error('对话地址无效。');conversation=u.origin+u.pathname}
  const previous=phase==='submitting'?['claimed']:phase==='waiting'?['submitting','waiting']:['claimed','submitting','waiting','attention'];
  const r=await db.prepare(`UPDATE edit_jobs SET phase=?,conversation=COALESCE(?,conversation),error=?,updated=? WHERE id=? AND worker=? AND model=? AND status='running' AND phase IN (${previous.map(()=>'?').join(',')})`).bind(phase,conversation,phase==='attention'?'请在电脑上检查 ChatGPT 登录、额度或生成结果。任务不会自动重发。':null,now,input.id,worker,WEB_MODEL,...previous).run();
  if(!r.meta.changes)return Response.json({error:'任务状态已变化，停止自动操作。'},{status:409});return Response.json({ok:true});
 }
 throw new Error('未知操作。');
}catch(e){return fail(e)}}

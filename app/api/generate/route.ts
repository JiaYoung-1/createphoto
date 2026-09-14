import {authorize,bucket,database,fail,limitedBody} from '../storage';
import {finish,uuid,WEB_MODEL,workerState,type Job} from '../jobs';
import {MAX_REFERENCES,MAX_PROMPT_CHARS,DEFAULT_PRESERVE_RULES} from '@/lib/architecture';
export async function GET(request:Request){try{
 await authorize(request);const db=database(),id=new URL(request.url).searchParams.get('id');
 if(await workerState()==='offline')await db.prepare("UPDATE edit_jobs SET phase='attention',error='本机连接中断，请检查 ChatGPT 中是否已生成。任务不会自动重发。' WHERE status='running' AND model=? AND phase IN ('claimed','submitting','waiting') AND updated<?").bind(WEB_MODEL,new Date(Date.now()-90000).toISOString()).run();
 if(!id){const activeJob=await db.prepare("SELECT id,project,phase FROM edit_jobs WHERE status='running' LIMIT 1").first();return Response.json({aiReady:true,model:WEB_MODEL,workerState:await workerState(),activeJob},{headers:{'Cache-Control':'no-store'}})}
 const job=await db.prepare('SELECT * FROM edit_jobs WHERE id=?').bind(id).first<Job>();if(!job)return Response.json({error:'未找到生成任务。'},{status:404});
 const recoverable=job.status!=='succeeded'&&job.status!=='cancelled'&&!!await bucket().head(`images/${id}`);
 return Response.json({...job,workerState:await workerState(),recoverable},{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e)}}
export async function POST(request:Request){try{
 await authorize(request);const input=await (await limitedBody(request)).json() as Record<string,unknown>,db=database();
 if(typeof input.id!=='string'||!uuid.test(input.id))throw new Error('任务编号无效。');
 if(input.action==='cancel'){
  const r=await db.prepare("UPDATE edit_jobs SET status='cancelled',phase='complete',error='已结束网站等待；ChatGPT 中的生成不会被撤回。',updated=? WHERE id=? AND status='running' AND (phase='queued' OR (phase='attention' AND ?=1))").bind(new Date().toISOString(),input.id,input.acknowledge===true?1:0).run();
  if(!r.meta.changes)return Response.json({error:'任务已开始处理或状态已变化，请检查电脑上的 ChatGPT。'},{status:409});return Response.json({ok:true});
 }
 if(typeof input.project!=='string'||typeof input.parent!=='string'||typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>6000)throw new Error('请选择版本并填写修改要求。');
 if(!Array.isArray(input.references)||input.references.some(x=>typeof x!=='string')||new Set(input.references).size!==input.references.length)throw new Error('参考图选择无效。');
 const old=await db.prepare('SELECT * FROM edit_jobs WHERE id=?').bind(input.id).first<Job>();
 if(old){if(old.project!==input.project||old.parent!==input.parent||old.prompt!==input.prompt||JSON.stringify(JSON.parse(old.references).map((r:{id:string})=>r.id).sort())!==JSON.stringify([...input.references].sort()))throw new Error('任务编号已用于其他修改。');if(old.status!=='cancelled'&&await bucket().head(`images/${old.id}`)){await finish(old.id);return Response.json({...old,status:'succeeded',version:old.id})}return Response.json(old,{status:old.status==='running'?202:200})}
 if(input.prompt.length>MAX_PROMPT_CHARS||input.references.length>MAX_REFERENCES)throw new Error('本轮最多使用 2 张参考图，修改要求请控制在 2000 字以内。');
 if(input.parent&&!await db.prepare('SELECT id FROM versions WHERE id=? AND project=?').bind(input.parent,input.project).first())throw new Error('所选版本不存在。');
 if(!input.parent&&input.references.length)throw new Error('文字生成暂不使用参考图，请生成后再添加。');
 const available=(await db.prepare("SELECT id,name,role FROM assets WHERE project=? AND kind='reference' ORDER BY created,id").bind(input.project).all<{id:string;name:string;role:string}>()).results;
 const references=available.filter(x=>(input.references as string[]).includes(x.id));if(references.length!==input.references.length)throw new Error('所选参考图已不存在。');
 const project=await db.prepare('SELECT preserveRules FROM projects WHERE id=? AND deleted=0').bind(input.project).first<{preserveRules:string|null}>();
 if(!project)throw new Error("任务已删除或不存在，请先恢复。");
 const preserveRules=input.preserveRules===undefined?(project?.preserveRules??DEFAULT_PRESERVE_RULES):input.preserveRules;
 if(typeof preserveRules!=='string'||preserveRules.length>2000)throw new Error('保留要求不能超过 2000 字。');
 const now=new Date().toISOString();
 const inserted=await db.prepare("INSERT OR IGNORE INTO edit_jobs (id,project,parent,prompt,\"references\",model,preserveRules,status,phase,created,updated) VALUES (?,?,?,?,?,?,?,'running','queued',?,?)").bind(input.id,input.project,input.parent,input.prompt,JSON.stringify(references),WEB_MODEL,preserveRules,now,now).run();
 if(!inserted.meta.changes)return Response.json({error:'工作室已有一个任务等待或处理，请先完成它。'},{status:409});
 return Response.json({id:input.id,project:input.project,status:'running',phase:'queued'},{status:202});
}catch(e){return fail(e)}}

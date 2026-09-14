import {database,bucket} from "./storage";
export const WEB_MODEL="chatgpt-web";
export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type Job={preserveRules:string|null;id:string;project:string;parent:string;prompt:string;references:string;model:string;status:string;phase:string;worker:string|null;conversation:string|null;version:string|null;error:string|null;created:string;updated:string};
export async function workerState(){const state=await database().prepare("SELECT state,updated FROM companion WHERE id=1").first<{state:string;updated:string}>();return state&&Date.now()-Date.parse(state.updated)<90000?state.state:"offline"}
export async function finish(id:string){
 const db=database(),job=await db.prepare("SELECT * FROM edit_jobs WHERE id=?").bind(id).first<Job>();
 if(!job)throw new Error("未找到待保存任务。");if(job.status==="succeeded")return;if(job.status==="cancelled")throw new Error("任务已由用户结束，请手动导入结果。");
 const object=await bucket().head(`images/${id}`);if(!object)throw new Error("没有找到已生成的图片。");
 const mime=object.httpMetadata?.contentType||"image/jpeg";if(!["image/png","image/jpeg","image/webp"].includes(mime))throw new Error("结果格式无效。");
 const now=new Date().toISOString();
 await db.batch([db.prepare("INSERT OR IGNORE INTO assets (id,project,name,mime,kind,role,created) VALUES (?,?,?,?,'generated','其他',?)").bind(id,job.project,`AI-${id}.${mime.split('/')[1]}`,mime,now),db.prepare('INSERT OR IGNORE INTO versions (id,project,parent,asset,prompt,"references",created) VALUES (?,?,?,?,?,?,?)').bind(id,job.project,job.parent||null,id,job.prompt,job.references,now),db.prepare("UPDATE edit_jobs SET status='succeeded',phase='complete',version=?,error=NULL,updated=? WHERE id=?").bind(id,now,id)]);
}

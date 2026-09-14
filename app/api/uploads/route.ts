import {authorize,authorizeOwner,fail,limitedBody} from '../storage';
import {objects} from '@/lib/server/objects';
import {sign} from '@/lib/server/auth';
export async function POST(request:Request){try{
 await authorize(request);const input=await (await limitedBody(request)).json() as {target:string;name:string;size:number;type:string;fields:Record<string,string>};
 if(!['/api/workspace','/api/companion'].includes(input.target))throw new Error('上传目标无效。');if(input.target==='/api/companion')await authorizeOwner(request);
 if(!Number.isInteger(input.size)||input.size<1||input.size>10*1024*1024||!['image/png','image/jpeg','image/webp'].includes(input.type))throw new Error('请上传不超过 10 MB 的 PNG、JPG 或 WebP 图片。');
 if(typeof input.name!=='string'||!input.fields||Object.entries(input.fields).some(([k,v])=>!['kind','project','parent','prompt','worker','id'].includes(k)||typeof v!=='string'||v.length>6000))throw new Error('上传参数无效。');
 const path='staging/'+crypto.randomUUID();const {data,error}=await objects().createSignedUploadUrl(path);if(error)throw new Error('无法连接图片存储，请稍后重试。');
 return Response.json({uploadUrl:data.signedUrl,receipt:sign({path,target:input.target,name:input.name.slice(0,150),size:input.size,fields:input.fields,expires:Date.now()+10*60*1000})},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e)}}

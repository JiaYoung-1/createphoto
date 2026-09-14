import {objects} from './objects';
import {verify} from './auth';
export type UploadTicket={path:string;target:string;name:string;size:number;fields:Record<string,string>;expires:number};
export async function restoreUpload(receipt:string,target:string){const ticket=verify<UploadTicket>(receipt);if(ticket.target!==target||!/^staging\/[a-f0-9-]{36}$/.test(ticket.path))throw new Error('上传目标无效。');const {data,error}=await objects().download(ticket.path);if(error||!data||data.size!==ticket.size||data.size>10*1024*1024)throw new Error('上传图片不完整，请重试。');const form=new FormData();for(const [key,value] of Object.entries(ticket.fields))form.set(key,value);form.set('file',data,ticket.name);return new Response(form)}

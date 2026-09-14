import {createClient} from '@supabase/supabase-js';
export function objects(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('请先配置 Supabase 私有图片存储。');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}).storage.from(process.env.SUPABASE_BUCKET||'studio-private')}
export function bucket(){return {
 async get(path:string){const {data,error}=await objects().download(path);if(error){if(String((error as {statusCode?:string}).statusCode)==='404'||error.message.toLowerCase().includes('not found'))return null;throw new Error('图片存储读取失败，请稍后重试。')}return {body:data.stream(),httpMetadata:{contentType:data.type},json:async<T>()=>JSON.parse(await data.text()) as T}},
 async head(path:string){const {data,error}=await objects().info(path);if(error){if(String((error as {statusCode?:string}).statusCode)==='404'||error.message.toLowerCase().includes('not found'))return null;throw new Error('图片状态读取失败，请稍后重试。')}return {httpMetadata:{contentType:data.contentType}}},
 async put(path:string,data:string|Uint8Array,options?:{httpMetadata?:{contentType?:string};customMetadata?:Record<string,string>}){const {error}=await objects().upload(path,data,{contentType:options?.httpMetadata?.contentType||'application/octet-stream',upsert:true});if(error)throw new Error('图片保存失败，请稍后重试。')},
 async delete(path:string){const {error}=await objects().remove([path]);if(error)throw new Error('存储清理失败。')}
}}

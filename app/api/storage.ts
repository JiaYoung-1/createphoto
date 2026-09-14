import {cookies} from "next/headers";
import {sameSecret} from "@/lib/server/auth";
import {restoreUpload} from "@/lib/server/uploads";
export {database} from "@/lib/server/database";
import {bucket} from "@/lib/server/objects";
export {bucket};
export const OWNER_ID="0fec796c-57c2-42eb-bcd3-6cc58c0996cf";
export const ACCESS_COOKIE="__Host-studio-access",ACCESS_OBJECT="private/guest-access.json";
export async function isOwner(){const value=(await cookies()).get("__Host-studio-owner")?.value;return !!value&&sameSecret(value)}
export function checkOrigin(request:Request){if(request.method!=="GET"&&request.headers.get("origin")!==new URL(request.url).origin)throw new Error("请求来源无效，请刷新页面重试。")}
export async function hashAccess(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)))).map(b=>b.toString(16).padStart(2,"0")).join("")}
export async function validGuestToken(token:string){if(!/^[a-f0-9]{64}$/.test(token))return false;const object=await bucket().get(ACCESS_OBJECT);if(!object)return false;const record=await object.json<{hash:string;expires:number}>();return record.expires>Date.now()&&record.hash===await hashAccess(token)}
export async function hasGuestAccess(request:Request){const token=(request.headers.get("cookie")||"").split(";").map(s=>s.trim()).find(s=>s.startsWith(ACCESS_COOKIE+"="))?.slice(ACCESS_COOKIE.length+1)||"";return validGuestToken(token)}
export async function authorizeOwner(request:Request){checkOrigin(request);if(!await isOwner())throw new Error("请在工作电脑登录主人账号后操作。")}
export async function authorize(request:Request){checkOrigin(request);if(!await isOwner()&&!await hasGuestAccess(request))throw new Error("请使用专属链接进入，无需登录。")}
export function fail(e:unknown){const message=e instanceof Error?e.message:"保存失败，请稍后重试。";console.error("Workspace request failed",message);return Response.json({error:message},{status:message.includes("登录")?401:message.includes("来源")?403:400})}
export async function limitedBody(request:Request){const reader=request.body?.getReader();if(!reader)throw new Error("没有收到上传内容。");const chunks:Uint8Array[]=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>12*1024*1024){await reader.cancel();throw new Error("上传内容过大，单张图片请小于 10 MB。")}chunks.push(value)}const body=new Response(new Blob(chunks as BlobPart[]),{headers:{"Content-Type":request.headers.get("Content-Type")||"application/json"}});if(request.headers.get("content-type")?.includes("application/json")){const data=await body.clone().json() as {fileReceipt?:string};if(data.fileReceipt)return restoreUpload(data.fileReceipt,new URL(request.url).pathname)}return body}
export const roles=["材质","构造方式","建筑模型","帷幔","氛围","人群","景观","家具","其他"];
export function imageMime(a:Uint8Array){if(a[0]===137&&a[1]===80&&a[2]===78&&a[3]===71&&a[4]===13&&a[5]===10&&a[6]===26&&a[7]===10)return "image/png";if(a[0]===255&&a[1]===216&&a[2]===255)return "image/jpeg";if(new TextDecoder().decode(a.slice(0,4))==="RIFF"&&new TextDecoder().decode(a.slice(8,12))==="WEBP")return "image/webp";throw new Error("请上传 PNG、JPG 或 WebP 格式的有效图片。");}

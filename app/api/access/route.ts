import {sameSecret,secret,sign,verify} from "@/lib/server/auth";
import {ACCESS_COOKIE,ACCESS_OBJECT,authorize,bucket,checkOrigin,fail,hasGuestAccess,hashAccess,isOwner,limitedBody,validGuestToken} from '../storage';
const accessCookie=(token:string)=>`${ACCESS_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;
const headers={"Cache-Control":"no-store","Referrer-Policy":"no-referrer"};
export async function GET(request:Request){try{const owner=await isOwner();return Response.json({owner,allowed:owner||await hasGuestAccess(request)},{headers})}catch(e){return fail(e)}}
export async function POST(request:Request){try{
 checkOrigin(request);
 const text=await (await limitedBody(request)).text();if(text.length>1024)throw new Error('请求内容过长。');
 const input=JSON.parse(text);
 if(input.action==='transferOwner'){
  if(!await isOwner())return Response.json({error:'请在已连接的工作电脑操作。'},{status:403,headers});
  const token=sign({purpose:'owner-domain-transfer',origin:'https://www.yzqwjy.cn',expires:Date.now()+60000});
  return Response.json({url:'https://www.yzqwjy.cn/manage#connect='+token},{headers});
 }
 if(input.action==='acceptOwnerTransfer'){
  const transfer=verify<{purpose:string;origin:string;expires:number}>(String(input.token||''));
  if(transfer.purpose!=='owner-domain-transfer'||transfer.origin!==new URL(request.url).origin)throw new Error('工作电脑连接凭证无效。');
  return Response.json({ok:true},{headers:{...headers,'Set-Cookie':`__Host-studio-owner=${secret()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`}});
 }
 if(input.action==='admin'){if(typeof input.token!=='string'||!sameSecret(input.token))return Response.json({error:'管理密钥无效。'},{status:401,headers});return Response.json({ok:true},{headers:{...headers,'Set-Cookie':`__Host-studio-owner=${input.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`}})}
 if(input.action==='create'){
  await authorize(request);
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
  await bucket().put(ACCESS_OBJECT,JSON.stringify({hash:await hashAccess(token),expires:Date.now()+365*86400000}),{httpMetadata:{contentType:'application/json'}});
  return Response.json({url:new URL(request.url).origin+'/#access='+token},{headers:{...headers,'Set-Cookie':accessCookie(token)}});
 }
 if(input.action==='revoke'){await authorize(request);await bucket().delete(ACCESS_OBJECT);return Response.json({ok:true},{headers})}
 if(input.action==='enter'&&typeof input.token==='string'&&await validGuestToken(input.token)){
  return Response.json({ok:true},{headers:{...headers,'Set-Cookie':accessCookie(input.token)}});
 }
 return Response.json({error:'专属链接已失效，请让工作站主人重新分享。'},{status:401,headers});
}catch(e){return fail(e)}}

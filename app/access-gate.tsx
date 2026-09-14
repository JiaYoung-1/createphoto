"use client";
import {useEffect,useState} from 'react';
import Workspace from './workspace';
export default function AccessGate(){
 const [ready,setReady]=useState(false),[allowed,setAllowed]=useState(false),[owner,setOwner]=useState(false),[error,setError]=useState(''),[link,setLink]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;async function init(){try{
  const token=new URLSearchParams(location.hash.slice(1)).get('access');
  if(token){const r=await fetch('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'enter',token})});history.replaceState(null,'',location.pathname+location.search);if(!r.ok)throw new Error(((await r.json()) as {error:string}).error)}
  const r=await fetch('/api/access',{cache:'no-store'});if(!r.ok)throw new Error('暂时无法连接工作站，请刷新重试。');const d=await r.json() as {allowed:boolean;owner:boolean};if(active){setAllowed(d.allowed);setOwner(d.owner)}
 }catch(e){if(active)setError(e instanceof Error?e.message:'连接失败，请刷新重试。')}finally{if(active)setReady(true)}}void init();return()=>{active=false}},[]);
 async function share(action:'create'|'revoke'){setBusy(true);setError('');try{const r=await fetch('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});const d=await r.json() as {url?:string;error:string};if(!r.ok)throw new Error(d.error);setLink(d.url||'');if(action==='revoke')setError('旧链接及其访问权限已停用。')}catch(e){setError(e instanceof Error?e.message:'操作失败')}finally{setBusy(false)}}
 if(!ready||!allowed)return <main className="access-welcome"><div><small>私人图像工作站</small><h1>俞总和小吴的<br/>图像生成工作站</h1><p>{!ready?'正在打开你的创作空间…':error||'请通过主人分享的专属链接进入，无需登录。'}</p>{ready&&<a href="/signin-with-chatgpt?return_to=%2F">工作电脑管理入口</a>}</div></main>;
 return <><details className="guest-sharing"><summary>共同管理 · 免登录完整权限</summary><p>专属链接可查看和修改工作站中的图片，并提交出图任务。俞总和小吴均可使用全部网站功能，包括管理分享链接。有效期一年；重新生成会立即停用旧链接。</p><button className="secondary" disabled={busy} onClick={()=>void share('create')}>生成专属链接</button> <button className="secondary" disabled={busy} onClick={()=>void share('revoke')}>停用专属链接</button>{link&&<label>俞总的免登录完整工作站链接<input aria-label="俞总的免登录专属链接" readOnly value={link} onFocus={e=>e.target.select()}/></label>}{error&&<p role="status">{error}</p>}</details><Workspace/></>;
}

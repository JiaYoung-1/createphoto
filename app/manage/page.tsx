"use client";
import {useEffect,useState,type FormEvent} from 'react';
export default function Manage(){
 const [key,setKey]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const token=new URLSearchParams(location.hash.slice(1)).get('connect');const transfer=new URLSearchParams(location.search).get('transfer')==='yzqwjy.cn';if(!token&&!transfer)return;history.replaceState(null,'',location.pathname);setBusy(true);void(async()=>{try{const r=await fetch('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(token?{action:'acceptOwnerTransfer',token}:{action:'transferOwner'})});const d=await r.json();if(!r.ok)throw new Error(d.error||'工作电脑连接失败。');location.replace(token?'/':d.url)}catch(e){setError((e as Error).message);setBusy(false)}})()},[]);
 async function connect(e:FormEvent){
  e.preventDefault();setBusy(true);
  try{const r=await fetch('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'admin',token:key})});if(!r.ok)throw new Error('管理密钥不正确，或服务器尚未配置。');location.assign('/')}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <main className="access-welcome"><form onSubmit={connect}><h1>工作电脑连接</h1><p>仅在负责出图的电脑上输入管理密钥。俞总使用免登录专属链接。</p><input aria-label="管理密钥" type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} required/><button className="primary" disabled={busy}>连接工作电脑</button><p role="status">{error}</p></form></main>;
}

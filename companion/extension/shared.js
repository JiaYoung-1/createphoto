// Shared in isolated extension worlds; never exports credentials or page state.
globalThis.Atelier = (() => {
  const SITE = 'https://atelier-two-arch-0913.wjy2378408967.chatgpt.site';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const MAX = 10 * 1024 * 1024;
  const mime = b => b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71 ? 'image/png' : b[0]===255&&b[1]===216&&b[2]===255 ? 'image/jpeg' : String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP' ? 'image/webp' : null;
  function bytes(data) {
    if (typeof data !== 'string' || data.length > Math.ceil(MAX/3)*4+4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw Error('图片内容无效或超过 10 MB。');
    const b=Uint8Array.from(atob(data), c=>c.charCodeAt(0));
    if (!b.length || b.length>MAX || !mime(b)) throw Error('图片格式无效。');
    return b;
  }
  async function encode(blob) {
    if (!blob.size || blob.size>MAX) throw Error('图片超过 10 MB 或为空。');
    const b=new Uint8Array(await blob.arrayBuffer()); if (!mime(b)) throw Error('不是支持的图片。');
    let raw=''; for(let i=0;i<b.length;i+=8192) raw+=String.fromCharCode(...b.subarray(i,i+8192));
    return btoa(raw);
  }
  function conversation(url) { try { const u=new URL(url); return u.origin==='https://chatgpt.com'&&/^\/c\/[a-zA-Z0-9:-]+$/.test(u.pathname) ? u.origin+u.pathname : null; } catch { return null; } }
  const trusted = sender => sender.id===chrome.runtime.id && sender.url===chrome.runtime.getURL('desk.html');
  const sleep = ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function until(fn,ms=30000) {const end=Date.now()+ms;while(Date.now()<end){const found=await fn();if(found)return found;await sleep(500)}throw Error('页面未就绪或界面已变化，请检查浏览器。')}
  // Contenteditable renders each paragraph with extra blank lines in innerText.
  // Normalize paragraph breaks only; preserve spaces, wording and punctuation.
  const samePrompt=(a,b)=>{const n=s=>s.replace(/\r\n?/g,'\n').replace(/\n+/g,'\n').trim();return n(a)===n(b)};
  return {SITE,UUID,MAX,mime,bytes,encode,conversation,trusted,sleep,until,samePrompt};
})();

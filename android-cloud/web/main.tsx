import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import Workspace from '@/app/workspace';
import {installCloudClient} from '../runtime/cloud-client.mjs';
const native=(window as any).NovelCloud;
const client=installCloudClient(native);
function App(){
  const [profile,setProfile]=useState<any>(()=>JSON.parse(native.connectionInfo())),[origin,setOrigin]=useState(''),[token,setToken]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const read=()=>setProfile(JSON.parse(native.connectionInfo()));window.addEventListener('novel-cloud-connection',read);return()=>window.removeEventListener('novel-cloud-connection',read);},[]);
  if(profile.connected)return <Workspace key={profile.serverId}/>;
  async function connect(){setBusy(true);setError('');try{const r:any=await client.connect(origin.trim(),token.trim()),x:any=await r.json();if(!r.ok)throw new Error(x.error||'连接失败');setToken('');setProfile(JSON.parse(native.connectionInfo()));}catch(e:any){setError(e.message);}finally{setBusy(false);}}
  return <main className="cloud-connect"><section className="card"><span className="eyebrow">NOVEL FACTORY / CLOUD</span><h1>连接你的小说云端</h1><p>手机只发指令。启动后，即使关机，云端仍按目标写作。</p><label className="field"><span>独立服务器HTTPS地址</span><input value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="https://你的服务器域名" autoCapitalize="none" autoCorrect="off"/></label><label className="field"><span>连接凭证（不是DeepSeek Key）</span><input type="password" value={token} onChange={e=>setToken(e.target.value)} autoComplete="off" placeholder="从自己的云终端获取"/></label>{error&&<p className="banner error">{error}</p>}<button className="cloud-primary" disabled={busy||!origin.trim()||!token.trim()} onClick={connect}>{busy?'正在核验云端身份…':'连接独立云端'}</button><p className="small-note">连接仅检查服务状态，不会启动创作或产生模型费用。还没有服务器时，需要先完成独立云端部署。</p><button onClick={()=>native.exportLegacy()}>导出旧本机作品</button><p>连接后，在「模型设置」填写DeepSeek API Key。无需ChatGPT账号。</p></section></main>;
}
async function exportAnchor(a:HTMLAnchorElement){try{const r=await fetch(a.href),b=new Uint8Array(await r.arrayBuffer());let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));native.exportDocument(a.download||'小说备份.txt',r.headers.get('content-type')||'text/plain',btoa(s));}catch{alert('导出未完成，请重新读取已保存状态后导出');}}
const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.href.startsWith('blob:')){void exportAnchor(this);return;}click.call(this);};
document.addEventListener('click',e=>{const a=(e.target as Element)?.closest?.('a');if(!a)return;if(a.href.startsWith('blob:')){e.preventDefault();void exportAnchor(a);}else if(/^https:/.test(a.href)&&new URL(a.href).origin!==location.origin){e.preventDefault();native.openExternal(a.href);}},true);
try{Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>native.copyText(text)}});}catch{}
createRoot(document.getElementById('root')!).render(<App/>);

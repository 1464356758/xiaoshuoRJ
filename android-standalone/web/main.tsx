import React from 'react';
import {createRoot} from 'react-dom/client';
import Workspace from '@/app/workspace';
import * as route from '@/app/api/workspace/route';
import {installDevice} from '../runtime/device.mjs';

async function boot(){
  const native=(window as any).NovelNative;
  if(!native)throw new Error('请从独立安卓App打开');
  if(!AbortSignal.timeout)(AbortSignal as any).timeout=(ms:number)=>{const c=new AbortController();setTimeout(()=>c.abort(),ms);return c.signal;};
  if(!Response.json)(Response as any).json=(value:any,init:any={})=>new Response(JSON.stringify(value),{...init,headers:{...init.headers,'Content-Type':'application/json'}});
  await installDevice(native,route);
  async function exportAnchor(a:HTMLAnchorElement){try{const r=await fetch(a.href),buffer=new Uint8Array(await r.arrayBuffer());let binary='';for(let i=0;i<buffer.length;i+=8192)binary+=String.fromCharCode(...buffer.subarray(i,i+8192));native.exportDocument(a.download||'小说导出.txt',r.headers.get('content-type')||'text/plain',btoa(binary));}catch{native.runnerState('导出失败，请重新操作');}}
  // Existing exports use detached anchors; document listeners never see them.
  const anchorClick=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){if(this.href.startsWith('blob:')){void exportAnchor(this);return;}anchorClick.call(this);};
  try{Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>native.copyText(text)}});}catch{}
  document.addEventListener('click',async e=>{
    const a=(e.target as Element)?.closest?.('a');if(!a)return;
    if(a.href.startsWith('blob:')){e.preventDefault();await exportAnchor(a);}
    else if(/^https?:/.test(a.href)&&new URL(a.href).origin!==location.origin){e.preventDefault();native.openExternal(a.href);}
  },true);
  createRoot(document.getElementById('root')!).render(<Workspace/>);
  native.ready();
}
boot().catch(e=>{document.getElementById('root')!.textContent='本机启动失败：'+e.message+'。请保留App数据并反馈错误，不要卸载。';});

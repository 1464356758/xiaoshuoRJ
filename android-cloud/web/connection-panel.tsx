import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
export default function ConnectionPanel(){
  const [open,setOpen]=useState(false),[status,setStatus]=useState('');const native=(window as any).NovelCloud,info=JSON.parse(native.connectionInfo());
  async function read(){try{const r=await fetch('/api/status'),x:any=await r.json();if(!r.ok)throw new Error(x.error);setStatus(x.workerReady?'云端执行器在线；关闭App后继续按已授权目标执行':'云端执行器未就绪');}catch(e:any){setStatus(e.message);}}
  return <><Button variant="outline" onClick={()=>{setOpen(true);void read();}}>云端连接</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="factory-dialog"><DialogTitle>独立云端控制 · V0.11</DialogTitle><DialogDescription>手机只负责控制，创作和保存由你自己的云端服务执行。</DialogDescription><p>{info.origin}</p><p>{status}</p><p>退出App、清理后台或关机不会向服务器发送暂停。需要停笔时，请在控制台明确点击暂停。</p><div className="button-row"><Button variant="outline" onClick={read}>刷新连接状态</Button><Button variant="outline" onClick={()=>native.exportLegacy()}>导出旧本机作品</Button><Button variant="outline" onClick={()=>{native.disconnect();window.dispatchEvent(new Event('novel-cloud-connection'));}}>断开手机连接（云端继续）</Button></div></DialogContent></Dialog></>;
}

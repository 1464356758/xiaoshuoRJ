'use client';
import {useEffect,useState} from 'react';
import {Download,Smartphone,Check} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function AppInstall(){
  const [prompt,setPrompt]=useState<InstallEvent|null>(null),[installed,setInstalled]=useState(false),[guide,setGuide]=useState(false);
  useEffect(()=>{const media=window.matchMedia('(display-mode: standalone)');const refresh=()=>setInstalled(media.matches||(navigator as any).standalone===true);refresh();
    const capture=(e:Event)=>{e.preventDefault();setPrompt(e as InstallEvent);};const done=()=>{setInstalled(true);setPrompt(null);};
    window.addEventListener('beforeinstallprompt',capture);window.addEventListener('appinstalled',done);media.addEventListener('change',refresh);
    return()=>{window.removeEventListener('beforeinstallprompt',capture);window.removeEventListener('appinstalled',done);media.removeEventListener('change',refresh);};},[]);
  async function install(){if(!prompt){setGuide(true);return;}try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome!=='accepted')setGuide(true);}catch{setGuide(true);}finally{setPrompt(null);}}
  return <><Button variant="outline" onClick={installed?()=>setGuide(true):install} className="install-app"><Smartphone size={16}/><span>{installed?'已安装':'安装App'}</span></Button><Dialog open={guide} onOpenChange={setGuide}><DialogContent className="factory-dialog"><DialogTitle>把小说工厂安装到桌面</DialogTitle><DialogDescription>当前提供可安装的网页 App（PWA），独立窗口运行，无需安装APK。</DialogDescription>{installed&&<p className="message ok"><Check size={18}/>已经在独立App窗口中打开。</p>}<ol className="help-steps"><li>安卓：用 Chrome 或支持安装的浏览器打开本软件网址，并完成登录。</li><li>点右上角菜单，选择「安装应用」或「添加到主屏幕」，按提示确认。</li><li>在手机桌面打开「小说工厂」。不要停留在聊天软件的内置浏览器中；可以先点下方链接在外部浏览器打开。</li><li>iPhone：用 Safari 打开，点分享 →「添加到主屏幕」。电脑：使用浏览器地址栏安装图标。</li></ol><a href="/" target="_blank" rel="noopener noreferrer" className="file-button"><Download size={16}/>打开独立网页</a><p className="small-note">云端创作由服务器调度。安装App并不是后台运行的前提；离线时无法读取云端稿件。</p></DialogContent></Dialog></>;
}

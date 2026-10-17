export function adaptRoute(source) {
  if(!source.includes("import {env} from 'cloudflare:workers';"))throw new Error('需复核线上API入口变化');
  const start=source.indexOf('function resources(request:Request) {'),end=source.indexOf('const reply=',start);
  if(start<0||end<0)throw new Error('需复核API资源边界');
  return source.replace("import {env} from 'cloudflare:workers';",'').slice(0,source.replace("import {env} from 'cloudflare:workers';",'').indexOf('function resources(request:Request) {'))+
    'function resources(request:Request) { return globalThis.__novelAppResources(request); }\n'+source.slice(end);
}
export function adaptWorkspace(source) {
  const start=source.indexOf('  async function runInPage(){'),end=source.indexOf('  async function runSingle()',start);
  if(start<0||end<0)throw new Error('需复核自动执行按钮变化');
  source=source.slice(0,start)+'  async function runInPage(){await runAuto();}\n'+source.slice(end);
  source=source.replace("if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});",'');
  source=source.replaceAll('云端','本机').replaceAll('密钥在服务端加密保存','密钥在本机加密保存')
    .replaceAll('仅本人可访问','数据仅保存在本机').replaceAll('在此页一键连续执行','启动本机自动执行')
    .replaceAll('任务已保存。请核对调度心跳是否正常，也可立即执行一步。','本机任务已启动；可从通知栏暂停。预算、质量门或系统限制会停止任务。');
  return source;
}

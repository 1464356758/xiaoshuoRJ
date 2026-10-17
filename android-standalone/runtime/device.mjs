import {Store} from '../../lib/store.mjs';
import {config} from '../../lib/engine.mjs';
import {seal} from '../../lib/model.mjs';
import {jobActive,pauseJob,tickRunner} from '../../lib/jobs.mjs';
import {nativeDatabase} from './database.mjs';

export async function recoverDevice(store) {
  // Starting a process is never authorization to repeat a possibly billed call.
  await store.db.prepare("UPDATE calls SET status='uncertain' WHERE owner=? AND status='reserved'").bind(store.owner).run();
  let interrupted=0;
  for(const job of await store.list('job'))if(jobActive(job)){await pauseJob(store,job.bookId);interrupted++;}
  for(const task of await store.list('styleTask'))if(['ready','running'].includes(task.status))await store.save(task,{...task,status:'paused',error:'App重启后已暂停，请先检查已保存的结果再继续'});
  return interrupted;
}
export function createNativeTransport(native) {
  const pending=new Map();
  globalThis.__novelHttpResult=(id,raw)=>{const p=pending.get(id);if(!p)return;pending.delete(id);p.cleanup();try{const result=JSON.parse(raw);if(result.error)p.reject(new Error(result.error));else p.resolve(new Response([204,205,304].includes(result.status)?null:result.body,{status:result.status,headers:result.headers||{}}));}catch{p.reject(new Error('接口返回格式异常；未自动重试'));}};
  return (url,init={})=>new Promise((resolve,reject)=>{
    const id=crypto.randomUUID(),signal=init.signal;
    const abort=()=>{pending.delete(id);native.cancelHttp(id);reject(new Error('接口请求中断；费用待核对，未自动重试'));};
    if(signal?.aborted){reject(new Error('请求已取消'));return;}
    const cleanup=()=>signal?.removeEventListener('abort',abort);
    pending.set(id,{resolve,reject,cleanup});signal?.addEventListener('abort',abort,{once:true});
    try{native.http(id,String(url),init.method||'GET',JSON.stringify(Object.fromEntries(new Headers(init.headers||{}))),init.body||'');}
    catch{pending.delete(id);cleanup();reject(new Error('无法发起接口请求；未自动重试'));}
  });
}
export async function installDevice(native,route) {
  const db=nativeDatabase(native),store=new Store(db,'android-personal'),secret=native.runtimeSecret();
  await recoverDevice(store);
  if(!await store.get('settings:'+store.owner))await store.create('settings',{provider:'deepseek',model:'deepseek-v4-pro',writerModel:'deepseek-v4-pro',reviewModel:'deepseek-v4-pro',inputPrice:9,outputPrice:27,spendEnabled:false},'','settings:'+store.owner);
  const transport=createNativeTransport(native),webFetch=globalThis.fetch.bind(globalThis);
  let ticking=false;
  globalThis.__novelAppResources=()=>({store,secret,runnerEnabled:true});
  async function pauseAll(){for(const j of await store.list('job'))if(jobActive(j))await pauseJob(store,j.bookId);}
  globalThis.__novelPauseAll=async()=>{await pauseAll();native.runnerState('已暂停；已保存检查点保留');};
  globalThis.__novelTick=async()=>{
    if(ticking||!native.isRunning())return;ticking=true;
    try{
      const result=await tickRunner(db,secret);
      native.runnerState(result.advanced?'已保存：'+(result.phase||'检查点'):result.activeJobs?'检查并等待下一步':'本轮任务已结束');
      if(!result.activeJobs)native.stopRunner();
    }catch{await pauseAll();native.runnerState('任务已停止，请打开App查看');native.stopRunner();}
    finally{ticking=false;}
  };
  async function deviceRequest(url){
    if(url.searchParams.has('balance')){
      const c=await config(store);let encrypted=c.provider==='deepseek'?c.apiKeyEncrypted:c.writerProvider==='deepseek'?c.writerApiKeyEncrypted:null;
      if(!encrypted)throw new Error('请先保存DeepSeek API密钥');
      const key=await seal(encrypted,secret,true),r=await transport('https://api.deepseek.com/user/balance',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(30000)});
      if(!r.ok)throw new Error('余额查询返回HTTP '+r.status);return await r.json();
    }
    return {...JSON.parse(native.deviceInfo()),version:'0.10.0',mode:'本机独立版',paidCallsAutomatic:false};
  }
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href);
    if(url.origin!==location.origin){if(url.protocol==='blob:'||url.protocol==='data:')return webFetch(input,init);return transport(url.href,init);}
    if(url.pathname==='/api/device'){
      try{return Response.json(await deviceRequest(url));}catch(e){return Response.json({error:e.message},{status:400});}
    }
    if(url.pathname!=='/api/workspace')return webFetch(input,init);
    const method=(init.method||'GET').toUpperCase(),request=new Request(url.href,{...init,method});
    let action;
    if(method==='POST'){
      const x=await request.clone().json();action=x.action;
      if(action==='startJob'){
        const active=(await store.list('job')).filter(jobActive);
        if(active.some(j=>j.bookId!==x.id))return Response.json({error:'请先暂停另一本作品；本机同时只自动执行一本'}, {status:400});
      }
    }
    const response=await (method==='GET'?route.GET:route.POST)(request);
    if(method==='POST'&&response.ok){
      const result=await response.clone().json();
      if(!result.error&&action==='startJob'){
        if(!native.startRunner()){await pauseAll();return Response.json({error:'无法启动本机服务，任务已暂停；请回到App重新启动'}, {status:400});}
      }
      if(action==='pause'&&!(await store.list('job')).some(jobActive))native.stopRunner();
    }
    return response;
  };
  return {store,db,pauseAll};
}

import {createServer} from 'node:http';
import {Store,tickRunner,jobActive,refreshRunnerHeartbeat,createWorkspaceApi,guardedModelCall} from './generated/workspace-api.mjs';
import {openDatabase,privateState,configureControlToken,authorize,DaemonLease} from './storage.mjs';

export async function recoverCloud(store){
  const uncertain=new Set((await store.db.prepare("SELECT DISTINCT book FROM calls WHERE owner=? AND status='reserved'").bind(store.owner).all()).results.map(x=>x.book));
  await store.db.prepare("UPDATE calls SET status='uncertain' WHERE owner=? AND status='reserved'").bind(store.owner).run();
  let blocked=0;
  for(const job of await store.list('job')){if(!jobActive(job))continue;const book=await store.get(job.bookId),chapters=await store.list('chapter',job.bookId);
    if(!(job.lease||book?.lease||chapters.some(c=>c.lease)||uncertain.has(job.bookId)))continue;
    await store.save(job,{...job,status:'blocked',lease:null,error:'服务器在检查点途中中断，可能已经计费；请核对正文与账单后本人重新启动'});
    const b=await store.get(job.bookId);if(b)await store.save(b,{...b,status:'paused',lease:null});
    for(const c of await store.list('chapter',job.bookId))if(c.lease)await store.save(c,{...c,lease:null});blocked++;
  }
  for(const task of await store.list('styleTask'))if(task.status==='running')await store.save(task,{...task,status:'blocked',lease:null,error:'服务器在文风请求中途重启，请检查已保存步骤与费用；不自动重放'});
  return blocked;
}

export async function createCloudService({directory,publicOrigin=null,invoke,interval=2000,autoStart=true,leaseDuration=180000,controlToken}={}){
  if(!directory)throw new Error('需要持久数据目录');
  if(publicOrigin){const u=new URL(publicOrigin);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('公网地址必须为纯HTTPS来源');publicOrigin=u.origin;}
  let secret=await privateState(directory);const db=await openDatabase(directory),lease=new DaemonLease(db,leaseDuration);
  if(!lease.acquire()){db.conn.close();throw new Error('同一数据库已有运行中的云端执行器；请等待原执行器安全退出');}
  const store=new Store(db,'independent-cloud-owner');let closing=false,busy=null,timer=null,lastTick=null,ready=true;
  try{secret=await configureControlToken(directory,secret,controlToken);await recoverCloud(store);if(!await store.get('settings:'+store.owner))await store.create('settings',{provider:'deepseek',model:'deepseek-v4-pro',writerModel:'deepseek-v4-pro',reviewModel:'deepseek-v4-pro',inputPrice:9,outputPrice:27,spendEnabled:false},'','settings:'+store.owner);}catch(e){lease.release();db.conn.close();throw e;}
  const resources=()=>{if(!lease.held()||closing)throw new Error('云端执行器正在切换或停止，请稍后读取已保存进度');return {store,secret:secret.encryptionKey,runnerEnabled:ready};};
  const api=createWorkspaceApi(resources);
  const renew=setInterval(()=>{
    if(!lease.renew()){ready=false;clearTimeout(timer);return;}
    if(busy&&!closing)void refreshRunnerHeartbeat(db).then(state=>{lastTick=state.lastTick;}).catch(()=>{});
  },Math.min(10000,Math.max(50,leaseDuration/3)));renew.unref();
  async function tick(){
    if(closing||!ready||!lease.held()||busy)return null;
    busy=(async()=>{try{
      const guard=async(...args)=>{if(closing||!lease.held())throw new Error('云端执行器已停止，本次未调用模型');return (invoke||guardedModelCall)(...args);};
      const result=await tickRunner(db,secret.encryptionKey,guard);lastTick=result.lastTick;return result;
    }finally{busy=null;}})();return busy;
  }
  async function schedule(){try{await tick();}catch{ready=false;}finally{if(!closing&&ready)timer=setTimeout(schedule,interval);}}
  function start(){if(!timer&&!closing&&ready)timer=setTimeout(schedule,0);}
  const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Novel-Server-Id':secret.serverId}});
  async function dispatch(request){
    const url=new URL(request.url);
    if(url.pathname==='/healthz'&&request.method==='GET')return json({ok:ready&&!closing&&lease.held()},ready&&!closing&&lease.held()?200:503);
    if(!authorize(request.headers.get('Authorization'),secret.controlToken))return json({error:'云端连接凭证无效'},401);
    if(!ready||closing||!lease.held())return json({error:'云端执行器尚未就绪'},503);
    if(request.headers.has('Origin')&&(!publicOrigin||request.headers.get('Origin')!==publicOrigin))return json({error:'请求来源不匹配'},403);
    if(url.pathname==='/api/status'&&request.method==='GET')return json({product:'novel-factory-cloud',protocol:1,serverId:secret.serverId,version:'0.12.2',workerReady:true,lastTick,execution:'independent-server',requiresPhone:false});
    if(url.pathname!=='/api/workspace'||!['GET','POST'].includes(request.method))return json({error:'接口不存在'},404);
    if(request.headers.get('X-Novel-Server-Id')!==secret.serverId)return json({error:'服务器身份已变化，请重新核对连接；本次未执行操作'},409);
    const headers=new Headers({'Content-Type':'application/json'});
    const internal=new Request((publicOrigin||'http://cloud.internal')+url.pathname+url.search,{method:request.method,headers,...(request.method==='POST'?{body:await request.text()}: {})});
    const r=await (request.method==='GET'?api.GET:api.POST)(internal),outHeaders=new Headers(r.headers);outHeaders.set('X-Novel-Server-Id',secret.serverId);
    return new Response(r.body,{status:r.status,headers:outHeaders});
  }
  const server=createServer({maxHeaderSize:16384},async(req,res)=>{
    let response;
    try{
      const path=req.url||'/';if(!path.startsWith('/')||path.startsWith('//'))throw new Error('无效路径');
      if(!(path.split('?')[0]==='/healthz'&&req.method==='GET')&&!authorize(req.headers.authorization,secret.controlToken)){response=json({error:'云端连接凭证无效'},401);req.resume();}
      else{
        const parts=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>16000000){response=json({error:'请求超过16MB'},413);break;}parts.push(chunk);}
        if(!response){const headers=new Headers();for(const name of ['authorization','origin','content-type','x-novel-server-id'])if(typeof req.headers[name]==='string')headers.set(name,req.headers[name]);const method=req.method||'GET';response=await dispatch(new Request('http://cloud.internal'+path,{method,headers,...(!['GET','HEAD'].includes(method)?{body:Buffer.concat(parts)}:{})}));}
      }
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
    }catch{if(!res.headersSent)res.writeHead(400,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"请求未完成，请重新读取已保存状态；未自动重放"}');}
  });
  server.requestTimeout=120000;server.headersTimeout=15000;server.keepAliveTimeout=5000;
  async function listen(port=8080,host='127.0.0.1'){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});if(autoStart)start();return server.address();}
  async function stop(){closing=true;ready=false;clearTimeout(timer);clearInterval(renew);const closed=server.listening?new Promise(resolve=>server.close(resolve)):Promise.resolve();await busy;await closed;lease.release();db.conn.close();}
  return {listen,stop,tick,start,dispatch,store,db,lease,server,serverId:secret.serverId};
}

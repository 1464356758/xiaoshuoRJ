// SYNTHETIC ONLY: real HTTP + SQLite, fake literature/model output. No paid calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,unlink,stat} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildServer} from '../cloud-server/build-server.mjs';
import {settings,createBook,step,config} from '../lib/engine.mjs';
import {hash} from '../lib/store.mjs';
import {synthetic} from './workflow-support.mjs';
import {startJob,pauseJob} from '../lib/jobs.mjs';
import {craftFixture} from './craft-support.mjs';
import {installCloudClient} from '../android-cloud/runtime/cloud-client.mjs';
await buildServer();
const {createCloudService}=await import('../cloud-server/service.mjs');
async function setup(options={}){const directory=await mkdtemp(join(tmpdir(),'novel-independent-cloud-')),service=await createCloudService({directory,autoStart:false,...options});return {directory,service,async cleanup(){await service.stop();await rm(directory,{recursive:true,force:true});}};}
async function authorization(directory,service){const x=JSON.parse(await readFile(join(directory,'server-secrets.json'),'utf8'));return {Authorization:'Bearer '+x.controlToken,'X-Novel-Server-Id':service.serverId,'Content-Type':'application/json',Connection:'close'};}
async function configured(service,directory){const x=JSON.parse(await readFile(join(directory,'server-secrets.json'),'utf8'));await settings(service.store,{apiKey:'SYNTHETIC_SUPPLIER_KEY_FOR_CLOUD_TESTS',inputPrice:1,outputPrice:1,monthLimit:100,bookLimit:100,taskLimit:2,spendEnabled:true},x.encryptionKey);return x.encryptionKey;}
async function book(service,total=3){return createBook(service.store,{title:'SYNTHETIC ONLY / cloud protocol',totalChapters:total,targetWords:1000,budget:20},crypto.randomUUID());}
async function until(check){const limit=Date.now()+6000;while(Date.now()<limit){if(await check())return;await new Promise(r=>setTimeout(r,10));}throw new Error('SYNTHETIC cloud test deadline');}

test('1600次停止状态读取与轮询均不调用供应商，完整账目查询包含所有作品和连接测试',async()=>{
  let network=0;const x=await setup({invoke:async()=>{network++;throw new Error('SYNTHETIC must not invoke supplier');}});
  try{await configured(x.service,x.directory);const b=await book(x.service);await startJob(x.service.store,b.id,3);await pauseJob(x.service.store,b.id);const headers=await authorization(x.directory,x.service);
    for(let i=0;i<1600;i++){const path=i%3===0?'/api/status':i%3===1?'/api/workspace':'/api/workspace?callAudit=1';const r=await x.service.dispatch(new Request('https://cloud.example'+path,{headers}));assert.equal(r.status,200);await r.json();}
    await x.service.tick();assert.equal(network,0);assert.equal((await x.service.store.cost(b.id)).calls.length,0);
    const r=await x.service.dispatch(new Request('https://cloud.example/api/workspace?callAudit=1',{headers}));const a=await r.json();assert.equal(a.scope,'all-owner-calls');assert.equal(a.totalCalls,0);
  }finally{await x.cleanup();}
});

test('维护停用在真实API入口阻断连接测试和创作，即使旧App费用勾选仍开启',async()=>{
  const x=await setup();const previous=process.env.NOVEL_MODEL_API_DISABLED;
  try{await configured(x.service,x.directory);const b=await book(x.service),headers=await authorization(x.directory,x.service);process.env.NOVEL_MODEL_API_DISABLED='1';
    for(const action of [{action:'testConnection',role:'planner'},{action:'step',id:b.id},{action:'githubAssist',id:b.id,question:'SYNTHETIC repository question'}]){const r=await x.service.dispatch(new Request('https://cloud.example/api/workspace',{method:'POST',headers,body:JSON.stringify(action)}));assert.equal(r.status,400);assert.match((await r.json()).error,/维护停用/);}
    assert.equal((await x.service.store.cost(b.id)).calls.length,0);const status=await (await x.service.dispatch(new Request('https://cloud.example/api/status',{headers}))).json();assert.equal(status.modelApiDisabled,true);
  }finally{if(previous===undefined)delete process.env.NOVEL_MODEL_API_DISABLED;else process.env.NOVEL_MODEL_API_DISABLED=previous;await x.cleanup();}
});

test('私有云API可免费复用完整修订响应，仍要求控制凭证并保留费用和三轮上限',async()=>{
  let calls=0;const x=await setup({invoke:async()=>{calls++;throw new Error('SYNTHETIC no supplier calls expected');}});
  try{
    const b=await book(x.service),content=synthetic(912,1400),digest=await hash(content),cfg=await config(x.service.store);
    const c=await x.service.store.create('chapter',{number:1,title:'SYNTHETIC candidate',content,chunks:[content],hash:digest,status:'rework',attempt:3,modelCandidate:{parsed:true,role:'repair',bookId:b.id,chapterNumber:1,planRevision:b.planRevision||0,styleRevision:0,platformHash:null,configRevision:cfg.revision||0,response:{baseHash:digest,patches:[{startQuote:content.slice(300,310),endQuote:content.slice(690,700),after:''}]}}},b.id,b.id+':chapter:1');
    const body=JSON.stringify({action:'acceptRepairCandidate',id:c.id}),headers=await authorization(x.directory,x.service);
    assert.equal((await x.service.dispatch(new Request('https://cloud.example/api/workspace',{method:'POST',body}))).status,401);
    const before=await x.service.store.cost(b.id),r=await x.service.dispatch(new Request('https://cloud.example/api/workspace',{method:'POST',headers,body}));
    assert.equal(r.status,200);const {result}=await r.json();assert.equal(result.status,'reviewing');assert.equal(result.attempt,3);assert.equal(result.lastRepair.reused,true);assert.equal(calls,0);assert.deepEqual(await x.service.store.cost(b.id),before);
  }finally{await x.cleanup();}
});

test('私有云API重验已有审核，绑定原稿哈希并保留三轮和费用记录',async()=>{
  const x=await setup();try{
    let b=await book(x.service);for(let n=0;n<3;n++)await step(x.service.store,b.id,'',craftFixture);
    b=await x.service.store.get(b.id);const c=(await x.service.store.list('chapter',b.id))[0],cfg=await config(x.service.store);
    const response=await craftFixture(x.service.store,cfg,{...b,activeChapter:1},'','review');
    await x.service.store.save(c,{...c,attempt:3,modelCandidate:{parsed:true,role:'review',response,sourceHash:c.hash,bookId:b.id,chapterNumber:1,planRevision:b.planRevision||0,styleRevision:0,platformHash:b.platformBinding?.hash||null,configRevision:cfg.revision||0}});
    const headers=await authorization(x.directory,x.service),before=await x.service.store.cost(b.id),r=await x.service.dispatch(new Request('https://cloud.example/api/workspace',{method:'POST',headers,body:JSON.stringify({action:'acceptReviewCandidate',id:c.id})}));
    assert.equal(r.status,200);const {result}=await r.json();assert.equal(result.chapter.status,'locked');assert.equal(result.chapter.attempt,3);assert.deepEqual(await x.service.store.cost(b.id),before);
  }finally{await x.cleanup();}
});

test('长模型调用等待期间独立心跳持续更新，手机读取不会将执行器误判离线',async()=>{
  let release,entered=false,calls=0;const gate=new Promise(r=>release=r);
  const x=await setup({leaseDuration:300,invoke:async(...args)=>{calls++;entered=true;await gate;return craftFixture(...args);}});
  let running;
  try{
    await configured(x.service,x.directory);const b=await book(x.service);await startJob(x.service.store,b.id,3);
    running=x.service.tick();await until(()=>entered);
    const headers=await authorization(x.directory,x.service);
    const status=async()=>await (await x.service.dispatch(new Request('https://cloud.example/api/status',{headers}))).json();
    await until(async()=>!!(await status()).lastTick);const before=(await status()).lastTick;
    await until(async()=>(await status()).lastTick>before);
    const snapshot=await (await x.service.dispatch(new Request('https://cloud.example/api/workspace',{headers}))).json();
    assert.ok(Date.now()-Date.parse(snapshot.runner.lastTick)<1000);
    assert.equal(snapshot.jobs[0].status,'running');assert.equal(calls,1);
    release();await running;
  }finally{release();await running;await x.cleanup();}
});

test('独立HTTP不信任GPT身份头，只有有效连接凭证可读私有数据',async()=>{const x=await setup();try{const a=await x.service.listen(0),base='http://127.0.0.1:'+a.port,headers=await authorization(x.directory,x.service);
  assert.equal((await fetch(base+'/healthz')).status,200);assert.equal((await fetch(base+'/api/workspace',{headers:{'oai-authenticated-user-id':'independent-cloud-owner'}})).status,401);
  assert.equal((await fetch(base+'/api/status',{headers})).status,200);const r=await fetch(base+'/api/workspace',{headers}),data=await r.json();assert.equal(r.status,200);assert.equal(data.settings.spendEnabled,false);assert.equal('apiKeyEncrypted'in data.settings,false);assert.equal(JSON.stringify(data).includes(headers.Authorization.slice(7)),false);
}finally{await x.cleanup();}});
test('连接身份不符和跨来源POST在执行前被拒绝',async()=>{const x=await setup();try{const headers=await authorization(x.directory,x.service);
  const wrong=await x.service.dispatch(new Request('https://cloud.example/api/workspace',{method:'POST',headers:{...headers,'X-Novel-Server-Id':'wrong'},body:JSON.stringify({action:'create',input:{},key:crypto.randomUUID()})}));assert.equal(wrong.status,409);assert.equal((await x.service.store.list('book')).length,0);
  const cross=await x.service.dispatch(new Request('https://cloud.example/api/workspace',{method:'POST',headers:{...headers,Origin:'https://other.example'},body:'{}'}));assert.equal(cross.status,403);
}finally{await x.cleanup();}});
test('手机HTTP连接全部关闭后，独立执行器完成三章，不追加联合模型审核',async()=>{const x=await setup({interval:1,invoke:craftFixture});try{await configured(x.service,x.directory);const b=await book(x.service),a=await x.service.listen(0),headers=await authorization(x.directory,x.service);
  const r=await fetch('http://127.0.0.1:'+a.port+'/api/workspace',{method:'POST',headers,body:JSON.stringify({action:'startJob',id:b.id,target:3})});assert.equal(r.status,200);await r.arrayBuffer();
  x.service.start();await until(async()=>(await x.service.store.get(b.id+':job'))?.status==='completed');
  assert.equal((await x.service.store.list('chapter',b.id)).filter(c=>c.status==='locked').length,3);assert.equal(await x.service.store.get(b.id+':opening'),null);
}finally{await x.cleanup();}});
test('手机远程暂停不会被在途响应覆盖，不会请求下一步',async()=>{let release,entered=false,calls=0;const gate=new Promise(r=>release=r),x=await setup({interval:1,invoke:async(...args)=>{calls++;entered=true;await gate;return craftFixture(...args);}});try{await configured(x.service,x.directory);const b=await book(x.service);await startJob(x.service.store,b.id,3);await x.service.listen(0);x.service.start();await until(()=>entered);
  const headers=await authorization(x.directory,x.service),r=await x.service.dispatch(new Request('https://cloud.example/api/workspace',{method:'POST',headers,body:JSON.stringify({action:'pause',id:b.id})}));assert.equal(r.status,200);release();await until(async()=>(await x.service.store.get(b.id)).plan!==null);await new Promise(r=>setTimeout(r,30));assert.equal(calls,1);assert.equal((await x.service.store.get(b.id)).status,'paused');assert.equal((await x.service.store.get(b.id+':job')).status,'paused');
}finally{release();await x.cleanup();}});
test('正常停止与重启沿用已保存规划，不重买骨架，继续原授权目标',async()=>{const directory=await mkdtemp(join(tmpdir(),'novel-cloud-restart-'));let service=await createCloudService({directory,autoStart:false,invoke:craftFixture,interval:1});try{const secret=await configured(service,directory),b=await book(service);await step(service.store,b.id,secret,craftFixture);await startJob(service.store,b.id,3);await service.stop();let plans=0;
  service=await createCloudService({directory,autoStart:false,interval:1,invoke:async(...a)=>{if(a[4]==='plan')plans++;return craftFixture(...a);}});await service.listen(0);service.start();await until(async()=>(await service.store.get(b.id+':job')).status==='completed');assert.equal(plans,0);assert.equal((await config(service.store)).spendEnabled,true);
}finally{await service.stop();await rm(directory,{recursive:true,force:true});}});
test('崩溃遗留的收费预留和任务租约会阻塞，不自动重发',async()=>{const directory=await mkdtemp(join(tmpdir(),'novel-cloud-uncertain-'));let service=await createCloudService({directory,autoStart:false});try{await configured(service,directory);const b=await book(service);await startJob(service.store,b.id,3);const job=await service.store.get(b.id+':job');await service.store.save(job,{...job,lease:{token:'SYNTHETIC interrupted',until:Date.now()+10000}});
  await service.db.prepare('INSERT INTO calls (id,owner,book,month,amount,status,data,created) VALUES (?,?,?,?,?,?,?,?)').bind('SYNTHETIC_INTERRUPTED',service.store.owner,b.id,'2026-10',100,'reserved','{}',Date.now()).run();await service.stop();let calls=0;
  service=await createCloudService({directory,autoStart:false,invoke:async()=>{calls++;}});await service.tick();assert.equal(calls,0);assert.equal((await service.store.get(b.id+':job')).status,'blocked');assert.equal((await service.store.cost(b.id)).calls[0].status,'uncertain');
}finally{await service.stop();await rm(directory,{recursive:true,force:true});}});
test('已知计费但正文未保存的章节租约也不会在重启后自动重做',async()=>{const directory=await mkdtemp(join(tmpdir(),'novel-cloud-checkpoint-'));let service=await createCloudService({directory,autoStart:false});try{const secret=await configured(service,directory),b=await book(service);await step(service.store,b.id,secret,craftFixture);await step(service.store,b.id,secret,craftFixture);await startJob(service.store,b.id,3);const c=(await service.store.list('chapter',b.id))[0];await service.store.claimLease(c);await service.stop();
  service=await createCloudService({directory,autoStart:false});assert.equal((await service.store.get(b.id+':job')).status,'blocked');assert.equal((await service.store.get(c.id)).lease,null);
}finally{await service.stop();await rm(directory,{recursive:true,force:true});}});
test('同一数据库不能同时启动两个云端执行器',async()=>{const x=await setup();try{await assert.rejects(createCloudService({directory:x.directory,autoStart:false}),/已有运行中的/);}finally{await x.cleanup();}});
test('执行器失去租约后不接受新操作或模型步骤',async()=>{let calls=0;const x=await setup({invoke:async()=>{calls++;}});try{x.service.db.conn.prepare('UPDATE daemon_lease SET token=?,until_ms=?').run('SYNTHETIC replacement',Date.now()+10000);assert.equal(await x.service.tick(),null);const headers=await authorization(x.directory,x.service);assert.equal((await x.service.dispatch(new Request('https://cloud.example/api/status',{headers}))).status,503);assert.equal(calls,0);}finally{await x.cleanup();}});
test('数据库存在而主密钥丢失时停止启动，不生成新密钥覆盖',async()=>{const directory=await mkdtemp(join(tmpdir(),'novel-cloud-keyloss-'));const service=await createCloudService({directory,autoStart:false});await service.stop();try{await unlink(join(directory,'server-secrets.json'));await assert.rejects(createCloudService({directory,autoStart:false}),/缺少云端保险箱/);}finally{await rm(directory,{recursive:true,force:true});}});
test('云端十章总审失败后持续执行器停止，不写第11章',async()=>{const x=await setup({interval:1,invoke:async(...a)=>a[4]==='arc_review'?{...(await craftFixture(...a)),pass:false,issues:[{severity:'major',message:'SYNTHETIC cloud stage failure'}]}:craftFixture(...a)});try{await configured(x.service,x.directory);let b=await book(x.service,11);b=await x.service.store.save(b,{...b,singleCallProtocol:0});await startJob(x.service.store,b.id,11);await x.service.listen(0);x.service.start();await until(async()=>(await x.service.store.get(b.id+':job')).status==='blocked');assert.equal((await x.service.store.list('chapter',b.id)).some(c=>c.number===11),false);}finally{await x.cleanup();}});
test('手机传输取消只取消控制连接，不发云端暂停或重放POST',async()=>{const original=globalThis.fetch,location=globalThis.location;globalThis.location=new URL('https://appassets.androidplatform.net/assets/index.html');let calls=0,cancelled=0,id;try{installCloudClient({request(value,path){id=value;calls++;assert.equal(path,'/api/workspace');},cancelRequest(){cancelled++;}});const controller=new AbortController(),p=fetch('/api/workspace',{method:'POST',body:'{"action":"startJob"}',signal:controller.signal});controller.abort();await assert.rejects(p,/连接已中断/);globalThis.__novelCloudResult(id,JSON.stringify({status:200,body:'{}'}));assert.equal(calls,1);assert.equal(cancelled,1);}finally{globalThis.fetch=original;globalThis.location=location;}});

test('原生回调丢失后手机请求超时释放，不重放写操作，迟到响应不改变结果',async()=>{const original=globalThis.fetch,location=globalThis.location;globalThis.location=new URL('https://appassets.androidplatform.net/assets/index.html');let calls=0,cancelled=0,id;try{
  installCloudClient({request(value){id=value;calls++;},cancelRequest(){cancelled++;}},{timeoutMs:15});
  await assert.rejects(fetch('/api/workspace',{method:'POST',body:'{"action":"settings"}'}),/等待超时/);
  globalThis.__novelCloudResult(id,JSON.stringify({status:200,body:'{}'}));assert.equal(calls,1);assert.equal(cancelled,1);
}finally{globalThis.fetch=original;globalThis.location=location;}});
test('原生同步失败会清理计时器，配对和保存请求都能结束',async()=>{const original=globalThis.fetch,location=globalThis.location;globalThis.location=new URL('https://appassets.androidplatform.net/assets/index.html');let cancelled=0;try{
  const client=installCloudClient({request(){throw new Error('SYNTHETIC bridge failure');},connect(){throw new Error('SYNTHETIC pairing failure');},cancelRequest(){cancelled++;}},{timeoutMs:10});
  await assert.rejects(fetch('/api/workspace',{method:'POST',body:'{}'}),/bridge failure/);await assert.rejects(client.connect('https://cloud.example','SYNTHETIC'),/pairing failure/);
  await new Promise(resolve=>setTimeout(resolve,25));assert.equal(cancelled,0);
}finally{globalThis.fetch=original;globalThis.location=location;}});
test('保存和读取使用短控制超时，模型步骤仍保留较长等待窗口',async()=>{const original=globalThis.fetch,location=globalThis.location;globalThis.location=new URL('https://appassets.androidplatform.net/assets/index.html');let id,cancelled=0;try{
  installCloudClient({request(value){id=value;},cancelRequest(){cancelled++;}},{timeoutMs:100,controlTimeoutMs:10});
  await assert.rejects(fetch('/api/workspace',{method:'POST',body:'{"action":"settings"}'}),/等待超时/);
  const long=fetch('/api/workspace',{method:'POST',body:'{"action":"step"}'});
  await new Promise(resolve=>setTimeout(resolve,25));globalThis.__novelCloudResult(id,JSON.stringify({status:200,body:'{"synthetic":true}'}));
  assert.deepEqual(await (await long).json(),{synthetic:true});assert.equal(cancelled,1);
}finally{globalThis.fetch=original;globalThis.location=location;}});
test('取消桥接本身抛错时，请求仍能超时结束，不会卡住保存状态',async()=>{const original=globalThis.fetch,location=globalThis.location;globalThis.location=new URL('https://appassets.androidplatform.net/assets/index.html');try{
  installCloudClient({request(){},cancelRequest(){throw new Error('SYNTHETIC native cancellation failure');}},{timeoutMs:10});
  await assert.rejects(fetch('/api/workspace',{method:'POST',body:'{"action":"settings"}'}),/等待超时/);
}finally{globalThis.fetch=original;globalThis.location=location;}});

test('部署连接凭证更换保留服务器身份、加密主密钥和已保存作品',async()=>{const directory=await mkdtemp(join(tmpdir(),'novel-cloud-pairing-'));let service=await createCloudService({directory,autoStart:false});try{
  const file=join(directory,'server-secrets.json'),before=JSON.parse(await readFile(file,'utf8')),b=await book(service);
  await settings(service.store,{apiKey:'SYNTHETIC_PAIRING_KEY_NOT_REAL',spendEnabled:false},before.encryptionKey);const oldSettings=await config(service.store);
  await service.stop();const token=randomBytes(32).toString('base64url');service=await createCloudService({directory,autoStart:false,controlToken:token});
  const after=JSON.parse(await readFile(file,'utf8'));assert.equal(after.serverId,before.serverId);assert.equal(after.encryptionKey,before.encryptionKey);assert.equal(after.controlToken,token);assert.equal((await service.store.get(b.id)).title,b.title);assert.equal((await config(service.store)).apiKeyEncrypted,oldSettings.apiKeyEncrypted);assert.equal((await stat(file)).mode&0o777,0o600);
  const a=await service.listen(0),url='http://127.0.0.1:'+a.port+'/api/status';assert.equal((await fetch(url,{headers:{Authorization:'Bearer '+before.controlToken,Connection:'close'}})).status,401);assert.equal((await fetch(url,{headers:{Authorization:'Bearer '+token,Connection:'close'}})).status,200);
}finally{await service.stop();await rm(directory,{recursive:true,force:true});}});
test('无效部署凭证不覆盖保险箱，失败后执行器租约释放',async()=>{const directory=await mkdtemp(join(tmpdir(),'novel-cloud-invalid-token-'));let service=await createCloudService({directory,autoStart:false});await service.stop();try{
  const file=join(directory,'server-secrets.json'),before=await readFile(file,'utf8');await assert.rejects(createCloudService({directory,autoStart:false,controlToken:'SYNTHETIC_INVALID'}),/连接凭证格式无效/);assert.equal(await readFile(file,'utf8'),before);service=await createCloudService({directory,autoStart:false});
}finally{await service.stop();await rm(directory,{recursive:true,force:true});}});
test('第二执行器无法在失去独占租约时修改连接凭证',async()=>{const x=await setup();try{
  const file=join(x.directory,'server-secrets.json'),before=await readFile(file,'utf8');await assert.rejects(createCloudService({directory:x.directory,autoStart:false,controlToken:randomBytes(32).toString('base64url')}),/已有运行中的/);assert.equal(await readFile(file,'utf8'),before);
}finally{await x.cleanup();}});
test('移除部署凭证配置后沿用持久凭证，API不泄露凭证',async()=>{const directory=await mkdtemp(join(tmpdir(),'novel-cloud-persist-token-')),token=randomBytes(32).toString('base64url');let service=await createCloudService({directory,autoStart:false,controlToken:token});try{
  await service.stop();service=await createCloudService({directory,autoStart:false});const headers={Authorization:'Bearer '+token,'X-Novel-Server-Id':service.serverId};const r=await service.dispatch(new Request('https://cloud.example/api/workspace',{headers}));assert.equal(r.status,200);const raw=await r.text();assert.equal(raw.includes(token),false);assert.equal(JSON.parse(raw).settings.spendEnabled,false);
}finally{await service.stop();await rm(directory,{recursive:true,force:true});}});

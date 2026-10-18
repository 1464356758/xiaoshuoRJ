// SYNTHETIC protocol tests. No real model, manuscript, API key or signing verdict.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {Store} from '../lib/store.mjs';
import {createBook,settings,config,step} from '../lib/engine.mjs';
import {modelCall} from '../lib/model.mjs';
import {startJob,jobActive} from '../lib/jobs.mjs';
import {craftFixture} from './craft-support.mjs';
import {nativeDatabase,translateSql,projectedWrite} from '../android-standalone/runtime/database.mjs';
import {recoverDevice,installDevice,createNativeTransport} from '../android-standalone/runtime/device.mjs';
import {adaptRoute,adaptWorkspace} from '../android-standalone/runtime/adapt-source.mjs';
import {esbuild} from '../android-standalone/runtime/build-deps.mjs';

const secret=btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
function bridge(){
  const conn=new DatabaseSync(':memory:');conn.exec(readFileSync(new URL('../drizzle/0000_rare_tenebrous.sql',import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
  for(const table of ['records','calls'])for(const [name,type]of [['nf_lease_until','INTEGER'],['nf_spend_enabled','INTEGER'],['nf_chapter','INTEGER'],['nf_status','TEXT']])conn.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  return {conn,running:false,starts:0,httpCount:0,failProjection:false,
    database(raw){try{const x=JSON.parse(raw),q=conn.prepare(x.sql);if(x.mode==='all')return JSON.stringify({rows:q.all(...x.args).map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>!k.startsWith('nf_'))))});
      conn.exec('BEGIN');try{const r=q.run(...x.args);if(r.changes&&x.after){if(this.failProjection)throw new Error('SYNTHETIC interrupted projection');conn.prepare(`UPDATE ${x.after.table} SET nf_lease_until=?,nf_spend_enabled=?,nf_chapter=?,nf_status=? WHERE id=?`).run(...x.after.values,x.after.id);}conn.exec('COMMIT');return JSON.stringify({changes:Number(r.changes)});}catch(e){conn.exec('ROLLBACK');throw e;}
    }catch(e){return JSON.stringify({error:e.message});}},
    runtimeSecret(){return secret;},deviceInfo(){return JSON.stringify({running:this.running,requiresChatGPT:false});},startRunner(){this.starts++;this.running=true;return true;},stopRunner(){this.running=false;},isRunning(){return this.running;},runnerState(){},http(){this.httpCount++;},cancelHttp(){}
  };
}
function fresh(){const native=bridge(),db=nativeDatabase(native);return {native,db,store:new Store(db,'android-personal')};}
async function configured(store,extra={}){await settings(store,{apiKey:'SYNTHETIC ONLY / not a usable key',inputPrice:1,outputPrice:1,spendEnabled:true,bookLimit:100,monthLimit:100,taskLimit:2,...extra},secret);}
async function book(store,total=3){const b=await createBook(store,{title:'SYNTHETIC ONLY / device protocol',targetWords:1000,totalChapters:total,budget:20},crypto.randomUUID());return store.save(b,{...b,singleCallProtocol:0});}
const routeSource=readFileSync(new URL('../app/api/workspace/route.ts',import.meta.url),'utf8');
const compiled=await esbuild.transform(adaptRoute(routeSource).replaceAll('@/lib/',new URL('../lib/',import.meta.url).href),{loader:'ts',format:'esm'});
const route=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));

test('本机兼容层保留别名条件；拒绝未登记的JSON字段',()=>{
  assert.equal(translateSql("COALESCE(json_extract(other.data,'$.lease.until'),0)>?"),'COALESCE(other.nf_lease_until,0)>?');
  assert.throws(()=>translateSql("json_extract(data,'$.futureUnknown')"),/尚不支持/);
});
test('本机SQLite的租约和CAS仍是原子保护',async()=>{
  const {store,native}=fresh(),b=await book(store),claimed=await store.claimLease(b);
  assert.ok(native.conn.prepare('SELECT nf_lease_until FROM records WHERE id=?').get(b.id).nf_lease_until>Date.now());
  await assert.rejects(store.claimLease(b),/正在执行|版本/);await assert.rejects(store.save(b,{...b,title:'STALE'}),/更新/);
  assert.equal((await store.get(b.id)).lease.token,claimed.lease.token);
});
test('本机投影更新失败会回滚原文与revision',async()=>{
  const {store,native}=fresh(),b=await book(store);native.failProjection=true;
  await assert.rejects(store.save(b,{...b,title:'SHOULD NOT SAVE'}),/interrupted/);native.failProjection=false;
  const after=await store.get(b.id);assert.equal(after.title,b.title);assert.equal(after.revision,b.revision);
});
test('账单章节投影与费用授权用于同一条预算预留',async()=>{
  const {store,native}=fresh();await configured(store,{chapterLimit:0});const b=await book(store);let requests=0;
  await assert.rejects(modelCall(store,await config(store),{...b,activeChapter:1},'SYNTHETIC prompt','write',secret,async()=>{requests++;}),/额度不足/);
  assert.equal(requests,0);assert.equal((await store.cost(b.id)).calls.length,0);
  await settings(store,{chapterLimit:2},secret);
  const out=await modelCall(store,await config(store),{...b,activeChapter:1},'SYNTHETIC prompt','write',secret,async()=>{requests++;return Response.json({choices:[{message:{content:'{"text":"SYNTHETIC"}'},finish_reason:'stop'}],usage:{prompt_tokens:20,completion_tokens:10}});});
  assert.equal(out.text,'SYNTHETIC');assert.equal(requests,1);assert.equal(native.conn.prepare('SELECT nf_chapter FROM calls').get().nf_chapter,1);assert.equal((await store.cost(b.id)).calls[0].status,'settled');
});
test('关闭费用授权后本机不会向模型发请求',async()=>{
  const {store}=fresh();await configured(store);const b=await book(store);await settings(store,{spendEnabled:false},secret);let calls=0;
  await assert.rejects(modelCall(store,await config(store),b,'SYNTHETIC','write',secret,async()=>{calls++;}),/尚未开启/);assert.equal(calls,0);
});
test('本机数据库跑通三章新协议、锁定与联合审核',async()=>{
  const {store}=fresh();await configured(store);const b=await book(store);
  for(let i=0;i<35;i++){const r=await step(store,b.id,secret,craftFixture);if(r.phase==='complete')break;}
  assert.equal((await store.list('chapter',b.id)).filter(c=>c.status==='locked').length,3);
  assert.equal((await store.get(b.id+':opening')).pass,true);
});
test('本机十章总审未过时不会创建第11章',async()=>{
  const {store}=fresh();await configured(store);const b=await book(store,11);
  const invoke=async(...a)=>a[4]==='arc_review'?{...(await craftFixture(...a)),pass:false,issues:[{severity:'major',message:'SYNTHETIC stage failure'}]}:craftFixture(...a);
  let stopped=false;for(let i=0;i<110;i++){try{const r=await step(store,b.id,secret,invoke);if(r.blocked){stopped=true;break;}}catch(e){if(!/阶段审核未通过/.test(e.message))throw e;stopped=true;break;}}
  assert.equal(stopped,true);assert.equal((await store.list('chapter',b.id)).some(c=>c.number===11),false);
});
test('进程恢复不重放未知收费请求，保留定稿与当前片段',async()=>{
  const {store}=fresh();await configured(store);const b=await book(store);await step(store,b.id,secret,craftFixture);await step(store,b.id,secret,craftFixture);
  const chapter=(await store.list('chapter',b.id))[0];await startJob(store,b.id,3);
  await store.db.prepare('INSERT INTO calls (id,owner,book,month,amount,status,data,created) VALUES (?,?,?,?,?,?,?,?)').bind('SYNTHETIC_CALL',store.owner,b.id,'2026-10',100,'reserved','{}',Date.now()).run();
  assert.equal(await recoverDevice(store),1);assert.equal(jobActive(await store.get(b.id+':job')),false);assert.equal((await store.cost(b.id)).calls[0].status,'uncertain');assert.equal((await store.get(chapter.id)).content,chapter.content);
});
test('API适配只替换运行边界，配置不回传保险箱或Key',async()=>{
  const {store}=fresh();await configured(store);globalThis.__novelAppResources=()=>({store,secret,runnerEnabled:true});
  const r=await route.GET(new Request('https://appassets.androidplatform.net/api/workspace'));assert.equal(r.status,200);const x=await r.json();assert.equal(x.settings.hasKey,true);assert.equal('apiKeyEncrypted'in x.settings,false);assert.equal(JSON.stringify(x).includes(secret),false);
  const nativeSource=adaptWorkspace(readFileSync(new URL('../app/workspace.tsx',import.meta.url),'utf8'));assert.equal(nativeSource.includes("navigator.serviceWorker.register('/sw.js')"),false);
});
async function deviceTest(fn){const native=bridge(),originalFetch=globalThis.fetch,originalLocation=globalThis.location;globalThis.location=new URL('https://appassets.androidplatform.net/assets/index.html');try{const device=await installDevice(native,route);await fn(native,device);}finally{globalThis.fetch=originalFetch;globalThis.location=originalLocation;delete globalThis.__novelAppResources;delete globalThis.__novelTick;delete globalThis.__novelPauseAll;}}
test('安装后启动不联网、不开费、也不自动运行',async()=>deviceTest(async(native,{store})=>{
  assert.equal(native.httpCount,0);assert.equal(native.starts,0);assert.equal((await config(store)).spendEnabled,false);
  const r=await fetch('/api/device'),x=await r.json();assert.equal(x.requiresChatGPT,false);
}));
test('本人启动目标后才启动原生服务，暂停后不再推进',async()=>deviceTest(async(native,{store})=>{
  await configured(store);const b=await book(store);
  const r=await fetch('/api/workspace',{method:'POST',body:JSON.stringify({action:'startJob',id:b.id,target:3})});assert.equal(r.status,200);assert.equal(native.starts,1);assert.equal(native.httpCount,0);
  const p=await fetch('/api/workspace',{method:'POST',body:JSON.stringify({action:'pause',id:b.id})});assert.equal(p.status,200);assert.equal(native.running,false);await globalThis.__novelTick();assert.equal(native.httpCount,0);
}));
test('原生启动失败会暂停刚登记的任务',async()=>deviceTest(async(native,{store})=>{
  native.startRunner=()=>false;await configured(store);const b=await book(store),r=await fetch('/api/workspace',{method:'POST',body:JSON.stringify({action:'startJob',id:b.id,target:3})});assert.equal(r.status,400);assert.equal((await store.get(b.id+':job')).status,'paused');
}));
test('传输中断不自动重发，并丢弃迟到响应',async()=>{
  let count=0,id,cancels=0;const transport=createNativeTransport({http(value){count++;id=value;},cancelHttp(){cancels++;}}),controller=new AbortController(),request=transport('https://api.deepseek.com/v1/chat/completions',{method:'POST',signal:controller.signal});controller.abort();await assert.rejects(request,/中断/);globalThis.__novelHttpResult(id,JSON.stringify({status:200,body:'{}'}));assert.equal(count,1);assert.equal(cancels,1);
});
test('原生接口异常返回会立即失败，不留下悬挂请求',async()=>{
  const transport=createNativeTransport({http(id){queueMicrotask(()=>globalThis.__novelHttpResult(id,JSON.stringify({status:999,body:'INVALID'})));},cancelHttp(){}});await assert.rejects(transport('https://api.deepseek.com/user/balance'),/格式异常/);
});

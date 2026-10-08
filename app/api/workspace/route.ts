import {env} from 'cloudflare:workers';
import {Store} from '@/lib/store.mjs';
import {snapshot,createBook,settings,step,saveChapter,unlockChapter,reviseChapter,exportBook,savePlan,testConnection,setBookBudget} from '@/lib/engine.mjs';
import {startJob,pauseJob,runJobStep,runnerStatus} from '@/lib/jobs.mjs';
import {hash} from '@/lib/store.mjs';
import {restoreBackup} from '@/lib/backup.mjs';
export const dynamic='force-dynamic';
function resources(request:Request) {
  const e=env as unknown as Record<string,any>;
  let owner=request.headers.get('oai-authenticated-user-id');
  if(!owner&&e.LOCAL_DEV==='1'&&['terminal.local','127.0.0.1','localhost'].includes(new URL(request.url).hostname))owner='local-developer';
  if(!owner)throw new Error('请登录后使用私有工作台');
  if(!e.DB)throw new Error('数据库暂不可用，请稍后重试');return {store:new Store(e.DB,owner),secret:e.DATA_ENCRYPTION_KEY,runnerEnabled:e.CLOUD_RUNNER_ENABLED==='1'};
}
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(request:Request) {
  try {
    const {store,runnerEnabled}=resources(request),q=new URL(request.url).searchParams;
    if(q.get('planVersions'))return reply({versions:await store.list('planVersion',q.get('planVersions'))});
    if(q.get('chapter')) {const c=await store.get(q.get('chapter'));if(!c||c.kind!=='chapter')return reply({error:'章节不存在'},404);return reply({chapter:c,versions:await store.list('version',c.parent)});}
    if(q.get('export'))return new Response(await exportBook(store,q.get('export'),q.get('draft')==='1'),{headers:{'Content-Type':'text/plain;charset=utf-8','Content-Disposition':'attachment; filename="novel.txt"','Cache-Control':'no-store'}});
    if(q.get('backup')) {const id=q.get('backup');const book=await store.get(id);if(!book||book.kind!=='book')return reply({error:'作品不存在'},404);const cs=await store.list('chapter',id);return reply({format:'novel-factory-backup-v1',book,chapters:cs,versions:await store.list('version',id),planVersions:await store.list('planVersion',id),audits:await store.list('audit',id),exportedAt:new Date().toISOString()});}
    return reply({...await snapshot(store,q.get('book')),runner:{...await runnerStatus(store.db),enabled:runnerEnabled}});
  }catch(e:any){return reply({error:e.message},e.message.includes('登录')?401:503);}
}
export async function POST(request:Request) {
  try {
    const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return reply({error:'请求来源不匹配'},403);
    if(Number(request.headers.get('content-length')||0)>16000000)return reply({error:'请求过大'},413);
    const {store,secret,runnerEnabled}=resources(request);const x:any=await request.json();if(JSON.stringify(x).length>16000000)throw new Error('请求过大');let result;
    if(x.action==='create')result=await createBook(store,x.input,x.key);
    else if(x.action==='settings')result=await settings(store,x.input,secret);
    else if(x.action==='step')result=await step(store,x.id,secret);
    else if(x.action==='startJob'){if(!runnerEnabled)throw new Error('云端调度尚未启用，请联系维护者');result=await startJob(store,x.id,x.target);}
    else if(x.action==='runJob')result=await runJobStep(store,x.id,secret);
    else if(x.action==='plan')result=await savePlan(store,x.input);
    else if(x.action==='bookBudget')result=await setBookBudget(store,x.input);
    else if(x.action==='testConnection')result=await testConnection(store,secret);
    else if(x.action==='save')result=await saveChapter(store,x.input);
    else if(x.action==='unlock')result=await unlockChapter(store,x.id);
    else if(x.action==='revise')result=await reviseChapter(store,x.input,secret);
    else if(x.action==='pause')result=await pauseJob(store,x.id);
    else if(x.action==='resume') {const b=await store.get(x.id);if(!b||b.kind!=='book')throw new Error('作品不存在');result=await store.save(b,{...b,status:b.plan?'ready':'planning'});}
    else if(['submission','income','expense','rule'].includes(x.action)) {
      const d=x.input;if(x.action==='submission'){const b=await store.get(d.bookId);if(!b)throw new Error('作品不存在');if((await store.list('submission')).some((s:any)=>s.bookId===d.bookId&&s.exclusive&&s.status==='signed'&&s.platform!==d.platform))throw new Error('已有独家签约记录，禁止登记其他平台新投稿');if(!['draft','submitted','rejected','signed','revising'].includes(d.status))throw new Error('投稿状态无效');}
      if(['income','expense'].includes(x.action)){if(!Number.isFinite(d.amount)||d.amount<0||d.amount>1e8)throw new Error('金额无效');if(x.action==='income'&&!['estimated','conditional','confirmed','received'].includes(d.status))throw new Error('收入状态无效');}
      if(x.action==='rule'){if(!/^https:\/\//.test(d.source||'')||!['unknown','allowed','restricted','prohibited'].includes(d.aiPolicy))throw new Error('规则需要来源链接和有效AI政策状态');if(!d.checkedAt)throw new Error('需要核验日期');}
      const old=x.id?await store.get(x.id):null;if(x.id&&(!old||old.kind!==x.action))throw new Error('记录不存在');result=old?await store.save(old,d):await store.create(x.action,{...d,created:new Date().toISOString()},d.bookId||'');
    } else if(x.action==='restore') {
      result=await restoreBackup(store,x.input,x.key);
    } else throw new Error('不支持的操作');
    return reply({result});
  }catch(e:any){return reply({error:e.message},e.message.includes('登录')?401:400);}
}

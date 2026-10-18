import {env} from 'cloudflare:workers';
import {forkRevision} from '@/lib/revisions.mjs';
import {repositoryAssistant} from '@/lib/model.mjs';
import {config} from '@/lib/engine.mjs';
import {useDeepseekWriter} from '@/lib/writer-preference.mjs';
import {Store} from '@/lib/store.mjs';
import {snapshot,adoptPlatformRules,createBook,settings,step,saveChapter,unlockChapter,reviseChapter,exportBook,savePlan,testConnection,setBookBudget,openingAudit,acceptRepairCandidate,acceptReviewCandidate} from '@/lib/engine.mjs';
import {startJob,pauseJob,runJobStep,runnerStatus} from '@/lib/jobs.mjs';
import {hash} from '@/lib/store.mjs';
import {restoreBackup} from '@/lib/backup.mjs';
import {submissionPacket,officialRuleSource,policyVerified} from '@/lib/acceptance.mjs';
import {styleWorkbench,saveStyleReference,archiveStyleReference,createStyleTask,stepStyleTask,pauseStyleTask,activateStyle} from '@/lib/style-workbench.mjs';
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
    if(q.get('style'))return reply(await styleWorkbench(store,q.get('style')));
    if(q.get('submissionPacket')) {const id=q.get('submissionPacket'),state=await snapshot(store,id),b=await store.get(id);if(!b||b.kind!=='book')throw new Error('作品不存在');const p=state.platforms.find((p:any)=>p.name===b.platform);return new Response(await submissionPacket(b,await store.list('chapter',id),await store.get(id+':opening'),p),{headers:{'Content-Type':'text/plain;charset=utf-8','Content-Disposition':'attachment; filename="submission.txt"','Cache-Control':'no-store'}});}
    if(q.get('planVersions'))return reply({versions:await store.list('planVersion',q.get('planVersions'))});
    if(q.get('chapter')) {const c=await store.get(q.get('chapter'));if(!c||c.kind!=='chapter')return reply({error:'章节不存在'},404);return reply({chapter:c,versions:await store.list('version',c.parent)});}
    if(q.get('export'))return new Response(await exportBook(store,q.get('export'),q.get('draft')==='1'),{headers:{'Content-Type':'text/plain;charset=utf-8','Content-Disposition':'attachment; filename="novel.txt"','Cache-Control':'no-store'}});
    if(q.get('backup')) {const id=q.get('backup');const book=await store.get(id);if(!book||book.kind!=='book')return reply({error:'作品不存在'},404);const cs=await store.list('chapter',id);return reply({format:'novel-factory-backup-v1',book,chapters:cs,versions:await store.list('version',id),planVersions:await store.list('planVersion',id),audits:await store.list('audit',id),styleReferences:await store.list('styleReference',id),styleProfiles:await store.list('styleProfile',id),styleTasks:await store.list('styleTask',id),exportedAt:new Date().toISOString()});}
    return reply({...await snapshot(store,q.get('book')),runner:{...await runnerStatus(store.db),enabled:runnerEnabled}});
  }catch(e:any){return reply({error:e.message},e.message.includes('登录')?401:503);}
}
export async function POST(request:Request) {
  try {
    const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return reply({error:'请求来源不匹配'},403);
    if(Number(request.headers.get('content-length')||0)>16000000)return reply({error:'请求过大'},413);
    const {store,secret,runnerEnabled}=resources(request);const x:any=await request.json();if(JSON.stringify(x).length>16000000)throw new Error('请求过大');let result;
    if(x.action==='create')result=await createBook(store,x.input,x.key);
    else if(x.action==='styleReference')result=await saveStyleReference(store,x.id,x.input);
    else if(x.action==='styleArchive')result=await archiveStyleReference(store,x.id,x.key,x.archived);
    else if(x.action==='styleTaskCreate')result=await createStyleTask(store,x.id,x.input);
    else if(x.action==='styleTaskStep')result=await stepStyleTask(store,x.id,x.key,secret);
    else if(x.action==='styleTaskPause')result=await pauseStyleTask(store,x.id,x.key);
    else if(x.action==='styleActivate')result=await activateStyle(store,x.id,x.input);
    else if(x.action==='settings')result=await settings(store,x.input,secret);
    else if(x.action==='useDeepseekWriter')result=await useDeepseekWriter(store);
    else if(x.action==='step')result=await step(store,x.id,secret);
    else if(x.action==='acceptRepairCandidate')result=await acceptRepairCandidate(store,x.id);
    else if(x.action==='acceptReviewCandidate')result=await acceptReviewCandidate(store,x.id);
    else if(x.action==='startJob'){if(!runnerEnabled)throw new Error('云端调度尚未启用，请联系维护者');result=await startJob(store,x.id,x.target);}
    else if(x.action==='runJob')result=await runJobStep(store,x.id,secret);
    else if(x.action==='plan')result=await savePlan(store,x.input);
    else if(x.action==='bookBudget')result=await setBookBudget(store,x.input);
    else if(x.action==='forkRevision')result=await forkRevision(store,x.id,x.fromChapter,x.key,{preserveDraft:x.preserveDraft});
    else if(x.action==='adoptPlatformRules')result=await adoptPlatformRules(store,x.input);
    else if(x.action==='githubAssist'){const c=await config(store);let b=x.id?await store.get(x.id):null;if(b&&b.kind!=='book')throw new Error('作品不存在');if(x.id&&!b)throw new Error('作品不存在');b ||= {id:store.owner+':repository-assistant',budget:Math.min(c.bookLimit,c.taskLimit)};result=await repositoryAssistant(store,c,b,x.question,secret);}
    else if(x.action==='openingAudit')result=await openingAudit(store,x.id,secret);
    else if(x.action==='testConnection')result=await testConnection(store,secret,undefined,x.role||'planner');
    else if(x.action==='save')result=await saveChapter(store,x.input);
    else if(x.action==='unlock')result=await unlockChapter(store,x.id);
    else if(x.action==='revise')result=await reviseChapter(store,x.input,secret);
    else if(x.action==='pause')result=await pauseJob(store,x.id);
    else if(x.action==='resume') {const b=await store.get(x.id);if(!b||b.kind!=='book')throw new Error('作品不存在');if(b.restoreComplete===false)throw new Error('请先完成备份恢复');if(b.revisionComplete===false)throw new Error('修订副本建立尚未完成，请从原作品重新建立副本');result=await store.save(b,{...b,status:b.plan?'ready':'planning'});}
    else if(['submission','income','expense','rule'].includes(x.action)) {
      const d=x.input;if(x.action==='submission'){const b=await store.get(d.bookId);if(!b)throw new Error('作品不存在');if((await store.list('submission')).some((s:any)=>s.bookId===d.bookId&&s.exclusive&&s.status==='signed'&&s.platform!==d.platform))throw new Error('已有独家签约记录，禁止登记其他平台新投稿');if(!['draft','submitted','rejected','signed','revising'].includes(d.status))throw new Error('投稿状态无效');if(d.status==='signed'&&d.contractType==='guarantee'&&(!Number.isFinite(d.guaranteeRate)||d.guaranteeRate<=0||!d.contractEvidence||d.contractEvidence.trim().length<10))throw new Error('保底签约记录需录入有效单价及合同依据');}
      if(['income','expense'].includes(x.action)){if(!Number.isFinite(d.amount)||d.amount<0||d.amount>1e8)throw new Error('金额无效');if(x.action==='income'&&!['estimated','conditional','confirmed','received'].includes(d.status))throw new Error('收入状态无效');if(x.action==='income'&&['confirmed','received'].includes(d.status)&&(!d.evidence||d.evidence.trim().length<5))throw new Error('平台确认或到账收入需要真实依据');}
      if(x.action==='rule'){if(!/^https:\/\//.test(d.source||'')||!['unknown','allowed','restricted','prohibited'].includes(d.aiPolicy))throw new Error('规则需要来源链接和有效AI政策状态');if(!d.checkedAt||!Number.isFinite(Date.parse(d.checkedAt)))throw new Error('需要有效核验日期');if(!officialRuleSource(d.platform||d.name,d.source))throw new Error('请使用该平台官方域名的政策原文');if(d.aiPolicy==='allowed'&&!policyVerified({...d,name:d.platform||d.name}))throw new Error('允许本创作方式需要30天内官方原文依据和本人核验确认');}
      const old=x.id?await store.get(x.id):null;if(x.id&&(!old||old.kind!==x.action))throw new Error('记录不存在');result=old?await store.save(old,d):await store.create(x.action,{...d,created:new Date().toISOString()},d.bookId||'');
    } else if(x.action==='restore') {
      result=await restoreBackup(store,x.input,x.key);
    } else throw new Error('不支持的操作');
    return reply({result});
  }catch(e:any){return reply({error:e.message},e.message.includes('登录')?401:400);}
}

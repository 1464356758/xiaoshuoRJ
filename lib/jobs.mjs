import {Store} from './store.mjs';
import {config,step} from './engine.mjs';
import {modelCall,validateConfig} from './model.mjs';

export const RUNNER_OWNER='__novel_cloud_runner__';
const activeStatuses=['queued','running','waiting'];
export const jobActive=j=>!!j&&activeStatuses.includes(j.status);
export function publicJob(j) {if(!j)return null;const {lease,...safe}=j;return {...safe,leaseUntil:lease?.until||null};}
export async function runnerStatus(db) {const s=new Store(db,RUNNER_OWNER);return await s.get('runner:heartbeat')||{lastTick:null,ticks:0};}
async function heartbeat(db,details) {
  const s=new Store(db,RUNNER_OWNER),old=await s.get('runner:heartbeat');
  const next={lastTick:new Date().toISOString(),ticks:(old?.ticks||0)+1,...details};
  try{return old?await s.save(old,next):await s.create('runner',next,'','runner:heartbeat');}catch{return runnerStatus(db);}
}
async function preflight(store,b) {
  const c=validateConfig(await config(store));
  if(!c.spendEnabled||!c.apiKeyEncrypted||c.inputPrice===null||c.outputPrice===null)throw new Error('请先保存模型、已核实单价和API密钥，并开启费用调用');
  if(!b.budget||!c.bookLimit||!c.monthLimit||!c.taskLimit)throw new Error('费用上限为0，不能启动云端创作');return c;
}
export async function startJob(store,id,target) {
  let b=await store.get(id);if(!b||b.kind!=='book')throw new Error('作品不存在');
  if(!Number.isInteger(target)||target<1||target>b.totalChapters)throw new Error('云端目标章节超出范围');
  const cfg=await preflight(store,b),cs=await store.list('chapter',id);
  const completed=cs.filter(c=>c.status==='locked').length;
  if(target<=completed)throw new Error('目标章节已经完成');
  if(cs.some(c=>c.status==='blocked'))throw new Error('当前章节审核已阻塞，请先诊断或修订后重新审核');
  const old=await store.get(id+':job');
  if(jobActive(old))return publicJob(old); // Repeated starts never reset an in-flight lease.
  if(old?.lease?.until>Date.now())throw new Error('此前调用仍在完成检查点，请稍后再启动');
  if(b.status==='paused'||b.status==='blocked')b=await store.save(b,{...b,status:b.plan?'ready':'planning',error:null});
  const data={bookId:id,status:'queued',targetChapters:target,completedAt:null,createdAt:old?.createdAt||new Date().toISOString(),startedAt:new Date().toISOString(),lastRunAt:old?.lastRunAt||null,nextRunAt:0,steps:old?.steps||0,lastPhase:old?.lastPhase||null,error:null,lease:null,configRevision:cfg.revision,provider:cfg.provider,model:cfg.model,planRevision:b.planRevision||1};
  const j=old?await store.save(old,data):await store.create('job',data,id,id+':job');
  await store.log(id,`云端任务已登记：推进至第${target}章；关闭页面不会取消任务`);return publicJob(j);
}
export async function pauseJob(store,id) {
  const j=await store.get(id+':job');
  if(j&&jobActive(j))await store.save(j,{...j,status:'paused',error:null});
  const b=await store.get(id);if(!b||b.kind!=='book')throw new Error('作品不存在');
  await store.save(b,{...b,status:'paused'});await store.log(id,'已暂停云端任务；正在执行的请求最多完成当前检查点，不会开始下一次调用');
  return publicJob(await store.get(id+':job'));
}
async function settleJob(store,claimed,patch) {
  const now=await store.get(claimed.id);
  if(now?.lease?.token!==claimed.lease.token)return publicJob(now);
  return publicJob(await store.save(now,{...now,...patch,status:now.status==='paused'?'paused':patch.status||now.status,lease:null}));
}
export async function runJobStep(store,id,secret,invoke=modelCall) {
  let j=await store.get(id+':job');if(!jobActive(j))return {advanced:false,job:publicJob(j),reason:'inactive'};
  if(j.lease?.until>Date.now()||j.nextRunAt>Date.now())return {advanced:false,job:publicJob(j),reason:'waiting'};
  const b=await store.get(id),cs=await store.list('chapter',id);
  if(!b||b.status==='paused'||b.status==='blocked') {j=await store.save(j,{...j,status:'paused',lease:null});return {advanced:false,job:publicJob(j),reason:'paused'};}
  const locked=cs.filter(c=>c.status==='locked').length;
  if(locked>=j.targetChapters) {j=await store.save(j,{...j,status:'completed',completedAt:new Date().toISOString(),lease:null});return {advanced:false,job:publicJob(j),reason:'complete'};}
  const cfg=await config(store);
  if(cfg.revision!==j.configRevision||(b.planRevision||1)!==j.planRevision) {
    j=await store.save(j,{...j,status:'blocked',error:'模型配置或大纲已变化，请检查后重新启动云端任务',lease:null});return {advanced:false,job:publicJob(j),reason:'changed'};
  }
  const busyUntil=Math.max(b.lease?.until||0,...cs.map(c=>c.lease?.until||0));
  if(busyUntil>Date.now()){j=await store.save(j,{...j,status:'waiting',nextRunAt:busyUntil+500,lease:null});return {advanced:false,job:publicJob(j),reason:'checkpoint_busy'};}
  try{j=await store.save(j,{...j,status:'running',lease:{token:crypto.randomUUID(),until:Date.now()+135000},lastRunAt:new Date().toISOString(),nextRunAt:0,error:null});}
  catch{return {advanced:false,job:publicJob(await store.get(id+':job')),reason:'claimed'};}
  try {
    // Settings can change after the first check; refuse before spending when possible.
    const latest=await config(store);if(latest.revision!==j.configRevision)throw new Error('模型配置已变化，请检查后重新启动云端任务');
    const result=await step(store,id,secret,invoke,{jobToken:j.lease.token});
    const count=(await store.list('chapter',id)).filter(c=>c.status==='locked').length;
    const blocked=result.chapter?.status==='blocked';const complete=count>=j.targetChapters||result.phase==='complete';
    const job=await settleJob(store,j,{status:blocked?'blocked':complete?'completed':'queued',steps:j.steps+1,lastPhase:result.phase,error:blocked?'质量门或故事架构未通过，请先诊断后修订':null,completedAt:complete?new Date().toISOString():null});
    return {advanced:true,phase:result.phase,job};
  } catch(e) {
    const job=await settleJob(store,j,{status:'blocked',error:e.message});
    await store.log(id,'云端任务已停止：'+e.message);return {advanced:false,job,reason:'blocked'};
  }
}
export async function tickRunner(db,secret,invoke=modelCall) {
  // Jobs are created only by their signed-in owners. Service callers cannot select
  // an owner, change targets, edit fiction or submit arbitrary prompts.
  await db.prepare("UPDATE calls SET status='uncertain' WHERE status='reserved' AND created<?").bind(Date.now()-150000).run();
  const rows=await db.prepare("SELECT id,owner,parent FROM records WHERE kind='job' AND json_extract(data,'$.status') IN ('queued','running','waiting') ORDER BY updated ASC LIMIT 100").all();
  let result=null;
  for(const row of rows.results){const s=new Store(db,row.owner),j=await s.get(row.id);if(j.lease?.until>Date.now()||j.nextRunAt>Date.now())continue;result=await runJobStep(s,row.parent,secret,invoke);break;}
  const state=await heartbeat(db,{activeJobs:rows.results.length,advanced:!!result?.advanced});
  return {advanced:!!result?.advanced,phase:result?.phase||null,activeJobs:rows.results.length,lastTick:state.lastTick,stopReason:result?.reason||(!rows.results.length?'idle':'waiting')};
}

import {Store} from './store.mjs';
import {config,step,reviseChapter,assertIdle} from './engine.mjs';
import {modelCall,validateConfig} from './model.mjs';
import {openingFingerprint,pendingArcAudit} from './acceptance.mjs';
import {missingRoles,resolveModel} from './model-routing.mjs';
import {JOB_LEASE_MS,STALE_CALL_MS} from './execution-policy.mjs';
async function openingReady(store,b,cs) {const n=cs.filter(c=>c.status==='locked').length;if(n<3)return true;const a=await store.get(b.id+':opening');if(!a?.pass||a.fingerprint!==await openingFingerprint(b,cs))return false;if(await pendingArcAudit(b,cs,await store.list('audit',b.id))!==null)return false;return true;}

export const RUNNER_OWNER='__novel_cloud_runner__';
const activeStatuses=['queued','running','waiting'];
export const jobActive=j=>!!j&&activeStatuses.includes(j.status);
export function publicJob(j) {if(!j)return null;const {lease,...safe}=j;return {...safe,leaseUntil:lease?.until||null};}
export async function runnerStatus(db) {const s=new Store(db,RUNNER_OWNER);return await s.get('runner:heartbeat')||{lastTick:null,ticks:0};}
async function heartbeat(db,details) {
  const s=new Store(db,RUNNER_OWNER),old=await s.get('runner:heartbeat');
  const next={...old,lastTick:new Date().toISOString(),ticks:(old?.ticks||0)+1,...details};
  try{return old?await s.save(old,next):await s.create('runner',next,'','runner:heartbeat');}catch{return runnerStatus(db);}
}
export const refreshRunnerHeartbeat=db=>heartbeat(db,{});
async function preflight(store,b) {
  const c=validateConfig(await config(store));
  if(!c.spendEnabled||!c.apiKeyEncrypted||c.inputPrice===null||c.outputPrice===null)throw new Error('请先保存模型、已核实单价和API密钥，并开启费用调用');
  const missing=missingRoles(c);if(missing.length)throw new Error('请先保存这些角色的模型、独立密钥和单价：'+missing.join('、'));
  if(!b.budget||!c.bookLimit||!c.monthLimit||!c.taskLimit)throw new Error('费用上限为0，不能启动云端创作');return c;
}
export async function startEditorRevision(store,input) {
  const c=await store.get(input.id);if(!c||c.kind!=='chapter')throw new Error('章节不存在');
  if(typeof input.key!=='string'||!/^[a-zA-Z0-9_-]{12,80}$/.test(input.key))throw new Error('修订请求缺少幂等标识');
  const requestId=c.parent+':editorRevision:'+input.key,prior=await store.get(requestId),old=await store.get(c.parent+':job');
  if(prior&&prior.status!=='queued')return {...publicJob(old),duplicate:true,revisionRequest:{id:prior.id,status:prior.status,error:prior.error||null}};
  if(old?.editorRevision===requestId&&jobActive(old))return publicJob(old);
  await assertIdle(store,c.parent);
  if(c.status==='locked'||!c.content)throw new Error('请选择已有正文且未定稿的章节');
  if(c.hash!==input.baseHash||c.revision!==input.revision)throw new Error('章节已变化，请刷新审核与修改页后提交');
  if(typeof input.instruction!=='string'||input.instruction.length>2000)throw new Error('补充要求最多2000字符');
  const b=await store.get(c.parent);if(!b||b.kind!=='book')throw new Error('作品不存在');const cfg=await preflight(store,b);
  if((await store.list('chapter',b.id)).some(x=>x.number<c.number&&x.status!=='locked'))throw new Error('请先处理最早的未定稿章节');
  const context={chapterId:c.id,baseHash:c.hash,instruction:input.instruction,configRevision:cfg.revision,planRevision:b.planRevision||1,styleRevision:b.styleRevision||0};
  if(prior&&JSON.stringify(context)!==JSON.stringify(Object.fromEntries(Object.keys(context).map(k=>[k,prior[k]]))))throw new Error('同一修订请求的原稿或要求已变化，请刷新后重新发起');
  const request=prior||await store.create('editorRevision',{...context,status:'queued',createdAt:new Date().toISOString()},b.id,requestId);
  if(old?.editorRevision&&old.editorRevision!==requestId){const previous=await store.get(old.editorRevision);if(previous?.status==='queued')await store.save(previous,{...previous,status:'cancelled'});}
  return startJob(store,b.id,Math.max(c.number,old?.targetChapters||Math.min(b.totalChapters,c.number+2)),{editorRevision:request.id});
}
export async function startJob(store,id,target,options={}) {
  let b=await store.get(id);if(!b||b.kind!=='book')throw new Error('作品不存在');
  if(b.restoreComplete===false)throw new Error('备份恢复尚未完成，请先完成恢复');
  if(b.revisionComplete===false)throw new Error('修订副本建立尚未完成，请从原作品重新建立副本');
  if(b.lease?.until>Date.now())throw new Error('作品检查点仍在执行，请等待保存后再启动');
  if((await store.list('styleTask',id)).some(t=>['ready','running'].includes(t.status)))throw new Error('请先完成或暂停文风实验，再启动正式创作');
  if(!Number.isInteger(target)||target<1||target>b.totalChapters)throw new Error('云端目标章节超出范围');
  const cfg=await preflight(store,b),cs=await store.list('chapter',id);
  const completed=cs.filter(c=>c.status==='locked').length;
  if(target<=completed&&await openingReady(store,b,cs))throw new Error('目标章节已经完成');
  const old=await store.get(id+':job');
  if(jobActive(old))return publicJob(old); // Repeated starts never reset an in-flight lease.
  if(old?.lease?.until>Date.now())throw new Error('此前调用仍在完成检查点，请稍后再启动');
  const editorRevision=options.editorRevision||old?.editorRevision||null,revision=editorRevision?await store.get(editorRevision):null;
  if(editorRevision&&(!revision||revision.kind!=='editorRevision'||revision.parent!==id||revision.status!=='queued'||revision.configRevision!==cfg.revision||revision.planRevision!==(b.planRevision||1)||revision.styleRevision!==(b.styleRevision||0)||!cs.some(c=>c.id===revision.chapterId&&c.hash===revision.baseHash&&c.status!=='locked')))throw new Error('修订请求已执行或原稿、配置已变化，请刷新查看结果；不会重复调用模型');
  if(cs.some(c=>c.status==='blocked'&&c.id!==revision?.chapterId))throw new Error('当前章节审核已阻塞，请打开“审核与修改”，按意见修订后复审');
  if(b.status==='paused'||b.status==='blocked')b=await store.save(b,{...b,status:b.plan?'ready':'planning',error:null});
  const roles=Object.fromEntries(['writer','review'].map(slot=>{const r=resolveModel(cfg,slot==='writer'?'write':'review');return [slot,{provider:r.provider,model:r.model}];}));
  const data={bookId:id,status:'queued',targetChapters:target,editorRevision,completedAt:null,createdAt:old?.createdAt||new Date().toISOString(),startedAt:new Date().toISOString(),lastRunAt:old?.lastRunAt||null,nextRunAt:0,steps:old?.steps||0,lastPhase:old?.lastPhase||null,error:null,lease:null,configRevision:cfg.revision,provider:cfg.provider,model:cfg.model,roles,planRevision:b.planRevision||1,styleRevision:b.styleRevision||0};
  const j=old?await store.save(old,data):await store.create('job',data,id,id+':job');
  await store.log(id,`云端任务已登记：推进至第${target}章；关闭页面不会取消任务`);return publicJob(j);
}
export async function pauseJob(store,id) {
  const j=await store.get(id+':job');
  if(j&&jobActive(j))await store.save(j,{...j,status:'paused',error:null});
  const b=await store.get(id);if(!b||b.kind!=='book')throw new Error('作品不存在');
  for(const t of await store.list('styleTask',id))if(['ready','running'].includes(t.status))await store.save(t,{...t,status:'paused'});
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
  if(locked>=j.targetChapters&&await openingReady(store,b,cs)) {j=await store.save(j,{...j,status:'completed',completedAt:new Date().toISOString(),lease:null});return {advanced:false,job:publicJob(j),reason:'complete'};}
  const cfg=await config(store);
  if(cfg.revision!==j.configRevision||(b.planRevision||1)!==j.planRevision||(b.styleRevision||0)!==(j.styleRevision||0)) {
    j=await store.save(j,{...j,status:'blocked',error:'模型配置、大纲或文风已变化，请检查后重新启动云端任务',lease:null});return {advanced:false,job:publicJob(j),reason:'changed'};
  }
  const busyUntil=Math.max(b.lease?.until||0,...cs.map(c=>c.lease?.until||0));
  if(busyUntil>Date.now()){j=await store.save(j,{...j,status:'waiting',nextRunAt:busyUntil+500,lease:null});return {advanced:false,job:publicJob(j),reason:'checkpoint_busy'};}
  try{j=await store.save(j,{...j,status:'running',lease:{token:crypto.randomUUID(),until:Date.now()+JOB_LEASE_MS},lastRunAt:new Date().toISOString(),nextRunAt:0,error:null});}
  catch{return {advanced:false,job:publicJob(await store.get(id+':job')),reason:'claimed'};}
  let editorial;
  try {
    // Settings can change after the first check; refuse before spending when possible.
    const latest=await config(store);if(latest.revision!==j.configRevision)throw new Error('模型配置已变化，请检查后重新启动云端任务');
    let result;
    if(j.editorRevision){
      editorial=await store.get(j.editorRevision);
      if(!editorial||editorial.kind!=='editorRevision'||editorial.parent!==id||editorial.status!=='queued')throw new Error('修订请求已处理，停止重复调用');
      editorial=await store.save(editorial,{...editorial,status:'running',startedAt:new Date().toISOString()});
      const chapter=await reviseChapter(store,{id:editorial.chapterId,baseHash:editorial.baseHash,instruction:editorial.instruction},secret,invoke,{jobToken:j.lease.token,requestId:editorial.id});
      await store.save(editorial,{...editorial,status:'completed',resultHash:chapter.hash,completedAt:new Date().toISOString()});
      result={phase:'editor_revision',chapter};
    }else result=await step(store,id,secret,invoke,{jobToken:j.lease.token});
    const count=(await store.list('chapter',id)).filter(c=>c.status==='locked').length;
    const blocked=result.blocked||result.chapter?.status==='blocked';const complete=(count>=j.targetChapters&&await openingReady(store,b,await store.list('chapter',id)))||result.phase==='complete';
    const job=await settleJob(store,j,{status:blocked?'blocked':complete?'completed':'queued',...(editorial?{editorRevision:null}:{}),steps:j.steps+1,lastPhase:result.phase,error:blocked?'质量门或故事架构未通过，请先诊断后修订':null,completedAt:complete?new Date().toISOString():null});
    return {advanced:true,phase:result.phase,job};
  } catch(e) {
    if(editorial?.status==='running'){const record=await store.get(editorial.id);if(record?.status==='running')await store.save(record,{...record,status:'failed',error:e.message,completedAt:new Date().toISOString()});}
    const job=await settleJob(store,j,{status:'blocked',...(editorial?{editorRevision:null}:{}),error:e.message});
    await store.log(id,'云端任务已停止：'+e.message);return {advanced:false,job,reason:'blocked'};
  }
}
export async function tickRunner(db,secret,invoke=modelCall) {
  // Jobs are created only by their signed-in owners. Service callers cannot select
  // an owner, change targets, edit fiction or submit arbitrary prompts.
  await db.prepare("UPDATE calls SET status='uncertain' WHERE status='reserved' AND created<?").bind(Date.now()-STALE_CALL_MS).run();
  const rows=await db.prepare("SELECT id,owner,parent FROM records WHERE kind='job' AND json_extract(data,'$.status') IN ('queued','running','waiting') ORDER BY updated ASC LIMIT 100").all();
  let result=null;
  for(const row of rows.results){const s=new Store(db,row.owner),j=await s.get(row.id);if(j.lease?.until>Date.now()||j.nextRunAt>Date.now())continue;result=await runJobStep(s,row.parent,secret,invoke);break;}
  const state=await heartbeat(db,{activeJobs:rows.results.length,advanced:!!result?.advanced});
  return {advanced:!!result?.advanced,phase:result?.phase||null,activeJobs:rows.results.length,lastTick:state.lastTick,stopReason:result?.reason||(!rows.results.length?'idle':'waiting')};
}

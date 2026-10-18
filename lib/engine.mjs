import {styleSignals,styleInstruction} from './style-quality.mjs';
import {hash} from './store.mjs';
import {count,validatePlan,factsFrom,qualityGate,textPreflight,validateReview} from './quality.mjs';
import {defaults,modelCall,validateConfig,seal} from './model.mjs';
import {planningPrompt,contractPrompt,writePrompt,reviewPrompt} from './prompts.mjs';
import {effectivePlatforms,primaryPlatforms,bindPlatform,checkPlatformBinding,platformInstruction} from './platform-policy.mjs';
import {newPlanningDraft,validatePlanningDraft,appendPlanningBatch,planningRange,completedPlan,rollingPlan,draftFromPlan} from './planning.mjs';
import {planningBatchPrompt} from './prompts.mjs';
import {openingFingerprint,openingGate,openingPrompt,submissionReadiness,arcGate,arcPrompt,arcFingerprint,pendingArcAudit} from './acceptance.mjs';
import {storyContext,validateSceneContract,bindContractFacts} from './story-context.mjs';
import {repairPrompt,applyRepair,repairFeasible} from './repairs.mjs';
import {resolveModel} from './model-routing.mjs';
import {advancedNarrative,validateNarrativePlan,validateNarrativeContract,validateNarrativeEvidence,narrativeDashboard} from './narrative.mjs';
import {validateCraftPlan,validateCraftContract,validateCraftEvidence} from './craft.mjs';
import {storyDocuments} from './story-documents.mjs';
import {validateStyleBindings,styleAt,stylePrompt,styleReviewInstruction,validateStyleEvidence,referenceOverlap,styleStatus} from './style-profile.mjs';
import {boundStyleReferences} from './style-workbench.mjs';
export async function config(store) {return {...defaults,...await store.get('settings:'+store.owner)};}
export function publicConfig(c) {const {apiKeyEncrypted,writerApiKeyEncrypted,reviewApiKeyEncrypted,...safe}=c;return {...safe,hasKey:!!apiKeyEncrypted,writerHasKey:!!writerApiKeyEncrypted,reviewHasKey:!!reviewApiKeyEncrypted};}
export async function settings(store,input,secret) {
  const old=await config(store);const allowed=['provider','model','writerModel','reviewModel','writerProvider','reviewProvider','writerInputPrice','writerOutputPrice','reviewInputPrice','reviewOutputPrice','chapterLimit','segmentWords','inputPrice','outputPrice','monthLimit','bookLimit','taskLimit','maxOutputTokens','spendEnabled'];
  if(Object.hasOwn(input,'revision')&&input.revision!==old.revision)throw new Error('模型配置版本已变化，请刷新核对后保存');
  allowed.push('workspace','writerWorkspace','reviewWorkspace');
  const next={...old}; for(const k of allowed)if(Object.hasOwn(input,k))next[k]=input[k];validateConfig(next);
  if(input.apiKey){if(typeof input.apiKey!=='string'||input.apiKey.length>1000)throw new Error('API密钥无效');next.apiKeyEncrypted=await seal(input.apiKey,secret);}
  if(old.apiKeyEncrypted&&(old.provider!==next.provider||old.workspace!==next.workspace)&&!input.apiKey)next.apiKeyEncrypted='';
  for(const slot of ['writer','review']) {
    const field=slot+'ApiKey',encrypted=field+'Encrypted';
    if(input[field]){if(typeof input[field]!=='string'||input[field].length>1000)throw new Error('角色API密钥无效');next[encrypted]=await seal(input[field],secret);}
    if((old[slot+'Provider']!==next[slot+'Provider']||old[slot+'Workspace']!==next[slot+'Workspace'])&&!input[field]||!next[slot+'Provider'])next[encrypted]='';
  }
  const saved=old.revision?await store.save(old,next):await store.create('settings',next,'','settings:'+store.owner);
  return publicConfig(saved);
}
export async function createBook(store,input,key,options={}) {
  if(!key||!/^[a-zA-Z0-9_-]{12,80}$/.test(key))throw new Error('创建请求缺少幂等标识');
  const total=Number(input.totalChapters??100),words=Number(input.targetWords??9000),budget=Number(input.budget??20);
  if(!Number.isInteger(total)||total<3||total>300||!Number.isInteger(words)||words<1000||words>10000||!Number.isFinite(budget)||budget<0||budget>10000)throw new Error('章节3–300，篇幅1000–10000汉字，预算0–10000元');
  const platform=String(input.platform||'auto').slice(0,80);
  if(platform!=='auto'&&!effectivePlatforms().some(p=>p.name===platform))throw new Error('主平台未登记');
  const platformProtocol=options.restoring?0:1,platformBinding=platformProtocol&&platform!=='auto'?await bindPlatform(platform,await store.list('rule')):null;
  const b=await store.create('book',{platformProtocol,platformBinding,title:String(input.title||'待策划的新书').slice(0,80),direction:String(input.direction||'自动选择有持续冲突的原创商业题材').slice(0,2000),platform:String(input.platform||'auto').slice(0,80),totalChapters:total,targetWords:words,budget,workflowVersion:2,narrativeProtocol:options.restoring?0:1,craftProtocol:options.restoring?0:1,status:options.restoring?'paused':'planning',...(options.restoring?{restoreComplete:false,restoreFingerprint:options.fingerprint}:{}),created:new Date().toISOString(),plan:null,planRevision:1,guidance:'',lease:null,error:null},'',store.owner+(options.restoring?':restore:':':book:')+key);
  return b;
}
export async function memory(store,book,chapters) {
  const locked=chapters.filter(c=>c.status==='locked').sort((a,b)=>a.number-b.number);
  return {facts:factsFrom(book.plan,locked),ledger:locked.map(c=>({number:c.number,summary:c.review.summary,changes:c.review.changes,signature:c.review.signature,consequences:c.review.consequences,questions:c.review.questions})),foreshadowing:[...(book.plan?.foreshadowing||[]),...locked.flatMap(c=>c.review.foreshadowing||[])]};
}
async function lease(store,record) {
  if(record.lease&&record.lease.until>Date.now())throw new Error('任务正在执行，请等待；异常中断后租约到期可恢复');
  return store.claimLease(record);
}
async function finish(store,record,next) {
  const current=await store.get(record.id);
  if(current.lease?.token!==record.lease?.token)throw new Error('任务租约已变化，旧结果不能覆盖新任务');
  return store.save(current,{...next,status:current.kind==='book'&&current.status==='paused'?'paused':next.status,lease:null,error:null});
}
export async function step(store,bookId,secret,invoke=modelCall,options={}) {
  let book=await store.get(bookId);if(!book||book.kind!=='book')throw new Error('作品不存在');
  if(book.restoreComplete===false)throw new Error('备份恢复尚未完成，请用同一备份和标识完成恢复');
  if(book.revisionComplete===false)throw new Error('修订副本建立尚未完成，请从原作品重新建立副本');
  await validateStyleBindings(book);
  if((await store.list('styleTask',bookId)).some(t=>['ready','running'].includes(t.status)))throw new Error('请先完成或暂停文风实验，再开始正式正文');
  const job=await store.get(bookId+':job');if(job&&['queued','running','waiting'].includes(job.status)&&(!options.jobToken||job.lease?.token!==options.jobToken))throw new Error('云端任务已接管本书，请在任务控制台暂停后再手动执行');
  if(book.status==='paused'||book.status==='blocked')throw new Error('任务已暂停，请检查原因后恢复');
  const rules=await store.list('rule');const platformRules=effectivePlatforms(rules);
  await checkPlatformBinding(book,rules);
  const originalInvoke=invoke;
  invoke=async (st,cfg,b,prompt,role,key)=>{
    const latestRules=await st.list('rule');
    const runtimeBinding=b.platform!=='auto'?await checkPlatformBinding(b,latestRules):null;
    if(b.platform==='auto'&&JSON.stringify(effectivePlatforms(latestRules))!==JSON.stringify(platformRules))throw new Error('平台规则版本已变化，请核对后再策划');
    const promptBook=b.platformBinding?b:{...b,platformBinding:runtimeBinding};
    const number=b.activeChapter||(role==='plan_batch'?(b.plan?.contracts?.length??b.planningDraft?.contracts?.length??0)+1:1);
    const result=await originalInvoke(st,cfg,b,prompt+(role==='opening_review'?'':platformInstruction(promptBook))+(b.revisionGuidance?.length?'\n历史修订问题（仅作问题定位，新稿是否关闭必须引用新正文）：'+JSON.stringify(b.revisionGuidance):'')+(['write','review','repair','rewrite'].includes(role)?'\n'+styleInstruction:'')+(['plan','plan_batch','contract','write','review','repair','rewrite'].includes(role)?stylePrompt(b,number,role):'')+(role==='review'?styleReviewInstruction(b,number):''),role,key);
    const now=await st.get(b.id);
    if((now?.styleRevision||0)!==(b.styleRevision||0))throw new Error('本书文风版本已改变，旧响应不能生效');
    if(b.platformProtocol===1&&now?.platformBinding?.hash!==b.platformBinding?.hash)throw new Error('本书平台规则绑定已改变，旧响应不能生效');
    if(b.platform!=='auto'){const current=await checkPlatformBinding(b,await st.list('rule'));if(current.hash!==runtimeBinding.hash)throw new Error('平台规则版本已变化，旧响应不能生效');}
    return result;
  };
  if(platformRules.some(p=>p.name===book.platform&&['restricted','prohibited'].includes(p.aiPolicy)))throw new Error('主平台已知规则不适用自动正文创作，请选择适合的主平台；仍可查看和导出私有稿件');
  const cfg=await config(store);let active;
  const chapters=(await store.list('chapter',bookId)).sort((a,b)=>a.number-b.number);
  if(chapters.some(c=>c.status==='blocked'))throw new Error('本章三轮返修或架构诊断未通过，请先处理阻塞，不会开始额外付费审核');
  try {
    if(!book.plan) {
      active=await lease(store,book);
      const platforms=platformRules.filter(p=>!['restricted','prohibited'].includes(p.aiPolicy)&&(book.platform!=='auto'||primaryPlatforms.includes(p.name)));
      if(book.totalChapters>10) {
        if(!book.planningDraft) {
          const draft=await newPlanningDraft(await invoke(store,cfg,book,planningPrompt(book,platforms,await store.list('submission'),true),'plan',secret),book.totalChapters);
          if(advancedNarrative(book))validateNarrativePlan(draft.outline,book.totalChapters);
          validateCraftPlan(draft.outline,book);
          const platform=book.platform==='auto'?draft.outline.platform:book.platform;
          if(!platforms.some(p=>p.name===platform))throw new Error('模型推荐了未登记平台');
          draft.outline.platform=platform;
          const savedDraft=await newPlanningDraft(draft.outline,book.totalChapters);
          book=await finish(store,active,{...active,title:draft.outline.title,platform,planningDraft:savedDraft,...(book.platformProtocol===1?{platformBinding:await bindPlatform(platform,rules)}:{}),status:'planning'});
          await store.log(bookId,'故事圣经与全书阶段已保存，接着分批完成章节计划');return {phase:'plan_outline',book};
        }
        const draft=await validatePlanningDraft(book.planningDraft,book.totalChapters),range=planningRange(draft);
        const next=await appendPlanningBatch(draft,await invoke(store,cfg,book,planningBatchPrompt(book,draft,range),'plan_batch',secret));
        const done=next.contracts.length===book.totalChapters,ready=done||book.workflowVersion===2;
        book=await finish(store,active,{...active,plan:ready?(done?completedPlan(next):rollingPlan(next)):null,planningDraft:ready?null:next,status:ready?'ready':'planning'});
        await store.log(bookId,`第${range.start}–${range.end}章计划已保存（${next.contracts.length}/${book.totalChapters}）${ready?'；开始验证正文，后续详纲按实际定稿滚动规划':''}`);
        return {phase:ready?'plan':'plan_batch',book};
      }
      const p=validatePlan(await invoke(store,cfg,book,planningPrompt(book,platforms,await store.list('submission')),'plan',secret),book.totalChapters);
      if(advancedNarrative(book))validateNarrativePlan(p,book.totalChapters);
      validateCraftPlan(p,book);
      const platform=book.platform==='auto'?p.platform:book.platform;if(!platforms.some(p=>p.name===platform))throw new Error('模型推荐了未登记平台');
      book=await finish(store,active,{...active,title:p.title,plan:p,platform,...(book.platformProtocol===1?{platformBinding:await bindPlatform(platform,rules)}:{}),status:'ready'});await store.log(bookId,'完成选题比较、故事圣经与全书阶段规划');return {phase:'plan',book};
    }
    const locked=chapters.filter(c=>c.status==='locked');const number=locked.length+1;
    if(locked.some((c,i)=>c.number!==i+1))throw new Error('已锁章节不连续，停止续写');
    if(locked.length>=3) {
      const fingerprint=await openingFingerprint(book,locked),opening=await store.get(bookId+':opening');
      if(opening?.fingerprint!==fingerprint||!opening?.pass) {
        if(opening?.fingerprint===fingerprint&&opening?.completedAt)throw new Error('开篇联合验收未通过，请先修订具体问题；不会自动反复收费审核');
        return performOpeningAudit(store,book,locked,secret,invoke);
      }
    }
    // Every completed stage must remain valid, including a mid-stage restore.
    const pendingThrough=await pendingArcAudit(book,locked,await store.list('audit',bookId));
    if(pendingThrough!==null) {
      const through=pendingThrough,audit=await store.get(bookId+':audit:'+through);
      const arcChapters=locked.filter(c=>c.number>through-10&&c.number<=through),fingerprint=await arcFingerprint(book,locked,through);
      if(audit?.completedAt&&audit.fingerprint===fingerprint)throw new Error('相同稿件的阶段审核已失败，请先修订，不会自动重复收费');
      active=await lease(store,audit||await store.create('audit',{through,pass:false},bookId,bookId+':audit:'+through));
      const result=await invoke(store,cfg,book,arcPrompt(book,locked,through),'arc_review',secret);
      const gate=arcGate(result,arcChapters),freshBook=await store.get(bookId),freshChapters=await store.list('chapter',bookId);
      if(fingerprint!==await arcFingerprint(freshBook,freshChapters,through))throw new Error('阶段稿件或大纲变化，旧审核不能生效');
      await finish(store,active,{...active,...result,through,gate,pass:gate.pass,fingerprint,completedAt:new Date().toISOString()});if(!gate.pass)throw new Error('阶段审核未通过，需要按原文证据调整后继续');
      await store.log(bookId,`第${through}章阶段审核通过，改进意见供后续任务书使用`);return {phase:'arc_audit'};
    }
    if(number>book.totalChapters)return {phase:'complete'};
    if(number>book.plan.contracts.length) {
      if(book.futurePlanInvalidFrom&&number>=book.futurePlanInvalidFrom)throw new Error('修订副本的后续旧详纲已失效；请先核对并保存未来大纲，不会沿用旧后果');
      if(book.plan.planningMode!=='rolling')throw new Error('章节计划缺失，停止写作');
      active=await lease(store,book);
      const draft=await draftFromPlan(book.plan,book.totalChapters),range=planningRange(draft),context=await storyContext(book,locked,null,number);
      const audit=await store.get(bookId+':audit:'+locked.length);
      if(audit?.pass)context.stageFeedback={through:locked.length,nextAdjustment:audit.nextAdjustment};
      const next=await appendPlanningBatch(draft,await invoke(store,cfg,book,planningBatchPrompt(book,draft,range)+'。已定稿实际后果与原文上下文：'+JSON.stringify(context),'plan_batch',secret));
      book=await finish(store,active,{...active,plan:next.contracts.length===book.totalChapters?completedPlan(next):rollingPlan(next)});
      await store.log(bookId,`按已定稿后果完成第${range.start}–${range.end}章详纲，既有正文和任务书保持不变`);return {phase:'plan_batch',book};
    }
    let chapter=chapters.find(c=>c.number===number);
    if(!chapter)chapter=await store.create('chapter',{number,title:book.plan.contracts[number-1].title,status:'contract',chunks:[],content:'',attempt:0,review:null,gate:null,hash:null,lease:null,...(styleAt(book,number)?{styleHash:styleAt(book,number).profile.hash}:{})},bookId,bookId+':chapter:'+number);
    if((chapter.styleHash||null)!==(styleAt(book,number)?.profile.hash||null))throw new Error('本章文风版本与已开始时的绑定不一致，不能混用版本');
    if(chapter.status==='blocked')throw new Error('本章三轮返修或架构诊断未通过，请人工修订后重新审核');
    if(advancedNarrative(book)&&chapter.status!=='contract'&&chapter.contract?.schema!==3)throw new Error('高级章节任务书版本不匹配，停止执行，不会跳过叙事审核');
    if(chapter.contract?.schema===3&&!advancedNarrative(book))throw new Error('章节叙事协议与作品版本不一致，停止执行');
    active=await lease(store,chapter);const mem=await storyContext(book,locked,chapter.contract,number),callBook={...book,activeChapter:number};
    const through=Math.floor((number-1)/10)*10;
    if(through){const a=await store.get(bookId+':audit:'+through);if(a?.pass&&typeof a.nextAdjustment==='string')mem.stageFeedback={through,nextAdjustment:a.nextAdjustment,note:'历史编辑建议，只能改进未来表达，不能改变定稿事实'};}
    if(chapter.status==='contract') {
      const segmentWords=cfg.segmentWords||1600;
      const response=await invoke(store,cfg,callBook,contractPrompt(book,mem,book.plan.contracts[number-1],segmentWords)+(chapter.preservedDraft?'\n已有本人保留候选稿（SHA256='+chapter.hash+'），请逐项读取并拟定与既定事实和正文相符的任务书；不能编造不存在的情节。无法兼容则返回blocked诊断，不覆盖该稿：'+chapter.content:''),'contract',secret);
      const c=bindContractFacts(response,mem);
      if(c?.blocked)throw new Error(c.reason||'章节合同无法推进故事');
      try{
        validateSceneContract(c,book,mem,Math.ceil(book.targetWords/segmentWords));
        validateNarrativeContract(c,book,locked,number);
        validateCraftContract(c,book);
      }catch(error){
        const current=await store.get(active.id);
        if(current?.lease?.token===active.lease.token)await store.save(current,{...current,contractCandidate:{response:c,error:error.message,createdAt:new Date().toISOString()}});
        throw error;
      }
      const saved=await finish(store,active,{...active,contract:c,contractCandidate:null,segmentWords,title:c.title||active.title,status:chapter.preservedDraft?'reviewing':'writing'});await store.log(bookId,`第${number}章剧情任务书完成，${c.scenes.length}个场景`);return {phase:'contract',chapter:saved};
    }
    if(chapter.status==='rework') {
      if(chapter.attempt>=3)return {phase:'blocked',blocked:true,chapter:await finish(store,active,{...active,status:'blocked',error:'最多三轮返修已用尽'})};
      if(!repairFeasible(chapter,book.targetWords))return {phase:'blocked',blocked:true,chapter:await finish(store,active,{...active,status:'blocked',repairDiagnosis:'篇幅缺陷超出局部补丁可修复范围；需要诊断场景任务书，未再次付费返修'})};
      const versionHash=await hash(chapter.content);
      await store.create('version',{number,content:chapter.content,title:chapter.title,hash:versionHash,review:chapter.review,created:new Date().toISOString()},bookId,chapter.id+':version:'+versionHash);
      active=await store.save(active,{...active,attempt:active.attempt+1});
      const response=await invoke(store,cfg,callBook,repairPrompt(book,active,mem),'repair',secret);
      const patch=await applyRepair(active,response);
      if(patch.blocked)return {phase:'blocked',blocked:true,chapter:await finish(store,active,{...active,status:'blocked',repairDiagnosis:patch.reason})};
      const saved=await finish(store,active,{...active,content:patch.content,chunks:[patch.content],hash:patch.hash,review:null,gate:null,status:'reviewing',lastRepair:{patchCount:patch.patchCount,changedCharacters:patch.changedCharacters,baseHash:versionHash}});
      await store.log(bookId,`第${number}章第${saved.attempt}轮局部返修已合并${patch.patchCount}处，保留原稿，下一步全文复审`);return {phase:'rework',chapter:saved};
    }
    if(chapter.status==='writing') {
      const out=await invoke(store,{...cfg,segmentWords:chapter.segmentWords||1600},callBook,writePrompt(book,chapter,mem,chapter.attempt>0),'write',secret);
      if(out.blocked===true)return {phase:'blocked',blocked:true,chapter:await finish(store,active,{...active,status:'blocked',repairDiagnosis:String(out.reason||'写作任务书矛盾').slice(0,2000)})};
      if(typeof out.text!=='string'||out.text.length>15000||out.sceneComplete!==true||count(out.text)<Math.floor(book.targetWords/chapter.contract.scenes.length*.55))throw new Error('片段不完整或篇幅严重不足，未覆盖已保存正文');
      const chunks=[...chapter.chunks,out.text]; const content=chunks.join('\n\n');const done=chunks.length===chapter.contract.scenes.length;
      const saved=await finish(store,active,{...active,chunks,content,hash:await hash(content),status:done?'reviewing':'writing'});
      await store.log(bookId,`第${number}章片段 ${chunks.length}/${chapter.contract.scenes.length} 已安全保存`);return {phase:'fragment',chapter:saved};
    }
    if(chapter.status==='reviewing') {
      const overlap=referenceOverlap(chapter.content,await boundStyleReferences(store,book,number));
      if(overlap.length){const gate={pass:false,score:null,stage:'reference_overlap',issues:overlap};return {phase:'reference_overlap',blocked:true,chapter:await finish(store,active,{...active,gate,repairIssues:overlap,status:'blocked'})};}
      const preflight=textPreflight(chapter,locked,book.targetWords);
      if(preflight.length) {
        const gate={pass:false,score:null,stage:'text_preflight',issues:preflight.map((i,n)=>({...i,id:'PRE-'+(n+1)}))};
        const saved=await finish(store,active,{...active,gate,repairIssues:gate.issues,status:active.attempt>=3?'blocked':'rework'});
        await store.log(bookId,`第${number}章程序预检未通过，未请求付费审稿`);return {phase:'text_preflight',chapter:saved};
      }
      let r=validateReview(await invoke(store,cfg,callBook,reviewPrompt(book,chapter,mem,mem.ledger),'review',secret),chapter.content);
      r=validateNarrativeEvidence({...active,review:r},book,mem);
      r=validateCraftEvidence({...active,review:r},book);
      r=validateStyleEvidence(r,chapter,book);
      const candidate={...active,review:r};const gate=qualityGate(candidate,locked,mem.facts,book.targetWords,book,mem);
      const status=gate.pass?'locked':active.attempt>=3||r.architectureConcern||gate.issues.some(i=>['NARRATIVE_LOOP','NARRATIVE_CONTEXT','CRAFT_CONTEXT','CHARACTER_UNEARNED'].includes(i.code))?'blocked':'rework';
      const saved=await finish(store,active,{...candidate,gate,repairIssues:gate.issues,status,hash:await hash(chapter.content),lockedAt:gate.pass?new Date().toISOString():null});
      await store.create('version',{number,content:saved.content,title:saved.title,hash:saved.hash,review:r,created:new Date().toISOString()},bookId,chapter.id+':version:'+saved.hash);
      await store.log(bookId,`第${number}章审核 ${gate.pass?'通过并锁定':'未通过'}，${gate.score}/100`);return {phase:'review',chapter:saved};
    }
    throw new Error('未知章节状态');
  } catch(e) {
    if(active) {const now=await store.get(active.id);if(now?.lease?.token===active.lease.token)await store.save(now,{...now,lease:null,error:e.message});}
    await store.log(bookId,e.message);throw e;
  }
}
export async function saveChapter(store,input) {
  let c=await store.get(input.id);if(!c||c.kind!=='chapter')throw new Error('章节不存在');
  await assertIdle(store,c.parent);
  if(c.status==='locked')throw new Error('定稿不可直接覆盖，请先创建修订版本');
  if(c.revision!==input.revision)throw new Error('版本已变化，请刷新后保存');
  if(c.lease?.until>Date.now())throw new Error('本章生成中，请等待完成再编辑');
  if(typeof input.content!=='string'||input.content.length>90000)throw new Error('正文长度无效');
  const oldHash=await hash(c.content);await store.create('version',{number:c.number,title:c.title,content:c.content,hash:oldHash,review:c.review,created:new Date().toISOString()},c.parent,c.id+':version:'+oldHash);
  c=await store.save(c,{...c,content:input.content,title:String(input.title||c.title).slice(0,100),chunks:[input.content],review:null,gate:null,status:'reviewing',hash:await hash(input.content),lease:null});return c;
}
export async function unlockChapter(store,id) {
  const c=await store.get(id);if(!c||c.kind!=='chapter')throw new Error('章节不存在');
  await assertIdle(store,c.parent);
  if(c.status!=='locked')throw new Error('只有已锁定章节需要解除锁定');
  if(c.lease?.until>Date.now())throw new Error('本章检查点仍在执行，请等待');
  const all=await store.list('chapter',c.parent);if(all.some(n=>n.number>c.number))throw new Error('已有后续章节，先建立整本重写分支；当前版本禁止破坏历史事实');
  return store.save(c,{...c,status:'reviewing',review:null,gate:null,lockedAt:null});
}
export async function reviseChapter(store,input,secret,invoke=modelCall) {
  const c=await store.get(input.id);if(!c||c.kind!=='chapter'||c.status==='locked')throw new Error('请先创建章节修订版本');
  await assertIdle(store,c.parent);
  const b=await store.get(c.parent),cfg=await config(store);if(b.restoreComplete===false||b.revisionComplete===false)throw new Error('恢复或修订副本尚未完成，不允许付费修订');await checkPlatformBinding(b,await store.list('rule'));const a=await lease(store,c);
  try {
    await validateStyleBindings(b);if((c.styleHash||null)!==(styleAt(b,c.number)?.profile.hash||null))throw new Error('章节文风版本不匹配');
    const runtimeBinding=await checkPlatformBinding(b,await store.list('rule'));
    const out=await invoke(store,cfg,{...b,activeChapter:c.number},`仅按要求修订原创正文，不改变既定事实。要求${String(input.instruction).slice(0,2000)}。事实${JSON.stringify(await storyContext(b,(await store.list('chapter',b.id)).filter(n=>n.number<c.number),c.contract,c.number))}。正文${c.content}。只返回JSON{text}。`+platformInstruction(b.platformBinding?b:{...b,platformBinding:runtimeBinding})+'\n'+styleInstruction+stylePrompt(b,c.number,'rewrite'),'rewrite',secret);
    if(((await store.get(b.id)).styleRevision||0)!==(b.styleRevision||0))throw new Error('文风版本已变化，旧修订响应不能生效');
    if((await bindPlatform(b.platform,await store.list('rule'))).hash!==runtimeBinding.hash)throw new Error('平台规则版本已变化，旧修订响应不能生效');
    if(typeof out.text!=='string'||out.text.length>90000)throw new Error('修订响应无效');
    await store.create('version',{number:c.number,title:c.title,content:c.content,hash:await hash(c.content),review:c.review,created:new Date().toISOString()},b.id,c.id+':version:'+await hash(c.content));
    return finish(store,a,{...a,content:out.text,chunks:[out.text],hash:await hash(out.text),review:null,gate:null,status:'reviewing'});
  } catch(e){const x=await store.get(c.id);if(x.lease?.token===a.lease.token)await store.save(x,{...x,lease:null,error:e.message});throw e;}
}
export async function exportBook(store,id,draft=false) {
  const book=await store.get(id);if(!book)throw new Error('作品不存在');
  const cs=(await store.list('chapter',id)).filter(c=>draft||c.status==='locked').sort((a,b)=>a.number-b.number);
  if(!cs.length)throw new Error('暂无可导出的章节');
  for(const c of cs)if(c.hash&&c.hash!==await hash(c.content))throw new Error(`第${c.number}章校验失败，停止导出`);
  return '\ufeff'+book.title+'\r\n\r\n'+cs.map(c=>`第${c.number}章 ${c.title}${c.status==='locked'?'':'〔未定稿〕'}\r\n\r\n${c.content.replace(/\r?\n/g,'\r\n')}`).join('\r\n\r\n');
}
export async function snapshot(store,bookId) {
  const [books,settingsValue,submissions,incomes,expenses,rules,jobs]=await Promise.all([store.list('book'),config(store),store.list('submission'),store.list('income'),store.list('expense'),store.list('rule'),store.list('job')]);
  const id=bookId||books[0]?.id;
  const [chapters,logs,cost]=id?await Promise.all([store.list('chapter',id),store.list('log',id),store.cost(id)]):[[],[],{total:0,calls:[]}];
  const selectedBook=books.find(b=>b.id===id),openingAudit=id?await store.get(id+':opening'):null;
  const platform=effectivePlatforms(rules).find(p=>p.name===selectedBook?.platform);
  if(selectedBook){try{await checkPlatformBinding(selectedBook,rules);selectedBook.platformCheck={pass:selectedBook.platformProtocol===1,message:selectedBook.platform==='auto'?'选定主平台时会绑定规则':selectedBook.platformProtocol===1?'当前平台规则已核验，投稿适用性另行检查':'旧作品尚未绑定本轮规则；请核对或从第1章建立修订副本，旧稿保留'};}catch(e){selectedBook.platformCheck={pass:false,message:e.message};}}
  const acceptance=await submissionReadiness(selectedBook,chapters,openingAudit,platform);
  const lockedCount=chapters.filter(c=>c.status==='locked').length;
  const pendingArcThrough=selectedBook?await pendingArcAudit(selectedBook,chapters,await store.list('audit',id)):null;
  const qualityPending=lockedCount>=3&&(!acceptance.checks.find(c=>c.id==='opening')?.pass||pendingArcThrough!==null);
  let documents;try{documents=await storyDocuments(selectedBook,chapters);}catch(e){documents={error:e.message};}
  return {styleStatus:styleStatus(selectedBook),storyDocuments:documents,styleSignals:chapters.map(c=>({number:c.number,hash:c.hash,hints:styleSignals(c.content)})),story:narrativeDashboard(selectedBook,chapters),qualityPending,pendingArcThrough,acceptance,openingAudit,books,settings:publicConfig(settingsValue),chapters:chapters.map(({content,chunks,lease,...c})=>({...c,words:count(content),fragmentCount:chunks?.length||0,leaseUntil:lease?.until||null})).sort((a,b)=>a.number-b.number),jobs:jobs.map(({lease,...j})=>({...j,leaseUntil:lease?.until||null})),logs:logs.slice(0,40),cost,submissions,incomes,expenses,platforms:effectivePlatforms(rules),audits:id?await store.list('audit',id):[],selectedId:id};
}
export async function assertIdle(store,id) {
  const j=await store.get(id+':job');if(j&&(['queued','running','waiting'].includes(j.status)||j.lease?.until>Date.now()))throw new Error('请先暂停云端任务，等待当前检查点保存后再编辑');
  if((await store.get(id))?.lease?.until>Date.now())throw new Error('作品检查点仍在执行，请等待保存后再编辑');
}
export async function setBookBudget(store,input) {
  const b=await store.get(input.id);if(!b||b.kind!=='book')throw new Error('作品不存在');
  await assertIdle(store,b.id);
  if(b.revision!==input.revision)throw new Error('作品版本已变化，请刷新后保存预算');
  if(!Number.isFinite(input.budget)||input.budget<0||input.budget>10000)throw new Error('单书预算必须在0到10000元之间');
  if(b.lease?.until>Date.now()||(await store.list('chapter',b.id)).some(c=>c.lease?.until>Date.now()))throw new Error('当前检查点尚未完成，请稍后修改预算');
  const saved=await store.save(b,{...b,budget:input.budget});
  await store.log(b.id,`用户将本书预算从${b.budget}元调整为${input.budget}元；费用授权与任务状态不变`);return saved;
}
export async function savePlan(store,input) {
  const b=await store.get(input.id);if(!b||b.kind!=='book'||!b.plan)throw new Error('故事规划尚未完成');
  await assertIdle(store,b.id);
  if(b.revision!==input.revision)throw new Error('大纲版本已变化，请刷新后重新编辑');
  const chapters=await store.list('chapter',b.id);
  if(b.lease?.until>Date.now()||chapters.some(c=>c.lease?.until>Date.now()))throw new Error('当前检查点尚未完成，请稍后修改大纲');
  const firstEditable=Math.max(0,...chapters.map(c=>c.number))+1;
  if(typeof input.guidance!=='string'||input.guidance.length>4000)throw new Error('创作方向最多4000字');
  const next=validatePlan({...b.plan,contracts:input.contracts,arcs:input.arcs},b.totalChapters);
  for(let i=0;i<firstEditable-1;i++)if(JSON.stringify(next.contracts[i])!==JSON.stringify(b.plan.contracts[i]))throw new Error('已经开始写作的章节合同不能覆盖');
  for(const a of b.plan.arcs.filter(a=>a.start<firstEditable))if(JSON.stringify(next.arcs.find(n=>n.id===a.id))!==JSON.stringify(a))throw new Error('已开始的阶段计划不能覆盖');
  if(next.arcs.length!==b.plan.arcs.length||next.arcs.some((a,i)=>a.id!==b.plan.arcs[i].id||a.start!==b.plan.arcs[i].start||a.end!==b.plan.arcs[i].end))throw new Error('阶段范围不能改变，请仅修改未来阶段的目标与真实变化');
  for(const c of next.contracts)for(const k of ['title','goal','consequence','method'])if(typeof c[k]!=='string'||!c[k].trim()||c[k].length>2000)throw new Error('章节计划字段需为1至2000字');
  for(const a of next.arcs)for(const k of ['goal','irreversibleChange'])if(typeof a[k]!=='string'||!a[k].trim()||a[k].length>2000)throw new Error('阶段计划字段需为1至2000字');
  const rev=b.planRevision||1;
  const oldPlan={plan:b.plan,guidance:b.guidance||'',guidanceFromChapter:b.guidanceFromChapter||1,planRevision:rev};
  await store.create('planVersion',{...oldPlan,hash:await hash(JSON.stringify(oldPlan)),createdAt:new Date().toISOString()},b.id,b.id+':planVersion:'+rev);
  const saved=await store.save(b,{...b,plan:next,futurePlanInvalidFrom:null,guidance:input.guidance,guidanceFromChapter:firstEditable,planRevision:rev+1});
  await store.log(b.id,`大纲保存为V${rev+1}，仅修改尚未开始的章节；未来创作须重新启动任务`);return saved;
}
export async function testConnection(store,secret,invoke=modelCall,slot='planner') {
  if(!['planner','writer','review'].includes(slot))throw new Error('连接测试角色无效');
  const c=await config(store),id=store.owner+':connection-test:'+slot,role=slot==='planner'?'connection':'connection_'+slot,route=resolveModel(c,role);
  const result=await invoke(store,c,{id,budget:Math.min(c.bookLimit,c.taskLimit)},'连接验证。不涉及小说。只返回JSON {"ok":true}',role,secret);
  if(result.ok!==true)throw new Error('接口已响应，但未返回要求的JSON结构');
  await store.log('',`模型连接验证通过：${route.provider} / ${route.model}；属于接口验证，不是写作质量验收`);
  return {ok:true,role:slot,provider:route.provider,model:route.model,cost:(await store.cost(id)).total};
}

async function performOpeningAudit(store,book,chapters,secret,invoke) {
  if(book.restoreComplete===false||book.revisionComplete===false)throw new Error('恢复或修订副本尚未完成，不允许付费验收');
  await validateStyleBindings(book);
  await checkPlatformBinding(book,await store.list('rule'));
  if(chapters.filter(c=>c.number<=3&&c.status==='locked').length!==3)throw new Error('先完成前三章正式定稿');
  if(chapters.some(c=>c.lease?.until>Date.now()))throw new Error('章节检查点仍在执行，请等待');
  const fingerprint=await openingFingerprint(book,chapters),old=await store.get(book.id+':opening');
  if(old?.fingerprint===fingerprint&&old.pass)return {phase:'opening_audit',audit:old,blocked:false};
  if(old?.fingerprint===fingerprint&&old.completedAt)throw new Error('相同稿件已经验收失败，请先修订具体问题；不会自动重复收费');
  const record=old||await store.create('audit',{type:'opening',through:3,pass:false},book.id,book.id+':opening');
  const active=await lease(store,record);
  try {
    const cfg=await config(store),runtimeBinding=await checkPlatformBinding(book,await store.list('rule'));
    const report=await invoke(store,cfg,book,openingPrompt(book,chapters)+platformInstruction(book.platformBinding?book:{...book,platformBinding:runtimeBinding}),'opening_review',secret);
    await checkPlatformBinding(book,await store.list('rule'));
    const freshBook=await store.get(book.id),freshChapters=await store.list('chapter',book.id);
    if(fingerprint!==await openingFingerprint(freshBook,freshChapters))throw new Error('验收期间稿件或大纲变化，旧审核不生效');
    const gate=openingGate(report,chapters);
    const audit=await finish(store,active,{...active,type:'opening',through:3,report,gate,pass:gate.pass,fingerprint,completedAt:new Date().toISOString()});
    await store.log(book.id,'开篇三章联合验收'+(gate.pass?'通过':'未通过')+'，'+gate.score+'/100；不代表签约或保底');
    return {phase:'opening_audit',audit,blocked:!gate.pass};
  } catch(e) {const now=await store.get(active.id);if(now?.lease?.token===active.lease.token)await store.save(now,{...now,lease:null,error:e.message});throw e;}
}
export async function openingAudit(store,id,secret,invoke=modelCall) {
  await assertIdle(store,id);const book=await store.get(id);if(!book||book.kind!=='book')throw new Error('作品不存在');
  return performOpeningAudit(store,book,await store.list('chapter',id),secret,invoke);
}

export async function adoptPlatformRules(store,input) {
  const b=await store.get(input.id);if(!b||b.kind!=='book')throw new Error('作品不存在');
  await assertIdle(store,b.id);
  if(b.revision!==input.revision)throw new Error('作品版本已变化，请刷新');
  if(b.lease?.until>Date.now()||(await store.list('chapter',b.id)).length)throw new Error('已有正文或在途请求，请从第1章创建独立修订副本后核对新规则');
  const platform=input.platform||b.platform;if(platform==='auto')throw new Error('请先选择明确主平台');
  const binding=await bindPlatform(platform,await store.list('rule'));
  if((b.plan||b.planningDraft)&&platform!==b.platform)throw new Error('已有规划不能直接切换平台，请为新平台新建作品');
  const saved=await store.save(b,{...b,platform,platformProtocol:1,platformBinding:binding});
  await store.log(b.id,'本人确认绑定平台规则 '+binding.pack.version+'；费用授权和任务状态不变');return saved;
}

import {createBook} from './engine.mjs';
import {hash} from './store.mjs';
import {validatePlan,validateReview,qualityGate} from './quality.mjs';
import {validatePlanningDraft} from './planning.mjs';
import {advancedNarrative,validateNarrativePlan,validateNarrativeContract,validateNarrativeEvidence} from './narrative.mjs';
import {storyContext,validateSceneContract} from './story-context.mjs';
import {craftEnabled,validateCraftPlan,validateCraftContract,validateCraftEvidence} from './craft.mjs';
import {validateStyleArchive,styleAt,validateStyleEvidence} from './style-profile.mjs';
import {singleCallMode,provisionalChapter,supportedReleaseChanges} from './chapter-flow.mjs';
export async function restoreBackup(store,b,key) {
  if(b.format!=='novel-factory-backup-v1'||!b.book||!Array.isArray(b.chapters)||b.chapters.length>300)throw new Error('备份格式无效');
  if(b.book.restoreComplete===false||b.book.revisionComplete===false)throw new Error('未完成的恢复/修订副本不能再次恢复，请先完成原操作');
  await validateStyleArchive(b.book,b.styleReferences||[],b.styleProfiles||[],b.styleTasks||[]);
  if(b.book.platformProtocol!==undefined&&![0,1].includes(b.book.platformProtocol))throw new Error('平台规则协议无效');
  if(b.book.platformProtocol===1&&b.book.platform!=='auto'&&(!b.book.platformBinding||b.book.platformBinding.hash!==await hash(JSON.stringify(b.book.platformBinding.pack))||b.book.platformBinding.pack.name!==b.book.platform))throw new Error('平台规则快照校验失败');
  if(b.book.futurePlanInvalidFrom!==undefined&&b.book.futurePlanInvalidFrom!==null&&(!Number.isInteger(b.book.futurePlanInvalidFrom)||b.book.futurePlanInvalidFrom<1||b.book.futurePlanInvalidFrom>b.book.totalChapters))throw new Error('修订后续计划执行门无效');
  if(b.book.revisionGuidance!==undefined&&(!Array.isArray(b.book.revisionGuidance)||b.book.revisionGuidance.length>31||JSON.stringify(b.book.revisionGuidance).length>150000))throw new Error('修订问题指引无效或过长');
  if(b.book.workflowVersion!==undefined&&![1,2].includes(b.book.workflowVersion))throw new Error('备份工作流版本无效');
  if(b.book.singleCallProtocol!==undefined&&![0,1].includes(b.book.singleCallProtocol))throw new Error('单次请求协议无效');
  if(b.book.narrativeProtocol!==undefined&&![0,1].includes(b.book.narrativeProtocol))throw new Error('备份叙事协议版本无效');
  if(b.book.narrativeProtocol===1&&b.book.workflowVersion!==2||b.chapters.some(c=>c?.contract?.schema===3)&&!advancedNarrative(b.book))throw new Error('备份叙事协议与工作流/任务书版本不一致，不能降级绕过审核');
  if(b.book.craftProtocol!==undefined&&![0,1].includes(b.book.craftProtocol))throw new Error('备份创作协议版本无效');
  if(b.book.craftProtocol===1&&!advancedNarrative(b.book)||b.chapters.some(c=>c?.contract?.craftProtocol===1||c?.review?.craftEvidence)&&!craftEnabled(b.book))throw new Error('备份创作协议与任务书/审核不一致，不能降级绕过审核');
  if(!Array.isArray(b.versions||[])||(b.versions||[]).length>5000)throw new Error('备份版本集过大');
  if(!Array.isArray(b.planVersions||[])||(b.planVersions||[]).length>1000)throw new Error('大纲版本集过大');
  if(b.book.plan)validatePlan(b.book.plan,b.book.totalChapters);
  if(advancedNarrative(b.book)&&b.book.plan)validateNarrativePlan(b.book.plan,b.book.totalChapters);
  if(advancedNarrative(b.book)&&b.book.planningDraft)validateNarrativePlan(b.book.planningDraft.outline,b.book.totalChapters);
  if(b.book.plan)validateCraftPlan(b.book.plan,b.book);
  if(b.book.planningDraft)validateCraftPlan(b.book.planningDraft.outline,b.book);
  if(b.book.planningDraft){if(b.book.plan||b.chapters.length)throw new Error('未完成规划不能同时包含正文或正式大纲');await validatePlanningDraft(b.book.planningDraft,b.book.totalChapters);}
  const seen=new Set();
  for(const c of b.chapters){
    if(!Number.isInteger(c.number)||c.number<1||c.number>b.book.totalChapters||seen.has(c.number)||typeof c.content!=='string'||c.content.length>90000||!['contract','writing','reviewing','rework','blocked','locked'].includes(c.status))throw new Error('备份章节结构无效');
    seen.add(c.number);
    if((c.styleHash||null)!==(styleAt(b.book,c.number)?.profile.hash||null))throw new Error('备份章节文风版本不一致，不能降级绕过文风审校');
    if(c.review?.styleEvidence&&!styleAt(b.book,c.number))throw new Error('备份文风绑定缺失，不能降级绕过审校');
    if(c.status==='locked')validateStyleEvidence(c.review,c,b.book);
    if(c.preservedDraft!==undefined&&typeof c.preservedDraft!=='boolean')throw new Error('保留修订稿标志无效');
    if(c.preservedDraft&&(!c.content||!c.sourceHash||c.sourceHash.length!==64||c.status==='writing'&&!c.contract))throw new Error('保留修订稿数据不完整');
    if((c.hash&&c.hash!==await hash(c.content))||(!c.hash&&c.content))throw new Error('备份正文校验失败');
    if(c.reviewCount!==undefined&&(!Number.isInteger(c.reviewCount)||c.reviewCount<0||c.reviewCount>5||!Number.isInteger(c.reviewAttempts)||c.reviewAttempts<c.reviewCount||c.reviewAttempts>5))throw new Error('备份审核次数无效');
    if(c.needsPolish&&!provisionalChapter(c))throw new Error('五审放行记录无效');
    if(provisionalChapter(c)){
      if(!singleCallMode(b.book)||c.status!=='locked'||c.gate?.pass!==false||c.release.actualQualityPass!==false||c.release.score!==c.gate.score||!Array.isArray(c.reviewReceipts)||c.reviewReceipts.length!==5)throw new Error('五审放行缺少真实审核记录');
      const reviewed=[c,...(b.versions||[]).filter(v=>v.number===c.number)];
      for(const receipt of c.reviewReceipts){const v=reviewed.find(v=>v.hash===receipt.sourceHash&&v.review);if(!v)throw new Error('五审放行缺少对应历史审核正文');validateReview(v.review,v.content);}
      if(new Set(c.reviewReceipts.map(r=>r.sourceHash)).size!==5)throw new Error('五审放行不能重复计算相同稿件');
      const prior=b.chapters.filter(p=>p.number<c.number&&p.status==='locked'),mem=await storyContext(b.book,prior,c.contract,c.number);
      if(JSON.stringify(c.release.acceptedChanges)!==JSON.stringify(supportedReleaseChanges(c.review,mem.facts)))throw new Error('五审放行事实账本与原审核不符');
    }
    if(c.status==='locked'&&(!c.review||!c.gate?.pass&&!provisionalChapter(c)))throw new Error('备份定稿缺少审核记录');
  }
  if(advancedNarrative(b.book))for(const c of [...b.chapters].sort((a,b)=>a.number-b.number)) {
    if(c.status==='contract')continue;
    if(c.contract?.schema!==3)throw new Error('高级备份章节任务书版本不匹配，不能降级跳过审核');
    if(c.segmentWords!==undefined&&(!Number.isInteger(c.segmentWords)||c.segmentWords<1000||c.segmentWords>3500))throw new Error('高级备份分段规格无效');
    const prior=b.chapters.filter(p=>p.number<c.number&&p.status==='locked'),mem=await storyContext(b.book,prior,c.contract,c.number);
    validateSceneContract(c.contract,b.book,mem,Math.ceil(b.book.targetWords/(c.segmentWords||1600)));
    validateNarrativeContract(c.contract,b.book,prior,c.number);
    validateCraftContract(c.contract,b.book);
    if(c.status==='locked')validateCraftEvidence(c,b.book);
    if(c.status==='locked'){validateReview(c.review,c.content);validateNarrativeEvidence(c,b.book,mem);const gate=qualityGate(c,[],mem.facts,b.book.targetWords,b.book,mem);if(!gate.pass&&!provisionalChapter(c))throw new Error('备份高级定稿未完成基础或叙事证据检查');if(provisionalChapter(c)&&gate.score!==c.gate.score)throw new Error('五审放行不能更改真实评分');}
  }
  for(const v of b.versions||[])if(typeof v.content!=='string'||v.content.length>90000||v.hash!==await hash(v.content))throw new Error('备份历史版本校验失败');
  for(const v of b.planVersions||[]){validatePlan(v.plan,b.book.totalChapters);if(!Number.isInteger(v.planRevision)||v.hash!==await hash(JSON.stringify({plan:v.plan,guidance:v.guidance,guidanceFromChapter:v.guidanceFromChapter,planRevision:v.planRevision})))throw new Error('备份大纲历史校验失败');}
  const fingerprint=await hash(JSON.stringify(b));
  let book=await createBook(store,{...b.book,title:b.book.title+'（恢复）'},key,{restoring:true,fingerprint});
  if(book.restoreFingerprint!==fingerprint)throw new Error('同一恢复标识不能混用不同备份');
  if(book.restoreComplete)return book;
  // Partial imports are resumable with the same backup checksum key. Never overwrite.
  for(const c of b.chapters){const {id,revision,parent,kind,...data}=c;await store.create('chapter',{...data,lease:null},book.id,book.id+':chapter:'+c.number);}
  for(const v of b.versions||[]){const {id,revision,parent,kind,...data}=v;await store.create('version',data,book.id,book.id+':chapter:'+v.number+':version:'+v.hash);}
  for(const a of b.audits||[]){const {id,revision,parent,kind,...data}=a;await store.create('audit',{...data,pass:false,fingerprint:null,completedAt:null,importedReport:data.report||null,lease:null},book.id,a.type==='opening'?book.id+':opening':book.id+':audit:'+a.through);}
  for(const v of b.planVersions||[]){const {id,revision,parent,kind,...data}=v;await store.create('planVersion',data,book.id,book.id+':planVersion:'+v.planRevision);}
  for(const [kind,rows] of [['styleReference',b.styleReferences||[]],['styleProfile',b.styleProfiles||[]],['styleTask',b.styleTasks||[]]])for(const r of rows){const {id,revision,parent,kind:oldKind,lease,...data}=r;await store.create(kind,{...data,...(kind==='styleTask'?{status:data.status==='completed'?'completed':'paused',imported:true,lease:null}: {})},book.id,book.id+':'+kind+':'+r.key);}
  book=await store.get(book.id);
  return store.save(book,{...book,singleCallProtocol:singleCallMode(b.book)?1:0,...(b.book.styleBindings!==undefined?{styleBindings:b.book.styleBindings,styleRevision:b.book.styleRevision}:{}),futurePlanInvalidFrom:b.book.futurePlanInvalidFrom||null,revisionGuidance:b.book.revisionGuidance||[],revisionSource:b.book.revisionSource||null,platformProtocol:b.book.platformProtocol||0,platformBinding:b.book.platformBinding||null,workflowVersion:b.book.workflowVersion||1,narrativeProtocol:b.book.narrativeProtocol||0,craftProtocol:b.book.craftProtocol||0,plan:b.book.plan,planningDraft:b.book.planningDraft||null,guidance:b.book.guidance||'',guidanceFromChapter:b.book.guidanceFromChapter||1,planRevision:b.book.planRevision||1,platform:b.book.platform,status:'paused',restoreComplete:true});
}

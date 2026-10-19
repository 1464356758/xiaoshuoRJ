import {validateReview,dimensions} from './quality.mjs';
import {revisionIssues,bindRevisionTask} from './revision-director.mjs';

export const MAX_CHAPTER_REVIEWS=5;
// Missing flag on existing V2 books adopts the new policy on the next explicit start.
export const singleCallMode=book=>book?.singleCallProtocol===1||book?.singleCallProtocol===undefined&&book?.workflowVersion>=2;
export const reviewCount=chapter=>Number.isInteger(chapter?.reviewCount)?chapter.reviewCount:0;
export const reviewLimitReached=chapter=>reviewCount(chapter)>=MAX_CHAPTER_REVIEWS;
export const provisionalChapter=chapter=>chapter?.needsPolish===true&&chapter?.release?.reason==='five_reviews'&&reviewCount(chapter)>=MAX_CHAPTER_REVIEWS;

export async function initializeChapterFlow(store,chapter){
  if(Number.isInteger(chapter.reviewCount))return chapter;
  // Only saved, complete, evidenced reviews count. Requests, repair attempts and
  // invalid JSON are not completed audits. Never reset these on pause/edit/start.
  const versions=(await store.list('version',chapter.parent)).filter(v=>v.number===chapter.number);
  const hashes=new Set();
  for(const v of [...versions,chapter])try{if(v.hash&&v.review){validateReview(v.review,v.content);hashes.add(v.hash);}}catch{}
  const count=Math.min(MAX_CHAPTER_REVIEWS,hashes.size);
  return store.save(chapter,{...chapter,reviewCount:count,reviewAttempts:count,reviewReceipts:[...hashes].slice(0,MAX_CHAPTER_REVIEWS).map(sourceHash=>({sourceHash,legacy:true})),phaseCalls:[]});
}

export async function beginChapterCall(store,chapter,role,phaseKey){
  const key=phaseKey||role+':'+(chapter.hash||'initial')+':'+reviewCount(chapter);
  if((chapter.phaseCalls||[]).some(p=>p.key===key&&p.status!=='not_sent'))throw new Error('本阶段已经发送过一次请求，结果或费用需核对；不会自动重发。请查看已保存结果或手动修改原稿');
  if(role==='review'&&(chapter.reviewAttempts||0)>=MAX_CHAPTER_REVIEWS)throw new Error('本章已达5次审核请求上限；不再追加请求，请查看已保存审核或手动精修');
  const phase={id:crypto.randomUUID(),key,role,sourceHash:chapter.hash||null,status:'started',createdAt:new Date().toISOString()};
  return store.save(chapter,{...chapter,phaseCalls:[...(chapter.phaseCalls||[]),phase],activePhase:phase.id,...(role==='review'?{reviewAttempts:(chapter.reviewAttempts||0)+1}:{})});
}
export function settleChapterCall(chapter,status='completed'){
  if(!chapter.activePhase)return {};
  return {phaseCalls:(chapter.phaseCalls||[]).map(p=>p.id===chapter.activePhase?{...p,status,completedAt:new Date().toISOString()}:p),activePhase:null};
}
export function failedChapterCall(chapter,error){
  const phase=(chapter.phaseCalls||[]).find(p=>p.id===chapter.activePhase);
  return {...settleChapterCall(chapter,error.requestSent===false?'not_sent':'failed'),...(phase?.role==='review'&&error.requestSent===false?{reviewAttempts:Math.max(reviewCount(chapter),(chapter.reviewAttempts||0)-1)}:{})};
}

export function localRevisionTask(book,chapter,cfg){
  const sources=revisionIssues(chapter);
  const defects=sources.filter(s=>s.id.startsWith('I-')&&!/^总分|不足85/.test(s.message||'')&&s.message).sort((a,b)=>(b.severity==='fatal'?100:b.severity==='major'?80:0)+(b.fix?20:0)-((a.severity==='fatal'?100:a.severity==='major'?80:0)+(a.fix?20:0)));
  const scores=sources.filter(s=>s.id.startsWith('S-')&&s.score<s.max).sort((a,b)=>(b.max-b.score)-(a.max-a.score));
  const chosen=(defects.length?defects:scores).filter((s,i,a)=>a.findIndex(v=>v.id===s.id||(v.message||v.reason)===(s.message||s.reason))===i).slice(0,4);
  if(!chosen.length)throw new Error('没有可执行的已保存审核问题，停止，不额外请求总监或写手');
  const tasks=chosen.map(item=>{const s={...item,...(item.fix?{fix:item.fix.replace(/可增加/g,'增加').split(/，或|；或|或者/)[0]}:{})};return {issueId:s.id,
    change:('定位'+(s.quote&&chapter.content.includes(s.quote)?'原文“'+s.quote.slice(0,60)+'”所在场景':'本章任务书与对应场景')+'。审核发现：'+(s.message||s.reason||s.dimension).slice(0,140)+'。'+(s.fix?'执行修改：'+s.fix.slice(0,160):'围绕该缺陷调整人物行动、动机、信息披露或对话，补足必要条件与后果；删去重复解释，保留有效情节。')+' 保持既定事实、人物知情边界和结尾因果。').slice(0,440),
    acceptance:('新正文必须解决“'+(s.message||s.reason||s.dimension).slice(0,220)+'”；'+(s.fix?'逐项验证：'+s.fix.slice(0,160)+'。':'用实际场景中的选择、条件和后果说明改善。')+'复审引用新正文证据，未解决记为false；不能凭换词、增加形容词或目标分数判定完成。').slice(0,320)};});
  const task=bindRevisionTask({baseHash:chapter.hash,diagnosis:`根据第${reviewCount(chapter)}次完整审核的真实缺陷发布返修指令；先修影响因果与人物的硬伤，再修节奏和表达。补充要求：${String(chapter.revisionInstruction||'无').slice(0,300)}`,tasks},book,chapter,cfg);
  return {...task,...(book.revisionPatchProtocol===1?{protocol:2}:{}),source:'saved_review_local',modelRequests:0};
}

// Quality and continuity remain separate: override never writes false facts.
export function supportedReleaseChanges(review,facts){
  const seen=new Set();return (review.changes||[]).filter(d=>{
    if(seen.has(d.key)||d.from===d.to||(Object.hasOwn(facts,d.key)?facts[d.key]!==d.from:d.from!==null))return false;
    seen.add(d.key);return true;
  });
}
export function releaseSavedReview(chapter,facts){
  if(!reviewLimitReached(chapter)||!chapter.review||chapter.gate?.pass!==false)throw new Error('没有达到五次完整审核的可放行结果');
  validateReview(chapter.review,chapter.content);
  if(chapter.gate.score!==dimensions.reduce((n,[key])=>n+chapter.review.scores[key].score,0))throw new Error('保存的审核分数不一致，停止，不制造五审放行');
  return {...chapter,status:'locked',needsPolish:true,lockedAt:new Date().toISOString(),error:null,release:{reason:'five_reviews',actualQualityPass:false,score:chapter.gate.score,issues:chapter.gate.issues,acceptedChanges:supportedReleaseChanges(chapter.review,facts),createdAt:new Date().toISOString()}};
}

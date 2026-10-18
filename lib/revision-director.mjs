// The director creates a task from the saved review; the author cannot grade it.
import {dimensions} from './quality.mjs';
export function revisionIssues(chapter){
  const entries=[];
  for(const [key,max,label] of dimensions){const score=chapter.review?.scores?.[key];if(score)entries.push({id:'S-'+key,dimension:label,score:score.score,max,reason:String(score.reason||'').slice(0,1000),quote:String(score.quote||'').slice(0,300)});}
  for(const [i,item] of [...(chapter.repairIssues?.length?chapter.repairIssues:chapter.gate?.issues||[]),...(chapter.review?.issues||[])].entries())entries.push({id:'I-'+(i+1),message:String(item.message||'').slice(0,1000),fix:String(item.fix||'').slice(0,1000),quote:String(item.quote||'').slice(0,300),severity:item.severity||item.code});
  return entries;
}
export function revisionDirectorPrompt(book,chapter){
  return `你是本书总监。根据已保存审核重新发布一次可执行的修改任务，不评分、不改正文、不追求凑到85分。原稿SHA256=${chapter.hash}。本轮${chapter.attempt}/3。审核总分${chapter.gate?.score??'未评分'}。实际缺陷来源${JSON.stringify(revisionIssues(chapter))}。章节因果与场景任务书${JSON.stringify(chapter.contract)}。每章目标${book.targetWords}汉字。补充要求${String(chapter.revisionInstruction||'').slice(0,2000)}。选最影响阅读体验的1至4个问题，逐一指定改哪里、增加或删除什么人物行动/选择/代价、用什么可观察结果验收；不能仅要求润色、加强、提高分数。不得改变既定事实、必要场景、人物知识或任务书要求，不重新规划全书。不要追加未被实际审核支持的问题。只返回JSON {baseHash:原SHA256,diagnosis:具体诊断,tasks:[{issueId:上述来源ID,change:具体改写任务,acceptance:正文验收条件}]}。来源不足、任务书结构矛盾或需要重做故事发动机时返回{baseHash,blocked:true,reason}。单字段不超过600字符，总输出最多3000字符。`;
}
export function bindRevisionTask(out,book,chapter,cfg){
  if(out?.baseHash!==chapter.hash)throw new Error('总监任务原稿哈希不符，停止，未交给写手');
  if(out.blocked===true)throw new Error('总监停止返修：'+String(out.reason||'需要人工检查故事架构').slice(0,600));
  const issues=revisionIssues(chapter),valid=new Set(issues.map(i=>i.id)),text=v=>typeof v==='string'&&v.trim()&&v.length<=600;
  if(!text(out.diagnosis)||!Array.isArray(out.tasks)||out.tasks.length<1||out.tasks.length>4||JSON.stringify(out).length>4000||out.tasks.some(t=>!valid.has(t.issueId)||!text(t.change)||!text(t.acceptance))||new Set(out.tasks.map(t=>t.issueId)).size!==out.tasks.length)throw new Error('总监修改任务缺少真实问题来源或可执行验收条件，停止，未请求写手');
  return {status:'planned',sourceHash:chapter.hash,round:chapter.attempt,baselineScore:chapter.gate?.score??null,configRevision:cfg.revision,planRevision:book.planRevision||1,styleRevision:book.styleRevision||0,diagnosis:out.diagnosis,tasks:out.tasks.map(t=>({...t,source:issues.find(i=>i.id===t.issueId)})),createdAt:new Date().toISOString()};
}
export function currentRevisionTask(chapter,book,cfg){const t=chapter.directorTask;return !!t&&t.status==='planned'&&t.sourceHash===chapter.hash&&t.round===chapter.attempt&&t.configRevision===cfg.revision&&t.planRevision===(book.planRevision||1)&&t.styleRevision===(book.styleRevision||0);}
export function revisionCheckIssues(chapter,review){
  if(chapter.directorTask?.status!=='written')return [];
  const tasks=chapter.directorTask.tasks,checks=review.revisionChecks;
  if(!Array.isArray(checks)||checks.length!==tasks.length||new Set(checks.map(x=>x.issueId)).size!==tasks.length||checks.some(x=>!tasks.some(t=>t.issueId===x.issueId)||typeof x.closed!=='boolean'||typeof x.reason!=='string'||!x.reason.trim()||typeof x.quote!=='string'||x.quote.trim().length<4||!chapter.content.includes(x.quote)))throw new Error('复审缺少总监任务逐项验收与新正文证据，停止，不自动重审');
  return checks.filter(x=>!x.closed).map((x,i)=>({id:'DIRECTOR-'+(i+1),code:'DIRECTOR_OPEN_TASK',severity:'major',message:x.issueId+'总监任务未完成：'+x.reason,quote:x.quote,fix:tasks.find(t=>t.issueId===x.issueId).acceptance}));
}

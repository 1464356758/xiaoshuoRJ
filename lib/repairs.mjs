import {hash} from './store.mjs';
import {count} from './quality.mjs';
export function repairFeasible(chapter,target) {
  const words=count(chapter.content),needed=Math.max(0,Math.ceil(target*.9)-words,words-Math.floor(target*1.12));
  return needed<=Math.max(1200,chapter.content.length*.4);
}
export function repairPrompt(book,chapter,mem) {
  const words=count(chapter.content),tooLong=words>book.targetWords*1.12;
  const deleteOnly=tooLong&&chapter.repairIssues?.length&&chapter.repairIssues.every(i=>i.code==='LENGTH');
  const editorFeedback=chapter.review?{scores:chapter.review.scores,issues:chapter.review.issues,deleteTest:chapter.review.deleteTest,architectureConcern:chapter.review.architectureConcern}:null;
  const lengthInstruction=deleteOnly?`本次仅因篇幅过长：当前${words}汉字，目标${book.targetWords}，修改后必须在${Math.ceil(book.targetWords*.9)}至${Math.floor(book.targetWords*1.12)}汉字。优先删去重复解释、重复心理和赘述，保留各场景实际行动、因果、对话关键信息和必要伏笔；建议删去${words-Math.floor(book.targetWords*1.1)}至${words-book.targetWords}汉字。每处after必须为空字符串，执行有选择的局部删除；不要复制原文充当修改。`:'只替换问题涉及的局部，after必须与被替换内容不同；不要输出不需要修改的段落。';
  return `你是原创中文小说返修作者。只修复已指出的问题，保持其余事实、人物声音和正文不变；不能用改几个字掩盖结构缺陷。${lengthInstruction}事实与原文上下文${JSON.stringify(mem)}。章节任务书${JSON.stringify(chapter.contract)}。缺陷及修复要求${JSON.stringify(chapter.repairIssues)}。本章真实编辑意见（包含各维度扣分原因和minor问题，按具体原因改善正文，不修改评分或虚构审稿结论）：${JSON.stringify(editorFeedback)}。当前正文SHA256=${chapter.hash}。实际全文：\n${chapter.content}\n只返回JSON {baseHash:上述SHA256,patches:[{startQuote:待替换范围开头的原文短句,endQuote:该范围结尾的原文短句,after:替换文字或空字符串}],resolved:[问题编号]}。startQuote/endQuote各8至80字符，必须逐字来自原文且各自唯一；范围包括这两个短句本身，程序从原稿恢复中间内容，不要输出before或复制完整待替换段落。每个范围最多4500字符，最多6处且互不重叠。总修改规模最多正文40%（短章至少容许1200字符），其余文字逐字保留；无法局部解决则返回{baseHash,blocked:true,reason:结构诊断}，不要重写整章，不更改任务书。`;
}
function anchoredBefore(content,patch){
  if(typeof patch.before==='string')return patch.before;
  const startQuote=patch.startQuote??patch.start_quote,endQuote=patch.endQuote??patch.end_quote;
  if((patch.startQuote!==undefined&&patch.start_quote!==undefined&&patch.startQuote!==patch.start_quote)||(patch.endQuote!==undefined&&patch.end_quote!==undefined&&patch.endQuote!==patch.end_quote))throw new Error('返修短句定位字段冲突，原稿保留');
  // The exact unique source range is the safety boundary, not an arbitrary quote length.
  if(typeof startQuote!=='string'||typeof endQuote!=='string'||!startQuote.trim()||!endQuote.trim()||startQuote.length>4500||endQuote.length>4500)throw new Error('返修短句定位无效，原稿保留');
  const start=content.indexOf(startQuote),end=content.indexOf(endQuote);
  if(start<0||end<start||content.indexOf(startQuote,start+1)>=0||content.indexOf(endQuote,end+1)>=0||end+endQuote.length<start+startQuote.length)throw new Error('返修短句定位不存在、不唯一或顺序错误，原稿保留');
  return content.slice(start,end+endQuote.length);
}
export async function applyRepair(chapter,response) {
  const digest=await hash(chapter.content);
  if(chapter.hash!==digest||response?.baseHash!==digest)throw new Error('返修基稿哈希已变化，原稿保留，未合并');
  if(response.blocked===true)return {blocked:true,reason:String(response.reason||'需要重新诊断章节结构').slice(0,2000)};
  if(!Array.isArray(response.patches)||!response.patches.length||response.patches.length>6)throw new Error('局部返修补丁结构无效，原稿保留');
  const ranges=response.patches.map(p=>{if(!p||typeof p!=='object')throw new Error('返修定位或替换内容无效');const before=anchoredBefore(chapter.content,p);if(before.length<8||before.length>4500||typeof p.after!=='string'||p.after.length>9000||before===p.after)throw new Error('返修定位或替换内容无效');const start=chapter.content.indexOf(before);if(start<0||chapter.content.indexOf(before,start+1)>=0)throw new Error('返修原文定位不存在或不唯一');return {...p,before,start,end:start+before.length};}).sort((a,b)=>a.start-b.start);
  if(ranges.some((r,i)=>i&&ranges[i-1].end>r.start))throw new Error('返修范围相互重叠');
  if(ranges.reduce((s,p)=>s+Math.max(p.before.length,p.after.length),0)>Math.max(1200,chapter.content.length*.4))throw new Error('返修范围过大，需要结构诊断，原稿保留');
  let content=chapter.content;for(const r of [...ranges].reverse())content=content.slice(0,r.start)+r.after+content.slice(r.end);
  return {content,hash:await hash(content),patchCount:ranges.length,changedCharacters:ranges.reduce((s,r)=>s+Math.max(r.before.length,r.after.length),0)};
}

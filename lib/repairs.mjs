import {hash} from './store.mjs';
import {count} from './quality.mjs';
export function repairFeasible(chapter,target) {
  const words=count(chapter.content),needed=Math.max(0,Math.ceil(target*.9)-words,words-Math.floor(target*1.12));
  return needed<=Math.max(1200,chapter.content.length*.4);
}
export function repairPrompt(book,chapter,mem) {
  return `你是原创中文小说返修作者。只修复已指出的问题，保持其余事实、人物声音和正文不变；不能用改几个字掩盖结构缺陷。事实与原文上下文${JSON.stringify(mem)}。章节任务书${JSON.stringify(chapter.contract)}。缺陷及修复要求${JSON.stringify(chapter.repairIssues)}。当前正文SHA256=${chapter.hash}。实际全文：\n${chapter.content}\n只返回JSON {baseHash:上述SHA256,patches:[{before:正文中唯一出现的完整原文片段,after:替换片段}],resolved:[问题编号]}。最多6处，before至少8字符，不能相互重叠。只能替换局部，总修改规模最多正文40%（短章至少容许1200字符），其余文字逐字保留；无法局部解决则返回{baseHash,blocked:true,reason:结构诊断}，不要重写整章，不更改任务书。`;
}
export async function applyRepair(chapter,response) {
  const digest=await hash(chapter.content);
  if(chapter.hash!==digest||response?.baseHash!==digest)throw new Error('返修基稿哈希已变化，原稿保留，未合并');
  if(response.blocked===true)return {blocked:true,reason:String(response.reason||'需要重新诊断章节结构').slice(0,2000)};
  if(!Array.isArray(response.patches)||!response.patches.length||response.patches.length>6)throw new Error('局部返修补丁结构无效，原稿保留');
  const ranges=response.patches.map(p=>{if(typeof p.before!=='string'||p.before.length<8||p.before.length>4500||typeof p.after!=='string'||p.after.length>9000||p.before===p.after)throw new Error('返修定位或替换内容无效');const start=chapter.content.indexOf(p.before);if(start<0||chapter.content.indexOf(p.before,start+1)>=0)throw new Error('返修原文定位不存在或不唯一');return {...p,start,end:start+p.before.length};}).sort((a,b)=>a.start-b.start);
  if(ranges.some((r,i)=>i&&ranges[i-1].end>r.start))throw new Error('返修范围相互重叠');
  if(ranges.reduce((s,p)=>s+Math.max(p.before.length,p.after.length),0)>Math.max(1200,chapter.content.length*.4))throw new Error('返修范围过大，需要结构诊断，原稿保留');
  let content=chapter.content;for(const r of [...ranges].reverse())content=content.slice(0,r.start)+r.after+content.slice(r.end);
  return {content,hash:await hash(content),patchCount:ranges.length,changedCharacters:ranges.reduce((s,r)=>s+Math.max(r.before.length,r.after.length),0)};
}

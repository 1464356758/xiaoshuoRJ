import {validateNarrativeEvidence,narrativeReviewIssues} from './narrative.mjs';
export const dimensions=[['commercial',20,'商业吸引力'],['causality',20,'结构与因果'],['character',20,'人物真实性'],['pace',15,'节奏与追读'],['language',15,'语言自然度'],['originality',10,'原创与完成']];
export const count=text=>(text.match(/[\p{Script=Han}]/gu)||[]).length;
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const listOrText=x=>nonempty(x)||Array.isArray(x)&&x.length>0&&x.every(nonempty);
export function validateReview(r,content) {
  if(!r||!Array.isArray(r.issues)||!Array.isArray(r.changes)||!Array.isArray(r.foreshadowing)||!nonempty(r.summary)||!listOrText(r.consequences)||!listOrText(r.questions)||!nonempty(r.signature?.conflict)||!nonempty(r.signature?.solution)||!nonempty(r.signature?.emotion))throw new Error('审核响应结构不完整，未锁定也未自动付费修复JSON');
  if(r.issues.some(i=>!i||!['fatal','major','minor'].includes(i.severity)||!nonempty(i.message))||r.foreshadowing.some(f=>!f||!['string','number'].includes(typeof f.id)||!['open','paid'].includes(f.status)||!nonempty(f.evidence)))throw new Error('审核缺陷或伏笔结构无效');
  const scalar=x=>x===null||typeof x==='string'||typeof x==='boolean'||typeof x==='number'&&Number.isFinite(x);
  if(r.changes.some(d=>!d||!nonempty(d.key)||['__proto__','constructor','prototype'].includes(d.key)||!Object.hasOwn(d,'from')||!Object.hasOwn(d,'to')||!scalar(d.from)||!scalar(d.to)||!nonempty(d.reason)||!nonempty(d.quote)))throw new Error('审核事实变化结构无效');
  if(content!==undefined) {
    if(dimensions.some(([key,max])=>{const s=r.scores?.[key];return !s||!Number.isFinite(s.score)||s.score<0||s.score>max||!nonempty(s.reason)||!nonempty(s.quote)||s.quote.trim().length<4||!content.includes(s.quote);})||r.changes.some(d=>!content.includes(d.quote))||r.issues.some(i=>i.quote&&!content.includes(i.quote)))throw new Error('审核原文证据无效，保留正文并停止；不能改小说迎合虚构引用');
  }
  if(JSON.stringify(r).length>65000)throw new Error('审核响应超出范围');return r;
}
const norm=t=>t.replace(/[\s\p{P}]/gu,'');
function shingles(t) { const n=norm(t); const s=new Set(); for(let i=0;i<n.length-12;i+=4) s.add(n.slice(i,i+12)); return s; }
export function similarity(a,b) { const x=shingles(a),y=shingles(b); if(!x.size||!y.size)return 0; let n=0; for(const s of x)if(y.has(s))n++; return n/Math.min(x.size,y.size); }
export function factsFrom(plan,chapters) {
  const facts=Object.assign(Object.create(null),plan?.facts||{});
  for(const c of [...chapters].filter(c=>c.status==='locked').sort((a,b)=>a.number-b.number)) {
    for(const d of c.review?.changes||[]) facts[d.key]=d.to;
  } return facts;
}
export function checkChapter(chapter,past,facts,target) {
  const issues=[]; const text=chapter.content||'';
  if(count(text)<target*.9||count(text)>target*1.12)issues.push({code:'LENGTH',message:`正文 ${count(text)} 汉字，目标 ${target}，需调整篇幅`});
  const ps=text.split(/\n+/).map(norm).filter(p=>p.length>35); const seen=new Set();
  for(const p of ps){if(seen.has(p))issues.push({code:'DUPLICATE',message:'章内存在完全重复段落',quote:p.slice(0,60)});seen.add(p);}
  for(const c of past) {
    const s=similarity(text,c.content||'');
    if(s>.34)issues.push({code:'TEXT_LOOP',message:`与第 ${c.number} 章文本重复率过高 ${Math.round(s*100)}%`});
    const a=chapter.review?.signature,b=c.review?.signature;
    if(a&&b&&a.conflict===b.conflict&&a.solution===b.solution&&a.emotion===b.emotion)issues.push({code:'STRUCTURE_LOOP',message:`与第 ${c.number} 章冲突、解决手段、情绪结构均重复`});
  }
  const changed=new Set();
  for(const d of chapter.review?.changes||[]) {
    if(typeof d.key!=='string'||!d.key||changed.has(d.key)||!Object.hasOwn(d,'from')||!Object.hasOwn(d,'to')||d.from===d.to)issues.push({code:'INVALID_DELTA',message:'状态变化键重复、不完整或没有实际变化'});
    changed.add(d.key);
    if(!Object.hasOwn(facts,d.key)&&d.from!==null)issues.push({code:'INVENTED_PRIOR',message:`新事实 ${d.key} 必须从null开始，不能虚构既有事实`});
    if(Object.hasOwn(facts,d.key)&&facts[d.key]!==d.from)issues.push({code:'CONTINUITY',message:`事实冲突：${d.key} 原值 ${facts[d.key]}，本章却以 ${d.from} 为起点`});
    if(!d.reason||!text.includes(d.quote||'\u0000'))issues.push({code:'UNSUPPORTED_DELTA',message:`状态变化 ${d.key} 缺少正文证据`});
  }
  return issues;
}
export function qualityGate(chapter,past,facts,target,book,memory) {
  const r=chapter.review;
  if(r){try{validateReview(r);}catch(e){return {pass:false,score:0,issues:[{code:'REVIEW_SCHEMA',message:e.message}]};}}
  const issues=checkChapter(chapter,past,facts,target);
  if(!r)return {pass:false,score:0,issues:[...issues,{code:'NO_REVIEW',message:'尚未完成正式审核'}]};
  let score=0;
  if(r.architectureConcern)issues.push({code:'ARCHITECTURE',message:String(r.architectureConcern)});
  for(const [key,max,label] of dimensions) {
    const v=r.scores?.[key];
    if(!v||!Number.isFinite(v.score)||v.score<0||v.score>max||!nonempty(v.reason)||!nonempty(v.quote)||v.quote.trim().length<4||!chapter.content.includes(v.quote))issues.push({code:'EVIDENCE',message:`${label}评分缺少有效正文引用`});
    else {score+=v.score;if(['commercial','causality','character'].includes(key)&&v.score<14)issues.push({code:'CORE_SCORE',message:`${label}核心分不足14`});}
  }
  if(!nonempty(r.deleteTest?.loss)||r.deleteTest.necessary!==true)issues.push({code:'DELETE_TEST',message:'删除本章不会产生可证明的实质损失'});
  if(!Array.isArray(r.changes)||!r.changes.length)issues.push({code:'NO_DELTA',message:'本章没有结构化状态变化'});
  if(!r.summary||!r.signature?.conflict||!r.signature?.solution||!r.signature?.emotion)issues.push({code:'NO_MEMORY',message:'缺少故事摘要或结构指纹'});
  for(const f of r.foreshadowing)if(f.status==='paid'&&!chapter.content.includes(f.evidence))issues.push({code:'FORESHADOW_EVIDENCE',message:`伏笔${f.id}声称兑现但缺少实际原文依据`});
  if([2,3].includes(chapter.contract?.schema)) {
    const evidence=r.sceneEvidence,scenes=chapter.contract.scenes||[];
    if(!Array.isArray(evidence)||evidence.length!==scenes.length||scenes.some((s,i)=>!evidence.some(e=>e.scene===i+1&&nonempty(e.quote)&&e.quote.trim().length>=4&&chapter.content.includes(e.quote)&&nonempty(e.reason)))||new Set((evidence||[]).map(e=>e.quote)).size!==scenes.length)issues.push({code:'SCENE_EVIDENCE',message:'每个场景都需要不同的实际原文依据与结果说明'});
    for(const d of chapter.contract.requiredDelta||[])if(!r.changes.some(x=>x.key===d.key&&x.from===d.from&&x.to===d.to))issues.push({code:'REQUIRED_DELTA',message:`章纲要求的变化未兑现：${d.key}`,fix:'在既定场景中兑现该变化，并给出实际原文证据'});
    for(const d of chapter.contract.forbidden||[])if(r.changes.some(x=>x.key===d.key&&x.to===d.to))issues.push({code:'FORBIDDEN_DELTA',message:`发生了章纲禁止的变化：${d.key}`});
  }
  if(chapter.contract?.schema===3){try{validateNarrativeEvidence(chapter,book,memory);issues.push(...narrativeReviewIssues(chapter,book,memory));}catch(e){issues.push({code:'NARRATIVE_EVIDENCE',message:e.message});}}
  for(const i of r.issues||[]) if(i.severity==='fatal'||i.severity==='major')issues.push({code:'EDITOR',severity:i.severity,message:i.message,quote:i.quote,fix:i.fix||''});
  if(score<85)issues.push({code:'SCORE',message:`总分 ${score}，不足85`});
  return {pass:issues.length===0,score,issues:issues.map((i,n)=>({...i,id:'ISSUE-'+(n+1)}))};
}
export function textPreflight(chapter,past,target) {return checkChapter({...chapter,review:null},past,{},target);}
export function validatePlan(p,total) {
  if(!Array.isArray(p.candidates)||p.candidates.length<3||new Set(p.candidates.map(c=>c.engine)).size<3)throw new Error('选题方案不足三个，或故事发动机重复');
  if(!p.title||!p.bible||!p.style||!p.facts||!Array.isArray(p.characters)||p.characters.length<4)throw new Error('故事圣经或人物档案不完整');
  if(!Array.isArray(p.arcs)||p.arcs.length<Math.ceil(total/10)||p.arcs.some(a=>!a.irreversibleChange||!a.goal))throw new Error('阶段规划缺少不可逆变化');
  const rolling=p.planningMode==='rolling';
  if(!Array.isArray(p.contracts)||(!rolling&&p.contracts.length!==total)||(rolling&&(!p.contracts.length||p.contracts.length>total))||p.contracts.some((c,i)=>c.number!==i+1||!c.goal||!c.consequence||!c.method||!c.title))throw new Error('全书章节合同缺失或顺序不完整');
  return p;
}

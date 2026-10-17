import {hash} from './store.mjs';

export const STYLE_LIMITS={references:8,referenceChars:8000,totalChars:48000,tasks:40,bindings:24};
export const STYLE_DIMENSIONS=['视角','节奏','对白','细节','情绪','信息'];
const text=(v,max,min=1)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const clean=v=>v.replace(/[\s\p{P}\p{S}]/gu,'');

export function referenceInput(input) {
  if(!input||input.consent!==true)throw new Error('请确认有权将所选参考片段发送给已配置模型做技法分析');
  if(!text(input.title,120)||!text(input.text,STYLE_LIMITS.referenceChars,200)||input.text.trim().length<200)throw new Error('参考名称必填，原文需为200至8000字符；请选取片段');
  if(input.author!==undefined&&!text(input.author,100,0)||input.source!==undefined&&!text(input.source,500,0))throw new Error('作者或来源说明过长');
  if(!['opening','middle','ending','dialogue','other'].includes(input.stage))throw new Error('参考片段位置无效');
  return {title:input.title.trim(),author:(input.author||'').trim(),source:(input.source||'').trim(),stage:input.stage,text:input.text.replace(/^\ufeff/,'').trim(),consent:true};
}
export function validateStyleCard(card) {
  if(!card||!text(card.name,80)||!text(card.summary,400)||!Array.isArray(card.rules)||card.rules.length!==6)throw new Error('文风规则需有名称、概述及六个技法维度');
  const seen=new Set();
  for(const r of card.rules){if(!r||!STYLE_DIMENSIONS.includes(r.dimension)||seen.has(r.dimension)||!text(r.instruction,250)||!text(r.when,180)||!text(r.avoid,180))throw new Error('文风规则的维度、做法、适用条件或禁忌不完整');seen.add(r.dimension);}
  if(!Array.isArray(card.exclusions)||card.exclusions.length<1||card.exclusions.length>8||card.exclusions.some(v=>!text(v,160)))throw new Error('需要列出不能沿用的具体表达、设定或情节');
  return {name:card.name.trim(),summary:card.summary.trim(),rules:card.rules.map(r=>({dimension:r.dimension,instruction:r.instruction,when:r.when,avoid:r.avoid})),exclusions:card.exclusions};
}
export async function profileHash(profile) {
  return hash(JSON.stringify({schema:1,card:validateStyleCard(profile.card),sources:profile.sources.map(s=>({key:s.key,hash:s.hash})),evidence:profile.evidence}));
}
export async function validateProfile(profile) {
  if(!profile||profile.schema!==1||!digest(profile.key)||!Array.isArray(profile.sources)||!profile.sources.length||profile.sources.length>STYLE_LIMITS.references||new Set(profile.sources.map(s=>s.key)).size!==profile.sources.length||profile.sources.some(s=>!digest(s.key)||!digest(s.hash)))throw new Error('文风来源或版本结构无效');
  validateStyleCard(profile.card);
  if(!Array.isArray(profile.evidence)||profile.evidence.length<6||profile.evidence.length>24||new Set(profile.evidence.map(e=>e.dimension)).size!==6||profile.evidence.some(e=>!STYLE_DIMENSIONS.includes(e?.dimension)||!text(e.quote,100,4)||!text(e.lesson,400)||!profile.sources.some(s=>s.key===e.referenceKey)))throw new Error('文风分析证据结构不完整');
  if(!digest(profile.hash)||profile.hash!==await profileHash(profile))throw new Error('文风规则版本校验失败');
  return profile;
}
export async function validateStyleBindings(book) {
  if(book.styleBindings===undefined)return [];
  if(!Array.isArray(book.styleBindings)||book.styleBindings.length>STYLE_LIMITS.bindings)throw new Error('文风版本集无效或过多');
  if(!Number.isInteger(book.styleRevision)||book.styleRevision<0)throw new Error('文风修订号无效');
  let from=0;
  for(const binding of book.styleBindings){
    if(!binding||!Number.isInteger(binding.fromChapter)||binding.fromChapter<=from||binding.fromChapter>book.totalChapters||!digest(binding.trialKey)||!text(binding.activatedAt,80)||binding.confirmRead!==true)throw new Error('文风生效章节或试读确认无效');
    await validateProfile(binding.profile);from=binding.fromChapter;
    if(binding.anchor){if(!text(binding.anchor.text,800,50)||binding.anchor.hash!==await hash(binding.anchor.text)||binding.anchor.source!=='trial_not_canon')throw new Error('原创试写锚点校验失败');}
  }
  return book.styleBindings;
}
export function styleAt(book,number=1) {return (book?.styleBindings||[]).filter(b=>b.fromChapter<=number).at(-1)||null;}
export function styleRange(book,start,end) {
  const a=styleAt(book,start),rest=(book?.styleBindings||[]).filter(b=>b.fromChapter>start&&b.fromChapter<=end);
  return [...(a?[a]:[]),...rest].map(b=>({fromChapter:b.fromChapter,profileHash:b.profile.hash,card:b.profile.card}));
}
export function stylePrompt(book,number=1,role='write') {
  const binding=styleAt(book,number);if(!binding)return '';
  const isReview=['review','opening_review','arc_review'].includes(role);
  return '\n本书已确认的文风规则（只约束表达；不替换人物、世界设定或本章事实；保留既定叙述人称、视角、时态和人物口吻基线，冲突时以既定基线为准）：'+JSON.stringify({version:binding.profile.hash,card:binding.profile.card})+
    (role==='write'&&number===binding.fromChapter&&binding.anchor?'\n本书原创试写示范（非正式剧情，不可当作发生过的事实；优先衔接本书定稿原文）：'+binding.anchor.text:'')+
    (isReview?'\n文风也须保留人物差异与本场景需要。若表达漂移或沿用参考书具体内容，列入原有issues并引用实际正文、给出局部修改；不能凭规则条数或华丽程度给高分。':'\n这些技法允许按场景调节；不要把所有人物写成同一种口吻，不机械套用固定句式。不得沿用参考书原句、人物关系或连续情节。');
}
export function validateStyleEvidence(review,chapter,book) {
  const binding=styleAt(book,chapter.number);if(!binding)return review;
  const evidence=review?.styleEvidence;
  if(!Array.isArray(evidence)||evidence.length<2||evidence.length>12||new Set(evidence.map(e=>e.dimension)).size<2||evidence.some(e=>!STYLE_DIMENSIONS.includes(e?.dimension)||!text(e.quote,300,4)||!chapter.content.includes(e.quote)||!text(e.reason,500)))throw new Error('文风审校缺少至少两个不同维度的实际原文证据，未自动付费返修');
  return review;
}
export function styleReviewInstruction(book,number) {return styleAt(book,number)?'\nJSON另含styleEvidence:[{dimension:"视角|节奏|对白|细节|情绪|信息",quote:实际正文,reason:对照文风及场景的判断}]，至少两个不同维度；偏离问题进入原issues。':'';}

// Local textual overlap is a review signal, never proof of all-web originality.
export function referenceOverlap(content,references) {
  const normalized=clean(content||'');if(normalized.length<40)return [];
  const grams=new Set();for(let i=0;i<=normalized.length-40;i++)grams.add(normalized.slice(i,i+40));
  const hits=[];
  for(const ref of references){const source=clean(ref.text||'');for(let i=0;i<=source.length-40;i++){const quote=source.slice(i,i+40);if(grams.has(quote)){hits.push({code:'STYLE_REFERENCE_OVERLAP',severity:'major',referenceKey:ref.key,title:ref.title,quote,message:'正文与参考片段存在至少40字符连续重合，请检查具体表达，未请求付费审稿'});break;}}if(hits.length===5)break;}
  return hits;
}
export function validateStyleComparison(out,task) {
  if(!Array.isArray(task?.blindOrder)||task.blindOrder.length!==2||new Set(task.blindOrder).size!==2||task.blindOrder.some(k=>!['baseline','enhanced'].includes(k))||!out||!['A','B','tie','neither'].includes(out.winner)||!text(out.reason,1500))throw new Error('对照审核结构不完整');
  for(const [i,label] of ['A','B'].entries()){
    const v=out.variants?.[label],content=task.variants?.[task.blindOrder[i]]?.text;
    if(!text(content,7000,300)||!v||typeof v.ready!=='boolean'||!Array.isArray(v.evidence)||v.evidence.length<2||v.evidence.length>10||new Set(v.evidence.map(e=>e?.quote)).size<2||v.evidence.some(e=>!text(e?.quote,300,4)||!content.includes(e.quote)||!text(e.reason,600))||!Array.isArray(v.issues)||v.issues.length>20||v.issues.some(e=>!['fatal','major','minor'].includes(e?.severity)||!text(e.quote,300,4)||!content.includes(e.quote)||!text(e.message,600)||!text(e.fix,600)))throw new Error('对照审核缺少真实引文或问题定位，未放行');
  }
  const enhancedLabel=task.blindOrder.indexOf('enhanced')===0?'A':'B',enhanced=out.variants[enhancedLabel];
  return {report:out,enhancedLabel,pass:enhanced.ready&&!enhanced.issues.some(i=>['fatal','major'].includes(i.severity))&&out.winner!=='neither'};
}

export async function validateStyleArchive(book,references=[],profiles=[],tasks=[]) {
  await validateStyleBindings(book);
  if(!Array.isArray(references)||references.length>STYLE_LIMITS.references||!Array.isArray(profiles)||profiles.length>STYLE_LIMITS.tasks||!Array.isArray(tasks)||tasks.length>STYLE_LIMITS.tasks)throw new Error('备份文风资料数量无效');
  let total=0;const keys=new Set();
  for(const ref of references){referenceInput(ref);if(ref.hash!==await hash(ref.text)||ref.key!==ref.hash||keys.has(ref.key)||typeof ref.archived!=='boolean')throw new Error('备份参考文本校验失败');keys.add(ref.key);total+=ref.text.length;}
  if(total>STYLE_LIMITS.totalChars)throw new Error('参考文本总容量超限');
  for(const profile of profiles){await validateProfile(profile);for(const source of profile.sources)if(!references.some(r=>r.key===source.key&&r.hash===source.hash))throw new Error('文风分析缺少原始参考片段');for(const e of profile.evidence)if(!references.some(r=>r.key===e.referenceKey&&r.text.includes(e.quote)))throw new Error('文风分析原文证据校验失败');}
  for(const binding of book.styleBindings||[])for(const source of binding.profile.sources)if(!references.some(r=>r.key===source.key&&r.hash===source.hash))throw new Error('绑定文风缺少对应参考文本，不能跳过重合检查');
  for(const task of tasks){
    if(!task||!digest(task.key)||!['analysis','trial'].includes(task.type)||!['ready','running','paused','blocked','completed'].includes(task.status)||!['analysis','baseline','enhanced','review','done'].includes(task.phase)||!digest(task.basisHash)||!Array.isArray(task.sources)||!task.sources.length||task.sources.some(s=>!references.some(r=>r.key===s.key&&r.hash===s.hash))||Object.keys(task.variants||{}).some(k=>!['baseline','enhanced'].includes(k))||JSON.stringify(task).length>60000||!text(task.createdAt,80)||['planner','writer','review'].some(k=>!text(task.models?.[k]?.provider,60)||!text(task.models?.[k]?.model,150)))throw new Error('文风实验备份结构或来源无效');
    for(const v of Object.values(task.variants||{}))if(!v||!text(v.text,7000,100)||v.hash!==await hash(v.text))throw new Error('文风试写正文校验失败');
    if(task.type==='trial'){
      if(!task.context||!text(task.context.brief,2000,80)||!Number.isInteger(task.context.chapterNumber)||!profiles.some(p=>p.key===task.profileKey&&p.hash===task.profileHash))throw new Error('试写备份缺少共同任务或文风版本');
      if(task.status==='completed'&&(!task.review||task.pass!==validateStyleComparison(task.review,task).pass))throw new Error('试写备份审核结论不一致');
    }
  }
  for(const binding of book.styleBindings||[]){
    const profile=profiles.find(p=>p.key===binding.profile.key&&p.hash===binding.profile.hash),task=tasks.find(t=>t.key===binding.trialKey&&t.type==='trial'&&t.status==='completed'&&t.profileHash===binding.profile.hash&&t.pass);
    if(!profile||!task||!validateStyleComparison(task.review,task).pass||binding.anchor&&!task.variants.enhanced.text.startsWith(binding.anchor.text))throw new Error('绑定文风缺少相符的已完成对照与来源证据');
  }
}

export function styleStatus(book) {const bindings=book?.styleBindings||[];return {bindings:bindings.map(b=>({fromChapter:b.fromChapter,name:b.profile.card.name,hash:b.profile.hash})),version:book?.styleRevision||0};}

// Deterministic narrative checks. No model calls, provider keys or cross-book data.
const text=(x,max=4000)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
const id=x=>(typeof x==='string'||typeof x==='number')?String(x):'';
const validId=x=>/^[A-Za-z0-9_-]{1,64}$/.test(id(x));
const rows=x=>Array.isArray(x)?x:[];
const norm=x=>String(x||'').replace(/[\s\p{P}]/gu,'').toLowerCase();
export const MAX_PROMISE_ACTIONS=40;
function assertPromiseCapacity(items,after=0) {
  const load=new Map();
  for(const f of items){if(f.status==='paid')continue;for(const n of [f.status==='planned'?f.plantChapter:null,f.dueChapter])if(Number.isInteger(n)&&n>after){const count=(load.get(n)||0)+1;load.set(n,count);if(count>MAX_PROMISE_ACTIONS)throw new Error('伏笔计划在第'+n+'章超过'+MAX_PROMISE_ACTIONS+'项必需行动，请分散计划；未自动延长期限');}}
}
export const advancedNarrative=book=>book?.workflowVersion===2&&book?.narrativeProtocol===1;
export function validateNarrativePlan(plan,total) {
  if(!text(plan?.bible?.readerPromise)||!text(plan?.bible?.themeQuestion)||!text(plan?.bible?.endingCost))throw new Error('故事规格缺少读者承诺、主题问题或结局代价');
  const people=rows(plan.characters),ids=new Set(),names=new Set();
  if(people.length<4||people.length>40)throw new Error('高级人物档案需要4–40名有独立身份的人物');
  for(const c of people){if(!validId(c?.id)||ids.has(id(c.id))||!text(c.name,80)||names.has(c.name)||['goal','desire','weakness','voice','cost','knowledge'].some(k=>!text(c[k])))throw new Error('人物ID、姓名或独立动机档案不完整/重复');ids.add(id(c.id));names.add(c.name);}
  if(!Array.isArray(plan.foreshadowing)||plan.foreshadowing.length>100)throw new Error('承诺计划需要明确数组，最多100项');
  const promises=new Set();
  for(const f of plan.foreshadowing){if(!validId(f?.id)||promises.has(id(f.id))||!text(f.promise)||!Number.isInteger(f.plantChapter)||!Number.isInteger(f.dueChapter)||f.plantChapter<1||f.dueChapter<=f.plantChapter||f.dueChapter>total)throw new Error('伏笔ID重复，或埋设/兑现期限不完整');promises.add(id(f.id));}
  assertPromiseCapacity(plan.foreshadowing.map(f=>({...f,status:'planned'})));
  return plan;
}
export function promiseLedger(book,chapters=[]) {
  const strict=advancedNarrative(book),map=new Map(),warnings=[];
  for(const f of rows(book?.plan?.foreshadowing)) {
    if(!f||!id(f.id))continue;const key=id(f.id);
    if(map.has(key)){warnings.push({code:'DUPLICATE_PROMISE',id:key,message:'计划伏笔ID重复，请检查原规划'});continue;}
    map.set(key,{id:key,promise:typeof f.promise==='string'?f.promise:'未记录具体承诺',plantChapter:Number.isInteger(f.plantChapter)?f.plantChapter:null,dueChapter:Number.isInteger(f.dueChapter)?f.dueChapter:null,status:strict?'planned':'open',plantedAt:null,paidAt:null,plantQuote:null,payQuote:null,source:'plan'});
  }
  for(const c of rows(chapters).filter(c=>c.status==='locked').sort((a,b)=>a.number-b.number))for(const f of rows(c.review?.foreshadowing)) {
    if(!f||!id(f.id)||!['open','paid'].includes(f.status))continue;const key=id(f.id);
    let old=map.get(key);
    if(!old){old={id:key,promise:text(f.promise)?f.promise:'正文新增承诺（未记录描述）',plantChapter:c.number,dueChapter:Number.isInteger(f.dueChapter)?f.dueChapter:null,status:'planned',plantedAt:null,paidAt:null,plantQuote:null,payQuote:null,source:'chapter'};}
    if(old.status==='paid'){if(f.status==='open')warnings.push({code:'REOPENED_PROMISE',id:key,chapter:c.number,message:'已兑现承诺被再次打开，需检查'});continue;}
    const next={...old}; // Events cannot replace the original promise or deadline.
    if(f.status==='open'){next.status='open';if(next.plantedAt===null){next.plantedAt=c.number;next.plantQuote=typeof f.evidence==='string'?f.evidence:null;}}
    else {next.status='paid';next.paidAt=c.number;next.payQuote=typeof f.evidence==='string'?f.evidence:null;}
    map.set(key,next);
  }
  return {items:[...map.values()],warnings};
}
export function narrativeBrief(book,chapters,number) {
  const ledger=promiseLedger(book,chapters);
  return {...ledger,toPlant:ledger.items.filter(f=>f.status==='planned'&&f.plantChapter!==null&&f.plantChapter<=number).map(f=>f.id),toPay:ledger.items.filter(f=>f.status==='open'&&f.dueChapter!==null&&f.dueChapter<=number).map(f=>f.id)};
}
export function validateNarrativeContract(c,book,chapters,number) {
  if(!advancedNarrative(book))return c;
  const p=book.plan.characters.find(p=>id(p.id)===id(c.characterFocus?.characterId));
  if(c.schema!==3||!p||!text(c.characterFocus?.want)||!text(c.characterFocus?.dilemma)||!c.scenes.some(s=>rows(s.characters).includes(p.name)))throw new Error('高级任务书缺少已知焦点人物及其欲望取舍');
  if(['conflict','method','emotion'].some(k=>!text(c.drama?.[k])))throw new Error('高级任务书缺少本章冲突、手段和情绪结构');
  const same=rows(chapters).filter(p=>p.status==='locked'&&p.number<number).sort((a,b)=>b.number-a.number).slice(0,3).find(p=>['conflict','method','emotion'].every(k=>norm(c.drama[k])===norm(p.review?.signature?.[k==='method'?'solution':k])));
  if(same)throw new Error('章节任务书与最近第'+same.number+'章结构完全重复，未开始付费正文；请检查后续详纲');
  const brief=narrativeBrief(book,chapters,number),byId=new Map(brief.items.map(f=>[f.id,f])),seen=new Set();
  if(!Array.isArray(c.promiseActions)||c.promiseActions.length>MAX_PROMISE_ACTIONS)throw new Error('高级任务书缺少伏笔行动清单（无行动时为空数组）');
  for(const a of c.promiseActions){const key=id(a?.id),f=byId.get(key),pair=key+':'+a?.action;
    if(!f||!['plant','pay'].includes(a.action)||seen.has(pair)||!Number.isInteger(a.scene)||a.scene<1||a.scene>c.scenes.length||!text(a.reason))throw new Error('伏笔行动ID、场景或原因无效');
    if(a.action==='plant'&&(f.status!=='planned'||f.plantChapter>number)||a.action==='pay'&&f.status!=='open')throw new Error('伏笔行动与已锁事件状态不一致，不得重开已兑现承诺');seen.add(pair);
  }
  if(brief.toPlant.some(key=>!seen.has(key+':plant'))||brief.toPay.some(key=>!seen.has(key+':pay')))throw new Error('本章任务书遗漏到期埋设/兑现的承诺，未开始付费正文');
  return c;
}
export function validateNarrativeEvidence(chapter,book,memory) {
  const r=chapter.review;if(chapter.contract?.schema!==3)return r;
  const people=rows(book?.plan?.characters),known=new Set(people.map(p=>id(p.id))),focus=id(chapter.contract.characterFocus?.characterId),literal=q=>text(q)&&q.trim().length>=4&&chapter.content.includes(q);
  if(!Array.isArray(r?.characterBeats)||!r.characterBeats.length||r.characterBeats.length>8||!r.characterBeats.some(b=>id(b?.characterId)===focus)||r.characterBeats.some(b=>!known.has(id(b?.characterId))||!text(b.choice)||!text(b.consequence)||!literal(b.quote)))throw new Error('人物选择证据无效：必须绑定焦点人物与真实原文，保留正文并停止');
  const a=r.antiLoop,sources=rows(memory?.source);
  if(!a||!['distinct','similar','insufficient','no_prior'].includes(a.status)||!text(a.reason)||!Array.isArray(a.comparisons)||a.comparisons.length>3||a.status==='no_prior'&&sources.length||['distinct','similar'].includes(a.status)&&!a.comparisons.length||a.status==='similar'&&!['minor','major'].includes(a.severity))throw new Error('反重复审稿结构无效，不自动付费修复响应');
  const seen=new Set(),comparisons=a.comparisons.map(x=>{const source=sources.find(s=>s.chapter===x?.chapter);
    if(!source||seen.has(x.chapter)||!literal(x.currentQuote)||!text(x.pastQuote)||x.pastQuote.trim().length<4||!source.text.includes(x.pastQuote)||!text(x.difference))throw new Error('反重复引用不属于本轮实际提供的旧稿，保留正文并停止');seen.add(x.chapter);return {...x,sourceHash:source.hash,start:source.start,end:source.end};});
  const ledger=new Map(rows(memory?.narrative?.items).map(f=>[f.id,f])),events=new Set();
  for(const f of r.foreshadowing){const key=id(f.id),old=ledger.get(key);if(!validId(f.id)||events.has(key)||!literal(f.evidence))throw new Error('伏笔事件ID重复或缺少实际原文依据');events.add(key);
    if(old){if(f.promise!==undefined&&f.promise!==old.promise||f.dueChapter!==undefined&&f.dueChapter!==old.dueChapter||f.plantChapter!==undefined&&f.plantChapter!==old.plantChapter)throw new Error('审核不得修改既定伏笔定义或兑现期限');if(old.status==='paid'||f.status==='paid'&&old.status!=='open'||f.status==='open'&&(old.status!=='planned'||old.plantChapter>chapter.number))throw new Error('审核伏笔状态转换无效，不能重开已兑现承诺');if(!chapter.contract.promiseActions.some(a=>id(a.id)===key&&a.action===(f.status==='open'?'plant':'pay')))throw new Error('已知伏笔事件必须对应已批准的本章任务书行动');}
    else if(f.status!=='open'||!text(f.promise)||!Number.isInteger(f.dueChapter)||f.dueChapter<=chapter.number||f.dueChapter>book.totalChapters)throw new Error('新增伏笔须说明承诺及未来期限；不能凭空声称兑现');
    ledger.set(key,old?{...old,status:f.status==='paid'?'paid':'open'}:{id:key,promise:f.promise,status:'open',plantChapter:chapter.number,dueChapter:f.dueChapter});
  }
  assertPromiseCapacity([...ledger.values()],chapter.number);
  return {...r,antiLoop:{...a,comparisons}};
}
export function narrativeReviewIssues(chapter,book,memory) {
  if(chapter.contract?.schema!==3)return [];
  const r=chapter.review,issues=[];
  if(r.antiLoop.status==='similar'&&r.antiLoop.severity==='major')issues.push({code:'NARRATIVE_LOOP',message:'编辑发现与已读旧稿存在重要结构重复：'+r.antiLoop.reason});
  if(r.antiLoop.status==='insufficient')issues.push({code:'NARRATIVE_CONTEXT',message:'编辑认为旧稿资料不足：'+r.antiLoop.reason});
  for(const a of chapter.contract.promiseActions)if(!r.foreshadowing.some(f=>id(f.id)===id(a.id)&&f.status===(a.action==='plant'?'open':'paid')))issues.push({code:'PROMISE_ACTION',message:'任务书要求的承诺行动未兑现：'+a.id+' / '+(a.action==='plant'?'埋设':'兑现'),fix:'落实该任务书行动，以实际原文证明，不修改承诺或期限'});
  return issues;
}
export function narrativeDashboard(book,chapters=[]) {
  if(!book)return null;
  if(!book.plan&&book.planningDraft?.outline)book={...book,plan:book.planningDraft.outline};
  const locked=rows(chapters).filter(c=>c.status==='locked').sort((a,b)=>a.number-b.number),number=locked.length+1,brief=narrativeBrief(book,locked,number),people=rows(book.plan?.characters);
  const items=brief.items.map(f=>({...f,timing:f.status==='paid'?'paid':f.status==='planned'&&f.plantChapter!==null&&f.plantChapter<=number?'plant_due':f.status==='open'&&f.dueChapter!==null&&f.dueChapter<=number?'pay_due':'later'}));
  const currentArc=rows(book.plan?.arcs).find(a=>a.start<=number&&a.end>=number);
  return {advanced:advancedNarrative(book),nextChapter:number,finished:number>book.totalChapters,totalChapters:book.totalChapters,readerPromise:book.plan?.bible?.readerPromise||'',themeQuestion:book.plan?.bible?.themeQuestion||'',endingCost:book.plan?.bible?.endingCost||'',currentArc:currentArc||null,promises:items,warnings:brief.warnings,
    counts:{locked:locked.length,active:items.filter(f=>f.status==='open').length,paid:items.filter(f=>f.status==='paid').length,due:items.filter(f=>['plant_due','pay_due'].includes(f.timing)).length},
    upcoming:rows(book.plan?.contracts).filter(c=>c.number>=number).slice(0,3),
    characters:people.map(p=>{const history=locked.flatMap(c=>rows(c.review?.characterBeats).filter(b=>id(b.characterId)===id(p.id)&&p.id!=null).map(b=>({...b,chapter:c.number})));return {id:p.id||p.name,name:p.name,goal:p.goal,desire:p.desire,voice:p.voice,beats:history.slice(-3)};}),
    quality:locked.map(c=>({chapter:c.number,title:c.title,score:Number.isFinite(c.gate?.score)?c.gate.score:null,attempts:c.attempt||0,signature:c.review?.signature||null,antiLoop:c.review?.antiLoop?.status||'legacy'})),
    reminders:rows(chapters).filter(c=>c.status!=='locked').flatMap(c=>rows(c.gate?.issues).map(i=>({chapter:c.number,...i}))).slice(0,12)};
}

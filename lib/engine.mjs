import {hash} from './store.mjs';
import {count,validatePlan,factsFrom,qualityGate} from './quality.mjs';
import {defaults,modelCall,validateConfig,seal} from './model.mjs';
import {planningPrompt,contractPrompt,writePrompt,reviewPrompt} from './prompts.mjs';
import {platforms as seedPlatforms} from './platforms.mjs';
export async function config(store) {return {...defaults,...await store.get('settings:'+store.owner)};}
export function publicConfig(c) {const {apiKeyEncrypted,...safe}=c;return {...safe,hasKey:!!apiKeyEncrypted};}
export async function settings(store,input,secret) {
  const old=await config(store);const allowed=['provider','model','writerModel','reviewModel','inputPrice','outputPrice','monthLimit','bookLimit','taskLimit','maxOutputTokens','spendEnabled'];
  const next={...old}; for(const k of allowed)if(Object.hasOwn(input,k))next[k]=input[k];validateConfig(next);
  if(input.apiKey){if(typeof input.apiKey!=='string'||input.apiKey.length>1000)throw new Error('API密钥无效');next.apiKeyEncrypted=await seal(input.apiKey,secret);}
  if(old.apiKeyEncrypted&&old.provider!==next.provider&&!input.apiKey)next.apiKeyEncrypted='';
  const saved=old.revision?await store.save(old,next):await store.create('settings',next,'','settings:'+store.owner);
  return publicConfig(saved);
}
export async function createBook(store,input,key) {
  if(!key||!/^[a-zA-Z0-9_-]{12,80}$/.test(key))throw new Error('创建请求缺少幂等标识');
  const total=Number(input.totalChapters??100),words=Number(input.targetWords??9000),budget=Number(input.budget??20);
  if(!Number.isInteger(total)||total<3||total>300||!Number.isInteger(words)||words<1000||words>10000||!Number.isFinite(budget)||budget<0||budget>10000)throw new Error('章节3–300，篇幅1000–10000汉字，预算0–10000元');
  const b=await store.create('book',{title:String(input.title||'待策划的新书').slice(0,80),direction:String(input.direction||'自动选择有持续冲突的原创商业题材').slice(0,2000),platform:String(input.platform||'auto').slice(0,80),totalChapters:total,targetWords:words,budget,status:'planning',created:new Date().toISOString(),plan:null,planRevision:1,guidance:'',lease:null,error:null},'',store.owner+':book:'+key);
  return b;
}
export async function memory(store,book,chapters) {
  const locked=chapters.filter(c=>c.status==='locked').sort((a,b)=>a.number-b.number);
  return {facts:factsFrom(book.plan,locked),ledger:locked.map(c=>({number:c.number,summary:c.review.summary,changes:c.review.changes,signature:c.review.signature,consequences:c.review.consequences,questions:c.review.questions})),foreshadowing:[...(book.plan?.foreshadowing||[]),...locked.flatMap(c=>c.review.foreshadowing||[])]};
}
async function lease(store,record) {
  if(record.lease&&record.lease.until>Date.now())throw new Error('任务正在执行，请等待；异常中断后租约到期可恢复');
  return store.save(record,{...record,lease:{token:crypto.randomUUID(),until:Date.now()+130000},error:null});
}
async function finish(store,record,next) {
  const current=await store.get(record.id);
  if(current.lease?.token!==record.lease?.token)throw new Error('任务租约已变化，旧结果不能覆盖新任务');
  return store.save(current,{...next,status:current.kind==='book'&&current.status==='paused'?'paused':next.status,lease:null,error:null});
}
export async function step(store,bookId,secret,invoke=modelCall,options={}) {
  let book=await store.get(bookId);if(!book||book.kind!=='book')throw new Error('作品不存在');
  const job=await store.get(bookId+':job');if(job&&['queued','running','waiting'].includes(job.status)&&(!options.jobToken||job.lease?.token!==options.jobToken))throw new Error('云端任务已接管本书，请在任务控制台暂停后再手动执行');
  if(book.status==='paused'||book.status==='blocked')throw new Error('任务已暂停，请检查原因后恢复');
  const rules=await store.list('rule');const platformRules=seedPlatforms.map(p=>({...p,...rules.find(r=>r.platform===p.name)}));
  if(platformRules.some(p=>p.name===book.platform&&['restricted','prohibited'].includes(p.aiPolicy)))throw new Error('主平台已知规则不适用自动正文创作，请选择适合的主平台；仍可查看和导出私有稿件');
  const cfg=await config(store);let active;
  const chapters=(await store.list('chapter',bookId)).sort((a,b)=>a.number-b.number);
  try {
    if(!book.plan) {
      active=await lease(store,book);
      const platforms=platformRules.filter(p=>!['restricted','prohibited'].includes(p.aiPolicy));
      const p=validatePlan(await invoke(store,cfg,book,planningPrompt(book,platforms,await store.list('submission')),'plan',secret),book.totalChapters);
      const platform=book.platform==='auto'?p.platform:book.platform;if(!platforms.some(p=>p.name===platform))throw new Error('模型推荐了未登记平台');
      book=await finish(store,active,{...active,title:p.title,plan:p,platform,status:'ready'});await store.log(bookId,'完成选题比较、故事圣经与全书阶段规划');return {phase:'plan',book};
    }
    const locked=chapters.filter(c=>c.status==='locked');const number=locked.length+1;
    if(locked.some((c,i)=>c.number!==i+1))throw new Error('已锁章节不连续，停止续写');
    if(number>book.totalChapters)return {phase:'complete'};
    // Stage audit blocks further generation until reviewed, with no silent bypass.
    if(locked.length&&locked.length%10===0) {
      const audit=await store.get(bookId+':audit:'+locked.length);
      if(!audit?.pass) {
        active=await lease(store,audit||await store.create('audit',{through:locked.length,pass:false},bookId,bookId+':audit:'+locked.length));
        const text=locked.slice(-10).map(c=>`第${c.number}章 ${c.title}\n${c.content}`).join('\n');
        const result=await invoke(store,cfg,book,`独立阶段编辑，连续阅读十章全文，检查重复冲突、人物信息边界、中段失速、阶段承诺兑现与不可逆变化。严守质量，不要默认通过。阶段计划${JSON.stringify(book.plan.arcs)}。全文${text}。只返回JSON{pass:boolean,issues:[{chapter,message,quote}],payoffEvidence,irreversibleEvidence,nextAdjustment}`,'review',secret);
        if(typeof result.pass!=='boolean'||!result.payoffEvidence||!result.irreversibleEvidence)throw new Error('阶段审核证据不足');
        await finish(store,active,{...active,...result});if(!result.pass)throw new Error('阶段审核未通过，需要调整架构后继续');
        await store.log(bookId,`第${locked.length}章阶段审核通过`);return {phase:'arc_audit'};
      }
    }
    let chapter=chapters.find(c=>c.number===number);
    if(!chapter)chapter=await store.create('chapter',{number,title:book.plan.contracts[number-1].title,status:'contract',chunks:[],content:'',attempt:0,review:null,gate:null,hash:null,lease:null},bookId,bookId+':chapter:'+number);
    if(chapter.status==='blocked')throw new Error('本章三轮返修或架构诊断未通过，请人工修订后重新审核');
    active=await lease(store,chapter);const mem=await memory(store,book,locked);
    if(chapter.status==='contract') {
      const c=await invoke(store,cfg,book,contractPrompt(book,mem,book.plan.contracts[number-1]),'contract',secret);
      if(c.blocked)throw new Error(c.reason||'章节合同无法推进故事');
      if(!c.goal||!c.deleteLoss||!Array.isArray(c.scenes)||c.scenes.length!==Math.ceil(book.targetWords/1600)||c.scenes.some(s=>!s.goal||!s.consequence))throw new Error('章节场景合同不完整');
      const saved=await finish(store,active,{...active,contract:c,title:c.title||active.title,status:'writing'});await store.log(bookId,`第${number}章场景合同完成`);return {phase:'contract',chapter:saved};
    }
    if(chapter.status==='rework') {
      const versionHash=await hash(chapter.content);
      await store.create('version',{number,content:chapter.content,title:chapter.title,hash:versionHash,review:chapter.review,created:new Date().toISOString()},bookId,chapter.id+':version:'+versionHash);
      return {phase:'rework',chapter:await finish(store,active,{...active,chunks:[],content:'',review:null,status:'writing',attempt:active.attempt+1})};
    }
    if(chapter.status==='writing') {
      const out=await invoke(store,cfg,book,writePrompt(book,chapter,mem,chapter.attempt>0),'write',secret);
      if(typeof out.text!=='string'||out.text.length>15000||out.sceneComplete!==true||count(out.text)<Math.floor(book.targetWords/chapter.contract.scenes.length*.55))throw new Error('片段不完整或篇幅严重不足，未覆盖已保存正文');
      const chunks=[...chapter.chunks,out.text]; const content=chunks.join('\n\n');const done=chunks.length===chapter.contract.scenes.length;
      const saved=await finish(store,active,{...active,chunks,content,hash:await hash(content),status:done?'reviewing':'writing'});
      await store.log(bookId,`第${number}章片段 ${chunks.length}/${chapter.contract.scenes.length} 已安全保存`);return {phase:'fragment',chapter:saved};
    }
    if(chapter.status==='reviewing') {
      const r=await invoke(store,cfg,book,reviewPrompt(book,chapter,mem,locked.slice(-12)),'review',secret);
      const candidate={...active,review:r};const gate=qualityGate(candidate,locked,mem.facts,book.targetWords);
      const status=gate.pass?'locked':active.attempt>=3||r.architectureConcern?'blocked':'rework';
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
  const all=await store.list('chapter',c.parent);if(all.some(n=>n.number>c.number))throw new Error('已有后续章节，先建立整本重写分支；当前版本禁止破坏历史事实');
  return store.save(c,{...c,status:'reviewing',review:null,gate:null,lockedAt:null});
}
export async function reviseChapter(store,input,secret,invoke=modelCall) {
  const c=await store.get(input.id);if(!c||c.kind!=='chapter'||c.status==='locked')throw new Error('请先创建章节修订版本');
  await assertIdle(store,c.parent);
  const b=await store.get(c.parent),cfg=await config(store);const a=await lease(store,c);
  try {
    const out=await invoke(store,cfg,b,`仅按要求修订原创正文，不改变既定事实。要求${String(input.instruction).slice(0,2000)}。事实${JSON.stringify(await memory(store,b,(await store.list('chapter',b.id)).filter(n=>n.number<c.number)))}。正文${c.content}。只返回JSON{text}。`,'rewrite',secret);
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
  return {books,settings:publicConfig(settingsValue),chapters:chapters.map(({content,chunks,lease,...c})=>({...c,words:count(content),fragmentCount:chunks?.length||0,leaseUntil:lease?.until||null})).sort((a,b)=>a.number-b.number),jobs:jobs.map(({lease,...j})=>({...j,leaseUntil:lease?.until||null})),logs:logs.slice(0,40),cost,submissions,incomes,expenses,platforms:seedPlatforms.map(p=>({...p,...rules.find(r=>r.platform===p.name)})),selectedId:id};
}
async function assertIdle(store,id) {
  const j=await store.get(id+':job');if(j&&(['queued','running','waiting'].includes(j.status)||j.lease?.until>Date.now()))throw new Error('请先暂停云端任务，等待当前检查点保存后再编辑');
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
  const saved=await store.save(b,{...b,plan:next,guidance:input.guidance,guidanceFromChapter:firstEditable,planRevision:rev+1});
  await store.log(b.id,`大纲保存为V${rev+1}，仅修改尚未开始的章节；未来创作须重新启动任务`);return saved;
}
export async function testConnection(store,secret,invoke=modelCall) {
  const c=await config(store),id=store.owner+':connection-test';
  const result=await invoke(store,c,{id,budget:Math.min(c.bookLimit,c.taskLimit)},'连接验证。不涉及小说。只返回JSON {"ok":true}','connection',secret);
  if(result.ok!==true)throw new Error('接口已响应，但未返回要求的JSON结构');
  await store.log('',`模型连接验证通过：${c.provider} / ${c.model}；属于接口验证，不是写作质量验收`);
  return {ok:true,provider:c.provider,model:c.model,cost:(await store.cost(id)).total};
}

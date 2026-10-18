// V0.8 craft checks reuse the existing planning / contract / review requests.
// Literal citations are checked here; literary judgments still belong to editors.
const rows=x=>Array.isArray(x)?x:[];
const text=(x,max=2000)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
export const craftEnabled=b=>b?.workflowVersion===2&&b?.narrativeProtocol===1&&b?.craftProtocol===1;
export function validateCraftPlan(plan,book) {
  if(!craftEnabled(book))return plan;
  const p=plan?.bible?.positioning;
  if(['reader','appeal','difference','unitEngine'].some(k=>!text(p?.[k])))throw new Error('创作规格缺少目标读者、阅读回报、差异或可持续剧情单元');
  if(!Array.isArray(plan.bible.coreRules)||!plan.bible.coreRules.length||plan.bible.coreRules.length>8||plan.bible.coreRules.some(r=>!text(r,1200)))throw new Error('世界核心规则需1–8条具体约束，不强套升级体系');
  for(const c of rows(plan.characters))if(['principle','pressureResponse','changeTrigger'].some(k=>!text(c.behavior?.[k])))throw new Error('人物档案缺少行为原则、压力反应或有代价的转变条件');
  return plan;
}
export function validateCraftContract(c,book) {
  if(!craftEnabled(book))return c;
  if(c.craftProtocol!==1||c.schema!==3||['known','expectation','delivery','carry'].some(k=>!text(c.readerJourney?.[k])))throw new Error('章节任务书缺少读者已知、期待、本章回报或后续承接');
  if(rows(c.scenes).some(s=>!text(s.stopAfter)||!Array.isArray(s.defer)||s.defer.length>8||s.defer.some(x=>!text(x,1200))))throw new Error('场景需写明本段停在哪里、哪些事件留到后面；无保留事件时defer为空数组');
  return c;
}
export function validateCraftEvidence(chapter,book) {
  if(!craftEnabled(book))return chapter.review;
  validateCraftContract(chapter.contract,book);
  const e=chapter.review?.craftEvidence,quote=q=>text(q)&&q.trim().length>=4&&chapter.content.includes(q);
  const c=e?.character;
  if(!c||String(c.characterId)!==String(chapter.contract.characterFocus.characterId)||!['consistent','earned_change','unearned_change','insufficient'].includes(c.status)||!quote(c.quote)||!text(c.reason)||c.status==='earned_change'&&!quote(c.triggerQuote))throw new Error('人物行为审核缺少焦点人物、真实选择或转变触发原文；保留正文，不付费迎合假引用');
  const w=e.continuity;
  if(!w||!['consistent','conflict','insufficient'].includes(w.status)||!quote(w.quote)||!text(w.reason))throw new Error('世界连续性审核缺少实际原文与依据');
  const seen=new Set();
  if(!Array.isArray(e.boundaries)||e.boundaries.length!==chapter.contract.scenes.length)throw new Error('分段边界审核需逐场景引用原文，不能省略或重复场景');
  for(const b of e.boundaries){if(!Number.isInteger(b?.scene)||b.scene<1||b.scene>chapter.contract.scenes.length||seen.has(b.scene)||typeof b.respected!=='boolean'||!quote(b.quote)||!text(b.reason))throw new Error('分段边界审核需逐场景引用原文，不能省略或重复场景');seen.add(b.scene);}
  return chapter.review;
}
export function craftReviewIssues(chapter,book) {
  if(!craftEnabled(book))return [];
  const e=chapter.review.craftEvidence,issues=[];
  if(e.character.status==='unearned_change')issues.push({code:'CHARACTER_UNEARNED',message:'人物转变缺少足够触发或代价：'+e.character.reason,quote:e.character.quote,fix:'先检查人物弧和章节任务书，不靠贴标签或增加口头禅修补'});
  if(e.character.status==='insufficient'||e.continuity.status==='insufficient')issues.push({code:'CRAFT_CONTEXT',message:'判断人物或世界规则需要更多资料，停止自动返修：'+(e.character.status==='insufficient'?e.character.reason:e.continuity.reason)});
  if(e.continuity.status==='conflict')issues.push({code:'WORLD_CONFLICT',message:'正文违背已批准世界规则或锁定事实：'+e.continuity.reason,quote:e.continuity.quote,fix:'按既定规则修正实际冲突，不改写世界手册来迁就正文'});
  for(const b of e.boundaries)if(!b.respected)issues.push({code:'SCENE_EARLY_PAYOFF',message:'第'+b.scene+'场景超出任务书边界：'+b.reason,quote:b.quote,fix:'把提前消耗的事件留回计划场景；保留当前段真实推进，不注水补字'});
  return issues;
}
export function planningCraftPrompt(book) {
  if(!craftEnabled(book))return '';
  return ' 在同一个JSON补充bible.positioning:{reader:具体目标读者及偏好,appeal:持续阅读回报,difference:区别于同类的核心矛盾或机制,unitEngine:能反复产生不同人物选择和后果的剧情单元机制}，不是平台签约或收入承诺。bible.coreRules为1–8条不可随意修改的世界核心规则，言情/现实题材也可以是社会条件和现实因果，不套十级修炼体系。每个人物增加behavior:{principle:价值与行为底线,pressureResponse:受压时具体反应,changeTrigger:何种事件与代价能使其有依据地改变}。人物允许成长，不能把固定口头禅或永远不变当作真实性。稳定手册仅由用户审核的大纲版本修改，逐章事实另行记账。';
}
export function contractCraftPrompt(book) {
  if(!craftEnabled(book))return '';
  return ' 在同一个JSON增加craftProtocol:1和readerJourney:{known:本章开始读者确实已知的信息,expectation:基于现有情节产生的期待,delivery:本章实际提供的情绪或信息回报,carry:未决内容怎样接到后续}。不能虚构真实读者反馈；目标读者喜好仅是待验证假设。每个scene增加stopAfter:本段最后允许发生的事件、defer:[明确留给后续场景/章节的事件]，没有则为空数组。保存分段是技术检查点，不等于独立完整故事；一个剧情单元可以跨多个分段或章节。不要每段重来铺垫高潮、提前完成后段反转，再靠注水填篇幅。首章尽早让读者认清谁、身处何种困境、眼下想做什么；不同题材节奏可以不同，不硬套开头100字和每章强反转。';
}
export function writeCraftPrompt(book,chapter,{wholeChapter=false}={}) {
  if(wholeChapter)return '\n本次一次写完全部场景。按任务书顺序逐场推进，当前场景的stopAfter是转场边界；defer中留给本章后面场景的事件只能到指定后场再发生，留给后续章节的事件本章不兑现。不能只写第一个场景，也不能在前场提前消耗结尾。人物原则的变化必须由已写事件、选择与代价推动，不为剧情突然改性。';
  const next=rows(chapter.contract.scenes).slice(chapter.chunks.length+1).map((s,i)=>({scene:chapter.chunks.length+i+2,goal:s.goal,consequence:s.consequence}));
  return '\n分段是保存检查点，不是必须闭合的故事单元。只完成当前场景，后续场景事件不得提前消耗：'+JSON.stringify(next)+(craftEnabled(book)?'。遵守当前stopAfter与defer；人物原则可以在已写出的事件和代价推动下演变，不能为了剧情突然改性。':'');
}
export function reviewCraftPrompt(book) {
  if(!craftEnabled(book))return '';
  return ' 在同一个审核JSON补充craftEvidence:{character:{characterId:任务书焦点人物ID,status:"consistent|earned_change|unearned_change|insufficient",quote:当前全文原句,reason:对照behavior说明实际行为,triggerQuote:earned_change时必填当前全文中真实的触发事件原句},continuity:{status:"consistent|conflict|insufficient",quote:当前全文原句,reason:对照世界核心规则和锁定事实说明},boundaries:[{scene:从1开始的场景号,respected:true或false,quote:本场景当前全文原句,reason:是否遵守stopAfter/defer及有无抢跑后续事件}]}。逐场景覆盖一次，不能漏审。引用至少4字，必须来自本轮全文。先读memory.behaviorHistory中已定稿的实际选择和既有转变，延续已经成立的成长可判consistent；本章新增转变有足够过程与代价可判earned_change，不因变化本身扣分；缺资料用insufficient，不编事实补证。边界内安静推进可合格，不强行制造高潮。独立审核判断可能出错，真实引文也不等于程序已证明文学质量。';
}

import {hash} from './store.mjs';
import {factsFrom} from './quality.mjs';
import {advancedNarrative,narrativeBrief} from './narrative.mjs';
import {craftEnabled} from './craft.mjs';
function motifScore(a,b) {
  const pairs=s=>{const t=s.replace(/[\s\p{P}]/gu,'');return new Set(Array.from({length:Math.max(0,t.length-1)},(_,i)=>t.slice(i,i+2)));};
  const x=pairs(a),y=pairs(b);let n=0;for(const p of x)if(y.has(p))n++;return n/Math.max(1,Math.min(x.size,y.size));
}
// Deterministic retrieval from this book's LOCKED chapters only. Summaries help
// locate source passages; they never replace source text or create new facts.
export async function storyContext(book,chapters,contract,number) {
  const locked=chapters.filter(c=>c.status==='locked'&&c.number<number).sort((a,b)=>a.number-b.number);
  const facts=factsFrom(book.plan,locked);
  if(JSON.stringify(facts).length>24000)throw new Error('当前事实账本过长，请先检查整理，未截断关键事实');
  const query=JSON.stringify(contract||book.plan?.contracts?.[number-1]||{});
  const names=(book.plan?.characters||[]).map(c=>c.name).filter(n=>typeof n==='string'&&n.length>=2&&query.includes(n));
  const requested=new Set((contract?.relevantChapters||[]).filter(n=>Number.isInteger(n)&&n<number));
  const ranked=locked.map(c=>({c,score:(requested.has(c.number)?100:0)+Math.min(50,names.filter(n=>(c.content||'').includes(n)).length*2+(c.review?.changes||[]).filter(d=>query.includes(d.key)).length*4+(c.review?.foreshadowing||[]).filter(f=>query.includes(String(f.id))).length*4)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||b.c.number-a.c.number).slice(0,4);
  const recent=locked.slice(-3),selected=[...new Map([...recent,...ranked.map(x=>x.c)].map(c=>[c.number,c])).values()].sort((a,b)=>a.number-b.number);
  const source=[];
  for(const c of [...new Map([...(locked.length?[locked.at(-1)]:[]),...ranked.map(x=>x.c)].map(c=>[c.number,c])).values()]) {
    const digest=await hash(c.content||'');if(c.hash!==digest)throw new Error('相关定稿原文哈希不匹配，停止准备上下文');
    let start=c===locked.at(-1)?Math.max(0,c.content.length-2200):0;
    if(c!==locked.at(-1)) {const anchor=(c.review?.foreshadowing||[]).find(f=>query.includes(String(f.id))&&typeof f.evidence==='string'&&c.content.includes(f.evidence))?.evidence||(c.review?.changes||[]).find(d=>query.includes(d.key)&&typeof d.quote==='string'&&c.content.includes(d.quote))?.quote||names.find(n=>c.content.includes(n));if(anchor)start=Math.max(0,c.content.indexOf(anchor)-250);}
    const end=Math.min(c.content.length,start+(c===locked.at(-1)?2200:900));
    source.push({chapter:c.number,hash:digest,start,end,text:c.content.slice(start,end)});
  }
  const narrative=narrativeBrief(book,locked,number);
  const active=narrative.items.filter(f=>f.status==='open'||f.status==='planned'&&(f.plantChapter===null||f.plantChapter<=number+3));
  if(JSON.stringify(active).length>12000)throw new Error('活跃伏笔账本过长，请先整理，未静默遗漏伏笔');
  const current=contract||book.plan?.contracts?.[number-1]||{},motif=[current.goal,current.cause,current.conflict,current.method,current.consequence,...(current.scenes||[]).flatMap(s=>[s.goal,s.conflict,s.choice])].filter(x=>typeof x==='string').join(' ');
  const sig=c=>({chapter:c.number,...c.review?.signature});
  const structuralMemory={recent:locked.slice(-12).map(sig),earlierSimilar:locked.slice(0,-12).map(c=>({c,score:motifScore(motif,Object.values(c.review?.signature||{}).join(' '))})).filter(x=>x.score>.15).sort((a,b)=>b.score-a.score||b.c.number-a.c.number).slice(0,6).map(x=>sig(x.c)),note:'文字相近仅供编辑判断，不等于语义重复；需要原文证据'};
  const out={nextChapter:number,facts,ledger:selected.map(c=>({number:c.number,summary:c.review?.summary,changes:c.needsPolish?c.release?.acceptedChanges:c.review?.changes,signature:c.review?.signature,consequences:c.review?.consequences,questions:c.review?.questions,...(c.needsPolish?{needsPolish:true,unresolvedIssues:c.gate?.issues}: {})})),foreshadowing:active,source,structuralMemory,omittedSummaries:locked.length-selected.length};
  if(advancedNarrative(book))out.narrative={toPlant:narrative.toPlant,toPay:narrative.toPay,items:narrative.items.map(({plantQuote,payQuote,...f})=>f)};
  if(craftEnabled(book)){
    const currentNames=new Set((current.scenes||[]).flatMap(s=>s.characters||[]));
    const focus=String(current.characterFocus?.characterId||'');
    const candidates=(book.plan?.characters||[]).filter(p=>String(p.id)===focus||currentNames.has(p.name)||names.includes(p.name));
    const people=(candidates.length?candidates:(book.plan?.characters||[])).sort((a,b)=>Number(String(b.id)===focus)-Number(String(a.id)===focus)).slice(0,4);
    out.behaviorHistoryScope={selected:people.map(p=>p.id),note:'至多四名当前相关人物；无明确定位时取档案前四名，非全体人物的完整历史'};
    out.behaviorHistory=[];
    for(const p of people){
      const choices=locked.flatMap(c=>(c.review?.characterBeats||[]).filter(b=>String(b.characterId)===String(p.id)).map(b=>({c,b}))),latest=choices.at(-1);
      const changed=locked.filter(c=>String(c.review?.craftEvidence?.character?.characterId)===String(p.id)&&c.review.craftEvidence.character.status==='earned_change').at(-1);
      for(const c of [...new Set([latest?.c,changed].filter(Boolean))])if(c.hash!==await hash(c.content||''))throw new Error('人物历史原文哈希不匹配，停止准备上下文');
      out.behaviorHistory.push({characterId:p.id,name:p.name,lastChoice:latest?{chapter:latest.c.number,hash:latest.c.hash,choice:latest.b.choice,consequence:latest.b.consequence,quote:latest.b.quote}:null,lastEarnedChange:changed?{chapter:changed.number,hash:changed.hash,...changed.review.craftEvidence.character}:null});
    }
  }
  if(JSON.stringify(out).length>48000)throw new Error('相关上下文超过安全范围，请先整理，不会反复请求模型压缩');
  return out;
}
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=4000;
const scalar=v=>v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v);
// The model proposes changes; the application owns the previous state.
// Explicit legacy `from` values still pass through strict validation.
export function bindContractFacts(contract,mem) {
  if(!contract||!Array.isArray(contract.requiredDelta))return contract;
  return {...contract,requiredDelta:contract.requiredDelta.map(delta=>{
    if(!delta||typeof delta!=='object'||Object.hasOwn(delta,'from'))return delta;
    return {...delta,from:Object.hasOwn(mem.facts,delta.key)?mem.facts[delta.key]:null};
  })};
}
export function validateSceneContract(c,book,mem,expected) {
  if(!c||!text(c.goal)||!text(c.deleteLoss)||!Array.isArray(c.scenes)||c.scenes.length!==expected||c.scenes.some(s=>!text(s.goal)||!text(s.consequence)))throw new Error('章节场景合同不完整');
  if(book.workflowVersion!==2)return c;
  if(c.schema!==(advancedNarrative(book)?3:2)||!text(c.entry)||!text(c.cause)||!text(c.hook)||!Array.isArray(c.relevantChapters)||c.relevantChapters.length>4||new Set(c.relevantChapters).size!==c.relevantChapters.length||c.relevantChapters.some(n=>!Number.isInteger(n)||n<1||n>=mem.nextChapter))throw new Error('章节任务书缺少承接、因果或原文定位');
  if(c.scenes.some(s=>!text(s.conflict)||!text(s.choice)||!text(s.setting)||!text(s.knowledgeBoundary)||!Array.isArray(s.characters)||!s.characters.length||s.characters.some(n=>!text(n))))throw new Error('场景缺少冲突、人物选择、代价或知情边界');
  if(!Array.isArray(c.requiredDelta)||!c.requiredDelta.length||c.requiredDelta.length>16||!Array.isArray(c.forbidden)||c.forbidden.length>24)throw new Error('章节任务书缺少必须变化或禁止变化');
  const keys=new Set();for(const [index,d] of c.requiredDelta.entries()){
    const label='章节任务书与定稿事实不一致：第'+(index+1)+'项';
    if(!d||!text(d.key))throw new Error(label+'状态名称缺失或无效');
    if(keys.has(d.key))throw new Error(label+'重复登记同一状态');
    if(!scalar(d.from)||!scalar(d.to))throw new Error(label+'状态必须为文本、数字、布尔值或null');
    if(d.from===d.to)throw new Error(label+'目标与起点相同，没有实际变化');
    if(Object.hasOwn(mem.facts,d.key)?mem.facts[d.key]!==d.from:d.from!==null)throw new Error(label+'起点未沿用当前事实账本');
    keys.add(d.key);
  }
  if(c.forbidden.some(d=>!d||!text(d.key)||!scalar(d.to)||c.requiredDelta.some(r=>r.key===d.key&&r.to===d.to)))throw new Error('必须变化与禁止变化互相冲突');
  return c;
}

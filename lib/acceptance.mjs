import {hash} from './store.mjs';
import {count} from './quality.mjs';
export const openingDimensions=[['hook','开篇追读'],['character','人物真实'],['causality','跨章因果'],['pace','节奏与反重复'],['voice','语言与人物区分']];
export function arcGate(report,chapters) {
  const issues=[],valid=e=>!!e&&Number.isInteger(e.chapter)&&typeof e.quote==='string'&&e.quote.trim().length>=4&&!!e.reason&&chapters.some(c=>c.number===e.chapter&&c.content.includes(e.quote));
  if(report?.pass!==true)issues.push({code:'ARC_EDITOR',message:'阶段编辑未通过'});
  if(!valid(report?.payoffEvidence)||!valid(report?.irreversibleEvidence))issues.push({code:'ARC_PAYOFF',message:'阶段兑现及不可逆变化缺少真实原文证据'});
  if(!Array.isArray(report?.evidence)||chapters.some(c=>!report.evidence.some(e=>e.chapter===c.number&&valid(e))))issues.push({code:'ARC_COVERAGE',message:'阶段审核必须有每章原文依据'});
  for(const i of report?.issues||[])if(['fatal','major'].includes(i.severity))issues.push({code:'ARC_VETO',message:i.message,chapter:i.chapter,quote:i.quote});
  return {pass:!issues.length,issues};
}
export async function openingFingerprint(book,chapters) {
  const cs=chapters.filter(c=>c.number<=3).sort((a,b)=>a.number-b.number);
  return hash(JSON.stringify({planRevision:book.planRevision||1,platform:book.platform,
    chapters:await Promise.all(cs.map(async c=>({number:c.number,hash:await hash(c.content||'')})))}));
}
export function openingGate(report,chapters) {
  const issues=[],seen=new Set();let score=0;
  const evidence=e=>!!e&&Number.isInteger(e.chapter)&&e.chapter>=1&&e.chapter<=3&&typeof e.quote==='string'&&e.quote.trim().length>=4&&chapters.some(c=>c.number===e.chapter&&(c.content||'').includes(e.quote));
  for(const [key,label] of openingDimensions) {
    const d=report?.scores?.[key];
    if(!d||!Number.isFinite(d.score)||d.score<0||d.score>20||!d.reason||!Array.isArray(d.evidence)||!d.evidence.length||d.evidence.some(e=>!evidence(e))) {issues.push({code:'OPENING_EVIDENCE',message:label+'缺少有效原文证据'});continue;}
    score+=d.score;d.evidence.forEach(e=>seen.add(e.chapter));
    if(d.score<15)issues.push({code:'OPENING_CORE',message:label+'低于15/20'});
  }
  if(seen.size!==3)issues.push({code:'OPENING_COVERAGE',message:'必须核验全部三章'});
  if(!Array.isArray(report?.hooks)||report.hooks.length!==3||[1,2,3].some(n=>!report.hooks.some(h=>h.chapter===n&&h.question&&h.reason&&evidence(h))))issues.push({code:'OPENING_HOOKS',message:'每章追读问题需要本章原文依据'});
  if(!report?.longRun?.engine||!report.longRun.nextArc||!report.longRun.repetitionRisk||!report.readerReason)issues.push({code:'OPENING_LONG_RUN',message:'缺少长篇持续机制、下一阶段或重复风险诊断'});
  if(report?.pass!==true)issues.push({code:'OPENING_EDITOR',message:'联合编辑未通过开篇验收'});
  for(const i of report?.issues||[])if(['fatal','major'].includes(i.severity))issues.push({code:'OPENING_VETO',message:i.message||'重要缺陷',chapter:i.chapter,quote:i.quote});
  if(score<85)issues.push({code:'OPENING_SCORE',message:'联合评分'+score+'，不足85'});
  return {pass:issues.length===0,score,issues};
}
export function openingPrompt(book,chapters) {
  return '开篇三章联合商业编辑验收。重新连读实际全文，不沿用单章评分，不预测签约概率或保证保底。主平台'+book.platform+
    '；全书规划'+JSON.stringify({bible:book.plan?.bible,arcs:book.plan?.arcs,characters:book.plan?.characters})+
    '；前三章全文：'+chapters.filter(c=>c.number<=3).sort((a,b)=>a.number-b.number).map(c=>'第'+c.number+'章 '+c.title+'\n'+c.content).join('\n\n')+
    '。只返回JSON {pass:boolean,scores:{hook:{score:0至20,reason,evidence:[{chapter:1至3,quote:原文}]},character:同结构,causality:同结构,pace:同结构,voice:同结构},hooks:[{chapter:1,question,reason,quote},{chapter:2,question,reason,quote},{chapter:3,question,reason,quote}],longRun:{engine,nextArc,repetitionRisk},readerReason,issues:[{severity:"fatal|major|minor",chapter,message,quote,fix}]}。五项总分至少85、每项至少15，证据覆盖三章。检验首章入口、三章追读、人物选择和代价、因果、语言自然及长篇反重复；重大缺陷一票否决，不为展示成功放行。';
}
const officialHosts={'番茄小说':['fanqienovel.com'],'七猫小说':['qimao.com'],'起点中文网':['qidian.com','write.qq.com'],'纵横中文网':['zongheng.com'],'17K小说网':['17k.com'],'书旗小说':['shuqi.com'],'飞卢小说网':['faloo.com'],'晋江文学城':['jjwxc.net']};
export function officialRuleSource(platform,url) {
  try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&(officialHosts[platform]||[]).some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}
}
export function policyVerified(p,now=Date.now()) {
  const age=(now-Date.parse(p?.checkedAt||''))/86400000;
  return p?.aiPolicy==='allowed'&&p.verifiedByUser===true&&officialRuleSource(p.name||p.platform,p.source)&&typeof p.policyEvidence==='string'&&p.policyEvidence.trim().length>=20&&Number.isFinite(age)&&age>=-1&&age<=30;
}
export async function submissionReadiness(book,chapters,audit,platform,now=Date.now()) {
  if(!book)return {ready:false,checks:[],reason:'请先选择作品'};
  const cs=chapters.filter(c=>c.number<=3).sort((a,b)=>a.number-b.number);
  const locked=cs.length===3&&cs.every((c,i)=>c.number===i+1&&c.status==='locked'&&c.gate?.pass===true);
  const hashes=locked&&(await Promise.all(cs.map(async c=>c.hash===await hash(c.content||'')))).every(Boolean);
  const fingerprint=await openingFingerprint(book,cs);
  const checks=[
    {id:'plan',label:'完整规划及明确主平台',pass:!!book.plan&&book.platform!=='auto'},
    {id:'chapters',label:'前三章正式定稿及正文哈希',pass:!!hashes},
    {id:'opening',label:'当前版本三章联合验收',pass:!!audit?.pass&&audit.fingerprint===fingerprint},
    {id:'policy',label:'30天内核验本创作方式适用的官方政策',pass:policyVerified(platform,now)},
    {id:'format',label:'投稿字数、格式及披露要求',pass:!!platform?.submissionChecked&&typeof platform.opening==='string'&&!/待核验/.test(platform.opening)&&platform.opening.trim().length>=10}
  ];
  return {ready:checks.every(c=>c.pass),checks,fingerprint,words:cs.reduce((n,c)=>n+count(c.content||''),0),note:'材料检查通过不代表平台录用。上架、签约与保底以平台实际审核和有效合同为准。'};
}
export async function submissionPacket(book,chapters,audit,platform) {
  const status=await submissionReadiness(book,chapters,audit,platform);
  if(!status.ready)throw new Error('投稿材料未通过：'+status.checks.filter(c=>!c.pass).map(c=>c.label).join('；'));
  return '\ufeff'+book.title+'\r\n投稿材料（仅导出，未公开发表）\r\n目标平台：'+book.platform+
    '\r\n简介与核心设定：'+(book.plan.bible?.premise||'请完善')+'\r\n选题依据：'+(book.plan.selectionReason||'见故事规划')+
    '\r\n全书阶段：'+JSON.stringify(book.plan.arcs)+'\r\n政策来源：'+platform.source+'\r\n核验日期：'+platform.checkedAt+
    '\r\n披露要求：'+(platform.disclosure||'按官方要求')+'\r\n开篇审核：'+audit.gate.score+'/100\r\n'+status.note+'\r\n\r\n'+
    chapters.filter(c=>c.number<=3).sort((a,b)=>a.number-b.number).map(c=>'第'+c.number+'章 '+c.title+'\r\n\r\n'+c.content.replace(/\r?\n/g,'\r\n')).join('\r\n\r\n');
}

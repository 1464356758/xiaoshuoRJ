import {hash} from './store.mjs';
import {validatePlan} from './quality.mjs';

export const PLAN_BATCH_SIZE=10;
const outlineFields=['title','platform','candidates','selectionReason','bible','style','characters','facts','foreshadowing','arcs'];
const contractFields=['title','goal','cause','conflict','method','consequence','emotion','hook'];
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=2000;
function validateOutline(p,total) {
  if(!p||!Number.isInteger(total)||total<3||total>300)throw new Error('分批规划结构无效');
  if(!text(p.title)||!text(p.platform)||!p.bible||!p.style||!p.facts||!Array.isArray(p.characters)||p.characters.length<4)throw new Error('故事圣经或人物档案不完整');
  if(!Array.isArray(p.candidates)||p.candidates.length<3||p.candidates.some(c=>!text(c.engine))||new Set(p.candidates.map(c=>c.engine.trim())).size<3)throw new Error('选题方案不足三个，或故事发动机重复');
  if(!Array.isArray(p.arcs)||p.arcs.length<Math.ceil(total/10)||p.arcs.length>total)throw new Error('阶段规划缺失');
  let next=1;const ids=new Set();
  for(const a of p.arcs){if(!a||!['string','number'].includes(typeof a.id)||ids.has(a.id)||a.start!==next||!Number.isInteger(a.end)||a.end<a.start||a.end>total||!text(a.goal)||!text(a.irreversibleChange))throw new Error('阶段范围必须连续覆盖全书，且有独立目标与不可逆变化');ids.add(a.id);next=a.end+1;}
  if(next!==total+1)throw new Error('阶段范围未覆盖全书');
  if(JSON.stringify(p).length>80000)throw new Error('故事骨架过长，请精简后再规划');
  return p;
}
function validateContracts(contracts,start,end) {
  if(!Array.isArray(contracts)||contracts.length!==Math.max(0,end-start+1)||contracts.some((c,i)=>!c||c.number!==start+i||contractFields.some(k=>!text(c[k]))))throw new Error('本批章节计划缺失、越界或顺序不完整');
  return contracts;
}
function payload(d){return {schema:d.schema,totalChapters:d.totalChapters,outline:d.outline,contracts:d.contracts};}
async function signed(d){return {...d,hash:await hash(JSON.stringify(payload(d)))};}
export async function newPlanningDraft(p,total) {
  const outline=Object.fromEntries(outlineFields.filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]]));
  validateOutline(outline,total);
  return signed({schema:1,totalChapters:total,outline,contracts:[]});
}
export async function validatePlanningDraft(d,total) {
  if(!d||d.schema!==1||d.totalChapters!==total||!Array.isArray(d.contracts)||d.contracts.length>total)throw new Error('规划检查点结构无效');
  validateOutline(d.outline,total);validateContracts(d.contracts,1,d.contracts.length);
  if(d.hash!==await hash(JSON.stringify(payload(d))))throw new Error('规划检查点校验失败，停止覆盖');
  return d;
}
export function planningRange(d) {
  const start=d.contracts.length+1,arc=d.outline.arcs.find(a=>a.start<=start&&a.end>=start);
  if(!arc)throw new Error('分批规划已完成或阶段范围无效');
  return {start,end:Math.min(start+PLAN_BATCH_SIZE-1,arc.end,d.totalChapters),arc};
}
export async function appendPlanningBatch(d,response) {
  await validatePlanningDraft(d,d.totalChapters);
  const {start,end}=planningRange(d);validateContracts(response?.contracts,start,end);
  const next=await signed({...d,contracts:[...d.contracts,...response.contracts]});
  // The provider cannot replace the selected platform, bible, facts or past batches.
  return next;
}
export function completedPlan(d){return validatePlan({...d.outline,contracts:d.contracts},d.totalChapters);}

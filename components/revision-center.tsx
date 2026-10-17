'use client';
import {useState,useEffect} from 'react';
import {Button} from '@/components/ui/button';
export default function RevisionCenter({book,chapters,audits,active,busy,onFork}:any){
 const [from,setFrom]=useState(1),[preserve,setPreserve]=useState(true);
 useEffect(()=>{setFrom(1);setPreserve(true);},[book?.id]);
 if(!book)return null;
 const numbers=[...new Set([1,...chapters.map((c:any)=>c.number)])].sort((a:any,b:any)=>a-b);
 return <section className="card"><span className="eyebrow">REVISION / 版本边界</span><h2>十章总审与返修</h2><p>每章通过后锁定；每满10章，再连读实际十章全文。总审未过会停止后续创作，不能把单章高分当作阶段通过。</p>{audits?.filter((a:any)=>a.type!=='opening').map((a:any)=><div className="provider-help" key={a.id}><strong>第{a.through-9}–{a.through}章：{a.pass?'历史审核通过（续写前还会校验版本）':'未通过或待完成'}</strong>{(a.issues||a.gate?.issues||[]).map((i:any,n:number)=><p key={n}>第{i.chapter||'?'}章 · {i.message}{i.fix?'；'+i.fix:''}</p>)}<p>{a.nextAdjustment}</p></div>)}<ol><li>选择最早受影响章节，建立暂停的独立修订副本；原作品保留。</li><li>保留该章正文时，清除其审核与锁定，按实际新稿重新全文审核；不保留则重新创作。</li><li>该章之后旧正文和受影响阶段的通过记录失效，后续详纲按新后果重新规划；未改前缀的验收仅在输入哈希完全相同时沿用。</li><li>审核通过重新锁定；锁定限制修改，作者仍能读取。后章只读取同一副本的最新定稿、事实及哈希。</li></ol><label className="field"><span>从哪章修订</span><select value={from} onChange={e=>setFrom(Number(e.target.value))}>{numbers.map((n:any)=><option key={n} value={n}>第{n}章</option>)}</select></label><label className="checkbox-row"><input type="checkbox" checked={preserve} onChange={e=>setPreserve(e.target.checked)}/>保留起始章现有正文/手修稿，转为待审候选</label><Button variant="outline" disabled={busy||active||!chapters.length} onClick={()=>onFork(from,preserve)}>建立独立修订副本</Button><p className="small-note">重大因果变更可能需要重新设计起始章任务书，此时请取消保留正文。副本建立不产生模型费用；重新创作、审核与下游重做会使用你设定的预算。</p></section>;
}

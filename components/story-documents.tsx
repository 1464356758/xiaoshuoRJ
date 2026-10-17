'use client';
import {Button} from '@/components/ui/button';
const display=(x:any)=>typeof x==='string'?x:JSON.stringify(x,null,2);
export default function StoryDocuments({documents:d,onRead,chapters}:any){
  if(!d)return null;
  if(d.error)return <section className="card"><h2>故事档案需要检查</h2><p className="negative">{d.error}</p><p>原稿仍可打开检查；档案未把异常记录当作可靠记忆。</p></section>;
  const ids=new Map((chapters||[]).map((c:any)=>[c.number,c.id]));
  const read=(n:number)=>{const id=ids.get(n);if(id)onRead(id);};
  const actual=new Map(d.outline.actual.map((a:any)=>[a.number,a]));
  return <section className="card story-documents"><div className="section-title"><h2>四份故事档案</h2><span className="tag">大纲 V{d.planRevision} · {d.sourceChapters.length}章定稿</span></div>
    <p>手册记录批准的设定，事件记录正文实际发生了什么。草稿、失败审稿和未来计划不会冒充既成事实。返修分支按自己的定稿重新建立档案。</p>
    {d.provisional&&<p className="small-note">当前仍在策划，以下设定尚未完成全书规划。</p>}
    <details><summary>一、世界与事实 · 基线 / 当前状态</summary>
      {d.world.baseline?.coreRules?.length>0&&<ol>{d.world.baseline.coreRules.map((r:string,i:number)=><li key={i}>{r}</li>)}</ol>}
      <p className="small-note">完整世界设定见稿件页的故事骨架；这里对照初始事实和定稿事件。</p>
      {Object.keys(d.world.currentFacts).length?<div className="table-scroll"><table><thead><tr><th>事实</th><th>初始值</th><th>当前值</th><th>最近来源</th></tr></thead><tbody>{Object.entries(d.world.currentFacts).map(([key,value]:any)=>{const event=[...d.world.changes].reverse().find((e:any)=>e.key===key);return <tr key={key}><td>{key}</td><td>{Object.hasOwn(d.world.initialFacts,key)?display(d.world.initialFacts[key]):'后续新增'}</td><td>{display(value)}</td><td>{event?<Button variant="link" onClick={()=>read(event.chapter)}>第{event.chapter}章</Button>:'初始设定'}</td></tr>;})}</tbody></table></div>:<p>尚无稳定事实记录。</p>}
      {d.world.changes.length>0&&<details><summary>展开事实事件及原文依据</summary>{d.world.changes.map((e:any,i:number)=><article key={i}><strong>第{e.chapter}章 · {e.key}</strong><p>{display(e.from)} → {display(e.to)}</p><blockquote>{e.quote}</blockquote><p>{e.reason}</p><small>来源 SHA256：{e.hash}</small></article>)}</details>}
    </details>
    <details><summary>二、人物手册 · 行为边界 / 实际选择</summary>
      {d.characters.baseline.map((p:any,i:number)=><article key={p.id||i}><h3>{p.name}</h3><p>行动目标：{p.goal}；内在诉求：{p.desire||'原档案未单列'}</p>{p.behavior&&<><p>原则：{p.behavior.principle}</p><p>压力下的反应：{p.behavior.pressureResponse}</p><p>足以改变其行为的事件与代价：{p.behavior.changeTrigger}</p></>}{d.characters.choices.filter((e:any)=>String(e.characterId)===String(p.id)).slice(-3).map((e:any,j:number)=><div key={j}><Button variant="link" onClick={()=>read(e.chapter)}>第{e.chapter}章</Button><span>{e.choice} → {e.consequence}</span><blockquote>{e.quote}</blockquote>{e.behaviorReview&&<p className="small-note">编辑对照：{e.behaviorReview.reason}</p>}</div>)}</article>)}
    </details>
    <details><summary>三、剧情档案 · 预定目标 / 已发生后果</summary>
      <p className="small-note">滚动详纲只列已准备的章节，不用未来梗概替代正文记忆。</p><div className="table-scroll"><table><thead><tr><th>章节</th><th>预定目标与后果</th><th>实际定稿记录</th></tr></thead><tbody>{d.outline.planned.map((p:any)=>{const a:any=actual.get(p.number);return <tr key={p.number}><td>{p.number}</td><td>{p.goal}<br/>{p.consequence}</td><td>{a?<><p>{display(a.consequences)}</p><Button variant="link" onClick={()=>read(p.number)}>回读定稿</Button></>:'计划，尚未发生'}</td></tr>;})}</tbody></table></div>
    </details>
    <details><summary>四、伏笔档案 · 原承诺 / 埋设 / 兑现</summary>
      <p>原承诺和期限保留；只有通过审核的定稿事件改变状态。下方「伏笔与兑现账本」可逐项回读原文。</p><p>记录 {d.promises.items.length} 项 · 已兑现 {d.promises.items.filter((p:any)=>p.status==='paid').length} 项。</p>
    </details>
    <details><summary>查看档案来源校验</summary><p className="small-note">来源必须是连续定稿、质量门已通过且SHA256匹配。哈希证明内容版本，不证明文学质量。</p>{d.sourceChapters.map((s:any)=><p key={s.number}><Button variant="link" onClick={()=>read(s.number)}>第{s.number}章</Button><code>{s.hash}</code></p>)}</details>
  </section>;
}

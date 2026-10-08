import {Progress} from '@/components/ui/progress';
export default function PlanningProgress({book}:any){
  if(book.plan||!book.planningDraft)return null;
  const draft=book.planningDraft,done=draft.contracts.length,total=book.totalChapters;
  return <section className="card full-width" aria-label="全书规划进度"><h2>全书规划 · {done}/{total}章计划已保存</h2><Progress value={done/total*100}/><p>故事圣经和全书阶段已经保存。接着每次规划最多10章；全部完成后才开始正文。中断后从第{done+1}章计划接着做。</p><details><summary>查看已经保存的故事与阶段</summary><h3>{draft.outline.title}</h3><p>{draft.outline.bible.premise}</p>{draft.outline.arcs.map((a:any)=><div className="arc-row" key={a.id}><b>第{a.start}–{a.end}章</b><div><strong>{a.goal}</strong><p>不可逆变化：{a.irreversibleChange}</p></div></div>)}{draft.contracts.map((c:any)=><p key={c.number}><b>第{c.number}章 {c.title}</b> · {c.goal} · 后果：{c.consequence}</p>)}</details></section>;
}

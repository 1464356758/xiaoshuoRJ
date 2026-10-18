import {Button} from '@/components/ui/button';

export default function ChapterRecovery({chapter,dirty,active,maintenance,busy,target,onRevise,onReview,onRefresh}:any){
  if(!chapter?.content||chapter.status==='locked')return null;
  const issues=[...(chapter.gate?.issues||[]),...(chapter.review?.issues||[])].filter((item:any,index:number,all:any[])=>all.findIndex(x=>x.message===item.message)===index);
  return <section className="card chapter-recovery" aria-label="审核与修改">
    <h2>第{chapter.number}章 · 审核与修改</h2>
    <p>{chapter.gate?.score!=null?`本稿审核 ${chapter.gate.score}/100，定稿要求至少85分并通过全部关键检查。`:'修改后的正文需要重新审核，才能定稿。'}</p>
    <p>本章返修已用 {chapter.attempt||0}/3 次。{chapter.attempt>=3?'已到三轮上限，禁止继续付费重写。保留原稿，可自行改稿后提交复审。':'审核未通过时，总监根据真实问题发布修改任务，再交给写手。'}</p>
    {issues.length>0&&<div className="recovery-issues"><h3>审稿意见</h3>{issues.map((item:any,i:number)=><div key={i}><p className="negative">{item.message}</p>{item.quote&&<blockquote>{item.quote}</blockquote>}{item.fix&&<p>修改建议：{item.fix}</p>}</div>)}</div>}
    {chapter.review?.scores&&<details><summary>查看六项评分与原文依据</summary>{Object.entries(chapter.review.scores).map(([key,value]:any)=><div key={key}><p>{({commercial:'商业钩子',causality:'因果逻辑',character:'人物选择',pace:'节奏',language:'语言',originality:'原创性'} as any)[key]||key}：{value.score}分 · {value.reason}</p><blockquote>{value.quote}</blockquote></div>)}</details>}
    {chapter.directorTask&&<details open><summary>总监修改任务 · 第{chapter.directorTask.round}轮</summary><p>{chapter.directorTask.diagnosis}</p>{chapter.directorTask.tasks?.map((task:any,i:number)=><div key={i}><p><b>{task.issueId}</b> · {task.change}</p><p>验收：{task.acceptance}</p></div>)}</details>}
    {maintenance&&<p className="negative">模型接口维护停用，当前只可查看、编辑和导出，不会发起付费调用。</p>}
    {active?<><p role="status">任务已登记到云端，可以退出App。需要修改正文时，先在控制台暂停并等待当前检查点保存。</p><Button variant="outline" disabled={busy} onClick={onRefresh}>刷新本章结果</Button></>:<>
      <p>可以由总监根据这些意见发布修改任务，交给写手修改后复审；也可以在下方自己修改。原稿保留在历史版本中。</p>
      <div className="button-row"><Button disabled={busy||dirty||maintenance||chapter.attempt>=3} onClick={onRevise}>按审稿意见修订</Button><Button variant="outline" disabled={busy||maintenance||(!dirty&&chapter.status!=='reviewing')} onClick={onReview}>{dirty?'保存并提交复审':'提交当前稿复审'}</Button></div>
      {dirty&&<p className="small-note">先保存当前输入，再选择AI修订；也可以直接保存并提交复审。</p>}
      <p className="small-note">总监、写手和审核按现有预算计费，未填单章限额时按2元上限控制。复审通过后沿用已保存的云端目标（第{target}章）；最多三轮返修，两轮没有改善会停下；不会重置轮次。</p>
    </>}
  </section>;
}

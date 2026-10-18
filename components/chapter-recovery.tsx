import {Button} from '@/components/ui/button';

export default function ChapterRecovery({chapter,dirty,active,busy,target,onRevise,onReview,onRefresh}:any){
  if(!chapter?.content||chapter.status==='locked')return null;
  const issues=[...(chapter.gate?.issues||[]),...(chapter.review?.issues||[])].filter((item:any,index:number,all:any[])=>all.findIndex(x=>x.message===item.message)===index);
  return <section className="card chapter-recovery" aria-label="审核与修改">
    <h2>第{chapter.number}章 · 审核与修改</h2>
    <p>{chapter.gate?.score!=null?`本稿审核 ${chapter.gate.score}/100，定稿要求至少85分并通过全部关键检查。`:'修改后的正文需要重新审核，才能定稿。'}</p>
    <p>自动局部返修已用 {chapter.attempt||0}/3 次。{chapter.attempt>=3?'已到上限，任务已停止，需要你选择下一步。':'质量问题会按剩余次数自动局部返修。'}</p>
    {issues.length>0&&<div className="recovery-issues"><h3>审稿意见</h3>{issues.map((item:any,i:number)=><div key={i}><p className="negative">{item.message}</p>{item.quote&&<blockquote>{item.quote}</blockquote>}{item.fix&&<p>修改建议：{item.fix}</p>}</div>)}</div>}
    {chapter.review?.scores&&<details><summary>查看六项评分与原文依据</summary>{Object.entries(chapter.review.scores).map(([key,value]:any)=><div key={key}><p>{({commercial:'商业钩子',causality:'因果逻辑',character:'人物选择',pace:'节奏',language:'语言',originality:'原创性'} as any)[key]||key}：{value.score}分 · {value.reason}</p><blockquote>{value.quote}</blockquote></div>)}</details>}
    {active?<><p role="status">任务已登记到云端，可以退出App。需要修改正文时，先在控制台暂停并等待当前检查点保存。</p><Button variant="outline" disabled={busy} onClick={onRefresh}>刷新本章结果</Button></>:<>
      <p>可以让AI按这些意见生成一次完整修订稿，也可以在下方自己修改。原稿保留在历史版本中。</p>
      <div className="button-row"><Button disabled={busy||dirty} onClick={onRevise}>按审稿意见修订</Button><Button variant="outline" disabled={busy||(!dirty&&chapter.status!=='reviewing')} onClick={onReview}>{dirty?'保存并提交复审':'提交当前稿复审'}</Button></div>
      {dirty&&<p className="small-note">先保存当前输入，再选择AI修订；也可以直接保存并提交复审。</p>}
      <p className="small-note">修订和正式审核调用已配置的模型，按现有预算计费。复审通过后沿用已保存的云端目标（第{target}章）；再次不通过会停下，不会重置三次自动返修上限。</p>
    </>}
  </section>;
}

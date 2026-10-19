import {Button} from '@/components/ui/button';

export default function ChapterRecovery({chapter,dirty,active,maintenance,busy,target,onRevise,onReview,onRefresh}:any){
  if(!chapter?.content||chapter.status==='locked'&&!chapter.needsPolish)return null;
  const issues=[...(chapter.gate?.issues||[]),...(chapter.review?.issues||[])].filter((item:any,index:number,all:any[])=>all.findIndex(x=>x.message===item.message)===index);
  return <section className="card chapter-recovery" aria-label="审核与修改">
    <h2>第{chapter.number}章 · 审核与修改</h2>
    <p>{chapter.gate?.score!=null?`本稿实际审核 ${chapter.gate.score}/100。正常合格要求至少85分并通过关键检查。`:'修改后的正文需要完整审核。'}</p>
    <p>完整审核 {chapter.reviewCount??'续跑时核对旧记录'}/5 次。{chapter.needsPolish?'已按五审上限放行，待人工精修；真实评分和问题保留。':'前四审不合格时，总监直接整理下方真实意见，写手一次完成整章返修，再审核一次。'}</p>
    {issues.length>0&&<div className="recovery-issues"><h3>审稿意见</h3>{issues.map((item:any,i:number)=><div key={i}><p className="negative">{item.message}</p>{item.quote&&<blockquote>{item.quote}</blockquote>}{item.fix&&<p>修改建议：{item.fix}</p>}</div>)}</div>}
    {chapter.review?.scores&&<details><summary>查看六项评分与原文依据</summary>{Object.entries(chapter.review.scores).map(([key,value]:any)=><div key={key}><p>{({commercial:'商业钩子',causality:'因果逻辑',character:'人物选择',pace:'节奏',language:'语言',originality:'原创性'} as any)[key]||key}：{value.score}分 · {value.reason}</p><blockquote>{value.quote}</blockquote></div>)}</details>}
    {chapter.revisionEdits?.patches?.length>0&&<details><summary>本轮实际修改 {chapter.revisionEdits.patches.length} 处 · 可对照原文</summary>{chapter.revisionEdits.patches.map((patch:any)=><div key={patch.id}><p><b>{patch.id}</b> · {patch.issueIds.join('、')}</p><p>修改前</p><blockquote>{patch.before}</blockquote><p>修改后</p><blockquote>{patch.after||'此处已删除'}</blockquote></div>)}</details>}
    {chapter.review?.revisionChecks&&<details><summary>本轮返修逐项验收</summary>{chapter.review.revisionChecks.map((check:any)=><div key={check.issueId}><p>{check.issueId} · {check.closed?'已解决':'仍需修改'}{check.evidenceMismatch?' · 实际差异证据未通过':''}</p><p>{check.reason}</p><blockquote>{check.quote}</blockquote></div>)}</details>}
    {chapter.directorTask&&<details open><summary>总监修改任务 · 第{chapter.directorTask.round}轮</summary><p>{chapter.directorTask.diagnosis}</p>{chapter.directorTask.tasks?.map((task:any,i:number)=><div key={i}><p><b>{task.issueId}</b> · {task.change}</p><p>验收：{task.acceptance}</p></div>)}</details>}
    {maintenance&&<p className="negative">模型接口维护停用，当前只可查看、编辑和导出，不会发起付费调用。</p>}
    {chapter.needsPolish?<p className="small-note">本章已推进后续创作。精修时请建立修订副本，保留本章真实审核与历史版本。</p>:active?<><p role="status">任务已登记到云端，可以退出App。需要修改正文时，先在控制台暂停并等待当前检查点保存。</p><Button variant="outline" disabled={busy} onClick={onRefresh}>刷新本章结果</Button></>:<>
      <p>可以由总监根据这些意见发布修改任务，交给写手修改后复审；也可以在下方自己修改。原稿保留在历史版本中。</p>
      <div className="button-row"><Button disabled={busy||dirty||maintenance||chapter.reviewCount>=5} onClick={onRevise}>按审稿意见修订</Button><Button variant="outline" disabled={busy||maintenance||chapter.reviewCount>=5||(!dirty&&chapter.status!=='reviewing')} onClick={onReview}>{dirty?'保存并提交复审':'提交当前稿复审'}</Button></div>
      {dirty&&<p className="small-note">先保存当前输入，再选择AI修订；也可以直接保存并提交复审。</p>}
      <p className="small-note">总监整理已存意见不请求模型。整章写作1次、每轮返修1次、每次全文审核1次；最多5次审核，第5次后待人工精修放行，继续原目标（第{target}章）。任务书和全书规划单独列账；不自动追加三章或十章联合审核。金额拦截关闭时不因历史费用停止；接口异常仍停止，次数不会因暂停或重启清零。</p>
    </>}
  </section>;
}

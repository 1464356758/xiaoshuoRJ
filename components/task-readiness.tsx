import {Button} from '@/components/ui/button';
import {creationSettingsProblems} from '@/components/model-settings-state.mjs';
export default function TaskReadiness({settings,book,job,runner,onSettings,cloud=false,draftDirty=false}:any){
  if(book.restoreComplete===false||book.revisionComplete===false)return <p role="status" className="negative">副本尚未建立完成，不能启动创作。请完成恢复或重新建立修订副本，原稿仍保留。</p>;
  const missing=creationSettingsProblems(settings,book);
  if(draftDirty||missing.length)return <div className="provider-help" role="status"><strong>创作尚未开始</strong><p>{draftDirty?'模型设置中有未保存的更改。请先保存，启动后才会使用新配置。':'还需要：'+missing.join('；')+'。完成并保存后再启动。'}</p><Button variant="outline" onClick={onSettings}>{draftDirty?'保存模型设置':'打开模型设置'}</Button></div>;
  const heartbeat=Date.parse(runner?.lastTick||'');
  if(runner?.enabled&&(!Number.isFinite(heartbeat)||Date.now()-heartbeat>(cloud?180000:2*3600*1000)))return <p role="status" className="negative">近期没有收到有效云端心跳，请先刷新进度或核对云端连接。已保存的任务和正文仍保留。</p>;
  if(!runner?.enabled)return <p role="status">{cloud?'云端执行器尚未就绪，请核对连接状态后再启动。':'后台执行尚未启用，可以保持页面打开进行连续执行。'}</p>;
  if(job?.status==='blocked')return <p role="status" className="small-note">任务已停止。请查看具体原因，处理预算、模型或稿件问题后重新启动；稿件被阻塞时，点击“查看审核与修改”，查看意见并选择修订或手动改稿复审。</p>;
  if(job?.status==='paused'||book.status==='paused')return <p role="status" className="small-note">已暂停，当前请求保存后停止。检查方向后点击「{cloud?'继续云端创作':'登记后台任务'}」继续。</p>;
  if(['queued','waiting','running'].includes(job?.status))return <p role="status" className="small-note">{cloud?'任务已保存，由独立云端推进并保存检查点。退出App不会暂停，进度以云端心跳和执行记录为准。':'任务已保存；后台推进以近期心跳为准。'}</p>;
  if(!job)return <p role="status" className="small-note">配置已保存。选择本轮目标，再点击「{cloud?'启动云端自动创作':'登记后台任务'}」。</p>;
  return null;
}

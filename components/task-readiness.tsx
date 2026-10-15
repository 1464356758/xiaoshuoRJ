import {Button} from '@/components/ui/button';
export default function TaskReadiness({settings,book,job,runner,onSettings}:any){
  if(book.restoreComplete===false||book.revisionComplete===false)return <p role="status" className="negative">副本尚未建立完成，不能启动创作。备份恢复请重新导入原备份；修订副本请从原作品重新建立。原稿仍保留。</p>;
  const missing=[];
  if(!settings.hasKey)missing.push('保存所选服务商的API密钥');
  if(settings.inputPrice===null||settings.outputPrice===null)missing.push('填写已核实的输入、输出单价');
  for(const slot of ['writer','review'])if(settings[slot+'Provider']&&(!settings[slot+'HasKey']||settings[slot+'InputPrice']==null||settings[slot+'OutputPrice']==null||!settings[slot+'Model']))missing.push((slot==='writer'?'正文':'审核')+'角色的独立模型、密钥和单价');
  if(!settings.spendEnabled)missing.push('确认费用授权');
  if(!settings.monthLimit||!settings.bookLimit||!settings.taskLimit||!book.budget)missing.push('设定大于0的月度、单书和单次预算');
  if(missing.length)return <div className="provider-help" role="status"><strong>创作尚未开始</strong><p>还需要：{missing.join('；')}。完成并保存后，再由你启动任务。</p><Button variant="outline" onClick={onSettings}>打开模型设置</Button></div>;
  if(runner?.enabled&&(!runner.lastTick||Date.now()-Date.parse(runner.lastTick)>2*3600*1000))return <p role="status" className="negative">近期没有收到有效云端心跳，后台自动执行目前不可确认。排队任务会保留，可点击「立即推进一步」；不要把已排队当作持续运行。</p>;
  if(!runner?.enabled)return <p role="status">后台执行尚未启用。可以保持页面打开，使用「在此页一键连续执行」推进已启动任务。</p>;
  if(job?.status==='blocked')return <p role="status" className="small-note">任务已停止，不会自动重试。查看上面的具体原因，检查预算、模型或稿件，再决定是否重新启动；章节质量阻塞须先修订。</p>;
  if(job?.status==='paused'||book.status==='paused')return <p role="status" className="small-note">已暂停。当前请求保存后停止；检查方向后点击「启动云端创作」继续原检查点。</p>;
  if(['queued','waiting'].includes(job?.status))return <p role="status" className="small-note">任务已保存，等待执行。关闭App不会取消记录；后台能否推进以近期心跳为准。可保持页面打开使用「在此页一键连续执行」。</p>;
  if(!job)return <p role="status" className="small-note">配置已保存，尚未启动云端任务。选择本轮目标后点击「启动云端创作」。</p>;
  return null;
}

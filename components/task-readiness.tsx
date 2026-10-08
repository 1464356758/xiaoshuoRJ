import {Button} from '@/components/ui/button';
export default function TaskReadiness({settings,book,job,runner,onSettings}:any){
  const missing=[];
  if(!settings.hasKey)missing.push('保存所选服务商的API密钥');
  if(settings.inputPrice===null||settings.outputPrice===null)missing.push('填写已核实的输入、输出单价');
  if(!settings.spendEnabled)missing.push('确认费用授权');
  if(!settings.monthLimit||!settings.bookLimit||!settings.taskLimit||!book.budget)missing.push('设定大于0的月度、单书和单次预算');
  if(missing.length)return <div className="provider-help" role="status"><strong>创作尚未开始</strong><p>还需要：{missing.join('；')}。完成并保存后，再由你启动任务。</p><Button variant="outline" onClick={onSettings}>打开模型设置</Button></div>;
  if(!runner?.enabled)return <p role="status">云端执行尚未启用，请联系维护者；当前可以手动执行检查点。</p>;
  if(job?.status==='blocked')return <p role="status" className="small-note">任务已停止，不会自动重试。查看上面的具体原因，检查预算、模型或稿件，再决定是否重新启动；章节质量阻塞须先修订。</p>;
  if(job?.status==='paused'||book.status==='paused')return <p role="status" className="small-note">已暂停。当前请求保存后停止；检查方向后点击「启动云端创作」继续原检查点。</p>;
  if(['queued','waiting'].includes(job?.status))return <p role="status" className="small-note">任务已登记，等待下一次云端执行。现在可以关闭App；也可点击「立即推进一步」。</p>;
  if(!job)return <p role="status" className="small-note">配置已保存，尚未启动云端任务。选择本轮目标后点击「启动云端创作」。</p>;
  return null;
}

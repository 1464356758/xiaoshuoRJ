'use client';
import {Button} from '@/components/ui/button';
import {modelSettingsGaps} from '@/components/model-settings-state.mjs';
export default function ModelSaveFeedback({cfg,saved,keys,message,busy,onReload,onDashboard}:any){
  const gaps=modelSettingsGaps(cfg,saved,keys);
  return <div className="model-save-feedback" aria-live="polite">
    {message&&<p role={message.kind==='error'?'alert':'status'} className={message.kind==='error'?'negative':'small-note'}>{message.text}</p>}
    <p className="small-note">云端已存密钥：策划 {saved.hasKey?'已保存':'未保存'} · 正文 {saved.writerProvider?(saved.writerHasKey?'已保存':'未保存'):'沿用策划'} · 审核 {saved.reviewProvider?(saved.reviewHasKey?'已保存':'未保存'):'沿用策划'} · 费用授权 {saved.spendEnabled?'已保存':'未开启'}</p>
    {gaps.length>0&&<p className="small-note">当前待补齐：{gaps.join('；')}。可先保存设置；开启费用前需补齐。</p>}
    <div className="button-row"><Button variant="outline" disabled={busy} onClick={onReload}>读取云端最新配置</Button>{message?.kind==='ok'&&<Button variant="outline" disabled={busy} onClick={onDashboard}>返回创作控制台</Button>}</div>
  </div>;
}

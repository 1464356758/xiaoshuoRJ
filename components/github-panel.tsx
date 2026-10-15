'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
export default function GithubPanel({data,busy,onAssist}:any) {
  const [question,setQuestion]=useState('读取当前仓库版本和开发状态，说明已经完成的功能、尚未验收的项目和下一步。');
  const [result,setResult]=useState<any>(null);
  return <><div className="page-heading"><div><span className="eyebrow">PROJECT / GitHub</span><h1>项目与模型工具</h1><p>固定仓库 1464356758/xiaoshuoRJ；未发表稿件保存在私有工作台。</p></div></div>
    <section className="card"><h2>模型通过工具访问 GitHub</h2><p>DeepSeek 官方支持工具调用。模型提出读取请求，由软件检查范围并执行。当前提供公开开发文档和 main 版本的只读工具，不会上传你的小说或密钥。</p>
      <a href="https://api-docs.deepseek.com/zh-cn/guides/tool_calls/" target="_blank" rel="noreferrer">查看 DeepSeek 官方工具说明</a>
      <p className="small-note">这里没有连接 GitHub 写入权限；写入能力需要可用的托管授权接口。更换模型不会自动获得仓库权限。</p>
      <Textarea aria-label="向项目助手提问" value={question} maxLength={1500} onChange={e=>setQuestion(e.target.value)}/>
      <div className="button-row"><Button disabled={busy||!question.trim()||!data.settings.hasKey||!data.settings.spendEnabled} onClick={async()=>{const x=await onAssist(question);if(x)setResult(x);}}>用当前模型读取并分析</Button><a href="https://github.com/1464356758/xiaoshuoRJ" target="_blank" rel="noreferrer">打开仓库</a></div>
      <p className="small-note">模型分析计入现有预算，单次最多3轮请求、4次只读工具操作；查看仓库链接不产生模型费用。</p>
    </section>{result&&<section className="card"><h2>已实际读取的分析</h2><p style={{whiteSpace:'pre-wrap'}}>{result.answer}</p><h3>工具执行记录</h3>{result.tools?.map((t:any,i:number)=><p key={i}>{t.name} {t.path||''} · {t.ok?'读取成功':'拒绝或读取失败'}</p>)}</section>}</>;
}

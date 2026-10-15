'use client';
import {Button} from '@/components/ui/button';
import {Check,FileCheck,Download,Play,ShieldCheck} from 'lucide-react';
export default function AcceptanceCenter({data,book,busy,onAudit,onDownload,onRules,onSubmissions,onFork}:any) {
  const status=data.acceptance,report=data.openingAudit,locked=data.chapters.filter((c:any)=>c.status==='locked'&&c.number<=3);
  const currentAudit=status?.checks?.find((c:any)=>c.id==='opening')?.pass;
  const active=data.jobs?.some((j:any)=>j.bookId===book?.id&&['queued','running','waiting'].includes(j.status));
  const signed=data.submissions.filter((s:any)=>s.bookId===book?.id&&s.status==='signed');
  return <><div className="page-heading"><div><span className="eyebrow">MANUSCRIPT / 验收</span><h1>从开篇到投稿</h1><p>逐章审核、三章连读、平台规则和合同结果都有独立记录。</p></div><ShieldCheck size={28}/></div>
    {!book?<section className="card"><h2>先创建一部作品</h2><p>完成全书规划后，先写出三个正式章节，验证故事能否让人继续读。</p></section>:<>
    <div className="record-grid"><section className="card"><div className="section-title"><h2>{book.title}</h2><span className={'tag '+(status?.ready?'success':'')}>{status?.ready?'投稿材料检查通过':'尚在验收'}</span></div>
      <p>{book.platform==='auto'?'主平台待选择':book.platform} · 前三章 {status?.words?.toLocaleString()||0} 汉字</p>
      <div className="acceptance-checks">{status?.checks?.map((c:any)=><div key={c.id}><span aria-label={c.pass?'通过':'待完成'}>{c.pass?<Check size={18}/>:<FileCheck size={18}/>}</span><span>{c.label}</span><strong>{c.pass?'通过':'待完成'}</strong></div>)}</div>
      <div className="button-row"><Button disabled={busy||locked.length!==3||active||!data.settings.spendEnabled} onClick={onAudit}><Play size={16}/>执行三章联合验收</Button><Button variant="outline" disabled={busy||active||!data.chapters.length} onClick={onFork}>创建开篇修订副本</Button><Button variant="outline" onClick={onRules}>核对平台规则</Button></div>
      <p className="small-note">联合验收会使用已授权模型并计入现有预算；相同失败稿件不会自动重复收费。请先暂停正在执行的任务。</p>
    </section><section className="card"><h2>联合编辑结果</h2>{report?.completedAt?<><strong className="acceptance-score">{report.gate?.score||0}<small>/100</small></strong><p>{report.pass&&currentAudit?'当前稿件通过联合验收':report.pass?'历史结果已失效，当前版本待验收':'尚未通过，按具体证据修订'}</p><p>{report.report?.readerReason}</p>{report.gate?.issues?.map((i:any,n:number)=><p className="negative" key={n}>{i.message}</p>)}{report.report?.issues?.map((i:any,n:number)=><div className="provider-help" key={n}><strong>第{i.chapter}章 · {i.message}</strong><blockquote>{i.quote}</blockquote><p>{i.fix}</p></div>)}<p className="small-note">核验时间：{new Date(report.completedAt).toLocaleString('zh-CN')}。修改正文或大纲后，旧结果不再作为投稿依据。</p></>:<p>尚无实际三章联合审核记录。程序测试结果不会显示为小说质量验收。</p>}</section></div>
    <section className="card"><h2>准备正式投稿材料</h2><p>包含书名、核心设定、选题依据、全书阶段规划、官方政策核验记录及前三章定稿。</p><Button disabled={busy||!status?.ready} onClick={onDownload}><Download size={16}/>导出投稿材料 TXT</Button><p className="small-note">{status?.note}</p></section>
    <section className="card"><h2>真实签约与保底记录</h2>{signed.length?signed.map((s:any)=><div className="log-row" key={s.id}><strong>{s.platform}</strong><span>{s.contractType==='guarantee'?'保底合同：'+s.guaranteeRate+'元/千字':s.contractType==='share'?'分成合同':'合同类型待补充'}</span><span>{s.contractEvidence?'已录入合同依据':'依据待补充'}</span></div>):<p>当前没有登记已签署合同。软件审核分数不会被当作签约、保底或到账记录。</p>}<Button variant="outline" onClick={onSubmissions}>登记编辑反馈与合同结果</Button></section>
    </>}</>;
}

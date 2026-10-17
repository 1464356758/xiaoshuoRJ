'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Upload,RefreshCw,Play,Pause,Check,BookOpen,FlaskConical} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {sampleReferenceFile,decodeReferenceBytes} from '@/lib/style-import.mjs';

const stageNames:Record<string,string>={opening:'开篇',middle:'中部',ending:'结尾',dialogue:'对白',other:'自选片段'};
const phaseNames:Record<string,string>={analysis:'参考技法分析',baseline:'基线试写',enhanced:'参考技法版试写',review:'匿名对照审核',done:'已保存结果'};
const statusNames:Record<string,string>={ready:'等待执行',running:'执行中',paused:'已暂停',blocked:'需要处理',completed:'已完成'};
export default function StyleWorkbench({book,chapters,settings,active,busy:outerBusy,onRefresh,onSettings}:any){
  const [data,setData]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [title,setTitle]=useState(''),[author,setAuthor]=useState(''),[source,setSource]=useState(''),[stage,setStage]=useState('other'),[text,setText]=useState(''),[consent,setConsent]=useState(false);
  const [samples,setSamples]=useState<any[]>([]),[selected,setSelected]=useState<string[]>([]),[profileKey,setProfileKey]=useState(''),[brief,setBrief]=useState(''),[readTrial,setReadTrial]=useState('');
  const fileRef=useRef<HTMLInputElement>(null),alive=useRef(true),running=useRef(false),activeTask=useRef(''),sequence=useRef(0),launchKey=useRef('');
  const id=book?.id;
  const request=useCallback(async(action:string,params:any={})=>{const r=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id,...params})});const x:any=await r.json();if(!r.ok)throw new Error(x.error||'操作失败');return x.result;},[id]);
  const reload=useCallback(async()=>{if(!id)return;const ticket=++sequence.current;const r=await fetch('/api/workspace?style='+encodeURIComponent(id)),x:any=await r.json();if(!r.ok)throw new Error(x.error||'文风资料读取失败');if(alive.current&&ticket===sequence.current)setData(x);return x;},[id]);
  useEffect(()=>{alive.current=true;reload().catch(e=>setError(e.message));return()=>{alive.current=false;running.current=false;sequence.current++;};},[reload]);
  useEffect(()=>{if(!data)return;setSelected(old=>{const valid=old.filter(k=>data.references.some((r:any)=>r.key===k&&!r.archived));return valid.length?valid:data.references.filter((r:any)=>!r.archived).map((r:any)=>r.key);});if(!profileKey&&data.profiles[0])setProfileKey(data.profiles[0].key);},[data,profileKey]);
  async function operation(fn:()=>Promise<any>){if(busy)return;setBusy(true);setError('');setNotice('');try{return await fn();}catch(e:any){if(alive.current)setError(e.message);return null;}finally{if(alive.current)setBusy(false);}}
  async function saveReferences(values:any[]){await operation(async()=>{if(!consent)throw new Error('请先确认参考材料的分析使用范围');for(const v of values)await request('styleReference',{input:{title,author,source,stage:v.stage||stage,text:v.text,consent}});await reload();await onRefresh();setNotice('参考片段已保存；没有请求模型。');setText('');setSamples([]);});}
  async function readFile(file:File){await operation(async()=>{if(file.size>8*1024*1024)throw new Error('文件超过8MB，请先按卷拆分');const buffer=await file.arrayBuffer(),decoded=decodeReferenceBytes(buffer),options=sampleReferenceFile(decoded.text);setSamples(options);setText(options[0].text);setStage(options[0].stage);setTitle(file.name.replace(/\.(txt|md)$/i,'').slice(0,120));setSource('本人选择的本机文件：'+file.name);setNotice(`已在本机读取${decoded.encoding}文件，抽取${options.length}份候选。查看后再保存；尚未上传全文。`);});if(fileRef.current)fileRef.current.value='';}
  async function execute(key:string,limit=3){
    activeTask.current=key;
    for(let i=0;i<limit&&running.current&&alive.current;i++){
      const task=await request('styleTaskStep',{key});
      await Promise.all([reload(),onRefresh()]);
      if(!running.current||['paused','blocked','completed'].includes(task.status))break;
    }
    if(alive.current)setNotice('本轮检查点已保存。请查看结果；试写不会进入正式章节。');
  }
  async function start(type:'analysis'|'trial'){
    await operation(async()=>{running.current=true;launchKey.current ||=crypto.randomUUID();try{const task=await request('styleTaskCreate',{input:{type,key:launchKey.current,referenceKeys:selected,profileKey,brief}});launchKey.current='';activeTask.current=task.key;await reload();if(!running.current){await request('styleTaskPause',{key:task.key});return;}if(task.status!=='completed')await execute(task.key,type==='analysis'?1:3);}finally{running.current=false;await reload().catch(()=>{});await onRefresh();}});
  }
  async function continueTask(t:any){await operation(async()=>{running.current=true;try{await execute(t.key,t.type==='analysis'?1:3);}finally{running.current=false;await reload().catch(()=>{});await onRefresh();}});}
  async function pause(key=activeTask.current){running.current=false;if(!key)return;try{await request('styleTaskPause',{key});await reload();setNotice('已请求暂停；最多保存当前请求，不会发起下一个请求。');}catch(e:any){setError(e.message);}}
  function useNextPlan(){const n=Math.max(0,...chapters.map((c:any)=>c.number))+1,c=book.plan?.contracts?.find((c:any)=>c.number===n);if(c)setBrief(Object.entries(c).filter(([k])=>['title','goal','cause','conflict','method','consequence','emotion','hook'].includes(k)).map(([k,v])=>`${k}：${String(v)}`).join('\n').slice(0,2000));else setBrief(`为《${book.title}》设计一段独立试写。方向：${book.direction}\n请补充本段发生地点、出场人物、各自目标、眼前阻碍、一次有代价的选择及本段结束时的变化。仅试写当前事件，不提前兑现后续情节。`);}
  if(!book)return <section className="card muted-empty">先创建或选择一本小说，再为它建立参考库与文风方案。</section>;
  const disabled=busy||outerBusy||active,profile=data?.profiles.find((p:any)=>p.key===profileKey),pending=data?.tasks.filter((t:any)=>!t.imported&&!['completed','blocked'].includes(t.status))||[];
  return <>
    <div className="page-heading"><div><span className="eyebrow">CRAFT / 文风</span><h1>参考与文风</h1><p>研究写作技法，为《{book.title}》建立自己的表达方式。</p></div><Button variant="outline" onClick={()=>reload().catch(e=>setError(e.message))}><RefreshCw size={16}/>刷新状态</Button></div>
    {error&&<div className="banner error" role="alert">{error}</div>}{notice&&<div className="banner success" role="status">{notice}</div>}
    {active&&<div className="banner">正式创作任务正在运行。请先暂停并等待当前检查点保存，再操作文风实验。</div>}
    <section className="card"><div className="section-title"><h2><BookOpen size={18}/>本书采用的文风</h2><span className="tag">{data?.bindings.length?'已绑定':'沿用基本文风'}</span></div>
      {data?.bindings.length?<div className="style-bindings">{data.bindings.map((b:any)=><p key={b.fromChapter}><b>第{b.fromChapter}章起 · {b.profile.card.name}</b><br/><small>{b.profile.card.summary}</small></p>)}</div>:<p>先分析参考片段，再完成同一任务的两版试写和审核，由你阅读后采用。</p>}
      <p className="small-note">新文风只用于尚未开始的章节。已有正文和定稿保持原版本，写手仍可读取本书已锁定原文。</p>
    </section>
    <div className="style-grid">
      <section className="card"><div className="section-title"><h2>1 · 保存参考片段</h2><Button variant="outline" disabled={disabled} onClick={()=>fileRef.current?.click()}><Upload size={16}/>导入TXT</Button></div>
        <input ref={fileRef} type="file" accept=".txt,.md,text/plain,text/markdown" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void readFile(f);}}/>
        <p className="small-note">整本TXT先在本机抽取开篇、中部、结尾候选，只保存你选取的片段。每份200—8000字符，本书最多8份、48000字符。</p>
        <div className="outline-form"><label className="field"><span>作品名 / 参考名称</span><Input value={title} maxLength={120} onChange={e=>setTitle(e.target.value)}/></label>
          <div className="form-grid"><label className="field"><span>作者（选填）</span><Input value={author} maxLength={100} onChange={e=>setAuthor(e.target.value)}/></label><label className="field"><span>片段位置</span><select value={stage} onChange={e=>setStage(e.target.value)}>{Object.entries(stageNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
          <label className="field"><span>书页链接或来源备注</span><Input value={source} maxLength={500} onChange={e=>setSource(e.target.value)}/></label>
          {!!samples.length&&<div className="button-row">{samples.map((s,i)=><Button key={i} variant="outline" onClick={()=>{setText(s.text);setStage(s.stage);}}>{s.label}</Button>)}</div>}
          <label className="field"><span>参考原文 · {text.length}字符</span><Textarea rows={9} value={text} maxLength={8000} onChange={e=>setText(e.target.value)} placeholder="可直接粘贴片段；按同题材、同读者选择，并保留来源。"/></label>
          <label className="style-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>我有权将所选片段发送给已配置模型，用于写作技法分析。</span></label>
          <div className="button-row"><Button disabled={disabled||!title.trim()||text.trim().length<200||!consent} onClick={()=>saveReferences([{text,stage}])}>保存当前片段 · 不调用模型</Button>{samples.length>1&&<Button variant="outline" disabled={disabled||!consent||!title.trim()} onClick={()=>saveReferences(samples)}>保存文件的{samples.length}份候选</Button>}</div>
        </div>
      </section>
      <section className="card"><h2>2 · 分析参考技法</h2><p>选取要研究的片段。策划角色分析六个维度，保留短引文证据，生成本书文风规则。</p>
        {!data?.references.length&&<p className="small-note">还没有参考文本。先在左侧导入或粘贴。</p>}
        {data?.references.map((r:any)=><div className="style-reference" key={r.key}><label className="style-check"><input type="checkbox" disabled={disabled||r.archived} checked={selected.includes(r.key)&&!r.archived} onChange={e=>setSelected(e.target.checked?[...selected,r.key]:selected.filter(k=>k!==r.key))}/><span><b>{r.title}</b> · {stageNames[r.stage]}{r.archived?'（已归档）':''}<br/><small>{r.author||'作者未登记'} · {r.text.length}字符</small></span></label><details><summary>查看保存的原文与来源</summary><p>{r.source||'未填写来源说明'}</p><pre className="style-prose">{r.text}</pre></details><Button size="sm" variant="outline" disabled={disabled} onClick={()=>operation(async()=>{await request('styleArchive',{key:r.key,archived:!r.archived});await reload();})}>{r.archived?'重新选用':'归档片段'}</Button></div>)}
        <p className="small-note">本次使用策划配置：{settings.provider} / {settings.model}。分析1次请求，受现有费用授权及单次、单书、月度上限约束。</p>
        <div className="button-row"><Button disabled={disabled||!selected.length||pending.length>0} onClick={()=>start('analysis')}>分析所选参考 · 需费用授权</Button>{!settings.spendEnabled&&<Button variant="outline" onClick={onSettings}>检查模型与费用</Button>}</div>
      </section>
    </div>
    <section className="card"><h2>3 · 文风规则与来源证据</h2>{!data?.profiles.length?<p className="small-note">尚未完成参考分析。这里不会预填虚构的学习结果。</p>:<><label className="field"><span>本次对照使用的文风方案</span><select className="style-select" value={profileKey} onChange={e=>{setProfileKey(e.target.value);setReadTrial('');}}>{data.profiles.map((p:any)=><option value={p.key} key={p.key}>{p.card.name} · {new Date(p.createdAt).toLocaleString('zh-CN')}</option>)}</select></label>{profile&&<><p>{profile.card.summary}</p><div className="style-rules">{profile.card.rules.map((r:any)=><div key={r.dimension}><h3>{r.dimension}</h3><p>{r.instruction}</p><small>适用：{r.when}<br/>避免：{r.avoid}</small></div>)}</div><p className="small-note">需避免沿用：{profile.card.exclusions.join('；')}</p><details><summary>查看分析的原文依据</summary>{profile.evidence.map((e:any,i:number)=><blockquote key={i}><b>{e.dimension}</b>「{e.quote}」<p>{e.lesson}</p></blockquote>)}</details></>}</>}
    </section>
    <section className="card"><div className="section-title"><h2><FlaskConical size={18}/>4 · 同题对照试写</h2><Button variant="outline" disabled={disabled} onClick={useNextPlan}>填入下一章任务</Button></div>
      <p>两版使用相同人物、事实、场景任务和写手配置，每版约1500汉字。审核角色匿名比较后，由你阅读决定。试写独立保存，不进入正式剧情。</p>
      <label className="field"><span>共同场景任务 · {brief.length}/2000字符</span><Textarea rows={6} value={brief} maxLength={2000} onChange={e=>setBrief(e.target.value)} placeholder="写明人物、地点、目标、阻碍、一次选择与本段落点；80至2000字符。"/></label>
      <p className="small-note">写手2次请求：{settings.writerProvider||settings.provider} / {settings.writerModel||settings.model}；审核1次：{settings.reviewProvider||settings.provider} / {settings.reviewModel||settings.model}。每次请求分别预留费用，不保证缓存命中；暂停后最多保存当前检查点。自选文风实验计入本书实际成本，不含在默认90万字估算中。</p>
      {(settings.writerProvider||settings.provider)===(settings.reviewProvider||settings.provider)&&(settings.writerModel||settings.model)===(settings.reviewModel||settings.model)&&<p className="small-note">当前写手与审核为同一模型，属于分开的请求，不是跨模型验证。可在模型设置核对分工。</p>}
      <div className="button-row"><Button disabled={disabled||!profile||brief.trim().length<80||pending.length>0} onClick={()=>start('trial')}><Play size={16}/>开始对照试写 · 最多3次请求</Button>{busy&&activeTask.current&&<Button variant="outline" onClick={()=>pause()}><Pause size={16}/>暂停实验</Button>}</div>
    </section>
    <section className="card"><h2>5 · 实验记录与采用</h2>{!data?.tasks.length&&<p className="small-note">尚无实验。导入与查看参考不触发模型。</p>}
      {data?.tasks.map((t:any)=><article className="style-task" key={t.key}><div className="section-title"><h3>{t.type==='analysis'?'参考技法分析':'同题文风对照'} · {statusNames[t.status]}</h3><small>{phaseNames[t.phase]}</small></div>
        <p className="small-note">{new Date(t.createdAt).toLocaleString('zh-CN')} · {t.type==='analysis'?`${t.models.planner.provider} / ${t.models.planner.model}`:`写手 ${t.models.writer.provider} / ${t.models.writer.model}；审核 ${t.models.review.provider} / ${t.models.review.model}`}</p>
        {t.error&&<p className="negative">{t.error}</p>}{t.imported&&<p className="small-note">导入的历史记录；不能续跑或作为本作品新采用的试验。</p>}
        {!t.imported&&['ready','paused','running'].includes(t.status)&&<div className="button-row"><Button variant="outline" disabled={disabled||t.leaseUntil>Date.now()} onClick={()=>continueTask(t)}>{t.status==='running'?'核对中断状态（不重放请求）':'继续剩余检查点 · 需费用授权'}</Button>{['ready','running'].includes(t.status)&&<Button variant="outline" onClick={()=>pause(t.key)}><Pause size={16}/>暂停</Button>}</div>}
        {t.variants?.baseline&&<div className="style-grid">{(['baseline','enhanced'] as const).map(k=>t.variants[k]&&<details key={k} className="style-variant"><summary>{k==='baseline'?'基线版':'参考技法版'} · 已保存</summary><pre className="style-prose">{t.variants[k].text}</pre></details>)}</div>}
        {t.review&&<div className="style-comparison"><h3>审核意见 · {t.pass?'参考技法版未发现重要问题':'参考技法版尚未通过'}</h3><p>{t.review.reason}</p><p className="small-note">匿名稿映射：A={t.blindOrder[0]==='enhanced'?'参考技法版':'基线版'}；B={t.blindOrder[1]==='enhanced'?'参考技法版':'基线版'}。审核倾向：{t.review.winner==='tie'?'各有优劣':t.review.winner==='neither'?'两稿均需修改':t.review.winner}。这是模型判断，不是读者实验或签约结论。</p>{['A','B'].map(k=><details key={k}><summary>{k}稿原文证据与问题</summary>{t.review.variants[k].evidence.map((e:any,i:number)=><blockquote key={i}>「{e.quote}」<p>{e.reason}</p></blockquote>)}{t.review.variants[k].issues.map((e:any,i:number)=><p key={i} className="negative">{e.message}「{e.quote}」建议：{e.fix}</p>)}</details>)}</div>}
        {t.type==='trial'&&t.status==='completed'&&t.pass&&!t.imported&&!data.bindings.some((b:any)=>b.trialKey===t.key)&&<><label className="style-check"><input type="checkbox" checked={readTrial===t.key} onChange={e=>setReadTrial(e.target.checked?t.key:'')}/><span>我已阅读两版及审核意见，选择采用参考技法版。</span></label><Button disabled={disabled||readTrial!==t.key} onClick={()=>operation(async()=>{await request('styleActivate',{input:{taskKey:t.key,confirmRead:true}});await reload();await onRefresh();setNotice('文风已绑定，从下一未开始章生效。费用和创作任务保持原状态。');})}><Check size={16}/>采用文风 · 不调用模型</Button></>}
      </article>)}
    </section>
  </>;
}

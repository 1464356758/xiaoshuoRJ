'use client';
import {useRef,useEffect} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {providerInfo} from '@/lib/provider-info.mjs';
import {modelSettingsDirty,modelSettingsGaps,roleHasKey,sharedRoleDraft} from '@/components/model-settings-state.mjs';

const roles=[['writer','正文'],['review','审核']] as const;
const number=(value:string)=>value===''?null:Number(value);

export default function ModelSettingsPanel({cfg,saved,apiKey,onApiKey,keys,onKeys,onChange,onSave,onReload,onTest,onDashboard,message,busy,active}:any){
  const cached=useRef<any>({});
  useEffect(()=>{cached.current={};},[saved.revision]);
  const allKeys={planner:apiKey,...keys};
  const dirty=modelSettingsDirty(cfg,saved,allKeys),gaps=modelSettingsGaps(cfg,saved,allKeys);
  const shared=!cfg.writerProvider&&!cfg.reviewProvider;
  const locked=busy||active;
  function edit(patch:any,reviewFee=false){onChange({...cfg,...patch,...(reviewFee?{spendEnabled:false}:{})});}
  function mode(value:string){
    if((value==='shared')===shared)return;
    if(value==='shared'){
      for(const [slot] of roles)cached.current[slot]={provider:cfg[slot+'Provider'],model:cfg[slot+'Model'],workspace:cfg[slot+'Workspace'],input:cfg[slot+'InputPrice'],output:cfg[slot+'OutputPrice'],key:keys[slot]};
      onChange(sharedRoleDraft(cfg));onKeys({writer:'',review:''});
    }else{
      const next={...cfg,spendEnabled:false},nextKeys={...keys};
      for(const [slot] of roles){const old=cached.current[slot];next[slot+'Provider']=old?.provider||cfg.provider;next[slot+'Model']=old?.model||cfg.model;next[slot+'Workspace']=old?.workspace;next[slot+'InputPrice']=old?.input??cfg.inputPrice;next[slot+'OutputPrice']=old?.output??cfg.outputPrice;nextKeys[slot]=old?.key||'';}
      onChange(next);onKeys(nextKeys);
    }
  }
  function provider(slot:string,value:string){
    const base=slot==='planner',field=base?'provider':slot+'Provider';if(cfg[field]===value)return;
    if(base){edit({provider:value,model:'',workspace:undefined,inputPrice:null,outputPrice:null,...(!cfg.writerProvider?{writerModel:''}:{}),...(!cfg.reviewProvider?{reviewModel:''}:{})},true);onApiKey('');}
    else{edit({[field]:value,[slot+'Model']:'',[slot+'InputPrice']:null,[slot+'OutputPrice']:null,[slot+'Workspace']:''},true);onKeys({...keys,[slot]:''});}
  }
  function status(slot:string){
    if(slot!=='planner'&&!cfg[slot+'Provider'])return '沿用策划';
    if(allKeys[slot]?.trim())return '已填写，待保存';
    return roleHasKey(cfg,saved,{},slot)?'云端已保存':'尚未填写';
  }
  function serviceSelect(slot:string,label:string,inherit=false){
    const value=slot==='planner'?cfg.provider:cfg[slot+'Provider'];
    return <label className="field"><span>{label}</span><select aria-label={label} value={value||''} onChange={e=>provider(slot,e.target.value)}>{inherit&&<option value="">沿用策划服务商、密钥与最高单价</option>}{Object.entries(providerInfo).map(([id,p]:any)=><option key={id} value={id}>{p.name}</option>)}</select></label>;
  }
  function moneyInput(field:string,label:string){return <label className="field"><span>{label}</span><Input aria-label={label} type="number" inputMode="decimal" min="0" step="any" value={cfg[field]??''} onChange={e=>edit({[field]:number(e.target.value)},field.toLowerCase().includes('price'))}/></label>;}
  function keyInput(slot:string,label:string){
    const base=slot==='planner';return <label className="field"><span>{label}<small className="model-key-state">{status(slot)}</small></span><Input aria-label={label} type="password" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={base?apiKey:keys[slot]||''} placeholder={roleHasKey(cfg,saved,{},slot)?'已保存；留空保留，不会显示原密钥':'在此粘贴完整API Key'} onChange={e=>base?onApiKey(e.target.value):onKeys({...keys,[slot]:e.target.value})}/></label>;
  }
  return <section className="card model-settings-panel" aria-label="模型配置表单">
    <div className="model-form-summary" role="status"><strong>{dirty?'有未保存的模型配置':'当前显示云端已保存的配置'}</strong><p>① 填写模型与密钥　② 核对费用　③ 保存后返回创作控制台</p><p>策划：{status('planner')} · 正文：{status('writer')} · 审核：{status('review')}</p></div>
    {active&&<p className="model-form-alert" role="status">云端任务正在执行。请返回创作控制台暂停，再修改模型或测试连接。</p>}
    <fieldset disabled={locked} className="model-form-fields">
      <legend>密钥使用方式</legend>
      <div className="model-mode-options"><label><input type="radio" name="model-key-mode" value="shared" checked={shared} onChange={()=>mode('shared')}/><span><b>一把密钥，三个角色共用</b><small>策划、正文、审核分别执行任务，共用上方配置。</small></span></label><label><input type="radio" name="model-key-mode" value="separate" checked={!shared} onChange={()=>mode('separate')}/><span><b>按角色分别设置</b><small>可使用三把密钥，也可为某个角色选用其他模型。</small></span></label></div>
      <p className="small-note">切换密钥方式、服务商、模型或单价后，需要重新核对并勾选费用授权。</p>
      <div className="model-role-card"><h2>策划与默认模型</h2><div className="form-grid">
        {serviceSelect('planner','模型服务商')}
        <label className="field"><span>策划 / 默认模型</span><Input aria-label="策划 / 默认模型" value={cfg.model||''} autoCapitalize="none" spellCheck={false} onChange={e=>edit({model:e.target.value,...(!cfg.writerProvider?{writerModel:''}:{}),...(!cfg.reviewProvider?{reviewModel:''}:{})},true)}/></label>
        {keyInput('planner','API密钥')}
        {cfg.provider==='qwen'&&<label className="field"><span>策划北京业务空间ID</span><Input aria-label="策划北京业务空间ID" value={cfg.workspace||''} onChange={e=>{edit({workspace:e.target.value},true);onApiKey('');}}/></label>}
        {moneyInput('inputPrice','输入最高单价（元 / 百万token）')}
        {moneyInput('outputPrice','输出最高单价（元 / 百万token）')}
      </div><p className="small-note">密钥只在这里输入。保存后密码框留空，使用“云端已保存”确认结果。<a href={providerInfo[cfg.provider as keyof typeof providerInfo]?.console} target="_blank" rel="noreferrer">打开官方控制台</a></p></div>
      {shared&&roles.some(([slot])=>cfg[slot+'Model']&&cfg[slot+'Model']!==cfg.model)&&<div className="model-role-card"><p>已存配置包含其他角色型号：{roles.map(([slot,name])=>name+' '+(cfg[slot+'Model']||cfg.model)).join('；')}。这些角色共用策划密钥和最高单价，请按最高费用核对。</p><Button variant="outline" onClick={()=>edit({writerModel:'',reviewModel:''},true)}>统一使用策划模型</Button></div>}
      {!shared&&roles.map(([slot,name])=><div className="model-role-card" key={slot}><h2>{name}角色</h2><div className="form-grid">
        {serviceSelect(slot,name+'服务商',true)}
        {cfg[slot+'Provider']?<><label className="field"><span>{name}模型ID</span><Input aria-label={name+'模型ID'} autoCapitalize="none" spellCheck={false} value={cfg[slot+'Model']||''} onChange={e=>edit({[slot+'Model']:e.target.value},true)}/></label>{keyInput(slot,name+'API密钥')}
          {cfg[slot+'Provider']==='qwen'&&<label className="field"><span>{name}北京业务空间ID</span><Input aria-label={name+'北京业务空间ID'} value={cfg[slot+'Workspace']||''} onChange={e=>{edit({[slot+'Workspace']:e.target.value},true);onKeys({...keys,[slot]:''});}}/></label>}
          {moneyInput(slot+'InputPrice',name+'输入最高单价（元 / 百万token）')}{moneyInput(slot+'OutputPrice',name+'输出最高单价（元 / 百万token）')}</>:<p className="small-note">此角色沿用策划的服务商、密钥与最高单价。</p>}
      </div></div>)}
      <div className="model-role-card"><h2>费用上限</h2><p className="small-note">以下是你允许本软件使用的上限，实际扣费以供应商账单为准。</p><div className="form-grid">{moneyInput('monthLimit','月度最高费用（元）')}{moneyInput('bookLimit','每本书最高费用（元）')}{moneyInput('taskLimit','单次调用最高费用（元）')}</div></div>
      <details className="model-advanced"><summary>高级设置与连接测试</summary><div className="form-grid">
        <label className="field"><span>模型最大输出token（以供应商为准）</span><Input aria-label="模型最大输出token（以供应商为准）" type="number" min="64" max="65536" value={cfg.maxOutputTokens??''} onChange={e=>edit({maxOutputTokens:number(e.target.value)})}/></label>
        {moneyInput('chapterLimit','单章模型费用上限（元，留空沿用单书上限）')}
        <label className="field"><span>新章节分段目标（汉字）</span><Input aria-label="新章节分段目标（汉字）" type="number" min="1000" max="3500" value={cfg.segmentWords??''} onChange={e=>edit({segmentWords:number(e.target.value)})}/></label>
      </div><p className="small-note">连接测试会请求真实模型，可能计费。请先保存配置与费用授权；测试成功仅代表接口可用。</p><div className="button-row">{[['planner','策划'],...roles].map(([slot,label])=><Button variant="outline" key={slot} disabled={dirty||!saved.spendEnabled||gaps.length>0} onClick={()=>onTest(slot)}>测试{label}连接（可能计费）</Button>)}</div></details>
    </fieldset>
    <div className="model-save-bar">
      <label className="model-fee-consent"><input aria-label="允许模型调用费用" type="checkbox" disabled={locked} checked={!!cfg.spendEnabled} onChange={e=>edit({spendEnabled:e.target.checked})}/><span>我已核对模型、单价和上限，允许由我启动的任务与连接测试调用模型。</span></label>
      {message&&<p className={message.kind==='error'?'negative':'model-save-message'} role={message.kind==='error'?'alert':'status'}>{message.text}</p>}
      <div className="model-save-actions"><Button disabled={locked} onClick={onSave}>{busy?'正在处理，请稍候…':'保存模型配置'}</Button><Button variant="outline" disabled={busy} onClick={onReload}>核对云端保存结果</Button></div>
      <p className="small-note">保存不调用模型。{dirty?'当前更改还没有保存。':saved.spendEnabled?'云端费用授权已开启。':'云端费用授权尚未开启。'}</p>
      <Button variant="link" disabled={busy} onClick={onDashboard}>返回创作控制台</Button>
    </div>
  </section>;
}

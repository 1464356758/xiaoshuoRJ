import {monthKey} from './store.mjs';
export const providers={deepseek:'https://api.deepseek.com/v1',openai:'https://api.openai.com/v1',openrouter:'https://openrouter.ai/api/v1',siliconflow:'https://api.siliconflow.cn/v1',moonshot:'https://api.moonshot.cn/v1',groq:'https://api.groq.com/openai/v1'};
export const defaults={provider:'deepseek',model:'deepseek-chat',writerModel:'',reviewModel:'',apiKeyEncrypted:'',inputPrice:null,outputPrice:null,monthLimit:30,bookLimit:20,taskLimit:2,spendEnabled:false};
export function validateConfig(x) {
  if(!Object.hasOwn(providers,x.provider))throw new Error('请选择支持的模型服务商');
  for(const k of ['monthLimit','bookLimit','taskLimit'])if(!Number.isFinite(x[k])||x[k]<0||x[k]>10000)throw new Error('费用上限必须在0到10000元之间');
  for(const k of ['inputPrice','outputPrice'])if(x[k]!==null&&(!Number.isFinite(x[k])||x[k]<0||x[k]>100000))throw new Error('模型单价无效');
  if(!x.model||x.model.length>150)throw new Error('模型名称无效');return x;
}
export async function seal(value,secret,decrypt=false) {
  if(!secret)throw new Error('密钥保险箱未配置，请联系应用维护者');
  const raw=Uint8Array.from(atob(secret),c=>c.charCodeAt(0)); const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
  if(decrypt){const b=Uint8Array.from(atob(value),c=>c.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(0,12)},key,b.slice(12)));}
  const iv=crypto.getRandomValues(new Uint8Array(12));const b=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(value)));return btoa(String.fromCharCode(...iv,...b));
}
export async function modelCall(store,cfg,book,prompt,role,secret,fetcher=fetch) {
  if(!cfg.spendEnabled)throw new Error('费用调用尚未开启，请在模型设置中确认费用上限');
  if(!cfg.apiKeyEncrypted)throw new Error('请先在模型设置中保存API密钥');
  if(cfg.inputPrice===null||cfg.outputPrice===null)throw new Error('请先填写已核实的模型单价（人民币/百万token）');
  if(prompt.length>120000)throw new Error('上下文超出安全范围，需要精简记忆');
  const maxTokens=role==='plan'||role==='rewrite'?16000:role==='review'?8000:role==='contract'?6000:4500;
  const model=(role==='write'||role==='rewrite'?cfg.writerModel:role==='review'?cfg.reviewModel:cfg.model)||cfg.model;
  const reserve=Math.ceil((new TextEncoder().encode(prompt).length+2048)*cfg.inputPrice+maxTokens*cfg.outputPrice);
  if(reserve>cfg.taskLimit*1e6)throw new Error(`本次最高预留 ${(reserve/1e6).toFixed(3)} 元超过单次上限`);
  const key=await seal(cfg.apiKeyEncrypted,secret,true); const id=crypto.randomUUID();
  const statement=store.db.prepare(`INSERT INTO calls (id,owner,book,month,amount,status,data,created) SELECT ?,?,?,?,?,?,?,? WHERE COALESCE((SELECT SUM(amount) FROM calls WHERE owner=? AND month=?),0)+?<=? AND COALESCE((SELECT SUM(amount) FROM calls WHERE owner=? AND book=?),0)+?<=?`);
  const data={role,model,reserved:reserve/1e6}; const month=monthKey();
  const r=await statement.bind(id,store.owner,book.id,month,reserve,'reserved',JSON.stringify(data),Date.now(),store.owner,month,reserve,Math.floor(cfg.monthLimit*1e6),store.owner,book.id,reserve,Math.floor(Math.min(book.budget,cfg.bookLimit)*1e6)).run();
  if(r.meta.changes!==1)throw new Error('月度或单书费用额度不足，已自动暂停');
  try {
    const response=await fetcher(providers[cfg.provider]+'/chat/completions',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model,messages:[{role:'system',content:'你是严谨的原创中文网文创作引擎。只返回指定JSON。不得宣称签约保证、抄袭或模仿特定作者。'}, {role:'user',content:prompt}],max_tokens:maxTokens,temperature:role==='review'?0.2:0.8,stream:false}),signal:AbortSignal.timeout(100000)});
    if(!response.ok)throw new Error(`模型服务返回HTTP ${response.status}；本次费用保留待核对`);
    const out=await response.json(); const body=out.choices?.[0]?.message?.content;
    if(!body||body.length>180000)throw new Error('模型响应缺失或过长');
    if(out.choices[0].finish_reason==='length')throw new Error('模型输出被截断，未提交不完整结果');
    const u=out.usage;const known=Number.isFinite(u?.prompt_tokens)&&Number.isFinite(u?.completion_tokens)&&u.prompt_tokens>=0&&u.completion_tokens>=0;
    const amount=known?Math.ceil(u.prompt_tokens*cfg.inputPrice+u.completion_tokens*cfg.outputPrice):reserve;
    await store.db.prepare('UPDATE calls SET amount=?,status=?,data=? WHERE id=? AND owner=?').bind(amount,known?'settled':'uncertain',JSON.stringify({...data,usage:u||null}),id,store.owner).run();
    const clean=body.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');return JSON.parse(clean);
  } catch(e) {
    await store.db.prepare("UPDATE calls SET status='uncertain' WHERE id=? AND owner=? AND status='reserved'").bind(id,store.owner).run();throw e;
  }
}

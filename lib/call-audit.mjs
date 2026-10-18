// Owner-scoped accounting across books, connection tests and repository tools.
// These are locally recorded ceiling amounts, never a provider invoice.
export async function callAudit(store,now=Date.now()){
  const rows=(await store.db.prepare('SELECT id,book,amount,status,data,created FROM calls WHERE owner=? ORDER BY created DESC').bind(store.owner).all()).results;
  const calls=rows.map(row=>{let d;try{d=JSON.parse(row.data);}catch{d={};}return {id:row.id,bookId:row.book,createdAt:new Date(row.created).toISOString(),created:row.created,status:row.status,recordedAmount:row.amount/1e6,role:d.role||null,provider:d.provider||null,model:d.model||null,chapter:d.chapter??null,providerRequestId:d.providerRequestId||null,httpStatus:d.httpStatus??null,inputTokens:d.usage?.prompt_tokens??null,outputTokens:d.usage?.completion_tokens??null,reasoningTokens:d.usage?.completion_tokens_details?.reasoning_tokens??null};});
  const group=keys=>{const map=new Map();for(const c of calls){const key=JSON.stringify(keys.map(k=>c[k]));const g=map.get(key)||{...Object.fromEntries(keys.map(k=>[k,c[k]])),count:0,recordedAmount:0};g.count++;g.recordedAmount+=c.recordedAmount;map.set(key,g);}return [...map.values()];};
  const hour=calls.filter(c=>c.created>=now-3600000);
  return {scope:'all-owner-calls',currency:'CNY',basis:'configured-ceiling-not-provider-invoice',generatedAt:new Date(now).toISOString(),totalCalls:calls.length,recordedAmount:calls.reduce((s,c)=>s+c.recordedAmount,0),lastHour:{count:hour.length,recordedAmount:hour.reduce((s,c)=>s+c.recordedAmount,0)},byRole:group(['role','status']),byBook:group(['bookId','status']),calls};
}

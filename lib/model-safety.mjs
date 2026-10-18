export const MODEL_RATE_LIMITS={minute:6,hour:60};
export function modelOutboundDisabled(){return typeof process!=='undefined'&&process.env?.NOVEL_MODEL_API_DISABLED==='1';}
export function assertModelOutbound(){if(modelOutboundDisabled())throw new Error('模型接口已被维护停用，不会发送任何模型请求；等待费用核查与明确恢复');}
const active=new Map();
export function registerModelRequest(owner,bookId){
  const item={bookId,controller:new AbortController()},items=active.get(owner)||new Set();items.add(item);active.set(owner,items);
  return {controller:item.controller,release(){items.delete(item);if(!items.size)active.delete(owner);}};
}
export function cancelModelRequests(owner,bookId){let count=0;for(const item of active.get(owner)||[])if(!bookId||item.bookId===bookId){item.controller.abort(new Error('本人已停止模型请求'));count++;}return count;}
export async function tripModelCircuit(store,revision){
  const current=await store.get('settings:'+store.owner);
  if(current&&current.revision===revision&&current.spendEnabled){try{await store.save(current,{...current,spendEnabled:false,modelStopReason:'模型请求异常，费用调用已熔断；先核对用量和密钥，再明确恢复'});}catch{}}
}

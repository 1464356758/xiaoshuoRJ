export function installCloudClient(native,{timeoutMs=125000}={}){
  const browserFetch=globalThis.fetch.bind(globalThis),pending=new Map();
  globalThis.__novelCloudResult=(id,raw)=>{const p=pending.get(id);if(!p)return;pending.delete(id);p.cleanup();try{const x=JSON.parse(raw);if(x.error)p.reject(new Error(x.error));else p.resolve(new Response([204,205,304].includes(x.status)?null:x.body,{status:x.status,headers:x.headers||{}}));}catch{p.reject(new Error('云端返回格式异常，请先读取进度；未自动重试'));}};
  function request(path,init={}){return new Promise((resolve,reject)=>{
    const id=crypto.randomUUID(),signal=init.signal;
    if(signal?.aborted){reject(new Error('已取消本次手机请求'));return;}
    const abort=()=>{const p=pending.get(id);pending.delete(id);p?.cleanup();native.cancelRequest(id);reject(new Error('手机连接已中断；云端任务不会因此暂停，请重新读取进度'));};
    const timer=setTimeout(()=>{const p=pending.get(id);if(!p)return;pending.delete(id);p.cleanup();native.cancelRequest(id);reject(new Error('手机连接等待超时，请读取云端最新状态后再操作；本次未自动重试'));},timeoutMs);
    pending.set(id,{resolve,reject,cleanup:()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);}});signal?.addEventListener('abort',abort,{once:true});
    try{native.request(id,path,init.method||'GET',init.body||'');}catch(e){pending.get(id)?.cleanup();pending.delete(id);reject(e);}
  });}
  globalThis.fetch=(input,init={})=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href);
    if(url.origin===location.origin&&['/api/workspace','/api/status'].includes(url.pathname))return request(url.pathname+url.search,init);
    if(url.protocol==='blob:'||url.origin===location.origin)return browserFetch(input,init);
    return Promise.reject(new Error('手机只访问已连接的独立云端；外部网页请从官方链接打开'));
  };
  return {connect(origin,token){return new Promise((resolve,reject)=>{const id=crypto.randomUUID(),timer=setTimeout(()=>{if(!pending.delete(id))return;native.cancelRequest(id);reject(new Error('连接验证等待超时，请核对网络后重新连接'));},timeoutMs);pending.set(id,{resolve,reject,cleanup(){clearTimeout(timer);}});try{native.connect(id,origin,token);}catch(e){pending.get(id)?.cleanup();pending.delete(id);reject(e);}});}};
}

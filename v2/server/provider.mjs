import https from 'node:https';
import http from 'node:http';
// A single ClientRequest. No SDK, redirects, retry, fallback, tools or reconnect.
export function generateOnce({payload,key,signal,onChunk,endpoint='https://api.deepseek.com/chat/completions',timeoutMs=900000}){
 return new Promise((resolve,reject)=>{const url=new URL(endpoint);if(url.href!=='https://api.deepseek.com/chat/completions'&&!['127.0.0.1','::1','localhost'].includes(url.hostname))return reject(new Error('不允许的供应商出口'));
 const transport=url.protocol==='https:'?https:http;const body=JSON.stringify(payload);let raw='',status=null,requestId=null,finished=false;
 const req=transport.request(url,{method:'POST',agent:false,headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},signal},res=>{status=res.statusCode;requestId=res.headers['x-request-id']||res.headers['request-id']||null;res.setEncoding('utf8');res.on('data',chunk=>{raw+=chunk;if(raw.length>12000000){req.destroy(new Error('供应商响应过大'));return;}onChunk?.(raw,status,requestId);});res.on('aborted',()=>fail(new Error('供应商响应中断')));res.on('error',fail);res.on('end',()=>{if(finished)return;finished=true;clearTimeout(timer);resolve({raw,httpStatus:status,requestId});});});
 const fail=e=>{if(finished)return;finished=true;clearTimeout(timer);e.partial={raw,httpStatus:status,requestId};reject(e);};req.on('error',fail);const timer=setTimeout(()=>req.destroy(new Error('供应商请求超时，可能已接收，不自动重发')),timeoutMs);req.end(body);
 });
}

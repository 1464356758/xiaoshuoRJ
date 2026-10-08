import {env} from 'cloudflare:workers';
import {tickRunner,runnerStatus} from '@/lib/jobs.mjs';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function resources(request:Request) {
  const e=env as unknown as Record<string,any>;
  // Service route runs only behind the confirmed owner-private Sites dispatcher.
  // Dispatch consumes OAI-Sites-Authorization; no user identity is fabricated.
  // Ordinary browser requests must use the owner-scoped /api/workspace controls.
  if(e.CLOUD_RUNNER_ENABLED!=='1'||!e.DB)throw new Error('云端调度未启用');
  if(request.headers.get('Origin')||request.headers.get('Sec-Fetch-Site')||request.headers.get('oai-authenticated-user-id'))throw new Error('请通过工作台管理自己的云端任务');
  return e;
}
export async function GET(request:Request) {try{const e=resources(request);return reply({runner:await runnerStatus(e.DB)});}catch(e:any){return reply({error:e.message},403);}}
export async function POST(request:Request) {
  try {const e=resources(request);if(Number(request.headers.get('content-length')||0)>1000)return reply({error:'请求过大'},413);
    const x=await request.json();if(JSON.stringify(x)!=='{"action":"tick"}')return reply({error:'服务调用仅允许推进已经授权的任务'},400);
    return reply(await tickRunner(e.DB,e.DATA_ENCRYPTION_KEY));
  }catch(e:any){return reply({error:e.message},403);}
}

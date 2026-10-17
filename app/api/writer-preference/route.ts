import {env} from 'cloudflare:workers';
import {Store} from '@/lib/store.mjs';
import {useDeepseekWriter} from '@/lib/writer-preference.mjs';
import {RUNNER_OWNER} from '@/lib/jobs.mjs';
export const dynamic='force-dynamic';
const reply=(x:unknown,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
// Like /api/runner, this route is behind the confirmed owner-private Sites
// dispatcher. The service credential is consumed there, not stored by this app.
// It cannot read settings, accept identities, edit other fields or run a model.
export async function POST(request:Request) {
  try {
    const e=env as unknown as Record<string,any>;
    if(e.CLOUD_RUNNER_ENABLED!=='1'||!e.DB||request.headers.get('Origin')||request.headers.get('Sec-Fetch-Site')||request.headers.get('oai-authenticated-user-id'))return reply({error:'请在自己的工作台切换主写手'},403);
    const raw=await request.text();if(raw.length>1000)return reply({error:'请求过大'},413);
    if(raw!=='{"action":"useDeepseekWriter"}')return reply({error:'仅允许已指定的DeepSeek主写偏好，无其他参数'},400);
    const owners=await e.DB.prepare('SELECT DISTINCT owner FROM records WHERE owner<>? LIMIT 2').bind(RUNNER_OWNER).all();
    if(owners.results.length!==1)return reply({error:'仅支持已确认的单所有者私有工作台；请使用本人工作台设置'},409);
    return reply(await useDeepseekWriter(new Store(e.DB,owners.results[0].owner)));
  }catch(e:any){return reply({error:e.message},409);}
}

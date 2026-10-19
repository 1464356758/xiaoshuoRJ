import {createServer} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {readConfig,safeConfig,capabilities} from './config.mjs';
import {exportBackup,restoreBackup} from './backup.mjs';
import {ensure,parse,han,hash} from './store.mjs';
export const VERSION='2.0.0';
const auth=(value,key)=>typeof value==='string'&&timingSafeEqual(createHash('sha256').update(value).digest(),createHash('sha256').update('Bearer '+key).digest());
function safeStep(x){const d=x.data||{};return {key:x.key,bookId:x.book_id,chapterId:x.chapter_id,phase:x.phase,status:x.status,created:x.created,updated:x.updated,role:d.role,model:d.config?.model,configRevision:d.config?.configRevision,parameters:d.payload?{...d.payload,messages:undefined}:null,intentAt:d.intentAt,sentAt:d.sentAt,httpStatus:d.httpStatus,providerRequestId:d.requestId||d.responseId,usage:d.usage||null,estimatedCny:d.estimatedCny??null,amountStatus:d.estimatedCny==null?'金额待核对':'按配置单价估算，非官方扣费凭证',error:d.error||null,inputVersion:d.inputVersion,outputVersion:d.outputVersion,partial:!!d.partial};}
export function createService(engine,{serverId,controlToken,publicOrigin=null,build='development'}={}){const s=engine.s;
 const json=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store','X-Novel-Server-Id':serverId,'X-Content-Type-Options':'nosniff'}});
 async function dispatch(req){try{const u=new URL(req.url);if(u.pathname==='/healthz'&&req.method==='GET')return json({ok:!engine.closing&&s.held(engine.token),version:VERSION},engine.closing?503:200);ensure(auth(req.headers.get('Authorization'),controlToken),'云端连接凭证无效',401);ensure(!req.headers.has('Origin')||req.headers.get('Origin')===publicOrigin,'请求来源不匹配',403);
 if(u.pathname==='/api/status'&&req.method==='GET')return json({product:'novel-factory-cloud',version:VERSION,protocol:2,serverId,build,workerReady:s.held(engine.token)&&!engine.closing,requiresPhone:false,execution:'independent-server',modelApiDisabled:engine.disabled,lastTick:s.meta('heartbeat'),migration:s.meta('legacyImported'),budgetChecksEnabled:false});
 ensure(req.headers.get('X-Novel-Server-Id')===serverId,'服务器身份已变化，请重新核对连接',409);
 if(req.method==='GET'){
  if(u.pathname==='/v2/state'){const books=s.books().filter(b=>!b.internal),id=u.searchParams.get('book')||books[0]?.id;const steps=s.all('SELECT key FROM steps ORDER BY created DESC LIMIT 100').map(r=>safeStep(s.step(r.key)));const jobs=s.all('SELECT book_id FROM jobs').map(r=>{const {config,...j}=s.job(r.book_id);return {...j,configRevision:config?.revision};});return json({version:VERSION,build,books,selectedId:id||null,chapters:id?s.chapters(id).map(c=>({...c,words:han(c.body)})):[],jobs,settings:safeConfig(readConfig(s)),capabilities,steps,heartbeat:s.meta('heartbeat'),migration:s.meta('legacyImported'),legacyCallCount:s.get("SELECT count(*) n FROM archive WHERE kind='legacy-call'")?.n||0});}
  if(u.pathname==='/v2/versions')return json({versions:s.all('SELECT * FROM versions WHERE chapter_id=? ORDER BY created',u.searchParams.get('chapter')).map(r=>({...r,data:parse(r.data)})),reviews:s.all('SELECT * FROM reviews WHERE chapter_id=? ORDER BY ordinal',u.searchParams.get('chapter')).map(r=>({...r,data:parse(r.data)}))});
  if(u.pathname==='/v2/step'){const st=s.step(u.searchParams.get('key'));ensure(st,'步骤不存在',404);return json({...safeStep(st),raw:st.raw,task:st.data.task});}
  if(u.pathname==='/v2/legacy-calls')return json({calls:s.all("SELECT data FROM archive WHERE kind='legacy-call'").map(r=>parse(r.data))});
  if(u.pathname==='/v2/backup')return json(exportBackup(s));
  if(u.pathname==='/v2/export'){const b=s.book(u.searchParams.get('book'));ensure(b,'作品不存在',404);const text=b.title+'\n\n'+s.chapters(b.id).filter(c=>c.body).map(c=>'第'+c.number+'章 '+(c.title||'')+'\n['+(c.release||'未收稿')+']\n\n'+c.body).join('\n\n');return new Response(text,{headers:{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'}});}
 }
 if(u.pathname==='/v2/action'&&req.method==='POST'){const x=await req.json();let result;
  if(x.action==='settings')result=engine.settings(x.input);
  else if(x.action==='create')result=engine.createBook(x.input);
  else if(x.action==='start')result=engine.start(x.bookId,x.input);
  else if(x.action==='stop')result=engine.stop(x.bookId);
  else if(x.action==='stopAll'){for(const j of s.all('SELECT book_id FROM jobs'))engine.stop(j.book_id);result={ok:true};}
  else if(x.action==='test')result=engine.testConnection(x.input);
  else if(x.action==='edit')result=engine.edit(x.chapterId,x.input);
  else if(x.action==='reparse')result=engine.reparse(x.key);
  else if(x.action==='restore'){ensure(!engine.busy,'请先停止运行任务');result=restoreBackup(s,x.input);}
  else if(x.action==='planSave'){const b=s.book(x.bookId);ensure(b,'作品不存在',404);ensure(s.job(b.id)?.state!=='running','请先停止任务');ensure(x.input.baseHash===(b.planHash||hash(b.plan)),'规划已变化，保留输入');const done=s.chapters(b.id).filter(c=>c.body);const plan=x.input.plan;ensure(plan?.bible&&Array.isArray(plan.outlines),'规划格式无效',400);for(const c of done)ensure(JSON.stringify(plan.outlines.find(o=>o.number===c.number))===JSON.stringify(b.plan?.outlines.find(o=>o.number===c.number)),'不能改动已开始章节的规划');b.plan=plan;b.planHash=hash(plan);s.saveBook(b);result=b;}
  else throw Object.assign(new Error('未知操作'),{status:400});return json({ok:true,result});}
 return json({error:'此接口已升级。请安装V2独立安卓App。旧操作不会启动模型。'},410);
 }catch(e){return json({error:String(e.message),originalPreserved:true,automaticRetry:false},e.status||400);}}
 const server=createServer({maxHeaderSize:16384},async(req,res)=>{try{if(req.url!=='/healthz'&&!auth(req.headers.authorization,controlToken)){req.resume();res.writeHead(401,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"云端连接凭证无效"}');return;}let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;ensure(size<=64000000,'请求超过64MB',413);chunks.push(chunk);}const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(typeof v==='string')headers.set(k,v);const method=req.method||'GET',r=await dispatch(new Request('http://cloud.internal'+req.url,{method,headers,...(!['GET','HEAD'].includes(method)?{body:Buffer.concat(chunks)}:{})}));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch(e){res.writeHead(e.status||400,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:String(e.message),automaticRetry:false}));}});
 server.requestTimeout=60000;server.headersTimeout=15000;return {dispatch,server,async listen(port=0,host='127.0.0.1'){await new Promise(r=>server.listen(port,host,r));engine.kick();return server.address();},async close(){server.closeAllConnections();await new Promise(r=>server.close(r));await engine.close();}};
}

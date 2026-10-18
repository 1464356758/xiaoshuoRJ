// SYNTHETIC ONLY. Real packaged UI, API and SQLite; never calls a real supplier.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildServer} from '../cloud-server/build-server.mjs';
import {createBook,config,settings,step} from '../lib/engine.mjs';
import {startJob,pauseJob} from '../lib/jobs.mjs';
import {seal} from '../lib/model.mjs';
import {resolveModel} from '../lib/model-routing.mjs';
import {craftFixture} from '../tests/craft-support.mjs';
import {synthetic} from '../tests/workflow-support.mjs';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?modules+'/playwright/index.mjs':'playwright');
await buildServer();
const {createCloudService}=await import('../cloud-server/service.mjs');
const work=await mkdtemp(join(tmpdir(),'SYNTHETIC-cloud-ui-audit-'));
let assets=new URL('../android-cloud/assets/',import.meta.url).pathname;
if(process.env.NOVEL_TEST_APK){
  assets=join(work,'apk-assets');
  execFileSync('python3',['-c',"import zipfile,pathlib,sys\np=pathlib.Path(sys.argv[2]);p.mkdir()\nwith zipfile.ZipFile(sys.argv[1]) as z:\n assert z.testzip() is None\n for n in ['index.html','app.js','app.css']:(p/n).write_bytes(z.read('assets/'+n))",process.env.NOVEL_TEST_APK,assets]);
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
const http=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://local').pathname,name=path.endsWith('.js')?'app.js':path.endsWith('.css')?'app.css':'index.html';res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(await readFile(join(assets,name)));}catch{res.writeHead(500);res.end();}});
await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+http.address().port;
let passed=0;
async function until(check){const end=Date.now()+5000;while(Date.now()<end){if(await check())return;await new Promise(r=>setTimeout(r,5));}throw new Error('SYNTHETIC condition deadline');}
async function scenario(name,fn,{seed=false,withBook=false,width=390,height=844,rewrite=false}={}){
  if(process.env.NOVEL_UI_CASE&&!name.includes(process.env.NOVEL_UI_CASE))return;
  const directory=await mkdtemp(join(work,'case-'));
  let simulatedCalls=0;
  const service=await createCloudService({directory,autoStart:false,invoke:async(...args)=>{simulatedCalls++;if(rewrite&&args[4]==='rewrite')return {text:synthetic(878,1000)};return craftFixture(...args);}});
  const secrets=JSON.parse(await readFile(join(directory,'server-secrets.json'),'utf8'));
  const headers={Authorization:'Bearer '+secrets.controlToken,'X-Novel-Server-Id':service.serverId,'Content-Type':'application/json'};
  if(seed)await settings(service.store,{apiKey:'SYNTHETIC_SAVED_KEY_NOT_REAL',spendEnabled:true},secrets.encryptionKey);
  const book=withBook?await createBook(service.store,{title:'SYNTHETIC ONLY / existing novel',totalChapters:3,targetWords:1000,budget:20},crypto.randomUUID()):null;
  await service.tick();
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true}),faults={},actions=[],errors=[];
  const counts=action=>actions.filter(x=>x===action).length;
  async function open({view='settings',connected=true,initialFailure=false}={}){
    const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('syntheticConnect',async(origin,token)=>{const r=await service.dispatch(new Request(origin+'/api/status',{headers:{Authorization:'Bearer '+token}}));return {status:r.status,body:await r.text(),headers:Object.fromEntries(r.headers)};});
    await page.exposeFunction('syntheticNativeRequest',async(id,path,method,body)=>{
      const action=method==='POST'?JSON.parse(body).action:null;if(action)actions.push(action);
      let result;
      if(method==='GET'&&faults.failNextRead){faults.failNextRead=false;result={status:503,body:JSON.stringify({error:'SYNTHETIC read failure'})};}
      else if(action==='settings'&&faults.rejectSave)result={status:400,body:JSON.stringify({error:'SYNTHETIC save rejection'})};
      // Paid test buttons are intercepted before API dispatch, never sent upstream.
      else if(action==='testConnection')result={status:200,body:JSON.stringify({result:{provider:'deepseek',model:'deepseek-v4-pro',cost:0}})};
      else{
        const r=await service.dispatch(new Request('https://cloud.example'+path,{method,headers,...(method==='POST'?{body}:{})}));
        result={status:r.status,body:await r.text(),headers:Object.fromEntries(r.headers)};
        if(action==='settings'&&r.ok&&faults.failReadback)faults.failNextRead=true;
        if(r.ok&&((action==='settings'&&faults.holdSaveReply)||(action==='startEditorRevision'&&faults.holdRevisionReply)))await new Promise(resolve=>faults.release=resolve);
      }
      await page.evaluate(({id,result})=>window.__novelCloudResult(id,JSON.stringify(result)),{id,result});
    });
    await page.addInitScript(({connected})=>{
      window.syntheticProfile={connected,origin:'https://cloud.example',serverId:'SYNTHETIC'};
      window.NovelCloud={connectionInfo:()=>JSON.stringify(window.syntheticProfile),request:(...args)=>void window.syntheticNativeRequest(...args),cancelRequest(){},exportDocument(){},copyText(){},openExternal(){},connect(id,origin,token){void window.syntheticConnect(origin,token).then(result=>{if(result.status===200){const status=JSON.parse(result.body);window.syntheticProfile={connected:true,origin,serverId:status.serverId};}window.__novelCloudResult(id,JSON.stringify(result));});}};
    },{connected});
    await page.goto(base+'/?view='+view);
    if(connected&&!initialFailure)await page.getByRole('heading',{name:view==='settings'?'模型与费用上限':book?(await service.store.get(book.id)).title:'从一部好故事开始',exact:true}).waitFor();
    return page;
  }
  async function save(page){await page.getByRole('button',{name:'保存模型配置',exact:true}).click();await page.locator('.model-save-bar').getByText(/已保存。/).waitFor();}
  async function back(page){await page.getByRole('button',{name:'返回创作控制台',exact:true}).click();}
  try{await fn({service,secrets,book,context,faults,actions,counts,open,save,back,simulated:()=>simulatedCalls});assert.deepEqual(errors,[]);passed++;console.log('PASS '+passed+': '+name);}
  finally{faults.release?.();await context.close();await service.stop();await rm(directory,{recursive:true,force:true});}
}
try{
 await scenario('home connection -> one key -> save -> create -> start -> phone closed -> three chapters',async x=>{
  const page=await x.open({connected:false});await page.getByLabel('独立服务器HTTPS地址',{exact:true}).fill('https://cloud.example');await page.getByLabel('连接凭证（不是DeepSeek Key）',{exact:true}).fill('A'.repeat(43));await page.getByRole('button',{name:'连接独立云端',exact:true}).click();await page.getByText('云端连接凭证无效',{exact:true}).waitFor();
  await page.getByLabel('连接凭证（不是DeepSeek Key）',{exact:true}).fill(x.secrets.controlToken);await page.getByRole('button',{name:'连接独立云端',exact:true}).click();await page.getByRole('heading',{name:'模型与费用上限',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'保存模型配置',exact:true}).count(),1);
  await page.getByLabel('API密钥',{exact:true}).fill('  SYNTHETIC_SHARED_KEY_NOT_REAL  ');await page.getByRole('checkbox',{name:'允许模型调用费用',exact:true}).check();await x.save(page);
  assert.equal(await seal((await config(x.service.store)).apiKeyEncrypted,x.secrets.encryptionKey,true),'SYNTHETIC_SHARED_KEY_NOT_REAL');
  await page.getByRole('button',{name:'新建小说',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.getByLabel('书名（可由系统决定）',{exact:true}).fill('SYNTHETIC ONLY / created in phone UI');await dialog.getByLabel('总章节',{exact:true}).fill('3');await dialog.getByLabel('每章汉字',{exact:true}).fill('1000');await dialog.getByRole('button',{name:'创建作品',exact:true}).click();
  await page.getByRole('heading',{name:'SYNTHETIC ONLY / created in phone UI',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'登记后台任务',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'执行下一步',exact:true}).count(),0);
  await page.getByRole('button',{name:'启动云端自动创作',exact:true}).click();await page.getByRole('button',{name:'云端正在运行',exact:true}).waitFor();const b=(await x.service.store.list('book'))[0];assert.equal((await x.service.store.get(b.id+':job')).targetChapters,3);await page.close();
  for(let i=0;i<100&&(await x.service.store.get(b.id+':job')).status!=='completed';i++)await x.service.tick();
  assert.equal((await x.service.store.get(b.id+':job')).status,'completed');assert.equal((await x.service.store.list('chapter',b.id)).filter(c=>c.status==='locked').length,3);assert.ok(x.simulated()>0);
  const reopened=await x.open();await x.back(reopened);await reopened.getByRole('heading',{name:'全书已完成',exact:true}).waitFor();
 });
 await scenario('three independent keys, missing-field feedback, restart and encrypted persistence',async x=>{
  const page=await x.open();await page.getByRole('radio',{name:/按角色分别设置/}).check();await page.getByLabel('API密钥',{exact:true}).fill('SYNTHETIC_A');await page.getByLabel('正文API密钥',{exact:true}).fill('SYNTHETIC_B');await page.getByRole('checkbox',{name:'允许模型调用费用',exact:true}).check();
  await page.getByRole('button',{name:'保存模型配置',exact:true}).click();await page.locator('.model-save-bar').getByRole('alert').waitFor();assert.match(await page.locator('.model-save-bar').innerText(),/审核.*密钥/);assert.equal(x.counts('settings'),0);
  await page.getByLabel('审核API密钥',{exact:true}).fill('SYNTHETIC_C');await x.save(page);const c=await config(x.service.store);assert.equal(await seal(c.writerApiKeyEncrypted,x.secrets.encryptionKey,true),'SYNTHETIC_B');assert.equal(await seal(c.reviewApiKeyEncrypted,x.secrets.encryptionKey,true),'SYNTHETIC_C');await page.close();
  const next=await x.open();for(const label of ['API密钥','正文API密钥','审核API密钥'])assert.equal(await next.getByLabel(label,{exact:true}).inputValue(),'');assert.ok((await next.locator('.model-form-summary').innerText()).includes('云端已保存'));
 });
 await scenario('initial read fails: retry restores the saved form rather than an empty draft',async x=>{
  x.faults.failNextRead=true;const page=await x.open({initialFailure:true});await page.getByRole('alert').filter({hasText:'SYNTHETIC read failure'}).waitFor();await page.getByRole('button',{name:'重新连接',exact:true}).click();await page.getByRole('heading',{name:'模型与费用上限',exact:true}).waitFor();assert.equal(await page.getByLabel('策划 / 默认模型',{exact:true}).inputValue(),'deepseek-v4-pro');await page.getByLabel('API密钥',{exact:true}).fill('SYNTHETIC_AFTER_RETRY');await x.save(page);
 });
 await scenario('unsaved draft cannot start the old cloud configuration',async x=>{
  const page=await x.open();await page.getByLabel('API密钥',{exact:true}).fill('SYNTHETIC_PENDING_REPLACEMENT');await x.back(page);await page.getByRole('button',{name:'保存模型设置',exact:true}).waitFor();await page.getByRole('button',{name:'启动云端自动创作',exact:true}).click();await page.getByRole('heading',{name:'模型与费用上限',exact:true}).waitFor();assert.equal(x.counts('startJob'),0);assert.equal(await page.getByLabel('API密钥',{exact:true}).inputValue(),'SYNTHETIC_PENDING_REPLACEMENT');await x.save(page);await x.back(page);await page.getByRole('button',{name:'启动云端自动创作',exact:true}).click();await page.getByRole('button',{name:'云端正在运行',exact:true}).waitFor();assert.equal(x.counts('startJob'),1);
 },{seed:true,withBook:true});
 await scenario('saving locks inputs and double tap creates only one save request',async x=>{
  const page=await x.open();await page.getByLabel('API密钥',{exact:true}).fill('SYNTHETIC_SAVING_KEY');x.faults.holdSaveReply=true;await page.getByRole('button',{name:'保存模型配置',exact:true}).click();await until(()=>x.faults.release);assert.equal(await page.getByLabel('API密钥',{exact:true}).isDisabled(),true);assert.equal(await page.getByRole('checkbox',{name:'允许模型调用费用',exact:true}).isDisabled(),true);const button=page.locator('.model-save-actions button').first(),box=await button.boundingBox();assert.equal(await button.isDisabled(),true);await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);assert.equal(x.counts('settings'),1);x.faults.release();await page.locator('.model-save-bar').getByText(/配置与费用授权已保存/).waitFor();assert.equal(await page.getByLabel('API密钥',{exact:true}).isEnabled(),true);assert.equal(await page.getByLabel('API密钥',{exact:true}).inputValue(),'');
 },{seed:true});
 await scenario('rejected save keeps the key and re-enables the Save button',async x=>{
  const page=await x.open();await page.getByLabel('API密钥',{exact:true}).fill('SYNTHETIC_REJECTED_KEY');x.faults.rejectSave=true;await page.getByRole('button',{name:'保存模型配置',exact:true}).click();await page.locator('.model-save-bar').getByText(/SYNTHETIC save rejection/).waitFor();assert.equal(await page.getByLabel('API密钥',{exact:true}).inputValue(),'SYNTHETIC_REJECTED_KEY');assert.equal(await page.getByRole('button',{name:'保存模型配置',exact:true}).isEnabled(),true);x.faults.rejectSave=false;await x.save(page);
 },{seed:true});
 await scenario('accepted save with failed readback is recovered with GET, not another POST',async x=>{
  const page=await x.open();await page.getByLabel('API密钥',{exact:true}).fill('SYNTHETIC_READBACK_KEY');x.faults.failReadback=true;await page.getByRole('button',{name:'保存模型配置',exact:true}).click();await page.locator('.model-save-bar').getByText(/服务器已接收保存，但核对尚未完成/).waitFor();assert.equal(x.counts('settings'),1);x.faults.failReadback=false;await page.getByRole('button',{name:'核对云端保存结果',exact:true}).click();await page.locator('.model-save-bar').getByText(/已读取云端最新参数/).waitFor();assert.equal(x.counts('settings'),1);assert.equal(await page.getByLabel('API密钥',{exact:true}).inputValue(),'');
 },{seed:true});
 await scenario('concurrent configuration conflict preserves draft key and the newer budget',async x=>{
  const page=await x.open();await page.getByLabel('API密钥',{exact:true}).fill('SYNTHETIC_CONCURRENT_KEY');await settings(x.service.store,{monthLimit:29},x.secrets.encryptionKey);await page.getByRole('button',{name:'保存模型配置',exact:true}).click();await page.locator('.model-save-bar').getByText(/模型配置版本已变化/).waitFor();assert.equal(await page.getByLabel('API密钥',{exact:true}).inputValue(),'SYNTHETIC_CONCURRENT_KEY');await page.getByRole('button',{name:'核对云端保存结果',exact:true}).click();await page.locator('.model-save-bar').getByText(/已读取云端最新参数/).waitFor();assert.equal(await page.getByLabel('月度最高费用（元）',{exact:true}).inputValue(),'29');await x.save(page);assert.equal((await config(x.service.store)).monthLimit,29);
 },{seed:true});
 await scenario('role mode switches preserve compatible drafts; a no-op does not clear consent',async x=>{
  const page=await x.open();await page.getByRole('radio',{name:/按角色分别设置/}).check();await page.getByLabel('正文API密钥',{exact:true}).fill('SYNTHETIC_CACHED_WRITER');await page.getByLabel('审核API密钥',{exact:true}).fill('SYNTHETIC_CACHED_REVIEW');await page.getByRole('radio',{name:/一把密钥/}).check();await page.getByRole('radio',{name:/按角色分别设置/}).check();assert.equal(await page.getByLabel('正文API密钥',{exact:true}).inputValue(),'SYNTHETIC_CACHED_WRITER');assert.equal(await page.getByLabel('审核API密钥',{exact:true}).inputValue(),'SYNTHETIC_CACHED_REVIEW');await page.getByRole('checkbox',{name:'允许模型调用费用',exact:true}).check();await page.getByRole('radio',{name:/按角色分别设置/}).check();assert.equal(await page.getByRole('checkbox',{name:'允许模型调用费用',exact:true}).isChecked(),true);
 });
 await scenario('running task locks model changes; pause and continue remain explicit',async x=>{
  await startJob(x.service.store,x.book.id,3);const page=await x.open();assert.equal(await page.getByLabel('API密钥',{exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'保存模型配置',exact:true}).isDisabled(),true);await x.back(page);await page.getByRole('button',{name:'停止任务',exact:true}).click();await page.getByRole('button',{name:'继续云端创作',exact:true}).waitFor();assert.equal((await x.service.store.get(x.book.id+':job')).status,'paused');await page.getByRole('button',{name:'继续云端创作',exact:true}).click();await page.getByRole('button',{name:'云端正在运行',exact:true}).waitFor();assert.equal((await x.service.store.get(x.book.id+':job')).status,'queued');
 },{seed:true,withBook:true});
 await scenario('zero budget stops before registering a task',async x=>{
  await settings(x.service.store,{monthLimit:0},x.secrets.encryptionKey);const page=await x.open();await x.back(page);await page.getByRole('button',{name:'启动云端自动创作',exact:true}).click();await page.getByRole('heading',{name:'模型与费用上限',exact:true}).waitFor();assert.equal(x.counts('startJob'),0);assert.match(await page.locator('.model-save-bar').innerText(),/预算|费用上限/);
 },{seed:true,withBook:true});
 await scenario('paid connection test uses the saved configuration without resaving it',async x=>{
  const page=await x.open();await page.getByText('高级设置与连接测试',{exact:true}).click();const rev=(await config(x.service.store)).revision;await page.getByRole('button',{name:'测试策划连接（可能计费）',exact:true}).click();await page.locator('.model-save-bar').getByText(/接口连接成功/).waitFor();assert.equal(x.counts('testConnection'),1);assert.equal(x.counts('settings'),0);assert.equal((await config(x.service.store)).revision,rev);
 },{seed:true});
 await scenario('saved key without fee consent cannot start until consent is explicitly saved',async x=>{
  const page=await x.open();await page.getByLabel('API密钥',{exact:true}).fill('SYNTHETIC_NO_SPENDING_KEY');await x.save(page);assert.equal((await config(x.service.store)).spendEnabled,false);await x.back(page);await page.getByRole('button',{name:'启动云端自动创作',exact:true}).click();await page.getByRole('heading',{name:'模型与费用上限',exact:true}).waitFor();assert.equal(x.counts('startJob'),0);await page.getByRole('checkbox',{name:'允许模型调用费用',exact:true}).check();await x.save(page);await x.back(page);await page.getByRole('button',{name:'启动云端自动创作',exact:true}).click();await page.getByRole('button',{name:'云端正在运行',exact:true}).waitFor();assert.equal(x.counts('startJob'),1);
 },{withBook:true});
 await scenario('invalid pasted key is caught locally; model IDs and outer key whitespace are normalized',async x=>{
  const page=await x.open();await page.getByLabel('策划 / 默认模型',{exact:true}).fill(' deepseek-v4-pro ');await page.getByLabel('API密钥',{exact:true}).fill('SYNTHETIC_INVALID KEY');await page.getByRole('checkbox',{name:'允许模型调用费用',exact:true}).check();await page.getByRole('button',{name:'保存模型配置',exact:true}).click();await page.locator('.model-save-bar').getByText(/密钥中含空格或换行/).waitFor();assert.equal(x.counts('settings'),0);await page.getByLabel('API密钥',{exact:true}).fill(' SYNTHETIC_VALID_KEY ');await x.save(page);assert.equal((await config(x.service.store)).model,'deepseek-v4-pro');
 },{seed:true});
 await scenario('switching provider never reuses the saved key for a different supplier',async x=>{
  const page=await x.open();await page.getByLabel('模型服务商',{exact:true}).selectOption('qwen');assert.equal(await page.getByLabel('API密钥',{exact:true}).inputValue(),'');assert.match(await page.locator('.model-form-summary').innerText(),/策划：尚未填写/);await page.getByLabel('策划 / 默认模型',{exact:true}).fill('SYNTHETIC_QWEN_MODEL');await page.getByLabel('输入最高单价（元 / 百万token）',{exact:true}).fill('1');await page.getByLabel('输出最高单价（元 / 百万token）',{exact:true}).fill('1');await page.getByRole('checkbox',{name:'允许模型调用费用',exact:true}).check();await page.getByRole('button',{name:'保存模型配置',exact:true}).click();await page.locator('.model-save-bar').getByText(/策划：填写API密钥/).waitFor();assert.equal(x.counts('settings'),0);
 },{seed:true});
 await scenario('changing the shared default model also changes inherited author/reviewer routing and prices',async x=>{
  const page=await x.open();await page.getByLabel('策划 / 默认模型',{exact:true}).fill('SYNTHETIC_NEW_DEFAULT_MODEL');await page.getByLabel('输入最高单价（元 / 百万token）',{exact:true}).fill('1');await page.getByLabel('输出最高单价（元 / 百万token）',{exact:true}).fill('2');await page.getByRole('checkbox',{name:'允许模型调用费用',exact:true}).check();await x.save(page);const c=await config(x.service.store);for(const role of ['write','review']){assert.equal(resolveModel(c,role).model,'SYNTHETIC_NEW_DEFAULT_MODEL');assert.equal(resolveModel(c,role).inputPrice,1);assert.equal(resolveModel(c,role).outputPrice,2);}
 },{seed:true});
 await scenario('changing the planner keeps an explicitly independent author on its own model and prices',async x=>{
  await settings(x.service.store,{writerProvider:'deepseek',writerModel:'SYNTHETIC_INDEPENDENT_MODEL',writerInputPrice:4,writerOutputPrice:5,writerApiKey:'SYNTHETIC_INDEPENDENT_KEY'},x.secrets.encryptionKey);const page=await x.open();await page.getByLabel('策划 / 默认模型',{exact:true}).fill('SYNTHETIC_PLANNER_MODEL');await page.getByRole('checkbox',{name:'允许模型调用费用',exact:true}).check();await x.save(page);const c=await config(x.service.store);assert.equal(resolveModel(c,'write').model,'SYNTHETIC_INDEPENDENT_MODEL');assert.equal(resolveModel(c,'write').inputPrice,4);assert.equal(resolveModel(c,'review').model,'SYNTHETIC_PLANNER_MODEL');
 },{seed:true});
 for(const [width,height] of [[360,720],[430,932],[390,400]])await scenario('phone layout '+width+'x'+height+': save and error feedback remain visible',async x=>{
  const page=await x.open();await page.getByRole('radio',{name:/按角色分别设置/}).check();await page.getByRole('checkbox',{name:'允许模型调用费用',exact:true}).check();await page.getByRole('button',{name:'保存模型配置',exact:true}).click();const alert=page.locator('.model-save-bar').getByRole('alert');await alert.waitFor();const box=await alert.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=height);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await page.screenshot({path:new URL('../test-results/model-form-'+width+'.png',import.meta.url).pathname});
 },{width,height});

 await scenario('blocked review -> visible editing and full feedback -> queued revision -> phone closed -> review -> original target',async x=>{
  let chapter;
  for(let i=0;i<45;i++){
    const result=await step(x.service.store,x.book.id,x.secrets.encryptionKey,craftFixture);
    chapter=result.chapter;if(chapter?.status==='reviewing')break;
  }
  assert.equal(chapter.status,'reviewing');
  await startJob(x.service.store,x.book.id,3);await pauseJob(x.service.store,x.book.id);
  const currentBook=await x.service.store.get(x.book.id);
  const review=await craftFixture(x.service.store,await config(x.service.store),currentBook,'SYNTHETIC review','review');
  review.scores.commercial.score=5;review.issues=[{severity:'minor',message:'SYNTHETIC visible minor feedback',quote:chapter.content.slice(0,12),fix:'SYNTHETIC visible suggested edit'}];
  chapter=await x.service.store.save(chapter,{...chapter,status:'blocked',attempt:2,review,gate:{pass:false,score:76,issues:[{code:'SCORE',message:'SYNTHETIC below 85'}]}});
  const originalHash=chapter.hash;
  const page=await x.open({view:'dashboard'});await page.getByRole('button',{name:'查看审核与修改',exact:true}).click();
  const panel=page.getByRole('region',{name:'审核与修改',exact:true});await panel.waitFor();
  await panel.getByText('SYNTHETIC visible minor feedback',{exact:true}).waitFor();await panel.getByText('修改建议：SYNTHETIC visible suggested edit',{exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await panel.screenshot({path:new URL('../test-results/chapter-recovery.png',import.meta.url).pathname});
  assert.equal(x.counts('startJob'),0);await panel.getByRole('button',{name:'按审稿意见修订',exact:true}).click();
  const dialog=page.getByRole('dialog');assert.equal(await dialog.getByLabel('补充修订要求（可选）',{exact:true}).inputValue(),'');
  await dialog.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
  await page.screenshot({path:new URL('../test-results/chapter-revision-dialog.png',import.meta.url).pathname});x.faults.holdRevisionReply=true;
  await dialog.getByRole('button',{name:'生成修改任务并修订复审',exact:true}).click();await until(()=>x.faults.release);
  const registering=dialog.getByRole('button',{name:'正在登记云端任务…',exact:true});assert.equal(await registering.isDisabled(),true);const box=await registering.boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);assert.equal(x.counts('startEditorRevision'),1);x.faults.release();
  await page.getByRole('button',{name:'云端正在运行',exact:true}).waitFor();
  assert.equal(x.counts('startEditorRevision'),1);assert.equal((await x.service.store.get(chapter.id)).hash,originalHash);
  assert.equal((await x.service.store.get(x.book.id+':job')).targetChapters,3);await page.close();
  await x.service.tick();await x.service.tick();let revised=await x.service.store.get(chapter.id);assert.equal(revised.status,'reviewing');assert.equal(revised.attempt,3);assert.notEqual(revised.hash,originalHash);
  for(let i=0;i<100&&(await x.service.store.get(x.book.id+':job')).status!=='completed';i++)await x.service.tick();
  assert.equal((await x.service.store.get(x.book.id+':job')).status,'completed');assert.equal((await x.service.store.list('chapter',x.book.id)).filter(c=>c.status==='locked').length,3);
  assert.equal((await x.service.store.list('editorRevision',x.book.id))[0].status,'completed');assert.ok((await x.service.store.list('version',x.book.id)).some(v=>v.hash===originalHash));
  const reopened=await x.open({view:'dashboard'});await reopened.getByRole('heading',{name:'全书已完成',exact:true}).waitFor();assert.ok(await reopened.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 },{seed:true,withBook:true,rewrite:true});

 await scenario('maintenance lock is visible, disables creation and key entry, and never calls the supplier',async x=>{
  const previous=process.env.NOVEL_MODEL_API_DISABLED;process.env.NOVEL_MODEL_API_DISABLED='1';
  try{
   const page=await x.open({view:'dashboard'});await page.getByText('模型接口维护停用：所有创作、修订、审核及连接测试均被服务端拦截。可以查看与导出已有稿件，请勿重新填入密钥启动。',{exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'启动云端自动创作',exact:true}).isDisabled(),true);assert.equal(x.counts('startJob'),0);
   const settingsPage=await x.open();assert.equal(await settingsPage.getByLabel('API密钥',{exact:true}).isDisabled(),true);assert.equal(await settingsPage.getByRole('button',{name:'保存模型配置',exact:true}).isDisabled(),true);assert.equal(x.simulated(),0);
  }finally{if(previous===undefined)delete process.env.NOVEL_MODEL_API_DISABLED;else process.env.NOVEL_MODEL_API_DISABLED=previous;}
 },{seed:true,withBook:true});
 console.log('UI AUDIT PASSED: '+passed+' scenarios; real supplier requests: 0; assets: '+(process.env.NOVEL_TEST_APK?'delivered APK':'source build'));
}finally{await browser.close();await new Promise(resolve=>http.close(resolve));await rm(work,{recursive:true,force:true});}

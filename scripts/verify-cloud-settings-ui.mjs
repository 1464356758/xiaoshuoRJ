// SYNTHETIC ONLY: packaged phone UI + real SQLite/API; no supplier requests.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildServer} from '../cloud-server/build-server.mjs';
import {createBook,config,settings} from '../lib/engine.mjs';
import {seal} from '../lib/model.mjs';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?modules+'/playwright/index.mjs':'playwright');
await buildServer();
const {createCloudService}=await import('../cloud-server/service.mjs');
const directory=await mkdtemp(join(tmpdir(),'SYNTHETIC-settings-ui-'));
let supplierCalls=0,browser,http;
const service=await createCloudService({directory,autoStart:false,invoke:async()=>{supplierCalls++;throw new Error('SYNTHETIC: supplier must not be called');}});
try{
  const secrets=JSON.parse(await readFile(join(directory,'server-secrets.json'),'utf8'));
  const headers={Authorization:'Bearer '+secrets.controlToken,'X-Novel-Server-Id':service.serverId,'Content-Type':'application/json'};
  const book=await createBook(service.store,{title:'SYNTHETIC ONLY / settings workflow',totalChapters:3,targetWords:1000,budget:20},crypto.randomUUID());
  await service.tick();
  const actions=[];
  async function api(path,method='GET',body=''){
    if(method==='POST')actions.push(JSON.parse(body).action);
    const r=await service.dispatch(new Request('https://cloud.example'+path,{method,headers,...(method==='POST'?{body}:{})}));
    return {status:r.status,body:await r.text(),headers:Object.fromEntries(r.headers)};
  }
  http=createServer(async(req,res)=>{const path=new URL(req.url,'http://local').pathname,name=path.endsWith('app.js')?'app.js':path.endsWith('app.css')?'app.css':'index.html';res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(await readFile(new URL('../android-cloud/assets/'+name,import.meta.url)));});
  await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];
  async function openPage(){
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('syntheticNativeRequest',async(id,path,method,body)=>{
      const result=await api(path,method,body);
      await page.evaluate(({id,result})=>globalThis.__novelCloudResult(id,JSON.stringify(result)),{id,result});
    });
    await page.addInitScript(()=>{globalThis.NovelCloud={connectionInfo:()=>JSON.stringify({connected:true,origin:'https://cloud.example',serverId:'SYNTHETIC'}),request:(...args)=>{void globalThis.syntheticNativeRequest(...args);},cancelRequest(){},exportDocument(){},copyText(){},openExternal(){}};});
    await page.goto('http://127.0.0.1:'+http.address().port+'/?view=settings');
    await page.getByRole('heading',{name:'模型与费用上限',exact:true}).waitFor();return page;
  }
  const page=await openPage(),revision=(await config(service.store)).revision;
  await page.getByRole('button',{name:'正文改用DeepSeek（待保存）',exact:true}).click();
  assert.equal((await config(service.store)).revision,revision);
  assert.equal(actions.includes('useDeepseekWriter'),false);
  await page.getByLabel(/^API密钥/).fill('  SYNTHETIC_SHARED_KEY_NOT_REAL  ');
  await page.getByRole('button',{name:'三个角色共用上方密钥',exact:true}).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'保存全部模型配置',exact:true}).click();
  await page.getByText('全部模型配置及费用授权已保存到云端。现在可以返回创作控制台启动任务。',{exact:true}).last().waitFor();
  let c=await config(service.store);
  assert.equal(c.spendEnabled,true);assert.equal(c.writerProvider,'');assert.equal(c.reviewProvider,'');
  assert.equal(await seal(c.apiKeyEncrypted,secrets.encryptionKey,true),'SYNTHETIC_SHARED_KEY_NOT_REAL');
  assert.equal(await page.getByLabel(/^API密钥/).inputValue(),'');
  await page.getByRole('button',{name:'返回创作控制台',exact:true}).last().click();
  assert.equal(await page.getByText('创作尚未开始',{exact:true}).count(),0);
  await page.getByRole('button',{name:'启动云端自动创作',exact:true}).click();
  await page.getByText('云端任务已保存，可以退出App；预算、质量门或异常会停止任务。',{exact:true}).waitFor();
  assert.equal((await service.store.get(book.id+':job')).targetChapters,3);
  assert.equal(supplierCalls,0);
  await api('/api/workspace','POST',JSON.stringify({action:'pause',id:book.id}));
  await page.close();
  console.log('PASS: mobile shared key -> read-back -> readiness clears -> cloud task queued');

  const independent=await openPage();
  for(const [slot,label] of [['writer','正文作者 / 局部返修'],['review','单章 / 三章 / 十章独立审核']]){
    const panel=independent.getByRole('heading',{name:label,exact:true}).locator('..');
    await panel.locator('select').selectOption('deepseek');
    await panel.getByLabel('模型ID（沿用时可留空）',{exact:true}).fill('deepseek-v4-pro');
    await panel.getByLabel('输入最高单价（元/百万token）',{exact:true}).fill('9');
    await panel.getByLabel('输出最高单价（元/百万token）',{exact:true}).fill('27');
    if(slot==='writer')await panel.getByLabel(/^独立API密钥/).fill('SYNTHETIC_WRITER_KEY_NOT_REAL');
  }
  await independent.getByRole('checkbox').check();
  const beforeInvalid=actions.filter(x=>x==='settings').length;
  await independent.getByRole('button',{name:'保存全部模型配置',exact:true}).click();
  await independent.getByText(/保存未完成：审核：填写独立API密钥/).last().waitFor();
  await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
  await independent.screenshot({path:new URL('../test-results/settings-inline-error.png',import.meta.url).pathname});
  assert.equal(actions.filter(x=>x==='settings').length,beforeInvalid);
  const review=independent.getByRole('heading',{name:'单章 / 三章 / 十章独立审核',exact:true}).locator('..');
  await review.getByLabel(/^独立API密钥/).fill('SYNTHETIC_REVIEW_KEY_NOT_REAL');
  await independent.getByRole('button',{name:'保存全部模型配置',exact:true}).click();
  await independent.getByText('全部模型配置及费用授权已保存到云端。现在可以返回创作控制台启动任务。',{exact:true}).last().waitFor();
  c=await config(service.store);
  assert.equal(await seal(c.writerApiKeyEncrypted,secrets.encryptionKey,true),'SYNTHETIC_WRITER_KEY_NOT_REAL');
  assert.equal(await seal(c.reviewApiKeyEncrypted,secrets.encryptionKey,true),'SYNTHETIC_REVIEW_KEY_NOT_REAL');
  console.log('PASS: missing independent key is visible beside Save; three independent keys persist encrypted');

  await independent.getByLabel(/^API密钥/).fill('SYNTHETIC_REPLACEMENT_KEY_NOT_REAL');
  await settings(service.store,{monthLimit:29},secrets.encryptionKey);
  await independent.getByRole('button',{name:'保存全部模型配置',exact:true}).click();
  await independent.getByText(/保存未完成：模型配置版本已变化/).last().waitFor();
  assert.equal(await independent.getByLabel(/^API密钥/).inputValue(),'SYNTHETIC_REPLACEMENT_KEY_NOT_REAL');
  assert.equal((await config(service.store)).monthLimit,29);
  await independent.getByRole('button',{name:'读取云端最新配置',exact:true}).last().click();
  await independent.getByText('已读取云端最新参数；相同服务商的待保存密钥仍保留，请核对后再保存。',{exact:true}).last().waitFor();
  assert.equal(await independent.getByLabel(/^API密钥/).inputValue(),'SYNTHETIC_REPLACEMENT_KEY_NOT_REAL');
  assert.equal(await independent.getByLabel('月度最高费用（元）',{exact:true}).inputValue(),'29');
  await independent.getByRole('button',{name:'保存全部模型配置',exact:true}).click();
  await independent.getByText('全部模型配置及费用授权已保存到云端。现在可以返回创作控制台启动任务。',{exact:true}).last().waitFor();
  c=await config(service.store);
  assert.equal(await seal(c.apiKeyEncrypted,secrets.encryptionKey,true),'SYNTHETIC_REPLACEMENT_KEY_NOT_REAL');
  assert.equal(c.monthLimit,29);assert.equal(supplierCalls,0);assert.deepEqual(errors,[]);
  console.log('PASS: concurrent version conflict preserves input and budget; explicit refresh enables a verified save');
}finally{
  await browser?.close();if(http)await new Promise(resolve=>http.close(resolve));await service.stop();await rm(directory,{recursive:true,force:true});
}

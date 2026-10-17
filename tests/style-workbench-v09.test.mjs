import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,book,configured,synthetic,fixture,plan,review} from './workflow-support.mjs';
import {Store,hash} from '../lib/store.mjs';
import {config,step,settings,snapshot} from '../lib/engine.mjs';
import {modelCall,callSpec} from '../lib/model.mjs';
import {roleSlot} from '../lib/model-routing.mjs';
import {saveStyleReference,archiveStyleReference,styleWorkbench,createStyleTask,stepStyleTask,pauseStyleTask,activateStyle} from '../lib/style-workbench.mjs';
import {STYLE_DIMENSIONS,validateStyleBindings,styleAt,stylePrompt,referenceOverlap,validateStyleEvidence} from '../lib/style-profile.mjs';
import {sampleReferenceFile,decodeReferenceBytes} from '../lib/style-import.mjs';
import {restoreBackup} from '../lib/backup.mjs';
import {forkRevision} from '../lib/revisions.mjs';
import {openingFingerprint,arcFingerprint} from '../lib/acceptance.mjs';
import {startJob,pauseJob,runJobStep} from '../lib/jobs.mjs';

// SYNTHETIC protocol fixtures only. No published novel, real key or supplier.
const brief='SYNTHETIC TEST ONLY / 合成场景任务：甲在仓库核对测试物品，乙要求拿走一个编号不同的箱子。两人各有自己的工作目标；甲需要核对记录，乙担心错过约定时间。只写一次核对和决定留下证据的选择，结尾确定下一步的核查办法，不凭巧合解决，也不延伸任何真实小说情节。';
function card(name='SYNTHETIC 文风方案'){return {name,summary:'TEST ONLY / 本规则仅用于验证软件协议，不表示文学效果',rules:STYLE_DIMENSIONS.map(d=>({dimension:d,instruction:'TEST ONLY / 检查'+d+'的具体表达',when:'合成测试场景',avoid:'不将统计当作审美结论'})),exclusions:['TEST ONLY / 不沿用原句与测试人物设定']};}
async function styleFixture(s,cfg,b,prompt,role){
  if(role==='style_analysis'){
    const refs=(await s.list('styleReference',b.id)).filter(r=>!r.archived);
    return {card:card(),evidence:refs.flatMap(r=>STYLE_DIMENSIONS.map((dimension,i)=>({referenceKey:r.key,dimension,quote:r.text.slice(i*16,i*16+10),lesson:'TEST ONLY / 验证引文存在，不证明语义'})))};
  }
  if(['style_baseline','style_enhanced'].includes(role))return {text:synthetic(role==='style_baseline'?878:937,1500)};
  if(role==='style_review'){
    const t=(await s.list('styleTask',b.id)).find(t=>t.type==='trial'&&t.status==='running');
    return {winner:t.blindOrder[0]==='enhanced'?'A':'B',reason:'SYNTHETIC comparison, not reader or contract evidence',variants:Object.fromEntries(t.blindOrder.map((k,i)=>[i?'B':'A',{ready:true,evidence:[{quote:t.variants[k].text.slice(0,12),reason:'TEST ONLY first'},{quote:t.variants[k].text.slice(40,54),reason:'TEST ONLY second'}],issues:[]}]))};
  }
  const result=await fixture(s,cfg,b,prompt,role);
  if(role==='review'&&styleAt(b,(await s.list('chapter',b.id)).find(c=>c.status!=='locked').number)){
    const c=(await s.list('chapter',b.id)).find(c=>c.status!=='locked');result.styleEvidence=STYLE_DIMENSIONS.slice(0,2).map((dimension,i)=>({dimension,quote:c.content.slice(i*40,i*40+12),reason:'TEST ONLY / physical citation'}));
  }
  return result;
}
async function setup({configure=true,total=20}={}){
  const s=fresh(),b=await book(s,1000,total);const secret=configure?await configured(s):'';
  const r=await saveStyleReference(s,b.id,{title:'SYNTHETIC REFERENCE ONLY',author:'TEST ONLY',source:'synthetic generated fixture, not a published book',stage:'dialogue',text:synthetic(121,700),consent:true});
  return {s,b,secret,r};
}
async function profileFixture(x){const t=await createStyleTask(x.s,x.b.id,{type:'analysis',key:crypto.randomUUID(),referenceKeys:[x.r.key]});await stepStyleTask(x.s,x.b.id,t.key,x.secret,styleFixture);return (await x.s.list('styleProfile',x.b.id))[0];}
async function trialFixture(x,p){let t=await createStyleTask(x.s,x.b.id,{type:'trial',key:crypto.randomUUID(),profileKey:p.key,brief});for(let i=0;i<3;i++)t=await stepStyleTask(x.s,x.b.id,t.key,x.secret,styleFixture);return t;}
async function bindingFixture(x){const p=await profileFixture(x),t=await trialFixture(x,p);await activateStyle(x.s,x.b.id,{taskKey:t.key,confirmRead:true});return {p,t,b:await x.s.get(x.b.id)};}
async function backup(s,id){return {format:'novel-factory-backup-v1',book:await s.get(id),chapters:await s.list('chapter',id),versions:await s.list('version',id),planVersions:await s.list('planVersion',id),audits:await s.list('audit',id),styleReferences:await s.list('styleReference',id),styleProfiles:await s.list('styleProfile',id),styleTasks:await s.list('styleTask',id)};}

test('本机整本TXT抽样有位置标签和长度边界，不静默上传全文',()=>{
  const raw=Array.from({length:9},(_,i)=>`第${i+1}章 合成测试\n${synthetic(i+800,3000)}\n`).join('');
  const v=sampleReferenceFile(raw);assert.equal(v.length,3);assert.deepEqual(v.map(x=>x.stage),['opening','middle','ending']);assert.ok(v.every(x=>x.text.length>=200&&x.text.length<=6000));assert.equal(sampleReferenceFile('\ufeff'+synthetic(801,600)).length,1);assert.throws(()=>sampleReferenceFile('太短'),/不足/);assert.throws(()=>sampleReferenceFile('a'.repeat(3000001)),/过大/);
});
test('中文TXT识别UTF8、GB18030与带BOM的UTF16，错误二进制不送模型',()=>{
  assert.equal(decodeReferenceBytes(new TextEncoder().encode('合成中文编码测试')).text,'合成中文编码测试');
  const gb=decodeReferenceBytes(Uint8Array.from([0xc4,0xe3,0xba,0xc3]));assert.equal(gb.text,'你好');assert.equal(gb.encoding,'GB18030');
  const utf16=Buffer.concat([Buffer.from([255,254]),Buffer.from('合成编码测试','utf16le')]);assert.equal(decodeReferenceBytes(utf16).text,'合成编码测试');assert.throws(()=>decodeReferenceBytes(Uint8Array.from([65,0,66,0])),/编码/);
});
test('参考库免费、幂等、owner隔离，归档不破坏已有来源',async()=>{
  const x=await setup({configure:false}),{s,b,r}=x;const duplicate=await saveStyleReference(s,b.id,r);assert.equal(duplicate.id,r.id);assert.equal((await s.list('styleReference',b.id)).length,1);assert.equal((await s.cost(b.id)).calls.length,0);
  const other=new Store(s.db,'SYNTHETIC other owner');await assert.rejects(()=>styleWorkbench(other,b.id),/不存在/);await assert.rejects(()=>saveStyleReference(other,b.id,r),/不存在/);await assert.rejects(()=>saveStyleReference(s,b.id,{...r,consent:false}),/确认/);
  await archiveStyleReference(s,b.id,r.key,true);assert.equal((await s.get(r.id)).text,r.text);assert.equal((await s.get(r.id)).archived,true);assert.equal((await s.get(b.id)).status,b.status);
});
test('未授权费用和零预算在创建实验前拒绝，配置不被更改',async()=>{
  const x=await setup({configure:false}),before=await config(x.s);
  await assert.rejects(()=>createStyleTask(x.s,x.b.id,{type:'analysis',key:crypto.randomUUID(),referenceKeys:[x.r.key]}),/尚未开启/);assert.deepEqual(await config(x.s),before);assert.equal((await x.s.list('styleTask',x.b.id)).length,0);
  await configured(x.s);let b=await x.s.get(x.b.id);await x.s.save(b,{...b,budget:0});await assert.rejects(()=>createStyleTask(x.s,b.id,{type:'analysis',key:crypto.randomUUID(),referenceKeys:[x.r.key]}),/上限为0/);assert.equal((await x.s.cost(b.id)).calls.length,0);
});
test('文风角色使用原三角色账户，两个试写请求关闭DeepSeek思考',async()=>{
  const x=await setup(),cfg=await config(x.s);assert.equal(roleSlot('style_analysis'),'planner');assert.equal(roleSlot('style_review'),'review');for(const role of ['style_baseline','style_enhanced']){assert.equal(roleSlot(role),'writer');assert.equal(callSpec(cfg,'SYNTHETIC',role).body.thinking.type,'disabled');}assert.equal(callSpec(cfg,'SYNTHETIC','style_review').body.temperature,0.2);
});
test('一次分析及三步对照可恢复，不把试写写入正式章节，采用不收费',async()=>{
  const x=await setup(),p=await profileFixture(x);let t=await createStyleTask(x.s,x.b.id,{type:'trial',key:crypto.randomUUID(),profileKey:p.key,brief});
  t=await stepStyleTask(x.s,x.b.id,t.key,x.secret,styleFixture);assert.equal(t.phase,'enhanced');assert.ok(t.variants.baseline.hash);assert.equal((await x.s.list('chapter',x.b.id)).length,0);
  await pauseStyleTask(x.s,x.b.id,t.key);t=await stepStyleTask(x.s,x.b.id,t.key,x.secret,styleFixture);assert.equal(t.phase,'review');t=await stepStyleTask(x.s,x.b.id,t.key,x.secret,styleFixture);assert.ok(t.pass);assert.equal(t.status,'completed');assert.equal((await x.s.get(x.b.id)).styleBindings,undefined);
  await assert.rejects(()=>activateStyle(x.s,x.b.id,{taskKey:t.key,confirmRead:false}),/阅读/);const oldCfg=await config(x.s);await activateStyle(x.s,x.b.id,{taskKey:t.key,confirmRead:true});const b=await x.s.get(x.b.id);assert.equal(b.styleBindings[0].fromChapter,1);assert.equal(b.styleBindings[0].profile.hash,p.hash);await validateStyleBindings(b);assert.deepEqual(await config(x.s),oldCfg);assert.equal((await x.s.list('job',b.id)).length,0);assert.equal((await x.s.cost(b.id)).calls.length,0);
});
test('虚构分析引文会阻塞，不能重复点击重试收费分析',async()=>{
  const x=await setup(),t=await createStyleTask(x.s,x.b.id,{type:'analysis',key:crypto.randomUUID(),referenceKeys:[x.r.key]});let called=0;
  const fake=async(...args)=>{called++;const r=await styleFixture(...args);r.evidence[0].quote='SYNTHETIC NOT IN SOURCE';return r;};await assert.rejects(()=>stepStyleTask(x.s,x.b.id,t.key,x.secret,fake),/原文证据/);await assert.rejects(()=>stepStyleTask(x.s,x.b.id,t.key,x.secret,fake),/已阻塞/);assert.equal(called,1);assert.equal((await x.s.list('styleProfile',x.b.id)).length,0);
});
test('模型异常、过期未保存请求与参数混用不会自动重放',async()=>{
  const x=await setup(),input={type:'analysis',key:crypto.randomUUID(),referenceKeys:[x.r.key]},t=await createStyleTask(x.s,x.b.id,input);assert.equal((await createStyleTask(x.s,x.b.id,input)).key,t.key);await assert.rejects(()=>createStyleTask(x.s,x.b.id,{...input,referenceKeys:[]}),/同一标识/);
  let n=0;await assert.rejects(()=>stepStyleTask(x.s,x.b.id,t.key,x.secret,async()=>{n++;throw Error('SYNTHETIC uncertain timeout');}),/uncertain timeout/);await assert.rejects(()=>stepStyleTask(x.s,x.b.id,t.key,x.secret,async()=>n++),/已阻塞/);assert.equal(n,1);
  const t2=await createStyleTask(x.s,x.b.id,{...input,key:crypto.randomUUID()});await x.s.save(t2,{...t2,status:'running',lease:{token:'SYNTHETIC expired',until:Date.now()-1}});await assert.rejects(()=>stepStyleTask(x.s,x.b.id,t2.key,x.secret,async()=>n++),/结果不确定/);assert.equal(n,1);
});
test('同书并发租约阻止正文与文风重入，全局暂停保存当前一步后停止',async()=>{
  const x=await setup(),t=await createStyleTask(x.s,x.b.id,{type:'analysis',key:crypto.randomUUID(),referenceKeys:[x.r.key]});let release,entered;
  const enteredPromise=new Promise(r=>entered=r),wait=new Promise(r=>release=r);
  const pending=stepStyleTask(x.s,x.b.id,t.key,x.secret,async(...a)=>{entered();await wait;return styleFixture(...a);});await enteredPromise;
  await assert.rejects(()=>stepStyleTask(x.s,x.b.id,t.key,x.secret,styleFixture),/仍在执行/);await assert.rejects(()=>saveStyleReference(x.s,x.b.id,{...x.r,text:synthetic(812,600)}),/检查点/);await assert.rejects(()=>step(x.s,x.b.id,x.secret,fixture),/文风实验/);
  await pauseJob(x.s,x.b.id);release();const done=await pending;assert.equal(done.status,'completed');assert.equal((await x.s.get(x.b.id)).status,'paused');assert.equal((await x.s.get(x.b.id)).lease,null);
  const b=await x.s.get(x.b.id),chapter=await x.s.create('chapter',{number:1,status:'contract',lease:null},b.id);const cLease=await x.s.claimLease(chapter);await assert.rejects(async()=>x.s.claimLease(await x.s.get(b.id)),/正在执行/);await x.s.save(cLease,{...cLease,lease:null});
});
test('试写期间关闭费用或改变大纲，旧响应不能成为文风候选',async()=>{
  const x=await setup(),t=await createStyleTask(x.s,x.b.id,{type:'analysis',key:crypto.randomUUID(),referenceKeys:[x.r.key]});
  await assert.rejects(()=>stepStyleTask(x.s,x.b.id,t.key,x.secret,async(...a)=>{await settings(x.s,{spendEnabled:false},x.secret);return styleFixture(...a);}),/模型配置变化/);assert.equal((await x.s.list('styleProfile',x.b.id)).length,0);assert.equal((await config(x.s)).spendEnabled,false);
});
test('真实费用管理器记录三角色环节，用量结算且单次预算前拒绝HTTP',async()=>{
  const x=await setup(),t=await createStyleTask(x.s,x.b.id,{type:'analysis',key:crypto.randomUUID(),referenceKeys:[x.r.key]});let fetched=0;
  const viaMeter=(s,c,b,p,r,key)=>modelCall(s,c,b,p,r,key,async()=>{fetched++;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(await styleFixture(s,c,b,p,r))},finish_reason:'stop'}],usage:{prompt_tokens:200,completion_tokens:400}}),{status:200});});
  await stepStyleTask(x.s,x.b.id,t.key,x.secret,viaMeter);const cost=await x.s.cost(x.b.id);assert.equal(fetched,1);assert.equal(cost.calls[0].data.role,'style_analysis');assert.equal(cost.calls[0].status,'settled');assert.equal(cost.total,.0006);
  await settings(x.s,{taskLimit:0.000001},x.secret);const p=(await x.s.list('styleProfile',x.b.id))[0],tt=await createStyleTask(x.s,x.b.id,{type:'trial',key:crypto.randomUUID(),profileKey:p.key,brief});await assert.rejects(()=>stepStyleTask(x.s,x.b.id,tt.key,x.secret,viaMeter),/超过单次上限/);assert.equal(fetched,1);
});
test('正式流程只读取抽象文风和本书锚点，单章引用审校使用原审核请求',async()=>{
  const x=await setup({total:3}),{b}=await bindingFixture(x),roles=[];let sawRaw=false,sawCard=false;
  const checked=async(s,c,b,p,r,...rest)=>{roles.push(r);if(r==='write'){sawRaw ||=p.includes(x.r.text);sawCard ||=p.includes('SYNTHETIC 文风方案');}return styleFixture(s,c,b,p,r,...rest);};
  for(let i=0;i<12;i++){await step(x.s,b.id,x.secret,checked);if((await x.s.list('chapter',b.id)).some(c=>c.status==='locked'))break;}
  const c=(await x.s.list('chapter',b.id))[0];assert.equal(c.status,'locked');assert.equal(c.styleHash,b.styleBindings[0].profile.hash);assert.equal(c.review.styleEvidence.length,2);assert.equal(sawRaw,false);assert.equal(sawCard,true);assert.deepEqual(roles,['plan','contract','write','review']);
  assert.throws(()=>validateStyleEvidence({...c.review,styleEvidence:[]},c,b),/不同维度/);const state=await snapshot(x.s,b.id);assert.equal(state.styleStatus.bindings.length,1);
});
test('新文风只作用未来章，不使已审开篇和过去十章无故失效',async()=>{
  const x=await setup({total:30}),s=x.s;let b=await s.get(x.b.id);await s.save(b,{...b,plan:plan(30)});
  const cs=[];for(let i=1;i<=10;i++){const content=synthetic(i+300,1000);cs.push(await s.create('chapter',{number:i,title:'SYNTHETIC '+i,status:'locked',content,hash:await hash(content),chunks:[content],review:{summary:'TEST ONLY',changes:[],foreshadowing:[]},gate:{pass:true},lease:null},b.id,b.id+':chapter:'+i));}
  b=await s.get(b.id);const opening=await openingFingerprint(b,cs),arc=await arcFingerprint(b,cs,10);const {b:bound}=await bindingFixture(x);assert.equal(bound.styleBindings[0].fromChapter,11);assert.equal(await openingFingerprint(bound,cs),opening);assert.equal(await arcFingerprint(bound,cs,10),arc);assert.equal(styleAt(bound,10),null);assert.ok(styleAt(bound,11));assert.equal((await s.list('chapter',b.id)).find(c=>c.number===10).hash,cs[9].hash);
});
test('参考重合在付费审稿之前阻塞，不能当作全网原创证明',async()=>{
  const x=await setup({total:3}),{b}=await bindingFixture(x);assert.equal(referenceOverlap(x.r.text,[x.r]).length,1);assert.equal(referenceOverlap('短句',[x.r]).length,0);
  for(let i=0;i<3;i++)await step(x.s,b.id,x.secret,styleFixture);let c=(await x.s.list('chapter',b.id))[0];await x.s.save(c,{...c,status:'reviewing',content:x.r.text+synthetic(321,500),hash:await hash(x.r.text+synthetic(321,500))});let called=0;const r=await step(x.s,b.id,x.secret,async()=>{called++;throw Error('must not call');});assert.equal(r.phase,'reference_overlap');assert.equal(r.chapter.status,'blocked');assert.equal(called,0);
});
test('文风与原文可备份恢复及独立分支，坏hash/缺来源/降级会拒绝',async()=>{
  const x=await setup({total:3}),{b}=await bindingFixture(x),data=await backup(x.s,b.id);
  const bad=structuredClone(data);bad.styleReferences[0].text+='CORRUPTED';await assert.rejects(()=>restoreBackup(x.s,bad,crypto.randomUUID()),/校验失败/);const missing=structuredClone(data);missing.styleReferences=[];await assert.rejects(()=>restoreBackup(x.s,missing,crypto.randomUUID()),/缺少/);
  const badModels=structuredClone(data);badModels.styleTasks[0].models=null;await assert.rejects(()=>restoreBackup(x.s,badModels,crypto.randomUUID()),/备份结构/);
  const badProof=structuredClone(data),badTrial=badProof.styleTasks.find(t=>t.type==='trial');badTrial.review.variants.A.evidence[0].quote='SYNTHETIC FORGED QUOTE NOT IN TEXT';await assert.rejects(()=>restoreBackup(x.s,badProof,crypto.randomUUID()),/真实引文/);
  const noTrial=structuredClone(data);noTrial.styleTasks=noTrial.styleTasks.filter(t=>t.type!=='trial');await assert.rejects(()=>restoreBackup(x.s,noTrial,crypto.randomUUID()),/已完成对照/);
  const restored=await restoreBackup(x.s,data,crypto.randomUUID());assert.equal(restored.status,'paused');assert.deepEqual(restored.styleBindings,b.styleBindings);assert.equal((await x.s.list('styleReference',restored.id))[0].hash,x.r.hash);assert.ok((await x.s.list('styleTask',restored.id)).every(t=>t.imported));
  await assert.rejects(()=>activateStyle(x.s,restored.id,{taskKey:b.styleBindings[0].trialKey,confirmRead:true}),/历史参考/);
  const copy=await forkRevision(x.s,b.id,1,crypto.randomUUID());assert.equal(copy.status,'paused');assert.equal((await x.s.list('styleProfile',copy.id)).length,1);assert.equal((await x.s.list('styleReference',copy.id))[0].text,x.r.text);assert.equal(copy.styleBindings[0].profile.hash,b.styleBindings[0].profile.hash);
});
test('文风更改让旧云端任务版本失效，不能静默沿用新风格',async()=>{
  const x=await setup({total:3}),job=await startJob(x.s,x.b.id,3);await pauseJob(x.s,x.b.id);const {b}=await bindingFixture(x);let old=await x.s.get(job.id);await x.s.save(old,{...old,status:'queued'});let live=await x.s.get(b.id);await x.s.save(live,{...live,status:'ready'});let calls=0;const out=await runJobStep(x.s,b.id,x.secret,async()=>calls++);assert.equal(out.reason,'changed');assert.equal(out.job.status,'blocked');assert.equal(calls,0);
});
test('已知禁限平台不能通过文风试写绕过自动正文门',async()=>{
  const x=await setup(),p=await profileFixture(x),b=await x.s.get(x.b.id);await x.s.save(b,{...b,platform:'豆瓣阅读'});await assert.rejects(()=>createStyleTask(x.s,b.id,{type:'trial',key:crypto.randomUUID(),profileKey:p.key,brief}),/不适用自动正文/);assert.equal((await x.s.list('styleTask',b.id)).length,1);
});
test('备份删除文风绑定不能把有文风证据的定稿降为旧协议',async()=>{
  const x=await setup({total:3}),{b}=await bindingFixture(x);for(let i=0;i<8;i++){await step(x.s,b.id,x.secret,styleFixture);if((await x.s.list('chapter',b.id)).some(c=>c.status==='locked'))break;}
  const data=await backup(x.s,b.id);delete data.book.styleBindings;delete data.book.styleRevision;data.styleReferences=[];data.styleProfiles=[];data.styleTasks=[];await assert.rejects(()=>restoreBackup(x.s,data,crypto.randomUUID()),/文风版本/);
});

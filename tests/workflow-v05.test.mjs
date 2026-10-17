// Synthetic adversarial protocol tests only; no real supplier, key or manuscript.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,book,plan,synthetic,review,fixture,configured,writeOne,batchedFixture,openingReport} from './workflow-support.mjs';
import {step,settings,config,publicConfig,createBook as createBookCurrent} from '../lib/engine.mjs';
import {modelCall} from '../lib/model.mjs';
import {resolveModel} from '../lib/model-routing.mjs';
import {startJob} from '../lib/jobs.mjs';
import {hash} from '../lib/store.mjs';
import {applyRepair,repairFeasible} from '../lib/repairs.mjs';
import {qualityGate} from '../lib/quality.mjs';
import {storyContext,validateSceneContract} from '../lib/story-context.mjs';
import {writePrompt,planningPrompt} from '../lib/prompts.mjs';
import {arcFingerprint,arcReady,arcGate,arcPrompt,openingFingerprint,openingGate,openingPrompt} from '../lib/acceptance.mjs';
import {restoreBackup} from '../lib/backup.mjs';
import {forkRevision} from '../lib/revisions.mjs';
// Preserve V0.5 compatibility coverage without silently enabling the new protocol.
async function createBook(store,...args){const b=await createBookCurrent(store,...args);return store.save(b,{...b,narrativeProtocol:0,craftProtocol:0});}

test('三个角色分别路由、加密和记账，作者与审核不共享密钥',async()=>{
  const s=fresh(),b=await book(s),secret=await configured(s,{model:'TEST PLANNER',writerProvider:'doubao',writerModel:'TEST WRITER',writerApiKey:'SYNTHETIC WRITER KEY',writerInputPrice:2,writerOutputPrice:3,reviewProvider:'qwen',reviewModel:'TEST REVIEW',reviewApiKey:'SYNTHETIC REVIEW KEY',reviewInputPrice:4,reviewOutputPrice:5});
  const cfg=await config(s),seen=[];
  const fetcher=async(url,opt)=>{seen.push({url,key:opt.headers.Authorization,payload:JSON.parse(opt.body)});return Response.json({choices:[{message:{content:'{"ok":true}'},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:10}});};
  for(const role of ['plan','write','review'])await modelCall(s,cfg,{...b,activeChapter:1},'TEST JSON',role,secret,fetcher);
  assert.match(seen[0].url,/api.deepseek.com/);assert.match(seen[1].url,/ark.cn-beijing.volces.com/);assert.match(seen[2].url,/dashscope.aliyuncs.com/);
  assert.equal(seen[1].key,'Bearer SYNTHETIC WRITER KEY');assert.equal(seen[2].key,'Bearer SYNTHETIC REVIEW KEY');assert.equal(seen[1].payload.model,'TEST WRITER');
  const safe=JSON.stringify(publicConfig(cfg));assert.ok(!safe.includes('Encrypted')&&!safe.includes('SYNTHETIC'));assert.ok(!JSON.stringify(await s.cost(b.id)).includes('SYNTHETIC'));
  assert.deepEqual((await s.cost(b.id)).calls.map(c=>c.amount).sort((a,b)=>a-b),[20,50,90]);assert.equal(resolveModel(cfg,'repair').provider,'doubao');
});
test('独立角色未配完整不能启动；换服务商不沿用旧Key或静默回退',async()=>{
  const s=fresh(),b=await book(s),secret=await configured(s,{writerProvider:'doubao',writerModel:'TEST WRITER'});await assert.rejects(startJob(s,b.id,3),/正文/);
  await settings(s,{writerApiKey:'SYNTHETIC WRITER',writerInputPrice:1,writerOutputPrice:1},secret);await settings(s,{writerProvider:'groq'},secret);
  assert.equal((await config(s)).writerApiKeyEncrypted,'');let n=0;await assert.rejects(modelCall(s,await config(s),b,'TEST JSON','write',secret,async()=>{n++;}),/角色的API密钥/);assert.equal(n,0);
});
test('配置预读与费用预留之间关闭授权，原子INSERT阻止HTTP',async()=>{
  const s=fresh(),b=await book(s),secret=await configured(s),cfg=await config(s),original=s.db.prepare.bind(s.db);let inject=true,n=0;
  s.db.prepare=sql=>{const q=original(sql);if(sql.startsWith('INSERT INTO calls')){const run=q.run.bind(q);q.run=async()=>{if(inject){inject=false;await settings(s,{spendEnabled:false},secret);}return run();};}return q;};
  await assert.rejects(modelCall(s,cfg,b,'TEST JSON','write',secret,async()=>{n++;}),/授权配置已变化/);assert.equal(n,0);assert.equal((await s.cost(b.id)).calls.length,0);
});
test('单章预算对同章并发调用原子生效，未发请求不计费',async()=>{
  const s=fresh(),b=await book(s),secret=await configured(s,{chapterLimit:.007}),cfg=await config(s);let start,release;
  const ready=new Promise(r=>start=r),gate=new Promise(r=>release=r);let n=0;const fetcher=async()=>{n++;start();await gate;return Response.json({choices:[{message:{content:'{"ok":true}'},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:10}});};
  const first=modelCall(s,cfg,{...b,activeChapter:1},'TEST JSON','write',secret,fetcher);await ready;
  await assert.rejects(modelCall(s,cfg,{...b,activeChapter:1},'TEST JSON','write',secret,fetcher),/额度不足/);release();await first;assert.equal(n,1);assert.equal((await s.cost(b.id)).calls.length,1);
});
test('截断或无效JSON仍先结算已知usage，不占满不确定预留',async()=>{
  const s=fresh(),b=await book(s),secret=await configured(s),cfg=await config(s);
  await assert.rejects(modelCall(s,cfg,b,'TEST JSON','write',secret,async()=>Response.json({choices:[{message:{content:'{'},finish_reason:'length'}],usage:{prompt_tokens:10,completion_tokens:10}})),/截断/);
  const c=await s.cost(b.id);assert.equal(c.calls[0].status,'settled');assert.equal(c.calls[0].amount,20);
});
test('字数程序预检先于付费审稿，保留原稿并提供返修问题',async()=>{
  const s=fresh(),b=await book(s);await s.save(b,{...b,plan:plan(3),status:'ready'});const content=synthetic(400,200),c=await s.create('chapter',{number:1,title:'TEST',status:'reviewing',content,chunks:[content],hash:await hash(content),attempt:0},b.id,b.id+':chapter:1');let n=0;
  const r=await step(s,b.id,'',async()=>{n++;throw new Error('should not call');});assert.equal(r.phase,'text_preflight');assert.equal(n,0);assert.equal((await s.get(c.id)).content,content);assert.ok(r.chapter.repairIssues.some(i=>i.code==='LENGTH'));
});
test('无法在40%补丁范围内补足篇幅时，不付费尝试必败返修',async()=>{
  const s=fresh(),b=await book(s,9000);await s.save(b,{...b,plan:plan(3),status:'ready'});const content=synthetic(401,5000),c=await s.create('chapter',{number:1,title:'TEST',status:'rework',content,chunks:[content],hash:await hash(content),attempt:0},b.id,b.id+':chapter:1');let n=0;
  assert.equal(repairFeasible(c,9000),false);const r=await step(s,b.id,'',async()=>{n++;});assert.equal(r.chapter.status,'blocked');assert.equal(n,0);assert.equal(r.chapter.content,content);
});
test('局部补丁拒绝过期基稿、重复定位、重叠和大范围替换',async()=>{
  const content=synthetic(300,9000),c={content,hash:await hash(content)},before=content.slice(50,100);
  const ok=await applyRepair(c,{baseHash:c.hash,patches:[{before,after:'改'+before.slice(1)}]});assert.equal(ok.content.slice(100),content.slice(100));assert.equal(ok.content.slice(0,50),content.slice(0,50));
  await assert.rejects(applyRepair(c,{baseHash:'stale',patches:[]}),/哈希/);
  await assert.rejects(applyRepair(c,{baseHash:c.hash,patches:[{before,after:'改'+before},{before:content.slice(70,110),after:'改'}]}),/重叠/);
  await assert.rejects(applyRepair(c,{baseHash:c.hash,patches:[{before:content.slice(0,4000),after:content.slice(0,4000)+'改'}]}),/范围过大/);
  const repeated={content:before+'甲'+before,hash:await hash(before+'甲'+before)};await assert.rejects(applyRepair(repeated,{baseHash:repeated.hash,patches:[{before,after:'改'}]}),/不唯一/);
});
test('实际局部返修保留原版，仅生成补丁后全章复审锁定',async()=>{
  const s=fresh(),b=await book(s);await writeOne(s,b);let c=(await s.list('chapter',b.id))[0];const original=c.content;c=await s.save(c,{...c,status:'rework',review:null,repairIssues:[{id:'TEST-1',message:'SYNTHETIC local defect',quote:original.slice(0,24)}],attempt:0});const roles=[];
  const r=await step(s,b.id,'',async(...a)=>{roles.push(a[4]);return fixture(...a);});assert.deepEqual(roles,['repair']);assert.equal(r.chapter.status,'reviewing');assert.equal(r.chapter.attempt,1);assert.equal(r.chapter.content.slice(24),original.slice(24));
  assert.ok((await s.list('version',b.id)).some(v=>v.content===original));const audited=await step(s,b.id,'',fixture);assert.equal(audited.chapter.status,'locked');
});
test('章纲必须变化、禁止变化和逐场景证据不能被高分绕过',()=>{
  const content=synthetic(700,1000),c={content,contract:{schema:2,scenes:[{}],requiredDelta:[{key:'任务',from:'待执行',to:'完成'}],forbidden:[]}};c.review=review(c,1);
  assert.ok(qualityGate(c,[],{任务:'待执行'},1000).issues.some(i=>i.code==='REQUIRED_DELTA'));
  c.review.changes=[{key:'任务',from:'待执行',to:'完成',quote:content.slice(0,12),reason:'SYNTHETIC'}];assert.equal(qualityGate(c,[],{任务:'待执行'},1000).pass,true);
  c.contract.forbidden=[{key:'任务',to:'完成'}];assert.ok(qualityGate(c,[],{任务:'待执行'},1000).issues.some(i=>i.code==='FORBIDDEN_DELTA'));
  c.contract.forbidden=[];c.review.sceneEvidence=[];assert.ok(qualityGate(c,[],{任务:'待执行'},1000).issues.some(i=>i.code==='SCENE_EVIDENCE'));
});
test('错误审核结构不能污染摘要账本或进入锁定',()=>{const c={content:synthetic(701,1000)};c.review=review(c,1);c.review.summary={garbage:true};delete c.review.foreshadowing;assert.equal(qualityGate(c,[],{},1000).pass,false);assert.equal(qualityGate(c,[],{},1000).issues[0].code,'REVIEW_SCHEMA');});
test('相关旧稿上下文有原文和哈希，不包含未来或未定稿章节',async()=>{
  const b={plan:plan(30)},cs=[];for(let n=1;n<=20;n++){const content=synthetic(n+900,1000);cs.push({number:n,status:'locked',content,hash:await hash(content),review:review({content},n)});}cs.push({number:21,status:'writing',content:'UNLOCKED SECRET TEST ONLY'});
  const mem=await storyContext(b,cs,{relevantChapters:[2]},21);assert.ok(mem.source.some(s=>s.chapter===2));assert.ok(mem.source.some(s=>s.chapter===20));assert.ok(mem.ledger.length<=7);assert.ok(!JSON.stringify(mem).includes('UNLOCKED SECRET'));assert.equal(mem.source[0].text,cs[19].content.slice(-2200));
  const prompt=writePrompt({...b,guidanceFromChapter:1},{number:21,chunks:[],contract:{scenes:[{}]}},mem);assert.ok(prompt.includes(cs[19].content.slice(-40)));
  cs[19].content+='corruption';await assert.rejects(storyContext(b,cs,{},21),/哈希/);
});
test('新章节任务书拒绝虚构旧状态、未来章号和缺失因果字段',()=>{
  const b={workflowVersion:2},mem={nextChapter:2,facts:{权限:'无'}},c={schema:2,entry:'承接',cause:'原因',goal:'推进',deleteLoss:'损失',hook:'问题',relevantChapters:[1],scenes:[{goal:'目标',conflict:'阻碍',choice:'选择',consequence:'代价',setting:'地点',knowledgeBoundary:'知情范围',characters:['甲']}],requiredDelta:[{key:'权限',from:'无',to:'受限'}],forbidden:[]};
  validateSceneContract(c,b,mem,1);assert.throws(()=>validateSceneContract({...c,requiredDelta:[{key:'权限',from:'全权',to:'受限'}]},b,mem,1),/事实不一致/);assert.throws(()=>validateSceneContract({...c,relevantChapters:[2]},b,mem,1),/原文定位/);assert.throws(()=>validateSceneContract({...c,cause:''},b,mem,1));
});
test('十章审核指纹绑定实际正文和计划，旧PASS不能直接进入下一章',async()=>{
  const s=fresh(),b=await book(s,1000,20);const saved=await s.save(b,{...b,plan:plan(20),status:'ready'}),cs=[];
  for(let n=1;n<=10;n++){const content=synthetic(1000+n,1000);cs.push(await s.create('chapter',{number:n,title:'TEST',content,chunks:[content],hash:await hash(content),status:'locked',review:review({content},n),gate:{pass:true}},b.id,b.id+':chapter:'+n));}
  const fp=await arcFingerprint(saved,cs,10);assert.equal(await arcReady(saved,cs,{pass:true,fingerprint:fp},10),true);assert.equal(await arcReady({...saved,plan:{...saved.plan,arcs:saved.plan.arcs.map((a,i)=>i===0?{...a,goal:'CHANGED CURRENT STAGE'}:a)}},cs,{pass:true,fingerprint:fp},10),false);
  await s.create('audit',{pass:true,fingerprint:await openingFingerprint(saved,cs),completedAt:new Date().toISOString()},b.id,b.id+':opening');await s.create('audit',{pass:true,fingerprint:'stale'},b.id,b.id+':audit:10');const roles=[];
  const out=await step(s,b.id,'',async(...a)=>{roles.push(a[4]);return fixture(...a);});assert.equal(out.phase,'arc_audit');assert.deepEqual(roles,['arc_review']);assert.equal((await s.list('chapter',b.id)).length,10);
});
test('新100章作品先规划首批并验证开篇，未提前购买其余90章详纲',async()=>{
  const s=fresh(),b=await createBook(s,{targetWords:1000,totalChapters:100},crypto.randomUUID()),roles=[];const invoke=async(...a)=>{roles.push(a[4]);return batchedFixture(...a);};
  await step(s,b.id,'',invoke);await step(s,b.id,'',invoke);assert.equal((await s.get(b.id)).plan.contracts.length,10);assert.equal((await s.get(b.id)).plan.planningMode,'rolling');
  for(let i=0;i<15;i++){await step(s,b.id,'',invoke);if((await s.get(b.id+':opening'))?.pass)break;}
  assert.equal((await s.list('chapter',b.id)).filter(c=>c.status==='locked').length,3);assert.equal(roles.filter(r=>r==='plan_batch').length,1);assert.ok((await s.get(b.id+':opening')).pass);
});
test('滚动下一批详纲承接十章定稿，不改旧合同；恢复后审核重新验收',async()=>{
  const s=fresh(),b=await createBook(s,{targetWords:1000,totalChapters:20},crypto.randomUUID());await step(s,b.id,'',batchedFixture);await step(s,b.id,'',batchedFixture);const first=JSON.stringify((await s.get(b.id)).plan.contracts);
  for(let i=0;i<70;i++){await step(s,b.id,'',batchedFixture);if((await s.get(b.id)).plan.contracts.length===20)break;}
  const current=await s.get(b.id);assert.equal(current.plan.contracts.length,20);assert.equal(JSON.stringify(current.plan.contracts.slice(0,10)),first);assert.ok((await s.get(b.id+':audit:10')).pass);
  const backup={format:'novel-factory-backup-v1',book:current,chapters:await s.list('chapter',b.id),versions:await s.list('version',b.id),audits:await s.list('audit',b.id)};const restored=await restoreBackup(s,backup,crypto.randomUUID());assert.equal(restored.status,'paused');assert.equal(restored.workflowVersion,2);assert.ok((await s.list('audit',restored.id)).every(a=>!a.pass));
});
test('中断恢复始终暂停且不能创作，复用同一备份可完成；错误版本拒绝',async()=>{
  const s=fresh(),b=await book(s);await writeOne(s,b);await configured(s);const backup={format:'novel-factory-backup-v1',book:await s.get(b.id),chapters:await s.list('chapter',b.id),versions:await s.list('version',b.id)},key=crypto.randomUUID(),create=s.create.bind(s);let fail=true;
  s.create=async(...a)=>{if(a[0]==='version'&&fail){fail=false;throw new Error('SYNTHETIC interruption');}return create(...a);};await assert.rejects(restoreBackup(s,backup,key),/interruption/);
  const copy=(await s.list('book')).find(x=>x.id!==b.id);assert.equal(copy.status,'paused');assert.equal(copy.restoreComplete,false);await assert.rejects(startJob(s,copy.id,3),/恢复尚未完成/);await assert.rejects(step(s,copy.id,'',fixture),/恢复尚未完成/);
  const restored=await restoreBackup(s,backup,key);assert.equal(restored.restoreComplete,true);assert.equal(restored.workflowVersion,1);
  const bad=structuredClone(backup);bad.book.workflowVersion='2';await assert.rejects(restoreBackup(s,bad,crypto.randomUUID()),/工作流版本/);
  const different=structuredClone(backup);different.book.title+='DIFFERENT';await assert.rejects(restoreBackup(s,different,key),/混用不同备份/);
});
test('新9000字章节可显式选择三段，保留每场景证据与全文审核',async()=>{
  const s=fresh(),b=await createBook(s,{targetWords:9000,totalChapters:3},crypto.randomUUID());await configured(s,{segmentWords:3000});const roles=[];
  for(let i=0;i<10;i++){const r=await step(s,b.id,'',async(...a)=>{roles.push(a[4]);return fixture(...a);});if(r.chapter?.status==='locked')break;}
  const c=(await s.list('chapter',b.id))[0];assert.equal(c.status,'locked');assert.equal(c.contract.scenes.length,3);assert.equal(roles.filter(r=>r==='write').length,3);assert.equal(roles.filter(r=>r==='review').length,1);assert.equal(c.review.sceneEvidence.length,3);
});
test('虚构伏笔兑现和原地不动的状态变化不能冒充实质推进',()=>{
  const c={content:synthetic(1900,1000)};c.review=review(c,1);c.review.foreshadowing=[{id:'F1',status:'paid',evidence:'不存在的兑现原文'}];assert.ok(qualityGate(c,[],{},1000).issues.some(i=>i.code==='FORESHADOW_EVIDENCE'));
  c.review=review(c,1);c.review.changes=[{key:'任务',from:'没变',to:'没变',quote:c.content.slice(0,12),reason:'SYNTHETIC'}];assert.ok(qualityGate(c,[],{任务:'没变'},1000).issues.some(i=>i.code==='INVALID_DELTA'));
});
test('尚有90章未细化的滚动大纲备份可恢复，不补买全书计划',async()=>{
  const s=fresh(),b=await createBook(s,{targetWords:1000,totalChapters:100},crypto.randomUUID());await step(s,b.id,'',batchedFixture);await step(s,b.id,'',batchedFixture);
  const backup={format:'novel-factory-backup-v1',book:await s.get(b.id),chapters:[]};const r=await restoreBackup(s,backup,crypto.randomUUID());assert.equal(r.plan.contracts.length,10);assert.equal(r.plan.planningMode,'rolling');assert.equal(r.workflowVersion,2);assert.equal(r.status,'paused');
});
test('百炼业务空间仅构造北京官方域名，拒绝任意主机与地址注入',async()=>{
  const s=fresh(),b=await book(s),secret=await configured(s,{reviewProvider:'qwen',reviewModel:'TEST REVIEW',reviewWorkspace:'llm-synthetic',reviewApiKey:'SYNTHETIC REVIEW',reviewInputPrice:1,reviewOutputPrice:1});let url;
  await modelCall(s,await config(s),b,'TEST JSON','review',secret,async u=>{url=u;return Response.json({choices:[{message:{content:'{"ok":true}'},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1}});});assert.equal(url,'https://llm-synthetic.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions');
  await assert.rejects(settings(s,{reviewWorkspace:'evil.invalid/path'},secret),/空间ID无效/);await settings(s,{reviewWorkspace:'llm-another'},secret);assert.equal((await config(s)).reviewApiKeyEncrypted,'');
});
test('合法十章全文超过120k字符时，使用阶段专属上限而不截断',async()=>{
  const s=fresh(),b=await book(s,10000,10),secret=await configured(s),prompt='TEST ONLY\n'+synthetic(1901,112000)+'，。'.repeat(8000);let chars=0;
  assert.ok(prompt.length>120000);await modelCall(s,await config(s),b,prompt,'arc_review',secret,async(url,opt)=>{chars=JSON.parse(opt.body).messages[1].content.length;return Response.json({choices:[{message:{content:'{"ok":true}'},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:10}});});assert.equal(chars,prompt.length);
});
test('中段恢复先补历史十章验收，阶段建议进入第16章任务书',async()=>{
  const s=fresh(),b=await book(s,1000,20);await s.save(b,{...b,plan:plan(20),status:'ready'});
  for(let n=1;n<=15;n++){const content=synthetic(2100+n,1000);await s.create('chapter',{number:n,title:'TEST ONLY',content,chunks:[content],hash:await hash(content),status:'locked',review:review({content},n),gate:{pass:true}},b.id,b.id+':chapter:'+n);}
  const backup={format:'novel-factory-backup-v1',book:await s.get(b.id),chapters:await s.list('chapter',b.id)},restored=await restoreBackup(s,backup,crypto.randomUUID());await s.save(restored,{...restored,status:'ready'});const roles=[],invoke=async(...a)=>{roles.push(a[4]);if(a[4]==='contract')assert.ok(a[3].includes('SYNTHETIC NEXT ARC ADVICE'));const r=await fixture(...a);if(a[4]==='arc_review')r.nextAdjustment='SYNTHETIC NEXT ARC ADVICE';return r;};
  await step(s,restored.id,'',invoke);await step(s,restored.id,'',invoke);assert.deepEqual(roles,['opening_review','arc_review']);assert.equal((await s.list('chapter',restored.id)).length,15);await step(s,restored.id,'',invoke);assert.equal(roles.at(-1),'contract');
});
test('审核虚构原文引用时停止，不让作者付费修改小说来迎合假引用',async()=>{
  const s=fresh(),b=await book(s);await step(s,b.id,'',fixture);await step(s,b.id,'',fixture);await step(s,b.id,'',fixture);const c=(await s.list('chapter',b.id))[0],content=c.content;
  await assert.rejects(step(s,b.id,'',async(...a)=>{const r=await fixture(...a);r.scores.language.quote='SYNTHETIC NONEXISTENT QUOTE';return r;}),/证据无效/);const current=await s.get(c.id);assert.equal(current.status,'reviewing');assert.equal(current.attempt,0);assert.equal(current.content,content);
});
test('策划只读取相关编辑反馈，不发送合同依据或其他敏感记录字段',()=>{
  const prompt=planningPrompt({title:'TEST',direction:'TEST',platform:'番茄小说',totalChapters:3,targetWords:1000,budget:1},[],[{platform:'番茄小说',status:'rejected',feedback:'SYNTHETIC USEFUL FEEDBACK',contractEvidence:'SYNTHETIC PRIVATE CONTRACT'},{platform:'其他平台',feedback:'SYNTHETIC UNRELATED FEEDBACK'}]);
  assert.ok(prompt.includes('SYNTHETIC USEFUL FEEDBACK'));assert.ok(!prompt.includes('SYNTHETIC PRIVATE CONTRACT'));assert.ok(!prompt.includes('SYNTHETIC UNRELATED FEEDBACK'));
});
test('过期设置界面不能覆盖另一窗口的新费用授权或模型选择',async()=>{
  const s=fresh(),secret=await configured(s),old=publicConfig(await config(s));await settings(s,{spendEnabled:false},secret);await assert.rejects(settings(s,{...old,model:'SYNTHETIC STALE MODEL'},secret),/配置版本已变化/);assert.equal((await config(s)).spendEnabled,false);
});
test('联合审核拒绝畸形缺陷清单、伪造附加引用和非文字结论',()=>{
  const cs=Array.from({length:10},(_,i)=>({number:i+1,content:synthetic(i+3100,1000)})),evidence=cs.map(c=>({chapter:c.number,quote:c.content.slice(0,12),reason:'SYNTHETIC'}));
  const arc={pass:true,evidence,payoffEvidence:evidence[0],irreversibleEvidence:evidence[9],issues:[],nextAdjustment:'SYNTHETIC ADVICE'};
  assert.equal(arcGate(arc,cs).pass,true);assert.equal(arcGate({...arc,issues:{}},cs).pass,false);assert.equal(arcGate({...arc,evidence:[...evidence,{chapter:1,quote:'SYNTHETIC NONEXISTENT',reason:'SYNTHETIC'}]},cs).pass,false);assert.equal(arcGate({...arc,nextAdjustment:{}},cs).pass,false);
  const opening=openingReport(cs);assert.equal(openingGate(opening,cs).pass,true);assert.equal(openingGate({...opening,issues:'none'},cs).pass,false);assert.equal(openingGate({...opening,readerReason:{}},cs).pass,false);assert.equal(openingGate({...opening,issues:[{severity:'minor',message:'SYNTHETIC',chapter:1,quote:'SYNTHETIC NONEXISTENT'}]},cs).pass,false);
});
test('只修改远期详纲不重购开篇验收，开篇上下文和标题变化仍失效',async()=>{
  const p=plan(100),b={plan:p,platform:'番茄小说',totalChapters:100,targetWords:1000},cs=[1,2,3].map(n=>({number:n,title:'TEST '+n,content:synthetic(n+3200,1000)}));const fp=await openingFingerprint(b,cs),future=structuredClone(b);future.planRevision=99;future.guidance='SYNTHETIC FUTURE GUIDANCE';future.guidanceFromChapter=90;future.plan.contracts[89].goal='SYNTHETIC FAR FUTURE';future.plan.arcs[8].goal='SYNTHETIC FAR FUTURE';
  assert.equal(await openingFingerprint(future,cs),fp);assert.ok(!openingPrompt(future,cs).includes('SYNTHETIC FAR FUTURE'));assert.ok(!openingPrompt(future,cs).includes('SYNTHETIC FUTURE GUIDANCE'));
  const style=structuredClone(b);style.plan.style={narration:'SYNTHETIC CHANGED STYLE'};assert.notEqual(await openingFingerprint(style,cs),fp);const next=structuredClone(b);next.plan.arcs[1].goal='SYNTHETIC NEXT ARC';assert.notEqual(await openingFingerprint(next,cs),fp);assert.notEqual(await openingFingerprint(b,cs.map(c=>c.number===1?{...c,title:'CHANGED TITLE'}:c)),fp);
  const short=structuredClone(b);short.plan.arcs=[{start:1,end:1},{start:2,end:2},{start:3,end:3,goal:'THIRD CHAPTER STAGE'},{start:4,end:10,goal:'NEXT STAGE'},{start:11,end:20,goal:'FAR STAGE'}];const prompt=openingPrompt(short,cs);assert.ok(prompt.includes('THIRD CHAPTER STAGE'));assert.ok(prompt.includes('NEXT STAGE'));assert.ok(!prompt.includes('FAR STAGE'));
});
test('阶段审核同时绑定阶段入口事实和全文，远期详纲不引起重审',async()=>{
  const b={plan:plan(30),platform:'番茄小说'},cs=[];for(let n=1;n<=20;n++){const content=synthetic(3300+n,1000);cs.push({number:n,title:'SYNTHETIC '+n,status:'locked',content,hash:await hash(content),review:review({content},n)});}const fp=await arcFingerprint(b,cs,20),far=structuredClone(b);far.plan.arcs[2].goal='SYNTHETIC FAR STAGE';far.planRevision=100;
  assert.equal(await arcFingerprint(far,cs,20),fp);const before=structuredClone(cs);before[0].review.changes[0].to='SYNTHETIC CHANGED ENTRY FACT';assert.notEqual(await arcFingerprint(b,before,20),fp);assert.ok(arcPrompt(b,before,20).includes('SYNTHETIC CHANGED ENTRY FACT'));assert.ok(!arcPrompt(b,cs,20).includes(cs[0].content));assert.notEqual(await arcFingerprint(b,cs.map(c=>c.number===12?{...c,title:'CHANGED TITLE'}:c),20),fp);
});
test('修订副本中断保留暂停且不能运行，重试同一请求完成前缀复制',async()=>{
  const s=fresh(),b=await book(s,1000,3);await s.save(b,{...b,plan:plan(3),status:'ready'});for(let n=1;n<=2;n++){const content=synthetic(3400+n,1000);await s.create('chapter',{number:n,title:'TEST',content,chunks:[content],hash:await hash(content),status:'locked',review:review({content},n),gate:{pass:true}},b.id,b.id+':chapter:'+n);}const original=await s.get(b.id),key=crypto.randomUUID(),create=s.create.bind(s);let fail=true;
  s.create=async(...a)=>{if(a[0]==='chapter'&&a[1].number===2&&fail){fail=false;throw new Error('SYNTHETIC FORK INTERRUPTION');}return create(...a);};await assert.rejects(forkRevision(s,b.id,3,key),/INTERRUPTION/);const copy=(await s.list('book')).find(x=>x.id!==b.id);assert.equal(copy.status,'paused');assert.equal(copy.revisionComplete,false);assert.equal((await s.list('chapter',copy.id)).length,1);await assert.rejects(startJob(s,copy.id,3),/修订副本建立尚未完成/);await assert.rejects(step(s,copy.id,'',fixture),/修订副本建立尚未完成/);await assert.rejects(forkRevision(s,copy.id,1,crypto.randomUUID()),/修订副本建立尚未完成/);const done=await forkRevision(s,b.id,3,key);assert.equal(done.id,copy.id);assert.equal(done.revisionComplete,true);assert.equal(done.status,'paused');assert.equal((await s.list('chapter',copy.id)).length,2);assert.deepEqual(await s.get(b.id),original);assert.equal((await s.list('job')).length,0);
});

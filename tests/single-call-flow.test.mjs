// SYNTHETIC ONLY: real SQLite and HTTP accounting with a simulated supplier.
// No real API key, novel, provider network request or quality claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,book,configured,fixture,synthetic,review,writeOne} from './workflow-support.mjs';
import {craftFixture} from './craft-support.mjs';
import {createBook,step,saveChapter,exportBook,snapshot,config} from '../lib/engine.mjs';
import {startJob,runJobStep,startEditorRevision,pauseJob} from '../lib/jobs.mjs';
import {modelCall,callSpec} from '../lib/model.mjs';
import {Store,hash} from '../lib/store.mjs';
import {factsFrom} from '../lib/quality.mjs';
import {restoreBackup} from '../lib/backup.mjs';
import {wholeChapterPrompt} from '../lib/prompts.mjs';
import {estimateBookCost,estimateScenarios} from '../lib/cost-estimate.mjs';

async function setup(words=1000,total=3){const s=fresh(),secret=await configured(s,{monthLimit:100,bookLimit:100,chapterLimit:2});const b=await createBook(s,{targetWords:words,totalChapters:total,budget:100},crypto.randomUUID());return {s,b,secret};}
function supplier(roles,{low=false,badFacts=false}={}){return async(...args)=>{
  const [s,cfg,b,,role]=args;roles.push(role);
  if(role==='rewrite'){const c=(await s.list('chapter',b.id)).find(c=>c.status!=='locked');return {text:synthetic(983+c.attempt, b.targetWords),chapterComplete:true};}
  const out=await craftFixture(...args);
  if(role==='review'&&low){out.scores.commercial.score=10;out.issues.push({severity:'major',message:'SYNTHETIC missing action cost',quote:out.scores.commercial.quote,fix:'SYNTHETIC: replace the opening explanation with a choice and a lasting cost'});if(badFacts)out.changes[0].from='SYNTHETIC invented prior';}
  return out;
};}
async function finish(s,b,secret,invoke,limit=50){for(let i=0;i<limit;i++){await runJobStep(s,b.id,secret,invoke);const j=await s.get(b.id+':job');if(['completed','blocked'].includes(j.status))return j;}throw Error('SYNTHETIC exceeded bounded test steps');}

test('9000-Han chapter is one full author request plus one review, never six fragments',async()=>{
  const {s,b,secret}=await setup(9000),roles=[];await startJob(s,b.id,1);
  assert.equal((await finish(s,b,secret,supplier(roles))).status,'completed');
  assert.deepEqual(roles,['plan','contract','write','review']);
  const c=(await s.list('chapter',b.id))[0];assert.equal(c.chunks.length,1);assert.equal(c.reviewCount,1);assert.equal(c.phaseCalls.filter(p=>p.role==='write').length,1);assert.equal(c.gate.pass,true);
  const spec=callSpec({...await config(s),singleCallChapter:true},'SYNTHETIC','write');assert.equal(spec.maxTokens,16000);assert.equal(spec.body.thinking.type,'disabled');
  const prompt=wholeChapterPrompt(await s.get(b.id),c,{source:[]});assert.match(prompt,/一次写完全部场景/);assert.doesNotMatch(prompt,/只完成当前场景/);
});

test('five low valid audits release the chapter with the real score/issues; four whole revisions and no director or joint-review API',async()=>{
  const {s,b,secret}=await setup(),roles=[];await startJob(s,b.id,1);
  assert.equal((await finish(s,b,secret,supplier(roles,{low:true}))).status,'completed');
  assert.deepEqual(roles,['plan','contract','write','review','rewrite','review','rewrite','review','rewrite','review','rewrite','review']);
  const c=(await s.list('chapter',b.id))[0];assert.equal(c.reviewCount,5);assert.equal(c.reviewAttempts,5);assert.equal(c.attempt,4);assert.equal(c.status,'locked');assert.equal(c.needsPolish,true);assert.equal(c.gate.pass,false);assert.equal(c.gate.score,81);assert.equal(c.release.actualQualityPass,false);assert.ok(c.repairIssues.length);assert.equal(c.reviewReceipts.length,5);
  assert.equal(c.directorTask.modelRequests,0);assert.ok(c.directorTask.tasks.every(t=>t.source&&t.change&&t.acceptance));
  assert.match(await exportBook(s,b.id),/五审上限放行·待人工精修；实际81分/);
  for(let i=0;i<25;i++)await runJobStep(s,b.id,secret,supplier(roles));assert.equal(roles.length,12);
  await assert.rejects(startEditorRevision(s,{id:c.id,baseHash:c.hash,revision:c.revision,key:crypto.randomUUID(),instruction:''}),/未定稿/);
});

test('actual modelCall HTTP sends exactly once per stage, including all five audits; ledger matches network count',async t=>{
  const {s,b,secret}=await setup(),roles=[],http=[];let now=Date.now();t.mock.method(Date,'now',()=>now);
  const simulate=supplier(roles,{low:true});const invoke=async(...a)=>{now+=15000;const response=await simulate(...a);return modelCall(...a,async(url,opt)=>{http.push({role:a[4],url,payload:JSON.parse(opt.body)});return Response.json({id:'SYNTHETIC-'+http.length,choices:[{message:{content:JSON.stringify(response)},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:10}});});};
  await startJob(s,b.id,1);assert.equal((await finish(s,b,secret,invoke)).status,'completed');
  assert.equal(http.length,12);assert.equal(http.filter(h=>h.role==='write').length,1);assert.equal(http.filter(h=>h.role==='review').length,5);assert.equal(http.filter(h=>h.role==='rewrite').length,4);
  assert.ok(http.every(h=>h.url==='https://api.deepseek.com/v1/chat/completions'));const audit=await s.cost(b.id);assert.equal(audit.calls.length,http.length);assert.ok(audit.calls.every(c=>c.status==='settled'));
});

test('restart, double start, pause and a new revision nonce preserve the same five-audit counter',async()=>{
  const {s,b,secret}=await setup(),roles=[];await startJob(s,b.id,1);const invoke=supplier(roles,{low:true});
  while((await s.list('chapter',b.id))[0]?.reviewCount!==2)await runJobStep(s,b.id,secret,invoke);
  await pauseJob(s,b.id);let c=(await s.list('chapter',b.id))[0];const reopened=new Store(s.db,s.owner);
  const input={id:c.id,revision:c.revision,baseHash:c.hash,key:crypto.randomUUID(),instruction:'SYNTHETIC concrete adjustment'};
  const j=await startEditorRevision(reopened,input);await startEditorRevision(reopened,input);await startJob(reopened,b.id,1);
  await runJobStep(reopened,b.id,secret,invoke);assert.equal(roles.filter(r=>r==='revision_plan').length,0);
  await runJobStep(reopened,b.id,secret,invoke);assert.equal((await startEditorRevision(reopened,input)).duplicate,true);
  // Explicit revision retains the original target (the saved target is 1 here).
  const job=await reopened.get(b.id+':job');await reopened.save(job,{...job,targetChapters:1});
  assert.equal((await finish(reopened,b,secret,invoke)).status,'completed');c=await reopened.get(c.id);assert.equal(c.reviewCount,5);assert.equal(roles.filter(r=>r==='review').length,5);assert.equal(c.needsPolish,true);
});

test('invalid or truncated author response stops after one request and cannot replay on restart/new nonce',async()=>{
  for(const truncated of [false,true]){
    const {s,b,secret}=await setup(),roles=[];await startJob(s,b.id,1);
    await runJobStep(s,b.id,secret,supplier(roles));await runJobStep(s,b.id,secret,supplier(roles));let sent=0;
    const fail=async()=>{sent++;if(truncated)throw Object.assign(new Error('SYNTHETIC truncated'),{modelResponse:{content:'SYNTHETIC partial',finishReason:'length'}});return {text:'SYNTHETIC short',chapterComplete:true};};
    assert.equal((await runJobStep(s,b.id,secret,fail)).job.status,'blocked');const c=(await s.list('chapter',b.id))[0];assert.equal(c.content,'');assert.equal(c.phaseCalls.at(-1).status,'failed');assert.ok(c.modelCandidate);
    await startJob(s,b.id,1);assert.equal((await runJobStep(s,b.id,secret,fail)).job.status,'blocked');assert.equal(sent,1);
  }
});

test('an in-flight phase left by a crash refuses another writer request even after the lease expires',async()=>{
  const {s,b,secret}=await setup(),roles=[];await startJob(s,b.id,1);await runJobStep(s,b.id,secret,supplier(roles));await runJobStep(s,b.id,secret,supplier(roles));
  const c=(await s.list('chapter',b.id))[0];await s.save(c,{...c,phaseCalls:[...(c.phaseCalls||[]),{key:'write:initial:0',role:'write',status:'started'}],lease:null});
  const r=await runJobStep(s,b.id,secret,supplier(roles));assert.equal(r.job.status,'blocked');assert.match(r.job.error,/已经发送过一次请求/);assert.deepEqual(roles,['plan','contract']);
});

test('bad review evidence is preserved and never automatically retried or counted as a completed audit',async()=>{
  const {s,b,secret}=await setup(),roles=[];await startJob(s,b.id,1);const simulate=supplier(roles);
  for(let i=0;i<3;i++)await runJobStep(s,b.id,secret,simulate);
  const bad=async(...a)=>{const r=await simulate(...a);r.scores.commercial.quote='SYNTHETIC absent evidence';return r;};
  assert.equal((await runJobStep(s,b.id,secret,bad)).job.status,'blocked');let c=(await s.list('chapter',b.id))[0];assert.equal(c.reviewCount,0);assert.equal(c.reviewAttempts,1);assert.ok(c.modelCandidate);
  await startJob(s,b.id,1);assert.equal((await runJobStep(s,b.id,secret,bad)).job.status,'blocked');assert.equal(roles.filter(r=>r==='review').length,1);assert.equal((await s.get(c.id)).reviewCount,0);
});

test('legacy three-repair blocked chapter resumes with saved completed reviews, without discarding its draft or resetting counts',async()=>{
  const s=fresh(),secret=await configured(s);let b=await book(s),c=await writeOne(s,b);const original=c.content;
  for(let n=0;n<2;n++){const content=synthetic(771+n,1000);await s.create('version',{number:1,content,hash:await hash(content),review:review({...c,content},1)},b.id);}
  b=await s.get(b.id);const {singleCallProtocol,...rest}=b;b=await s.save(b,{...rest,workflowVersion:2});
  c=await s.save(c,{...c,status:'blocked',attempt:3,gate:{pass:false,score:76,issues:[{code:'SCORE',message:'总分76，不足85'}]}});await startJob(s,b.id,1);
  assert.equal((await s.get(c.id)).reviewCount,3);const roles=[],simulate=async(...a)=>{
    roles.push(a[4]);if(a[4]==='rewrite')return {text:synthetic(983+(await s.get(c.id)).attempt,1000)};
    const r=await fixture(...a);if(a[4]==='review')r.scores.commercial.score=10;return r;
  };
  assert.equal((await finish(s,b,secret,simulate)).status,'completed');assert.deepEqual(roles,['rewrite','review','rewrite','review']);c=await s.get(c.id);assert.equal(c.reviewCount,5);assert.equal(c.attempt,5);assert.equal(c.needsPolish,true);assert.ok((await s.list('version',b.id)).some(v=>v.content===original));
});

test('five-audit override carries only supported state changes into later chapters and survives backup with honest quality flags',async()=>{
  const {s,b,secret}=await setup(),roles=[];await startJob(s,b.id,1);await finish(s,b,secret,supplier(roles,{low:true,badFacts:true}));
  const cs=await s.list('chapter',b.id),c=cs[0],current=await s.get(b.id);assert.equal(factsFrom(current.plan,cs)['章1'],undefined);assert.deepEqual(c.release.acceptedChanges,[]);
  const state=await snapshot(s,b.id);assert.equal(state.storyDocuments.world.currentFacts['章1'],undefined);assert.equal(state.acceptance.ready,false);
  const backup={format:'novel-factory-backup-v1',book:current,chapters:cs,versions:await s.list('version',b.id)};
  const restored=await restoreBackup(s,backup,crypto.randomUUID());const restoredChapter=(await s.list('chapter',restored.id))[0];assert.equal(restoredChapter.needsPolish,true);assert.equal(restoredChapter.gate.pass,false);assert.equal(restoredChapter.reviewCount,5);
  const forged=structuredClone(backup);forged.chapters[0].reviewReceipts.pop();await assert.rejects(restoreBackup(s,forged,crypto.randomUUID()),/五审放行/);
});

test('three good chapters complete without automatic three-chapter or ten-chapter model calls',async()=>{
  const {s,b,secret}=await setup(),roles=[];await startJob(s,b.id,3);assert.equal((await finish(s,b,secret,supplier(roles))).status,'completed');
  assert.deepEqual(roles,['plan','contract','write','review','contract','write','review','contract','write','review']);assert.equal((await s.list('audit',b.id)).length,0);assert.equal((await snapshot(s,b.id)).qualityPending,false);
});

test('a budget rejection before HTTP uses no request/audit allowance and can proceed only after an explicit affordable restart',async()=>{
  const {s,b,secret}=await setup(),roles=[];await startJob(s,b.id,1);const simulate=supplier(roles);
  for(let i=0;i<3;i++)await runJobStep(s,b.id,secret,simulate);
  let current=await s.get(b.id);await s.save(current,{...current,budget:0.000001});let http=0;
  const invoke=async(...a)=>modelCall(...a,async()=>{http++;const r=await craftFixture(...a);return Response.json({choices:[{message:{content:JSON.stringify(r)},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:10}});});
  assert.equal((await runJobStep(s,b.id,secret,invoke)).job.status,'blocked');let c=(await s.list('chapter',b.id))[0];assert.equal(http,0);assert.equal(c.reviewAttempts,0);assert.equal(c.phaseCalls.at(-1).status,'not_sent');
  current=await s.get(b.id);await s.save(current,{...current,budget:100});await startJob(s,b.id,1);await runJobStep(s,b.id,secret,invoke);c=await s.get(c.id);assert.equal(http,1);assert.equal(c.reviewCount,1);assert.equal(c.reviewAttempts,1);
});

test('new cost forecast counts whole chapters, up to four whole revisions and five reviews without hidden joint audits',()=>{
  const base=estimateBookCost({chapters:100,singleCall:true,scenario:{...estimateScenarios[1],repairRate:0}});assert.equal(base.calls,311);assert.ok(!base.rows.some(r=>/联合|总审|分段/.test(r.phase)));
  const ceiling=estimateBookCost({chapters:100,singleCall:true,scenario:{...estimateScenarios[1],repairRate:4}});assert.equal(ceiling.calls,1111);assert.equal(ceiling.rows.find(r=>r.phase==='整章返修').calls,400);assert.equal(ceiling.rows.filter(r=>/审核|复审/.test(r.phase)).reduce((n,r)=>n+r.calls,0),500);
});

test('a legacy chapter with five evidenced saved audits releases on explicit continuation without buying a sixth audit',async()=>{
  const s=fresh(),secret=await configured(s);let b=await book(s),c=await writeOne(s,b);
  for(let n=0;n<4;n++){const content=synthetic(880+n,1000);await s.create('version',{number:1,content,hash:await hash(content),review:review({...c,content},1)},b.id);}
  b=await s.get(b.id);const {singleCallProtocol,...rest}=b;b=await s.save(b,{...rest,workflowVersion:2});c.review.scores.commercial.score=7;c=await s.save(c,{...c,status:'blocked',attempt:3,gate:{pass:false,score:78,issues:[{code:'SCORE',message:'总分78，不足85'}]}});
  await startJob(s,b.id,1);let requests=0;await finish(s,b,secret,async()=>{requests++;throw Error('must not send');});c=await s.get(c.id);assert.equal(c.reviewCount,5);assert.equal(c.needsPolish,true);assert.equal(c.gate.score,78);assert.equal(requests,0);
});

test('invalid planning response stops once and persists its request receipt across explicit restart',async()=>{
  const {s,b,secret}=await setup();await startJob(s,b.id,1);let requests=0;const invalid=async()=>{requests++;return {title:'SYNTHETIC incomplete plan'};};
  assert.equal((await runJobStep(s,b.id,secret,invalid)).job.status,'blocked');await startJob(s,b.id,1);assert.equal((await runJobStep(s,b.id,secret,invalid)).job.status,'blocked');assert.equal(requests,1);assert.equal((await s.get(b.id)).phaseCalls[0].status,'failed');
});

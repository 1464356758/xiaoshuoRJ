// SYNTHETIC ONLY: real SQLite and production workflow, no real keys or manuscripts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,book,configured,writeOne,fixture,synthetic} from './workflow-support.mjs';
import {startJob,startEditorRevision,runJobStep,pauseJob} from '../lib/jobs.mjs';
import {settings,saveChapter} from '../lib/engine.mjs';
import {Store} from '../lib/store.mjs';
import {modelCall} from '../lib/model.mjs';

async function blocked(){
  const s=fresh(),b=await book(s),secret=await configured(s);
  let c=await writeOne(s,b);await startJob(s,b.id,3);await pauseJob(s,b.id);
  c=await s.save(c,{...c,status:'blocked',attempt:3,gate:{pass:false,score:76,issues:[{code:'SCORE',message:'SYNTHETIC: 76, below 85'}]}});
  const input={id:c.id,revision:c.revision,baseHash:c.hash,key:crypto.randomUUID(),instruction:''};
  return {s,b,c,secret,input};
}
const rewriting=async(...args)=>args[4]==='rewrite'?{text:synthetic(573,1000)}:fixture(...args);

test('explicit revision is durable, idempotent and reviewed before continuing the original target; automatic cap remains three',async()=>{
  const {s,b,c,secret,input}=await blocked();
  const first=await startEditorRevision(s,input);assert.equal(first.status,'queued');assert.equal(first.targetChapters,3);
  assert.equal((await startEditorRevision(s,input)).editorRevision,first.editorRevision);
  assert.equal((await s.list('editorRevision',b.id)).length,1);assert.equal((await s.get(c.id)).content,c.content);
  let rewrites=0,reviews=0;
  const invoke=async(...args)=>{if(args[4]==='rewrite'){rewrites++;assert.ok(args[3].includes('SYNTHETIC: 76, below 85'));}if(args[4]==='review')reviews++;return rewriting(...args);};
  const r=await runJobStep(s,b.id,secret,invoke);assert.equal(r.phase,'editor_revision');
  const revised=await s.get(c.id);assert.equal(revised.status,'reviewing');assert.equal(revised.attempt,3);assert.notEqual(revised.hash,c.hash);
  assert.ok((await s.list('version',b.id)).some(v=>v.hash===c.hash&&v.content===c.content));
  assert.equal((await s.get(first.editorRevision)).status,'completed');assert.equal((await s.get(b.id+':job')).editorRevision,null);
  assert.equal((await startEditorRevision(s,input)).duplicate,true);assert.equal(rewrites,1);assert.equal(reviews,0);
  await runJobStep(s,b.id,secret,invoke);assert.equal((await s.get(c.id)).status,'locked');assert.equal(reviews,1);
  for(let i=0;i<35&&(await s.get(b.id+':job')).status!=='completed';i++)await runJobStep(s,b.id,secret,invoke);
  assert.equal((await s.get(b.id+':job')).status,'completed');assert.equal((await s.list('chapter',b.id)).filter(c=>c.status==='locked').length,3);
  assert.equal(rewrites,1);assert.equal((await s.get(c.id)).attempt,3);
});

test('another failed audit stops at the unchanged automatic limit, with no fourth automatic repair',async()=>{
  const {s,b,c,secret,input}=await blocked();await startEditorRevision(s,input);await runJobStep(s,b.id,secret,rewriting);
  const roles=[];const invoke=async(...args)=>{roles.push(args[4]);const out=await fixture(...args);if(args[4]==='review')out.scores.commercial.score=5;return out;};
  await runJobStep(s,b.id,secret,invoke);assert.equal((await s.get(b.id+':job')).status,'blocked');assert.equal((await s.get(c.id)).attempt,3);
  for(let i=0;i<4;i++)await runJobStep(s,b.id,secret,invoke);
  assert.deepEqual(roles,['review']);assert.equal((await s.get(c.id)).status,'blocked');
});

test('stale hash, revision, foreign owner, locked chapter and zero budget are rejected before registration',async()=>{
  const {s,b,c,secret,input}=await blocked();
  await assert.rejects(startEditorRevision(s,{...input,baseHash:'stale'}),/章节已变化/);
  await assert.rejects(startEditorRevision(s,{...input,revision:1}),/章节已变化/);
  await assert.rejects(startEditorRevision(new Store(s.db,'other-owner'),input),/章节不存在/);
  await assert.rejects(startEditorRevision(s,{...input,key:'bad'}),/幂等/);
  await settings(s,{taskLimit:0},secret);await assert.rejects(startEditorRevision(s,input),/费用上限/);
  assert.equal((await s.list('editorRevision',b.id)).length,0);
  await settings(s,{taskLimit:2},secret);const locked=await s.save(await s.get(c.id),{...await s.get(c.id),status:'locked'});
  await assert.rejects(startEditorRevision(s,{...input,revision:locked.revision}),/未定稿/);
});

test('manual saved edits can be resubmitted without a rewrite or resetting the repair cap',async()=>{
  const {s,b,c,secret}=await blocked();const revised=await saveChapter(s,{id:c.id,revision:c.revision,title:c.title,content:synthetic(500,1000)});
  assert.equal(revised.attempt,3);assert.equal(revised.status,'reviewing');await startJob(s,b.id,3);
  const result=await runJobStep(s,b.id,secret,fixture);assert.equal(result.phase,'review');assert.equal((await s.get(c.id)).status,'locked');
});

test('pause before execution retains the pending request; pause during execution saves once and stops before review',async()=>{
  const {s,b,c,secret,input}=await blocked();const j=await startEditorRevision(s,input);await pauseJob(s,b.id);
  assert.equal((await runJobStep(s,b.id,secret,rewriting)).advanced,false);assert.equal((await s.get(j.editorRevision)).status,'queued');
  await startJob(s,b.id,3);let entered,release;const atCall=new Promise(r=>entered=r),wait=new Promise(r=>release=r);
  const running=runJobStep(s,b.id,secret,async(...args)=>{assert.equal(args[4],'rewrite');entered();await wait;return rewriting(...args);});
  await atCall;await pauseJob(s,b.id);release();await running;
  assert.equal((await s.get(b.id+':job')).status,'paused');assert.equal((await s.get(c.id)).status,'reviewing');
  await startJob(s,b.id,3);assert.equal((await runJobStep(s,b.id,secret,fixture)).phase,'review');
});

test('incomplete or truncated paid response preserves the original and candidate; replay does not spend again',async()=>{
  for(const truncated of [false,true]){
    const {s,b,c,secret,input}=await blocked();const job=await startEditorRevision(s,input);let calls=0;
    const result=await runJobStep(s,b.id,secret,async()=>{calls++;if(truncated){const e=new Error('SYNTHETIC truncated response');e.modelResponse={raw:'SYNTHETIC partial',finishReason:'length'};throw e;}return {text:'SYNTHETIC incomplete'};});
    assert.equal(result.job.status,'blocked');const saved=await s.get(c.id);assert.equal(saved.content,c.content);assert.equal(saved.hash,c.hash);assert.equal(saved.attempt,3);assert.equal(saved.lease,null);assert.ok(saved.rewriteCandidate);
    assert.equal((await s.get(job.editorRevision)).status,'failed');assert.equal((await startEditorRevision(s,input)).duplicate,true);
    await runJobStep(s,b.id,secret,rewriting);assert.equal(calls,1);
  }
});

test('configuration changes before a queued revision stop execution before any model invocation',async()=>{
  const {s,b,c,secret,input}=await blocked();await startEditorRevision(s,input);await pauseJob(s,b.id);await settings(s,{monthLimit:42},secret);
  let calls=0;const job=await s.get(b.id+':job');await s.save(job,{...job,status:'queued'});const current=await s.get(b.id);await s.save(current,{...current,status:'ready'});
  const result=await runJobStep(s,b.id,secret,async()=>{calls++;});assert.equal(result.reason,'changed');assert.equal(calls,0);assert.equal((await s.get(c.id)).content,c.content);
});

test('real model budget reservation blocks an unaffordable rewrite before HTTP',async()=>{
  const {s,b,c,secret,input}=await blocked();let current=await s.get(b.id);await s.save(current,{...current,budget:0.000001});await startEditorRevision(s,input);let http=0;
  const result=await runJobStep(s,b.id,secret,(...args)=>modelCall(...args,async()=>{http++;throw new Error('must not reach supplier');}));
  assert.equal(result.job.status,'blocked');assert.match(result.job.error,/预算|上限|额度不足/);assert.equal(http,0);assert.equal((await s.get(c.id)).content,c.content);assert.equal((await s.cost(b.id)).calls.length,0);
});

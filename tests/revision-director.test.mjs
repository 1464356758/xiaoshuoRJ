// SYNTHETIC ONLY. Real SQLite workflow with simulated director/author/reviewer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,book,configured,writeOne,fixture,synthetic} from './workflow-support.mjs';
import {step,saveChapter,config} from '../lib/engine.mjs';
import {startJob,startEditorRevision,runJobStep} from '../lib/jobs.mjs';
import {callSpec} from '../lib/model.mjs';
async function rework(attempt=0){const s=fresh();let b=await book(s);const secret=await configured(s);let c=await writeOne(s,b);b=await s.get(b.id);b=await s.save(b,{...b,workflowVersion:2});c=await s.save(c,{...c,status:'rework',attempt,gate:{pass:false,score:76,issues:[{code:'SCORE',message:'SYNTHETIC saved review below threshold'}]}});return {s,b,c,secret};}
test('failed review routes director -> author -> full review, with the task bound to real feedback',async()=>{
  const {s,b,c,secret}=await rework(),roles=[];const invoke=async(...a)=>{roles.push(a[4]);if(a[4]==='repair')assert.match(a[3],/总监正式发布的修改任务/);return fixture(...a);};
  let r=await step(s,b.id,secret,invoke);assert.equal(r.phase,'revision_task');assert.equal(r.chapter.attempt,1);assert.equal(r.chapter.hash,c.hash);assert.equal(r.chapter.directorTask.sourceHash,c.hash);assert.ok(r.chapter.directorTask.tasks[0].source);
  r=await step(s,b.id,secret,invoke);assert.equal(r.phase,'rework');assert.equal(r.chapter.directorTask.status,'written');assert.equal(r.chapter.attempt,1);
  r=await step(s,b.id,secret,invoke);assert.equal(r.chapter.status,'locked');assert.deepEqual(roles,['revision_plan','repair','review']);
});
test('two revisions without score improvement stop, no fourth cycle or blind extra review',async()=>{
  const {s,b,secret}=await rework(),roles=[];await startJob(s,b.id,3);
  const invoke=async(...a)=>{roles.push(a[4]);const out=await fixture(...a);if(a[4]==='review')out.scores.commercial.score=5;return out;};
  for(let i=0;i<20&&(await s.get(b.id+':job')).status!=='blocked';i++)await runJobStep(s,b.id,secret,invoke);
  const c=(await s.list('chapter',b.id))[0];assert.equal(c.status,'blocked');assert.equal(c.attempt,2);assert.deepEqual(roles,['revision_plan','repair','review','revision_plan','repair','review']);
  for(let i=0;i<10;i++)await runJobStep(s,b.id,secret,invoke);assert.equal(roles.length,6);
});
test('third directed round permits exactly its pending author call then stops after a failed review',async()=>{
  const {s,b,c,secret}=await rework(2);await step(s,b.id,secret,fixture);assert.equal((await s.get(c.id)).attempt,3);await step(s,b.id,secret,fixture);
  await step(s,b.id,secret,async(...a)=>{const r=await fixture(...a);r.scores.commercial.score=5;return r;});assert.equal((await s.get(c.id)).status,'blocked');
  const saved=await s.get(c.id);for(let i=0;i<20;i++)await assert.rejects(startEditorRevision(s,{id:c.id,revision:saved.revision,baseHash:saved.hash,key:crypto.randomUUID(),instruction:''}),/三轮返修已用尽/);
});
test('director cannot invent an issue or change the source hash; invalid paid result stops before author',async()=>{
  for(const wrongHash of [false,true]){const {s,b,c,secret}=await rework();const roles=[];
    await assert.rejects(step(s,b.id,secret,async(...a)=>{roles.push(a[4]);return {baseHash:wrongHash?'SYNTHETIC stale':c.hash,diagnosis:'SYNTHETIC',tasks:[{issueId:'SYNTHETIC invented issue',change:'SYNTHETIC',acceptance:'SYNTHETIC'}]};}),/哈希不符|真实问题来源/);
    assert.deepEqual(roles,['revision_plan']);const saved=await s.get(c.id);assert.equal(saved.content,c.content);assert.equal(saved.attempt,1);assert.equal(saved.lease,null);assert.ok(saved.modelCandidate);
  }
});
test('saving an unchanged body or only its title preserves failed review instead of charging to grade again',async()=>{
  const {s,c}=await rework(3);let saved=await saveChapter(s,{id:c.id,revision:c.revision,title:c.title,content:c.content});assert.equal(saved.status,'rework');assert.deepEqual(saved.gate,c.gate);
  saved=await saveChapter(s,{id:c.id,revision:saved.revision,title:'SYNTHETIC new title',content:c.content});assert.deepEqual(saved.review,c.review);assert.equal(saved.hash,c.hash);assert.equal(saved.attempt,3);
});
test('director has a small bounded non-thinking JSON call on the planner route',async()=>{
  const s=fresh();await configured(s);const spec=callSpec(await config(s),'SYNTHETIC','revision_plan');assert.equal(spec.route.slot,'planner');assert.equal(spec.maxTokens,2000);assert.equal(spec.body.thinking.type,'disabled');
});
test('high scores cannot bypass an unfinished director task, and fabricated acceptance quotes stop review',async()=>{
  for(const fabricated of [false,true]){const {s,b,c,secret}=await rework();await step(s,b.id,secret,fixture);await step(s,b.id,secret,fixture);
    const invoke=async(...args)=>{const r=await fixture(...args);r.revisionChecks[0].closed=false;if(fabricated)r.revisionChecks[0].quote='SYNTHETIC fabricated quote missing from the novel';return r;};
    if(fabricated){await assert.rejects(step(s,b.id,secret,invoke),/总监任务逐项验收/);assert.notEqual((await s.get(c.id)).status,'locked');}
    else{const r=await step(s,b.id,secret,invoke);assert.equal(r.chapter.gate.score,89);assert.equal(r.chapter.gate.pass,false);assert.ok(r.chapter.gate.issues.some(i=>i.code==='DIRECTOR_OPEN_TASK'));}
  }
});

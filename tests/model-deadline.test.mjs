// SYNTHETIC ONLY: real SQLite and controlled clocks; no supplier calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,book,configured,fixture} from './workflow-support.mjs';
import {callSpec,defaults,modelCall} from '../lib/model.mjs';
import {config,step} from '../lib/engine.mjs';
import {startJob,runJobStep,tickRunner,pauseJob} from '../lib/jobs.mjs';
import {MODEL_REQUEST_TIMEOUT_MS,CONNECTION_REQUEST_TIMEOUT_MS,STALE_CALL_MS} from '../lib/execution-policy.mjs';

test('DeepSeek结构请求显式保留低强度思考和JSON模式，正文与连接关闭思考',()=>{
  for(const role of ['plan','plan_batch','contract','review','opening_review','arc_review','style_analysis','style_review']){
    const {body}=callSpec(defaults,'SYNTHETIC JSON',role);
    assert.deepEqual(body.thinking,{type:'enabled'});
    assert.equal(body.reasoning_effort,'low');
    assert.deepEqual(body.response_format,{type:'json_object'});
  }
  for(const role of ['write','repair','rewrite','connection','connection_writer','connection_review']){
    const {body}=callSpec(defaults,'SYNTHETIC JSON',role);
    assert.deepEqual(body.thinking,{type:'disabled'});
    assert.equal(body.reasoning_effort,undefined);
  }
  assert.equal(callSpec({...defaults,provider:'qwen',model:'SYNTHETIC'},'JSON','plan').body.reasoning_effort,undefined);
});

test('长章节结构输出不再被6000/8000预设截断，仍遵守用户token上限和费用预留',async()=>{
  for(const role of ['plan','plan_batch','contract','review','opening_review','arc_review']){
    assert.equal(callSpec(defaults,'SYNTHETIC JSON',role).maxTokens,16000);
    assert.equal(callSpec({...defaults,maxOutputTokens:3000},'SYNTHETIC JSON',role).maxTokens,3000);
  }
  const s=fresh(),b=await book(s),secret=await configured(s,{taskLimit:.01});let sent=0;
  try{
    await assert.rejects(modelCall(s,await config(s),b,'SYNTHETIC JSON','contract',secret,async()=>{sent++;}),/超过单次上限/);
    assert.equal(sent,0);assert.equal((await s.cost(b.id)).calls.length,0);
  }finally{s.db.conn.close();}
});

test('真实SQLite记录超时预留且不重发，创作和连接使用各自截止时间',async t=>{
  let deadline;
  t.mock.method(AbortSignal,'timeout',ms=>{deadline=ms;return new AbortController().signal;});
  for(const role of ['plan','connection']){
    const s=fresh(),b=await book(s),secret=await configured(s);let sent=0;
    try{
      await assert.rejects(modelCall(s,await config(s),b,'SYNTHETIC JSON',role,secret,async()=>{sent++;throw new DOMException('SYNTHETIC timeout','TimeoutError');}),role==='plan'?/超过5分钟.*未自动重试/:/超过60秒.*未自动重试/);
      assert.equal(deadline,role==='plan'?MODEL_REQUEST_TIMEOUT_MS:CONNECTION_REQUEST_TIMEOUT_MS);
      assert.equal(sent,1);const cost=await s.cost(b.id);
      assert.equal(cost.calls.length,1);assert.equal(cost.calls[0].status,'uncertain');
      assert.equal(cost.total,cost.calls[0].data.reserved);
    }finally{s.db.conn.close();}
  }
});

test('超过旧100秒截止时间后仍保护检查点、任务和费用，不会并发重发；暂停可保留在途结果',async t=>{
  let clock=Date.now();t.mock.method(Date,'now',()=>clock);
  const s=fresh(),b=await book(s),secret=await configured(s);let calls=0,release,entered;
  const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
  await startJob(s,b.id,3);
  const running=runJobStep(s,b.id,secret,async(...args)=>{calls++;entered();await gate;return fixture(...args);});
  try{
    await started;
    await s.db.prepare('INSERT INTO calls (id,owner,book,month,amount,status,data,created) VALUES (?,?,?,?,?,?,?,?)').bind('SYNTHETIC_SLOW',s.owner,b.id,'2026-10',100,'reserved','{}',clock).run();
    clock+=160000;
    assert.ok((await s.get(b.id)).lease.until>clock);
    assert.ok((await s.get(b.id+':job')).lease.until>clock);
    await assert.rejects(step(s,b.id,secret,fixture),/接管/);
    const tick=await tickRunner(s.db,secret,fixture);
    assert.equal(tick.advanced,false);assert.equal(calls,1);
    assert.equal((await s.cost(b.id)).calls[0].status,'reserved');
    await pauseJob(s,b.id);release();await running;
    assert.ok((await s.get(b.id)).plan);assert.equal((await s.get(b.id)).status,'paused');
    assert.equal((await s.get(b.id+':job')).status,'paused');
    await tickRunner(s.db,secret,fixture);assert.equal(calls,1);
    clock+=STALE_CALL_MS;
    await tickRunner(s.db,secret,fixture);
    assert.equal((await s.cost(b.id)).calls[0].status,'uncertain');
  }finally{release();await running;s.db.conn.close();}
});

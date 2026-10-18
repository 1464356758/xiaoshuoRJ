// SYNTHETIC ONLY: real SQLite, fake story and model output.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from './workflow-support.mjs';
import {craftFixture} from './craft-support.mjs';
import {createBook,step} from '../lib/engine.mjs';
import {configured} from './workflow-support.mjs';
import {modelCall} from '../lib/model.mjs';
import {bindContractFacts} from '../lib/story-context.mjs';

test('截断或无效JSON的付费响应保存在私有检查点，费用已知结算且不自动重发',async()=>{
  for(const finishReason of ['length','stop']){
    const s=fresh();try{
      const b=await createBook(s,{title:'SYNTHETIC partial response',totalChapters:3,targetWords:1000},crypto.randomUUID());
      const secret=await configured(s);await step(s,b.id,secret,craftFixture);let sent=0;
      const partial='{"SYNTHETIC incomplete":';
      await assert.rejects(step(s,b.id,secret,async(...args)=>modelCall(...args,async(url,options)=>{
        sent++;assert.equal(JSON.parse(options.body).max_tokens,16000);
        return Response.json({choices:[{message:{content:partial},finish_reason:finishReason}],usage:{prompt_tokens:10,completion_tokens:20}});
      })),finishReason==='length'?/16000 token.*截断/:/JSON格式不完整/);
      const c=(await s.list('chapter',b.id))[0];
      assert.equal(c.status,'contract');assert.equal(c.content,'');assert.equal(c.lease,null);
      assert.equal(c.modelCandidate.content,partial);assert.equal(c.modelCandidate.role,'contract');
      assert.equal(c.modelCandidate.finishReason,finishReason);
      assert.equal((await s.cost(b.id)).calls[0].status,'settled');
      assert.equal(sent,1);assert.equal((await s.get(b.id)).plan.facts['权限'],'无');
    }finally{s.db.conn.close();}
  }
});

test('状态变化起点由当前账本精确填入，未知状态为null，不修改输入或覆盖旧协议显式起点',()=>{
  const input={requiredDelta:[{key:'SYNTHETIC known',to:'next'},{key:'SYNTHETIC new',to:'created'},{key:'SYNTHETIC legacy',from:'explicit',to:'next'}]};
  const memory={facts:{'SYNTHETIC known':false}};
  const bound=bindContractFacts(input,memory);
  assert.deepEqual(bound.requiredDelta.map(d=>d.from),[false,null,'explicit']);
  assert.equal(Object.hasOwn(input.requiredDelta[0],'from'),false);
  assert.notEqual(bound,input);assert.equal(bindContractFacts(null,memory),null);
});

test('新协议只提key/to，真实SQLite使用账本起点保存完整任务书',async()=>{
  const s=fresh();try{
    const b=await createBook(s,{title:'SYNTHETIC binding',totalChapters:3,targetWords:1000},crypto.randomUUID());
    await step(s,b.id,'',craftFixture);
    const result=await step(s,b.id,'',async(...args)=>{
      const c=await craftFixture(...args);
      assert.match(args[3],/不生成from/);
      c.requiredDelta=[{key:'权限',to:'SYNTHETIC next'},{key:'SYNTHETIC new state',to:'created'}];
      return c;
    });
    assert.equal(result.phase,'contract');assert.equal(result.chapter.status,'writing');
    assert.deepEqual(result.chapter.contract.requiredDelta,[{key:'权限',to:'SYNTHETIC next',from:'无'},{key:'SYNTHETIC new state',to:'created',from:null}]);
    assert.equal(result.chapter.contractCandidate,null);
    assert.equal((await s.get(b.id)).plan.facts['权限'],'无');
  }finally{s.db.conn.close();}
});

test('错误的显式起点仍拒绝，保留未通过的候选且不覆盖既有事实或自动重跑策划',async()=>{
  const s=fresh();try{
    const b=await createBook(s,{title:'SYNTHETIC mismatch',totalChapters:3,targetWords:1000},crypto.randomUUID());
    await step(s,b.id,'',craftFixture);const before=await s.get(b.id);let calls=0;
    await assert.rejects(step(s,b.id,'',async(...args)=>{calls++;const c=await craftFixture(...args);c.requiredDelta=[{key:'权限',from:'SYNTHETIC false past',to:'next'}];return c;}),/事实不一致/);
    const c=(await s.list('chapter',b.id))[0];
    assert.equal(c.status,'contract');assert.equal(c.lease,null);assert.equal(c.contract,undefined);
    assert.equal(c.contractCandidate.response.requiredDelta[0].from,'SYNTHETIC false past');
    assert.match(c.contractCandidate.error,/事实不一致/);
    assert.equal(calls,1);assert.deepEqual((await s.get(b.id)).plan,before.plan);
    await assert.rejects(step(s,b.id,'',async(...a)=>{calls++;return craftFixture(...a);}),/已经发送过一次请求/);assert.equal(calls,1);
    assert.equal((await s.get(c.id)).contractCandidate.response.requiredDelta[0].from,'SYNTHETIC false past');
  }finally{s.db.conn.close();}
});

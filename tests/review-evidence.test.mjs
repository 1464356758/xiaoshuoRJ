// SYNTHETIC ONLY: real SQLite; no provider requests or unpublished fiction.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,book,fixture,synthetic,review} from './workflow-support.mjs';
import {step,config,acceptReviewCandidate} from '../lib/engine.mjs';
import {Store,hash} from '../lib/store.mjs';
import {evidenceCatalog,hydrateReviewEvidence,reviewMemory} from '../lib/review-evidence.mjs';
import {reviewPrompt} from '../lib/prompts.mjs';

test('证据目录覆盖全部原文，编号还原精确片段，旧章编号不能冒充本章或其他章',()=>{
  const text='SYNTHETIC first line\n\n'+synthetic(2200,760),source={chapter:2,hash:'SYNTHETIC_SOURCE_HASH',start:17,text:'SYNTHETIC earlier source line'};
  const rows=evidenceCatalog(text);assert.equal(rows.map(r=>r.quote).join(''),text.replaceAll('\n',''));
  const sourceId=reviewMemory({source:[source]}).source[0].text.match(/^\[([^\]]+)\]/)[1];
  const input={scores:{commercial:{quoteId:rows[0].id,score:10}},antiLoop:{comparisons:[{chapter:2,currentQuoteId:rows[1].id,pastQuoteId:sourceId}]}},result=hydrateReviewEvidence(input,{content:text},{source:[source]});
  assert.equal(result.scores.commercial.quote,rows[0].quote);assert.equal(result.antiLoop.comparisons[0].pastQuote,source.text);assert.equal(input.scores.commercial.quoteId,rows[0].id);
  for(const bad of [
    {quoteId:'E9999'}, {quoteId:sourceId}, {quoteId:rows[0].id,quote:'SYNTHETIC paraphrased'},
    {antiLoop:{comparisons:[{chapter:3,pastQuoteId:sourceId}]}}
  ])assert.throws(()=>hydrateReviewEvidence(bad,{content:text},{source:[source]}),/编号|冲突/);
});

async function reviewing(s){
  const b=await book(s,1000,3);await step(s,b.id,'',fixture);await step(s,b.id,'',fixture);await step(s,b.id,'',fixture);
  const c=(await s.list('chapter',b.id))[0];assert.equal(c.status,'reviewing');return {b,c};
}
function referencedReview(c){
  const result=review(c,c.number),rows=evidenceCatalog(c.content);
  for(const entry of Object.values(result.scores)){delete entry.quote;entry.quoteId=rows[0].id;}
  for(const entry of result.changes){delete entry.quote;entry.quoteId=rows[0].id;}
  result.sceneEvidence.forEach((e,i)=>{delete e.quote;e.quoteId=rows[i].id;});return result;
}

test('真实SQLite全文审核使用证据编号锁定，量表及不通过门槛不变',async()=>{
  const s=fresh();try{
    const {b,c}=await reviewing(s);const prompt=reviewPrompt(await s.get(b.id),c,{source:[]},[]);
    assert.match(prompt,/pace:\{score:0至15/);assert.match(prompt,/originality:\{score:0至10/);assert.match(prompt,/不得全部按20分制/);
    const result=await step(s,b.id,'',async()=>referencedReview(c));assert.equal(result.chapter.status,'locked');assert.equal(result.chapter.gate.score,89);
    assert.ok(c.content.includes(result.chapter.review.scores.commercial.quote));assert.equal(result.chapter.content,c.content);
  }finally{s.db.conn.close();}
});

test('超量表分数不会截断或换算成通过，完整付费响应和基稿哈希保留',async()=>{
  const s=fresh();try{
    const {b,c}=await reviewing(s),response=referencedReview(c);response.scores.originality.score=18;
    await assert.rejects(step(s,b.id,'',async()=>response),/原文证据无效/);
    const saved=await s.get(c.id);assert.equal(saved.status,'reviewing');assert.equal(saved.content,c.content);assert.equal(saved.lease,null);
    assert.equal(saved.modelCandidate.response.scores.originality.score,18);assert.equal(saved.modelCandidate.sourceHash,c.hash);
  }finally{s.db.conn.close();}
});

test('已保存完整审核可免费重验且不跳过质量门，陈旧稿、上下文和他人均拒绝',async()=>{
  for(const mode of ['valid','low_score','hash','context','owner']){
    const s=fresh();try{
      const {b,c}=await reviewing(s),response=referencedReview(c),cfg=await config(s);
      if(mode==='low_score')response.scores.commercial.score=8;
      const candidate={parsed:true,role:'review',response,sourceHash:mode==='hash'?'SYNTHETIC old hash':c.hash,bookId:b.id,chapterNumber:c.number,planRevision:b.planRevision||0,styleRevision:0,platformHash:null,configRevision:cfg.revision||0};
      if(mode==='context')candidate.planRevision++;
      await s.save(c,{...c,attempt:3,modelCandidate:candidate});const before=await s.cost(b.id);
      if(['hash','context','owner'].includes(mode))await assert.rejects(acceptReviewCandidate(mode==='owner'?new Store(s.db,'SYNTHETIC OTHER OWNER'):s,c.id),/不存在|完整审核|上下文/);
      else {const result=await acceptReviewCandidate(s,c.id);assert.equal(result.chapter.status,mode==='valid'?'locked':'blocked');assert.equal(result.chapter.attempt,3);if(mode==='low_score')assert.ok(result.chapter.gate.issues.some(i=>i.code==='CORE_SCORE'));}
      const saved=await s.get(c.id);assert.equal(saved.content,c.content);assert.equal(saved.hash,await hash(c.content));assert.equal(saved.lease,null);assert.deepEqual(await s.cost(b.id),before);
    }finally{s.db.conn.close();}
  }
});

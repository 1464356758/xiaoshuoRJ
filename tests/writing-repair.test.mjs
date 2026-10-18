// SYNTHETIC ONLY: real SQLite, generated protocol text, no supplier requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,book,fixture,synthetic} from './workflow-support.mjs';
import {step} from '../lib/engine.mjs';
import {hash} from '../lib/store.mjs';
import {count} from '../lib/quality.mjs';
import {fragmentWordBudget} from '../lib/writing-budget.mjs';
import {applyRepair} from '../lib/repairs.mjs';

test('后续场景按已保存汉字数分配篇幅，不裁剪旧段落或遗漏场景',()=>{
  const b={targetWords:9000},c={contract:{scenes:Array(6).fill({})},chunks:[],content:''};
  assert.equal(fragmentWordBudget(b,c).target,1500);
  c.content=synthetic(1,1800);c.chunks=[c.content];
  assert.deepEqual(fragmentWordBudget(b,c),{target:1440,savedWords:1800,remainingWords:7200,remainingScenes:5});
  c.content=synthetic(2,7800);c.chunks=Array(5).fill('SYNTHETIC saved');
  assert.equal(fragmentWordBudget(b,c).target,1200);
  c.content=synthetic(3,9500);assert.equal(fragmentWordBudget(b,c).target,900);
  assert.equal(count(c.content),9500);
});

test('短句锚点在真实SQLite原稿中定位，保留未改文字与旧稿哈希',async()=>{
  const s=fresh();try{
    const text=synthetic(12,1600),c=await s.create('chapter',{content:text,hash:await hash(text)},'SYNTHETIC book');
    const before=text.slice(300,600),after=synthetic(13,180);
    const patch=await applyRepair(c,{baseHash:c.hash,patches:[{startQuote:before.slice(0,24),endQuote:before.slice(-24),after}]});
    const saved=await s.save(c,{...c,content:patch.content,hash:patch.hash});
    assert.equal(saved.content,text.slice(0,300)+after+text.slice(600));
    assert.equal(saved.hash,await hash(saved.content));assert.equal(c.content,text);
    assert.equal(patch.patchCount,1);
  }finally{s.db.conn.close();}
});

test('锚点重复、反序、范围过长、重叠或基稿变化均拒绝，原稿不变',async()=>{
  const s=fresh();try{
    const marker='SYNTHETIC repeated anchor',text=marker+synthetic(44,5200)+marker;
    const c=await s.create('chapter',{content:text,hash:await hash(text)},'SYNTHETIC book');
    const anchor=(start,end)=>({startQuote:text.slice(start,start+24),endQuote:text.slice(end-24,end),after:''});
    for(const patches of [
      [{startQuote:marker,endQuote:text.slice(200,224),after:''}],
      [anchor(800,400)],
      [anchor(100,4800)],
      [anchor(100,400),anchor(300,600)]
    ])await assert.rejects(applyRepair(c,{baseHash:c.hash,patches}),/定位|范围/);
    await assert.rejects(applyRepair(c,{baseHash:'0'.repeat(64),patches:[anchor(100,200)]}),/哈希/);
    assert.equal((await s.get(c.id)).content,text);
  }finally{s.db.conn.close();}
});

test('仅超字数时返回空替换的短句删除补丁，真实工作流保留版本并进入全文审核',async()=>{
  const s=fresh();try{
    const b=await book(s,1000,3);await step(s,b.id,'',fixture);await step(s,b.id,'',fixture);
    let c=(await s.list('chapter',b.id))[0];
    const cut=synthetic(142,400),content=synthetic(141,600)+'\n\n'+cut+'\n\n'+synthetic(143,400);
    c=await s.save(c,{...c,content,chunks:[content],hash:await hash(content),status:'reviewing'});
    const preflight=await step(s,b.id,'',fixture);assert.equal(preflight.phase,'text_preflight');
    const repaired=await step(s,b.id,'',async(st,cfg,bk,prompt,role)=>{
      assert.equal(role,'repair');assert.match(prompt,/每处after必须为空字符串/);assert.match(prompt,/startQuote/);
      return {baseHash:c.hash,patches:[{startQuote:cut.slice(0,24),endQuote:cut.slice(-24),after:''}],resolved:['PRE-1']};
    });
    assert.equal(repaired.chapter.status,'reviewing');assert.equal(count(repaired.chapter.content),1000);
    assert.equal(repaired.chapter.attempt,1);assert.ok(repaired.chapter.content.startsWith(synthetic(141,600)));
    const versions=await s.list('version',b.id);assert.ok(versions.some(v=>v.content===content));
    const reviewed=await step(s,b.id,'',fixture);assert.equal(reviewed.chapter.status,'locked');
  }finally{s.db.conn.close();}
});

test('尾段目标缩短后使用同一篇幅预算验完整性，保存已有五段与新尾段',async()=>{
  const s=fresh();try{
    const b=await book(s,9000,3);await step(s,b.id,'',fixture);await step(s,b.id,'',fixture);
    let c=(await s.list('chapter',b.id))[0];const chunks=Array.from({length:5},(_,i)=>synthetic(500+i,1620));
    const content=chunks.join('\n\n');c=await s.save(c,{...c,chunks,content,hash:await hash(content)});
    const tail=synthetic(510,600);
    const result=await step(s,b.id,'',async(st,cfg,bk,prompt,role)=>{assert.equal(role,'write');assert.match(prompt,/本段目标900汉字/);return {text:tail,sceneComplete:true};});
    assert.equal(result.chapter.status,'reviewing');assert.equal(result.chapter.chunks.length,6);
    assert.ok(result.chapter.content.startsWith(content));assert.equal(count(result.chapter.content),8700);
    assert.equal(result.chapter.hash,await hash(result.chapter.content));
  }finally{s.db.conn.close();}
});

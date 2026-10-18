// SYNTHETIC ONLY. Real SQLite; fake supplier HTTP, never a real key or model.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,book,configured} from './workflow-support.mjs';
import {config,settings} from '../lib/engine.mjs';
import {modelCall} from '../lib/model.mjs';
import {pauseJob} from '../lib/jobs.mjs';
import {callAudit} from '../lib/call-audit.mjs';
import {Store} from '../lib/store.mjs';
const reply=()=>Response.json({id:'SYNTHETIC-provider-id',choices:[{message:{content:'{"ok":true}'},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1}},{headers:{'x-request-id':'SYNTHETIC-request-id'}});

test('server maintenance lock rejects every role before reservation or HTTP',async()=>{
  const s=fresh(),b=await book(s),secret=await configured(s),cfg=await config(s);let network=0;const prior=process.env.NOVEL_MODEL_API_DISABLED;
  try{process.env.NOVEL_MODEL_API_DISABLED='1';for(const role of ['plan','write','repair','rewrite','review','connection','connection_writer','connection_review','github'])await assert.rejects(modelCall(s,cfg,b,'SYNTHETIC',role,secret,async()=>{network++;}),/维护停用/);assert.equal(network,0);assert.equal((await callAudit(s)).totalCalls,0);}
  finally{if(prior===undefined)delete process.env.NOVEL_MODEL_API_DISABLED;else process.env.NOVEL_MODEL_API_DISABLED=prior;}
});

test('pause aborts the actual pending model transport and preserves an uncertain paid reservation',async()=>{
  const s=fresh(),b=await book(s),secret=await configured(s);let entered,signal;const ready=new Promise(r=>entered=r);
  const running=modelCall(s,await config(s),b,'SYNTHETIC','plan',secret,async(_url,options)=>{signal=options.signal;entered();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});
  const stopped=assert.rejects(running,/本人已停止/);await ready;await pauseJob(s,b.id);await stopped;assert.equal(signal.aborted,true);assert.equal((await s.cost(b.id)).calls[0].status,'uncertain');
});
test('a request registered during the stop transaction is also cancelled before stop returns',{timeout:2000},async()=>{
  const s=fresh(),b=await book(s),secret=await configured(s),cfg=await config(s),save=s.save.bind(s);let pending,check,signal;
  s.save=async(record,value)=>{if(record.id===b.id&&value.status==='paused'){
    let entered;const ready=new Promise(r=>entered=r);pending=modelCall(s,cfg,b,'SYNTHETIC','plan',secret,async(_u,opt)=>{signal=opt.signal;entered();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});check=assert.rejects(pending,/本人已停止/);await ready;
  }return save(record,value);};
  await pauseJob(s,b.id);await check;assert.equal(signal.aborted,true);
});

test('disabling spending aborts in-flight calls for all books of the same owner',async()=>{
  const s=fresh(),a=await book(s),b=await book(s),secret=await configured(s),cfg=await config(s);const signals=[];let entered;const ready=new Promise(r=>entered=r);
  const invoke=async(_url,options)=>{signals.push(options.signal);if(signals.length===2)entered();return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));};
  const checks=[assert.rejects(modelCall(s,cfg,a,'SYNTHETIC','plan',secret,invoke),/本人已停止/),assert.rejects(modelCall(s,cfg,b,'SYNTHETIC','plan',secret,invoke),/本人已停止/)];
  await ready;await settings(s,{revision:cfg.revision,spendEnabled:false},secret);await Promise.all(checks);assert.ok(signals.every(s=>s.aborted));assert.equal((await config(s)).spendEnabled,false);
});

test('atomic per-owner minute cap limits concurrent requests, including connection tests and other books',async()=>{
  const s=fresh(),a=await book(s),b=await book(s),secret=await configured(s),cfg=await config(s);let http=0;
  const results=await Promise.allSettled(Array.from({length:20},(_,i)=>modelCall(s,cfg,i%2?a:b,'SYNTHETIC',i%2?'connection':'write',secret,async()=>{http++;return reply();})));
  assert.equal(http,6);assert.equal(results.filter(r=>r.status==='fulfilled').length,6);assert.equal((await callAudit(s)).totalCalls,6);
  const audit=await callAudit(s);assert.ok(audit.calls.every(c=>c.providerRequestId==='SYNTHETIC-request-id'));
});

test('hour cap counts all books and connection-test ledgers before HTTP',async()=>{
  const s=fresh(),b=await book(s),secret=await configured(s),now=Date.now();for(let i=0;i<60;i++)await s.db.prepare('INSERT INTO calls (id,owner,book,month,amount,status,data,created) VALUES (?,?,?,?,?,?,?,?)').bind('SYNTHETIC-'+i,s.owner,'SYNTHETIC-deleted-or-test','2026-10',1,'settled','{}',now-120000).run();
  let http=0;await assert.rejects(modelCall(s,await config(s),b,'SYNTHETIC','write',secret,async()=>{http++;return reply();}),/频率/);assert.equal(http,0);
});

test('invalid key or network failure trips spending off and cannot be repeatedly tested',async()=>{
  for(const networkError of [false,true]){
    const s=fresh(),b=await book(s),secret=await configured(s);let http=0;
    await assert.rejects(modelCall(s,await config(s),b,'SYNTHETIC','connection',secret,async()=>{http++;if(networkError)throw new Error('SYNTHETIC network failure');return new Response('{}',{status:401});}),/HTTP 401|network failure/);
    assert.equal((await config(s)).spendEnabled,false);
    await assert.rejects(modelCall(s,await config(s),b,'SYNTHETIC','connection',secret,async()=>{http++;return reply();}),/尚未开启/);assert.equal(http,1);
  }
});

test('default chapter ceiling is two yuan and blocks a paid call before HTTP',async()=>{
  const s=fresh(),b=await book(s),secret=await configured(s,{chapterLimit:null}),now=Date.now();
  await s.db.prepare('INSERT INTO calls (id,owner,book,month,amount,status,data,created) VALUES (?,?,?,?,?,?,?,?)').bind('SYNTHETIC-prior',s.owner,b.id,'2026-10',1999999,'settled','{"chapter":1}',now-120000).run();
  let http=0;await assert.rejects(modelCall(s,await config(s),{...b,activeChapter:1},'SYNTHETIC','write',secret,async()=>{http++;return reply();}),/额度不足/);assert.equal(http,0);
});

test('account audit includes connection tests and missing books, while excluding every other owner and secret',async()=>{
  const s=fresh(),b=await book(s),secret=await configured(s);await modelCall(s,await config(s),b,'SYNTHETIC','write',secret,async()=>reply());
  await s.db.prepare('INSERT INTO calls (id,owner,book,month,amount,status,data,created) VALUES (?,?,?,?,?,?,?,?)').bind('SYNTHETIC-test',s.owner,'SYNTHETIC-connection-test','2026-10',123,'uncertain','{"role":"connection","secret":"SYNTHETIC NEVER EXPOSE"}',Date.now()).run();
  const other=new Store(s.db,'another-owner');await other.db.prepare('INSERT INTO calls (id,owner,book,month,amount,status,data,created) VALUES (?,?,?,?,?,?,?,?)').bind('SYNTHETIC-foreign',other.owner,'SYNTHETIC','2026-10',999,'settled','{}',Date.now()).run();
  const a=await callAudit(s);assert.equal(a.totalCalls,2);assert.equal(a.lastHour.count,2);assert.equal(a.byBook.length,2);assert.equal(JSON.stringify(a).includes('NEVER EXPOSE'),false);assert.equal(JSON.stringify(a).includes('another-owner'),false);
});

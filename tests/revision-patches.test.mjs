// SYNTHETIC ONLY: deterministic text and local proofs, no real manuscript or API.
import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../lib/store.mjs';
import {synthetic} from './workflow-support.mjs';
import {applyRevisionPatches,auditRevisionPatchChecks,validateRevisionEdits,revisionPatchPrompt} from '../lib/revision-patches.mjs';
async function chapter(){const content=synthetic(41,1000),digest=await hash(content);return {number:1,content,hash:digest,directorTask:{protocol:2,status:'planned',sourceHash:digest,tasks:[{issueId:'I-1',change:'SYNTHETIC change a real condition',acceptance:'SYNTHETIC observable condition'}]}};}
const response=c=>({baseHash:c.hash,patches:[{before:c.content.slice(0,40),after:synthetic(52,40),issueIds:['I-1']}],unresolved:[]});

test('one anchored patch preserves every untouched character and records canonical before/after proof',async()=>{
 const c=await chapter(),out=response(c);delete out.patches[0].before;out.patches[0].startQuote=c.content.slice(0,15);out.patches[0].endQuote=c.content.slice(25,40);
 const result=await applyRevisionPatches(c,out,1000);assert.equal(result.content.slice(40),c.content.slice(40));assert.notEqual(result.hash,c.hash);assert.equal(result.revisionEdits.patches[0].before,c.content.slice(0,40));assert.equal(result.revisionEdits.patches[0].afterStart,0);assert.deepEqual(result.revisionEdits.patches[0].issueIds,['I-1']);
 await validateRevisionEdits({...c,...result},[{...c}],1000);
 const prompt=revisionPatchPrompt({targetWords:1000},c,{});assert.match(prompt,/只进行这一次请求/);assert.match(prompt,/不返回整章全文/);assert.match(prompt,/不得提前兑现后续章节/);
});

test('an unchanged old paragraph cannot be cited as newly improved even with a valid patch ID',async()=>{
 const c=await chapter(),changed=await applyRevisionPatches(c,response(c),1000),current={...c,...changed,directorTask:{...c.directorTask,status:'written'}};
 const stale={revisionChecks:[{issueId:'I-1',closed:true,patchIds:['P1'],quote:current.content.slice(100,112),reason:'SYNTHETIC false claim of a new condition'}]};
 const audited=auditRevisionPatchChecks(current,stale);assert.equal(audited.revisionChecks[0].closed,false);assert.equal(audited.revisionChecks[0].modelClosed,true);assert.equal(audited.revisionChecks[0].evidenceMismatch,true);
 const valid=structuredClone(stale);valid.revisionChecks[0].quote=current.content.slice(0,12);assert.equal(auditRevisionPatchChecks(current,valid).revisionChecks[0].closed,true);
 valid.revisionChecks[0].patchIds=['P99'];assert.equal(auditRevisionPatchChecks(current,valid).revisionChecks[0].closed,false);
 const copied=response(c);copied.patches[0].after=c.content.slice(0,12)+synthetic(80,28);const result=await applyRevisionPatches(c,copied,1000),copyCurrent={...c,...result,directorTask:{...c.directorTask,status:'written'}};
 assert.equal(auditRevisionPatchChecks(copyCurrent,{revisionChecks:[{issueId:'I-1',closed:true,patchIds:['P1'],quote:c.content.slice(0,12),reason:'SYNTHETIC old content inside a replaced paragraph'}]}).revisionChecks[0].closed,false);
 assert.equal(auditRevisionPatchChecks({...current,revisionEdits:null},stale).revisionChecks[0].closed,false);
});

test('deletion proof must cite the real joining boundary, not a remote unchanged sentence',async()=>{
 const c=await chapter(),out={baseHash:c.hash,patches:[{before:c.content.slice(100,130),after:'',issueIds:['I-1']}],unresolved:[]},result=await applyRevisionPatches(c,out,1000),current={...c,...result,directorTask:{...c.directorTask,status:'written'}};
 const review={revisionChecks:[{issueId:'I-1',closed:true,patchIds:['P1'],quote:current.content.slice(90,110),reason:'SYNTHETIC removed repetition'}]};assert.equal(auditRevisionPatchChecks(current,review).revisionChecks[0].closed,true);
 review.revisionChecks[0].quote=current.content.slice(200,212);assert.equal(auditRevisionPatchChecks(current,review).revisionChecks[0].closed,false);
});

test('old full rewrites, unbound tasks, oversized edits and cosmetic changes are refused without changing the draft',async()=>{
 const c=await chapter(),original=c.content;
 await assert.rejects(applyRevisionPatches(c,{text:synthetic(8,1100)},1000),/返回了整章全文/);
 const missing=response(c);missing.patches[0].issueIds=['invented'];await assert.rejects(applyRevisionPatches(c,missing,1000),/真实总监任务/);
 const stale=response(c);stale.baseHash='stale';await assert.rejects(applyRevisionPatches(c,stale,1000),/基稿哈希/);
 const cosmetic=response(c);cosmetic.patches[0].after=cosmetic.patches[0].before+'。';await assert.rejects(applyRevisionPatches(c,cosmetic,1000),/形式变化/);
 const long=response(c);long.patches[0].after=synthetic(7,300);await assert.rejects(applyRevisionPatches(c,long,1000),/要求900至1120/);
 assert.equal(c.content,original);
});

test('backup verification reconstructs the exact text and rejects forged edit or source proofs',async()=>{
 const c=await chapter(),result=await applyRevisionPatches(c,response(c),1000),current={...c,...result};
 const forged=structuredClone(current);forged.revisionEdits.patches[0].after='SYNTHETIC forged improvement';await assert.rejects(validateRevisionEdits(forged,[c],1000),/实际正文不一致/);
 await assert.rejects(validateRevisionEdits(current,[],1000),/真实基稿/);
});

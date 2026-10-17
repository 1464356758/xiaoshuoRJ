import {assertIdle} from './engine.mjs';
import {hash} from './store.mjs';
import {draftFromPlan} from './planning.mjs';
import {openingFingerprint,arcFingerprint} from './acceptance.mjs';
import {bindPlatform} from './platform-policy.mjs';
import {copyStyleRecords} from './style-workbench.mjs';
export async function forkRevision(store,id,fromChapter,key,options={}) {
  if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{12,80}$/.test(key))throw new Error('修订副本缺少幂等标识');
  if(options.preserveDraft!==undefined&&typeof options.preserveDraft!=='boolean')throw new Error('保留稿件选项无效');
  const preserveDraft=options.preserveDraft===true;
  await assertIdle(store,id);
  const source=await store.get(id),chapters=(await store.list('chapter',id)).sort((a,b)=>a.number-b.number);
  if(!source||source.kind!=='book')throw new Error('作品不存在');
  if(source.restoreComplete===false)throw new Error('请先完成备份恢复再建立修订副本');
  if(source.revisionComplete===false)throw new Error('修订副本建立尚未完成，请从原作品重新建立副本');
  if(!Number.isInteger(fromChapter)||fromChapter<1||fromChapter>source.totalChapters)throw new Error('修订起始章无效');
  if(source.lease?.until>Date.now()||chapters.some(c=>c.lease?.until>Date.now()))throw new Error('请等待在途检查点保存');
  const prefix=chapters.filter(c=>c.number<fromChapter),candidate=preserveDraft?chapters.find(c=>c.number===fromChapter&&c.content):null;
  if(prefix.length!==fromChapter-1||prefix.some((c,i)=>c.number!==i+1||c.status!=='locked'||!c.gate?.pass))throw new Error('只能保留连续的已定稿前缀');
  for(const c of [...prefix,...(candidate?[candidate]:[])])if(c.hash!==await hash(c.content))throw new Error('原稿校验失败，停止建立副本');
  const fingerprint=await hash(JSON.stringify({fromChapter,preserveDraft,revision:source.revision,plan:source.plan,planningDraft:source.planningDraft,chapters:chapters.map(c=>({number:c.number,revision:c.revision,hash:c.hash}))}));
  const targetId=store.owner+':revision:'+key;
  let copy=await store.get(targetId);
  if(copy?.revisionSource?.fingerprint!==undefined&&copy.revisionSource.fingerprint!==fingerprint)throw new Error('建立副本期间原稿或修订选项发生变化，请保留原稿并重新发起修订');
  if(copy?.revisionComplete)return copy;
  const {id:oldId,kind,parent,revision,lease,...data}=source;
  let plan=source.plan,futurePlanInvalidFrom=null;
  if(plan&&plan.contracts.length>fromChapter){
    plan={...plan,planningMode:'rolling',contracts:plan.contracts.slice(0,fromChapter)};
    try{await draftFromPlan(plan,source.totalChapters);}catch{futurePlanInvalidFrom=fromChapter+1;}
  }
  const audits=await store.list('audit',id);
  const revisionGuidance=audits.filter(a=>a.through>=fromChapter&&(!a.pass||a.gate?.issues?.length)).map(a=>({through:a.through,issues:a.report?.issues||a.issues||a.gate?.issues||[],nextAdjustment:a.report?.longRun?.nextArc||a.nextAdjustment||''})).slice(0,30);
  const first=chapters.find(c=>c.number===fromChapter);
  const chapterIssues=[...(first?.repairIssues||[]),...(first?.gate?.issues||[]),...(first?.review?.issues||[])];
  if(chapterIssues.length)revisionGuidance.unshift({chapter:fromChapter,sourceHash:first.hash,issues:chapterIssues.slice(0,100)});
  // Changing an established platform pack with a retained prefix would mix standards.
  // Only a fresh branch from chapter 1 may adopt the current pack.
  const binding=fromChapter===1&&source.platform!=='auto'?await bindPlatform(source.platform,await store.list('rule')):source.platformBinding;
  copy ||=await store.create('book',{...data,plan,futurePlanInvalidFrom,platformProtocol:fromChapter===1?1:source.platformProtocol||0,platformBinding:binding,revisionGuidance,title:source.title+'（修订副本）',status:'paused',error:null,lease:null,revisionComplete:false,revisionSource:{id,fromChapter,preserveDraft,fingerprint,createdAt:new Date().toISOString()}},'',targetId);
  for(const c of prefix) {
    const {id:cid,kind:ck,parent:cp,revision:cr,lease:cl,...body}=c;
    await store.create('chapter',{...body,lease:null},copy.id,copy.id+':chapter:'+c.number);
  }
  if(candidate){
    const {id:cid,kind:ck,parent:cp,revision:cr,lease:cl,...body}=candidate;
    const status=candidate.contract?'reviewing':'contract';
    await store.create('chapter',{...body,status,review:null,gate:null,repairIssues:[],attempt:0,error:null,lease:null,lockedAt:null,preservedDraft:true,sourceHash:candidate.hash},copy.id,copy.id+':chapter:'+fromChapter);
    await store.create('version',{number:fromChapter,title:candidate.title,content:candidate.content,hash:candidate.hash,created:new Date().toISOString(),note:'修订分支保留的起始稿，尚未通过本分支审核'},copy.id,copy.id+':chapter:'+fromChapter+':version:'+candidate.hash);
  }
  await copyStyleRecords(store,id,copy.id);
  // Reuse only wholly unaffected prefix gates with the same actual input fingerprint.
  // Failed gates and any stage touching the revision range always require new review.
  const copied=await store.list('chapter',copy.id);
  for(const a of audits){
    if(!a.pass||!a.gate?.pass||a.lease?.until>Date.now()||a.through>=fromChapter)continue;
    const isOpening=a.type==='opening';
    if(isOpening&&a.through!==3)continue;
    if(!isOpening&&(!Number.isInteger(a.through)||a.through<10||a.through%10))continue;
    const digest=isOpening?await openingFingerprint(copy,copied):await arcFingerprint(copy,copied,a.through);
    if(a.fingerprint!==digest)continue;
    const {id:aid,kind:ak,parent:ap,revision:ar,lease:al,...body}=a;
    await store.create('audit',{...body,lease:null,reusedFrom:{bookId:id,auditId:aid,fingerprint:digest}},copy.id,isOpening?copy.id+':opening':copy.id+':audit:'+a.through);
  }
  if((await store.get(id)).revision!==source.revision||JSON.stringify((await store.list('chapter',id)).sort((a,b)=>a.number-b.number).map(c=>({number:c.number,revision:c.revision,hash:c.hash})))!==JSON.stringify(chapters.map(c=>({number:c.number,revision:c.revision,hash:c.hash}))))throw new Error('原稿版本发生变化，副本保留暂停，未修改原稿');
  copy=await store.get(copy.id);
  await store.log(copy.id,'独立修订副本已建立：保留第'+fromChapter+'章之前定稿；'+(candidate?'起始章正文保留待审；':'起始章重新创作；')+'下游正文与受影响审核不混用，未改前缀验收按哈希核对复用，旧未来详纲已失效；未自动开费或启动');
  return store.save(copy,{...copy,revisionComplete:true,status:'paused'});
}

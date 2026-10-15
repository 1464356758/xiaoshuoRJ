import {assertIdle} from './engine.mjs';
import {hash} from './store.mjs';
export async function forkRevision(store,id,fromChapter,key) {
  if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{12,80}$/.test(key))throw new Error('修订副本缺少幂等标识');
  await assertIdle(store,id);
  const source=await store.get(id),chapters=(await store.list('chapter',id)).sort((a,b)=>a.number-b.number);
  if(!source||source.kind!=='book')throw new Error('作品不存在');
  if(source.restoreComplete===false)throw new Error('请先完成备份恢复再建立修订副本');
  if(source.revisionComplete===false)throw new Error('修订副本建立尚未完成，请从原作品重新建立副本');
  if(!Number.isInteger(fromChapter)||fromChapter<1||fromChapter>source.totalChapters)throw new Error('修订起始章无效');
  if(source.lease?.until>Date.now()||chapters.some(c=>c.lease?.until>Date.now()))throw new Error('请等待在途检查点保存');
  const prefix=chapters.filter(c=>c.number<fromChapter);
  if(prefix.length!==fromChapter-1||prefix.some((c,i)=>c.number!==i+1||c.status!=='locked'||!c.gate?.pass))throw new Error('只能保留连续的已定稿前缀');
  for(const c of prefix)if(c.hash!==await hash(c.content))throw new Error('原稿校验失败，停止建立副本');
  const fingerprint=await hash(JSON.stringify({revision:source.revision,plan:source.plan,planningDraft:source.planningDraft,prefix:prefix.map(c=>({number:c.number,hash:c.hash}))}));
  const targetId=store.owner+':revision:'+key;
  let copy=await store.get(targetId);
  if(copy?.revisionSource?.fingerprint!==undefined&&copy.revisionSource.fingerprint!==fingerprint)throw new Error('建立副本期间原稿发生变化，请保留原稿并重新发起修订');
  if(copy?.revisionComplete)return copy;
  const {id:oldId,kind,parent,revision,lease,...data}=source;
  copy ||=await store.create('book',{...data,title:source.title+'（修订副本）',status:'paused',error:null,lease:null,revisionComplete:false,revisionSource:{id,fromChapter,fingerprint,createdAt:new Date().toISOString()}},'',targetId);
  for(const c of prefix) {
    const {id:cid,kind:ck,parent:cp,revision:cr,lease:cl,...body}=c;
    await store.create('chapter',{...body,lease:null},copy.id,copy.id+':chapter:'+c.number);
  }
  if((await store.get(id)).revision!==source.revision)throw new Error('原稿版本发生变化，副本保留暂停，未修改原稿');
  copy=await store.get(copy.id);
  await store.log(copy.id,'已创建独立修订副本：保留第'+fromChapter+'章之前的定稿；原作品未改动；不会自动启用费用或开始任务');
  return store.save(copy,{...copy,revisionComplete:true,status:'paused'});
}

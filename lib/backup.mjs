import {createBook} from './engine.mjs';
import {hash} from './store.mjs';
import {validatePlan} from './quality.mjs';
import {validatePlanningDraft} from './planning.mjs';
export async function restoreBackup(store,b,key) {
  if(b.format!=='novel-factory-backup-v1'||!b.book||!Array.isArray(b.chapters)||b.chapters.length>300)throw new Error('备份格式无效');
  if(!Array.isArray(b.versions||[])||(b.versions||[]).length>5000)throw new Error('备份版本集过大');
  if(!Array.isArray(b.planVersions||[])||(b.planVersions||[]).length>1000)throw new Error('大纲版本集过大');
  if(b.book.plan)validatePlan(b.book.plan,b.book.totalChapters);
  if(b.book.planningDraft){if(b.book.plan||b.chapters.length)throw new Error('未完成规划不能同时包含正文或正式大纲');await validatePlanningDraft(b.book.planningDraft,b.book.totalChapters);}
  const seen=new Set();
  for(const c of b.chapters){
    if(!Number.isInteger(c.number)||c.number<1||c.number>b.book.totalChapters||seen.has(c.number)||typeof c.content!=='string'||c.content.length>90000||!['contract','writing','reviewing','rework','blocked','locked'].includes(c.status))throw new Error('备份章节结构无效');
    seen.add(c.number);
    if((c.hash&&c.hash!==await hash(c.content))||(!c.hash&&c.content))throw new Error('备份正文校验失败');
    if(c.status==='locked'&&(!c.review||!c.gate?.pass))throw new Error('备份定稿缺少审核记录');
  }
  for(const v of b.versions||[])if(typeof v.content!=='string'||v.content.length>90000||v.hash!==await hash(v.content))throw new Error('备份历史版本校验失败');
  for(const v of b.planVersions||[]){validatePlan(v.plan,b.book.totalChapters);if(!Number.isInteger(v.planRevision)||v.hash!==await hash(JSON.stringify({plan:v.plan,guidance:v.guidance,guidanceFromChapter:v.guidanceFromChapter,planRevision:v.planRevision})))throw new Error('备份大纲历史校验失败');}
  let book=await createBook(store,{...b.book,title:b.book.title+'（恢复）'},key);
  if(book.restoreComplete)return book;
  // Partial imports are resumable with the same backup checksum key. Never overwrite.
  for(const c of b.chapters){const {id,revision,parent,kind,...data}=c;await store.create('chapter',{...data,lease:null},book.id,book.id+':chapter:'+c.number);}
  for(const v of b.versions||[]){const {id,revision,parent,kind,...data}=v;await store.create('version',data,book.id,book.id+':chapter:'+v.number+':version:'+v.hash);}
  for(const a of b.audits||[]){const {id,revision,parent,kind,...data}=a;await store.create('audit',{...data,lease:null},book.id,book.id+':audit:'+a.through);}
  for(const v of b.planVersions||[]){const {id,revision,parent,kind,...data}=v;await store.create('planVersion',data,book.id,book.id+':planVersion:'+v.planRevision);}
  book=await store.get(book.id);
  return store.save(book,{...book,plan:b.book.plan,planningDraft:b.book.planningDraft||null,guidance:b.book.guidance||'',guidanceFromChapter:b.book.guidanceFromChapter||1,planRevision:b.book.planRevision||1,platform:b.book.platform,status:'paused',restoreComplete:true});
}

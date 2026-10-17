import {hash} from './store.mjs';
import {factsFrom} from './quality.mjs';
import {promiseLedger} from './narrative.mjs';
// These are views of owner-private stored records, never vendor chat memory.
// Plans describe intentions; only locked chapter events describe what happened.
export async function storyDocuments(book,chapters=[]) {
  if(!book)return null;
  const plan=book.plan||book.planningDraft?.outline||null;
  const locked=chapters.filter(c=>c.status==='locked').sort((a,b)=>a.number-b.number);
  for(const [i,c] of locked.entries())if(c.number!==i+1||!c.gate?.pass||c.hash!==await hash(c.content||''))throw new Error('故事档案需要连续、通过审核且哈希匹配的定稿，未使用草稿补记忆');
  const sourceChapters=locked.map(c=>({number:c.number,hash:c.hash}));
  const changes=locked.flatMap(c=>(c.review?.changes||[]).map(d=>({...d,chapter:c.number,hash:c.hash})));
  const choices=locked.flatMap(c=>(c.review?.characterBeats||[]).map(d=>({...d,chapter:c.number,hash:c.hash,behaviorReview:c.review?.craftEvidence?.character?.characterId===d.characterId?c.review.craftEvidence.character:null})));
  return {planRevision:book.planRevision||1,provisional:!book.plan,sourceChapters,
    world:{baseline:plan?.bible||null,initialFacts:plan?.facts||{},currentFacts:factsFrom(plan,locked),changes},
    characters:{baseline:plan?.characters||[],choices},
    outline:{arcs:plan?.arcs||[],planned:book.plan?.contracts||book.planningDraft?.contracts||[],actual:locked.map(c=>({number:c.number,title:c.title,hash:c.hash,summary:c.review?.summary,consequences:c.review?.consequences,questions:c.review?.questions}))},
    promises:promiseLedger({...book,plan},locked)};
}

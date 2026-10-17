// SYNTHETIC ONLY: protocol fixtures do not measure fiction quality or contracts.
import {plan,fixture,review} from './workflow-support.mjs';
import {narrativeBrief} from '../lib/narrative.mjs';
import {storyContext} from '../lib/story-context.mjs';
import {planningRange,draftFromPlan} from '../lib/planning.mjs';
export function craftPlan(total=3){
  const p=plan(total);p.bible={...p.bible,readerPromise:'SYNTHETIC reader experience',themeQuestion:'SYNTHETIC value question',endingCost:'SYNTHETIC lasting cost',positioning:{reader:'SYNTHETIC audience hypothesis',appeal:'SYNTHETIC reading reward',difference:'SYNTHETIC distinct causal engine',unitEngine:'SYNTHETIC recurring choices with different costs'},coreRules:['SYNTHETIC rule: losses remain real']};
  p.characters=p.characters.map((c,i)=>({...c,id:'C'+(i+1),goal:'SYNTHETIC action '+i,desire:'SYNTHETIC desire '+i,weakness:'SYNTHETIC weakness',voice:'SYNTHETIC voice '+i,cost:'SYNTHETIC cost',knowledge:'SYNTHETIC known facts',behavior:{principle:'SYNTHETIC principle '+i,pressureResponse:'SYNTHETIC response '+i,changeTrigger:'SYNTHETIC trigger and cost '+i}}));
  p.foreshadowing=[{id:'F1',promise:'SYNTHETIC promised reveal',plantChapter:1,dueChapter:3}];return p;
}
export async function craftFixture(store,cfg,b,prompt,role,...rest){
  const cs=(await store.list('chapter',b.id)).sort((a,b)=>a.number-b.number),c=cs.find(c=>c.status!=='locked');
  if(role==='plan')return craftPlan(b.totalChapters);
  if(role==='plan_batch'){const {start,end}=planningRange(b.planningDraft||await draftFromPlan(b.plan,b.totalChapters));return {contracts:craftPlan(b.totalChapters).contracts.slice(start-1,end).map(x=>({...x,cause:'SYNTHETIC cause',conflict:'SYNTHETIC conflict',emotion:'SYNTHETIC emotion',hook:'SYNTHETIC question'}))};}
  if(role==='contract'){
    const out=await fixture(store,cfg,b,prompt,role,...rest),brief=narrativeBrief(b,cs,c.number);
    return {...out,schema:3,craftProtocol:1,readerJourney:{known:'SYNTHETIC known info',expectation:'SYNTHETIC expectation',delivery:'SYNTHETIC actual reward',carry:'SYNTHETIC next unit'},scenes:out.scenes.map((s,i)=>({...s,stopAfter:'SYNTHETIC scene exit '+i,defer:i<out.scenes.length-1?['SYNTHETIC reserved later event']:[]})),characterFocus:{characterId:'C1',want:'SYNTHETIC immediate desire',dilemma:'SYNTHETIC conflicting choices'},drama:{conflict:'冲突'+c.number,method:'手段'+c.number,emotion:'体验'+c.number},promiseActions:[...brief.toPlant.map(id=>({id,action:'plant',scene:1,reason:'SYNTHETIC plant'})),...brief.toPay.map(id=>({id,action:'pay',scene:1,reason:'SYNTHETIC pay'}))]};
  }
  if(role==='review'){
    const r=review(c,c.number),mem=await storyContext(b,cs,c.contract,c.number),quote=c.content.slice(0,12);
    return {...r,characterBeats:[{characterId:'C1',choice:'SYNTHETIC actual choice',consequence:'SYNTHETIC actual consequence',quote}],antiLoop:{status:mem.source.length?'distinct':'no_prior',reason:'SYNTHETIC comparison',comparisons:mem.source.slice(0,1).map(s=>({chapter:s.chapter,currentQuote:quote,pastQuote:s.text.slice(0,12),difference:'SYNTHETIC distinct mechanism'}))},foreshadowing:c.contract.promiseActions.map(a=>({id:a.id,status:a.action==='plant'?'open':'paid',evidence:c.content.slice(12,24)})),craftEvidence:{character:{characterId:'C1',status:'consistent',quote,reason:'SYNTHETIC behavior comparison'},continuity:{status:'consistent',quote,reason:'SYNTHETIC rule comparison'},boundaries:r.sceneEvidence.map(e=>({scene:e.scene,respected:true,quote:e.quote,reason:'SYNTHETIC exit comparison'}))}};
  }
  return fixture(store,cfg,b,prompt,role,...rest);
}

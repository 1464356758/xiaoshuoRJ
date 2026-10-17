import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store,hash} from '../lib/store.mjs';
import {createBook,step,saveChapter,unlockChapter,exportBook,settings,config,publicConfig,savePlan,testConnection,setBookBudget} from '../lib/engine.mjs';
import {qualityGate,checkChapter,count,validatePlan} from '../lib/quality.mjs';
import {modelCall,seal,defaults,callSpec} from '../lib/model.mjs';
import {startJob,pauseJob,runJobStep,tickRunner,runnerStatus} from '../lib/jobs.mjs';
import {restoreBackup} from '../lib/backup.mjs';
import {planningRange,validatePlanningDraft} from '../lib/planning.mjs';
import {openingGate,arcGate,openingFingerprint,submissionReadiness,submissionPacket,policyVerified} from '../lib/acceptance.mjs';
import {repositoryAssistant} from '../lib/model.mjs';
import {executeGithubTool} from '../lib/github-tools.mjs';
import {forkRevision} from '../lib/revisions.mjs';
import {createReadContext} from '../lib/read-context.mjs';
import {runForegroundBatch} from '../lib/foreground-runner.mjs';
import {openingAudit} from '../lib/engine.mjs';
import {contractPrompt,writePrompt} from '../lib/prompts.mjs';
import {storyContext,validateSceneContract} from '../lib/story-context.mjs';
import {applyRepair,repairFeasible} from '../lib/repairs.mjs';
import {arcFingerprint,arcReady} from '../lib/acceptance.mjs';
import {resolveModel} from '../lib/model-routing.mjs';
import {draftFromPlan} from '../lib/planning.mjs';
const migration=readFileSync(new URL('../drizzle/0000_rare_tenebrous.sql',import.meta.url),'utf8');
function db(file=':memory:') {
  const conn=new DatabaseSync(file);if(!conn.prepare("SELECT name FROM sqlite_master WHERE name='records'").get())conn.exec(migration.replaceAll('--> statement-breakpoint',''));
  return {conn,prepare(sql){const q=conn.prepare(sql);let args=[];return {bind(...a){args=a;return this;},async first(){return q.get(...args)||null;},async all(){return {results:q.all(...args)};},async run(){const r=q.run(...args);return {meta:{changes:Number(r.changes)}};}};}};
}
const fresh=()=>new Store(db(),'test-owner');
const plan=total=>({title:'TEST ONLY / 合成状态机夹具',platform:'番茄小说',candidates:[{title:'甲',engine:'权力竞争'},{title:'乙',engine:'资源分配'},{title:'丙',engine:'关系决裂'}],bible:{premise:'本夹具只用于程序测试，不是小说质量案例'},style:{narration:'合成'},characters:[{name:'甲'},{name:'乙'},{name:'丙'},{name:'丁'}],facts:{权限:'无'},arcs:Array.from({length:Math.ceil(total/10)},(_,i)=>({id:i+1,start:i*10+1,end:Math.min(total,i*10+10),goal:'阶段'+i,irreversibleChange:'权力改变'+i})),contracts:Array.from({length:total},(_,i)=>({number:i+1,title:'测试章'+i,goal:'推进'+i,consequence:'后果'+i,method:'方法'+i}))});
function synthetic(seed,size){let n=seed+7,s='';for(let i=0;i<size;i++){n=(n*1664525+1013904223)>>>0;s+=String.fromCharCode(0x4e00+n%6000);if(i%80===79)s+='。\n';}return s;}
function review(c,n){const quote=c.content.slice(0,12);const scores=Object.fromEntries([['commercial',18],['causality',18],['character',18],['pace',13],['language',13],['originality',9]].map(([k,score])=>[k,{score,quote,reason:'TEST ONLY: 仅验证数据门，不能代表文学质量'}]));return {scores,sceneEvidence:(c.contract?.scenes||[{}]).map((_,i,a)=>({scene:i+1,quote:c.content.slice(Math.floor(c.content.length*i/a.length),Math.floor(c.content.length*i/a.length)+12),reason:'TEST ONLY / scene coverage'})),issues:[],deleteTest:{necessary:true,loss:'移除将缺少状态'+n},changes:[{key:'章'+n,from:null,to:'已发生',reason:'夹具事件',quote}],summary:'推进'+n,signature:{conflict:'冲突'+n,solution:'手段'+n,emotion:'体验'+n},foreshadowing:[],consequences:'后果'+n,questions:'下一目标'};}
async function fixture(store,cfg,b,prompt,role){const cs=await store.list('chapter',b.id),c=cs.sort((a,b)=>a.number-b.number).find(c=>c.status!=='locked');if(role==='arc_review'){const requested=new Set([...prompt.matchAll(/第(\d+)章 /g)].map(m=>Number(m[1])));const evidence=cs.filter(c=>c.status==='locked').filter(c=>!requested.size||requested.has(c.number)).slice(-10).map(c=>({chapter:c.number,quote:c.content.slice(0,12),reason:'SYNTHETIC protocol only'}));return {pass:true,evidence,payoffEvidence:evidence[0],irreversibleEvidence:evidence.at(-1),issues:[],nextAdjustment:'TEST ONLY'};}if(role==='opening_review')return openingReport(cs);if(role==='plan')return plan(b.totalChapters);if(role==='contract')return {schema:2,title:c.title,entry:'TEST ONLY: 延续前章处境',cause:'TEST ONLY: 必须行动',goal:'推进',deleteLoss:'状态改变',hook:'下一目标',relevantChapters:[],requiredDelta:[{key:'章'+c.number,from:null,to:'已发生'}],forbidden:[],scenes:Array.from({length:Math.ceil(b.targetWords/(cfg.segmentWords||1600))},()=>({goal:'推动',conflict:'阻碍',choice:'主动选择',consequence:'产生代价',characters:['甲'],setting:'合成场景',knowledgeBoundary:'只知道既有事实'}))};if(role==='write')return {text:synthetic(c.number*17+c.chunks.length,b.targetWords/c.contract.scenes.length),sceneComplete:true};if(role==='repair')return {baseHash:c.hash,patches:[{before:c.content.slice(0,24),after:String.fromCharCode(0x4e00+c.attempt)+c.content.slice(1,24)}],resolved:['ISSUE-1']};if(role==='review')return review(c,c.number);throw new Error('unsupported');}
// The retained suite exercises legacy recovery as well as shared gates.
async function book(store,words=1000,total=3,key=crypto.randomUUID()){const b=await createBook(store,{targetWords:words,totalChapters:total},key);return store.save(b,{...b,workflowVersion:1,narrativeProtocol:0,craftProtocol:0,platformProtocol:0,platformBinding:null});}
async function writeOne(store,b){for(let i=0;i<25;i++){await step(store,b.id,'',fixture);const locked=(await store.list('chapter',b.id)).filter(c=>c.status==='locked');if(locked.length)return locked[0];}throw new Error('not locked');}


async function batchedFixture(store,cfg,b,prompt,role,...rest){
  if(role==='plan_batch'){const {start,end}=planningRange(b.planningDraft||await draftFromPlan(b.plan,b.totalChapters));return {contracts:Array.from({length:end-start+1},(_,i)=>{const number=start+i;return {number,title:'TEST ONLY '+number,goal:'目标'+number,cause:'因果'+number,conflict:'冲突'+number,method:'手段'+number,consequence:'后果'+number,emotion:'体验'+number,hook:'问题'+number};})};}
  return fixture(store,cfg,b,prompt,role,...rest);
}
function openingReport(cs){const evidence=cs.filter(c=>c.number<=3).map(c=>({chapter:c.number,quote:c.content.slice(0,12)}));return {pass:true,scores:Object.fromEntries(['hook','character','causality','pace','voice'].map(k=>[k,{score:18,reason:'SYNTHETIC: gate protocol only',evidence}])),hooks:evidence.map(e=>({...e,question:'TEST question',reason:'TEST causal evidence'})),longRun:{engine:'TEST engine',nextArc:'TEST arc',repetitionRisk:'TEST risk'},readerReason:'TEST ONLY; not a commercial judgement',issues:[]};}
export {fresh,book,plan,synthetic,review,fixture,configured,writeOne,batchedFixture,openingReport};
async function configured(store,extra={}){const secret=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));await settings(store,{apiKey:'TEST ONLY / not a real key',inputPrice:1,outputPrice:1,spendEnabled:true,...extra},secret);return secret;}

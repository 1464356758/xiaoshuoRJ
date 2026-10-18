// Planning estimates, never a spending authorization. CNY per million tokens.
export const referencePrices={checkedAt:'2026-10-17',planner:{model:'deepseek-v4-pro',input:9,output:27,source:'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',note:'高峰、未命中缓存；闲时价格减半'},writer:{model:'deepseek-v4-pro',input:9,output:27,source:'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',note:'正文关闭思考；高峰未命中缓存，闲时减半；不预设缓存折扣'},review:{model:'qwen3.8-max',input:12,output:36,source:'https://help.aliyun.com/zh/model-studio/model-pricing',note:'百炼北京按量；不计免费额度/批量/缓存优惠'}};
export const estimateScenarios=[{id:'lean',name:'较短上下文、少返修',tokensPerChar:.9,contextChars:14000,repairRate:.05,reasoningFactor:1.1},{id:'typical',name:'常规上下文、20%章节局部返修',tokensPerChar:1.3,contextChars:24000,repairRate:.2,reasoningFactor:1.4},{id:'heavy',name:'长上下文、50%章节返修两轮',tokensPerChar:1.8,contextChars:42000,repairRate:1,reasoningFactor:2}];
export const singleCallScenarios=estimateScenarios.map(s=>({...s,name:s.name.replace('局部返修','整章返修')}));
export function estimateBookCost({chapters=100,words=9000,segmentWords=1600,singleCall=false,prices=referencePrices,scenario=estimateScenarios[1]}={}) {
  if(!Number.isInteger(chapters)||chapters<3||chapters>300||!Number.isFinite(words)||words<1000||words>10000||!Number.isFinite(segmentWords)||segmentWords<1000||segmentWords>3500)throw new Error('估算规格超出软件范围');
  if(Object.values({planner:prices.planner,writer:prices.writer,review:prices.review}).some(p=>!p||![p.input,p.output].every(n=>Number.isFinite(n)&&n>=0)))throw new Error('估算需要三角色完整人民币单价');
  const {tokensPerChar:r,contextChars:ctx,repairRate,reasoningFactor:thinking}=scenario;
  if(![r,ctx,repairRate,thinking].every(Number.isFinite)||r<=0||ctx<0||repairRate<0||thinking<1)throw new Error('估算假设无效');
  const fragments=singleCall?1:Math.ceil(words/segmentWords),proseChars=words*1.15,repairs=Math.min(Math.ceil(chapters*repairRate),chapters*4),batches=chapters>10?Math.ceil(chapters/10):0,arcs=singleCall?0:Math.floor(chapters/10);
  const rows=[];
  function add(phase,slot,calls,inputChars,outputTokens){const cap=singleCall?16000:phase==='全书骨架'?16000:phase==='滚动详纲'||phase==='逐章任务书'?6000:phase==='分段正文'?Math.max(4500,Math.ceil(segmentWords*2.5)):8000;const input=Math.ceil(inputChars*r),output=Math.min(calls*cap,Math.ceil(outputTokens*thinking-1e-8)),price=prices[slot];rows.push({phase,slot,calls,inputTokens:input,outputTokens:output,cost:(input*price.input+output*price.output)/1e6});}
  add('全书骨架','planner',1,ctx,chapters>10?9000:13000);
  if(batches)add('滚动详纲','planner',batches,batches*(ctx+8000),batches*3500);
  add('逐章任务书','planner',chapters,chapters*(ctx+4000),chapters*2600);
  // Each fragment re-reads saved earlier fragments of the current chapter.
  add(singleCall?'整章正文':'分段正文','writer',chapters*fragments,chapters*(fragments*(ctx+3000)+proseChars*(fragments-1)/2),chapters*proseChars*r);
  add('单章全文审核','review',chapters,chapters*(ctx+proseChars+4000),chapters*4200);
  if(!singleCall)add('三章联合验收','review',1,ctx+3*proseChars,4500);
  if(arcs)add('每十章全文总审','review',arcs,arcs*(ctx+10*proseChars),arcs*5500);
  if(repairs){add(singleCall?'整章返修':'局部返修','writer',repairs,repairs*(ctx+proseChars+4000),repairs*proseChars*r*(singleCall?1:.25));add('返修后全文复审','review',repairs,repairs*(ctx+proseChars+4000),repairs*4200);}
  return {scenario:scenario.id,chapters,words,totalWords:chapters*words,fragments,repairs,assumptions:{tokensPerChar:r,contextChars:ctx,repairRate,reasoningFactor:thinking,punctuationFactor:1.15},rows,total:rows.reduce((s,x)=>s+x.cost,0),calls:rows.reduce((s,x)=>s+x.calls,0),inputTokens:rows.reduce((s,x)=>s+x.inputTokens,0),outputTokens:rows.reduce((s,x)=>s+x.outputTokens,0)};
}
export function pricesFromConfig(c={}) {
  const pair=(input,output)=>input===null||output===null||input===undefined||output===undefined?null:{input,output};
  const planner=pair(c.inputPrice,c.outputPrice);
  return {planner,writer:c.writerProvider?pair(c.writerInputPrice,c.writerOutputPrice):planner,review:c.reviewProvider?pair(c.reviewInputPrice,c.reviewOutputPrice):planner};
}

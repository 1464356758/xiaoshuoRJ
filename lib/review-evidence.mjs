// Evidence IDs identify exact source spans; they never authorize rewriting a quote.
export function evidenceCatalog(content,prefix='E') {
  const rows=[];
  for(const line of String(content||'').split(/\r?\n/)){
    const text=line.trim();
    for(let start=0;start<text.length;start+=320)rows.push({id:prefix+String(rows.length+1).padStart(4,'0'),quote:text.slice(start,start+320)});
  }
  return rows;
}
const pastPrefix=s=>'H'+s.chapter+'_'+(s.hash||'').slice(0,8)+'_'+(s.start||0)+'_';
export const renderEvidence=rows=>rows.map(r=>'['+r.id+'] '+r.quote).join('\n');
export function reviewMemory(memory) {
  return {...memory,source:(memory.source||[]).map(s=>({...s,text:renderEvidence(evidenceCatalog(s.text,pastPrefix(s)))}))};
}
export function referenceSchema(text) {
  return text.replace(/\b(quote|triggerQuote|currentQuote|pastQuote|evidence)\b/g,'$1Id');
}
export function hydrateReviewEvidence(response,chapter,memory) {
  const result=structuredClone(response),current=new Map(evidenceCatalog(chapter.content).map(r=>[r.id,r.quote]));
  const sources=memory.source||[];
  const fields=['quote','triggerQuote','currentQuote','evidence','pastQuote'];
  function visit(value,depth=0){
    if(!value||typeof value!=='object')return;
    if(depth>40)throw new Error('审核响应嵌套过深，保留原稿');
    for(const field of fields){
      const key=field+'Id';if(!Object.hasOwn(value,key))continue;
      if(field==='triggerQuote'&&value.status!=='earned_change'&&(value[key]===null||value[key]==='')){
        if(value[field])throw new Error('审核证据编号与原文引用冲突，保留原稿');
        delete value[key];continue;
      }
      const map=field==='pastQuote'?new Map(sources.filter(s=>s.chapter===value.chapter).flatMap(s=>evidenceCatalog(s.text,pastPrefix(s))).map(r=>[r.id,r.quote])):current;
      const quote=map.get(value[key]);
      if(typeof value[key]!=='string'||!quote||quote.trim().length<4)throw new Error('审核证据编号无效或不属于本轮原稿：'+key);
      if(Object.hasOwn(value,field)&&value[field]!==quote)throw new Error('审核证据编号与原文引用冲突，保留原稿');
      value[field]=quote;delete value[key];
    }
    for(const child of Object.values(value))visit(child,depth+1);
  }
  visit(result);return result;
}

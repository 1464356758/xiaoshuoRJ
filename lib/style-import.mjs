// Sampling happens on the owner's device. Only reviewed excerpts are saved.
export function decodeReferenceBytes(buffer) {
  const b=new Uint8Array(buffer);let encoding='UTF-8',text;
  if(b[0]===255&&b[1]===254){encoding='UTF-16LE';text=new TextDecoder('utf-16le',{fatal:true}).decode(b);}
  else if(b[0]===254&&b[1]===255){encoding='UTF-16BE';text=new TextDecoder('utf-16be',{fatal:true}).decode(b);}
  else{try{text=new TextDecoder('utf-8',{fatal:true}).decode(b);}catch{encoding='GB18030';text=new TextDecoder('gb18030',{fatal:true}).decode(b);}}
  if(text.includes('\u0000'))throw new Error('文件编码无法可靠识别，请另存为UTF-8或GB18030的TXT再导入');
  return {text,encoding};
}
export function sampleReferenceFile(value) {
  if(typeof value!=='string'||value.length>3000000)throw new Error('文件过大，请先按卷或章节拆分，单次最多300万字符');
  const text=value.replace(/^\ufeff/,'').replace(/\r\n?/g,'\n').trim();
  if(text.length<200)throw new Error('参考原文不足200字符');
  if(text.length<=8000)return [{stage:'other',label:'完整片段',text}];
  const lines=[...text.matchAll(/(?:^|\n)[ \t]*(?:第[零〇一二三四五六七八九十百千万两\d]{1,12}[章节回]|Chapter\s+\d+)[^\n]{0,100}/gi)].map(m=>m.index);
  const positions=lines.length>=3?[lines[0],lines[Math.floor(lines.length/2)],lines.at(-1)]:[0,Math.floor(text.length/2),Math.max(0,text.length-6000)];
  const stages=['opening','middle','ending'],labels=['开篇候选','中部候选','结尾候选'];
  return positions.map((start,i)=>{let end=Math.min(text.length,start+6000);if(end<text.length){const p=text.lastIndexOf('\n',end);if(p>start+200)end=p;}return {stage:stages[i],label:labels[i],text:text.slice(start,end).trim()};}).filter((v,i,a)=>v.text.length>=200&&a.findIndex(n=>n.text===v.text)===i);
}

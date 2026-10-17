// Local editing hints only: these features do not identify authorship or predict a detector score.
export function styleSignals(text='') {
  const patterns=[['套语密度',/不由得|嘴角勾起|眼底闪过|空气仿佛凝固|命运的齿轮|心中涌起|一股莫名|说时迟那时快/g],['替读者总结',/这不仅|不仅仅是|这一刻.{0,12}明白|故事.{0,8}才刚刚开始/g]];
  return patterns.map(([label,re])=>{const matches=[...text.matchAll(re)];return {label,count:matches.length,examples:matches.slice(0,5).map(m=>({start:m.index,quote:text.slice(Math.max(0,m.index-12),Math.min(text.length,m.index+m[0].length+18))}))};}).filter(x=>x.count);
}
export const styleInstruction='逐章自然表达审校：检查所有人物口吻同质、替读者总结情绪、无关比喻、机械排比、套话、重复起承转合。问题要引用实际原文，按影响列入issues并给出局部修改；严重影响阅读列major，不能用高分抵消。保留人物犹豫、动作、言外之意与处境细节，不能靠加错字、乱标点、随机同义替换或虚构经历降低检测分。语言自然度、原创性、平台规则与AI来源检测是独立事项，不承诺绕过检测。';

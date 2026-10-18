// Client-only form checks. Keys are never returned or written to browser storage.
export function roleHasKey(draft,saved,keys,slot='planner') {
  if(slot!=='planner'&&!draft[slot+'Provider'])return roleHasKey(draft,saved,keys);
  const prefix=slot==='planner'?'':slot;
  const provider=prefix?prefix+'Provider':'provider',workspace=prefix?prefix+'Workspace':'workspace';
  const flag=prefix?prefix+'HasKey':'hasKey';
  return !!keys?.[slot]?.trim()||!!saved?.[flag]&&draft[provider]===saved[provider]&&draft[workspace]===saved[workspace];
}
export function modelSettingsGaps(draft,saved=draft,keys={}) {
  const gaps=[];
  if(!draft.model?.trim())gaps.push('策划：填写模型ID');
  if(!roleHasKey(draft,saved,keys))gaps.push('策划：填写API密钥');
  if(draft.inputPrice==null||draft.outputPrice==null)gaps.push('策划：填写输入和输出最高单价');
  for(const [slot,name] of [['writer','正文'],['review','审核']])if(draft[slot+'Provider']){
    if(!draft[slot+'Model']?.trim())gaps.push(name+'：填写独立模型ID');
    if(!roleHasKey(draft,saved,keys,slot))gaps.push(name+'：填写独立API密钥，或选择沿用策划');
    if(draft[slot+'InputPrice']==null||draft[slot+'OutputPrice']==null)gaps.push(name+'：填写独立输入和输出最高单价');
  }
  return gaps;
}
export function sharedRoleDraft(draft) {
  return {...draft,writerProvider:'',reviewProvider:'',writerModel:'',reviewModel:'',spendEnabled:false};
}

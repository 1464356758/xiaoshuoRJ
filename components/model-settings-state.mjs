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

export const editableModelFields=['provider','model','writerModel','reviewModel','writerProvider','reviewProvider','writerInputPrice','writerOutputPrice','reviewInputPrice','reviewOutputPrice','chapterLimit','segmentWords','inputPrice','outputPrice','monthLimit','bookLimit','taskLimit','maxOutputTokens','spendEnabled','workspace','writerWorkspace','reviewWorkspace'];
export function modelSettingsDirty(draft,saved,keys={}) {
  if(!saved)return false;
  if(keys.planner?.trim()||draft.writerProvider&&keys.writer?.trim()||draft.reviewProvider&&keys.review?.trim())return true;
  return editableModelFields.some(field=>!Object.is(draft[field]??null,saved[field]??null));
}
export function modelInputProblems(draft,saved,keys={}) {
  const errors=[];
  for(const [slot,name] of [['planner','策划'],['writer','正文'],['review','审核']]){
    if(slot!=='planner'&&!draft[slot+'Provider'])continue;
    const model=slot==='planner'?draft.model:draft[slot+'Model'];
    if(!model?.trim()||model.trim().length>150)errors.push(name+'：请填写有效的模型ID');
    const key=keys[slot]?.trim();
    if(key&&(key.length>1000||/\s/.test(key)))errors.push(name+'：密钥中含空格或换行，请只粘贴这一把完整密钥');
  }
  for(const [field,label,max] of [['monthLimit','月度费用上限',10000],['bookLimit','单书费用上限',10000],['taskLimit','单次调用上限',10000],['inputPrice','策划输入单价',100000],['outputPrice','策划输出单价',100000],['writerInputPrice','正文输入单价',100000],['writerOutputPrice','正文输出单价',100000],['reviewInputPrice','审核输入单价',100000],['reviewOutputPrice','审核输出单价',100000],['chapterLimit','单章费用上限',10000]]){
    const value=draft[field];
    if(['monthLimit','bookLimit','taskLimit'].includes(field)&&value==null)errors.push(label+'需要填写');
    if(value!=null&&(!Number.isFinite(value)||value<0||value>max))errors.push(label+'需在0到'+max+'之间');
  }
  for(const [field,label,min,max] of [['maxOutputTokens','最大输出token',64,65536],['segmentWords','分段目标',1000,3500]])if(!Number.isInteger(draft[field])||draft[field]<min||draft[field]>max)errors.push(label+'需为'+min+'到'+max+'之间的整数');
  if(draft.spendEnabled)errors.push(...modelSettingsGaps(draft,saved,keys));
  return [...new Set(errors)];
}
export function modelSettingsInput(draft,keys) {
  const input=Object.fromEntries(editableModelFields.filter(field=>Object.hasOwn(draft,field)).map(field=>[field,draft[field]]));
  if(Object.hasOwn(draft,'revision'))input.revision=draft.revision;
  for(const field of ['model','writerModel','reviewModel','workspace','writerWorkspace','reviewWorkspace'])if(typeof input[field]==='string')input[field]=input[field].trim();
  input.apiKey=keys.planner?.trim()||'';
  input.writerApiKey=draft.writerProvider?keys.writer?.trim()||'':'';
  input.reviewApiKey=draft.reviewProvider?keys.review?.trim()||'':'';
  return input;
}
export function creationSettingsProblems(settings,book) {
  const problems=modelSettingsGaps(settings,settings);
  if(!settings.spendEnabled)problems.push('勾选费用授权并保存');
  for(const [field,label] of [['monthLimit','月度费用上限'],['bookLimit','单书费用上限'],['taskLimit','单次调用上限']])if(!settings[field])problems.push(label+'需大于0');
  if(!book?.budget)problems.push('当前作品预算为0，请在本书预算中调整');
  if(settings.chapterLimit===0)problems.push('单章费用上限为0，无法生成正文');
  return problems;
}

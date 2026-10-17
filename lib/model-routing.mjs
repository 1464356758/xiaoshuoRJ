// Role routing contains no credentials or live settings. Explicit overrides
// never fall back to another account/model after a failure.
export const roleNames={planner:'策划',writer:'正文与返修',review:'独立审核'};
export function roleSlot(role) {
  if(['write','rewrite','repair','connection_writer'].includes(role))return 'writer';
  if(['review','opening_review','arc_review','connection_review'].includes(role))return 'review';
  return 'planner';
}
export function resolveModel(cfg,role) {
  const slot=roleSlot(role),override=slot!=='planner'&&!!cfg[slot+'Provider'];
  return {slot,provider:override?cfg[slot+'Provider']:cfg.provider,
    model:override?cfg[slot+'Model']:((slot!=='planner'?cfg[slot+'Model']:'')||cfg.model),
    apiKeyEncrypted:override?cfg[slot+'ApiKeyEncrypted']:cfg.apiKeyEncrypted,
    inputPrice:override?cfg[slot+'InputPrice']:cfg.inputPrice,
    outputPrice:override?cfg[slot+'OutputPrice']:cfg.outputPrice,
    workspace:override?(cfg[slot+'Workspace']||''):(cfg.workspace||'')};
}
export function modelEndpoint(route,providers) {
  if(route.provider==='qwen'&&route.workspace){if(!/^[a-z0-9][a-z0-9-]{0,62}$/i.test(route.workspace))throw new Error('百炼业务空间ID无效');return 'https://'+route.workspace+'.cn-beijing.maas.aliyuncs.com/compatible-mode/v1';}
  return providers[route.provider];
}
export function missingRoles(cfg) {
  return ['plan','write','review'].map(role=>resolveModel(cfg,role)).filter(r=>!r.model||!r.apiKeyEncrypted||r.inputPrice==null||r.outputPrice==null).map(r=>roleNames[r.slot]);
}
export const chineseRoleProposal={provider:'deepseek',model:'deepseek-v4-pro',writerProvider:'',writerModel:'deepseek-v4-pro',reviewProvider:'qwen',reviewModel:'qwen3.8-max'};

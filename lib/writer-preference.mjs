import {config} from './engine.mjs';
import {resolveModel} from './model-routing.mjs';
// A fixed, explicitly requested preference change. It never starts work, raises
// budgets, enables spending, decrypts a key or contacts a provider.
export async function useDeepseekWriter(store) {
  const old=await config(store),route=resolveModel(old,'write');
  const encrypted=route.provider==='deepseek'&&route.apiKeyEncrypted?route.apiKeyEncrypted:old.provider==='deepseek'?old.apiKeyEncrypted:'';
  const next={...old,writerProvider:'deepseek',writerModel:'deepseek-v4-pro',writerWorkspace:'',writerApiKeyEncrypted:encrypted||'',writerInputPrice:9,writerOutputPrice:27,writerPreference:'deepseek-v08'};
  const same=['writerProvider','writerModel','writerWorkspace','writerApiKeyEncrypted','writerInputPrice','writerOutputPrice','writerPreference'].every(k=>old[k]===next[k]);
  if(same)return {status:encrypted?'already_applied':'needs_key',provider:'deepseek',model:next.writerModel};
  if(!old.revision)throw new Error('请先在模型设置保存自己的DeepSeek配置');
  // Check leases in the same compare-and-swap statement. A concurrent old-config
  // call is also guarded by settings revision before its budget reservation.
  const now=Date.now();
  const r=await store.db.prepare(`UPDATE records SET data=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=? AND NOT EXISTS (SELECT 1 FROM records WHERE owner=? AND kind IN ('book','chapter','job') AND json_extract(data,'$.lease.until')>?) AND NOT EXISTS (SELECT 1 FROM calls WHERE owner=? AND status='reserved' AND created>?)`).bind(JSON.stringify(next),now,old.id,store.owner,old.revision,store.owner,now,store.owner,now-130000).run();
  if(r.meta.changes!==1)throw new Error('配置已变化或有在途请求，请等待当前检查点完成后再切换主写手');
  return {status:encrypted?'applied':'needs_key',provider:'deepseek',model:next.writerModel};
}

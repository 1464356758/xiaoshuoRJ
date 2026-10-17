export class Store {
  constructor(db, owner) { this.db=db; this.owner=owner; }
  async get(id) { const r=await this.db.prepare('SELECT * FROM records WHERE id=? AND owner=?').bind(id,this.owner).first(); return r ? {...JSON.parse(r.data),id:r.id,revision:r.revision,kind:r.kind,parent:r.parent} : null; }
  async list(kind,parent) {
    const q= parent === undefined ? 'SELECT * FROM records WHERE owner=? AND kind=? ORDER BY updated DESC' : 'SELECT * FROM records WHERE owner=? AND kind=? AND parent=? ORDER BY updated DESC';
    const r=await this.db.prepare(q).bind(...(parent === undefined ? [this.owner,kind]:[this.owner,kind,parent])).all();
    return r.results.map(r=>({...JSON.parse(r.data),id:r.id,revision:r.revision,kind:r.kind,parent:r.parent}));
  }
  async create(kind,data,parent='',id=crypto.randomUUID()) {
    await this.db.prepare('INSERT OR IGNORE INTO records (id,owner,kind,parent,data,revision,updated) VALUES (?,?,?,?,?,1,?)').bind(id,this.owner,kind,parent,JSON.stringify(data),Date.now()).run();
    const r=await this.get(id); if(!r) throw new Error('记录创建失败'); return r;
  }
  async save(record,data) {
    const r=await this.db.prepare('UPDATE records SET data=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?').bind(JSON.stringify(data),Date.now(),record.id,this.owner,record.revision).run();
    if(r.meta.changes!==1) throw new Error('数据已被其他任务更新，请刷新后继续');
    return this.get(record.id);
  }
  async claimLease(record,duration=130000) {
    const now=Date.now(),scope=record.kind==='book'?record.id:record.parent;
    const data={...record,lease:{token:crypto.randomUUID(),until:now+duration},error:null};
    const r=await this.db.prepare(`UPDATE records SET data=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=? AND COALESCE(json_extract(data,'$.lease.until'),0)<=? AND NOT EXISTS (SELECT 1 FROM records AS other WHERE other.owner=? AND other.id<>? AND (other.id=? OR other.parent=?) AND other.kind IN ('book','chapter','audit','styleTask') AND COALESCE(json_extract(other.data,'$.lease.until'),0)>?)`).bind(JSON.stringify(data),now,record.id,this.owner,record.revision,now,this.owner,record.id,scope,scope,now).run();
    if(r.meta.changes!==1)throw new Error('任务正在执行或版本已更新，请等待当前检查点保存');
    return this.get(record.id);
  }
  async log(book,message) { return this.create('log',{message,time:new Date().toISOString()},book); }
  async cost(book) {
    const rows=await this.db.prepare('SELECT * FROM calls WHERE owner=? AND book=? ORDER BY created DESC').bind(this.owner,book).all();
    return {total:rows.results.reduce((s,r)=>s+r.amount,0)/1e6,calls:rows.results.map(r=>({...r,data:JSON.parse(r.data)}))};
  }
}
export async function hash(text) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join(''); }
export const monthKey=()=>new Date(Date.now()+8*3600*1000).toISOString().slice(0,7);

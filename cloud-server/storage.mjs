import {DatabaseSync} from 'node:sqlite';
import {mkdir,readFile,writeFile,chmod} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
export async function privateState(directory){
  await mkdir(directory,{recursive:true,mode:0o700});await chmod(directory,0o700);
  const file=join(directory,'server-secrets.json');let value;
  if(existsSync(file))value=JSON.parse(await readFile(file,'utf8'));
  else{if(existsSync(join(directory,'novel.sqlite')))throw new Error('发现数据库但缺少云端保险箱；请恢复原密钥文件，不要覆盖原数据');value={serverId:randomUUID(),encryptionKey:randomBytes(32).toString('base64'),controlToken:randomBytes(32).toString('base64url')};await writeFile(file,JSON.stringify(value),{mode:0o600,flag:'wx'});}
  if(!/^[a-f0-9-]{36}$/.test(value.serverId)||Buffer.from(value.encryptionKey||'','base64').length!==32||!/^[A-Za-z0-9_-]{43}$/.test(value.controlToken||''))throw new Error('云端保险箱不完整；保留原目录，不要生成新密钥覆盖');
  return value;
}
export function authorize(value,token){
  if(typeof value!=='string'||!value.startsWith('Bearer ')||value.length>200)return false;
  return timingSafeEqual(createHash('sha256').update(value.slice(7)).digest(),createHash('sha256').update(token).digest());
}
export async function openDatabase(directory){
  await mkdir(directory,{recursive:true,mode:0o700});const file=join(directory,'novel.sqlite'),conn=new DatabaseSync(file,{timeout:5000});
  conn.exec('PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;PRAGMA busy_timeout=5000;');
  if(!conn.prepare("SELECT name FROM sqlite_master WHERE name='records'").get())conn.exec(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
  conn.exec('CREATE TABLE IF NOT EXISTS daemon_lease (id INTEGER PRIMARY KEY CHECK(id=1),token TEXT NOT NULL,until_ms INTEGER NOT NULL);INSERT OR IGNORE INTO daemon_lease(id,token,until_ms) VALUES(1,\'\',0);');
  await chmod(file,0o600);
  return {conn,prepare(sql){const q=conn.prepare(sql);let args=[];return {bind(...values){args=values.map(x=>typeof x==='boolean'?Number(x):x);return this;},async first(){return q.get(...args)||null;},async all(){return {results:q.all(...args)};},async run(){const r=q.run(...args);return {meta:{changes:Number(r.changes)}};}};}};
}
export class DaemonLease {
  constructor(db,duration=180000){this.db=db;this.duration=duration;this.token=randomUUID();}
  acquire(){return this.db.conn.prepare('UPDATE daemon_lease SET token=?,until_ms=? WHERE id=1 AND until_ms<=?').run(this.token,Date.now()+this.duration,Date.now()).changes===1;}
  held(){return !!this.db.conn.prepare('SELECT id FROM daemon_lease WHERE id=1 AND token=? AND until_ms>?').get(this.token,Date.now());}
  renew(){return this.db.conn.prepare('UPDATE daemon_lease SET until_ms=? WHERE id=1 AND token=? AND until_ms>?').run(Date.now()+this.duration,this.token,Date.now()).changes===1;}
  release(){this.db.conn.prepare('UPDATE daemon_lease SET until_ms=0 WHERE id=1 AND token=?').run(this.token);}
}

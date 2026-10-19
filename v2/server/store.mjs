import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
export const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export const uid=()=>randomUUID();
export const han=x=>(String(x).match(/\p{Script=Han}/gu)||[]).length;
export const parse=x=>x?JSON.parse(x):null;
export class Fault extends Error { constructor(message,status=409){super(message);this.status=status;} }
export function ensure(ok,message,status=409){if(!ok)throw new Fault(message,status);}
export class Store {
 constructor(path){mkdirSync(dirname(path),{recursive:true,mode:0o700});this.db=new DatabaseSync(path,{timeout:5000});chmodSync(path,0o600);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS books(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS chapters(id TEXT PRIMARY KEY,book_id TEXT NOT NULL REFERENCES books(id),number INTEGER NOT NULL,data TEXT NOT NULL,UNIQUE(book_id,number));
 CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY,book_id TEXT NOT NULL,chapter_id TEXT NOT NULL,hash TEXT NOT NULL,body TEXT NOT NULL,data TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(chapter_id,hash));
 CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,chapter_id TEXT NOT NULL,hash TEXT NOT NULL,ordinal INTEGER NOT NULL,data TEXT NOT NULL,UNIQUE(chapter_id,ordinal));
 CREATE TABLE IF NOT EXISTS jobs(book_id TEXT PRIMARY KEY,state TEXT NOT NULL,generation INTEGER NOT NULL,target INTEGER NOT NULL,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS steps(key TEXT PRIMARY KEY,book_id TEXT NOT NULL,chapter_id TEXT,phase TEXT NOT NULL,input_hash TEXT NOT NULL,status TEXT NOT NULL,generation INTEGER NOT NULL,data TEXT NOT NULL,raw TEXT,created INTEGER NOT NULL,updated INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS steps_time ON steps(created); CREATE INDEX IF NOT EXISTS steps_book ON steps(book_id);
 CREATE TABLE IF NOT EXISTS archive(id TEXT PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS executor(id INTEGER PRIMARY KEY CHECK(id=1),token TEXT NOT NULL,until_ms INTEGER NOT NULL);
 INSERT OR IGNORE INTO executor VALUES(1,'',0); PRAGMA user_version=2;`);}
 get(sql,...args){return this.db.prepare(sql).get(...args);}
 all(sql,...args){return this.db.prepare(sql).all(...args);}
 run(sql,...args){return this.db.prepare(sql).run(...args);}
 tx(fn){this.db.exec('BEGIN IMMEDIATE');try{const x=fn();this.db.exec('COMMIT');return x;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 meta(k,v){if(v!==undefined)this.run('INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',k,JSON.stringify(v));return parse(this.get('SELECT value FROM meta WHERE key=?',k)?.value);}
 book(id){return parse(this.get('SELECT data FROM books WHERE id=?',id)?.data);}
 books(){return this.all('SELECT data FROM books').map(r=>parse(r.data));}
 saveBook(b){this.run('INSERT INTO books VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',b.id,JSON.stringify(b));return b;}
 chapter(id){return parse(this.get('SELECT data FROM chapters WHERE id=?',id)?.data);}
 chapters(id){return this.all('SELECT data FROM chapters WHERE book_id=? ORDER BY number',id).map(r=>parse(r.data));}
 saveChapter(c){this.run('INSERT INTO chapters VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',c.id,c.bookId,c.number,JSON.stringify(c));return c;}
 saveVersion(c,source,extra={}){const id=uid();this.run('INSERT OR IGNORE INTO versions VALUES(?,?,?,?,?,?,?)',id,c.bookId,c.id,c.hash,c.body,JSON.stringify({source,...extra}),Date.now());return id;}
 job(id){const x=this.get('SELECT * FROM jobs WHERE book_id=?',id);return x?{...parse(x.data),bookId:id,state:x.state,generation:x.generation,target:x.target}:null;}
 saveJob(j){const {bookId,state,generation,target,...data}=j;this.run('INSERT INTO jobs VALUES(?,?,?,?,?) ON CONFLICT(book_id) DO UPDATE SET state=excluded.state,generation=excluded.generation,target=excluded.target,data=excluded.data',bookId,state,generation,target,JSON.stringify(data));return j;}
 step(key){const x=this.get('SELECT * FROM steps WHERE key=?',key);return x?{...x,data:parse(x.data)}:null;}
 saveStep(x){this.run('INSERT INTO steps VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET status=excluded.status,generation=excluded.generation,data=excluded.data,raw=excluded.raw,updated=excluded.updated',x.key,x.book_id,x.chapter_id??null,x.phase,x.input_hash,x.status,x.generation,JSON.stringify(x.data),x.raw??null,x.created??Date.now(),Date.now());return x;}
 lease(token,ms=60000){return this.run('UPDATE executor SET token=?,until_ms=? WHERE id=1 AND (until_ms<=? OR token=?)',token,Date.now()+ms,Date.now(),token).changes===1;}
 held(token){return !!this.get('SELECT id FROM executor WHERE id=1 AND token=? AND until_ms>?',token,Date.now());}
 close(token){if(token)this.run('UPDATE executor SET until_ms=0 WHERE token=?',token);this.db.close();}
}

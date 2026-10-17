// Native SQLite does not consistently ship JSON1 on older Android releases.
// Project the four JSON fields used by the retained engine in the SAME transaction
// as each write. CAS/lease/budget predicates remain a single SQLite statement.
const columns={'lease.until':'nf_lease_until',spendEnabled:'nf_spend_enabled',chapter:'nf_chapter',status:'nf_status'};
export function translateSql(sql) {
  const translated=sql.replace(/json_extract\((?:(\w+)\.)?data,\s*'\$\.([^']+)'\)/g,(_,alias,path)=>{
    if(!columns[path])throw new Error('本机数据库尚不支持此字段：'+path);
    return (alias?alias+'.':'')+columns[path];
  });
  if(/json_extract\s*\(/i.test(translated))throw new Error('不支持的JSON数据库表达式');
  return translated;
}
export function projectedWrite(sql,args) {
  let table,id,data;
  if(/^INSERT(?: OR IGNORE)? INTO records\b/i.test(sql)){table='records';id=args[0];data=args[4];}
  else if(/^INSERT INTO calls\b/i.test(sql)){table='calls';id=args[0];data=args[6];}
  else if(/^UPDATE (records|calls) SET /i.test(sql)&&/\bdata=\?/.test(sql)){
    table=sql.match(/^UPDATE (records|calls)/i)[1];
    const dataPos=sql.indexOf('data=?'),idPos=sql.indexOf('WHERE id=?');
    if(idPos<0)throw new Error('数据更新必须指定记录ID');
    data=args[sql.slice(0,dataPos).split('?').length-1];
    id=args[sql.slice(0,idPos).split('?').length-1];
  } else return null;
  const x=JSON.parse(data);
  return {table,id,values:[x.lease?.until??null,x.spendEnabled===undefined?null:x.spendEnabled?1:0,x.chapter??null,x.status??null]};
}
export function nativeDatabase(bridge) {
  return {prepare(sql){let args=[];return {
    bind(...values){args=values;return this;},
    async first(){return (await this.all()).results[0]||null;},
    async all(){const out=JSON.parse(bridge.database(JSON.stringify({sql:translateSql(sql),args,mode:'all'})));if(out.error)throw new Error(out.error);return {results:out.rows};},
    async run(){const out=JSON.parse(bridge.database(JSON.stringify({sql:translateSql(sql),args,mode:'run',after:projectedWrite(sql,args)})));if(out.error)throw new Error(out.error);return {meta:{changes:out.changes}};}
  };}};
}

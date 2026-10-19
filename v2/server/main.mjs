import {readFileSync,existsSync,mkdirSync,writeFileSync,chownSync,chmodSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {Store,ensure} from './store.mjs';
import {migrate} from './migrate.mjs';
import {Engine} from './engine.mjs';
import {createService} from './service.mjs';
const root=resolve(process.env.DATA_DIR||'/data');ensure(root!=='/','数据目录不能是根目录');mkdirSync(root,{recursive:true,mode:0o700});
if(process.getuid?.()===0&&process.env.NODE_ENV==='production'){chownSync(root,1000,1000);chmodSync(root,0o700);process.setgid(1000);process.setuid(1000);}
let secret;const path=join(root,'server-secrets.json');if(existsSync(path))secret=JSON.parse(readFileSync(path,'utf8'));else{ensure(!existsSync(join(root,'novel.sqlite')),'旧库存在但保险箱缺失，停止');secret={serverId:randomUUID(),encryptionKey:randomBytes(32).toString('base64'),controlToken:process.env.NOVEL_CONTROL_TOKEN||randomBytes(32).toString('base64url')};writeFileSync(path,JSON.stringify(secret),{mode:0o600,flag:'wx'});}
ensure(Buffer.from(secret.encryptionKey,'base64').length===32&&secret.serverId&&secret.controlToken,'原云端保险箱不完整，停止');const s=new Store(join(root,'v2','novel.sqlite'));await migrate(s,root,secret);const engine=new Engine(s,secret.encryptionKey,{disabled:process.env.NOVEL_MODEL_API_DISABLED==='1'});const service=createService(engine,{...secret,publicOrigin:process.env.PUBLIC_ORIGIN,build:process.env.RAILWAY_GIT_COMMIT_SHA||process.env.NOVEL_BUILD||'source'});await service.listen(Number(process.env.PORT||8080),'0.0.0.0');console.log('Novel Factory V2 ready; private data retained; no task auto-started by migration.');let closing=false;async function close(){if(closing)return;closing=true;await service.close();process.exit(0);}process.on('SIGTERM',close);process.on('SIGINT',close);

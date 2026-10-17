import {mkdir,chown,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';
const directory=resolve(process.env.DATA_DIR||'/data');if(directory==='/')throw new Error('数据目录不能是根目录');
await mkdir(directory,{recursive:true,mode:0o700});
// Hosted volumes may initially be root-owned. Drop privileges before the server.
if(process.getuid?.()===0){await chown(directory,1000,1000);await chmod(directory,0o700);process.setgid(1000);process.setuid(1000);}
await import('./main.mjs');

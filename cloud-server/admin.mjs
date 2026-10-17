import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const command=process.argv[2],directory=process.env.DATA_DIR||'/data';
if(command!=='pairing')throw new Error('支持的命令：pairing（只在自己的私有云终端读取，不发到聊天）');
const x=JSON.parse(await readFile(join(directory,'server-secrets.json'),'utf8'));
console.log('服务器地址：'+(process.env.PUBLIC_ORIGIN||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:'请使用本服务的HTTPS公网域名')));
console.log('连接凭证：'+x.controlToken);

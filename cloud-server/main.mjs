import {createCloudService} from './service.mjs';
import {SHUTDOWN_GRACE_MS} from '../lib/execution-policy.mjs';
const directory=process.env.DATA_DIR||'/data';
const origin=process.env.PUBLIC_ORIGIN||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:null);
let service;const startupDeadline=Date.now()+195000;
for(;;){try{service=await createCloudService({directory,publicOrigin:origin,controlToken:process.env.NOVEL_CONTROL_TOKEN});break;}catch(e){if(!/已有运行中的云端执行器/.test(e.message)||Date.now()>startupDeadline)throw e;await new Promise(resolve=>setTimeout(resolve,5000));}}
const port=Number(process.env.PORT||8080);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('端口无效');
await service.listen(port,'0.0.0.0');console.log('Novel Factory independent cloud ready; only previously authorized active tasks can continue.');
let stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(stopping)return;stopping=true;const deadline=setTimeout(()=>process.exit(1),SHUTDOWN_GRACE_MS);deadline.unref();try{await service.stop();clearTimeout(deadline);process.exit(0);}catch{process.exit(1);}});

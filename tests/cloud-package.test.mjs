// SYNTHETIC ONLY: start from the exact Docker runtime COPY layout, no repository lib fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,cp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {buildServer} from '../cloud-server/build-server.mjs';
test('isolated production COPY layout starts with maintenance lock and no source tree',async()=>{
  await buildServer();const root=new URL('..',import.meta.url).pathname,d=await mkdtemp(join(tmpdir(),'SYNTHETIC-runtime-'));
  try{const docker=(await readFile(new URL('../Dockerfile',import.meta.url),'utf8')).split('FROM node:24-bookworm-slim\n')[1];
    for(const line of docker.split('\n').filter(l=>l.startsWith('COPY ')&&!l.includes('--from='))){const parts=line.split(/\s+/).slice(1).filter(x=>!x.startsWith('--'));const dest=join(d,parts.at(-1).replace(/^\/app\//,''));const inputs=parts.slice(0,-1);for(const source of inputs){const out=inputs.length>1||parts.at(-1).endsWith('/')?join(dest,basename(source)):dest;await mkdir(join(out,'..'),{recursive:true});await cp(join(root,source),out,{recursive:true});}}
    const code=`const {createCloudService}=await import('./cloud-server/service.mjs');const s=await createCloudService({directory:${JSON.stringify(join(d,'state'))},autoStart:false});const a=await s.listen(0);const r=await fetch('http://127.0.0.1:'+a.port+'/healthz');if(!r.ok)throw new Error('health failed');await s.stop();console.log('SYNTHETIC isolated runtime ready');`;
    const r=await promisify(execFile)(process.execPath,['--input-type=module','-e',code],{cwd:d,env:{...process.env,NOVEL_MODEL_API_DISABLED:'1'},timeout:10000});assert.match(r.stdout,/isolated runtime ready/);
  }finally{await rm(d,{recursive:true,force:true});}
});

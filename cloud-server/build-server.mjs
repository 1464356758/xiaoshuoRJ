import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {adaptRoute} from '../android-standalone/runtime/adapt-source.mjs';
export async function buildServer(){
  const esbuild=process.env.NOVEL_ESBUILD_ENTRY?await import(process.env.NOVEL_ESBUILD_ENTRY):(await import('../android-standalone/runtime/build-deps.mjs')).esbuild;
  const root=fileURLToPath(new URL('..',import.meta.url));
  let source=adaptRoute(await readFile(join(root,'app/api/workspace/route.ts'),'utf8'));
  const split=source.indexOf('export const dynamic');if(split<0)throw new Error('需复核API导出边界');
  const imports=source.slice(0,split),body=source.slice(split).replace(/^export /gm,'').replace('globalThis.__novelAppResources(request)','resourcesFor(request)');
  source=imports+"\nimport {tickRunner,jobActive,refreshRunnerHeartbeat} from '@/lib/jobs.mjs';\nimport {modelCall as guardedModelCall} from '@/lib/model.mjs';\nexport {Store,tickRunner,jobActive,refreshRunnerHeartbeat,guardedModelCall};\nexport function createWorkspaceApi(resourcesFor) {\n"+body+'\nreturn {GET,POST};\n}\n';
  const out=join(root,'cloud-server/generated');await mkdir(out,{recursive:true});
  await esbuild.build({stdin:{contents:source,resolveDir:root,sourcefile:'cloud-workspace.ts',loader:'ts'},bundle:true,format:'esm',platform:'node',target:'node24',alias:{'@':root},outfile:join(out,'workspace-api.mjs'),legalComments:'eof'});
  const generated=await readFile(join(out,'workspace-api.mjs'),'utf8');
  if(generated.includes('cloudflare:workers')||generated.includes('oai-authenticated-user-id')||generated.includes('chatgpt.site'))throw new Error('云端构建仍含原托管身份依赖');
  return out;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){await buildServer();console.log('Independent cloud engine built; no hosting credentials or user data.');}

import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {adaptRoute,adaptWorkspace} from './runtime/adapt-source.mjs';
import {esbuild,postcss,tailwind} from './runtime/build-deps.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const {build}=esbuild;
const out=join(root,'android-standalone/assets');await mkdir(out,{recursive:true});
const replacements=new Map([
  [join(root,'components/app-install.tsx'),join(root,'android-standalone/web/device-panel.tsx')],
  [join(root,'components/getting-started.tsx'),join(root,'android-standalone/web/guide.tsx')]
]);
await build({entryPoints:[join(root,'android-standalone/web/main.tsx')],bundle:true,format:'iife',target:['chrome100'],platform:'browser',jsx:'automatic',minify:true,legalComments:'eof',outfile:join(out,'app.js'),alias:{'@':root},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'standalone-adapter',setup(b){b.onLoad({filter:/\.(tsx|ts)$/},async({path})=>{
  if(replacements.has(path))return {contents:await readFile(replacements.get(path),'utf8'),loader:'tsx',resolveDir:root};
  if(path===join(root,'app/api/workspace/route.ts'))return {contents:adaptRoute(await readFile(path,'utf8')),loader:'ts',resolveDir:join(root,'app/api/workspace')};
  if(path===join(root,'app/workspace.tsx'))return {contents:adaptWorkspace(await readFile(path,'utf8')),loader:'tsx',resolveDir:join(root,'app')};
});}}]});
// Build locally without a hosted Site build or Cloudflare credentials.
const cssPath=join(root,'app/globals.css');
const css=await postcss([tailwind({base:root,optimize:true})]).process(await readFile(cssPath,'utf8'),{from:cssPath,to:join(out,'app.css')});
await writeFile(join(out,'app.css'),css.css);
await writeFile(join(out,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\'; connect-src \'self\' blob:; base-uri \'none\'; frame-src \'none\'; object-src \'none\'; form-action \'none\'"><title>小说工厂 · 本机版</title><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root">正在打开本机小说工厂…</div><script src="/assets/app.js"></script></body></html>');
console.log('独立App界面与引擎已打包；未包含任何私有数据或密钥。');

// HTTP integration QA of actual built Worker; no external provider calls.
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=wranglerRequire('miniflare');
const root=resolve('dist/server'),walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const files=walk(root).filter(f=>f.endsWith('.js')).sort((a,b)=>a===join(root,'index.js')?-1:b===join(root,'index.js')?1:0);
const secret=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
const mf=new Miniflare({modules:files.map(path=>({type:'ESModule',path})),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{DATA_ENCRYPTION_KEY:secret}});
const ownerHeaders={'oai-authenticated-user-id':'integration-test-owner'};
async function post(x,headers=ownerHeaders){return mf.dispatchFetch('https://test.invalid/api/workspace',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(x)});}
try {
  await mf.ready;const db=await mf.getD1Database('DB');
  for(const sql of readFileSync('drizzle/0000_rare_tenebrous.sql','utf8').split('--> statement-breakpoint'))await db.exec(sql.replace(/\n/g,' '));
  const rootPage=await mf.dispatchFetch('https://test.invalid/');assert.equal(rootPage.status,200);const html=await rootPage.text();assert.ok(html.includes('AI商业小说工厂')&&html.includes('连接创作工作台'));console.log('PASS built Worker root HTML and app shell');
  const anon=await mf.dispatchFetch('https://test.invalid/api/workspace');assert.equal(anon.status,401);console.log('PASS missing identity rejected');
  const invalidOrigin=await post({action:'create',key:crypto.randomUUID(),input:{}},{...ownerHeaders,Origin:'https://other.invalid'});assert.equal(invalidOrigin.status,403);console.log('PASS cross-origin writes rejected');
  const key=crypto.randomUUID();const r=await post({action:'create',key,input:{title:'HTTP INTEGRATION TEST ONLY'}});assert.equal(r.status,200);const b=(await r.json()).result;assert.equal(b.totalChapters,100);const again=await post({action:'create',key,input:{}});assert.equal((await again.json()).result.id,b.id);console.log('PASS actual API project creation and idempotency');
  const settings=await post({action:'settings',input:{apiKey:'integration-dummy-key'}});assert.equal(settings.status,200);assert.ok(!(await settings.text()).includes('integration-dummy-key'));const plain=await db.prepare("SELECT data FROM records WHERE kind='settings'").first();assert.ok(!plain.data.includes('integration-dummy-key'));console.log('PASS API secret encryption and read redaction');
  const generation=await post({action:'step',id:b.id});assert.equal(generation.status,400);assert.match((await generation.json()).error,/费用调用尚未开启/);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM calls').first()).n,0);console.log('PASS generation without spending approval makes no billable calls');
  const list=await mf.dispatchFetch('https://test.invalid/api/workspace',{headers:ownerHeaders});assert.equal((await list.json()).books.length,1);const other=await mf.dispatchFetch('https://test.invalid/api/workspace',{headers:{'oai-authenticated-user-id':'other-owner'}});assert.equal((await other.json()).books.length,0);console.log('PASS persisted API state and owner isolation');
  const pwa=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));for(const icon of pwa.icons)assert.ok(readFileSync('public'+icon.src).length>100);console.log('PASS PWA manifest and both real PNG icons');
  console.log('HTTP integration checks: 8 passed. Browser interaction and live model quality not tested.');
} finally {await mf.dispose();}

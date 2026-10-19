import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

test('native UiSession on JVM: polling never renders forms; late replies cannot switch pages/books or replace newer reads',t=>{
 const dir=mkdtempSync(join(tmpdir(),'novel-v2-native-session-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const harness=join(dir,'SessionChecks.java');writeFileSync(harness,`import cn.novelfactory.personal.UiSession;
 public class SessionChecks {
  static void check(boolean ok){if(!ok)throw new AssertionError("native page ownership regression");}
  public static void main(String[] args){
   UiSession ui=new UiSession();
   UiSession.Ticket initial=ui.begin("作品","book1");ui.leavePage();
   check(ui.accept(initial,"book1"));check(!ui.render(initial,"新建","book1",true));
   UiSession.Ticket create=ui.begin("新建","");check(ui.currentPage(create,"新建"));check(!ui.current(create,"新建","auto-selected-book"));
   check(!ui.pollAllowed("新建"));check(!ui.pollAllowed("连接"));check(!ui.pollAllowed("设置"));check(!ui.pollAllowed("正文"));
   ui.leavePage();UiSession.Ticket poll=ui.begin("作品","book1");
   check(ui.accept(poll,"book1"));check(!ui.render(poll,"作品","book1",false));
   UiSession.Ticket old=ui.begin("作品","book1"),fresh=ui.begin("作品","book1");check(ui.accept(fresh,"book1"));check(!ui.accept(old,"book1"));
   UiSession.Ticket otherBook=ui.begin("正文","book1");ui.leavePage();check(!ui.accept(otherBook,"book2"));check(!ui.render(otherBook,"正文","book2",true));
   UiSession.Ticket action=ui.begin("新建","book2");ui.leavePage();ui.leavePage();check(!ui.current(action,"新建","book2"));
   UiSession.Ticket explicit=ui.begin("新建","book2");check(ui.render(explicit,"新建","book2",true));
   for(int i=0;i<300;i++){UiSession.Ticket background=ui.begin("作品","book2");check(ui.accept(background,"book2"));check(!ui.render(background,"作品","book2",false));}
   System.out.print("native session checks passed");
  }
 }`);
 const source=fileURLToPath(new URL('../android/src/cn/novelfactory/personal/UiSession.java',import.meta.url));
 const compile=spawnSync('java',['-m','jdk.compiler/com.sun.tools.javac.Main','-d',dir,source,harness],{encoding:'utf8',timeout:30000});assert.equal(compile.status,0,compile.stderr);
 const run=spawnSync('java',['-cp',dir,'SessionChecks'],{encoding:'utf8',timeout:10000});assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/checks passed/);
});

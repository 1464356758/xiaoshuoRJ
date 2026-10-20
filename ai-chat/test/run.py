#!/usr/bin/env python3
"""Run wire/HTTP checks and actual Android UI/SQLite tests; no paid provider calls.

Resolve pom.xml with Maven dependency:copy-dependencies first, then pass --deps.
The SDK35 instrumented runtime is resolved by Robolectric from Maven Central.
"""
import argparse,pathlib,subprocess,zipfile
p=argparse.ArgumentParser();p.add_argument('--deps',required=True);p.add_argument('--json-jar',required=True);p.add_argument('--output',required=True);o=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];deps=pathlib.Path(o.deps).resolve();out=pathlib.Path(o.output).resolve();out.mkdir(parents=True,exist_ok=True);classes=out/'classes';classes.mkdir(exist_ok=True)
for aar in deps.glob('*.aar'):
 with zipfile.ZipFile(aar) as z:
  if 'classes.jar' in z.namelist():(deps/(aar.stem+'-classes.jar')).write_bytes(z.read('classes.jar'))
def run(args,file=None):
 result=subprocess.run([str(x) for x in args],capture_output=True,text=True)
 if file:(out/file).write_text(result.stdout+result.stderr)
 if result.returncode:raise SystemExit((result.stdout+result.stderr)[-18000:])
cp=':'.join(str(f) for f in deps.glob('*.jar') if not f.name.startswith('android-all-instrumented-'))
sources=sorted((root/'android/src').rglob('*.java'))
run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-cp',cp,'-d',classes,*sources,root/'test/NativeChecks.java',root/'test/NativeRunner.java'])
core=out/'core';core.mkdir(exist_ok=True)
run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-cp',o.json_jar,'-d',core,*[root/'android/src/cn/aiworkspace/personal'/n for n in ['J.java','Schema.java','ApiProtocol.java','ApiClient.java','Conversation.java']],root/'test/ProtocolChecks.java'])
run(['java','-cp',str(core)+':'+o.json_jar,'cn.aiworkspace.personal.ProtocolChecks'],'protocol-results.txt')
run(['java','-Drobolectric.dependency.repo.url=https://repo.maven.apache.org/maven2','-Dworkspace.screenshots='+str(out/'screenshots'),'-cp',str(classes)+':'+cp,'NativeRunner',out/'native-summary.txt'],'native-results.txt')
print((out/'protocol-results.txt').read_text().splitlines()[-1]);print((out/'native-summary.txt').read_text().strip())

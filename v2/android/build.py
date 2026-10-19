#!/usr/bin/env python3
"""Build pure native Java Android UI with aapt2/javac/D8; no Gradle downloads or WebView."""
import argparse,hashlib,json,pathlib,subprocess,tempfile,zipfile,shutil
p=argparse.ArgumentParser();p.add_argument('--sdk-root',required=True);p.add_argument('--output',required=True);p.add_argument('--signing-dir',required=True);o=p.parse_args();root=pathlib.Path(__file__).resolve().parent;sdk=pathlib.Path(o.sdk_root).resolve();out=pathlib.Path(o.output).resolve();private=pathlib.Path(o.signing_dir).resolve()
if root.parent.parent in private.parents:raise SystemExit('Signing material must be outside repository')
platform=next(sdk.glob('*/android.jar'));tools=next(p.parent for p in sdk.glob('*/aapt2'))
def run(cmd,stdin=None):
 r=subprocess.run([str(x) for x in cmd],input=stdin,text=True,capture_output=True)
 if r.returncode:raise SystemExit(str(cmd[0])+' failed\n'+r.stderr[-10000:]+r.stdout[-2000:])
 return r.stdout
with tempfile.TemporaryDirectory(prefix='novel-v2-android-') as temp:
 w=pathlib.Path(temp);(w/'gen').mkdir();(w/'classes').mkdir();(w/'dex').mkdir()
 run([tools/'aapt2','compile','--dir',root/'res','-o',w/'resources.zip'])
 run([tools/'aapt2','link','-o',w/'base.apk','-I',platform,'--manifest',root/'AndroidManifest.xml','--java',w/'gen','--version-code','19','--version-name','2.0.0',w/'resources.zip'])
 run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-source','8','-target','8','-bootclasspath',str(tools/'core-lambda-stubs.jar')+':'+str(platform),'-d',w/'classes',*sorted(root.glob('src/**/*.java')),*w.glob('gen/**/*.java')])
 run(['java','-cp',tools/'lib/d8.jar','com.android.tools.r8.D8','--lib',platform,'--min-api','23','--output',w/'dex',*sorted(w.glob('classes/**/*.class'))])
 shutil.copy2(w/'base.apk',w/'unsigned.apk')
 with zipfile.ZipFile(w/'unsigned.apk','a',compression=zipfile.ZIP_DEFLATED) as z:
  for f in (w/'dex').glob('*.dex'):z.write(f,f.name)
 run([tools/'zipalign','-f','4',w/'unsigned.apk',w/'aligned.apk']);password=(private/'signing-password.txt').read_text().strip();out.parent.mkdir(parents=True,exist_ok=True)
 signer=['java','-jar',tools/'lib/apksigner.jar'];run(signer+['sign','--ks',private/'novel-factory-release.p12','--ks-key-alias','novel-factory','--ks-pass','stdin','--key-pass','stdin','--out',out,w/'aligned.apk'],password+'\n'+password+'\n');verify=run(signer+['verify','--verbose','--print-certs',out]);run([tools/'zipalign','-c','4',out]);manifest=run([tools/'aapt2','dump','badging',out])
 with zipfile.ZipFile(out) as z:
  assert 'classes.dex' in z.namelist();assert not any(x.startswith('assets/') or x.endswith(('.p12','.jks','.sqlite','.db','.html','.js')) for x in z.namelist())
 assert "package: name='cn.novelfactory.personal' versionCode='19' versionName='2.0.0'" in manifest
 sources={str(f.relative_to(root)):hashlib.sha256(f.read_bytes()).hexdigest() for f in root.rglob('*') if f.is_file() and 'build' not in f.parts}
 metadata={'file':out.name,'version':'2.0.0','versionCode':19,'package':'cn.novelfactory.personal','bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'signature':verify,'manifest':manifest,'sources':sources,'ui':'native-java','webview':False,'realDeviceVerified':False}
 out.with_suffix('.verification.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in metadata.items() if k not in ['signature','manifest','sources']},ensure_ascii=False))

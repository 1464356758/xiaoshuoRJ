#!/usr/bin/env python3
"""Build the offline-packaged, directly connected personal Android application.
No private data or API keys are build inputs. Signing material stays outside git.
Run node android-cloud/build-runtime.mjs first.
"""
import argparse,hashlib,json,pathlib,shutil,subprocess,zipfile
p=argparse.ArgumentParser()
p.add_argument('--sdk-root',required=True);p.add_argument('--output',required=True);p.add_argument('--signing-dir',required=True)
o=p.parse_args();root=pathlib.Path(__file__).resolve().parent;sdk=pathlib.Path(o.sdk_root).resolve();out=pathlib.Path(o.output).resolve();private=pathlib.Path(o.signing_dir).resolve()
if root.parent==private or root.parent in private.parents:raise SystemExit('Signing material must remain outside the repository')
if not all((root/'assets'/name).is_file() for name in ['index.html','app.js','app.css']):raise SystemExit('Build the embedded runtime first')
work=root/'build'
if work.exists():shutil.rmtree(work)
work.mkdir();platform=next(sdk.glob('*/android.jar'));tools=next(p.parent for p in sdk.glob('*/aapt2'))
def run(cmd,stdin=None):
    r=subprocess.run([str(x) for x in cmd],input=stdin,text=True,capture_output=True)
    if r.returncode:raise SystemExit('Build failed: '+str(cmd[0])+'\n'+r.stderr[-3500:]+r.stdout[-1500:])
    return r.stdout
run([tools/'aapt2','compile','--dir',root/'res','-o',work/'resources.zip']);(work/'gen').mkdir()
run([tools/'aapt2','link','-o',work/'base.apk','-I',platform,'--manifest',root/'AndroidManifest.xml','--java',work/'gen','--version-code','14','--version-name','0.13.0','-A',root/'assets',work/'resources.zip'])
(work/'classes').mkdir();boot=str(tools/'core-lambda-stubs.jar')+':'+str(platform);run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-source','8','-target','8','-bootclasspath',boot,'-d',work/'classes',*sorted(root.glob('src/**/*.java')),*work.glob('gen/**/*.java')])
(work/'dex').mkdir();run(['java','-cp',tools/'lib/d8.jar','com.android.tools.r8.D8','--lib',platform,'--min-api','23','--output',work/'dex',*sorted(work.glob('classes/**/*.class'))])
shutil.copy2(work/'base.apk',work/'unsigned.apk')
with zipfile.ZipFile(work/'unsigned.apk','a',compression=zipfile.ZIP_DEFLATED) as z:
    for dex in (work/'dex').glob('*.dex'):z.write(dex,dex.name)
run([tools/'zipalign','-f','4',work/'unsigned.apk',work/'aligned.apk'])
keystore=private/'novel-factory-release.p12';password=(private/'signing-password.txt').read_text().strip();out.parent.mkdir(parents=True,exist_ok=True)
signer=['java','-jar',tools/'lib/apksigner.jar']
run(signer+['sign','--ks',keystore,'--ks-key-alias','novel-factory','--ks-pass','stdin','--key-pass','stdin','--out',out,work/'aligned.apk'],password+'\n'+password+'\n')
verification=run(signer+['verify','--verbose','--print-certs',out]);run([tools/'zipalign','-c','4',out])
with zipfile.ZipFile(out) as z:
    names=z.namelist()
    if not all('assets/'+n in names for n in ['index.html','app.js','app.css']):raise SystemExit('APK assets are incomplete')
    if any(n.endswith(('.p12','.jks','.sqlite','.db','.env')) or 'signing-password' in n for n in names):raise SystemExit('Private material in APK')
meta={'file':out.name,'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'verification':verification,'package':'cn.novelfactory.personal','version':'0.13.0','minSdk':23,'targetSdk':35,'engine':'independent-cloud-v0.9','data':'own cloud SQLite','transport':'own server HTTPS','requiresChatGPT':False,'realDeviceVerified':False}
out.with_suffix('.verification.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in meta.items() if k!='verification'},ensure_ascii=False))

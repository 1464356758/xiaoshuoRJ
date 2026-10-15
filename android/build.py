#!/usr/bin/env python3
"""Build a signed personal APK from this source, without Gradle or a WebView.
Android SDK 35 platform/build-tools and JDK 17+ are required.
Signing material stays outside the repository; never include it in source/deploy.
"""
import argparse,hashlib,json,os,pathlib,secrets,shutil,subprocess,zipfile
args=argparse.ArgumentParser()
args.add_argument("--sdk-root",required=True)
args.add_argument("--output",required=True)
args.add_argument("--signing-dir",required=True)
o=args.parse_args()
root=pathlib.Path(__file__).resolve().parent
sdk=pathlib.Path(o.sdk_root).resolve()
out=pathlib.Path(o.output).resolve()
private=pathlib.Path(o.signing_dir).resolve()
if root.parent in private.parents or private==root.parent:
    raise SystemExit("Signing directory must be outside the repository")
work=root/"build";work.mkdir(exist_ok=True)
platform=next(sdk.glob("*/android.jar"))
tools=next(p.parent for p in sdk.glob("*/aapt2"))
def run(cmd,stdin=None):
    r=subprocess.run([str(x) for x in cmd],input=stdin,text=True,capture_output=True)
    if r.returncode:
        raise SystemExit("Build step failed: "+str(cmd[0])+"\n"+r.stderr[-2500:]+r.stdout[-1500:])
    return r.stdout
run([tools/"aapt2","compile","--dir",root/"res","-o",work/"resources.zip"])
(work/"gen").mkdir(exist_ok=True)
run([tools/"aapt2","link","-o",work/"base.apk","-I",platform,"--manifest",root/"AndroidManifest.xml","--java",work/"gen","--version-code","4","--version-name","0.4.0",work/"resources.zip"])
(work/"classes").mkdir(exist_ok=True)
run(["java","-m","jdk.compiler/com.sun.tools.javac.Main","-source","8","-target","8","-bootclasspath",platform,"-d",work/"classes",*root.glob("src/**/*.java"),*work.glob("gen/**/*.java")])
(work/"dex").mkdir(exist_ok=True)
run(["java","-cp",tools/"lib/d8.jar","com.android.tools.r8.D8","--lib",platform,"--min-api","23","--output",work/"dex",*work.glob("classes/**/*.class")])
shutil.copy2(work/"base.apk",work/"unsigned.apk")
with zipfile.ZipFile(work/"unsigned.apk","a",compression=zipfile.ZIP_DEFLATED) as z:
    for dex in (work/"dex").glob("*.dex"):z.write(dex,dex.name)
run([tools/"zipalign","-f","4",work/"unsigned.apk",work/"aligned.apk"])
private.mkdir(parents=True,exist_ok=True,mode=0o700)
keystore=private/"novel-factory-release.p12"
password_file=private/"signing-password.txt"
if not keystore.exists():
    password=secrets.token_urlsafe(36)
    run(["keytool","-genkeypair","-alias","novel-factory","-keyalg","RSA","-keysize","3072","-validity","10000","-dname","CN=Novel Factory Personal,OU=Personal Apps","-storetype","PKCS12","-keystore",keystore],password+"\n"+password+"\n")
    password_file.write_text(password+"\n");password_file.chmod(0o600);keystore.chmod(0o600)
else:
    password=password_file.read_text().strip()
out.parent.mkdir(parents=True,exist_ok=True)
signer=["java","-jar",tools/"lib/apksigner.jar"]
run(signer+["sign","--ks",keystore,"--ks-key-alias","novel-factory","--ks-pass","stdin","--key-pass","stdin","--out",out,work/"aligned.apk"],password+"\n"+password+"\n")
verification=run(signer+["verify","--verbose","--print-certs",out])
run([tools/"zipalign","-c","4",out])
meta={"file":out.name,"bytes":out.stat().st_size,"sha256":hashlib.sha256(out.read_bytes()).hexdigest(),"verification":verification,"package":"cn.novelfactory.personal","version":"0.4.0","minSdk":23,"targetSdk":35}
out.with_suffix(".verification.json").write_text(json.dumps(meta,ensure_ascii=False,indent=2))
backup=out.parent/"NovelFactory-Private-Signing-Backup.zip"
with zipfile.ZipFile(backup,"w",compression=zipfile.ZIP_DEFLATED) as z:
    z.write(keystore,keystore.name);z.write(password_file,password_file.name)
    z.writestr("KEEP_PRIVATE.txt","Private app-update signing material. Keep only in your private storage. Never upload to GitHub, attach to the app, or share with other people. The APK does not include this material.")
backup.chmod(0o600)
print(json.dumps(meta,ensure_ascii=False))

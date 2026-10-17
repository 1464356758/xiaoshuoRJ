# 独立安卓本机版 0.10.0

界面和V0.9创作引擎随APK打包，SQLite在设备私有目录，模型请求经原生HTTPS直接连接官方允许列表。不加载原Site，不使用ChatGPT登录、代理、托管secret或数据库。React界面由App内置WebView渲染，不是打开外部网页的快捷方式。

用户说明、价格核验、迁移与测试边界见 [独立版说明](../docs/ANDROID_STANDALONE_V010.md)。

## 构建

需要Node 24+、按根目录pnpm lock安装的依赖、JDK 17+、Android SDK35及build-tools35。无需Sites、Cloudflare账号或DeepSeek Key即可构建。

```bash
node android-standalone/build-runtime.mjs
python3 android-standalone/build.py --sdk-root /absolute/android-sdk --output /absolute/NovelFactory-0.10.0-Standalone.apk --signing-dir /absolute/private-signing
```

签名目录必须在仓外，需含原更新证书 `novel-factory-release.p12` 与 `signing-password.txt`。不重新生成或更换用户的更新签名。生成的APK、assets、build和签名材料不进Git。运行资源中不含私人稿件或真实API密钥。

```bash
node --test tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

`tests/NativePolicyCheck.java`可以在编译后的classes和SDK android.jar类路径上用JDK编译、运行；只检查URL允许列表，不发HTTP。必须另外做手机安装、WebView交互、真实API和锁屏运行验收。

## 关键边界

- `runtime/adapt-source.mjs`在构建时复用原工作台/API，替换云端资源与按钮入口；保留原预算、恢复、版本和质量门。原Site源码与生产环境不变。
- `runtime/database.mjs`把引擎用到的4个JSON路径投影到兼容列；原生SQLite把主更新和投影放进同一事务，保留单语句CAS、租约和预算保护，支持没有JSON1的旧安卓。
- `AppRuntime.java`只提供APK内精确路径，不允许WebView回落到网络。HTTPS模型请求在原生层再次按主机、方法和路径校验，不跟随重定向。
- `WritingService.java`是本人启动、通知栏可暂停的前台dataSync服务，单次约5小时；START_NOT_STICKY，不随重启自动恢复。
- 进程恢复只保留结果、把未知账单标为待核对并暂停旧任务；不自动重放收费POST。已锁正文仍可被后章读取。

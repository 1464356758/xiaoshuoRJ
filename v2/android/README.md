# 独立原生Android V2

Java原生Activity/Android控件，所有界面随APK安装，不包含WebView、HTML/JS或远程界面。不在手机运行创作任务。

Android最低23，目标35。包名cn.novelfactory.personal；版本2.0.0，版本码19。沿用原签名以及CloudVault的AndroidKeyStore别名/SharedPreferences，可覆盖安装并保留原云端连接。

构建使用既有Android SDK35和Build Tools35的aapt2、D8、zipalign、apksigner，以及JDK17。环境没有可用Gradle/Compose依赖，按用户允许的原生Java后备方案完成，不需要用户电脑。

`python3 v2/android/build.py --sdk-root /path/android-sdk --signing-dir /private/signing --output /path/NovelFactory-V2-2.0.0.apk`

私有签名目录提供novel-factory-release.p12及signing-password.txt，别名novel-factory，不能放进仓库。构建输出APK及verification.json，包括实际manifest、签名、校验与每个源码hash。

页面包括云端连接、作品/任务、规划、正文/历史、审核/实际差异、模型配置、高级角色/单价、真实请求审计、备份导出恢复。GET只在作品页轮询，不覆盖设置/编辑草稿。保存失败解除字段锁定并在按钮旁保留错误与输入；成功回读配置版本。所有长任务仅登记云端任务后返回。

尚无安卓设备/模拟器：已编译、打包、签名及静态资源/DEX核验，没有宣称按钮在真实手机上全部验收。需用户覆盖安装后实际确认手机UI与真实模型响应。

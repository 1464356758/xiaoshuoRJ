# AI工作台安装与构建

新App无中心服务器部署。用户安装AIWorkspace-1.0.0.apk后直接配置各厂商API；每家Key发往本人配置的对应Base URL。当前为独立包名cn.aiworkspace.personal，与旧小说App数据独立。

构建：python3 ai-chat/android/build.py --sdk-root <SDK目录> --signing-dir <仓库外签名目录> --output <APK>

Android SDK35 / build-tools35 / JDK17，min23。构建包含aapt2、Java、D8、zipalign、签名v1-v3、manifest/DEX与源码hash验证。签名材料不在GitHub或普通交付包。

测试依赖按ai-chat/test/pom.xml解析，再用test/run.py运行；Robolectric首次会解析SDK35的instrumented runtime。测试不调用真实AI服务。

旧小说2.0.1云端未为新产品修改；原部署固定旧commit，本文档/ai-chat目录更新不会发布新小说服务或重新启动旧任务。旧部署说明归档docs/history/novel-v2-20261020/DEPLOYMENT.md。

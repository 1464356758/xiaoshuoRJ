# 下一步与恢复入口（V0.4）

先读取README、PROJECT_STATUS、ARCHITECTURE、DEVELOPMENT_LOG、当前main及AGENTS。不能重建覆盖原Site/D1/密钥。

1. V0.4实际私有发布已成功，线上版本4；source 919d573e5bbdc9884eb821907fee83caee9d0f07，部署 appgdep_6ad04445f974819188e1090d38997f75。GitHub已回读验证。先检查此后新提交，不能重复保存或从零重建。
2. 安装已交付APK并做手机实机登录/导航/暂停/下载；它是原生启动界面＋安全浏览器混合客户端，不是离线写作引擎。
3. 在软件由本人核对模型与预算、授权费用，启动新增三章的「在此页一键连续执行」。真实模型、文学质量及签约竞争力尚未验收。
4. 正式单章＋开篇三章联合验收＋每十章全文证据阶段审核；失败用独立修订副本，不降标准或自动重启阻塞任务。
5. 根据目标平台官方当前政策核验AI适用方式、格式、披露及合同；未知项不能视为允许。签约/保底/到账需真实依据。
6. 原后台Automation_a63056dd2fac8191921bbe53b2eb5a07暂停，执行许可待处理。不得新建重复调度、冒用身份或绕过审批恢复收费执行。
7. 托管GitHub写入接口当前不可用；当前工具只读固定公开开发文档，不能上传正文/密钥或宣称已写入。保留已有GitHub工具协议与预算保护。

检查：node --test tests/engine.test.mjs；node node_modules/typescript/bin/tsc --noEmit；Sites build-site.mjs；node scripts/verify-worker.mjs。Android重建见android/build.py与docs/ANDROID.md；签名密钥仅在用户私有更新备份中，禁止提交GitHub/部署。公开仓只存源码和安全验证记录。

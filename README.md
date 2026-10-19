# 小说工厂 V2｜已构建，待部署审批

V2独立原生安卓APK2.0.0/code19与后端已完成，44/44真实SQLite/HTTP/进程中断回归通过。原作品的离线迁移与备份恢复核验通过。**生产部署被审批机制取消，当前云端仍0.14.3，V2尚未上线，手机实机未验收。**

[当前状态](PROJECT_STATUS.md) · [接续行动](NEXT_ACTION.md) · [实际架构](ARCHITECTURE.md) · [V2源码](v2/README.md) · [测试](TEST_REPORT.md) · [部署与回退](DEPLOYMENT.md)

准备部署源码：58719c77d5cc4283148c6116a459a2abfa9d88dd。下载完整源码： https://github.com/1464356758/xiaoshuoRJ/archive/58719c77d5cc4283148c6116a459a2abfa9d88dd.zip 。APK实际hash与manifest见v2/docs/APK_VERIFICATION.json。

当前云端地址仍为 https://novel-factory-cloud-production.up.railway.app 。7项具体变更已在原Railway服务暂存，等待批准；没有新建收费资源，没有恢复旧十章任务，开发0真实DeepSeek调用。APK与教程已单独交付；部署完成前安装会提示服务器尚未升级V2。

旧实现保留原目录，旧库不与新库混写；旧文档归档docs/history/pre-v2，均为历史，不能据此恢复金额门或旧三轮流程。

中断后：读取xiaoshuoRJ当前状态继续V2重建。

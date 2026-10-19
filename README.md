# 小说工厂 V2｜云端已上线

**2026-10-20 00:23（上海）：V2云端2.0.0已部署SUCCESS，实际HTTPS回读protocol2、原服务器身份、原稿和任务暂停状态通过。** 已安装V2 APK可在“连接”页点击“保存连接并读取服务器”。地址与原连接凭证沿用。

云端地址： https://novel-factory-cloud-production.up.railway.app

[当前状态](PROJECT_STATUS.md) · [接续行动](NEXT_ACTION.md) · [架构](ARCHITECTURE.md) · [V2源码](v2/README.md) · [测试](TEST_REPORT.md) · [部署与回退](DEPLOYMENT.md)

实际运行源码：bf45e33ba87276eefd116467d3f5d2fff78c128d；部署be62107d-2993-4af9-bbad-1630b45ee48c。平台实际构建元数据与运行build均为bf45e33，不能把服务配置中的58719c7当作实际运行commit；两者V2执行源码相同，后者之后仅交付状态文档变更。

独立原生安卓APK2.0.0/code19，同包名同证书。44项数据库/HTTP/进程中断测试通过；生产已核实首章8984汉字、79分、5审、6份原历史版本、30条旧调用关联。迁移后无新步骤、原十章任务stopped。生产导出备份本地恢复验证通过；开发与部署验收没有新增真实模型调用。

原生App界面与真实DeepSeek长章的手机实机验收仍待本人使用。签约和收入不作为程序测试结论。旧实现和原库保留，新库独立。过去部署取消的记录均属历史，当前不再等待同一部署审批。

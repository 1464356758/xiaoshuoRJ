# 下一步：批准已准备的V2部署，再核验

读取AGENTS、README、PROJECT_STATUS、ARCHITECTURE、TEST_REPORT、DEPLOYMENT及最近提交。完整用户要求在v2/docs/REQUIREMENTS.zh-CN.txt。不要重做已完成源码、清空旧稿或自动续跑十章。

1. 已核实Railway插件特定权限为Allow all actions，用户已有授权；不要再要求相同授权或修改插件权限。当前阻塞是accept-deploy确认流程反复返回取消，内部原因未提供。所有准备已完成，源码固定58719c77d5cc4283148c6116a459a2abfa9d88dd；7项STAGED变更/patch e0d1721a-6549-4a52-83f1-73c9707db5b4保留。目前不再循环重试相同入口；本人在Railway后台确认7项变更或平台修复确认流程后，读取部署状态继续。不要换等效写入绕过取消。
2. 项目2b3536c7-bc05-4787-9a1a-63f5396a8bfa / environment de2133f0-5546-493a-8b35-e3373bed5dce / service 8dfb074f-1290-467a-9f18-0464946c073c。保持原域名/data卷，不新建收费资源。
3. 部署前重读实时数据与在途。最后已读首章8984汉字/hash5540a0d8…、79分、5审，6历史版本、30调用，第二章无正文，原job blocked/目标10，无reserved。私有逻辑备份/真实离线迁移均完成，但不能把快照覆盖后续新稿。
4. 等待部署终态SUCCESS。若失败，读本次部署日志，修复实际原因。新入口在/data/private-backups/before-v2生成一致性SQLite+server-secrets并integrity_check，旧执行器租约须释放且无reserved；新库/data/v2/novel.sqlite，任务默认暂停。原库保留。
5. 实际HTTPS回读/healthz、受保护/api/status（version2.0.0/protocol2/原serverId/build）、/v2/state、正文hash/5审/版本/调用/密钥已存状态。迁移不能发真实模型或恢复旧十章。
6. 成功后更新文档与教程“待部署”状态，按同一文件身份替换已交付的教程/报告/交付ZIP，不重复制造多份最终文件。APK若代码未改无需重构；修改则重新编译验签，保持高版本码。
7. 手机实机与真实一章验收由本人在App明确启动。不要把合成测试或HTTP200当文学质量/签约保证。

安卓SDK、签名和连接曾在前一会话的私有路径恢复。不要把私有签名、连接凭证或用户稿件提交公开GitHub。真实APK校验见v2/docs/APK_VERIFICATION.json；旧源码和文档归档保留。

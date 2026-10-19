# 部署与回退（V2切换准备中）

使用既有Railway项目2b3536c7-bc05-4787-9a1a-63f5396a8bfa / production de2133f0-5546-493a-8b35-e3373bed5dce / service 8dfb074f-1290-467a-9f18-0464946c073c / volume ba0c3e58-1779-4eed-870f-26051f8a9bd9。保持原HTTPS地址，不新建付费服务。

尚未切换。旧服务0.14.3。V2源码v2/server/main.mjs；拟使用v2/Dockerfile和node v2/server/main.mjs。必须先完成核心回归与APK，再切换。

迁移首次启动要求旧执行器租约已释放/到期，旧calls无reserved。/data/private-backups/before-v2保存一致性SQLite、原server-secrets和校验清单，权限私有；/data/v2/novel.sqlite保存新库。迁移幂等，默认暂停。原库与备份禁止上传公开GitHub。

回退先停止V2并关闭出口，确认无在途，保留V2库。原旧库保留，不用旧二进制读取V2库。需要回退到旧部署时先恢复原数据库/保险箱快照并保持所有任务暂停；不能将V2新增稿丢失，先导出作品备份。实际部署必须观察SUCCESS并回读status/state，不将BUILDING称上线。

## 最新实际结果：审批取消，尚未上线

源码58719c77d5cc4283148c6116a459a2abfa9d88dd已准备；V2 Dockerfile/启动入口/监视路径与固定源码等7项变更在原environment暂存，patch e0d1721a-6549-4a52-83f1-73c9707db5b4。accept-deploy返回`Cancelled — the user did not approve this action. No changes were made.`，没有V2 deployment，不能报告已切换。未通过其他等价写入绕过。

原服务仍0.14.3 / SUCCESS 7ba73430-6272-41d1-8b51-6ff2df6b1db0。切换前已重新私有逻辑备份并核对首章hash/5审、6份历史稿、30调用且无reserved。原作品离线迁移及备份恢复已核验，真实生产物理备份/迁移仍待审批后运行。

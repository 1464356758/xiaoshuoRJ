# 当前部署：V2 2.0.0 SUCCESS

云端：https://novel-factory-cloud-production.up.railway.app

2026-10-20 00:23（上海）：部署be62107d-2993-4af9-bbad-1630b45ee48c终态SUCCESS，UTC完成2026-10-19T16:23:40.154Z。平台实际构建与/api/status build为bf45e33ba87276eefd116467d3f5d2fff78c128d。服务配置source.commitSha仍列58719c77d5cc4283148c6116a459a2abfa9d88dd，但不能将配置当实际来源；运行源码应以平台构建元数据与服务回读为准。两者执行源码相同。

项目2b3536c7-bc05-4787-9a1a-63f5396a8bfa / production de2133f0-5546-493a-8b35-e3373bed5dce / service 8dfb074f-1290-467a-9f18-0464946c073c / volume ba0c3e58-1779-4eed-870f-26051f8a9bd9。原域名、盘、单副本及资源上限保留，没有新增套餐或常驻收费服务。

Dockerfile：v2/Dockerfile；启动node v2/server/main.mjs；健康/healthz。实际状态2.0.0/protocol2、workerReady=true、modelApiDisabled=false。原身份/凭证保持，7项待部署变更已应用，不再等待原审批。

## 迁移与备份

迁移于2026-10-19T16:23:31.064Z完成：1书/2章/98旧记录/30旧调用，默认暂停。旧执行器停止后，新入口检查旧租约和无reserved，调用SQLite一致性backup，integrity_check通过后才启动V2。物理备份及保险箱在/data/private-backups/before-v2，清单manifest.json；该位置是私有数据，不进入GitHub。启动成功与固定源码执行顺序证明上述迁移门通过；没有另行用远程终端列目录。

旧库/data/novel.sqlite保留，新库/data/v2/novel.sqlite独立。通过/v2/state与/v2/backup实际回读首章8984汉字/79分/5审、正文hash与原稿逐字一致、6旧历史版本/30旧调用；原target10任务stopped、V2 steps0。生产导出备份已在私有本地SQLite恢复验证，默认暂停；验收0真实模型请求。

## 回退

先在V2停止任务并关闭模型调用，确认在途情况；保留V2库和导出备份。原旧库保留，不允许旧二进制读取V2库。回退原0.14.3部署前，恢复对应旧数据库/保险箱一致性快照并保持任务暂停；保留V2新增稿件，不简单回旧二进制覆盖新数据。普通文档更新不需要再次部署。

此前取消确认的记录为历史；用户权限已允许所有操作，取消内部原因未返回，不能再把取消归咎用户拒绝。本次实际部署已经成功。

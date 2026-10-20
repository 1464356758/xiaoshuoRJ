# V2实际架构

Android原生Java Activity负责界面、HTTPS控制与AndroidKeyStore中的云端连接凭证。模型密钥仅在云端AES-256-GCM保险箱中保存。沿用原云端server-secrets身份，不重新发明用户数据归属。

Node24 + node:sqlite，单副本执行器；核心代码独立于旧网页引擎。SQLite是事实来源。books/chapters/versions/reviews/jobs/steps/archive保存书、章、历史、有效审核、任务、请求步骤和完整旧记录。每章审次数是持久字段，不因配置或重启清零。数据库WAL/FULL同步、事务和执行器期限租约。

步骤状态：queued → intended → sending → responded → applied。intended/sending中断后unknown，不能自动重发。完整响应确定性本地解析失败rejected，付费结果保留；可以本人本地重验。普通继续不改变已发送身份。章节：draft → review → repair → review → accepted；初审算1，最多5次，最后按真实分数收稿标待精修。

统一出口provider.mjs只创建一次Node ClientRequest，无SDK、重定向、重试、备用模型、额外工具或长章分段。停止事务先增加运行代次并阻止新请求，再Abort等待；旧执行器不能继续。取消不承诺供应商已接受的计算零费用。分钟6次/小时60次共享限制；金额只记账，无金额门。授权可持久保存并随时关闭。

策划一次生成全书骨架和首5章，滚动边界独立请求单列。本章任务从已存路线本地整理。总监本地消费已存问题，0模型请求。写作纯正文；返修按段落ID/hash提交局部替换；复审同时读取全文与真实diff。范围验证不能证明文学改善或平台签约。

旧库/data/novel.sqlite及所有旧记录保留。新库/data/v2/novel.sqlite。启动迁移前确认旧租约失效且无reserved在途；Node SQLite online backup生成私有物理备份并integrity_check；复制原保险箱，校验hash后迁移，默认暂停。完整旧记录归档于V2私库，移植历史版本和真实计数。模型配置只在服务器解密再加密，既有授权保留但不启动任务。可移植作品备份不携带明文或密文密钥。

旧接口返回410防旧App收费，新接口/v2/state、/v2/action、/v2/versions、/v2/step、/v2/backup、/v2/export，仍需Bearer及原serverId；/api/status提供协议2连接核对。健康与进度读取永不调用模型。

## 2.0.1原生页面与候选恢复

原生UiSession校验页面代次与作品，背景进度读取独立于写操作锁，只更新进度文字。编辑页不接受轮询重建，新建/正文/未来规划输入保存在应用私有草稿中；密钥不写入该草稿。模型设置固定可见。

受保护/v2/state增加当前作品pendingSteps，/v2/step提供已保存正文候选。额外初稿重写仅允许完整、已知、被拒绝的初稿，并要求confirmExtraCall=true和baseHash匹配；任务键由源候选派生，原记录superseded但raw/usage/费用保留。每个明确新任务最多主动发送一次，成功后任务暂停；后续审核由本人继续，失败不自动重开。未知/截断结果不可走此入口。人工补全空章不创建空hash历史稿。

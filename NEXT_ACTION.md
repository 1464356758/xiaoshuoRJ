# 下一步与恢复入口（独立云端已上线）

先读README、PROJECT_STATUS、docs/RAILWAY_DEPLOYMENT.md、ARCHITECTURE、DEVELOPMENT_LOG和AGENTS。用户目标仍为手机独立App控制、自己的云端持续运行，退出手机后台仍继续，不用GPT代理；不要回退网页壳或手机挂机执行。

## 当前实际结果

- Railway 0.11.1部署e74bd347-c618-4090-b8ec-92f0b433325b已SUCCESS；运行源码da2a857915366301201e6147119b4663d79a3467，服务与500MB持久盘均在线，详情和固定ID见部署记录。
- HTTPS健康200，无凭证401，有效凭证status/workspace200，错误serverId409、跨来源POST403；服务器UUID在升级后保留，独立心跳推进。
- 安卓0.11.0可继续使用；连接资料文件NovelFactory-Cloud-Connection.txt已私下交付，控制凭证不进Git或普通聊天。部署配置NOVEL_CONTROL_TOKEN只用于私有控制鉴权；主加密密钥始终保留在私有盘。
- 209项真实SQLite/HTTP/协议/故障测试和TypeScript通过。没有真实供应商调用或手机实机操作。

## 继续工作

1. 用户在App首页填HTTPS地址和私有连接凭证，连接成功后才在模型设置填DeepSeek Key。当前服务器费用开关false、没有模型Key/作品。不要把控制凭证当模型Key，也不要要求把真实Key发到聊天。
2. 接下来验证用户手机真实连接、导入导出和模型设置；本人核实费用后先新增3章，再10章验证实际质量与账单。不要把合成程序测试当文学质量或签约验证。
3. 用户已明确授权本项目部署配置并要求直接推进，不重复问同一部署/费用授权。遇到实际工具强制审批就说明具体操作；旧审批卡片可能失效，不无限重试或换接口绕过拒绝。
4. 保留现有项目、服务、数据盘、域名、服务器身份和主密钥，不重新创建资源。更新后端前先读取当前配置、部署和任务状态；更换控制凭证不更换主密钥。当前源码固定为上面的commit，文档更新不应触发部署。
5. 正常退出/安全检查点继续原目标；调用途中崩溃、收费未知或章节未保存会阻塞核对，不自动重放。不静默升级套餐、提高预算、开启模型费用、启动旧任务、发表或签约。
6. 原网页V0.9、私有Site/D1和旧暂停调度保留，不删库或恢复旧调度。本机0.10/网页作品JSON恢复为暂停副本，不迁移旧Key与费用授权。

## 验证与开发

node --test tests/cloud-server.test.mjs；完整node --test tests/*.test.mjs；node node_modules/typescript/bin/tsc --noEmit。运行代码在cloud-server，控制端在android-cloud，复用原lib引擎与质量/预算边界。GitHub用最新head乐观锁，禁止强推；不要提交签名材料、环境、数据库、私人连接信息、API Key或未发表正文。

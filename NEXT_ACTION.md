# 继续开发入口

先读取README、PROJECT_STATUS、DEVELOPMENT_LOG、ARCHITECTURE、本文件以及GitHub main最新提交，不覆盖既有测试通过的代码。GitHub是进度事实源，托管source文档可能是发布前快照。

## 已完成交付

V0.2私有线上App：https://ai-novel-factory.qq1464356758.chatgpt.site。PWA安装入口、豆包和七家模型教程、持久job、未来大纲控制及历史已实现。33项SQLite/协议/故障测试、TypeScript、生产构建、14项Worker HTTP均通过。代码阶段GitHub commit 73d3a8dfe8d22f9e80c8cda36b42ed893a2425f2；部署source a716ac09afb00181af181e78d3e246e7e8fe22e8。恢复读main最新记录。

实际托管writer POST/GET心跳已通过，无凭据访问403；没有活动job，验证未请求模型。每小时调度已关联启用Automation_a63056dd2fac8191921bbe53b2eb5a07，Asia/Shanghai，从2026-10-08 19:00起，最多80检查点/20分钟。首次定时发生仍待观察；不要重复创建或无授权恢复用户暂停的调度。

## 接着做

1. 用户只需在软件模型设置中输入自己的API Key、当前模型ID、核实价格、决定预算并授权调用；不要从聊天索要密钥，不代购服务。当前真实API与文学案例受缺少凭据阻塞。
2. 用户有可用配置后，运行真实100章规划与开篇三章，保留用量、费用、正式审核证据和返修。文学质量、平台匹配、签约竞争力必须独立验证，不能用合成夹具代替。
3. 确认首次定时运行记录/心跳。依docs/CLOUD_RUNNER.md使用原Site服务边界；API密钥只在服务器，平台凭据只在内存和隐藏stdin。任务错误或质量/费用门阻塞时不自动重启。
4. 手机实机安装、暂停、编辑大纲、正文和导出流程验证。当前环境无control-browser技能，浏览器及实机未实测，不虚报。
5. 补齐八平台官方AI/投稿/福利/独家条件；未知项保留，不用过期攻略伪造数字。
6. 后续扩展：跨供应商角色配置、分钟级队列、手机推送、整书修订分支、本地模型。

## 部署和测试

保留.openai/hosting.json既有私有Site身份与受众，不新建、不公开。托管CLOUD_RUNNER_ENABLED=1和加密secret已应用，环境revision 2。

`node --test tests/engine.test.mjs`

`node node_modules/typescript/bin/tsc --noEmit`

`node <sites-plugin-root>/scripts/build-site.mjs`

`node scripts/verify-worker.mjs`

复用现有records schema，无新迁移；既有D1迁移不可改写。公开GitHub不能上传正文、数据库、API或平台凭据。只有实际代码改动或未决失败才需重跑相关检查；托管服务与调度成功不代替真实模型验收。

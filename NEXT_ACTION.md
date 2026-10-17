# 下一步与恢复入口（独立云端 0.11.0）

先读取 README、PROJECT_STATUS、ARCHITECTURE、DEVELOPMENT_LOG、docs/CLOUD_CONTROL_V011.md、本文件、main 与 AGENTS。用户当前明确要求：**独立手机 App 控制，运行在自己的云端，手机退出/关机仍可继续，不用 GPT 代理。** 0.10 本机版与 V0.9 网页为保留版本，不能重新交付网页壳或要求手机挂后台。

## 已完成

- cloud-server 独立 Node 24 常驻执行器、持久 SQLite、原引擎 bundle、控制鉴权、服务器身份固定、独占租约、正常恢复/不确定收费阻塞。
- android-cloud 独立安卓控制端，离线界面、原生 HTTPS、Keystore 控制凭证，没有手机创作服务；版本码 11，同证书更新 0.10。
- 205 项程序/真实 SQLite/协议/故障测试、TypeScript、16 项原生连接策略与 APK 编译签名/zipalign；合成供应商验证断开手机后持续三章、暂停、重启与未知费用保护。
- 根 Dockerfile、Compose/Caddy、部署包和配对/迁移中文说明。部署包可用 Node 24 无 npm 运行，Docker 自行构建公开 bundle。

## 实际待完成

2026-10-18最新：用户已明确继续部署，但accept-deploy工具审批被取消，返回“用户未批准，未做更改”；随后部署列表为空，20项暂存变更保留。不要再循环问相同费用授权；需要工具审批通过或用户本人在Railway应用变更，不能用live source连接等路径绕过取消。

最新：Railway有20项非破坏性待部署变更，patch 0daa56b2-7dd7-46cf-842d-d0d2301b24ee；源固定1a4aa5bb93dde348a4b63e6daec99618f77bd8bc，500MB卷ba0c3e58-1779-4eed-870f-26051f8a9bd9尚未供应。先读docs/RAILWAY_DEPLOYMENT.md，核对最新staged changes与工具审批后再accept-deploy；当前没有运行实例，不能称上线。不要重复创建资源。

1. Railway MCP 接口已加载，已经创建私有项目/production空服务/免费HTTPS域名。先读 docs/RAILWAY_DEPLOYMENT.md 的固定ID并调用 describe-service 回读；不要重复建项目、服务或域名。当前没有任何部署、持久盘或运行实例，域名已经就绪不等于后台已上线。继续部署前确认免费额度或用户明确的云费用范围；不得静默开通付费套餐。
2. 从用户源码仓库 main 根 Dockerfile 部署单个常驻服务；实际挂载 `/data`，关闭 Serverless/休眠，单副本，PORT8080，健康检查 `/healthz` 超时240秒，退出宽限150秒，生成HTTPS域名。新服务费用默认关闭、无模型密钥/小说任务。不要静默升级收费套餐或开启供应商付费调用。
3. Railway 根 Dockerfile 自动识别，当前官方已弃用旧 railway.json，新服务不要依赖它。若工具仍未加载，明确当前限制；浏览器回退需遵守当时可用浏览器工具的授权规则，不要求用户再次安装同一插件。
4. 部署后只用空库验证 HTTPS、无凭证401、身份固定、持久盘重启与后台心跳。真实合成执行验证不得接入真实供应商；源测试夹具必须保留 SYNTHETIC 标记，不能导入真实书当夹具。
5. 在自己的私有容器终端 `node cloud-server/admin.mjs pairing` 获取手机连接资料，凭证不要公开、写Git或发聊天。域名已经创建，服务仍为空，配对凭证尚未生成；APK允许直接使用该Railway HTTPS域名。
6. 手机实机安装与实际界面仍待验收；不能把编译/签名/策略测试当实机验证。旧本机作品可只读导出；网页/本机 JSON 导入云端为暂停副本，不迁移密钥、费用授权或自动启动旧任务。
7. 用户本人填可用 DeepSeek Key、核实模型/单价/预算并主动授权后，先三章再十章做真实文学与费用验收。当前没有真实模型调用或质量结论，不自动开启费用、提高预算、重放未知调用、发表或签约。

## 保留边界与开发

原网页 https://ai-novel-factory.qq1464356758.chatgpt.site 为 V0.9 私有版本10；原 Site/D1、未发表稿件、参考库、模型密钥及暂停的旧调度保留。不要删除/重建或恢复旧调度。新的云端不依赖原 Site 身份头、GPT 代理或托管调度。

`node --test tests/cloud-server.test.mjs` 为云端目标验证，完整套件 `node --test tests/*.test.mjs`；类型 `node node_modules/typescript/bin/tsc --noEmit`。构建控制端 `node android-cloud/build-runtime.mjs`，然后 `python android-cloud/build.py ...`；签名材料留在源码外。GitHub 更新用最新 head 乐观锁，禁止强推，不提交环境、数据库、API密钥、签名材料或私人正文。

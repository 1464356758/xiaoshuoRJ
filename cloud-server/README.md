# 当前云端0.14.2

0.14.2在原子费用预留拒绝后，只读核对并明确报告月度、单书、单章、实际分钟/小时次数或授权变化；不把它们混在同一报错。单章提示包含历史记账、本次最高预留、有效累计上限和设置入口，留空仍按2元。保护边界、费用账目、用户额度、单次请求及去重均保持；没有新增真实供应商测试。

2026-10-19本人已明确要求恢复测试，原服务NOVEL_MODEL_API_DISABLED=0且实际HTTPS维护标志false。由本人在App保存的费用授权及额度以当前配置为准，不自动恢复旧任务、提高额度或读取密钥。实际部署记录见PROJECT_STATUS。

## 以下为历史说明

# 当前云端0.14.1

维护停用仅阻止付费模型操作；settings允许更新参数和加密Key，且维护期间服务端强制保存spendEnabled=false，防止旧客户端重新启用费用。原SQLite、原任务及所有请求次数保护保持。

# 独立云端0.14.0

新协议为整章写作1次、审核1次、整章返修1次，总监根据已存意见生成本地指令，不额外调用模型。每章最多5次完整审核，低分在第5审后标记待人工精修并继续后续。保留真实gate.pass/分数/问题、受支持的事实变化及全部原稿；不自动追加联合审核。详见../docs/SINGLE_CALL_AND_FIVE_REVIEWS_V015.md。

NOVEL_MODEL_API_DISABLED=1维护锁及spendEnabled=false保持。没有恢复费用、新Key或原任务；实际终态部署见PROJECT_STATUS.md。

## 历史与部署原理

# 独立云端执行器 0.12.7

安卓 App 只负责控制与查看。任务、创作循环、模型调用、正文、费用记录和检查点都在自己的服务器；手机退出、断网或关机不发送暂停。新实例默认关闭模型费用，没有密钥，也没有任务。

0.12.7兼容不适用的空triggerQuoteId；免费审核重验同步实际任务原因。自动修订收到真实分维度和minor意见，不改变质量门、轮次或预算。

0.12.6使用有来源的审核证据编号恢复精确原文，分项评分上限明确；完整审核候选绑定基稿hash，可免费重验，不缩放分数或跳过质量门。

0.12.5保存领域校验失败的完整私有模型响应。受鉴权的acceptRepairCandidate只重验已存修订结果，检查所属章节、上下文和基稿哈希，不新增调用或轮次；仍须全文审核，兼容现有安卓控制端。

安装与 Railway 配置见 [完整说明](../docs/CLOUD_CONTROL_V011.md)。本目录不提供公网网页；安卓界面已经随 APK 离线打包。

0.12.2由程序从事实账本绑定任务书的变化起点，模型只提出目标；旧协议错误起点仍拒绝。失败任务书保留为私有候选并给出具体校验原因，不自动付费重试。真实策划与首10章详纲已经保存，实际正文与审核进度见[接入验证](../docs/DEEPSEEK_TIMEOUT_FIX_V0121.md)。

0.12.3结构化策划/合同/审核允许最多16000输出token，遵守用户更低配置和原费用预算。截断/无效JSON保留私有响应候选，不自动重发；兼容现有手机端，无需新APK。

## Railway

仓库根目录 `Dockerfile` 自动识别，无需运行原网页的 pnpm build。创建一个常驻服务，挂载持久 Volume 到 `/data`，设置 `DATA_DIR=/data`、`PORT=8080`，关闭 Serverless/休眠，单副本，健康检查 `/healthz`，超时 240 秒，停止宽限 350 秒。生成 HTTPS 域名，目标端口 8080。

0.12.1将创作请求从100秒改为5分钟；检查点与任务租约、过期费用预留回收和停机宽限同步调整。DeepSeek结构化策划与审核显式使用低强度思考及JSON模式，正文关闭思考。等待模型期间仍更新独立心跳。超时不自动重放，保留未知费用预留与已保存稿件；兼容现有0.12.0手机端，无需重新配对。

`railway.json` 旧配置方式已被 Railway 弃用，因此本项目采用根 Dockerfile 与服务设置。挂载盘、休眠开关与域名必须实际配置，不能只上传源码就认定完成。

只在部署后的私有容器终端读取配对资料：

```bash
node cloud-server/admin.mjs pairing
```

把服务器 HTTPS 地址和连接凭证填入 App。连接凭证不是 DeepSeek API Key，不要提交 GitHub 或发到聊天。

也可由部署者通过私有环境变量 `NOVEL_CONTROL_TOKEN` 配置随机32字节base64url连接凭证（43字符）。服务取得独占执行器租约后才更新控制凭证，并原子写回私有保险箱；保留服务器UUID、加密主密钥、模型配置与作品。变量移除后沿用已保存凭证，改变变量需要重新部署；API和日志不返回该值。此方式便于仅用手机配对，无需用户操作服务器终端。

## 普通云服务器

服务器已有 Docker Engine / Compose，域名解析到服务器，开放 80/443：

```bash
bash cloud-server/deploy.sh novel.example.com
```

将示例域名换成自己的。Caddy 管理 HTTPS，API 不公开裸端口。读取连接资料：

```bash
cd cloud-server
docker compose --env-file .env -f compose.yaml exec -T api node cloud-server/admin.mjs pairing
```

## 已构建部署包直接运行

交付 ZIP 带有公开源码生成的 `cloud-server/generated/workspace-api.mjs`。Node.js 24 环境无需 npm 依赖即可启动：

```bash
DATA_DIR=/absolute/private/novel-data PORT=8080 node cloud-server/main.mjs
```

须由自己的 HTTPS 反向代理转发到 8080，不能让手机使用明文 HTTP。Git 源码需先构建该 bundle：本仓已有开发依赖时运行 `node cloud-server/build-server.mjs`；Docker 会自行构建。

## 持久数据与恢复

- `/data/novel.sqlite`：作品、任务、版本、加密模型配置和费用预留。SQLite WAL / FULL 同步。
- `/data/server-secrets.json`：服务器身份、控制凭证与加密主密钥。必须与数据库一起保留；不要把它放源码或公开下载链接。
- 正常重启继续原先已授权且无在途步骤的任务。调用途中崩溃则阻塞核对，未知收费不自动重放；安全退出等待当前检查点。
- 远程暂停停止下一步骤；已发出的供应商请求可能完成并计费。关闭手机或断开连接不等于暂停。
- 停服务后备份整个数据盘；运行中复制单个 sqlite 文件不是完整备份。App 的 JSON 备份用于稿件迁移，不携带模型密钥或原费用授权。

检查：`node --test tests/cloud-server.test.mjs`。测试为真实 HTTP / SQLite 与明确标注的合成供应商，未调用真实模型。

# 独立云端执行器 0.12.1

安卓 App 只负责控制与查看。任务、创作循环、模型调用、正文、费用记录和检查点都在自己的服务器；手机退出、断网或关机不发送暂停。新实例默认关闭模型费用，没有密钥，也没有任务。

安装与 Railway 配置见 [完整说明](../docs/CLOUD_CONTROL_V011.md)。本目录不提供公网网页；安卓界面已经随 APK 离线打包。

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

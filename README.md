# AI商业小说工厂

面向安卓和电脑的私有小说创作工作台。**当前为线上V0.2，软件流程已测试，尚未通过真实模型与商业小说质量验收。**

线上地址：https://ai-novel-factory.qq1464356758.chatgpt.site

[安装、豆包和其他模型接入教程](docs/USER_GUIDE.md) · [云端调度维护说明](docs/CLOUD_RUNNER.md)

## 使用

1. 打开已发布私有网址并用自己的ChatGPT账户访问。
2. 在「模型设置」填写服务商、模型名、API密钥、人民币最高单价和费用上限。密钥在服务端加密保存，不发到聊天。不同模型使用最高输入/输出单价。
3. 创建小说：默认100章、每章9000汉字；可指定平台/方向。
4. 点击启动云端创作（先选新增三章）：比较选题、建立全书规划、场景合同、分段写作、全文审核、最多三轮返修。
5. 在工作室查看原文审核证据、编辑、下载TXT定稿和完整JSON备份。启动云端任务后关闭App也会由每小时调度分批推进；重新打开可查看进度或暂停。

不开启费用调用则不会调用模型。服务商免费额度和实际账单由服务商决定。没有保证免费模型能够达到签约质量；签约和稿费均不能保证。

## 已实现

- 控制台、章节编辑器、搜索、大纲人物、事实/伏笔账本。
- 豆包/火山方舟、DeepSeek、OpenAI、OpenRouter、SiliconFlow、Moonshot、Groq兼容接口；可分别配置策划、写作、审核模型。
- 规划、逐段生成、全文审核与85分证据门；重复文本、剧情指纹、事实矛盾、删除测试、三轮返修上限。
- D1数据库、CAS租约、正文hash、历史版本、幂等创建、备份校验与恢复；已有后章时禁止改坏前章事实。
- 单书/月度/单次费用上限；超限停止、未知调用费用保留预留额。
- 平台资料快照和解释评分、投稿反馈、收入四种状态、直接成本与净收益。
- 可安装PWA、安装入口与教程，不缓存私人API或稿件；持久云端任务按每小时调度分批推进，不依赖页面。
- 大纲版本和未来章节/阶段编辑，保护已开始合同、阶段与锁定事实。

## 当前验收边界

| 要求 | 状态 |
|---|---|
| 新建项目、规划结构、章节生成审核保存、编辑导出 | 合成夹具流程通过；真实模型待验证 |
| 9000字片段检查点、中断/重启/并发恢复 | 真实SQLite测试通过 |
| 明显重复与结构化连续性冲突 | 程序故障用例通过；语义质量依赖模型 |
| 预算、密钥、数据隔离与旧版本保护 | 自动测试通过 |
| 手机界面 | 响应式实现完成；实际浏览器操作待验证 |
| 真实前三章与投稿竞争力 | 未完成；需要可用模型及费用授权 |
| 八个平台规则 | 官方资料快照部分核验，缺失项明确保留 |
| 云端定时创作 | 持久任务、并发/重启/暂停/费用/质量故障测试通过；托管调度接通结果见开发状态 |
| 整书修订分支、本地模型 | 未实现 |

测试夹具不会显示成真正小说，也不会被拿来宣称签约质量。

## 开发运行

Node.js 24+。安装现有锁定依赖：`corepack pnpm install`，或执行 `node scripts/install-ci.mjs`。

建立忽略的 `.env.local`（本地预览）或 `.dev.vars`（Wrangler本地Worker），设置 `LOCAL_DEV=1` 以及一个随机32字节base64 `DATA_ENCRYPTION_KEY`。不要把这些文件提交。

`pnpm db:generate` 生成新迁移；现有迁移不要重写。`pnpm build` 构建Worker，参考生成的 `dist/server/wrangler.json` 本地应用迁移：

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_rare_tenebrous.sql
pnpm dev
```

托管使用Sites插件，由 `.openai/hosting.json` 的项目身份绑定私有Site、D1和托管secret。生产不得设置LOCAL_DEV。裸Worker公开部署需要额外身份鉴权，不能信任客户自带身份头。

## 检查

```bash
node --test tests/engine.test.mjs
node node_modules/typescript/bin/tsc --noEmit
pnpm build
```

测试SQLite是真数据库，合成正文只是流程夹具，不是小说样章。

## 开发恢复

新会话读取 `PROJECT_STATUS.md`、`DEVELOPMENT_LOG.md`、`NEXT_ACTION.md`、`ARCHITECTURE.md`、本README与main提交历史，然后继续。禁止从零覆盖。敏感运行数据不存公开GitHub。

源码入口 `app/workspace.tsx`；领域流程 `lib/engine.mjs`；质量门 `lib/quality.mjs`；预算 `lib/model.mjs`；数据库schema `db/schema.ts`。原仓初始化README已保留在初始Git历史。

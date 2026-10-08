# AI商业小说工厂｜V0.2 架构

响应式 React 19 / Vinext + Cloudflare Worker，Sites 私有访问，D1 SQLite 持久化。源码同步到用户 GitHub；托管源码另有部署镜像。未发表正文只在私有数据库与用户下载的备份中。

## 模块

- `app/workspace.tsx`：控制台、手机侧栏、编辑器、规划/事实账本、平台、投稿、收益、模型配置。
- `app/api/workspace/route.ts`：同源校验、平台身份、所有写操作与导出。
- `lib/engine.mjs`：规划 → 场景合同 → 分段写作 → 全文审核 → 返修/锁定。
- `lib/quality.mjs`：字数、文本shingle相似度、重复段落、剧情指纹、事实from/to、删除测试、评分证据门。
- `lib/prompts.mjs`：分阶段职能，不需要六个独立实例。
- `lib/store.mjs`：D1预编译SQL与CAS版本校验。
- `lib/model.mjs`：七类兼容服务（含豆包Ark的max_completion_tokens/关闭思考）、AES-GCM密钥、人民币预算预留及token结算。
- `lib/backup.mjs`：检查哈希、独立副本恢复、幂等导入与部分恢复续跑。
- `lib/platforms.mjs`：官方资料快照、未知项降权和可解释评分。

## 数据与任务

`records`存储book/chapter/version/audit/settings/log/submission/income/expense/rule，owner隔离。正文按章保存，历史版本另存，不把全书塞进一个数据库行。

每个模型步骤先CAS获得130秒租约再执行，模型请求100秒超时。保存时校验租约token并CAS提交；旧进程结果不能覆盖新进程。每次请求只完成一个检查点。每章正文和状态在同一record原子更新。后续事实由锁定章节按序重建，不依赖聊天上下文。

正文每约1600汉字分段，9000字通常六段。此前成功片段不重新生成。审核满85且核心≥14、原文证据完整、无关键缺陷才锁定；最多三次自动返修。每10章进行阶段全文审核。此版本仍由配置模型执行语义判断，不能把自评分解释为实际签约能力或全网原创证明。

费用使用微元整数。发HTTP前条件INSERT预留最高输入/输出成本，同时检查单书/月度额度。输入token以UTF-8字节数加协议余量保守估计。超限不发请求；无usage/超时/不确定响应保留预留额。多个模型必须按配置的最高单价核算，费用以第三方实际账单复核。失败请求不会自动无休止重试。

## 安全边界

- 生产身份来自私有Sites分发的`oai-authenticated-user-id`，无身份拒绝API。Sites私有访问负责过滤外部伪造身份；不应脱离该分发边界公开裸Worker。
- `DATA_ENCRYPTION_KEY`是生产托管secret。API密钥只以AES-GCM密文写D1；GET配置和备份不返回密文或明文。
- 模型地址固定允许列表、重定向拒绝，不能任意访问用户输入URL。
- `.env*`、数据库、构建输出、正文、私有样本不提交GitHub。
- service worker只缓存离线说明和公开图标，不缓存API和稿件页面。
- 定稿不能直接覆盖；已有后续章节时拒绝解除前章锁定。整书重写分支尚待实现。
- 投稿记录是本地管理；没有发送、发表、签合同或收款自动化。

## 已知限制

持续创作已改为持久job及独立云端runner，每小时唤醒并分批执行80个检查点或20分钟。没有实现手机推送、分钟级实时队列或24小时无间隔运行。

全书合同目前单次规划，超长300章规划可能超过供应商输出限制，截断结果会拒绝提交。后续应拆分阶段合同规划。长章节修订单次上限16000输出token，截断会保留旧稿。

部分平台有反爬或登录限制，八个平台的完整政策仍未核实。未知AI政策不认定允许；晋江已知限制不适用于自动正文流程。尚无能证实签约竞争力的真实模型案例。

## V0.2 云端执行与大纲控制

`lib/jobs.mjs`登记和推进用户明确启动的任务，job、书和章有独立CAS租约。任务固定模型配置和大纲revision；更改会阻塞旧任务，检查后重新start。达到目标/预算/错误/质量门时停下。页面每8秒只读取进度，不负责模型循环。

`app/api/runner`只接受固定tick动作，依赖已确认owner-private Sites分发服务凭据边界，不伪造用户身份；仅推进已由各owner登记的job。运行维护详见docs/CLOUD_RUNNER.md。公开或裸Worker不可复用这个共享端点。

PWA安装入口通过beforeinstallprompt/appinstalled/standalone检测；不把接受安装提示当成安装完成。未产出Android APK。

未来大纲编辑保存planVersion/hash，禁止覆盖任何已开始章节合同或已开始阶段。guidanceFromChapter防止后续方向改写当前未完成章。完整备份含大纲历史，恢复后不自动运行。

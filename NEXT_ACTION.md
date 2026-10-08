已上线私有软件：https://ai-novel-factory.qq1464356758.chatgpt.site

# 继续开发入口

先读取本文件、PROJECT_STATUS.md、DEVELOPMENT_LOG.md、ARCHITECTURE.md、README.md以及main最近提交；检查现有工作而不是重建。

## 优先下一步

1. 保留现有私有Site身份 `.openai/hosting.json`，不得再次注册Site。通过Sites托管技能打开既有源码并继续。
2. 使用实际API凭据之前必须由用户在软件模型设置中配置并开启费用调用；不要从聊天索要明文，不开通付费服务。未配置时可做零费用软件测试。
3. 获得可用模型后，实际运行100章故事规划与前三章，保留请求用量、审核证据、返修与成本。严格区分流程夹具通过和文学质量验收；不能拿合成测试代替小说。
4. 补齐实际手机浏览器操作验证；本次受环境缺少control-browser技能影响，不能标为通过。
5. 八个平台继续从官方核实投稿/福利/AI/独家；优先番茄与七猫，起点等反爬失败项保留未知。不用过期自媒体补齐数字。
6. 后续优化：分阶段规划合同、服务器持久队列、第三方账单核对、语义重复独立校准、整书修订分支。

## 常用验证

`node --test tests/engine.test.mjs`

`node node_modules/typescript/bin/tsc --noEmit`

`node <sites-plugin-root>/scripts/build-site.mjs`

新D1 schema改动先`pnpm db:generate`，核验SQL再构建和发布。已应用迁移不可改写。

源码写GitHub main须保护已有历史并先读取最新head；可用GitHub create_tree/create_commit/update_ref（expected_sha）提交，不能强推。生产数据库、正文及任何凭据禁止进入公开仓库。

当前唯一需要用户的操作：进入模型设置，输入自己的API密钥、核实人民币单价和额度，并自主决定是否开启费用调用。真实小说与签约质量验证必须在这之后进行。无需用户处理普通技术设计。

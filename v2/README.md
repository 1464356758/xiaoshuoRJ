# 小说工厂 V2

独立安卓原生Java界面 + Node.js 24 LTS + SQLite。没有网页壳、GPT代理或手机执行器。

开发分支：`rebuild/v2-20261019`。旧实现保留原目录，旧盘 `/data/novel.sqlite` 不与V2库 `/data/v2/novel.sqlite` 混写。

- 运行：`node v2/server/main.mjs`（设置 DATA_DIR、PORT、PUBLIC_ORIGIN）
- 测试：`node --test v2/test/*.test.mjs`
- 安卓：`python3 v2/android/build.py --sdk-root <Android SDK> --signing-dir <仓库外私有目录> --output <APK>`
- 核心：server/store.mjs / engine.mjs / provider.mjs / quality.mjs / config.mjs / service.mjs / migrate.mjs / backup.mjs。
- 一章正文1次、审核1次，每轮返修1次再审核1次；规划单列，总监0次。正常两次，五审最多十次，规划另计。
- 禁止自动重发、备用模型、SDK重试、流重连和付费JSON修补。发送意图后未知则停机核对。
- 审核成绩和问题原样保留，第五审不达85仍按上限收稿并标记待人工精修。程序测试不证明文学质量或签约。

DeepSeek模型与参数核实于2026-10-19：官方当前模型deepseek-flash / deepseek-v4-pro；模型ID可编辑。最大输出393216 token，上下文1M，默认非思考，长章默认24000输出token。来源： https://api-docs.deepseek.com/zh-cn/quick_start/pricing/ 和 https://api-docs.deepseek.com/zh-cn/api/create-chat-completion 。单价可空；高峰/空闲价格不同，估算不是官方账单。当前不强填价格，不以金额阻塞。

所有公开测试数据明确为合成，不将真实稿件、供应商响应、数据库、API密钥或签名材料提交GitHub。

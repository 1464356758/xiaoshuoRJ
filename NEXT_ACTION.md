# 下一步与恢复入口（V0.8）

先读README、PROJECT_STATUS、ARCHITECTURE、DEVELOPMENT_LOG、docs/DEEPSEEK_WORKFLOW_V08.md、main和AGENTS；保留原Site/D1/密钥与未发表稿件，不从零覆盖。以PROJECT_STATUS末尾实际发布记录为准。

1. 本轮实现DeepSeek主写、四档案、分段边界与成长记忆，待补记最终私有发布及固定主写偏好应用结果。不要把本地成功当线上已更新。
2. 用户已明确授权把主写换为DeepSeek。固定切换只复用已存DeepSeek加密key并使用9/27元/百万token高峰最高价；没有key明确needs_key，仍切断旧作者回退。预算、spendEnabled、审核、作品和任务不重启。服务入口只允许单真实owner的原私有Sites。
3. 背景自动调度继续暂停。不以开发验证为由开费、提预算、跑真实模型或恢复任务。服务凭据仅内存/隐藏stdin，不落盘/参数/日志；不伪造用户身份。
4. 下一轮由本人核对费用并启动新增三章，记录真实usage、返修率、有效万字成本、盲读意见。程序引文/哈希与85分不能证明文学质量或签约；再验证至十章及第11章滚动承接。
5. 新书创作协议1，旧稿和旧备份保留原协议，不自动重新审核或给原稿补造behavior/readerJourney。修订分支继承原协议、重建自身事实，不混用下游。
6. 指定抖音评论需要登录，当前没有读到。以后取得评论截图/可用权限后再补分析，不能编造网友共识。B站视频无逐字稿时只引用可核实标题/简介，公开专栏的商业推广和收益自述不视为结果证据。
7. 手机仍用Android0.4原入口；真实安装/登录/交互待验。无control-browser时按Sites技能跳过Site浏览器QA，不另起预览。
8. 平台政策AI适用性、实际签约、保底及合同需真实当前依据；不自动投稿、签约、授权版权，不把外部检测当政策许可。

验证命令：node --test tests/*.test.mjs；node node_modules/typescript/bin/tsc --noEmit；Sites build-site.mjs；node scripts/verify-worker.mjs。只用标明合成的夹具，不用私人稿件/真实key。签名材料仍在仓外。

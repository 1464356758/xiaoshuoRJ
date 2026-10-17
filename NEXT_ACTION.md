# 下一步与恢复入口（V0.9）

读取README、PROJECT_STATUS、ARCHITECTURE、DEVELOPMENT_LOG、docs/STYLE_WORKFLOW_V09.md、main与AGENTS。保留原Site、D1、密钥、私有参考和未发表稿件，不从零覆盖。以PROJECT_STATUS末尾实际发布记录为准。

1. V0.9参考/文风、同题两版试写、匿名审核及本人采用已实现。179项SQLite/协议测试和56项构建Worker HTTP已通过；最终构建、打包、GitHub同步与私有发布完成后补记实际commit/version。未发布前保留线上V0.8版本9。
2. 用户可从「参考与文风」导入本机TXT候选或粘贴片段。导入/查看不请求模型；需本人核对可用密钥、型号、最高单价、预算和费用授权后主动分析或试写。当前已知作者偏好DeepSeek V4 Pro/needs_key，开发不读取或使用真实付费配置。
3. 不恢复原暂停调度，不自动开始小说job，不开费或提预算。文风采用只对下一未开始章生效，未改原稿和三轮返修门。
4. 后续真实实验按同题比较阅读效果、人物/因果缺陷、实际费用；模型匿名偏好不是盲读读者结论，更不代表签约或保底。正式创作先三章、再十章验证。
5. 不重放不确定收费POST；文风模型/故事版本变化后不能自动续跑旧实验。保留已保存稿与费用，核对后由本人决定新实验。恢复/修订副本暂停，导入实验不可直接作为新采用依据。
6. 服务凭据只放内存与隐藏stdin，不写文件、命令参数或日志。GitHub只有源码与安全状态，私有参考和稿件不入公开仓库。
7. Android0.4混合入口继续打开同一私有Site，更新无需重打包；无control-browser时按Sites技能跳过浏览器QA，不启动替代预览。真实手机操作和模型响应尚未验证。
8. 原V0.8/B站/抖音核查及平台规则边界见既有文档。指定评论仍未读到，不能编造。保持原规则、正式质量门及独家/投稿边界，不自动发表、签约或授权版权。

验证：node --test tests/*.test.mjs；node node_modules/typescript/bin/tsc --noEmit；Sites build-site.mjs；node scripts/verify-worker.mjs。签名材料和真实运行数据留在源码外。

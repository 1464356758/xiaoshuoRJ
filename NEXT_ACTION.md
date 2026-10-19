# 接续V2

读取AGENTS、README、PROJECT_STATUS、ARCHITECTURE、TEST_REPORT、DEPLOYMENT和分支最近提交。用户要求全文已在本次上传执行，核心要求见v2/README；不中途要求用户反复“继续”。

1. 完成持久发送意图前后、HTTP前后、响应保存前后的崩溃与恢复测试；修复真实问题，不增加模型重试。
2. 实现v2/android原生Java界面与SDK命令行构建。原SDK和签名均已恢复到仓库外私有目录，不上传公开仓库。保留原包名和CloudVault连接身份，版本码大于18。
3. 用实际最终APK核验manifest、签名、资源和源码hash。无安卓设备时明确实机未验收。
4. 部署前重读实时数据，不以本页快照覆盖新稿。原服务无在途后，备份SQLite与server-secrets，在私有/data备份位置校验；迁移至/data/v2/novel.sqlite。默认暂停，不启动旧十章。
5. V2使用独立Docker入口；更新原服务，等待SUCCESS并回读受保护接口、原稿hash、审核次数、历史稿和调用记录。无真实供应商调试。
6. 将最终APK、手机一页教程、公开源码包和真实测试报告持久交付。同步main前读取最新head、使用CAS，禁止强推。

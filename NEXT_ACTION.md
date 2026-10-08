# 继续开发入口

先读取GitHub main的README、PROJECT_STATUS、DEVELOPMENT_LOG、ARCHITECTURE、本文件和最近提交；主仓1464356758/xiaoshuoRJ是进度事实源。不能从零覆盖，托管source文档可能是发布前快照。

## V0.3本轮

分批长篇规划、规划进度/骨架预览、启动条件提示、单书预算调整已完成。43项SQLite/协议/故障测试、TypeScript、生产构建和18项Worker HTTP均通过，测试为合成夹具。V0.3私有发布已成功，get_site确认线上版本3；实际source和部署结果见开发记录。

既有私有Site appgprj_6ac7543090988191a801103993b08416，网址 https://ai-novel-factory.qq1464356758.chatgpt.site。已有每小时任务Automation_a63056dd2fac8191921bbe53b2eb5a07，实际心跳ticks=2/3已读回，当时没有活动小说job、没有模型请求。不要新建Site、重复创建调度或替用户恢复暂停任务。

## 恢复后

1. 先确认本轮GitHub提交与实际V0.3私有部署是否成功；若发布中断，恢复同一Site与源码，不重复保存已经返回saved_version_id的版本。
2. 用户在软件模型设置安全填写Key、当前模型ID、核实价格和费用上限，自行确认费用。不得从聊天索要密钥或替用户开费。
3. 配置后进行真实100章规划与开篇三章。新规划先存圣经/阶段，再每批10章；全部完成前没有正文。保存用量、费用、全文审核证据，不能用合成夹具代替。
4. 在手机验证安装、退出后进度、暂停、未来大纲、预算、编辑与导出。当前缺少control-browser，未进行浏览器及实机操作，不虚报。
5. 补齐八平台官方AI/投稿/福利/独家条件，未知项保留。其后考虑跨供应商配置、分钟级队列、整书修订分支和本地模型。

## 检查

`node --test tests/engine.test.mjs`

`node node_modules/typescript/bin/tsc --noEmit`

`node <sites-plugin-root>/scripts/build-site.mjs`

`node scripts/verify-worker.mjs`

复用records schema，无新迁移；既有D1迁移不可改写。公开GitHub只存代码、教程与安全状态，不能存正文、数据库、用户反馈敏感附件或任何凭据。仅有源码变化或未解决错误再跑相关检查。真实模型、文学质量、实机体验和签约都仍是独立验收项。

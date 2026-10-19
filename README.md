# 小说工厂 V2.0.1｜表单与候选恢复修复

2026-10-20 04:06（上海）：V2云端2.0.1已上线，部署56e73456-f527-4999-a6b1-137592ebff6c SUCCESS，实际build baf6612ce8150086acc577f3b523132193dc6053。APK2.0.1/code20需覆盖安装，云端地址和凭证沿用。

修复新建/编辑页被5秒轮询切回的问题，后台只更新进度文字，固定显示“模型设置”。本机保留表单与编辑草稿。短候选可直接查看、载入人工编辑或明确额外重写一次；新重写成功后先暂停，点击继续才审核。原稿、候选、usage与五审次数保留。

生产回读：首章8984汉字/79分/5审与全部备份checksum在部署前后完全一致；第二章4587字候选仍在，canRegenerate=true。现有1条V2真实请求为本人此前启动的短稿，任务blocked/target2/generation2。此次修复部署0真实模型调用，无自动续跑。52项自动检查通过，最终相关8项通过；原证书及APK源码hash验证通过。手机实机复测及新的真实长章效果仍待本人安装后使用。

云端：https://novel-factory-cloud-production.up.railway.app

[当前状态](PROJECT_STATUS.md) · [操作接续](NEXT_ACTION.md) · [架构](ARCHITECTURE.md) · [修复细节](v2/docs/V201-REGRESSION.md) · [测试](TEST_REPORT.md) · [部署与回退](DEPLOYMENT.md)

独立原生Java安卓 + Node24 + SQLite。原项目/持久卷/身份/密钥/私稿保留，无新收费资源。源码不含私人凭证和小说正文。

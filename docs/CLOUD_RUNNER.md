# 云端小说任务执行说明

V0.2，2026-10-08。项目身份保留 `.openai/hosting.json`。此说明供维护者及云端调度读取，不能从零重建。

## 运行前提

- 同一个Site active且已经发布；get_site确认当前用户是owner，受众仍为owner-private。不得改为公开或脱离Sites分发直接暴露Worker。
- 托管 `CLOUD_RUNNER_ENABLED=1`。应用API密钥来自用户在模型设置中保存的加密数据；调度不得索要、读取或输出它们。
- get_site返回可用`siwc_bypass_bearer_token`，只对该Site使用`OAI-Sites-Authorization: Bearer ...`。分发层检查并消费服务凭据，不伪造用户身份。
- 用户先在软件开启费用授权并启动一个明确目标的job。没有job时只更新调度心跳，不调用模型。

## 每次云端运行

1. 用Sites get_site重新读取同一项目，确认active、owner及原受众；不依赖作者会话、本地checkout或预览绑定。若访问或凭据不可用，停止并报告，不更换身份。
2. 用GitHub fetch_file读取 `1464356758/xiaoshuoRJ` main中的本说明及 `scripts/run-cloud-jobs.py`。这两个文件不包含凭据，调度可以从已提交版本恢复。
3. 在当前临时工作目录写入刚读到的脚本。通过Python stdin输入一行JSON `{url:<get_site.current_live_url>,token:<get_site.siwc_bypass_bearer_token>,max_steps:80,max_seconds:1200}`。令牌只放会话内存和隐藏stdin，不在命令参数、源码、文件、日志或调度prompt里。
4. 脚本对 `/api/runner` POST `{"action":"tick"}`。每个HTTP请求最多执行一个持久检查点，然后由脚本继续分批推进。它不选择owner，不输入小说正文，不改目标或大纲。
5. 读取该Site `/api/runner` GET查看lastTick作为读回；用相同服务边界。正常用户从`/api/workspace`读取自己的job、正文状态与日志。
6. 没有活动job、20分钟或80步后退出。网络不确定不自动重试该请求；下次调度用过期租约恢复。错误、质量门、价格或配置变更会阻塞任务；不替用户开费、更换模型、降低门槛或重启blocked/paused任务。
7. 不更新源码、不构建、不重新部署、不公开作品、不签合同。平常完成或空任务无需发消息；访问失效或需要用户解决的阻塞才简短报告。

## 持久状态及授权

`records.kind=job`按owner隔离，parent指向作品，固定单书job ID。字段包括明确目标、状态、租约、模型配置revision、大纲revision、步数、最后阶段、错误与时间。重复start不重置运行任务。135秒job租约配合130秒章节租约，模型请求100秒超时；CAS阻止同时推进和旧结果覆盖。

调度服务端只选择已登记的活动job。公开或裸Worker部署需要额外服务鉴权，当前共享执行端点只适用于已确认的owner-private Sites边界；当前禁止改变该受众。浏览器Origin、Sec-Fetch-Site或用户身份请求不得走服务端点，用户仅通过自身API控制任务。

暂停允许当前请求保存检查点，但不会开始下一次调用。已保存章节/片段不重写；用量未知仍计入保守预算。大纲编辑需先暂停并等待检查点，保护已开始合同和阶段；备份恢复不恢复活动调度，而是暂停独立副本。

## 调度节奏和证据

调度能力最高每小时，选择Asia/Shanghai每小时分批推进。不能宣称24小时无间隔或保证固定完成时间。创建调度成功不等于它已运行；应记录原生创建结果。首次验证必须通过真正的托管服务凭据执行writer，并由GET读取心跳，不以模拟器代替。

当前尚未配置真实模型凭据。闲置writer验证不产生模型费用；真实文学案例待用户配置后执行。所有测试夹具仅用于软件正确性，不证明签约能力。

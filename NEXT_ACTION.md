# 继续开发入口

先读取README、PROJECT_STATUS、DEVELOPMENT_LOG、ARCHITECTURE、本文件以及GitHub main最新提交，不覆盖既有测试通过的代码。

## 当前中断点

V0.2已完成PWA安装、豆包、教程、云端job、未来大纲编辑与历史；33项单元/SQLite故障测试、TypeScript检查和生产构建通过。构建Worker HTTP集成14项通过。源码在 `/workspace/sites/novel-factory`，Site身份在 `.openai/hosting.json`，已打开既有source aefdcb2cd598354d8cc8be07bed0128d2fae66ae。不能新建Site。

## 紧接着做

1. 本次14项真实构建Worker HTTP检查已通过；不需要无理由重跑，不冒充浏览器。
2. 将改版源码、教程和状态提交GitHub main，使用最新head expected_sha；不强推。
3. 通过Sites workflow打包并私有部署V0.2，原受众不变。CLOUD_RUNNER_ENABLED=1已写托管环境，部署后生效；模型API尚未配置。
4. 依 `docs/CLOUD_RUNNER.md` 真正使用get_site服务凭据调用writer并GET读取心跳；令牌只在内存和隐藏stdin，不能写入文件或命令参数。空任务验证不请求模型。
5. 再用Sites create_schedule登记Asia/Shanghai每小时批次（最多80检查点/20分钟）。先读取已有automations防止重复，创建成功与实际运行分开记录。若任一路径不可用，保留代码与准确阻塞，不能宣称后台已接通。
6. 将部署成功URL、writer验证结果、调度状态及最终GitHub提交写回开发文档。

## 完成此次交付后的下一步

- 用户只需在软件安全输入框配置自己的API Key、当前模型ID、已核实单价并决定费用上限；不要从聊天索要明文，不开通付费服务。
- 可用模型后，运行100章故事规划及真实开篇三章，保留用量、费用、审核证据和返修；文学质量验收不能用合成数据代替。
- 手机浏览器安装、暂停/大纲/编辑流程真实操作验证；当前环境缺control-browser技能仍未实测。
- 完善八平台官方政策与投稿条件；跨供应商模型、手机推送、整书修订分支后续实现。

## 验证入口

`node --test tests/engine.test.mjs`

`node node_modules/typescript/bin/tsc --noEmit`

`node <sites-plugin-root>/scripts/build-site.mjs`

`node scripts/verify-worker.mjs`

此改版复用现有records schema，无需新迁移；既有D1迁移不可改写。

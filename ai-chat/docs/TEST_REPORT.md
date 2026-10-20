# AI工作台1.0.0验证

2026-10-20 09:48（上海）：用户已停止小说软件开发，当前产品为独立安卓“AI工作台”。源码位于ai-chat，包名cn.aiworkspace.personal，版本1.0.0/code1。已完成同用户证书签名的可安装APK。

功能：项目/多对话、项目指令和TXT/Markdown参考、流式文字聊天、四种协议、多服务商与模型切换、自定义地址/模型/参数、AndroidKeyStore加密Key、本机SQLite、消息复制/代码块、停止/中断保存、前台回复服务、备份合并导入及Markdown导出、浅色/深色外观。

41项协议/本地真实HTTP检查和13项Android15 Robolectric原生UI/SQLite测试通过，包括真实按钮点击、草稿隔离、API配置保存、项目创建、单次HTTP、无自动重试、停止竞态与备份恢复。已实际渲染并检查界面。加密测试使用测试边界替身，不称真实硬件KeyStore实测；未使用真实厂商Key收费测试，也未在用户手机安装运行。

## 验证范围

协议/HTTP 41项：四种请求体/鉴权/终点、HTTPS及URL密钥拒绝、单次生成参数保护、项目参考与独立上下文、截断状态、SSE多行/CRLF/UTF8分块、真实本地HTTP单请求、断连/307/401/中断无自动重试、错误隐藏Key、Responses error:null非流式正常、Claude/Gemini流式与非流式。

Android15原生UI/SQLite 13项：启动零请求、切页保留草稿、项目/对话隔离、配置输入与未保存Key保留、实际接入/保存按钮、实际项目创建按钮、原子预留/连点防重/参数快照、数据库重开中断保留、项目文件与无Key备份、空库合并恢复不启动、迟到响应不切走表单、附件对话隔离、停止后迟到结果不可覆盖、实际界面渲染。部分场景合并于同一JUnit项。

核心输出ai-chat/docs/PROTOCOL_RESULTS.txt；原生结果ai-chat/docs/NATIVE_RESULTS.txt。测试密钥均SYNTHETIC，厂商全为本地合成HTTP；真实AndroidKeyStore使用测试替身，仅编译核验实际API，未称硬件密钥已测。

## APK

版本1.0.0/code1；包名cn.aiworkspace.personal；66013字节；SHA256 9751703333645bc7b200df68633c7563768aa4b7badd9325c88da2989acad391。原用户证书SHA256 1c913e9304e40677de03d693eabc032118f51b7145fe769563925a198c0f54ff。manifest、DEX、v1-v3签名、zipalign及全部源码hash通过。

## 未验证

用户实体安卓设备与真实厂商账户未测试；没有新增真实模型调用。模型可用性、参数兼容和费用由账户/服务商决定；按UI明确填Key后正常使用验收。没有承诺完整复刻官方ChatGPT工具或自动化能力。

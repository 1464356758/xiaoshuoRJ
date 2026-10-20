# 当前状态：AI工作台1.0.0

2026-10-20 09:48（上海）：用户已停止小说软件开发，当前产品为独立安卓“AI工作台”。源码位于ai-chat，包名cn.aiworkspace.personal，版本1.0.0/code1。已完成同用户证书签名的可安装APK。

功能：项目/多对话、项目指令和TXT/Markdown参考、流式文字聊天、四种协议、多服务商与模型切换、自定义地址/模型/参数、AndroidKeyStore加密Key、本机SQLite、消息复制/代码块、停止/中断保存、前台回复服务、备份合并导入及Markdown导出、浅色/深色外观。

41项协议/本地真实HTTP检查和13项Android15 Robolectric原生UI/SQLite测试通过，包括真实按钮点击、草稿隔离、API配置保存、项目创建、单次HTTP、无自动重试、停止竞态与备份恢复。已实际渲染并检查界面。加密测试使用测试边界替身，不称真实硬件KeyStore实测；未使用真实厂商Key收费测试，也未在用户手机安装运行。

APK SHA256：9751703333645bc7b200df68633c7563768aa4b7badd9325c88da2989acad391。原生Java，无WebView或远程页面依赖。

预置DeepSeek/OpenAI/Claude/Gemini/百炼/自定义入口，支持OpenAI兼容Chat、Responses、Claude Messages、Gemini原生协议。实际厂商访问、可用模型与API费用取决于用户账户和网络。

旧小说任务经只读检查当前无running，不新增模型调用。没有删除旧资源或覆写小说数据。

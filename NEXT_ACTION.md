# 接续AI工作台

用户已明确取消小说软件开发，继续独立的ai-chat产品。先读ai-chat/AGENTS.md、ai-chat/README.md、PROJECT_STATUS与TEST_REPORT，不恢复旧小说路线。

当前1.0.0/code1，包名cn.aiworkspace.personal，SDK35/min23，原用户证书签名。源码ai-chat/android，协议/HTTP测试ai-chat/test/ProtocolChecks.java，原生UI/SQLite测试NativeChecks.java。41协议检查+13原生测试通过，APK manifest/DEX/v1-v3签名/zipalign/源码hash核验通过。

用户安装后在API设置添加服务商、填写自己的Key、读取/手填模型并保存；聊天顶部切换模型，左侧菜单创建项目和对话。开发不请求真实模型，不嵌入旧云端凭证或私人Key。

已修复跨对话切换时旧草稿写入新对话；composerChatId必须绑定输入视图，不能拿全局当前chatId保存旧视图。流式回调只更新所属对话气泡，不重建设置表单或项目页。停止结果不可被迟到回复覆盖。

硬件KeyStore、用户手机、真实服务商账户仍需用户正常使用时验证，不将Robolectric替身测试写成真实厂商连通。图片/语音/生图/工具执行/云同步尚未实现。旧小说数据与部署保持，源码文档已归档。

后续更新源码先读取GitHub最新head并用乐观锁，不强推。APK升级需递增版本码、保留本App包名和证书。

# AI工作台架构

原生Java Activity、SQLiteOpenHelper、AndroidKeyStore、前台ChatService。手机直接HTTPS连接用户选择的服务商，无中心代理、网页登录或小说任务引擎。独立包名cn.aiworkspace.personal。

Store保存projects/providers/chats/messages/requests/files。项目说明与参考文件注入该项目每段聊天，其他对话消息不混入。composerChatId绑定输入视图，跨页/跨对话保存草稿时不写错归属。附件按对话在本次进程内保留，项目参考文件持久保存。

ApiProtocol实现OpenAI Chat/Responses、Claude、Gemini的请求与流式/非流式解析；ApiClient单次固定长度HTTP，不跟随重定向，不设应用自动重试或备用模型。SSE支持UTF8分块、CRLF、注释、多行与末尾事件，保留usage/结束原因/部分文本。错误消息隐藏Key。

点击发送先在SQLite事务中保存用户消息、空回答、不可变参数快照和queued请求；正式发HTTP前记录发送意图并改sending。前台服务执行并持久化增量，切页不重置页面。结束为done/incomplete/error；停止先持久stopped再断开等待，迟到响应不能覆盖。进程重启把queued/sending标interrupted，不自动重发。全局同时一条生成请求，其他对话可查看和编辑草稿。

Key以AES-GCM加密并由AndroidKeyStore主密钥保护。备份递归移除keyCipher/apiKey，恢复合并不覆盖已有ID，并将活跃请求与消息改为interrupted；不导入密钥或自动启动。应用数据私有、系统自动备份关闭。用户可自行导出完整备份和Markdown。

边界：文字版；TXT/MD附件与项目参考；Markdown基础排版/代码复制。没有图片/音频/视频、自动联网/工具、云端任务或多设备同步。后台前台服务受手机系统管理，强制结束进程可能中断，但不自动补发。

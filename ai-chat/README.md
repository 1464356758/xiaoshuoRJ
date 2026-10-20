# AI 工作台

独立原生安卓多服务商聊天 App，包名 `cn.aiworkspace.personal`。项目包含多段对话、项目指令和 TXT/Markdown 参考文件。支持 OpenAI Chat Completions 兼容协议、OpenAI Responses、Claude Messages、Gemini GenerateContent；模型、API地址与密钥由本人填写。

手机直连所选服务商，无账号注册或中心服务器。密钥使用 AndroidKeyStore 加密，本机 SQLite 保存消息、项目、草稿与请求记录。每次发送最多主动发出一次生成请求；读取模型列表与保存配置不生成内容，不自动切模型或重试。进程中断保留部分回答，重开不补发。

先交付文字聊天、流式回复、复制与 Markdown/代码显示、项目文件、导入/导出、模型切换和 API 配置。图片理解、生图、语音、联网工具及跨设备云同步不属于此版。

源码保存在当前仓库的 ai-chat 独立目录，旧小说代码和数据保留，停止小说功能开发。不会把原小说 API Key 或云端控制凭证嵌入新 App。

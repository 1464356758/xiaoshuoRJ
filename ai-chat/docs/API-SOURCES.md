# 协议资料

核对日期：2026-10-20。只采用官方文档；模型列表由用户账户读取，模型名可手动编辑，不承诺每个账户可用所有模型。

- OpenAI 文本与 Responses：https://developers.openai.com/api/docs/guides/text
- OpenAI 流式：https://developers.openai.com/api/docs/guides/streaming-responses
- OpenAI Responses 事件：https://developers.openai.com/api/reference/resources/responses/streaming-events
- OpenAI Chat Completions：https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
- Claude 接口/鉴权：https://platform.claude.com/docs/en/api/overview
- Claude 流式：https://platform.claude.com/docs/en/build-with-claude/streaming
- Gemini 内容生成/流式：https://ai.google.dev/api/generate-content
- DeepSeek Chat：https://api-docs.deepseek.com/api/create-chat-completion/
- 阿里百炼兼容接口与地域地址：https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope

Chat请求按选项使用max_tokens或max_completion_tokens；Responses使用max_output_tokens和store=false；Claude使用独立system、x-api-key与anthropic-version；Gemini使用contents/systemInstruction/generationConfig及x-goog-api-key，不将密钥放URL。

应用实现文字协议，不等同于ChatGPT/Claude等官方App的联网、文件执行、语音、生图与订阅权益。用户也可添加采用这四种协议的其他服务商或中转地址，服务商专属参数通过高级JSON自行配置。密钥与Base URL需匹配所属服务商、地域和账户。

// Public configuration help. Model IDs and prices are copied from each user's
// current console; this catalog never silently enables billing or sets a price.
export const providerInfo={
  deepseek:{name:'DeepSeek',console:'https://platform.deepseek.com/',docs:'https://api-docs.deepseek.com/',price:'https://api-docs.deepseek.com/quick_start/pricing',hint:'从开放平台复制当前可用的文本模型ID；聊天软件账号本身不是API密钥。'},
  doubao:{name:'豆包 / 火山方舟',console:'https://ark.volcengine.com/region:cn-beijing/apikey',docs:'https://docs.volcengine.com/docs/ark/quick-start?lang=zh',price:'https://docs.volcengine.com/docs/ark/model-pricing?lang=zh',hint:'使用火山方舟API Key，填写已开通文本模型的Model ID，或你的ep-开头Endpoint ID。选择支持max_completion_tokens和关闭深度思考的现代文本模型。'},
  openai:{name:'OpenAI',console:'https://platform.openai.com/api-keys',docs:'https://developers.openai.com/api/docs/quickstart',price:'https://openai.com/api/pricing/',hint:'复制支持Chat Completions的文本模型ID。ChatGPT订阅和API计费分开；接口连接成功不代表所有模型参数均兼容。'},
  openrouter:{name:'OpenRouter',console:'https://openrouter.ai/settings/keys',docs:'https://openrouter.ai/docs/quickstart',price:'https://openrouter.ai/models',hint:'填写完整的提供方/模型ID，例如模型详情页展示的字符串；免费模型也有速率和可用性限制。'},
  siliconflow:{name:'硅基流动',console:'https://cloud.siliconflow.cn/account/ak',docs:'https://docs.siliconflow.cn/docs/userguide/quickstart',price:'https://cloud.siliconflow.cn/models',hint:'从模型广场复制完整模型名称，保留大小写和斜杠。核实模型最大输出长度。'},
  moonshot:{name:'Kimi / Moonshot',console:'https://platform.moonshot.cn/console/api-keys',docs:'https://platform.moonshot.cn/docs/guide/start-using-kimi-api',price:'https://platform.moonshot.cn/docs/pricing',hint:'使用开放平台API密钥和可用文本模型ID；不同Kimi模型参数可能不同，先进行小额连接测试。'},
  groq:{name:'Groq',console:'https://console.groq.com/keys',docs:'https://console.groq.com/docs/quickstart',price:'https://groq.com/pricing',hint:'从控制台选择当前可用文本模型。免费层限流和模型上下文限制由供应商决定。'},
};

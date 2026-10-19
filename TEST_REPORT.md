# V2验证

`node --test v2/test/*.test.mjs`：44/44通过。真实SQLite、真实控制API HTTP、本地合成供应商HTTP，独立子进程SIGKILL五边界及隔离生产入口启动。0真实DeepSeek请求。完整输出v2/docs/TEST_OUTPUT.txt，对应故障矩阵v2/docs/FAULT_MATRIX.md。

覆盖设置/共享/独立Key/版本冲突、明确一次连接测试、完整正文与审核各一次、4轮返修各一次与五次78分后实分放行、六维增减与真实diff、旧内容不能冒充新增、同稿/标点/越界补丁拒绝、1600次实际GET零请求、并发/换nonce去重、HTTP500/429/坏JSON/截断/超时/断连不自动重发、各停止时机/旧执行器失效、关闭授权、共享频率门、未知价格无金额门、备份恢复与旧4/5审次数迁移、本地参考TXT零调用及新配置采用。

APK2.0.0/code19实际包的manifest、签名v1/v2/v3、zipalign、DEX/资源及5项源码hash通过。同包名同旧证书，无WebView/网页界面。没有安卓设备或模拟器，未称全按钮实机验收。

## 生产验收：2026-10-20 00:23（上海）

Railway be62107d-2993-4af9-bbad-1630b45ee48c达到SUCCESS。实际build bf45e33ba87276eefd116467d3f5d2fff78c128d。原HTTPS /healthz、受保护/api/status、/v2/state和/v2/backup均200，2.0.0/protocol2/workerReady=true，原服务器ID保持。

首章8984汉字、79分、5审及正文与切换前逐字/hash一致；第二章无正文；6份原历史稿、30旧调用及98条旧记录迁移。原target10任务stopped、V2 steps0，未自动恢复付费任务。最新旧报告规范化为ordinal5，原报告与历史完整记录继续在私人归档。

从真实云端导出V2完整作品备份到私有本地SQLite恢复，原hash/审次数/历史/调用保持且全部任务stopped。源代码在真实启动时完成私有物理backup及integrity_check，未另行远程列目录。生产核验没有新增真实模型请求。

真实DeepSeek长章/返修质量、完整手机实机流程、真人阅读、签约与收入尚未验收。用户报告的历史1600次/约50元未完成官方逐笔对账；本次1600GET测试不能解释该历史报告。

# 最新补丁：云端0.14.1 / 安卓0.15.1

2026-10-19T00:16:03.597Z，f3ca6201-a6fe-43b3-982b-afdf4c7c0c4f已部署终态SUCCESS，固定源码b4d393eecc00eb5f088dee57f6c410a704daa34d。仅修复维护时编辑模型/新密钥被一起锁住；settings服务端强制spendEnabled=false，实际模型入口仍维护拦截。原项目、服务、production、/data卷、HTTPS地址和UUID全部沿用。

实际HTTPS读回0.14.1/modelApiDisabled=true、费用false/revision4；真实首章8687字/78分/attempt3、原稿hash和累计23条账目与更新前一致，最近一小时0条。没有替用户填写新Key或真实模型试跑。281项程序、TypeScript和最终同签名0.15.1 APK的23项手机界面测试通过。

以下为历史部署记录。

# 当前云端0.14.0 / 安卓0.15.0

2026-10-18T23:57:28.147Z，部署386b369b-ccda-46c3-9c54-f5b7a5c707d8终态SUCCESS，固定源码05f45afcd7ecb8082d5bb324d4d393373787773b。复用原项目2b3536c7-bc05-4787-9a1a-63f5396a8bfa、服务8dfb074f-1290-467a-9f18-0464946c073c、production环境和/data原卷，1副本在线，无待应用变更。公网HTTPS来源和服务器UUID不变。

本次实现整章正文1次、每次审核1次、每轮返修1次；总监整理旧审稿意见0次请求，第5次完整审核后待人工精修放行。不自动追加联合审核。原稿、真实分数和账目保留，详见SINGLE_CALL_AND_FIVE_REVIEWS_V015.md。

维护变量NOVEL_MODEL_API_DISABLED=1仍启用，保存的费用授权false/revision4。实际HTTPS版本和维护锁已核对，startJob/testConnection均维护拒绝，部署前后23条调用和原稿hash不变，0真实模型调用。用户已删旧Key，不自动填Key或恢复旧任务。

## 历史部署记录

# Railway 独立云端｜当前实际运行记录

更新：2026-10-18（中国时间）。**独立后端0.12.8已经上线，手机连接凭证已配置并通过真实HTTPS验证。** 旧控制协议仍兼容；审核与修改新入口需要同签名覆盖安装0.13.0，保留连接。

| 资源 | 当前值 |
|---|---|
| 私有项目 | xiaoshuoRJ |
| Workspace ID | 54764e24-6f1b-4840-ad85-b21c3bcfcd1d |
| Project ID | 2b3536c7-bc05-4787-9a1a-63f5396a8bfa |
| 环境 | production |
| Environment ID | de2133f0-5546-493a-8b35-e3373bed5dce |
| 服务 | novel-factory-cloud |
| Service ID | 8dfb074f-1290-467a-9f18-0464946c073c |
| HTTPS | https://novel-factory-cloud-production.up.railway.app |
| Domain ID | 74b9c8b9-e258-463e-a497-3b0d8d0ffe6e |
| 端口 | HTTPS443 → 容器8080 |
| 持久盘 | novel-data，500MB，/data，iad，live |
| Volume ID | ba0c3e58-1779-4eed-870f-26051f8a9bd9 |
| 后端 | 0.12.8，协议1 |
| 当前部署 | 86c299d4-5e9c-4e15-bac8-43b0cf2b40f6，SUCCESS |
| 成功时间 | 2026-10-18T16:08:24.123Z（中国10月19日00:08） |
| 实际运行源码 | da5e55a4661e5606002b8e18544693dd7d2a363a |
| 服务器UUID | b9d46cf3-ee78-4731-8512-d76863b7fbbe，升级后保留 |
| 环境变量名称 | DATA_DIR、NODE_ENV、PORT、PUBLIC_ORIGIN、NOVEL_CONTROL_TOKEN |
| 运行实例 | iad单副本，CPU上限1，内存上限500MB |

管理入口：https://railway.com/project/2b3536c7-bc05-4787-9a1a-63f5396a8bfa/service/8dfb074f-1290-467a-9f18-0464946c073c?environmentId=de2133f0-5546-493a-8b35-e3373bed5dce

## 实际验证

- 部署终态SUCCESS，挂载卷和运行实例由Railway回读确认。
- 真实公网HTTPS：/healthz返回200/ok，未授权/api/status返回401；有效凭证status/workspace均200，错误服务器ID的POST返回409，外部Origin的POST返回403。
- 服务器UUID与0.11.0初次部署相同；独立执行器心跳存在，requiresPhone=false，workerReady=true。
- 当前已有1部用户作品，已保存DeepSeek Key、费用授权true；真实连接测试成功。用户原10章任务已继续，真实创作检查点验收进行中。此前“0作品/未配置Key”快照已失效。
- 当前246/246实际SQLite/HTTP/协议/故障测试及TypeScript通过。0.12.1创作请求300秒、检查点330秒、任务335秒、停机宽限350秒，等待模型时独立心跳持续。0.12.8新增一次编辑修订持久队列及审核恢复入口，最终0.13.0 APK的21项界面场景通过；真实保存响应已免费重验，首章8608字/76分，按85门槛正常blocked，尚未完成原10章目标，结果见接入验证记录。

## 手机连接与保密

私有文件NovelFactory-Cloud-Connection.txt已交付用户，其中包含HTTPS地址与连接凭证。用户在安卓App首页填两项，连接后进入模型设置填写自己的DeepSeek API Key。当前已有Key与费用授权，无需重填。模型Key不会由配置读取接口返回。

控制凭证仅存私有部署配置和数据盘保险箱，不在本记录、源码、普通聊天、API响应或日志中。NOVEL_CONTROL_TOKEN由部署者提供随机32字节base64url值；只在取得执行器独占租约后原子更换控制凭证，保留服务器UUID、加密主密钥、数据库与已有模型配置。无效值失败而不覆盖保险箱；移除变量后沿用已保存凭证。

数据灾难恢复仍需整个私有/data，尤其novel.sqlite和server-secrets.json。不得生成新主密钥覆盖旧库，也不要删卷重建。APK已用Keystore加密保管本机连接凭证。

## 授权与维护

用户已多次明确继续部署，并明确授权本项目部署配置、要求避免重复授权询问。不要循环询问相同事项；遇到工具强制审批只说明具体动作与实际结果。前期失效/取消的审批已被本轮成功部署取代，不能再声称后台未上线。

源码固定上述commit；watchPatterns限定Dockerfile/.dockerignore/cloud-server/lib/原API路由及构建适配器，日常状态文档更新不部署。服务配置维护前先读取实际源、部署、任务与卷；不要重新创建项目/服务/域名/卷。若未来变更需付费升级或超出原授权，说明具体费用后再决定。原网页Site/D1和旧暂停调度保留，不恢复或覆盖。

前期历史：初次部署524375da-a6a3-43cb-aa1e-57eba022110b（源码d3c0afebea11e3b3fcdda2b6f332727e07705a94）已被0.11.1替换，旧部署正常移除。最初20项staged patch 0daa56b2-7dd7-46cf-842d-d0d2301b24ee已提交，不应重复应用。

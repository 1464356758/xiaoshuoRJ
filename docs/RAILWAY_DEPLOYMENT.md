# Railway 独立云端接入记录

更新：2026-10-17（中国时间）。用户要求免费域名或端口接入；本轮已实际创建免费 HTTPS 域名与空服务。

| 资源 | 当前值 |
|---|---|
| Workspace ID | 54764e24-6f1b-4840-ad85-b21c3bcfcd1d |
| 私有项目 | xiaoshuoRJ |
| Project ID | 2b3536c7-bc05-4787-9a1a-63f5396a8bfa |
| 环境 | production |
| Environment ID | de2133f0-5546-493a-8b35-e3373bed5dce |
| 服务 | novel-factory-cloud |
| Service ID | 8dfb074f-1290-467a-9f18-0464946c073c |
| HTTPS 地址 | https://novel-factory-cloud-production.up.railway.app |
| Domain ID | 74b9c8b9-e258-463e-a497-3b0d8d0ffe6e |
| 域名类型 | Railway 免费服务子域名，DNS/TLS 由 Railway 管理 |
| 接入 | 外部 HTTPS 443，转发到容器8080 |
| latestDeployment | null，尚未构建或部署 |
| Source / Volume / Variables | 均为空 |
| 暂存变更 | 无 |

项目入口：https://railway.com/project/2b3536c7-bc05-4787-9a1a-63f5396a8bfa/service/8dfb074f-1290-467a-9f18-0464946c073c?environmentId=de2133f0-5546-493a-8b35-e3373bed5dce

已用 domain-status 与 describe-service 回读确认。服务 state=live 仅表示空服务资源存在，**不表示程序已经运行**。地址目前不会返回小说工厂的健康接口；后台尚未上线。

下一步使用以上既有资源接入根 Dockerfile、持久盘 /data、DATA_DIR=/data、PORT8080、关闭休眠与单副本，再验证部署成功和真实HTTPS。先确认账户免费试用/剩余额度或用户明确云费用范围；当前没有取得具体套餐/余额，不能把公开价格页当个人账户余额。域名/SSL免费不代表计算、存储、流量与DeepSeek调用永久免费。不自动购买域名、升级套餐或开启模型费用。

官方依据：[生成免费Railway域名](https://docs.railway.com/cli/domain#generate-a-railway-domain)、[HTTPS与免费证书](https://docs.railway.com/networking/public-networking)、[资源及试用定价](https://railway.com/pricing)。原APK可直接配对此HTTPS地址，最终配对凭证须在部署后私下取得。

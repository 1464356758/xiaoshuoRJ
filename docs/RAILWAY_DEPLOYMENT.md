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
| Source | 已暂存 GitHub 1464356758/xiaoshuoRJ@main，固定 1a4aa5bb93dde348a4b63e6daec99618f77bd8bc，尚未实际连接/构建 |
| Volume | 已暂存 novel-data / 500MB / /data，ID ba0c3e58-1779-4eed-870f-26051f8a9bd9，尚未供应 |
| Variables | 已暂存 DATA_DIR、NODE_ENV、PORT、PUBLIC_ORIGIN，尚未应用 |
| 暂存变更 | 20项，STAGED，patch 0daa56b2-7dd7-46cf-842d-d0d2301b24ee，非破坏性 |

项目入口：https://railway.com/project/2b3536c7-bc05-4787-9a1a-63f5396a8bfa/service/8dfb074f-1290-467a-9f18-0464946c073c?environmentId=de2133f0-5546-493a-8b35-e3373bed5dce

已用 domain-status 与 describe-service 回读确认。服务 state=live 仅表示空服务资源存在，**不表示程序已经运行**。地址目前不会返回小说工厂的健康接口；后台尚未上线。

下一步使用以上既有资源接入根 Dockerfile、持久盘 /data、DATA_DIR=/data、PORT8080、关闭休眠与单副本，再验证部署成功和真实HTTPS。先确认账户免费试用/剩余额度或用户明确云费用范围；当前没有取得具体套餐/余额，不能把公开价格页当个人账户余额。域名/SSL免费不代表计算、存储、流量与DeepSeek调用永久免费。不自动购买域名、升级套餐或开启模型费用。

官方依据：[生成免费Railway域名](https://docs.railway.com/cli/domain#generate-a-railway-domain)、[HTTPS与免费证书](https://docs.railway.com/networking/public-networking)、[资源及试用定价](https://railway.com/pricing)。原APK可直接配对此HTTPS地址，最终配对凭证须在部署后私下取得。

## 首次部署已准备，等待费用确认

本轮根据“怎么部署”准备好完整待部署变更，并已用 describe-service / get-staged-changes 回读。固定源码、根Dockerfile、node cloud-server/entry.mjs、/healthz及240秒超时、退出宽限150秒、单副本、1vCPU/500MB内存上限；新500MB持久盘挂载/data；PORT8080和PUBLIC_ORIGIN指向已创建的免费域名。请求保持非休眠与On Failure/10次，平台与默认一致的字段可能不显示为额外差异。

当前尚未调用 accept-deploy，没有构建/运行实例。四项环境变量不含凭证；未生成连接凭证、未填DeepSeek Key或开启模型费用。MCP未暴露账户套餐/剩余额度读取，当前本地也无Railway CLI，无法证实免费余额。项目AGENTS明确要求产生成本需用户决定，因此最终提交运行资源前需要用户确认云费用授权；不能把“怎么部署”的流程询问当成无上限费用授权。

用户明确确认后：先重新读取staged changes，确认还是本记录的服务和卷且没有无关/破坏性变更，再提交该环境的待部署变更；等待目标部署SUCCESS，检查HTTPS健康、无凭证401、持久盘重启保留。不要重复创建服务或数据盘。若账号需要升级/支付或GitHub授权不足，停止并报告实际提示。服务器费用与DeepSeek调用费分别控制；本轮尚未真实调用模型。

## 2026-10-18｜用户要求继续部署，提交审批被取消

用户已在聊天中明确“继续部署”；不要再次循环询问相同部署或费用授权。已重新核对原patch的20项变更、非破坏性、仅既有服务与新数据盘，随后调用accept-deploy。工具返回：Cancelled — the user did not approve this action. No changes were made.（isError=true，error_code=INVALID_ARGUMENT）。未得到workflow或deployment ID。

随后回读：patch仍为STAGED/20项，deployment列表仍为空。未实际构建、未启动实例、未生成连接凭证，没有真实模型调用。不可将此次聊天授权误写为工具审批已通过，也不可通过改用live source连接等方式绕过这次审批取消。

实际下一步：用户在工具审批流程允许本次启动，或本人在Railway项目中应用这20项待部署变更。获准后读取实际部署状态并继续故障处理；仅终态SUCCESS和健康检查成功才能说上线。源码与配置仍保留，不重新建服务/数据盘。

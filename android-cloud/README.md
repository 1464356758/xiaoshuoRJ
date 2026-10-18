# 安卓云端控制 App 0.12.0

独立 APK；React 界面随安装包离线打包，WebView 不加载托管网页。HTTPS 控制请求由原生网络发送到自己部署的云端，创作引擎运行在服务器。不需要 ChatGPT 登录、代理或手机后台服务。

手机退出、杀后台、断网或关机后，云端继续已启动的任务。想停止要在联网时点击「暂停」，并读取确认状态。

部署及使用：[云端控制说明](../docs/CLOUD_CONTROL_V011.md)。先准备服务器 HTTPS 地址和私有连接凭证，连接后在「模型设置」填写 DeepSeek 官方 API Key、核对模型/预算，主动保存费用授权，再启动任务。

## 构建

复用现有仓库依赖和安卓工具链，不需要 Gradle：

```bash
node android-cloud/build-runtime.mjs
python android-cloud/build.py --sdk-root /absolute/android-sdk --output /absolute/NovelFactory-0.12.0-Cloud-Control.apk --signing-dir /absolute/private-signing
```

构建器要求 Android 35 android.jar、aapt2、d8、zipalign 和 apksigner；签名材料在源码外。包名 `cn.novelfactory.personal`，版本码 13，与已交付 0.10 使用相同私有证书，可覆盖更新。

## 边界

- 仅 INTERNET 权限，没有前台创作服务、唤醒锁或开机自动执行。
- 只接受 HTTPS 域名的 443 端口，固定 `/api/workspace` 与 `/api/status`；不跟随重定向，使用系统证书校验。
- 首次连接校验服务类型与协议，再固定服务器 UUID；后续身份不符时不执行操作。
- 连接凭证以 Android Keystore 加密存储，界面读取只返回地址和连接状态。DeepSeek Key 通过受保护接口保存到云端加密配置。
- 网络取消不发暂停，也不自动重放 POST；重新打开读取已保存进度。
- 系统文件选择器导入/导出，提供旧 0.10 本机库只读导出；不自动复制旧密钥、费用授权或任务。

0.12.0重新审核最终APK自身的界面资源，20项手机尺寸UI+真实SQLite场景、213项程序测试、16项原生连接策略检查通过。APK版本码13，同旧包证书，支持覆盖更新。配置入口为components/model-settings-panel.tsx，APK回归入口为scripts/verify-cloud-control-ui.mjs，设置指南随包更新。详细证据见[重新审核与精修](../docs/CLOUD_CONTROL_AUDIT_V012.md)。手机实机和真实供应商验收仍未完成。

# 个人专用安卓客户端 V0.4.0

包名cn.novelfactory.personal，最低API23、目标API35。可安装APK采用原生启动界面和系统安全浏览器承载私有工作台；不宣称全原生或离线写作。只有原私有Site允许的本人ChatGPT账户能访问稿件。

构建需要JDK17及Android SDK35 platform/build-tools，无Gradle依赖。运行android/build.py，传--sdk-root、--output和仓库外--signing-dir；秘密签名材料不进仓、不进Site。保留用户私有签名备份用于后续相同应用更新，不要分享或上传GitHub。APK不含这些材料。

已实际验证编译、ZIP对齐、APK v1/v2/v3签名和包/SDK信息。手机安装、登录、浏览器回跳、暂停、导出等尚未实机验证。签名校验不能代替实机体验。

原工作台：https://ai-novel-factory.qq1464356758.chatgpt.site

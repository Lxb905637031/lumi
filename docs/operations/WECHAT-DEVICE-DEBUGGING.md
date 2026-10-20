# 微信真机接口调试

手机上的 `127.0.0.1` 指向手机本身。接口地址及服务端签发的图片上传、读取地址都必须能从手机访问。

## 本地局域网

1. 电脑和手机连接同一 Wi-Fi，确认当前电脑 IPv4 地址，例如 `192.168.1.10`。手机浏览器打开 `http://192.168.1.10:4300/api/v1/health` 应返回 `success: true`；若打不开，先检查 Wi-Fi 隔离、微信的本地网络权限及电脑防火墙。
2. 在未纳入 Git 的 `apps/miniapp/.env.local` 保存 `TARO_APP_API_BASE_URL=http://192.168.1.10:4300/api/v1`。Taro 普通构建和 watch 会读取此配置；切换网络后更新地址。
3. 按当前电脑地址启用存储的局域网端口，保留原有本机入口和数据卷：

   ```bash
   LUMI_DEVICE_HOST=192.168.1.10 docker compose -f docker-compose.yml -f docker-compose.device.yml up -d --no-deps seaweedfs
   ```

4. 停止已有 API 进程后，通过局域网存储地址启动 API。此环境变量仅作用于该进程；根目录 `.env` 中的本机存储地址仍供本地初始化和回归使用。

   ```bash
   S3_ENDPOINT=http://192.168.1.10:59000 pnpm --filter @lumi/api start
   ```

5. 关闭微信工具中的本项目，执行 `pnpm --filter @lumi/miniapp build:device`，然后重新打开本项目并重新发起真机调试。手机退出旧调试会话后重新扫码，以载入新包。

如提示“不在合法域名列表”或 HTTP/TLS 校验错误，在开发者工具详情中开启开发期的不校验域名选项，并在手机调试包的菜单开启调试。普通体验版、正式版需要配置合法 HTTPS 域名；本流程只用于局域网开发调试。

## 关闭局域网存储入口

先停止带 `S3_ENDPOINT` 覆盖值的 API，执行 `docker compose -f docker-compose.yml up -d --no-deps seaweedfs`，再用 `pnpm --filter @lumi/api start` 恢复本机模式。此操作不删除数据卷。

## 验收证据

本机通过局域网地址访问成功，只能证明服务地址和签名有效。真机通过需要手机实际登录、受保护列表读取和图片上传成功，且 API 日志出现对应请求。记录手机系统、微信版本和失败原文，不以本机 curl 或构建成功替代真机结果。

# 小程序设备上传地址联调

日期：2026-10-20

## 故障与修复

小程序通过同一私有媒体上传工作流完成档案、衣物等图片上传。API 原来用服务端内部 `S3_ENDPOINT` 同时生成签名 URL；当它是 `127.0.0.1` 时，手机会把对象存储请求发到手机自身，导致所有复用该流程的上传失败。

现在 `S3_ENDPOINT` 仅供 API 内部读写对象，新增可选 `S3_PUBLIC_ENDPOINT` 专门用于签发客户端上传和读取 URL。设备调试使用局域网地址；生产配置校验要求 HTTPS。上传专项新增签名 URL origin 断言，避免回归成回环地址。设备配置步骤见[微信真机调试说明](../operations/WECHAT-DEVICE-DEBUGGING.md)。

## 验证证据

- `LUMI_API_URL=http://127.0.0.1:4358/api/v1 LUMI_EXPECTED_UPLOAD_ORIGIN=http://192.168.1.10:59000 pnpm --filter @lumi/api test:storage`：34 次真实本机 Nest HTTP 请求通过；实际 SeaweedFS S3 上传 URL origin 为 `http://192.168.1.10:59000`，并覆盖签名策略、对象上传、完成、读取、并发、过期和物理清理。
- 修复后重启当前设备调试 API `4300`，并在该端口执行 `LUMI_API_URL=http://127.0.0.1:4300/api/v1 LUMI_EXPECTED_UPLOAD_ORIGIN=http://192.168.1.10:59000 pnpm --filter @lumi/api test:storage`：34 次真实 HTTP 请求通过；完整链路实际使用设备可达地址。
- `LUMI_API_URL=http://127.0.0.1:4358/api/v1 pnpm --filter @lumi/api test:media-moderation`：19 次真实本机 HTTP/PostgreSQL 请求通过，覆盖分类筛选后的跨页游标。
- `pnpm check`：格式、Lint、全 workspace 类型检查、单测和 API/后台/小程序构建通过。

## 尚未验收

设备调试 API `4300` 已使用 `S3_PUBLIC_ENDPOINT=http://192.168.1.10:59000` 启动，健康检查和完整存储专项均通过。此处证明真实本机服务及 S3 互通，不代表微信开发者工具、iOS/Android 真机、生产 HTTPS 域名或生产对象存储已验收。

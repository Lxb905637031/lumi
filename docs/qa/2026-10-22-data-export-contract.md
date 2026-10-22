# 数据导出响应契约验证

日期：2026-10-22

命令：`pnpm --filter @lumi/api test:account-privacy`

## 验证范围

- 通过真实本地 NestJS HTTP、PostgreSQL、Redis 与对象存储清理队列申请并下载账号数据导出。
- 导出中包含用户可理解的媒体元信息，但不包含 `objectKey`、`stagingObjectKey`、`sha256`、`previewData`、上传租约、处理令牌、幂等键等内部字段。
- 账号导出仍保持所有者隔离、异步就绪、过期和注销状态机行为。

## 结果

- 16 次真实 HTTP 请求通过，测试 fixture 在 finally 中清理。
- 断言下载结果的 `mediaAssets` 字段白名单为：`id`、`mimeType`、`byteSize`、`status`、`visibility`、`createdAt`。
- 内部存储标记、预览标记和对象路径均未出现在导出 JSON 中。

这是本地开发环境的契约与联调证据，不代表生产部署、微信真机或平台合规验收。

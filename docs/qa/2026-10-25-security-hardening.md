# 2026-10-25 API 安全加固

## 已实现

- Fastify API 在全局路由和 CORS 之前注册 `@fastify/helmet`，提供 MIME、点击劫持、跨源策略等安全响应头；生产才启用 HSTS，开发 HTTP 不强制升级。
- `CORS_ORIGINS` 只接受显式 HTTP(S) origin，拒绝通配符、凭据、路径、查询和 hash；API 不使用 cookie，因此明确 `credentials: false`。
- `x-request-id` 加入 CORS exposed headers，浏览器客户端可以在错误提示中读取支持编号。
- Fastify 全局 body limit 保持 7.1MB，仅兼容开发 base64 图片接口；生产媒体上传仍必须使用签名对象存储，不把 body limit 当作文件安全校验。

## 验证边界

- 配置单测覆盖合法 origin 规范化和通配符、路径、凭据、协议拒绝。
- `pnpm check` 覆盖格式、ESLint、TypeScript、单测和三端构建。
- 仍缺分布式限流、生产风控、压力演练、合法微信域名和真机验收；本轮未标记 Q05 或项目为生产完成。

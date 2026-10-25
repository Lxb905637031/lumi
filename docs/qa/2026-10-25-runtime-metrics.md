# 2026-10-25 进程内运行指标

## 范围

本轮扩展 API `/api/v1/health/metrics`，用于本地诊断与后续指标导出接入：

- HTTP 请求总数、2xx/4xx/5xx 状态组及固定延迟桶。
- generation 与 announcement-delivery 队列的 started/succeeded/skipped/retrying/dead-letter 计数。
- 既有进程 uptime、RSS、heap 和 Node 版本信息。

指标仅存于单个 API 进程内存，进程重启清零，多实例不聚合；不提供 Prometheus exporter、告警、模型/对象存储指标或生产值守，因此 R04 仍为部分完成。指标不以 URL、用户 ID、requestId、workflowId 或 BullMQ jobId 作为聚合标签，避免高基数和敏感数据泄漏。

## 验证

- API 单测覆盖状态分组、延迟桶边界/溢出、固定队列标签和 outcome 聚合。
- `pnpm check`：格式、ESLint、全 workspace TypeScript、单测和 API/后台/小程序构建。
- 本轮未执行真实 HTTP/PostgreSQL/Redis 联调；本机 PostgreSQL、Redis 与 Docker 不可用。不得将单测和构建视为生产指标/告警验收。

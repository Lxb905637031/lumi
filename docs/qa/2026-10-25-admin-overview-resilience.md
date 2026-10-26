# 后台运营总览可恢复状态

## 实现

- 总览指标从 DashboardPage 拆为 `OverviewMetrics`，集中管理服务端读取、加载、错误和重试状态。
- 首次加载显示明确的读取状态，不再把请求尚未返回误显示为零。
- 服务端请求失败会保留已有指标、显示可定位的错误信息，并提供刷新/重试入口；不会静默吞掉异常。
- 指标来源仍为 `GET /api/v1/admin/overview`，没有引入固定 fixture 或前端计算的伪造统计。

## 验证边界

- `pnpm --filter @lumi/admin typecheck`
- `pnpm --filter @lumi/admin build`
- `pnpm check` 全 workspace 检查通过。

浏览器权限过期、真实 API 断网和生产值守告警仍需在部署环境验收；本组件改动不代表运营报表、持久指标后端或生产监控已完成。

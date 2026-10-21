# 人物档案历史版本选择验证

## 实现范围

- 新增登录保护的 `GET /body-profiles/:id/versions`，仅对档案所有者开放，停用/不存在/他人档案统一返回 404。
- 历史版本按不可变递增版本号倒序游标分页；参数复用 `CursorPaginationDto`，非法游标返回 400。列表仍只加载每个档案最新版本，历史数据按用户请求读取，避免扩大常规列表响应。
- 试穿工作流只在用户已明确选中档案版本后加载该档案历史，合并时按版本号排序且不改变当前选择；用户选中的旧 `profileVersionId` 原样用于确认和任务创建。

## 验证结果

- `pnpm --filter @lumi/miniapp test`：29 项通过，新增历史版本按需读取及明确选择后使用原版本 ID 创建任务的工作流测试。
- API/小程序 TypeScript 类型检查及 Nest API 构建通过；`pnpm --filter @lumi/miniapp build` 成功。
- `pnpm --filter @lumi/api test:try-on-client`：本机真实 Nest HTTP/PostgreSQL/Redis/SeaweedFS 联调通过，共 27 次 API 请求及真实对象上传。覆盖版本游标跨页、非法游标 400、跨用户 404；工作流将档案从 v3 改选到 v1，生成任务数据库记录引用仍为 v1；幂等响应丢失恢复后仅有一个任务和一次额度结算。
- 运行 `pnpm --filter @lumi/api test:try-on-client` 时使用独立的本地 API `127.0.0.1:4399`，未停止原有 4300/4301 服务。所有数据均为本轮唯一 run ID fixture，测试 finally 清理用户和任务，图片先登记对象清理。

## 未覆盖与发布边界

- 真实 HTTP 使用注入 adapter 调用平台无关工作流，不代表 Taro `request`、原生 `Picker`、弹窗或微信真机验收。
- 图像模型仍为 `local-svg`，不是真实 AI；真实微信账号、生产数据库、微信合法域名及线上模型均未接入。
- 版本冲突仍由保存时 `expectedVersion` 返回 409；用户需要刷新后显式编辑，没有静默覆盖。本次未增加自动冲突合并或旧任务快照回填。

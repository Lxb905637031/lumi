# 衣橱 API 响应契约验证

## 实现范围

- `WardrobeService` 不再直接返回 Prisma `ClothingItem` 模型。
- 列表、详情、创建和更新统一映射到共享 `ClothingItem` 契约，时间字段输出 ISO 字符串，响应不包含 `deletedAt` 等持久化内部字段。
- 映射层对品类做运行时守卫，只允许 `TOP`、`BOTTOM`、`DRESS`；无效历史数据显式报错，不静默改写衣物品类。

## 验证结果

- `pnpm --filter @lumi/api typecheck` 与 `pnpm --filter @lumi/api build` 通过。
- `pnpm --filter @lumi/api test:integration` 在独立本地 API 端口执行并通过，共 129 次真实 HTTP 请求；新增创建/更新响应字段白名单、ISO 时间和内部字段不泄漏断言。
- 全仓 `pnpm check` 通过：格式、Lint、类型检查、API/小程序/analytics 测试及三端构建均通过。

## 边界

- 本阶段只收敛衣橱 feature 的响应边界；E02 仍保持部分完成，其他服务需分批迁移。
- 本地 HTTP/数据库验证不代表微信真机、生产部署或真实 AI 验收。

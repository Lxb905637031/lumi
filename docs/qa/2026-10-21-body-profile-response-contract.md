# 身材档案 API 响应契约验证

## 实现范围

- `BodyProfilesService` 不再把 Prisma `BodyProfile`/`BodyProfileVersion` 记录直接交给响应层。
- 列表、详情、创建、更新和历史版本接口统一映射到 `@lumi/contracts` 的 `BodyProfile`、`BodyProfileVersion` 和 `CreateBodyProfileResponse` 结构。
- 时间字段统一输出 ISO 字符串；测量 JSON 只输出六个受支持的数值字段，不把数据库内部的 `archivedAt` 或其他持久化列暴露给客户端。
- 创建/更新响应中的嵌套档案包含当前返回版本，客户端可直接使用共享契约，不依赖 ORM 字段形状。

## 验证结果

- `pnpm --filter @lumi/api typecheck` 与 `pnpm --filter @lumi/api build` 通过。
- 新 API 在独立本地端口 `127.0.0.1:4431` 启动后，`pnpm --filter @lumi/api test:integration` 通过，共 129 次真实 HTTP 请求；集成烟测断言创建/详情响应的字段白名单、ISO 时间、嵌套版本和内部列不泄漏。
- 同端口 `pnpm --filter @lumi/api test:try-on-client` 通过，共 27 次真实 HTTP 请求，历史版本分页、越权、旧版本选择和任务快照均保持通过。

## 边界

- 本阶段只收敛身材档案 feature 的响应边界，交付矩阵 E02 仍保持部分完成；衣橱、社区、运营等服务需按各自契约分批迁移。
- 本地 HTTP/数据库验证不代表微信真机、生产部署或真实 AI 验收。

# Lumi 工程架构与编码约定

本文档是 Lumi 客户端、运营后台和 API 的目录边界与代码评审基准。架构按 feature 优先组织；简单功能保持直接，复杂流程才引入领域层、端口和 adapter，避免页面堆逻辑，也避免为了分层而制造空壳。

## 系统边界

```text
apps/miniapp  -> packages/contracts <- apps/admin
      |                                  |
      +--------------- HTTP API ---------+
                         |
                     apps/api
                         |
                   Prisma / adapters
```

- `apps/miniapp`：Taro + React 微信小程序。页面负责布局和导航，feature 负责用户任务，service 负责平台/API 边界。
- `apps/admin`：React + Vite + Tailwind CSS 运营后台。页面组合功能，feature 拥有业务视图与数据状态，通用布局和控件放在 `components`；Tailwind 只使用语义化 Lumi theme token，不散落任意颜色值。
- `apps/api`：NestJS 模块化单体。模块按业务域封装；Controller 只处理 HTTP，Service 编排用例，第三方/异步实现通过 token 注入。
- `packages/contracts`：跨应用共享的 HTTP DTO 类型、状态枚举和响应类型。不得依赖 Nest、Prisma、React 或 Taro。

## 目录约定

```text
apps/api/src/
  config/                 # 环境校验和配置
  common/                 # 认证上下文、守卫、异常等横切能力
  prisma/                 # 数据库生命周期和 Prisma client
  health/                 # 健康检查
  auth/                   # Controller / DTO / Service / Module
  body-profiles/          # Controller / DTO / Service / Module
  wardrobe/               # Controller / DTO / Service / Module
  generations/            # 用例编排、BullMQ 队列、provider 端口和本地适配器
  moderation/             # 管理审核队列、状态变更和审计记录
  media/                  # 显式开发媒体适配与拥有权校验
  community/              # 发布、Feed、评论、点赞、收藏和举报
  notifications/          # 审核/生成消息与已读状态
  operations/             # 后台运营指标，Controller -> Service -> Prisma

apps/miniapp/src/
  app.tsx                 # 小程序应用入口
  pages/                  # 路由级容器，只做页面组合
  components/              # 跨 feature 的纯展示组件
    ui/                    # Button、Feedback 等无业务含义的基础控件
  features/<feature>/      # 一个可交付用户任务的 UI、hook、API
  services/                # Taro HTTP client、token 等平台边界
  styles/                  # 语义 token 和全局基础样式

apps/admin/src/
  pages/                   # 页面级组合
  components/              # 后台共享布局与基础控件
  features/<feature>/      # 业务视图、状态和服务
  services/                # 后台 HTTP client、会话等
  styles/                  # 全局 reset、token

packages/contracts/src/    # 纯 TypeScript 公共契约
```

## 依赖规则

1. 依赖方向从入口向下：`page -> feature -> service/contract`；底层不得反向导入页面。
2. feature 可以使用共享组件，但共享组件不得引用具体 feature。
3. API feature 可依赖 `PrismaModule` 和明确导出的其他模块；不要使用隐式全局业务 provider。
4. Controller 不直接访问 Prisma，不放业务分支；DTO 使用 class-validator 装饰器。
5. Prisma model 不是对外 API 类型。Service 显式选择/映射字段，避免把敏感字段或数据库演进泄漏给客户端。
6. 第三方存储、AI 推理、支付、通知和持久化队列使用接口/token 注入。开发 adapter 要显式命名为 mock/local，不能被误认为生产实现。
7. `packages/contracts` 只放稳定的跨应用协议；feature 内部状态和展示模型留在 feature 内。

## 编码风格

- TypeScript 开启严格类型；禁止裸 `any`、无边界的 `Record<string, unknown>` 作为业务模型，以及 `as` 强转掩盖不匹配。
- 命名使用 PascalCase 类/React 组件，camelCase 函数和变量，UPPER_SNAKE_CASE 环境变量/注入 token；文件名 kebab-case，React 组件目录使用 PascalCase。
- React 页面只组合组件和路由状态；异步任务放在 feature hook/service。组件通过明确 props 接收数据和回调，不直接读全局 API。
- 组件拆分遵循三级边界：`components/ui` 提供无业务基础控件，`features/<feature>/components` 承载业务组件，`pages` 只组合功能区。共享组件不反向依赖 feature。
- 后台用 Tailwind 主题 token 表达语义颜色和排版；复杂可复用交互才抽成组件，不把整页塞进一个 JSX，也不为每一条 class 建造包装器。
- Taro 页面只使用 Taro 原语与 API，不调用浏览器 DOM、`window` 或 `document`。
- API 输入必须经过 DTO + 全局 ValidationPipe；错误转换成统一 HTTP 错误语义，禁止吞掉异常后返回伪成功。
- 管理后台路由必须同时经过身份认证与 RBAC；审核状态变更使用条件更新避免并发覆盖，并记录操作审计。
- 异步提交必须可重试且幂等；队列生产实现需要持久化、失败重试、死信/人工恢复和状态观测。当前生成任务使用 Redis/BullMQ，`LocalGenerationProvider` 只用于免费开发和 CI，不能替代生产模型 provider。
- 组件和函数聚焦单一职责；只有存在真实复用或边界价值时才抽象，不为目录整齐创建无行为的包装层。
- 每个业务 feature 至少覆盖正常、空、加载、失败和重复提交测试；跨应用协议变化必须跑 API、miniapp、admin 的 typecheck/build。
- 提交前统一运行 `pnpm check`：Prettier、ESLint、全 workspace typecheck、单测和三端构建。CI 另启 Postgres 和 Redis 执行 API smoke integration。

## 当前边界与上线门槛

- miniapp 已拆分首页、档案、衣橱、发布、帖子详情、我的帖子/收藏、生成记录和消息路由，并接 API；未经微信运行时/真机验证，不能因路由存在就认定模块已交付。
- admin 已使用账号密码登录、真实审核/指标数据和操作审计；开发浏览器验收不替代完整运营模块及生产安全验收。会话刷新须合并并行请求，失效须退出工作台。
- `FREE_MODE=true` 只允许本地联调和 mock adapter。公开部署必须关闭并接入真实微信登录、媒体对象存储、审核、生成 provider、持久化队列、速率限制、备份与监控。
- 生产发布需要数据库迁移审查、API 集成测试、真机小程序验收和后台权限验收。免费开发环境不等于免费生产容量，也不代表已经达到生产可用标准。
- 发布候选验收以 [DEFINITION-OF-DONE.md](DEFINITION-OF-DONE.md) 为准；开发 fixture/mock 不得在用户界面或文档中伪装为生产数据与能力。
- 全量 JD 和企业级要求的逐项状态以 [DELIVERY-MATRIX.md](DELIVERY-MATRIX.md) 为准；只将有验证证据且范围明确的子项标记为完成。

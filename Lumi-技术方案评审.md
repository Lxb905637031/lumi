# Lumi 技术方案评审（V0.1）

## 1. 评审结论

Lumi 可以采用 Taro + React + TypeScript 的微信小程序前端和 NestJS 的服务端实现，并按企业级项目的方式拆分业务模块、异步生成、权限、审计、测试和部署。

“免费”需要拆成两个范围：

- 免费开发和小范围内测：可行。使用开源框架、本地数据库、本地对象存储、Docker Compose、本地模型或免费额度，软件许可成本为 0。
- 长期公网商业上线：不能承诺 0 成本。微信主体/认证、域名和 HTTPS、稳定服务器、对象存储、GPU 推理、内容审核、备份和短信/支付能力都可能产生费用。

首版应先建设可替换的系统，不把任何商业模型、云厂商或付费存储写死。开发环境全部本地化，AI 通过 Provider 接口接入；未来有预算时，只替换模型、对象存储和部署层。

## 2. 目标架构

```text
微信小程序（Taro + React + TypeScript）
        |
        | HTTPS / JSON API
        v
NestJS API（认证、业务、审核、额度、消息）
        |
        +--> PostgreSQL（业务数据）
        +--> Redis（缓存、限流、队列状态）
        +--> MinIO（私有图片和生成结果）
        +--> BullMQ Worker（异步生成、审核、缩略图）
        +--> AI Provider（本地 ComfyUI/开源模型或外部 API）
        +--> FFmpeg/图像处理（缩放、压缩、元数据清理）

运营后台（React + Vite + Ant Design）
        |
        +--> 使用同一套 NestJS 管理 API 和 RBAC
```

生产环境将 API、Worker、数据库、Redis 和 MinIO 分开部署；开发和内测可以用一台机器的 Docker Compose 运行。小程序不直接访问数据库、Redis、模型服务或 MinIO 管理接口。

## 3. 技术选型

### 客户端

- Taro 4 + React 18 + TypeScript；首版不追 React 19，减少小程序生态兼容风险。
- Zustand 管理客户端状态；请求状态使用 TanStack Query，避免把服务端数据长期复制到全局状态。
- Taro 原生组件优先，图片使用 `Taro.chooseImage`、`Taro.compressImage`、`Taro.uploadFile` 或分片上传封装。
- 路由按登录、社区、试穿、消息、我的五个域划分。
- 统一网络层负责 access token、刷新 token、超时、重试、取消请求、错误码和埋点。
- 不在小程序端保存敏感身材参数、模型密钥或对象存储长期密钥。

### 服务端

- NestJS 11 + Fastify Adapter。
- Prisma + PostgreSQL 16；所有查询使用 DTO、分页和稳定排序。
- Redis 7：BullMQ 队列、短期缓存、频控、幂等键和分布式锁。
- `@nestjs/config` 启动时校验所有环境变量。
- JWT access token + refresh token；微信登录通过服务端调用 `code2Session`，小程序只提交临时登录 code。
- OpenAPI/Swagger 生成接口契约；前后端共享 TypeScript DTO 类型或由 OpenAPI 生成客户端。

### 文件和媒体

- 开发/内测：MinIO，S3 兼容，完全免费本地运行。
- 生产：可以切换到任意 S3 兼容对象存储；使用预签名 URL，API 不转发大文件。
- 服务端处理缩略图、尺寸限制、EXIF 清理、格式转换、内容哈希和病毒/恶意文件检测。
- 原图、处理中间产物、公开缩略图和删除标记使用不同 bucket/prefix 和访问策略。

### AI 和媒体生成

- 定义 `ImageGenerationProvider`、`BodyProfileProvider`、`ContentModerationProvider` 接口。
- 免费路径：本地 ComfyUI + 开源图像模型；如果没有 GPU，只支持低分辨率验证，不能承诺可接受的生产等待时间。
- 模型调用放在 Worker，不在 HTTP 请求内同步等待。
- 每次生成保存模型版本、参数、随机种子、输入资产快照、耗时、错误码和成本字段。
- 未来接入外部模型时，只增加 Provider，不修改业务表和小程序流程。

### 运营后台

- React + Vite + Ant Design，独立构建但复用 API 契约和权限模型。
- 首版只做审核、举报、用户状态、任务状态、额度配置、推荐置顶和审计日志。
- AI 模型内部控制台与业务审核后台分开，避免管理员直接操作模型密钥和生产队列。

### 部署和运行

- Docker Compose：`api`、`worker`、`postgres`、`redis`、`minio`、`admin`、`nginx/caddy`。
- Caddy 或 Nginx 负责 HTTPS、静态资源、请求体限制和反向代理。
- GitHub Actions 或本地脚本执行 lint、类型检查、测试、构建和镜像打包；不依赖付费 CI。
- 日志采用 JSON 输出，开发写本地文件，内测可通过 Loki/Grafana 或简单的结构化日志检索。
- 每日数据库备份到独立磁盘；正式环境至少保留一份异地备份。

## 4. NestJS 模块边界

每个业务模块拥有自己的 controller、service、DTO、repository/adapter、策略和测试；`AppModule` 只负责组合模块，不承载业务逻辑。

```text
src/
  app.module.ts
  config/
  common/
    guards/             # JWT、角色、资源权限
    pipes/              # DTO 验证与转换
    filters/            # 统一错误响应
    interceptors/       # request-id、日志、响应元数据
    idempotency/
  auth/                 # 微信登录、token、注销
  users/                # 用户、状态、隐私设置
  body-profiles/        # 身材档案、参数快照、分身候选
  wardrobe/             # 衣物资料和图片资产
  assets/               # 预签名上传、媒体元数据、删除
  generations/          # 生成任务、额度、结果和重试
  community/             # Feed、帖子、点赞、评论、收藏、举报
  follows/              # V1.1 关注、回关和关系同步
  topics/               # V1.1 话题和挑战
  notifications/        # 系统、互动、关注三类消息
  moderation/            # 自动初筛、人工审核、处罚
  admin/                 # 后台查询、配置和审计
  billing/              # 额度、订单、退款，支付确认后启用
  jobs/                 # BullMQ processors 和任务编排
  health/               # readiness/liveness
  database/              # PrismaService 和迁移
```

依赖方向固定为：Controller -> Application Service -> Domain/Policy -> Repository/Adapter。模型服务、对象存储、消息发送和审核服务都通过接口注入，业务模块不直接依赖第三方 SDK。

## 5. 核心数据模型

建议使用 PostgreSQL，关键表如下：

| 表 | 关键字段 | 约束/用途 |
| --- | --- | --- |
| users | id, wx_open_id, status, created_at | `wx_open_id` 唯一；支持注销和封禁 |
| user_sessions | user_id, refresh_token_hash, expires_at | 只保存 hash，不保存明文 refresh token |
| body_profiles | id, user_id, status, profile_version | 一个用户可有多个，首版只启用默认档案 |
| body_profile_versions | profile_id, measurements_ciphertext, source_asset_id | 身材参数加密；生成时使用版本快照 |
| avatar_candidates | profile_version_id, asset_id, status, model_version | 待确认、已确认、已弃用 |
| clothing_assets | id, user_id, category, metadata, source_asset_id | 首版限制上装/下装/连衣裙 |
| media_assets | id, owner_id, object_key, sha256, visibility, deleted_at | 私有原图和公开图分权 |
| generation_jobs | id, user_id, idempotency_key, status, provider, retry_count | 状态机、幂等和重试主表 |
| generation_inputs | job_id, profile_version_id, clothing_asset_id, params_json | 不随用户资料变化 |
| generation_outputs | job_id, asset_id, quality_status, selected_at | 多候选结果和用户确认 |
| credit_accounts | user_id, balance, version | 额度余额使用乐观锁 |
| credit_ledger | user_id, job_id, delta, reason, idempotency_key | 账本不可篡改，失败返还可追溯 |
| posts | id, author_id, status, visibility, moderation_status | 审核通过后才进入 Feed |
| post_assets | post_id, asset_id, sort_order | 1-9 张图片 |
| comments | id, post_id, author_id, parent_id, status | 首版一级评论和一级回复 |
| reactions | user_id, target_type, target_id, type | 唯一约束避免重复点赞/收藏 |
| follows | follower_id, following_id, status | V1.1；唯一约束和关系状态同步 |
| notifications | user_id, category, target_type, target_id, read_at | 系统/互动/关注三类 |
| moderation_cases | target_type, target_id, decision, reason, reviewer_id | 审核和举报统一留痕 |
| admin_audit_logs | admin_id, action, target_type, target_id, request_id | 管理员操作审计 |
| outbox_events | aggregate_type, aggregate_id, event_type, status | 可靠投递通知和异步任务 |

数据库约束和服务端校验必须同时存在。涉及生成任务、额度扣除、结果确认、帖子发布的跨表写入使用事务；不要在 Controller 中拆成多个独立写操作。

## 6. 核心 API

所有接口使用 `/api/v1` 前缀、统一 request-id、统一错误码和 DTO 校验。公开列表必须有上限、游标或稳定分页。

### 用户和资料

- `POST /auth/wechat/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `DELETE /users/me`
- `GET /body-profiles`
- `POST /body-profiles`
- `PATCH /body-profiles/:id`
- `POST /body-profiles/:id/candidates/:candidateId/confirm`
- `GET /body-profiles/:id/versions`

### 文件和衣物

- `POST /assets/upload-intents`
- `POST /assets/:id/complete`
- `DELETE /assets/:id`
- `GET /wardrobe/items`
- `POST /wardrobe/items`
- `PATCH /wardrobe/items/:id`
- `DELETE /wardrobe/items/:id`

### 生成

- `POST /generation-jobs`：幂等创建任务，写入输入快照
- `GET /generation-jobs/:id`
- `POST /generation-jobs/:id/retry`
- `POST /generation-jobs/:id/cancel`
- `POST /generation-jobs/:id/select-output`
- `POST /generation-jobs/:id/save`

### 社区

- `GET /feed?cursor=&limit=`
- `POST /posts`
- `GET /posts/:id`
- `DELETE /posts/:id`
- `POST /posts/:id/like`
- `POST /posts/:id/favorite`
- `GET /posts/:id/comments`
- `POST /posts/:id/comments`
- `DELETE /comments/:id`
- `POST /reports`
- V1.1：`POST /follows/:userId`、`DELETE /follows/:userId`、`GET /users/:id/followers`

### 消息和后台

- `GET /notifications?category=&cursor=`
- `POST /notifications/read-all`
- `POST /notifications/:id/read`
- `/admin/moderation/*`
- `/admin/generation-config/*`
- `/admin/feature-flags/*`
- `/admin/audit-logs`

## 7. 生成任务的企业级实现

生成不能由接口直接等待模型返回。推荐流程：

```text
创建任务
  -> 校验输入和额度
  -> 事务写入 generation_job + input_snapshot + outbox_event
  -> Worker 消费队列
  -> 处理图片和调用 Provider
  -> 写入候选结果与任务状态
  -> 内容审核
  -> 通知用户
  -> 用户确认/保存/发布
```

状态机：`DRAFT -> QUEUED -> RUNNING -> SUCCEEDED/FAILED/CANCELLED`。每次状态迁移记录时间、原因和 request-id；非法迁移直接拒绝。

关键规则：

- 生成接口要求客户端传 `Idempotency-Key`；数据库对 `user_id + idempotency_key` 建唯一约束。
- 额度不能只存一个余额数字；使用账本记录预扣、成功扣除、失败返还和人工调整。
- 预扣、任务创建、输入快照和 outbox 事件在一个事务内完成。
- Worker 只处理租约未过期的任务，超时任务可恢复；重试采用指数退避和最大次数。
- 第三方模型调用设置超时、熔断、限速和 Provider 级错误映射。
- 任务失败时只能返还同一个账本事务，防止重复返还。
- 生成结果默认私有，用户确认并通过审核后才生成公开引用。

## 8. 安全、隐私和合规

- 使用 JWT Guard、角色 Guard 和资源归属校验；管理员接口不能只依赖前端隐藏按钮。
- 所有 Controller 使用 DTO + `ValidationPipe`，开启 `whitelist`、`forbidNonWhitelisted` 和转换策略。
- 频控范围包括登录、上传、生成、评论、点赞和举报；按用户、IP、设备指纹分层限速。
- 图片对象默认私有，下载通过短时预签名 URL；禁止把 MinIO 管理端口暴露到公网。
- 身材测量、人物照片和微信标识视为敏感数据；数据库敏感字段加密，日志禁止输出原图 URL、token 和测量值。
- 上传时限制 MIME、文件大小、像素尺寸和扩展名，重新解码图片后再保存，清理 EXIF。
- 权限拒绝不能阻塞公开社区浏览；涉及照片和身材数据的操作必须逐项授权。
- 支持删除、导出和注销流程，删除任务需要处理原图、候选、中间产物和未公开结果。
- AI 生成内容保留生成标记和模型记录；社区内容必须经过自动初筛和人工处理队列。
- 配置通过环境变量和密钥文件注入，启动校验必填项，不能在代码和小程序包中放密钥。

## 9. 测试和质量门槛

### 必须自动化

- DTO、权限 Guard、资源归属、状态机、额度账本和幂等逻辑的单元测试。
- Prisma migration、唯一约束、事务边界和分页查询的集成测试。
- 登录、上传、创建生成任务、失败返还、发布审核、点赞评论和消息定位的 API 测试。
- 真实微信开发者工具和至少一台 iOS/Android 真机回归。
- 弱网、上传中断、重复点击、授权过期、超大图片、队列重试和 Worker 重启演练。

### 首发质量指标

- API 错误响应稳定且可定位，所有请求有 request-id。
- Feed、评论、消息和后台列表都限制 `limit`，并使用游标或稳定排序。
- 生成接口不在 HTTP 请求内等待模型；队列可查看积压、失败和重试。
- 数据库有迁移和可恢复备份，发布流程支持回滚。
- 关键链路覆盖率以业务断言为准，不能只追求代码行覆盖率。

## 10. 免费实现方案

### 开发和演示阶段

```text
Node.js + pnpm
Docker Compose
PostgreSQL
Redis
MinIO
NestJS API
BullMQ Worker
Taro 小程序
React/Vite 管理后台
ComfyUI + 开源图像模型（有 GPU 时）
```

这些组件均可免费使用。开发数据放本机，图片和模型不依赖付费云服务。

### 免费方案的实际限制

- 本地没有 GPU 时，AI 图像生成速度和质量无法满足稳定商业体验。
- 免费模型、免费 API 额度和公共免费托管通常有调用量、并发、存储或休眠限制。
- 微信小程序正式上线需要满足主体、类目、域名、HTTPS 和平台审核要求；这些不是代码成本，但可能有主体认证或基础设施成本。
- 单台电脑不具备高可用、异地备份和 24 小时在线能力，只适合开发、演示和小范围内测。
- 公开社区需要内容安全审核；完全依赖本地开源模型会增加误审和漏审风险。

因此，零预算阶段的上线定义应是：在已有电脑或已有服务器上完成开发和受控内测，不承诺大规模公开商业运营。产品数据、模型和部署都保留替换接口，后续有预算时可迁移。

### 零预算运行模式

首版增加 `FREE_MODE=true` 配置，避免支付和商业模型成为系统启动依赖：

- 关闭真实支付、订单和退款，只使用后台发放的体验额度。
- 每个用户设置每日生成上限、图片大小上限和排队上限，防止本地机器被单个用户耗尽。
- 使用 `MockImageGenerationProvider` 验证完整业务链路；有可用 GPU 时切换到本地 ComfyUI Provider。
- 所有生成记录仍保留 Provider、模型、耗时和错误字段，后续可以无损切换付费模型。
- 公开社区先采用邀请制或灰度白名单，避免免费基础设施承受不可控流量。

这里的“免费”指开发和内测不采购商业软件、云 API 或付费模型。若要求面向不受控公众长期开放，必须重新评估计算、存储、带宽和审核资源。

## 11. 主要风险

| 风险 | 等级 | 影响 | 处理策略 |
| --- | --- | --- | --- |
| AI 生成成本和 GPU 不可控 | P0 | 无法稳定交付生成结果 | Provider 抽象、低清预览、队列限流、成本字段；首发限制体验额度 |
| 人物一致性和试穿效果不稳定 | P0 | 用户认为产品没有价值 | 角色/衣物输入规范、多候选、人工确认、结果不承诺尺码合身 |
| 免费部署不稳定 | P0 | 小程序不可访问或数据丢失 | 内测规模限制、健康检查、备份和恢复演练；正式上线准备稳定主机 |
| 微信平台审核或能力限制 | P0 | 无法发布或无法使用某些能力 | 早期完成主体和类目核查，支付/内容/隐私能力做开关 |
| 敏感图片泄露 | P0 | 信任和合规风险 | 私有对象、短时 URL、加密、最小权限、删除链路和审计 |
| 内容审核漏审 | P0 | 社区违规和平台风险 | 自动初筛 + 人工复核，未审核内容不进 Feed |
| 重复生成/重复扣额度 | P0 | 财务和用户投诉 | 幂等键、额度账本、事务、状态机和并发测试 |
| 队列任务丢失或卡死 | P1 | 用户长时间无结果 | BullMQ 持久化、租约、重试、死信、任务超时和恢复命令 |
| Feed/评论无界查询 | P1 | 内存暴涨和接口变慢 | 强制分页、游标、索引、限流和查询监控 |
| 小程序端内存和真机兼容 | P1 | 上传崩溃、图片白屏 | 压缩、分片、缩略图、及时释放临时文件、多机型回归 |
| 过早做复杂社区功能 | P1 | 周期拉长，核心价值无法验证 | MVP 只做推荐 Feed 和基础互动，关注/挑战后置 |
| 单体模块互相耦合 | P1 | 后续改模型或存储成本高 | NestJS 按特性模块拆分，Provider/Adapter 接口化 |
| 依赖免费第三方服务变更 | P1 | 功能突然失效 | 供应商配置化、健康检查、降级状态和替代 Provider |

## 12. 分阶段实施

### 阶段 0：技术验证，1 周

- Taro 小程序调用 NestJS 健康接口和微信登录模拟接口。
- Docker Compose 启动 PostgreSQL、Redis、MinIO。
- 完成预签名上传、图片压缩和本地生成 Provider 假实现。
- 确认本机能否运行目标开源模型；不能运行则只验证 Provider 和任务流程。

### 阶段 1：业务 MVP，3-5 周

- 登录、身材档案、衣物上传、生成任务、历史记录。
- 生成任务队列、失败重试、额度账本和系统消息。
- Feed、帖子、点赞、评论、收藏、举报和最小审核后台。
- 全链路单元测试、API 测试和真机回归。

### 阶段 2：内测上线，2-3 周

- 隐私删除、审计、备份、限流、监控、故障恢复。
- 10-50 个种子用户灰度。
- 记录生成耗时、成功率、保存率、发布率和用户反馈。
- 根据数据决定是否加入关注、挑战、三类消息和付费额度。

### 阶段 3：正式运营准备

- 稳定服务器、域名 HTTPS、对象存储、异地备份和模型容量。
- 内容审核策略、客服流程、支付/退款和数据留存策略。
- 关注关系、话题挑战、完整三类消息和推荐策略。

## 13. 技术评审后的首版裁决

首版允许免费建设和内测，技术基线为：Taro + React + TypeScript、NestJS + Fastify、PostgreSQL、Redis/BullMQ、MinIO、Docker Compose、Provider 化 AI Worker。

首版必须先解决数据隐私、任务可靠性、失败返还、审核闭环和真实微信环境验证；视频、实时 AR、复杂推荐和商家能力继续后置。正式商业公开上线前必须重新评估服务器、模型推理、对象存储、审核和微信平台成本。


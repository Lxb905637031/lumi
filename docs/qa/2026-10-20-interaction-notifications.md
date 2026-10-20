# 互动消息、评论直达与失效恢复

2026-10-20。本阶段覆盖 N05/N07 的接口与客户端接入；不将全项标记完成。

## 行为

- 点赞与消息在同一个数据库事务内提交；帖子行锁串行化点赞与取消。数据库唯一事件键让同一用户对同一帖的重复点赞、取消后重赞只留下第一次消息，保留其已读状态。自己点赞不通知。
- 评论只有审核通过后才通知帖子作者；同一评论重复审核、移除后重新通过不重复提醒。内容不直接写进通知，避免评论撤回后残留通知摘要。
- `GET /notifications/:id/destination` 只允许消息接收者查询，并重新检查帖子、评论、生成任务的可访问性。删除/隐藏评论回到仍可访问的原帖；失效帖子给出说明。关注通知进入“关注我的”。
- `GET /community/posts/:id/comments/:commentId` 检查评论所属帖子及公开状态，支持直接读取已不在第一页的评论。
- 小程序消息操作防连续点击、离开页面及账号切换后丢弃过期跳转；帖子页复用组件显示“消息中的评论”，读取失败可重试且保留原帖。复用既有样式。

## 验证

本轮临时 API 使用 14321 端口，避免占用已有服务。验证结束关闭该临时服务。重跑可指定正在运行的最新本地 API：

```sh
LUMI_API_URL=http://127.0.0.1:14321/api/v1 pnpm --filter @lumi/api test:interaction-notifications
LUMI_API_URL=http://127.0.0.1:14321/api/v1 pnpm --filter @lumi/api test:integration
pnpm --filter @lumi/api test:migrations
pnpm --filter @lumi/api test
pnpm --filter @lumi/api typecheck
pnpm --filter @lumi/api build
pnpm --filter @lumi/miniapp typecheck
pnpm --filter @lumi/miniapp build
```

结果：互动专项 44 次 HTTP 请求、原业务回归 128 次计数 HTTP 请求、17 项 API 单测、空库/重复迁移/旧数据升级测试均通过；API 类型检查/构建、小程序类型检查/weapp 构建通过。

专项使用真实 NestJS HTTP 和 PostgreSQL。测试前通过 Prisma 创建独立账号/公开帖子 fixture，并用 fixture 角色完成审核；所有点赞、评论、审核、消息、已读、删除和导航目标操作使用 HTTP，finally 清理本轮账号。测试还执行小程序实际路由映射函数，验证服务端结果能生成预期链接。此证据不包含微信授权、Taro.request 运行时、设备渲染或真实 AI。

首轮误连接已有 4301 服务，得到旧实现不发送消息的失败；改用确认空闲的 14321 并运行本轮构建后通过。首次小程序类型检查还发现并行首页改动引用了不存在的 confirmedAt；当前工作区已修正为 selectedAt，重新检查和构建通过。

## 尚未关闭

跨用户点赞/评论聚合、运营公告投递、微信开发者工具和 iOS/Android 真机验收、生产部署均不在本轮完成口径。事件键为内部字段，不向客户端暴露；历史通知无事件键，迁移不会擅自删除历史消息。

# 2026-10-19 社区发布幂等验证

## 已执行

- `pnpm --filter @lumi/miniapp test`：21 项客户端工作流单测通过，其中 10 项覆盖发布工作流：显式登录、必填校验、部分上传失败重试、确认拒绝、双击、未知响应、离开/恢复、会话切换、生成结果复核和新建第二篇。
- `pnpm --filter @lumi/api test:publishing-client`：22 次实际 HTTP，复用发布工作流连接本机 Nest API、PostgreSQL、Redis 和 S3；服务端提交后模拟客户端丢失响应，同键恢复、5 个并发同键请求只创建一篇、内容冲突/缺键/空白输入、账号隔离、审核状态回读、删除后不复活均通过。
- 原有 `test:integration`：121 次实际 HTTP + 2 CORS 检查通过；旧发布 fixture 已加入幂等键。

测试 fixture 使用本地真实对象存储和单独上传的图片，未伪造生产模型或微信原生行为；最终清理本轮账号/数据库记录，S3 对象交给持久 cleanup 任务。

## 尚未验收

真实 Taro request/Picker/modal、微信草稿生命周期、好友分享、开发者工具及 iOS/Android 真机；帖子分享入口、关注/挑战和互动消息仍是后续功能。

# 2026-10-19 生成结果管理验证

## 范围

结果确认、云端保存/取消、删除及结果带入发布编辑。`local-svg` 是开发预览；测试通过直接数据库 fixture 增加第二个 S3 候选，不代表真实多候选 AI 已实现。云端保存不等于手机相册。

## 已执行

- `pnpm check`：格式、Lint、全 workspace 类型、17 API + 11 客户端工作流单测，Nest/Vite/Taro weapp 构建通过。
- `pnpm test:migrations`：空库、重复 deploy、基线旧数据无损升级和远端保护通过；历史结果保留 selectedAt，新增 savedAt/deletedAt 默认为 null。
- `pnpm --filter @lumi/api test:results`：首轮 40 次真实 HTTP，所有权/未登录、重复确认保留时间、确认前保存/发帖拒绝、并发唯一确认、云端保存切换、服务端 AI 标记、帖子引用删除回滚、通用媒体删除绕过拒绝、S3 逻辑删除/持久清理、删除无退款、并发发布与删除保持引用完整性。
- 原主链路 `test:integration`：121 次实际 HTTP + 2 CORS 检查通过。
- 同工作流客户端 `test:try-on-client`：本轮 17 次实际 HTTP + 2 S3 POST 通过；次数随轮询变化，验证同键恢复与唯一消费，不是 Taro 运行时。

新命令已接入 CI，需每次推送后独立确认远端结果。测试只创建唯一 runId 本轮 fixture，并在 finally 删除自己的记录；S3 文件保留持久清理任务，不重置数据库。

## 尚未验收

微信开发者工具、iOS/Android、SVG 原生显示、相册下载/权限拒绝、好友分享、真实模型及生产存储/域名。帖子发布幂等与未知响应恢复已在后续独立阶段完成，见 [社区发布验证](2026-10-19-community-publishing.md)；此处仍只记录结果发布入口，不代表微信分享验收。

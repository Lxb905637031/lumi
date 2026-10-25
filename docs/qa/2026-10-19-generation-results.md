# 2026-10-19 生成结果管理验证

## 范围

结果确认、云端保存/取消、删除及结果带入发布编辑。`local-svg` 是开发预览；测试通过直接数据库 fixture 增加第二个 S3 候选，不代表真实多候选 AI 已实现。云端保存不等于手机相册。

## 已执行

- `pnpm check`：格式、Lint、全 workspace 类型、17 API + 11 客户端工作流单测，Nest/Vite/Taro weapp 构建通过。
- `pnpm test:migrations`：空库、重复 deploy、基线旧数据无损升级和远端保护通过；历史结果保留 selectedAt，新增 savedAt/deletedAt 默认为 null。
- `pnpm --filter @lumi/api test:results`：首轮 40 次真实 HTTP，所有权/未登录、重复确认保留时间、确认前保存/发帖拒绝、并发唯一确认、云端保存切换、服务端 AI 标记、帖子引用删除回滚、通用媒体删除绕过拒绝、S3 逻辑删除/持久清理、删除无退款、并发发布与删除保持引用完整性。
- 原主链路 `test:integration`：121 次实际 HTTP + 2 CORS 检查通过。
- 同工作流客户端 `test:try-on-client`：本轮 17 次实际 HTTP + 2 S3 POST 通过；次数随轮询变化，验证同键恢复与唯一消费，不是 Taro 运行时。

## 分享链路补充（2026-10-24）

- 新增 `POST /generation-jobs/:id/outputs/:outputId/shares`、`POST /generation-shares/resolve` 和所有者撤销接口；分享 token 只存 SHA-256 摘要，默认 24 小时过期，解析 token 放在请求体中而非 API URL。
- 小程序新增分享落地页、`onShareAppMessage`、合法远程图片下载到相册、相册权限拒绝后 `openSetting` 恢复，以及 local-svg 开发预览的明确限制提示。
- 本轮静态验证：API/小程序 TypeScript、Nest build、Taro weapp build 已通过；真实分享 HTTP 尚未执行，原因是本机 PostgreSQL `127.0.0.1:55432`、Redis `127.0.0.1:56379` 与 Docker daemon 均不可用。不得把静态构建视为接口联调证据。
- 新增分享服务单元测试：签名图片地址不可用时不写入孤立分享记录；原始 token 只在创建响应返回，数据库仅保存 SHA-256 摘要；格式错误、过期、撤销和图片读取失败均拒绝解析。真实分享 HTTP 仍需基础设施恢复后执行。

新命令已接入 CI，需每次推送后独立确认远端结果。测试只创建唯一 runId 本轮 fixture，并在 finally 删除自己的记录；S3 文件保留持久清理任务，不重置数据库。

## 尚未验收

微信开发者工具、iOS/Android、SVG 原生显示、相册下载/权限拒绝、好友分享、真实模型及生产存储/域名。帖子发布幂等与未知响应恢复已在后续独立阶段完成，见 [社区发布验证](2026-10-19-community-publishing.md)；此处仍只记录结果发布入口，不代表微信分享验收。

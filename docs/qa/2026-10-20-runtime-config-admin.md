# 运行配置后台验证

后台增加配置白名单导航、JSON 编辑、变更原因、历史记录和回滚入口，继续使用既有管理员限定 API；服务端仍负责最终 schema 校验和版本并发保护。

Playwright 本机浏览器登录后实际创建 `generation.model` 首个版本并在历史中读取。`pnpm --filter @lumi/api test:runtime-config` 使用本机 PostgreSQL/Nest HTTP 验证用户越权拒绝、值 schema 校验、历史、回滚生成新版本与旧 `expectedCurrentId` 冲突拒绝。测试配置和浏览器用户清理；没有启用或调用真实模型。

未覆盖生产配置实时消费、模型热切换安全演练与高并发管理员冲突回归，因此 B07 仍为部分完成。

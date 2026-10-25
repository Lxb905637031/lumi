# 小程序会话刷新竞态

## 修复范围

- 并发 API 请求同时遇到 401 时只发送一次 refresh，共享同一个轮换后的 access token。
- refresh 开始后发生退出或账号切换时，迟到的成功响应不写回旧账号令牌。
- 迟到的无效凭据响应不清除已经切换到的新账号会话。
- 会话状态未变化时，400/401/403 refresh 响应仍清理当前失效会话；网络/服务端错误保留会话供恢复。

刷新协调器与 Taro 分离，使用注入的请求和会话边界进行确定性测试，不依赖真实令牌、微信登录或网络 fixture。

## 验收

- `pnpm --filter @lumi/miniapp typecheck`
- `pnpm --filter @lumi/miniapp test`：新增并发共享、退出迟到响应、切换账号迟到响应、新账号不等待旧刷新 4 项。
- `pnpm check`：全 workspace 格式、Lint、类型、测试和三端构建。

当前验收是纯逻辑测试和构建；Taro.request 运行时、断网/恢复行为以及微信开发者工具和 iOS/Android 真机仍未验证。
